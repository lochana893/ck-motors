import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalyticsAdminContext } from "@/lib/analytics-admin-auth";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseUserAgent } from "@/lib/user-agent";

const blockedPrefixes = ["/admin", "/dashboard", "/api", "/complete-account"];
const contactEventTypes = new Set([
  "service_price_opened",
  "service_phone_clicked",
  "service_whatsapp_clicked",
  "service_book_clicked",
  "service_directions_clicked",
  "service_shared",
  "callback_requested",
]);
const EVENT_PAGE_SIZE = 500;

type AnalyticsEvent = {
  id: string;
  event_type: string;
  page_path: string;
  visitor_id: string | null;
  session_id: string | null;
  referrer: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system?: string | null;
  country: string | null;
  region?: string | null;
  city?: string | null;
  user_id?: string | null;
  visitor_type?: "guest" | "logged_in" | null;
  created_at: string;
};

function requestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || null;
}

function getColomboDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function getColomboDayStart(date: Date) {
  return new Date(`${getColomboDateKey(date)}T00:00:00+05:30`);
}

function getVisitorType(event: AnalyticsEvent): "guest" | "logged_in" | "unknown" {
  if (event.visitor_type === "guest" || event.visitor_type === "logged_in") return event.visitor_type;
  if (event.user_id) return "logged_in";
  return "unknown";
}

function friendlyReferrer(referrer: string | null) {
  if (!referrer) return "Direct";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "Direct";
  }
}

async function getAuthenticatedUser() {
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

async function readAnalyticsEvents(admin: SupabaseClient) {
  const events: AnalyticsEvent[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await admin
      .from("site_analytics_events")
      .select("*")
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + EVENT_PAGE_SIZE - 1);

    if (error) throw error;

    const page = (data || []) as AnalyticsEvent[];
    events.push(...page);
    if (page.length < EVENT_PAGE_SIZE) break;
    offset += EVENT_PAGE_SIZE;
  }

  return {
    events,
    supportsIdentityDetails: events.length === 0 || Object.hasOwn(events[0], "visitor_type"),
  };
}

