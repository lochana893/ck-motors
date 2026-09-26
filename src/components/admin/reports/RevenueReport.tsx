"use client";

import { useMemo, useState } from "react";
import ReportToolbar from "@/components/reports/ReportToolbar";
import ReportLayout from "@/components/reports/ReportLayout";
import ReportSummary from "@/components/reports/ReportSummary";
import PrintableTable from "@/components/reports/PrintableTable";
import CSVExportButton from "@/components/reports/CSVExportButton";
import { resolveReportDateRange, formatReportPeriodLabel, type ReportDateRangeKey } from "@/lib/report-date-ranges";
import type { CSVColumn } from "@/lib/csv";
import type { ReportProfile, ReportServiceRecord, ReportVehicle } from "./types";
import { invoiceNumberFor } from "./types";

function money(value: number) {
  return `LKR ${Number(value || 0).toLocaleString()}`;
}

export default function RevenueReport({
  records,
  profiles,
  vehicles,
  onBack,
}: {
  records: ReportServiceRecord[];
  profiles: ReportProfile[];
  vehicles: ReportVehicle[];
  onBack: () => void;
}) {
  const [range, setRange] = useState<ReportDateRangeKey>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const getProfile = (id: string) => profiles.find((profile) => profile.id === id);
  const getVehicle = (id: string) => vehicles.find((vehicle) => vehicle.id === id);

  const filtered = useMemo(() => {
    const { start, end } = resolveReportDateRange(range, customStart, customEnd);
    return records
      .filter((record) => {
        const date = new Date(record.service_date);
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      })
      .sort((a, b) => a.service_date.localeCompare(b.service_date));
  }, [records, range, customStart, customEnd]);

  const totalInvoiced = filtered.reduce((sum, record) => sum + Number(record.total_cost || 0), 0);
  const totalDiscount = filtered.reduce((sum, record) => sum + Number(record.discount || 0), 0);
  const averageInvoice = filtered.length > 0 ? totalInvoiced / filtered.length : 0;

  const dailyBreakdown = useMemo(() => {
    const map = new Map<string, { date: string; jobs: number; amount: number }>();
    for (const record of filtered) {
      const existing = map.get(record.service_date) || { date: record.service_date, jobs: 0, amount: 0 };
      existing.jobs += 1;
      existing.amount += Number(record.total_cost || 0);
      map.set(record.service_date, existing);
    }
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [filtered]);

  const periodLabel = formatReportPeriodLabel(range, customStart, customEnd);

  const csvColumns: CSVColumn<ReportServiceRecord>[] = [
    { header: "Invoice Number", value: (row) => invoiceNumberFor(row) },
    { header: "Customer", value: (row) => getProfile(row.user_id)?.full_name || "" },
    { header: "Vehicle", value: (row) => getVehicle(row.vehicle_id)?.registration_number || "" },
    { header: "Date", value: (row) => row.service_date },
    { header: "Subtotal", value: (row) => Number(row.labour_cost || 0) + Number(row.parts_cost || 0) + Number(row.additional_cost || 0) },
    { header: "Discount", value: (row) => row.discount || 0 },
    { header: "Grand Total", value: (row) => row.total_cost || 0 },
  ];

  return (
    <div>
      <ReportToolbar
        title="Monthly Revenue Report"
        onBack={onBack}
        orientation="landscape"
        filters={
          <>
            <select value={range} onChange={(event) => setRange(event.target.value as ReportDateRangeKey)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="today">Today&apos;s Revenue</option>
              <option value="this_week">This Week</option>
              <option value="this_month">This Month</option>
              <option value="last_month">Last Month</option>
              <option value="this_year">This Year</option>
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
        csvButton={<CSVExportButton filename="ck-motors-revenue-report" rows={filtered} columns={csvColumns} />}
      />

      <ReportLayout title="Revenue Report" periodLabel={periodLabel} orientation="landscape">
        <ReportSummary
          cards={[
            { label: "Total Invoiced", value: money(totalInvoiced) },
            { label: "Completed Jobs", value: filtered.length },
            { label: "Average Invoice Value", value: money(averageInvoice) },
            { label: "Total Discounts Given", value: money(totalDiscount) },
          ]}
        />

        <p className="mb-3 text-[9px] italic text-gray-500">
          Note: figures reflect all recorded completed services for the selected period. The current system does not
          track partial payments, so every invoice is treated as invoiced revenue.
        </p>

        <h3 className="mb-2 text-xs font-black uppercase tracking-wide">Daily Breakdown</h3>
        <PrintableTable
          rowKey={(row) => row.date}
          rows={dailyBreakdown}
          columns={[
            { header: "Date", render: (row) => row.date },
            { header: "Jobs", align: "center", render: (row) => row.jobs },
            { header: "Amount Invoiced", align: "right", render: (row) => money(row.amount) },
          ]}
        />

        <h3 className="mb-2 mt-6 text-xs font-black uppercase tracking-wide">Invoice Breakdown</h3>
        <PrintableTable
          rowKey={(row) => row.id}
          rows={filtered}
          columns={[
            { header: "Invoice No.", render: (row) => invoiceNumberFor(row) },
            { header: "Customer", render: (row) => getProfile(row.user_id)?.full_name || "—" },
            { header: "Vehicle", render: (row) => getVehicle(row.vehicle_id)?.registration_number || "—" },
            { header: "Date", render: (row) => row.service_date },
            { header: "Subtotal", align: "right", render: (row) => money(Number(row.labour_cost || 0) + Number(row.parts_cost || 0) + Number(row.additional_cost || 0)) },
            { header: "Discount", align: "right", render: (row) => money(row.discount) },
            { header: "Grand Total", align: "right", render: (row) => money(row.total_cost) },
          ]}
        />
      </ReportLayout>
    </div>
  );
}
