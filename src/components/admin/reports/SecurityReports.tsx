"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ReportToolbar from "@/components/reports/ReportToolbar";
import ReportLayout from "@/components/reports/ReportLayout";
import ReportSummary from "@/components/reports/ReportSummary";
import PrintableTable from "@/components/reports/PrintableTable";
import CSVExportButton from "@/components/reports/CSVExportButton";
import type { CSVColumn } from "@/lib/csv";

type LoginActivityRow = {
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

function locationOf(row: Pick<LoginActivityRow, "city" | "region" | "country">) {
  return [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unavailable";
}

export function LoginActivityReport({ onBack }: { onBack: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<LoginActivityRow[]>([]);
  const [range, setRange] = useState("7");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const from = new Date();
      from.setDate(from.getDate() - Number(range));
      let query = supabase
        .from("login_activity")
        .select("id, email, ip_address, device_type, browser, operating_system, country, region, city, login_status, created_at")
        .gte("created_at", from.toISOString())
        .order("created_at", { ascending: false })
        .range(0, 499);
      if (status !== "all") query = query.eq("login_status", status);
      const { data, error: loadError } = await query;
      if (!active) return;
      setRows((data || []) as LoginActivityRow[]);
      setError(loadError?.message || "");
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [supabase, range, status]);

  const csvColumns: CSVColumn<LoginActivityRow>[] = [
    { header: "Email", value: (row) => row.email || "" },
    { header: "IP Address", value: (row) => row.ip_address || "" },
    { header: "Device", value: (row) => row.device_type },
    { header: "Browser", value: (row) => row.browser },
    { header: "Operating System", value: (row) => row.operating_system },
    { header: "Approximate Location", value: (row) => locationOf(row) },
    { header: "Login Date/Time", value: (row) => new Date(row.created_at).toLocaleString() },
    { header: "Status", value: (row) => row.login_status },
  ];

  return (
    <div>
      <ReportToolbar
        title="Login Activity Report"
        onBack={onBack}
        orientation="landscape"
        printLabel="Print / Save PDF"
        filters={
          <>
            <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="1">Today</option>
              <option value="7">Last 7 Days</option>
              <option value="30">Last 30 Days</option>
            </select>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="all">All Statuses</option>
              <option value="success">Successful</option>
              <option value="failed">Failed</option>
            </select>
          </>
        }
        csvButton={<CSVExportButton filename="ck-motors-login-activity-report" rows={rows} columns={csvColumns} />}
      />
      {loading ? (
        <p className="p-8 text-sm text-gray-500">Loading login activity...</p>
      ) : error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">Unable to generate report. Please try again.</p>
      ) : (
        <ReportLayout title="Login Activity Report" orientation="landscape">
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-center text-[10px] font-black uppercase tracking-wider text-red-700">
            Confidential - Admin Use Only
          </p>
          <ReportSummary
            cards={[
              { label: "Total Records", value: rows.length },
              { label: "Successful", value: rows.filter((row) => row.login_status === "success").length },
              { label: "Failed", value: rows.filter((row) => row.login_status === "failed").length },
              { label: "Unique IPs", value: new Set(rows.map((row) => row.ip_address).filter(Boolean)).size },
            ]}
          />
          <PrintableTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { header: "User/Email", render: (row) => row.email || "Unknown" },
              { header: "IP Address", render: (row) => row.ip_address || "Unavailable" },
              { header: "Device", render: (row) => row.device_type },
              { header: "Browser", render: (row) => row.browser },
              { header: "OS", render: (row) => row.operating_system },
              { header: "Approximate Location", render: (row) => locationOf(row) },
              { header: "Login Time", render: (row) => new Date(row.created_at).toLocaleString() },
              { header: "Status", render: (row) => row.login_status.toUpperCase() },
            ]}
          />
        </ReportLayout>
      )}
    </div>
  );
}

type VisitorSessionRow = {
  id: string;
  visitor_id: string;
  user_id: string | null;
  ip_address: string | null;
  device_type: string | null;
  browser: string | null;
  operating_system: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  landing_page: string | null;
  page_views: number;
  first_seen: string;
  last_seen: string;
};

