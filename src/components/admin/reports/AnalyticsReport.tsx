"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ReportToolbar from "@/components/reports/ReportToolbar";
import ReportLayout from "@/components/reports/ReportLayout";
import ReportSummary from "@/components/reports/ReportSummary";
import PrintableTable from "@/components/reports/PrintableTable";
import CSVExportButton from "@/components/reports/CSVExportButton";
import { resolveReportDateRange, formatReportPeriodLabel, type ReportDateRangeKey } from "@/lib/report-date-ranges";

type PageEvent = {
  page_path: string;
  referrer: string | null;
  device_type: string | null;
  browser: string | null;
  country: string | null;
  visitor_id: string;
  created_at: string;
};

function topN(counts: Map<string, number>, n = 8) {
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

// Admin-only printable summary reusing the same site_analytics_events table
// as the on-screen Analytics dashboard. Intentionally omits raw visitor IP
// addresses — this is the general traffic report, not the security-scoped
// Visitor Report.
export default function AnalyticsReportView({ onBack }: { onBack: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [events, setEvents] = useState<PageEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<ReportDateRangeKey>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { start, end } = resolveReportDateRange(range, customStart, customEnd);
      let query = supabase
        .from("site_analytics_events")
        .select("page_path, referrer, device_type, browser, country, visitor_id, created_at")
        .order("created_at", { ascending: false })
        .range(0, 4999);
      if (start) query = query.gte("created_at", start.toISOString());
      if (end) query = query.lte("created_at", end.toISOString());
      const { data, error: loadError } = await query;
      if (!active) return;
      setEvents((data || []) as PageEvent[]);
      setError(loadError?.message || "");
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [supabase, range, customStart, customEnd]);

  const periodLabel = formatReportPeriodLabel(range, customStart, customEnd);

  const uniqueVisitors = new Set(events.map((event) => event.visitor_id)).size;
  const pageCounts = new Map<string, number>();
  const referrerCounts = new Map<string, number>();
  const deviceCounts = new Map<string, number>();
  const browserCounts = new Map<string, number>();
  const countryCounts = new Map<string, number>();
  for (const event of events) {
    pageCounts.set(event.page_path, (pageCounts.get(event.page_path) || 0) + 1);
    const referrer = event.referrer ? new URL(event.referrer, "https://ckmotors.lk").hostname : "Direct";
    referrerCounts.set(referrer, (referrerCounts.get(referrer) || 0) + 1);
    deviceCounts.set(event.device_type || "Unknown", (deviceCounts.get(event.device_type || "Unknown") || 0) + 1);
    browserCounts.set(event.browser || "Unknown", (browserCounts.get(event.browser || "Unknown") || 0) + 1);
    if (event.country) countryCounts.set(event.country, (countryCounts.get(event.country) || 0) + 1);
  }

  return (
    <div>
      <ReportToolbar
        title="Analytics Report"
        onBack={onBack}
        orientation="landscape"
        filters={
          <>
            <select value={range} onChange={(event) => setRange(event.target.value as ReportDateRangeKey)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="today">Today</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="custom">Custom Range</option>
              <option value="all">All Time</option>
            </select>
            {range === "custom" && (
              <>
                <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm" />
                <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm" />
              </>
            )}
          </>
        }
        csvButton={<CSVExportButton filename="ck-motors-analytics-report" rows={events} columns={[
          { header: "Date", value: (row) => new Date(row.created_at).toLocaleString() },
          { header: "Page", value: (row) => row.page_path },
          { header: "Visitor", value: (row) => row.visitor_id },
          { header: "Device", value: (row) => row.device_type || "" },
          { header: "Browser", value: (row) => row.browser || "" },
          { header: "Country", value: (row) => row.country || "" },
          { header: "Referrer", value: (row) => row.referrer || "" },
        ]} />}
      />
      {loading ? (
        <p className="p-8 text-sm text-gray-500">Loading analytics...</p>
      ) : error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">Unable to generate report. Please try again.</p>
      ) : (
        <ReportLayout title="Analytics Report" periodLabel={periodLabel} orientation="landscape">
          <ReportSummary
            cards={[
              { label: "Total Views", value: events.length },
              { label: "Unique Visitors", value: uniqueVisitors },
              { label: "Views in Selected Range", value: events.length },
              { label: "Visitors in Selected Range", value: uniqueVisitors },
            ]}
          />

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-black uppercase">Top Pages</h3>
              <PrintableTable rowKey={(row) => row[0]} rows={topN(pageCounts)} columns={[{ header: "Page", render: (row) => row[0] }, { header: "Views", align: "right", render: (row) => row[1] }]} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-black uppercase">Top Referrers</h3>
              <PrintableTable rowKey={(row) => row[0]} rows={topN(referrerCounts)} columns={[{ header: "Referrer", render: (row) => row[0] }, { header: "Views", align: "right", render: (row) => row[1] }]} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-black uppercase">Device Breakdown</h3>
              <PrintableTable rowKey={(row) => row[0]} rows={topN(deviceCounts)} columns={[{ header: "Device", render: (row) => row[0] }, { header: "Views", align: "right", render: (row) => row[1] }]} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-black uppercase">Browser Breakdown</h3>
              <PrintableTable rowKey={(row) => row[0]} rows={topN(browserCounts)} columns={[{ header: "Browser", render: (row) => row[0] }, { header: "Views", align: "right", render: (row) => row[1] }]} />
            </div>
            <div className="md:col-span-2">
              <h3 className="mb-2 text-xs font-black uppercase">Country Breakdown</h3>
              <PrintableTable rowKey={(row) => row[0]} rows={topN(countryCounts)} columns={[{ header: "Country", render: (row) => row[0] }, { header: "Views", align: "right", render: (row) => row[1] }]} emptyLabel="No country data available." />
            </div>
          </div>
        </ReportLayout>
      )}
    </div>
  );
}
