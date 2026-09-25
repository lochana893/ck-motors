"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Activity = {
  id: string;
  email: string | null;
  ip_address: string | null;
  device_type: string;
  browser: string;
  operating_system: string;
  country: string | null;
  region: string | null;
  city: string | null;
  login_status: "success" | "failed";
  created_at: string;
};

export default function LoginActivitySection() {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<Activity[]>([]);
  const [range, setRange] = useState("7");
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const from = new Date();
      from.setDate(from.getDate() - Number(range));
      let query = supabase.from("login_activity").select("id,email,ip_address,device_type,browser,operating_system,country,region,city,login_status,created_at").gte("created_at", from.toISOString()).order("created_at", { ascending: false }).range(0, 199);
      if (status !== "all") query = query.eq("login_status", status);
      const { data, error: loadError } = await query;
      if (!active) return;
      setRows((data || []) as Activity[]);
      setError(loadError?.message || "");
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [range, status, supabase]);

  const filtered = rows.filter((row) => [row.email, row.ip_address, row.browser, row.operating_system, row.city].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()));
  const today = new Date().toDateString();
  const todayRows = rows.filter((row) => new Date(row.created_at).toDateString() === today);

  return (
    <section className="space-y-5">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">Security</p><h2 className="mt-1 text-2xl font-black">Login Activity</h2><p className="mt-2 text-xs text-gray-500">Sensitive security records are visible only to active administrators. Location is approximate.</p></div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[["Logins Today", todayRows.filter((row) => row.login_status === "success").length], ["Unique Users Today", new Set(todayRows.map((row) => row.email).filter(Boolean)).size], ["Failed Attempts", rows.filter((row) => row.login_status === "failed").length], ["Unique IPs", new Set(rows.map((row) => row.ip_address).filter(Boolean)).size]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-[#111] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p></div>)}
      </div>
      <div className="flex flex-wrap gap-3"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search user, IP, browser..." className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm" /><select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"><option value="1">Today</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select><select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"><option value="all">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option></select></div>
      {error && <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-300">Unable to load login activity: {error}</p>}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111]">{loading ? <p className="p-8 text-sm text-gray-500">Loading security activity...</p> : filtered.length === 0 ? <p className="p-8 text-sm text-gray-500">No login activity in this period.</p> : <table className="min-w-[900px] w-full text-left text-xs"><thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500"><tr><th className="p-4">Time</th><th className="p-4">User</th><th className="p-4">IP</th><th className="p-4">Device</th><th className="p-4">Location</th><th className="p-4">Status</th></tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-b border-white/5"><td className="p-4 text-gray-400">{new Date(row.created_at).toLocaleString()}</td><td className="p-4">{row.email || "Unknown"}</td><td className="p-4 font-mono text-gray-400">{row.ip_address || "Unavailable"}</td><td className="p-4">{row.device_type} · {row.operating_system} · {row.browser}</td><td className="p-4 text-gray-400">{[row.city, row.region, row.country].filter(Boolean).join(", ") || "Approximate location unavailable"}</td><td className="p-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.login_status === "success" ? "bg-emerald-950/50 text-emerald-400" : "bg-red-950/50 text-red-400"}`}>{row.login_status.toUpperCase()}</span></td></tr>)}</tbody></table>}</div>
    </section>
  );
}
