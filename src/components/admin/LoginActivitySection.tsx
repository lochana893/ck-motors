"use client";

import { useEffect, useMemo, useState } from "react";

type LoginSummary = {
  totalSuccessfulLogins: number;
  totalFailedLoginAttempts: number;
  loginsToday: number;
  failedAttemptsToday: number;
  loginsLast7Days: number;
  loginsLast30Days: number;
  uniqueLoggedInUsers: number;
  activeSessions: number | null;
  activeSessionsAvailable: boolean;
  customerLogins: number;
  staffLogins: number;
  adminLogins: number;
  lastSuccessfulLogin: string | null;
};

type LoginActivity = {
  id: string;
  user: string;
  role: "admin" | "staff" | "customer" | "unknown";
  loginMethod: "email" | "phone" | null;
  deviceType: string;
  browser: string;
  status: "success" | "failed";
  createdAt: string;
};

type LoginAnalyticsData = {
  summary: LoginSummary;
  roleSource: string;
  historyLimit: number;
  rows: LoginActivity[];
};

const TIME_ZONE = "Asia/Colombo";

function formatDate(value: string | null) {
  if (!value) return "No successful logins recorded";
  return new Intl.DateTimeFormat("en-LK", {
    timeZone: TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
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

function matchesDate(row: LoginActivity, period: string, now: Date) {
  if (period === "all") return true;
  const timestamp = new Date(row.createdAt).getTime();
  if (period === "today") return localDateKey(row.createdAt) === localDateKey(now);
  const days = Number(period);
  return Number.isFinite(days) && now.getTime() - timestamp <= days * 86400000;
}

export default function LoginActivitySection() {
  const [data, setData] = useState<LoginAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [role, setRole] = useState("all");
  const [loginMethod, setLoginMethod] = useState("all");
  const [device, setDevice] = useState("all");
  const [browser, setBrowser] = useState("all");
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const response = await fetch("/api/security/login-activity", { cache: "no-store" });
        const result = (await response.json()) as LoginAnalyticsData & { error?: string };
        if (!response.ok) throw new Error(result.error || "Login analytics could not be loaded.");
        if (!active) return;
        setData(result);
        setError("");
        setNow(new Date());
      } catch (loadError) {
        if (!active) return;
        setError(loadError instanceof Error ? loadError.message : "Login analytics could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    const interval = window.setInterval(() => void load(), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [refreshKey]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (!matchesDate(row, period, now)) return false;
      if (status !== "all" && row.status !== status) return false;
      if (role !== "all" && row.role !== role) return false;
      if (loginMethod !== "all" && row.loginMethod !== loginMethod) return false;
      if (device !== "all" && row.deviceType !== device) return false;
      if (browser !== "all" && row.browser !== browser) return false;
      return !query || `${row.user} ${row.role} ${row.loginMethod || ""} ${row.deviceType} ${row.browser} ${row.status}`.toLowerCase().includes(query);
    });
  }, [browser, data, device, loginMethod, now, period, role, search, status]);

  const summary = data?.summary;
  const statCards: [string, string | number][] = summary ? [
    ["Successful Logins", summary.totalSuccessfulLogins],
    ["Failed Login Attempts", summary.totalFailedLoginAttempts],
    ["Successful Logins Today", summary.loginsToday],
    ["Failed Attempts Today", summary.failedAttemptsToday],
    ["Logins Last 7 Days", summary.loginsLast7Days],
    ["Logins Last 30 Days", summary.loginsLast30Days],
    ["Unique Logged-in Users", summary.uniqueLoggedInUsers],
    ["Customer Logins", summary.customerLogins],
    ["Staff Logins", summary.staffLogins],
    ["Admin Logins", summary.adminLogins],
    ["Active Login Sessions", summary.activeSessionsAvailable ? summary.activeSessions ?? 0 : "Setup required"],
  ] : [];
  const devices = [...new Set((data?.rows || []).map((row) => row.deviceType))].sort();
  const browsers = [...new Set((data?.rows || []).map((row) => row.browser))].sort();

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">Security</p>
        <h2 className="mt-1 text-2xl font-black">Login Analytics</h2>
        <p className="mt-2 text-xs text-gray-500">
          Successful and failed sign-in attempts from the existing login activity table. Times use Asia/Colombo.
        </p>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-xs text-red-200">
          <span>{error}</span>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} className="rounded-md border border-red-400/40 px-3 py-1.5 font-bold hover:bg-red-900/40 disabled:opacity-50">
            {loading ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {statCards.map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-[#111] p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
                <p className="mt-2 text-2xl font-black">{value}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#111] p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Last Successful Login</p>
              <p className="mt-2 text-sm font-semibold">{formatDate(summary?.lastSuccessfulLogin || null)}</p>
            </div>
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F172A]">Role Attribution</p>
              <p className="mt-2 text-xs text-[#64748B]">{data.roleSource}</p>
            </div>
          </div>
          <p className="rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] p-3 text-xs text-[#1E40AF]">
            Active login sessions are based on authenticated heartbeat activity during the last 5 minutes.
          </p>
          {!summary?.activeSessionsAvailable && (
            <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Apply the analytics and login sessions migration to enable active session counts.
            </p>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-3">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search masked user, role, device, browser..." className="min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm" />
        <select value={period} onChange={(event) => setPeriod(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
          <option value="all">All dates</option><option value="today">Today (Sri Lanka)</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option>
        </select>
        <select value={role} onChange={(event) => setRole(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
          <option value="all">All roles</option><option value="customer">Customer</option><option value="staff">Staff</option><option value="admin">Admin</option><option value="unknown">Unknown</option>
        </select>
        <select value={loginMethod} onChange={(event) => setLoginMethod(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
          <option value="all">All login methods</option><option value="email">Email</option><option value="phone">Phone</option>
        </select>
        <select value={device} onChange={(event) => setDevice(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
          <option value="all">All devices</option>{devices.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={browser} onChange={(event) => setBrowser(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
          <option value="all">All browsers</option>{browsers.map((value) => <option key={value} value={value}>{value}</option>)}
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
          <option value="all">All statuses</option><option value="success">Successful</option><option value="failed">Failed</option>
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111]">
        {loading && !data ? (
          <p className="p-8 text-sm text-gray-500">Loading login history...</p>
        ) : filteredRows.length === 0 ? (
          <p className="p-8 text-sm text-gray-500">No login activity matches these filters.</p>
        ) : (
          <>
            <p className="px-4 pt-4 text-xs text-gray-500">Showing up to the latest {data?.historyLimit.toLocaleString()} records. Full counts include all stored history.</p>
            <table className="min-w-[850px] w-full text-left text-xs">
              <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500">
                <tr><th className="p-4">Date and Time (Sri Lanka)</th><th className="p-4">User</th><th className="p-4">Role</th><th className="p-4">Login Method</th><th className="p-4">Device</th><th className="p-4">Browser</th><th className="p-4">Status</th></tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="p-4 text-gray-400">{formatDate(row.createdAt)}</td>
                    <td className="p-4">{row.user}</td>
                    <td className="p-4 capitalize">{row.role}</td>
                    <td className="p-4 capitalize">{row.loginMethod || "Unknown"}</td>
                    <td className="p-4">{row.deviceType}</td>
                    <td className="p-4">{row.browser}</td>
                    <td className="p-4"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${row.status === "success" ? "bg-emerald-950/50 text-emerald-400" : "bg-red-950/50 text-red-400"}`}>{row.status.toUpperCase()}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </section>
  );
}
