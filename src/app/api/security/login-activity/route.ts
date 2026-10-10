import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getAnalyticsAdminContext } from "@/lib/analytics-admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertLoginActivity } from "@/lib/login-activity-write";
import { parseUserAgent } from "@/lib/user-agent";

const PAGE_SIZE = 500;
const HISTORY_LIMIT = 500;
type Role = "admin" | "staff" | "customer" | "unknown";
type LoginRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  role?: Role | null;
  role_at_login?: Role | null;
  login_method?: "email" | "phone" | null;
  device_type: string | null;
  browser: string | null;
  login_status: "success" | "failed";
  created_at: string;
};

function getColomboDayStart(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  const dateKey = `${part("year")}-${part("month")}-${part("day")}`;
  return new Date(`${dateKey}T00:00:00+05:30`);
}

function maskEmail(email: string | null) {
  if (!email) return "Unknown user";
  const [local = "", domain = ""] = email.trim().split("@");
  if (!domain) return `${local.slice(0, 1)}***`;
  const [host = "", ...suffix] = domain.split(".");
  return `${local.slice(0, 1)}***@${host.slice(0, 1)}***.${suffix.join(".") || "hidden"}`;
}

function isKnownRole(value: string | null | undefined): value is Exclude<Role, "unknown"> {
  return value === "admin" || value === "staff" || value === "customer";
}

async function readLoginRows(admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>) {
  const rows: LoginRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("login_activity")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data || []) as LoginRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  const supportsRoleSnapshot = rows.length > 0 &&
    (Object.hasOwn(rows[0], "role_at_login") || Object.hasOwn(rows[0], "role"));
  if (!supportsRoleSnapshot && process.env.NODE_ENV !== "production") {
    console.warn("Login role snapshots are not installed.");
  }
  return { rows, supportsRoleSnapshot };
}

export async function GET() {
  try {
    const context = await getAnalyticsAdminContext();
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const { rows, supportsRoleSnapshot } = await readLoginRows(context.admin);
    const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => !!id))];
    const currentRoles = new Map<string, Role>();
    if (userIds.length) {
      for (let offset = 0; offset < userIds.length; offset += 500) {
        const { data, error } = await context.admin
          .from("profiles")
          .select("id, role")
          .in("id", userIds.slice(offset, offset + 500));
        if (error) throw error;
        for (const profile of data || []) {
          currentRoles.set(profile.id, isKnownRole(profile.role) ? profile.role : "unknown");
        }
      }
    }

    const resolvedRows = rows.map((row) => ({
      ...row,
      resolvedRole: isKnownRole(row.role_at_login)
        ? row.role_at_login
        : isKnownRole(row.role)
          ? row.role
          : row.user_id
            ? currentRoles.get(row.user_id) || "unknown"
            : "unknown",
    }));
    const successful = resolvedRows.filter((row) => row.login_status === "success");
    const failed = resolvedRows.filter((row) => row.login_status === "failed");
    const now = new Date();
    const todayStart = getColomboDayStart(now);
    const sevenDayStart = now.getTime() - 7 * 86400000;
    const thirtyDayStart = now.getTime() - 30 * 86400000;
    const successfulToday = successful.filter((row) => isWithinRange(
      row.created_at,
      todayStart.getTime(),
      now.getTime(),
    ));
    const failedToday = failed.filter((row) => isWithinRange(
      row.created_at,
      todayStart.getTime(),
      now.getTime(),
    ));
    const successfulSevenDays = successful.filter((row) =>
      isWithinRange(row.created_at, sevenDayStart, now.getTime()),
    );
    const successfulThirtyDays = successful.filter((row) =>
      isWithinRange(row.created_at, thirtyDayStart, now.getTime()),
    );
    const uniqueUsers = new Set(
      successful.map((row) => row.user_id || row.email?.trim().toLowerCase()).filter((key): key is string => !!key),
    );
    const lastSuccessfulLogin = successful[0]?.created_at || null;
    let activeSessions: number | null = null;
    let activeSessionsAvailable = true;
    const { count: activeCount, error: activeSessionsError } = await context.admin
      .from("login_sessions")
      .select("id", { count: "exact", head: true })
      .is("ended_at", null)
      .gte("last_seen", new Date(now.getTime() - 5 * 60 * 1000).toISOString());
    if (activeSessionsError) {
      activeSessionsAvailable = false;
      if (process.env.NODE_ENV !== "production") {
        console.warn("Active login session count is unavailable:", activeSessionsError.message);
      }
    } else {
      activeSessions = activeCount || 0;
    }

    return NextResponse.json({
      summary: {
        totalSuccessfulLogins: successful.length,
        totalFailedLoginAttempts: failed.length,
        loginsToday: successfulToday.length,
        failedAttemptsToday: failedToday.length,
        loginsLast7Days: successfulSevenDays.length,
        loginsLast30Days: successfulThirtyDays.length,
        uniqueLoggedInUsers: uniqueUsers.size,
        activeSessions,
        activeSessionsAvailable,
        customerLogins: successful.filter((row) => row.resolvedRole === "customer").length,
        staffLogins: successful.filter((row) => row.resolvedRole === "staff").length,
        adminLogins: successful.filter((row) => row.resolvedRole === "admin").length,
        lastSuccessfulLogin,
      },
      roleSource: supportsRoleSnapshot
        ? "Role is recorded at login; older entries without a role snapshot use the user's current profile role."
        : "Role is inferred from the user's current profile. Run the login session migration to capture role at login for new entries.",
      historyLimit: HISTORY_LIMIT,
      rows: resolvedRows.slice(0, HISTORY_LIMIT).map((row) => ({
        id: row.id,
        user: maskEmail(row.email),
        role: row.resolvedRole,
        loginMethod: row.login_method || null,
        deviceType: row.device_type || "Unknown",
        browser: row.browser || "Unknown",
        status: row.login_status,
        createdAt: row.created_at,
      })),
    });
  } catch (error) {
    console.error("Login analytics request failed:", error);
    return NextResponse.json(
      { error: "Login analytics could not be loaded. Please retry." },
      { status: 500 },
    );
  }
}

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

