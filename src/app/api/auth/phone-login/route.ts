import { NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertLoginActivity } from "@/lib/login-activity-write";
import { normalizeSriLankanPhone } from "@/lib/phone-number";
import { parseUserAgent } from "@/lib/user-agent";

const FAILURE_MESSAGE = "Invalid email/phone number or password.";
const UNAVAILABLE_MESSAGE = "Your account is currently unavailable. Please contact CK Motors.";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 8;
const PROFILE_PAGE_SIZE = 500;

type ProfileMatch = {
  id: string;
  phone: string | null;
  status: string | null;
  role: "admin" | "staff" | "customer" | null;
};

function getRequestIp(request: NextRequest) {
  return request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || null;
}

async function findProfilesByPhone(admin: SupabaseClient, normalizedPhone: string) {
  const matches: ProfileMatch[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("profiles")
      .select("id, phone, status, role")
      .not("phone", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PROFILE_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data || []) as ProfileMatch[];
    for (const profile of page) {
      if (profile.phone && normalizeSriLankanPhone(profile.phone) === normalizedPhone) {
        matches.push(profile);
      }
    }

    if (page.length < PROFILE_PAGE_SIZE) break;
    offset += PROFILE_PAGE_SIZE;
  }

  return matches;
}

async function isRateLimited(admin: SupabaseClient, ipAddress: string | null) {
  if (!ipAddress) return false;
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error } = await admin
    .from("login_activity")
    .select("id", { count: "exact", head: true })
    .eq("ip_address", ipAddress)
    .eq("login_status", "failed")
    .gte("created_at", since);
  if (error) {
    console.error("Phone login rate-limit lookup failed:", error.message);
    throw error;
  }
  return (count || 0) >= MAX_FAILED_ATTEMPTS;
}

async function recordAttempt(
  admin: SupabaseClient,
  request: NextRequest,
  status: "success" | "failed",
  account?: { id: string; email: string; role: "admin" | "staff" | "customer" },
) {
  const userAgent = request.headers.get("user-agent") || "";
  const parsed = parseUserAgent(userAgent);
  const error = await insertLoginActivity(admin, {
    user_id: account?.id || null,
    email: account?.email || null,
    role: account?.role || null,
    role_at_login: account?.role || null,
    login_method: "phone",
    ip_address: getRequestIp(request),
    user_agent: userAgent.slice(0, 2048) || null,
    device_type: parsed.deviceType,
    browser: parsed.browser,
    operating_system: parsed.operatingSystem,
    country: request.headers.get("x-vercel-ip-country"),
    region: request.headers.get("x-vercel-ip-country-region"),
    city: request.headers.get("x-vercel-ip-city"),
    session_id: null,
    login_status: status,
  });
  if (error) console.error("Phone login activity insert failed:", error.message);
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!admin || !url || !anonKey) {
    return NextResponse.json({ error: "Unable to sign in right now. Please try again." }, { status: 503 });
  }

  let body: { phone?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: FAILURE_MESSAGE }, { status: 400 });
  }
  if (
    typeof body.phone !== "string" ||
    typeof body.password !== "string" ||
    !body.password ||
    body.phone.length > 64 ||
    body.password.length > 1024
  ) {
    return NextResponse.json({ error: FAILURE_MESSAGE }, { status: 400 });
  }

  const normalizedPhone = normalizeSriLankanPhone(body.phone);
  if (!normalizedPhone) {
    return NextResponse.json({ error: FAILURE_MESSAGE }, { status: 401 });
  }

  const ipAddress = getRequestIp(request);
  try {
    if (await isRateLimited(admin, ipAddress)) {
      return NextResponse.json(
        { error: FAILURE_MESSAGE },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    }

    const profiles = await findProfilesByPhone(admin, normalizedPhone);
    if (profiles.length !== 1) {
      if (profiles.length > 1) {
        console.error("Phone login blocked because multiple profiles share the same normalized phone number.");
      }
      await recordAttempt(admin, request, "failed");
      return NextResponse.json({ error: FAILURE_MESSAGE }, { status: 401 });
    }

    const profile = profiles[0];
    const { data: authUserResult, error: authUserError } = await admin.auth.admin.getUserById(profile.id);
    const authEmail = authUserResult.user?.email?.trim().toLowerCase();
    if (authUserError || !authEmail) {
      if (authUserError) console.error("Phone login could not resolve an existing Auth identity:", authUserError.message);
      await recordAttempt(admin, request, "failed");
      return NextResponse.json({ error: FAILURE_MESSAGE }, { status: 401 });
    }

    const sessionCookies: {
      name: string;
      value: string;
      options: CookieOptions;
    }[] = [];
    const sessionHeaders: Record<string, string> = {};
    const authClient = createServerClient(url, anonKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          for (const { name, value, options } of cookiesToSet) {
            sessionCookies.push({ name, value, options });
          }
          Object.assign(sessionHeaders, headers);
        },
      },
    });

    const { data, error: signInError } = await authClient.auth.signInWithPassword({
      email: authEmail,
      password: body.password,
    });
    if (
      signInError ||
      data.user?.id !== profile.id ||
      !data.user.email ||
      !data.session?.access_token ||
      !data.session.refresh_token
    ) {
      await recordAttempt(admin, request, "failed");
      return NextResponse.json({ error: FAILURE_MESSAGE }, { status: 401 });
    }

    if (profile.status !== "active" || !profile.role) {
      await recordAttempt(admin, request, "failed");
      return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 403 });
    }

    await recordAttempt(admin, request, "success", {
      id: data.user.id,
      email: data.user.email.toLowerCase(),
      role: profile.role,
    });
    const response = NextResponse.json({
      ok: true,
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
    });
    for (const cookie of sessionCookies) {
      response.cookies.set(cookie.name, cookie.value, cookie.options);
    }
    for (const [name, value] of Object.entries(sessionHeaders)) {
      response.headers.set(name, value);
    }
    return response;
  } catch (error) {
    console.error("Phone login request failed:", error);
    return NextResponse.json(
      { error: "Unable to sign in right now. Please try again." },
      { status: 503 },
    );
  }
}
