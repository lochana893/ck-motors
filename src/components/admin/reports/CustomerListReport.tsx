"use client";

import { useMemo, useState } from "react";
import ReportToolbar from "@/components/reports/ReportToolbar";
import ReportLayout from "@/components/reports/ReportLayout";
import ReportSummary from "@/components/reports/ReportSummary";
import PrintableTable from "@/components/reports/PrintableTable";
import CSVExportButton from "@/components/reports/CSVExportButton";
import type { CSVColumn } from "@/lib/csv";
import type { ReportBooking, ReportProfile, ReportServiceRecord, ReportVehicle } from "./types";

export default function CustomerListReport({
  profiles,
  vehicles,
  bookings,
  records,
  onBack,
}: {
  profiles: ReportProfile[];
  vehicles: ReportVehicle[];
  bookings: ReportBooking[];
  records: ReportServiceRecord[];
  onBack: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all");
  const [search, setSearch] = useState("");

  const rows = useMemo(() => {
    return profiles
      .filter((profile) => profile.role === "customer")
      .filter((profile) => (statusFilter === "all" ? true : statusFilter === "active" ? profile.status === "active" : profile.status !== "active"))
      .filter((profile) =>
        !search.trim() ||
        [profile.full_name, profile.email, profile.phone].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase())
      )
      .map((profile) => {
        const vehicleCount = vehicles.filter((vehicle) => vehicle.user_id === profile.id).length;
        const customerRecords = records.filter((record) => record.user_id === profile.id);
        const customerBookings = bookings.filter((booking) => booking.user_id === profile.id);
        const lastVisitDates = [...customerRecords.map((record) => record.service_date), ...customerBookings.map((booking) => booking.booking_date)];
        const lastVisit = lastVisitDates.length > 0 ? lastVisitDates.sort().at(-1) : null;
        return {
          profile,
          vehicleCount,
          completedServices: customerRecords.length,
          lastVisit,
        };
      })
      .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));
  }, [profiles, vehicles, bookings, records, statusFilter, search]);

  const csvColumns: CSVColumn<(typeof rows)[number]>[] = [
    { header: "Customer Name", value: (row) => row.profile.full_name },
    { header: "Phone", value: (row) => row.profile.phone || "" },
    { header: "Email", value: (row) => row.profile.email },
    { header: "Vehicle Count", value: (row) => row.vehicleCount },
    { header: "Completed Services", value: (row) => row.completedServices },
    { header: "Last Visit", value: (row) => row.lastVisit || "" },
    { header: "Status", value: (row) => row.profile.status },
  ];

  return (
    <div>
      <ReportToolbar
        title="Customer Report"
        onBack={onBack}
        orientation="landscape"
        filters={
          <>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name, phone or email..."
              className="min-w-[200px] rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
            />
          </>
        }
        csvButton={<CSVExportButton filename="ck-motors-customer-report" rows={rows} columns={csvColumns} />}
      />

      <ReportLayout title="Customer Report" orientation="landscape">
        <ReportSummary
          cards={[
            { label: "Total Customers", value: rows.length },
            { label: "Active", value: rows.filter((row) => row.profile.status === "active").length },
            { label: "Disabled", value: rows.filter((row) => row.profile.status !== "active").length },
            { label: "Total Vehicles", value: rows.reduce((sum, row) => sum + row.vehicleCount, 0) },
          ]}
        />
        <PrintableTable
          rowKey={(row) => row.profile.id}
          rows={rows}
          columns={[
            { header: "No.", render: (_row) => rows.indexOf(_row) + 1 },
            { header: "Customer Name", render: (row) => row.profile.full_name },
            { header: "Phone", render: (row) => row.profile.phone || "—" },
            { header: "Email", render: (row) => row.profile.email },
            { header: "Vehicles", align: "center", render: (row) => row.vehicleCount },
            { header: "Completed Services", align: "center", render: (row) => row.completedServices },
            { header: "Last Visit", render: (row) => row.lastVisit || "—" },
            { header: "Status", render: (row) => row.profile.status },
          ]}
        />
      </ReportLayout>
    </div>
  );
}