function isWithinRange(value: string, start: number, end: number) {
  const timestamp = new Date(value).getTime();
  return timestamp >= start && timestamp <= end;
}

async function getCurrentUser() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll() {} },
  });
  const { data: { user } } = await authClient.auth.getUser();
  return user || null;
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "Login activity storage is not configured." }, { status: 503 });

  let body: { email?: unknown; status?: unknown; loginMethod?: unknown };
  try {
    body = (await request.json()) as { email?: unknown; status?: unknown; loginMethod?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const status = body.status === "success" || body.status === "failed" ? body.status : null;
  const loginMethod = body.loginMethod === "phone"
    ? "phone"
    : body.loginMethod === "email" || !body.loginMethod
      ? "email"
      : null;
  const submittedEmail = typeof body.email === "string" ? body.email.trim().toLowerCase().slice(0, 320) : "";
  if (
    !status ||
    !loginMethod ||
    (submittedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submittedEmail)) ||
    (status === "success" && !submittedEmail)
  ) {
    return NextResponse.json({ error: "Invalid login activity." }, { status: 400 });
  }

  let userId: string | null = null;
  let role: Exclude<Role, "unknown"> | null = null;
  if (status === "success") {
    const user = await getCurrentUser();
    if (!user?.id || !user.email || user.email.toLowerCase() !== submittedEmail) {
      return NextResponse.json({ error: "A successful login must match the authenticated account." }, { status: 403 });
    }
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role, status")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Successful login profile validation failed:", profileError.message);
      return NextResponse.json({ error: "The account could not be verified." }, { status: 503 });
    }
    if (!profile || profile.status !== "active" || !isKnownRole(profile.role)) {
      return NextResponse.json({ error: "Only an active CK Motors account can be recorded." }, { status: 403 });
    }
    userId = user.id;
    role = profile.role;
  }

  const userAgent = request.headers.get("user-agent") || "";
  const parsed = parseUserAgent(userAgent);
  const error = await insertLoginActivity(admin, {
    user_id: userId,
    email: status === "success" ? submittedEmail : submittedEmail || null,
    role,
    role_at_login: role,
    login_method: loginMethod,
    ip_address: requestIp(request),
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
  if (error) {
    console.error("Login activity insert failed:", error.message);
    return NextResponse.json({ error: "Login activity could not be recorded." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
