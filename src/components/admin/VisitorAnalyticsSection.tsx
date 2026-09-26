"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type VisitorSession = {
  id: string;
  visitor_id: string;
  session_id: string;
  user_id: string | null;
  ip_address: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  referrer: string | null;
  landing_page: string | null;
  last_page: string | null;
  page_views: number;
  first_seen: string;
  last_seen: string;
};

type PageEvent = {
  page_path: string;
  created_at: string;
};

type ProfileInfo = { full_name: string; email: string };

const ACTIVE_WINDOW_MS = 5 * 60 * 1000;
const AGGREGATE_LIMIT = 2000;
const PAGE_SIZE = 50;

function rangeStart(range: string, now: number): Date | null {
  const reference = new Date(now);
  if (range === "today") {
    const start = new Date(reference);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "yesterday") {
    const start = new Date(reference);
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  if (range === "7") {
    return new Date(now - 7 * 86400000);
  }
  if (range === "30") {
    return new Date(now - 30 * 86400000);
  }
  return null;
}

function rangeEnd(range: string, now: number): Date | null {
  if (range === "yesterday") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return start;
  }
  return null;
}

function friendlyReferrer(referrer: string | null) {
  if (!referrer) return "Direct";
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, "");
    if (host.includes("google")) return "Google";
    if (host.includes("facebook")) return "Facebook";
    if (host.includes("instagram")) return "Instagram";
    if (host.includes("whatsapp")) return "WhatsApp";
    if (host.includes("tiktok")) return "TikTok";
    return host;
  } catch {
    return "Direct";
  }
}

function locationLabel(session: Pick<VisitorSession, "country" | "region" | "city">) {
  const parts = [session.city, session.region, session.country].filter(Boolean);
  return parts.length > 0 ? parts.join(" / ") : "Unavailable";
}

