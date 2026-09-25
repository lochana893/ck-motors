import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseUserAgent } from "@/lib/user-agent";

const blockedPrefixes = ["/admin", "/api", "/dashboard", "/login", "/register", "/forgot-password", "/reset-password", "/complete-account"];

export async function POST(request: NextRequest) {
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
  if (!pagePath.startsWith("/") || pagePath.length > 512 || !visitorId || visitorId.length > 128) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (blockedPrefixes.some((prefix) => pagePath === prefix || pagePath.startsWith(`${prefix}/`))) {
    return NextResponse.json({ ok: true });
  }

  const parsed = parseUserAgent(request.headers.get("user-agent") || "");
  const { error } = await admin.from("site_analytics_events").insert({
    event_type: "page_view",
    page_path: pagePath,
    visitor_id: visitorId,
    session_id: typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : null,
    referrer: typeof body.referrer === "string" ? body.referrer.slice(0, 512) : null,
    device_type: parsed.deviceType,
    browser: parsed.browser,
    country: request.headers.get("x-vercel-ip-country"),
  });

  if (error && process.env.NODE_ENV !== "production") console.warn("Analytics insert failed:", error.message);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
