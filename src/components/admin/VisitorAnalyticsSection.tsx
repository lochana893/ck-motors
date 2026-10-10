"use client";

import { useEffect, useMemo, useState } from "react";
import LoginActivitySection from "@/components/admin/LoginActivitySection";

type VisitorMetrics = {
  totalPageViews: number;
  uniqueVisitors: number;
  visitorsToday: number;
  newVisitorsToday: number;
  returningVisitorsToday: number;
  activeSessions: number;
  loggedInVisitors: number;
  guestVisitors: number;
  viewsLast7Days: number;
  viewsLast30Days: number;
};

type VisitorSession = {
  id: string;
  visitorLabel: string;
  visitorType: "guest" | "logged_in" | "unknown";
  deviceType: string;
  browser: string;
  operatingSystem: string;
  country: string | null;
  region: string | null;
  city: string | null;
  landingPage: string;
  lastPage: string;
  pageViews: number;
  firstSeen: string;
  lastSeen: string;
  pages: { pagePath: string; createdAt: string }[];
};

type AnalyticsData = {
  metrics: VisitorMetrics;
  coverage: {
    visitorIdentityClassificationAvailable: boolean;
    counterSettingsAvailable: boolean;
  };
  publicCounterEnabled: boolean;
  sessions: VisitorSession[];
  pageBreakdown: [string, number][];
  referrerBreakdown: [string, number][];
  countryBreakdown: [string, number][];
  deviceBreakdown: [string, number][];
  browserBreakdown: [string, number][];
  operatingSystemBreakdown: [string, number][];
};

const TIME_ZONE = "Asia/Colombo";
const PAGE_SIZE = 50;

