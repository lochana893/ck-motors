import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { isIP } from "node:net";
import { cookies } from "next/headers";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseUserAgent } from "@/lib/user-agent";

const SESSION_KEY_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type SessionRequestContext =
  | {
      admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
      user: User;
      profile: { role: "admin" | "staff" | "customer"; status: string };
      sessionKey: string;
    }
  | { error: string; status: 400 | 401 | 403 | 503 };

async function getAuthenticatedUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return { user: null, error: "Authentication is not configured." };

  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll() {} },
  });
  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return { user: null, error: "You must be signed in." };
  return { user, error: null };
}

function getRequestIp(request: NextRequest) {
  const candidate = request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return candidate && isIP(candidate) ? candidate : null;
}

async function getSessionRequest(request: NextRequest): Promise<SessionRequestContext> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return { error: "Login session storage is not configured.", status: 503 as const };
  }
  const auth = await getAuthenticatedUser();
  if (!auth.user) return { error: auth.error || "You must be signed in.", status: 401 as const };

  const { data: profile, error } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) {
    console.error("Login session profile lookup failed:", error.message);
    return { error: "Your account could not be verified.", status: 503 as const };
  }
  if (!profile || profile.status !== "active" || !["admin", "staff", "customer"].includes(profile.role)) {
    return { error: "Your account is currently unavailable.", status: 403 as const };
  }

  let body: { session_key?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return { error: "A valid session key is required.", status: 400 as const };
  }
  if (typeof body.session_key !== "string" || !SESSION_KEY_PATTERN.test(body.session_key)) {
    return { error: "A valid session key is required.", status: 400 as const };
  }

  return {
    admin,
    user: auth.user,
    profile: { role: profile.role, status: profile.status },
    sessionKey: body.session_key,
  };
}

export async function POST(request: NextRequest) {
  const context = await getSessionRequest(request);
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const { data: existing, error: lookupError } = await context.admin
    .from("login_sessions")
    .select("id, user_id, ended_at")
    .eq("session_key", context.sessionKey)
    .maybeSingle();
  if (lookupError) {
    console.error("Login session lookup failed:", lookupError.message);
    return NextResponse.json({ error: "Login session could not be updated." }, { status: 503 });
  }
  if (existing && existing.user_id !== context.user.id) {
    return NextResponse.json({ error: "This session key is not available." }, { status: 409 });
  }
  if (existing?.ended_at) {
    return NextResponse.json({ error: "This login session has ended." }, { status: 409 });
  }

  const userAgent = request.headers.get("user-agent") || "";
  const device = parseUserAgent(userAgent);
  const now = new Date().toISOString();
  const values = {
    user_id: context.user.id,
    session_key: context.sessionKey,
    role: context.profile.role,
    device_type: device.deviceType,
    browser: device.browser,
    operating_system: device.operatingSystem,
    ip_address: getRequestIp(request),
    last_seen: now,
  };

  if (existing) {
    const { error: updateError } = await context.admin
      .from("login_sessions")
      .update(values)
      .eq("id", existing.id)
      .eq("user_id", context.user.id)
      .is("ended_at", null);
    if (updateError) {
      console.error("Login session heartbeat write failed:", updateError.message);
      return NextResponse.json({ error: "Login session could not be updated." }, { status: 503 });
    }
  } else {
    const { error: insertError } = await context.admin.from("login_sessions").insert(values);
    if (insertError?.code === "23505") {
      const { data: racedSession, error: racedLookupError } = await context.admin
        .from("login_sessions")
        .select("id, user_id, ended_at")
        .eq("session_key", context.sessionKey)
        .maybeSingle();
      if (racedLookupError) {
        console.error("Login session race lookup failed:", racedLookupError.message);
        return NextResponse.json({ error: "Login session could not be updated." }, { status: 503 });
      }
      if (!racedSession || racedSession.user_id !== context.user.id || racedSession.ended_at) {
        return NextResponse.json({ error: "This login session is not available." }, { status: 409 });
      }

      const { error: retryError } = await context.admin
        .from("login_sessions")
        .update(values)
        .eq("id", racedSession.id)
        .eq("user_id", context.user.id)
        .is("ended_at", null);
      if (retryError) {
        console.error("Login session heartbeat retry failed:", retryError.message);
        return NextResponse.json({ error: "Login session could not be updated." }, { status: 503 });
      }
    } else if (insertError) {
      console.error("Login session heartbeat write failed:", insertError.message);
      return NextResponse.json({ error: "Login session could not be updated." }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true, last_seen: now });
}

export async function DELETE(request: NextRequest) {
  const context = await getSessionRequest(request);
  if ("error" in context) {
    if (context.status === 401) return NextResponse.json({ ok: true });
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  const { error } = await context.admin
    .from("login_sessions")
    .update({ ended_at: new Date().toISOString() })
    .eq("session_key", context.sessionKey)
    .eq("user_id", context.user.id)
    .is("ended_at", null);
  if (error) {
    console.error("Login session logout update failed:", error.message);
    return NextResponse.json({ error: "Login session could not be ended." }, { status: 503 });
  }
  return NextResponse.json({ ok: true });
}
