"use client";

import { useMemo, useState } from "react";
import ReportToolbar from "@/components/reports/ReportToolbar";
import ReportLayout from "@/components/reports/ReportLayout";
import ReportSummary from "@/components/reports/ReportSummary";
import PrintableTable from "@/components/reports/PrintableTable";
import CSVExportButton from "@/components/reports/CSVExportButton";
import { resolveReportDateRange, formatReportPeriodLabel, type ReportDateRangeKey } from "@/lib/report-date-ranges";
import type { CSVColumn } from "@/lib/csv";
import type { ReportBooking, ReportProfile, ReportVehicle } from "./types";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  vehicle_received: "Vehicle Received",
  inspection: "Inspection",
  repair_in_progress: "In Progress",
  waiting_for_parts: "Waiting for Parts",
  ready_for_collection: "Ready for Collection",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function BookingsReport({
  bookings,
  profiles,
  vehicles,
  mode,
  onBack,
}: {
  bookings: ReportBooking[];
  profiles: ReportProfile[];
  vehicles: ReportVehicle[];
  mode: "full" | "today";
  onBack: () => void;
}) {
  const [range, setRange] = useState<ReportDateRangeKey>(mode === "today" ? "today" : "this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getProfile = (id: string) => profiles.find((profile) => profile.id === id);
  const getVehicle = (id: string) => vehicles.find((vehicle) => vehicle.id === id);

  const rows = useMemo(() => {
    const { start, end } = resolveReportDateRange(mode === "today" ? "today" : range, customStart, customEnd);
    return bookings
      .filter((booking) => {
        const date = new Date(`${booking.booking_date}T${booking.booking_time || "00:00"}`);
        if (start && date < start) return false;
        if (end && date > end) return false;
        if (statusFilter !== "all" && booking.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => `${a.booking_date}${a.booking_time}`.localeCompare(`${b.booking_date}${b.booking_time}`));
  }, [bookings, mode, range, customStart, customEnd, statusFilter]);

  const periodLabel = formatReportPeriodLabel(mode === "today" ? "today" : range, customStart, customEnd);

  const csvColumns: CSVColumn<ReportBooking>[] = [
    { header: "Booking Ref", value: (row) => row.booking_reference },
    { header: "Customer", value: (row) => getProfile(row.user_id)?.full_name || "" },
    { header: "Phone", value: (row) => getProfile(row.user_id)?.phone || "" },
    { header: "Vehicle", value: (row) => getVehicle(row.vehicle_id)?.registration_number || "" },
    { header: "Service", value: (row) => row.service_name_snapshot || "" },
    { header: "Booking Date", value: (row) => row.booking_date },
    { header: "Time", value: (row) => row.booking_time },
    { header: "Status", value: (row) => STATUS_LABELS[row.status] || row.status },
    { header: "Created", value: (row) => new Date(row.created_at).toLocaleDateString() },
  ];

  const statusCounts = ["pending", "confirmed", "repair_in_progress", "completed", "cancelled"].map((status) => ({
    label: STATUS_LABELS[status],
    value: rows.filter((row) => row.status === status).length,
  }));

  const title = mode === "today" ? "Today's Workshop Booking Sheet" : "Booking Report";

  return (
    <div>
      <ReportToolbar
        title={title}
        onBack={onBack}
        orientation="landscape"
        filters={
          mode === "full" ? (
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
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
                <option value="all">All Statuses</option>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </>
          ) : undefined
        }
        csvButton={mode === "full" ? <CSVExportButton filename="ck-motors-booking-report" rows={rows} columns={csvColumns} /> : undefined}
      />

      <ReportLayout title={title} periodLabel={periodLabel} orientation="landscape">
        {mode === "full" && (
          <ReportSummary
            cards={[{ label: "Total Bookings", value: rows.length }, ...statusCounts]}
          />
        )}

        <PrintableTable
          rowKey={(row) => row.id}
          rows={rows}
          columns={
            mode === "today"
              ? [
                  { header: "Time", render: (row) => row.booking_time },
                  { header: "Customer", render: (row) => getProfile(row.user_id)?.full_name || "—" },
                  { header: "Phone", render: (row) => getProfile(row.user_id)?.phone || "—" },
                  { header: "Vehicle", render: (row) => getVehicle(row.vehicle_id)?.registration_number || "—" },
                  { header: "Service", render: (row) => row.service_name_snapshot || "—" },
                  { header: "Technician", render: () => "—" },
                  { header: "Status", render: (row) => STATUS_LABELS[row.status] || row.status },
                  { header: "Notes", render: (row) => row.admin_notes || "" },
                ]
              : [
                  { header: "Booking Ref", render: (row) => row.booking_reference },
                  { header: "Customer", render: (row) => getProfile(row.user_id)?.full_name || "—" },
                  { header: "Phone", render: (row) => getProfile(row.user_id)?.phone || "—" },
                  { header: "Vehicle", render: (row) => getVehicle(row.vehicle_id)?.registration_number || "—" },
                  { header: "Service", render: (row) => row.service_name_snapshot || "—" },
                  { header: "Date", render: (row) => row.booking_date },
                  { header: "Time", render: (row) => row.booking_time },
                  { header: "Status", render: (row) => STATUS_LABELS[row.status] || row.status },
                  { header: "Created", render: (row) => new Date(row.created_at).toLocaleDateString() },
                ]
          }
        />
      </ReportLayout>
    </div>
  );
}
