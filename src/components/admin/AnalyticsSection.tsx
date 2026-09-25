"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type EventRow = { page_path: string; visitor_id: string; referrer: string | null; device_type: string | null; browser: string | null; created_at: string };

export default function AnalyticsSection() {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [now] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error: loadError } = await supabase.from("site_analytics_events").select("page_path,visitor_id,referrer,device_type,browser,created_at").order("created_at", { ascending: false }).range(0, 4999);
      if (!active) return;
      setEvents((data || []) as EventRow[]);
      setError(loadError?.message || "");
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [supabase]);

  const todayStart = useMemo(() => {
    const value = new Date(now);
    value.setHours(0, 0, 0, 0);
    return value;
  }, [now]);
  const sevenDays = now - 7 * 86400000;
  const thirtyDays = now - 30 * 86400000;
  const today = events.filter((event) => new Date(event.created_at) >= todayStart);
  const last7 = events.filter((event) => new Date(event.created_at).getTime() >= sevenDays);
  const last30 = events.filter((event) => new Date(event.created_at).getTime() >= thirtyDays);
  const topPages = [...new Set(events.map((event) => event.page_path))].map((page) => [page, events.filter((event) => event.page_path === page).length] as const).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const devices = [...new Set(events.map((event) => event.device_type || "Unknown"))].map((device) => [device, events.filter((event) => (event.device_type || "Unknown") === device).length] as const).sort((a, b) => b[1] - a[1]);

  return <section className="space-y-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">Website Analytics</p><h2 className="mt-1 text-2xl font-black">Privacy-conscious traffic</h2><p className="mt-2 text-xs text-gray-500">Anonymous first-party visitor IDs are used; raw public IP addresses are not stored for analytics.</p></div>{error && <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">Unable to load analytics: {error}</p>}{loading ? <p className="rounded-2xl border border-white/10 bg-[#111] p-8 text-sm text-gray-500">Loading analytics...</p> : <><div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">{[["Total Views", events.length], ["Unique Visitors", new Set(events.map((event) => event.visitor_id)).size], ["Today", today.length], ["Today Visitors", new Set(today.map((event) => event.visitor_id)).size], ["Last 7 Days", last7.length], ["Last 30 Days", last30.length]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#111] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}</div><div className="grid gap-5 lg:grid-cols-2"><div className="rounded-2xl border border-white/10 bg-[#111] p-5"><h3 className="font-bold">Top pages</h3>{topPages.map(([page, count]) => <div key={page} className="mt-3 flex justify-between text-sm"><span className="text-gray-400">{page}</span><b>{count}</b></div>)}</div><div className="rounded-2xl border border-white/10 bg-[#111] p-5"><h3 className="font-bold">Device breakdown</h3>{devices.map(([device, count]) => <div key={device} className="mt-3 flex justify-between text-sm"><span className="text-gray-400">{device}</span><b>{count}</b></div>)}</div></div></>}</section>;
}