export async function GET() {
  try {
    const context = await getAnalyticsAdminContext();
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }

    const { events, supportsIdentityDetails } = await readAnalyticsEvents(context.admin);
    const pageViews = events.filter((event) => event.event_type === "page_view");
    const now = new Date();
    const todayStart = getColomboDayStart(now);
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const todayViews = pageViews.filter((event) => {
      const createdAt = new Date(event.created_at);
      return createdAt >= todayStart && createdAt < tomorrowStart;
    });
    const firstSeenByVisitor = new Map<string, number>();
    const identityByVisitor = new Map<string, "guest" | "logged_in" | "unknown">();

    for (const event of pageViews) {
      if (!event.visitor_id) continue;
      const timestamp = new Date(event.created_at).getTime();
      const firstSeen = firstSeenByVisitor.get(event.visitor_id);
      if (firstSeen === undefined || timestamp < firstSeen) {
        firstSeenByVisitor.set(event.visitor_id, timestamp);
      }
      const eventType = getVisitorType(event);
      const priorType = identityByVisitor.get(event.visitor_id);
      if (
        eventType === "logged_in" ||
        (eventType === "guest" && priorType !== "logged_in")
      ) {
        identityByVisitor.set(event.visitor_id, eventType);
      } else if (!priorType) {
        identityByVisitor.set(event.visitor_id, "unknown");
      }
    }

    const visitorIdsToday = new Set(todayViews.map((event) => event.visitor_id).filter((id): id is string => !!id));
    const newVisitorsToday = [...visitorIdsToday].filter((visitorId) => {
      const firstSeen = firstSeenByVisitor.get(visitorId);
      return firstSeen !== undefined && firstSeen >= todayStart.getTime() && firstSeen < tomorrowStart.getTime();
    });
    const knownLoggedInVisitors = new Set(
      [...identityByVisitor].filter(([, type]) => type === "logged_in").map(([visitorId]) => visitorId),
    );
    const knownGuestVisitors = new Set(
      [...identityByVisitor].filter(([, type]) => type === "guest").map(([visitorId]) => visitorId),
    );
    const sessionEvents = new Map<string, AnalyticsEvent[]>();
    for (const event of pageViews) {
      if (!event.session_id) continue;
      const group = sessionEvents.get(event.session_id) || [];
      group.push(event);
      sessionEvents.set(event.session_id, group);
    }

    const sessions = [...sessionEvents.values()]
      .map((rows, index) => {
        const ordered = rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
        const first = ordered[0];
        const last = ordered[ordered.length - 1];
        const visitorId = last.visitor_id || first.visitor_id;
        const visitorType = getVisitorType(last);
        return {
          id: `session-${index + 1}`,
          visitorLabel: `Visitor ${index + 1}`,
          visitorType: visitorId ? identityByVisitor.get(visitorId) || visitorType : "unknown",
          deviceType: last.device_type || "Unknown",
          browser: last.browser || "Unknown",
          operatingSystem: last.operating_system || "Unknown",
          country: last.country,
          region: last.region || null,
          city: last.city || null,
          landingPage: first.page_path,
          lastPage: last.page_path,
          pageViews: rows.length,
          firstSeen: first.created_at,
          lastSeen: last.created_at,
          pages: ordered.map((event) => ({ pagePath: event.page_path, createdAt: event.created_at })),
        };
      })
      .sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));

    let publicCounterEnabled = false;
    let settingsAvailable = true;
    const { data: settings, error: settingsError } = await context.admin
      .from("analytics_settings")
      .select("show_public_visit_count")
      .eq("id", true)
      .maybeSingle();
    if (settingsError) {
      settingsAvailable = false;
      if (process.env.NODE_ENV !== "production") {
        console.warn("Analytics counter settings are unavailable:", settingsError.message);
      }
    } else {
      publicCounterEnabled = Boolean(settings?.show_public_visit_count);
    }

    const activeSessions = sessions.filter(
      (session) => {
        const lastSeen = new Date(session.lastSeen).getTime();
        return lastSeen <= now.getTime() && now.getTime() - lastSeen <= 30 * 60 * 1000;
      },
    );
    return NextResponse.json({
      metrics: {
        totalPageViews: pageViews.length,
        uniqueVisitors: firstSeenByVisitor.size,
        visitorsToday: visitorIdsToday.size,
        newVisitorsToday: newVisitorsToday.length,
        returningVisitorsToday: visitorIdsToday.size - newVisitorsToday.length,
        activeSessions: activeSessions.length,
        loggedInVisitors: knownLoggedInVisitors.size,
        guestVisitors: knownGuestVisitors.size,
        viewsLast7Days: pageViews.filter((event) => isWithinPast(event.created_at, now, 7 * 86400000)).length,
        viewsLast30Days: pageViews.filter((event) => isWithinPast(event.created_at, now, 30 * 86400000)).length,
      },
      coverage: {
        visitorIdentityClassificationAvailable: supportsIdentityDetails,
        counterSettingsAvailable: settingsAvailable,
      },
      publicCounterEnabled,
      sessions,
      pageBreakdown: summarize(pageViews.map((event) => event.page_path)),
      referrerBreakdown: summarize(pageViews.map((event) => friendlyReferrer(event.referrer))),
      countryBreakdown: summarize(pageViews.map((event) => event.country || "Unknown")),
      deviceBreakdown: summarize(pageViews.map((event) => event.device_type || "Unknown")),
      browserBreakdown: summarize(pageViews.map((event) => event.browser || "Unknown")),
      operatingSystemBreakdown: summarize(pageViews.map((event) => event.operating_system || "Unknown")),
    });
  } catch (error) {
    console.error("Visitor analytics request failed:", error);
    return NextResponse.json(
      { error: "Visitor analytics could not be loaded. Please retry." },
      { status: 500 },
    );
  }
}

function summarize(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
}

function isWithinPast(value: string, now: Date, duration: number) {
  const timestamp = new Date(value).getTime();
  return timestamp <= now.getTime() && now.getTime() - timestamp <= duration;
}