function formatDuration(startIso: string, endIso: string) {
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

export default function VisitorAnalyticsSection() {
  const supabase = useMemo(() => createClient(), []);

  const [aggregateSessions, setAggregateSessions] = useState<VisitorSession[]>([]);
  const [totalViews, setTotalViews] = useState<number | null>(null);
  const [views7, setViews7] = useState<number | null>(null);
  const [views30, setViews30] = useState<number | null>(null);
  const [profiles, setProfiles] = useState<Record<string, ProfileInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [range, setRange] = useState("7");
  const [visitorType, setVisitorType] = useState("all");
  const [device, setDevice] = useState("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [selectedSession, setSelectedSession] = useState<VisitorSession | null>(null);
  const [sessionEvents, setSessionEvents] = useState<PageEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);

  const [publicCounterEnabled, setPublicCounterEnabled] = useState(false);
  const [savingCounterSetting, setSavingCounterSetting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");

      const [sessionResult, totalResult, sevenResult, thirtyResult, settingsResult] = await Promise.all([
        supabase
          .from("visitor_sessions")
          .select(
            "id,visitor_id,session_id,user_id,ip_address,device_type,browser,operating_system,country,region,city,referrer,landing_page,last_page,page_views,first_seen,last_seen"
          )
          .order("last_seen", { ascending: false })
          .range(0, AGGREGATE_LIMIT - 1),
        supabase.from("site_analytics_events").select("id", { count: "exact", head: true }).eq("event_type", "page_view"),
        supabase
          .from("site_analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "page_view")
          .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase
          .from("site_analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("event_type", "page_view")
          .gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString()),
        supabase.from("analytics_settings").select("show_public_visit_count").eq("id", true).maybeSingle(),
      ]);

      if (!active) return;

      if (sessionResult.error) {
        setError(sessionResult.error.message);
        setAggregateSessions([]);
      } else {
        const rows = (sessionResult.data || []) as VisitorSession[];
        setAggregateSessions(rows);

        const userIds = [...new Set(rows.map((row) => row.user_id).filter((id): id is string => !!id))];
        if (userIds.length > 0) {
          const { data: profileRows } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
          if (active && profileRows) {
            setProfiles(
              Object.fromEntries(
                profileRows.map((row) => [row.id as string, { full_name: row.full_name as string, email: row.email as string }])
              )
            );
          }
        }
      }

      setTotalViews(totalResult.count ?? null);
      setViews7(sevenResult.count ?? null);
      setViews30(thirtyResult.count ?? null);
      setPublicCounterEnabled(Boolean(settingsResult.data?.show_public_visit_count));
      setNow(Date.now());
      setLoading(false);
    }
    void load();
    const interval = window.setInterval(load, 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [supabase]);

  async function togglePublicCounter() {
    setSavingCounterSetting(true);
    const nextValue = !publicCounterEnabled;
    const { error: updateError } = await supabase
      .from("analytics_settings")
      .update({ show_public_visit_count: nextValue, updated_at: new Date().toISOString() })
      .eq("id", true);
    if (!updateError) setPublicCounterEnabled(nextValue);
    setSavingCounterSetting(false);
  }

  async function openSessionDetails(session: VisitorSession) {
    setSelectedSession(session);
    setEventsLoading(true);
    const { data } = await supabase
      .from("site_analytics_events")
      .select("page_path, created_at")
      .eq("session_id", session.session_id)
      .order("created_at", { ascending: true })
      .range(0, 199);
    setSessionEvents((data || []) as PageEvent[]);
    setEventsLoading(false);
  }

  const todayStart = useMemo(() => {
    const value = new Date(now);
    value.setHours(0, 0, 0, 0);
    return value;
  }, [now]);

  // Earliest session per visitor, used to approximate new-vs-returning within the loaded window.
  const firstSessionByVisitor = useMemo(() => {
    const map = new Map<string, VisitorSession>();
    for (const session of aggregateSessions) {
      const existing = map.get(session.visitor_id);
      if (!existing || new Date(session.first_seen) < new Date(existing.first_seen)) {
        map.set(session.visitor_id, session);
      }
    }
    return map;
  }, [aggregateSessions]);

  // Total distinct sessions recorded per visitor, used for the "Total Visits" detail.
  const totalVisitsByVisitor = useMemo(() => {
    const map = new Map<string, number>();
    for (const session of aggregateSessions) {
      map.set(session.visitor_id, (map.get(session.visitor_id) || 0) + 1);
    }
    return map;
  }, [aggregateSessions]);

  const todaySessions = aggregateSessions.filter((session) => new Date(session.last_seen) >= todayStart);
  const activeSessions = aggregateSessions.filter((session) => now - new Date(session.last_seen).getTime() <= ACTIVE_WINDOW_MS);
  const uniqueVisitorsToday = new Set(todaySessions.map((session) => session.visitor_id));
  const newVisitorsToday = [...uniqueVisitorsToday].filter((visitorId) => {
    const first = firstSessionByVisitor.get(visitorId);
    return first && new Date(first.first_seen) >= todayStart;
  });
  const returningVisitorsToday = uniqueVisitorsToday.size - newVisitorsToday.length;
  const uniqueVisitorsAll = new Set(aggregateSessions.map((session) => session.visitor_id));
  const loggedInVisitorIds = new Set(aggregateSessions.filter((session) => session.user_id).map((session) => session.visitor_id));
  const guestVisitorCount = uniqueVisitorsAll.size - loggedInVisitorIds.size;

  const startDate = rangeStart(range, now);
  const endDate = rangeEnd(range, now);
  const filteredSessions = aggregateSessions.filter((session) => {
    const lastSeen = new Date(session.last_seen);
    if (startDate && lastSeen < startDate) return false;
    if (endDate && lastSeen >= endDate) return false;
    if (visitorType === "guest" && session.user_id) return false;
    if (visitorType === "logged_in" && !session.user_id) return false;
    if (device !== "all" && (session.device_type || "").toLowerCase() !== device.toLowerCase()) return false;
    if (search.trim()) {
      const query = search.trim().toLowerCase();
      const profile = session.user_id ? profiles[session.user_id] : null;
      const haystack = [
        session.visitor_id,
        session.ip_address,
        profile?.email,
        profile?.full_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const visibleSessions = filteredSessions.slice(0, visibleCount);

  const topPages = topList(aggregateSessions.map((session) => session.last_page || session.landing_page).filter((value): value is string => !!value));
  const topReferrers = topList(aggregateSessions.map((session) => friendlyReferrer(session.referrer)));
  const topCountries = topList(aggregateSessions.map((session) => session.country).filter((value): value is string => !!value));
  const deviceBreakdown = topList(aggregateSessions.map((session) => session.device_type || "Unknown"));
  const browserBreakdown = topList(aggregateSessions.map((session) => session.browser || "Unknown"));
  const osBreakdown = topList(aggregateSessions.map((session) => session.operating_system || "Unknown"));

  function topList(values: string[]) {
    const counts = new Map<string, number>();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }

  const cards: [string, number | string][] = [
    ["Total Page Views", totalViews ?? "—"],
    ["Unique Visitors", uniqueVisitorsAll.size],
    ["Visitors Today", uniqueVisitorsToday.size],
    ["New Visitors Today", newVisitorsToday.length],
    ["Returning Visitors Today", Math.max(returningVisitorsToday, 0)],
    ["Active Sessions", activeSessions.length],
    ["Logged-in Visitors", loggedInVisitorIds.size],
    ["Guest Visitors", Math.max(guestVisitorCount, 0)],
    ["Views Last 7 Days", views7 ?? "—"],
    ["Views Last 30 Days", views30 ?? "—"],
  ];

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">Visitor Analytics</p>
        <h2 className="mt-1 text-2xl font-black">Website Visitors</h2>
        <p className="mt-2 text-xs text-gray-500">
          Anonymous visitor/session data is admin-only. Locations are approximate and never claim to identify a person.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">
          Analytics data is temporarily unavailable.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#111] p-4">
        <div>
          <p className="text-sm font-bold">Public Visit Counter</p>
          <p className="mt-1 text-xs text-gray-500">Shows a real visit count in the public site footer. Disabled by default.</p>
        </div>
        <button
          type="button"
          onClick={() => void togglePublicCounter()}
          disabled={savingCounterSetting}
          className={`cursor-pointer rounded-full px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
            publicCounterEnabled ? "bg-emerald-600 text-white" : "bg-white/10 text-gray-300"
          }`}
        >
          {publicCounterEnabled ? "ON" : "OFF"}
        </button>
      </div>

      {loading ? (
        <p className="rounded-2xl border border-white/10 bg-[#111] p-8 text-sm text-gray-500">Loading visitor analytics...</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-[#111] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>

          {activeSessions.length > 0 && (
            <div className="rounded-2xl border border-emerald-900/50 bg-emerald-950/10 p-5">
              <p className="text-sm font-bold text-emerald-400">Active Now: {activeSessions.length}</p>
              <div className="mt-3 space-y-2">
                {activeSessions.slice(0, 6).map((session) => (
                  <div key={session.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-black/20 px-3 py-2 text-xs">
                    <span className="font-semibold">
                      {session.user_id ? profiles[session.user_id]?.full_name || "Logged-in visitor" : "Guest Visitor"}
                    </span>
                    <span className="text-gray-500">{session.last_page || session.landing_page || "/"}</span>
                    <span className="text-gray-500">{session.device_type || "Unknown"}</span>
                    <span className="text-gray-500">{locationLabel(session)}</span>
                    <span className="text-gray-600">{new Date(session.last_seen).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <select value={range} onChange={(event) => { setRange(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="all">All time</option>
            </select>
            <select value={visitorType} onChange={(event) => { setVisitorType(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="all">All visitors</option>
              <option value="guest">Guest</option>
              <option value="logged_in">Logged In</option>
            </select>
            <select value={device} onChange={(event) => { setDevice(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="all">All devices</option>
              <option value="Desktop">Desktop</option>
              <option value="Mobile">Mobile</option>
              <option value="Tablet">Tablet</option>
            </select>
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }}
              placeholder="Search visitor ID, IP or email..."
              className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111]">
            {visibleSessions.length === 0 ? (
              <p className="p-8 text-sm text-gray-500">No visitors match these filters.</p>
            ) : (
              <table className="w-full min-w-[1100px] text-left text-xs">
                <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="p-4">Visitor</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4">Device</th>
                    <th className="p-4">Browser</th>
                    <th className="p-4">OS</th>
                    <th className="p-4">Location</th>
                    <th className="p-4">Landing Page</th>
                    <th className="p-4">Page Views</th>
                    <th className="p-4">First Seen</th>
                    <th className="p-4">Last Seen</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSessions.map((session) => {
                    const isNew = firstSessionByVisitor.get(session.visitor_id)?.session_id === session.session_id;
                    const isOnline = now - new Date(session.last_seen).getTime() <= ACTIVE_WINDOW_MS;
                    return (
                      <tr
                        key={session.id}
                        onClick={() => void openSessionDetails(session)}
                        className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04]"
                      >
                        <td className="p-4 font-semibold">
                          <span className="flex items-center gap-2">
                            {isOnline && (
                              <span className="h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400" title="Online now" />
                            )}
                            {session.user_id ? profiles[session.user_id]?.full_name || "Logged-in visitor" : "Guest Visitor"}
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="flex flex-wrap gap-1">
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${isNew ? "bg-blue-950/50 text-blue-400" : "bg-white/10 text-gray-300"}`}>
                              {isNew ? "NEW" : "RETURNING"}
                            </span>
                            {isOnline && (
                              <span className="rounded-full bg-emerald-950/50 px-2 py-1 text-[10px] font-bold text-emerald-400">ONLINE</span>
                            )}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-gray-400">{session.ip_address || "Unavailable"}</td>
                        <td className="p-4">{session.device_type || "Unknown"}</td>
                        <td className="p-4">{session.browser || "Unknown"}</td>
                        <td className="p-4">{session.operating_system || "Unknown"}</td>
                        <td className="p-4 text-gray-400">{locationLabel(session)}</td>
                        <td className="p-4 text-gray-400">{session.landing_page || "/"}</td>
                        <td className="p-4">{session.page_views}</td>
                        <td className="p-4 text-gray-500">{new Date(session.first_seen).toLocaleString()}</td>
                        <td className="p-4 text-gray-500">{new Date(session.last_seen).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {filteredSessions.length > visibleSessions.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
              className="w-full cursor-pointer rounded-xl border border-white/10 bg-[#111] py-3 text-xs font-bold text-gray-300 hover:bg-white/[0.04]"
            >
              Load more visitors
            </button>
          )}

          <div className="grid gap-5 lg:grid-cols-3">
            <BreakdownCard title="Top Pages" data={topPages} />
            <BreakdownCard title="Top Referrers" data={topReferrers} />
            <BreakdownCard title="Top Countries" data={topCountries} />
            <BreakdownCard title="Device Breakdown" data={deviceBreakdown} />
            <BreakdownCard title="Browser Breakdown" data={browserBreakdown} />
            <BreakdownCard title="Operating System" data={osBreakdown} />
          </div>
        </>
      )}

      {selectedSession && (
        <div className="fixed inset-0 z-[120] flex items-stretch justify-end bg-black/70 p-0 sm:items-center sm:justify-center sm:p-4">
          <div className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#111] p-6 shadow-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl sm:border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Visitor Details</p>
                <h3 className="mt-1 text-lg font-black">
                  {selectedSession.user_id ? profiles[selectedSession.user_id]?.full_name || "Logged-in visitor" : "Guest Visitor"}
                </h3>
              </div>
              <button type="button" onClick={() => setSelectedSession(null)} className="cursor-pointer rounded-lg p-2 text-gray-500 hover:text-red-500">
                Close
              </button>
            </div>

            <dl className="mt-5 space-y-3 text-xs">
              <Detail label="Visitor ID" value={selectedSession.visitor_id} mono />
              {selectedSession.user_id && (
                <Detail label="Email" value={profiles[selectedSession.user_id]?.email || "Unavailable"} />
              )}
              <Detail label="IP Address" value={selectedSession.ip_address || "Unavailable"} mono />
              <Detail label="Approximate Location" value={locationLabel(selectedSession)} />
              <Detail label="Device" value={selectedSession.device_type || "Unknown"} />
              <Detail label="Browser" value={selectedSession.browser || "Unknown"} />
              <Detail label="Operating System" value={selectedSession.operating_system || "Unknown"} />
              <Detail label="Referrer" value={friendlyReferrer(selectedSession.referrer)} />
              <Detail label="First Visit" value={new Date(selectedSession.first_seen).toLocaleString()} />
              <Detail label="Last Activity" value={new Date(selectedSession.last_seen).toLocaleString()} />
              <Detail label="Session Duration" value={formatDuration(selectedSession.first_seen, selectedSession.last_seen)} />
              <Detail label="Total Page Views" value={String(selectedSession.page_views)} />
              <Detail label="Total Visits" value={String(totalVisitsByVisitor.get(selectedSession.visitor_id) || 1)} />
            </dl>

            <div className="mt-6">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Pages Visited</p>
              {eventsLoading ? (
                <p className="mt-2 text-xs text-gray-500">Loading pages...</p>
              ) : sessionEvents.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">No page views recorded for this session.</p>
              ) : (
                <div className="mt-2 space-y-1 text-xs text-gray-400">
                  {sessionEvents.map((event, index) => (
                    <p key={`${event.page_path}-${index}`}>
                      {new Date(event.created_at).toLocaleTimeString()} - {event.page_path}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/5 pb-2">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono" : "font-semibold"}`}>{value}</dd>
    </div>
  );
}

function BreakdownCard({ title, data }: { title: string; data: [string, number][] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <h3 className="font-bold">{title}</h3>
      {data.length === 0 ? (
        <p className="mt-3 text-xs text-gray-500">No data yet.</p>
      ) : (
        data.map(([label, count]) => (
          <div key={label} className="mt-3 flex justify-between text-sm">
            <span className="truncate text-gray-400">{label}</span>
            <b>{count}</b>
          </div>
        ))
      )}
    </div>
  );
}