function durationOf(startIso: string, endIso: string) {
  const ms = Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

export function VisitorReport({ onBack }: { onBack: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<VisitorSessionRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { full_name: string; email: string }>>({});
  const [range, setRange] = useState("7");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const from = new Date();
      from.setDate(from.getDate() - Number(range));
      const { data, error: loadError } = await supabase
        .from("visitor_sessions")
        .select("id, visitor_id, user_id, ip_address, device_type, browser, operating_system, country, region, city, landing_page, page_views, first_seen, last_seen")
        .gte("last_seen", from.toISOString())
        .order("last_seen", { ascending: false })
        .range(0, 499);
      if (!active) return;
      const sessions = (data || []) as VisitorSessionRow[];
      setRows(sessions);
      setError(loadError?.message || "");

      const userIds = [...new Set(sessions.map((row) => row.user_id).filter((id): id is string => !!id))];
      if (userIds.length > 0) {
        const { data: profileRows } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        if (active && profileRows) {
          setProfiles(Object.fromEntries(profileRows.map((row) => [row.id as string, { full_name: row.full_name as string, email: row.email as string }])));
        }
      }
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [supabase, range]);

  const locationOfSession = (row: Pick<VisitorSessionRow, "city" | "region" | "country">) =>
    [row.city, row.region, row.country].filter(Boolean).join(", ") || "Unavailable";

  const csvColumns: CSVColumn<VisitorSessionRow>[] = [
    { header: "Visitor ID", value: (row) => row.visitor_id },
    { header: "Guest/Logged-in", value: (row) => (row.user_id ? "Logged-in" : "Guest") },
    { header: "Customer Name", value: (row) => (row.user_id ? profiles[row.user_id]?.full_name || "" : "") },
    { header: "Email", value: (row) => (row.user_id ? profiles[row.user_id]?.email || "" : "") },
    { header: "IP Address", value: (row) => row.ip_address || "" },
    { header: "Country", value: (row) => row.country || "" },
    { header: "Region", value: (row) => row.region || "" },
    { header: "City", value: (row) => row.city || "" },
    { header: "Device", value: (row) => row.device_type || "" },
    { header: "Browser", value: (row) => row.browser || "" },
    { header: "OS", value: (row) => row.operating_system || "" },
    { header: "Landing Page", value: (row) => row.landing_page || "" },
    { header: "Pages Viewed", value: (row) => row.page_views },
    { header: "First Seen", value: (row) => new Date(row.first_seen).toLocaleString() },
    { header: "Last Seen", value: (row) => new Date(row.last_seen).toLocaleString() },
    { header: "Session Duration", value: (row) => durationOf(row.first_seen, row.last_seen) },
  ];

  return (
    <div>
      <ReportToolbar
        title="Visitor Report"
        onBack={onBack}
        orientation="landscape"
        filters={
          <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
            <option value="1">Today</option>
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
          </select>
        }
        csvButton={<CSVExportButton filename="ck-motors-visitor-report" rows={rows} columns={csvColumns} />}
      />
      {loading ? (
        <p className="p-8 text-sm text-gray-500">Loading visitor sessions...</p>
      ) : error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">Unable to generate report. Please try again.</p>
      ) : (
        <ReportLayout title="Visitor Report" orientation="landscape">
          <p className="mb-4 rounded-lg border border-red-300 bg-red-50 p-3 text-center text-[10px] font-black uppercase tracking-wider text-red-700">
            Confidential - Admin Use Only. Location is approximate and does not identify an exact physical person.
          </p>
          <ReportSummary
            cards={[
              { label: "Total Sessions", value: rows.length },
              { label: "Unique Visitors", value: new Set(rows.map((row) => row.visitor_id)).size },
              { label: "Logged-in Sessions", value: rows.filter((row) => row.user_id).length },
              { label: "Guest Sessions", value: rows.filter((row) => !row.user_id).length },
            ]}
          />
          <PrintableTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { header: "Visitor", render: (row) => (row.user_id ? profiles[row.user_id]?.full_name || "Logged-in" : "Guest") },
              { header: "IP Address", render: (row) => row.ip_address || "Unavailable" },
              { header: "Location", render: (row) => locationOfSession(row) },
              { header: "Device", render: (row) => row.device_type || "—" },
              { header: "Browser", render: (row) => row.browser || "—" },
              { header: "OS", render: (row) => row.operating_system || "—" },
              { header: "Landing Page", render: (row) => row.landing_page || "—" },
              { header: "Pages Viewed", align: "center", render: (row) => row.page_views },
              { header: "First Seen", render: (row) => new Date(row.first_seen).toLocaleString() },
              { header: "Last Seen", render: (row) => new Date(row.last_seen).toLocaleString() },
              { header: "Duration", render: (row) => durationOf(row.first_seen, row.last_seen) },
            ]}
          />
        </ReportLayout>
      )}
    </div>
  );
}