export async function PATCH(request: NextRequest) {
  const context = await getAnalyticsAdminContext();
  if ("error" in context) {
    return NextResponse.json({ error: context.error }, { status: context.status });
  }

  let body: { publicCounterEnabled?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid counter setting." }, { status: 400 });
  }
  if (typeof body.publicCounterEnabled !== "boolean") {
    return NextResponse.json({ error: "A public counter setting is required." }, { status: 400 });
  }

  const { error } = await context.admin
    .from("analytics_settings")
    .update({ show_public_visit_count: body.publicCounterEnabled, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) {
    console.error("Visitor analytics counter update failed:", error.message);
    return NextResponse.json(
      { error: "Counter settings are unavailable. Apply the visitor analytics migration and retry." },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, publicCounterEnabled: body.publicCounterEnabled });
}

export async function POST(request: NextRequest) {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ ok: false }, { status: 503 });

  let body: {
    pagePath?: unknown;
    visitorId?: unknown;
    sessionId?: unknown;
    referrer?: unknown;
    eventType?: unknown;
    serviceId?: unknown;
    serviceName?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const pagePath = typeof body.pagePath === "string" ? body.pagePath : "";
  const visitorId = typeof body.visitorId === "string" ? body.visitorId : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : "";
  const eventType = typeof body.eventType === "string" && body.eventType.trim()
    ? body.eventType.trim().slice(0, 64)
    : "page_view";
  const serviceId = typeof body.serviceId === "string" && body.serviceId.length <= 64 ? body.serviceId : null;
  const serviceName = typeof body.serviceName === "string" ? body.serviceName.slice(0, 200) : null;
  if (
    !pagePath.startsWith("/") ||
    pagePath.length > 512 ||
    !visitorId ||
    visitorId.length > 128 ||
    (eventType !== "page_view" && !contactEventTypes.has(eventType))
  ) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (blockedPrefixes.some((prefix) => pagePath === prefix || pagePath.startsWith(`${prefix}/`))) {
    return NextResponse.json({ ok: true });
  }

  try {
    const parsed = parseUserAgent(request.headers.get("user-agent") || "");
    const referrer = typeof body.referrer === "string" ? body.referrer.slice(0, 512) : null;
    const user = await getAuthenticatedUser();
    const profileResult = user
      ? await admin.from("profiles").select("role, status").eq("id", user.id).maybeSingle()
      : { data: null, error: null };
    if (profileResult.error) {
      console.error("Analytics visitor role lookup failed:", profileResult.error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    if (user && (!profileResult.data || profileResult.data.status !== "active")) {
      return NextResponse.json({ ok: true, skipped: true });
    }
    if (profileResult.data?.role === "admin" || profileResult.data?.role === "staff") {
      return NextResponse.json({ ok: true, skipped: true });
    }
    if (user && profileResult.data?.role !== "customer") {
      return NextResponse.json({ ok: true, skipped: true });
    }
    const userId = user?.id || null;
    const visitorType = userId ? "logged_in" : "guest";
    const event = {
      event_type: eventType,
      page_path: pagePath,
      visitor_id: visitorId,
      session_id: sessionId || null,
      referrer,
      device_type: parsed.deviceType,
      browser: parsed.browser,
      operating_system: parsed.operatingSystem,
      country: request.headers.get("x-vercel-ip-country"),
      region: request.headers.get("x-vercel-ip-country-region"),
      city: request.headers.get("x-vercel-ip-city"),
      ip_address: requestIp(request),
      user_id: userId,
      visitor_type: visitorType,
      service_id: serviceId,
      service_name: serviceName,
    };

    let { error } = await admin.from("site_analytics_events").insert(event);
    if (error?.code === "42703") {
      if (process.env.NODE_ENV !== "production") {
        console.warn("Analytics detail fields are not installed; retrying with the existing schema:", error.message);
      }
      ({ error } = await admin.from("site_analytics_events").insert({
        event_type: event.event_type,
        page_path: event.page_path,
        visitor_id: event.visitor_id,
        session_id: event.session_id,
        referrer: event.referrer,
        device_type: event.device_type,
        browser: event.browser,
        country: event.country,
        service_id: event.service_id,
        service_name: event.service_name,
      }));
    }
    if (error) {
      console.error("Analytics event insert failed:", error.message);
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    if (sessionId && eventType === "page_view") {
      const now = new Date().toISOString();
      const { data: existing, error: sessionReadError } = await admin
        .from("visitor_sessions")
        .select("id, page_views, user_id")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (sessionReadError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("Visitor session aggregation is unavailable:", sessionReadError.message);
        }
      } else if (existing) {
        const { error: updateError } = await admin
          .from("visitor_sessions")
          .update({
            last_seen: now,
            last_page: pagePath,
            page_views: (existing.page_views || 0) + 1,
            user_id: existing.user_id || userId,
          })
          .eq("id", existing.id);
        if (updateError && process.env.NODE_ENV !== "production") {
          console.warn("Visitor session update failed:", updateError.message);
        }
      } else {
        const { error: sessionInsertError } = await admin.from("visitor_sessions").insert({
          visitor_id: visitorId,
          session_id: sessionId,
          user_id: userId,
          ip_address: requestIp(request),
          device_type: parsed.deviceType,
          browser: parsed.browser,
          operating_system: parsed.operatingSystem,
          country: request.headers.get("x-vercel-ip-country"),
          region: request.headers.get("x-vercel-ip-country-region"),
          city: request.headers.get("x-vercel-ip-city"),
          referrer,
          landing_page: pagePath,
          last_page: pagePath,
          page_views: 1,
          first_seen: now,
          last_seen: now,
        });
        if (sessionInsertError && process.env.NODE_ENV !== "production") {
          console.warn("Visitor session insert failed:", sessionInsertError.message);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Analytics tracking request failed:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