function formatDate(value: string, includeTime = true) {
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

function localDateKey(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function isInRange(session: VisitorSession, range: string, now: Date) {
  if (range === "all") return true;
  const dateKey = localDateKey(session.lastSeen);
  const todayKey = localDateKey(now);
  if (range === "today") return dateKey === todayKey;
  if (range === "yesterday") {
    const yesterday = new Date(`${todayKey}T00:00:00Z`);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    return dateKey === yesterday.toISOString().slice(0, 10);
  }
  const days = Number(range);
  return Number.isFinite(days) && now.getTime() - new Date(session.lastSeen).getTime() <= days * 86400000;
}

function BreakdownCard({ title, entries }: { title: string; entries: [string, number][] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#111] p-5">
      <h3 className="font-bold">{title}</h3>
      {entries.length ? (
        <div className="mt-3 space-y-2">
          {entries.map(([label, count]) => (
            <div key={label} className="flex justify-between gap-3 text-sm">
              <span className="truncate text-gray-400">{label}</span>
              <b>{count}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-500">No breakdown data is available yet.</p>
      )}
    </div>
  );
}

export default function VisitorAnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [tab, setTab] = useState<"visitors" | "logins">("visitors");
  const [range, setRange] = useState("7");
  const [visitorType, setVisitorType] = useState("all");
  const [device, setDevice] = useState("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedSession, setSelectedSession] = useState<VisitorSession | null>(null);
  const [savingCounter, setSavingCounter] = useState(false);
  const [counterError, setCounterError] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    async function load(showLoading: boolean) {
      if (showLoading) setRefreshing(true);
      try {
        const response = await fetch("/api/analytics", { cache: "no-store" });
        const result = (await response.json()) as AnalyticsData & { error?: string };
        if (!response.ok) throw new Error(result.error || "Visitor analytics could not be loaded.");
        if (!active) return;
        setData(result);
        setError("");
        setNow(new Date());
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Visitor analytics could not be loaded.");
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    }
    void load(refreshKey > 0);
    const interval = window.setInterval(() => void load(false), 60000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  const filteredSessions = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.sessions.filter((session) => {
      if (!isInRange(session, range, now)) return false;
      if (visitorType !== "all" && session.visitorType !== visitorType) return false;
      if (device !== "all" && session.deviceType.toLowerCase() !== device.toLowerCase()) return false;
      if (!query) return true;
      return [
        session.visitorLabel,
        session.deviceType,
        session.browser,
        session.operatingSystem,
        session.city,
        session.region,
        session.country,
        session.landingPage,
        session.lastPage,
      ].filter(Boolean).join(" ").toLowerCase().includes(query);
    });
  }, [data, device, now, range, search, visitorType]);

  async function togglePublicCounter() {
    if (!data) return;
    setSavingCounter(true);
    setCounterError("");
    const nextValue = !data.publicCounterEnabled;
    try {
      const response = await fetch("/api/analytics", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ publicCounterEnabled: nextValue }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to update public visit counter.");
      setData((current) => current ? { ...current, publicCounterEnabled: nextValue } : current);
    } catch (saveError) {
      console.error("Public visit counter update failed:", saveError);
      setCounterError("Unable to update public visit counter.");
    } finally {
      setSavingCounter(false);
    }
  }

  const metrics = data?.metrics;
  const cards: [string, number][] = metrics ? [
    ["Total Page Views", metrics.totalPageViews],
    ["Unique Visitors", metrics.uniqueVisitors],
    ["Visitors Today", metrics.visitorsToday],
    ["New Visitors Today", metrics.newVisitorsToday],
    ["Returning Visitors Today", metrics.returningVisitorsToday],
    ["Active Sessions", metrics.activeSessions],
    ["Logged-in Visitors", metrics.loggedInVisitors],
    ["Guest Visitors", metrics.guestVisitors],
    ["Views Last 7 Days", metrics.viewsLast7Days],
    ["Views Last 30 Days", metrics.viewsLast30Days],
  ] : [];

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">Visitor Analytics</p>
        <h2 className="mt-1 text-2xl font-black">Website Visitors</h2>
        <p className="mt-2 text-xs text-gray-500">
          Page views and visitor identities are calculated separately. Today uses Asia/Colombo calendar dates.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10">
        <button type="button" onClick={() => setTab("visitors")} className={`rounded-t-lg px-4 py-2 text-sm font-bold ${tab === "visitors" ? "border-b-2 border-red-500 text-white" : "text-gray-500 hover:text-white"}`}>
          Visitor Analytics
        </button>
        <button type="button" onClick={() => setTab("logins")} className={`rounded-t-lg px-4 py-2 text-sm font-bold ${tab === "logins" ? "border-b-2 border-red-500 text-white" : "text-gray-500 hover:text-white"}`}>
          Login Analytics
        </button>
      </div>

      {tab === "logins" ? <LoginActivitySection /> : (
        <>
          {error && (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-200">
              <span>{error}</span>
              <button type="button" onClick={() => { setLoading(true); setRefreshKey((value) => value + 1); }} disabled={refreshing} className="rounded-md border border-red-400/40 px-3 py-1.5 font-bold hover:bg-red-900/40 disabled:opacity-50">
                {refreshing ? "Retrying..." : "Retry"}
              </button>
            </div>
          )}

          {data && !data.coverage.visitorIdentityClassificationAvailable && (
            <p className="rounded-lg border border-amber-700/50 bg-amber-950/30 p-3 text-xs text-amber-200">
              Legacy page views are intact, but authenticated-versus-guest classification is not available until the visitor analytics migration is applied. Unclassified visitors are not counted as guests.
            </p>
          )}
          {data && !data.coverage.counterSettingsAvailable && (
            <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Counter settings are not installed yet. Apply the analytics and login sessions migration to enable this setting; internal analytics collection continues.
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E2E8F0] bg-white p-4">
            <div>
              <p className="text-sm font-bold text-[#0F172A]">Public Visit Counter</p>
              <p className="mt-1 text-xs text-[#64748B]">Controls only whether a count appears in the public footer.</p>
            </div>
            <button
              type="button"
              onClick={() => void togglePublicCounter()}
              disabled={savingCounter || !data}
              aria-pressed={data?.publicCounterEnabled || false}
              className={`rounded-full border px-4 py-2 text-xs font-bold transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${
                data?.publicCounterEnabled
                  ? "border-[#86EFAC] bg-[#DCFCE7] text-[#166534]"
                  : "border-[#CBD5E1] bg-[#F1F5F9] text-[#475569]"
              }`}
            >
              {savingCounter ? "Saving..." : data?.publicCounterEnabled ? "ON" : "OFF"}
            </button>
          </div>
          {counterError && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {counterError}
            </p>
          )}

          {loading && !data ? (
            <p className="rounded-2xl border border-white/10 bg-[#111] p-8 text-sm text-gray-500">Loading visitor analytics...</p>
          ) : data ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {cards.map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-[#111] p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
                    <p className="mt-2 text-2xl font-black">{value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500">Active means a page view within the last 30 minutes; this is recent activity, not an authenticated online-presence signal.</p>
                <button type="button" onClick={() => { setLoading(true); setRefreshKey((value) => value + 1); }} disabled={refreshing} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/5 disabled:opacity-50">
                  {refreshing ? "Refreshing..." : "Refresh"}
                </button>
              </div>

              {metrics?.totalPageViews === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-[#111] p-8 text-center text-sm text-gray-400">
                  No page-view records exist yet. Public website visits will appear here once the tracker records them.
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap gap-3">
                    <select value={range} onChange={(event) => { setRange(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
                      <option value="today">Today (Sri Lanka)</option>
                      <option value="yesterday">Yesterday (Sri Lanka)</option>
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="all">All time</option>
                    </select>
                    <select value={visitorType} onChange={(event) => { setVisitorType(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
                      <option value="all">All visitor classifications</option>
                      <option value="guest">Guest</option>
                      <option value="logged_in">Logged in</option>
                      <option value="unknown">Unclassified</option>
                    </select>
                    <select value={device} onChange={(event) => { setDevice(event.target.value); setVisibleCount(PAGE_SIZE); }} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
                      <option value="all">All devices</option>
                      {[...new Set(data.sessions.map((session) => session.deviceType))].sort().map((name) => <option key={name} value={name}>{name}</option>)}
                    </select>
                    <input
                      value={search}
                      onChange={(event) => { setSearch(event.target.value); setVisibleCount(PAGE_SIZE); }}
                      placeholder="Search device, browser or page..."
                      className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111]">
                    {filteredSessions.length === 0 ? (
                      <p className="p-8 text-sm text-gray-500">No visitor sessions match these filters.</p>
                    ) : (
                      <table className="w-full min-w-[950px] text-left text-xs">
                        <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                          <tr>
                            <th className="p-4">Session</th><th className="p-4">Classification</th><th className="p-4">Device</th><th className="p-4">Browser</th><th className="p-4">Location</th><th className="p-4">Landing Page</th><th className="p-4">Page Views</th><th className="p-4">First Seen</th><th className="p-4">Last Seen</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredSessions.slice(0, visibleCount).map((session) => (
                            <tr key={session.id} onClick={() => setSelectedSession(session)} className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.04]">
                              <td className="p-4 font-semibold">{session.visitorLabel}</td>
                              <td className="p-4 capitalize">{session.visitorType.replace("_", " ")}</td>
                              <td className="p-4">{session.deviceType}</td>
                              <td className="p-4">{session.browser}</td>
                              <td className="p-4 text-gray-400">{[session.city, session.region, session.country].filter(Boolean).join(" / ") || "Unavailable"}</td>
                              <td className="p-4 text-gray-400">{session.landingPage}</td>
                              <td className="p-4">{session.pageViews}</td>
                              <td className="p-4 text-gray-500">{formatDate(session.firstSeen)}</td>
                              <td className="p-4 text-gray-500">{formatDate(session.lastSeen)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>

                  {filteredSessions.length > visibleCount && (
                    <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="w-full rounded-xl border border-white/10 bg-[#111] py-3 text-xs font-bold text-gray-300 hover:bg-white/[0.04]">
                      Load more sessions
                    </button>
                  )}

                  <div className="grid gap-5 lg:grid-cols-3">
                    <BreakdownCard title="Top Pages" entries={data.pageBreakdown} />
                    <BreakdownCard title="Top Referrers" entries={data.referrerBreakdown} />
                    <BreakdownCard title="Top Countries" entries={data.countryBreakdown} />
                    <BreakdownCard title="Device Breakdown" entries={data.deviceBreakdown} />
                    <BreakdownCard title="Browser Breakdown" entries={data.browserBreakdown} />
                    <BreakdownCard title="Operating System" entries={data.operatingSystemBreakdown} />
                  </div>
                </>
              )}
            </>
          ) : null}
        </>
      )}

      {selectedSession && (
        <div className="fixed inset-0 z-[120] flex items-stretch justify-end bg-black/70 p-0 sm:items-center sm:justify-center sm:p-4" onClick={() => setSelectedSession(null)}>
          <div role="dialog" aria-modal="true" aria-label="Visitor session details" className="h-full w-full max-w-md overflow-y-auto border-l border-white/10 bg-[#111] p-6 shadow-2xl sm:h-auto sm:max-h-[85vh] sm:rounded-2xl sm:border" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500">Visitor Details</p>
                <h3 className="mt-1 text-lg font-black">{selectedSession.visitorLabel}</h3>
              </div>
              <button type="button" onClick={() => setSelectedSession(null)} className="rounded-lg p-2 text-gray-400 hover:text-white">Close</button>
            </div>
            <dl className="mt-5 space-y-3 text-xs">
              <Detail label="Classification" value={selectedSession.visitorType.replace("_", " ")} />
              <Detail label="Device" value={selectedSession.deviceType} />
              <Detail label="Browser" value={selectedSession.browser} />
              <Detail label="Operating system" value={selectedSession.operatingSystem} />
              <Detail label="Approximate location" value={[selectedSession.city, selectedSession.region, selectedSession.country].filter(Boolean).join(", ") || "Unavailable"} />
              <Detail label="First seen" value={formatDate(selectedSession.firstSeen)} />
              <Detail label="Last seen" value={formatDate(selectedSession.lastSeen)} />
            </dl>
            <h4 className="mt-6 text-sm font-bold">Pages visited</h4>
            <div className="mt-3 space-y-2">
              {selectedSession.pages.map((page, index) => (
                <div key={`${page.createdAt}-${index}`} className="rounded-lg border border-white/5 bg-black/20 px-3 py-2 text-xs">
                  <p className="font-semibold">{page.pagePath}</p>
                  <p className="mt-1 text-gray-500">{formatDate(page.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-white/5 pb-2">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</dt>
      <dd className="break-all text-gray-300">{value}</dd>
    </div>
  );
}
