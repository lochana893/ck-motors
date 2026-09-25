import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseUserAgent } from "@/lib/user-agent";

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false }, { status: 503 });
  }

  let body: { email?: unknown; status?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; status?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const status = body.status === "success" || body.status === "failed" ? body.status : null;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : null;
  if (!status || !email) return NextResponse.json({ error: "Invalid login activity." }, { status: 400 });

  let userId: string | null = null;
  const sessionId: string | null = null;
  if (status === "success") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (url && anonKey) {
      const cookieStore = await cookies();
      const authClient = createServerClient(url, anonKey, {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {},
        },
      });
      const { data: authData } = await authClient.auth.getUser();
      userId = authData.user?.id || null;
    }
  }

  const userAgent = request.headers.get("user-agent") || "";
  const parsed = parseUserAgent(userAgent);
  const { error } = await admin.from("login_activity").insert({
    user_id: userId,
    email,
    ip_address: requestIp(request),
    user_agent: userAgent.slice(0, 2048) || null,
    device_type: parsed.deviceType,
    browser: parsed.browser,
    operating_system: parsed.operatingSystem,
    country: request.headers.get("x-vercel-ip-country"),
    region: request.headers.get("x-vercel-ip-country-region"),
    city: request.headers.get("x-vercel-ip-city"),
    session_id: sessionId,
    login_status: status,
  });

  if (error && process.env.NODE_ENV !== "production") console.warn("Login activity insert failed:", error.message);
  return NextResponse.json({ ok: !error }, { status: error ? 500 : 200 });
}
