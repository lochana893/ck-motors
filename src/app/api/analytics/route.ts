import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseUserAgent } from "@/lib/user-agent";

const blockedPrefixes = ["/admin", "/dashboard", "/api", "/complete-account"];

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

async function resolveUserId() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  try {
    const cookieStore = await cookies();
    const authClient = createServerClient(url, anonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    });
    const { data } = await authClient.auth.getUser();
    return data.user?.id || null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = getSupabaseAdminClient();
    if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

    let body: { pagePath?: unknown; visitorId?: unknown; sessionId?: unknown; referrer?: unknown };
    try {
      body = (await request.json()) as typeof body;
    } catch {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const pagePath = typeof body.pagePath === "string" ? body.pagePath : "";
    const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : "";
    if (!pagePath.startsWith("/") || pagePath.length > 512 || !visitorId || visitorId.length > 128) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    if (blockedPrefixes.some((prefix) => pagePath === prefix || pagePath.startsWith(`${prefix}/`))) {
      return NextResponse.json({ ok: true });
    }

    const parsed = parseUserAgent(request.headers.get("user-agent") || "");
    const ipAddress = requestIp(request);
    const country = request.headers.get("x-vercel-ip-country");
    const region = request.headers.get("x-vercel-ip-country-region");
    const city = request.headers.get("x-vercel-ip-city");
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 512) : null;
    const userId = await resolveUserId();
    const now = new Date().toISOString();

    const { error } = await admin.from("site_analytics_events").insert({
      event_type: "page_view",
      page_path: pagePath,
      visitor_id: visitorId,
      session_id: sessionId || null,
      referrer,
      device_type: parsed.deviceType,
      browser: parsed.browser,
      operating_system: parsed.operatingSystem,
      country,
      region,
      city,
      ip_address: ipAddress,
      user_id: userId,
    });

    if (error && process.env.NODE_ENV !== "production") console.warn("Analytics insert failed:", error.message);

    if (sessionId) {
      try {
        const { data: existing } = await admin
          .from("visitor_sessions")
          .select("id, page_views, user_id")
          .eq("session_id", sessionId)
          .maybeSingle();

        if (existing) {
          await admin
            .from("visitor_sessions")
            .update({
              last_seen: now,
              last_page: pagePath,
              page_views: (existing.page_views || 0) + 1,
              // Once a guest logs in, keep the user link for the rest of this session
              // without ever overwriting it back to a guest.
              user_id: existing.user_id || userId,
            })
            .eq("id", existing.id);
        } else {
          await admin.from("visitor_sessions").insert({
            visitor_id: visitorId,
            session_id: sessionId,
            user_id: userId,
            ip_address: ipAddress,
            device_type: parsed.deviceType,
            browser: parsed.browser,
            operating_system: parsed.operatingSystem,
            country,
            region,
            city,
            referrer,
            landing_page: pagePath,
            last_page: pagePath,
            page_views: 1,
            first_seen: now,
            last_seen: now,
          });
        }
      } catch (sessionError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Visitor session upsert failed:", sessionError);
        }
      }
    }

    return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
  } catch (unexpectedError) {
    // Analytics must never crash the site or bubble an unhandled 500 with a stack trace.
    if (process.env.NODE_ENV !== "production") {
      console.warn("Analytics request failed unexpectedly:", unexpectedError);
    }
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
