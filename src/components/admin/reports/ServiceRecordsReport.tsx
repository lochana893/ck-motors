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

export default function ServiceRecordsReport({
  records,
  profiles,
  vehicles,
  mode,
  onBack,
}: {
  records: ReportServiceRecord[];
  profiles: ReportProfile[];
  vehicles: ReportVehicle[];
  mode: "all" | "vehicle";
  onBack: () => void;
}) {
  const [range, setRange] = useState<ReportDateRangeKey>("all");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [vehicleId, setVehicleId] = useState(mode === "vehicle" ? vehicles[0]?.id || "" : "");

  const getProfile = (id: string) => profiles.find((profile) => profile.id === id);
  const getVehicle = (id: string) => vehicles.find((vehicle) => vehicle.id === id);
  const selectedVehicle = mode === "vehicle" ? getVehicle(vehicleId) : undefined;

  const rows = useMemo(() => {
    const { start, end } = resolveReportDateRange(range, customStart, customEnd);
    return records
      .filter((record) => (mode === "vehicle" ? record.vehicle_id === vehicleId : true))
      .filter((record) => {
        const date = new Date(record.service_date);
        if (start && date < start) return false;
        if (end && date > end) return false;
        return true;
      })
      .sort((a, b) => a.service_date.localeCompare(b.service_date));
  }, [records, mode, vehicleId, range, customStart, customEnd]);

  const periodLabel = formatReportPeriodLabel(range, customStart, customEnd);
  const title = mode === "vehicle" ? "Vehicle Service History" : "Service Records Report";

  const csvColumns: CSVColumn<ReportServiceRecord>[] = [
    { header: "Job Number", value: (row) => invoiceNumberFor(row) },
    { header: "Customer", value: (row) => getProfile(row.user_id)?.full_name || "" },
    { header: "Vehicle", value: (row) => getVehicle(row.vehicle_id)?.registration_number || "" },
    { header: "Mileage", value: (row) => row.mileage ?? "" },
    { header: "Service Date", value: (row) => row.service_date },
    { header: "Technician", value: (row) => row.technician_name || "" },
    { header: "Services Performed", value: (row) => row.services_performed },
    { header: "Invoice Total", value: (row) => row.total_cost },
    { header: "Next Service Date", value: (row) => row.next_service_date || "" },
  ];

  return (
    <div>
      <ReportToolbar
        title={title}
        onBack={onBack}
        orientation={mode === "vehicle" ? "portrait" : "landscape"}
        filters={
          <>
            {mode === "vehicle" && (
              <select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="min-w-[220px] rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.registration_number} — {vehicle.brand} {vehicle.model}
                  </option>
                ))}
              </select>
            )}
            <select value={range} onChange={(event) => setRange(event.target.value as ReportDateRangeKey)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="this_year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
            {range === "custom" && (
              <>
                <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm" />
                <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm" />
              </>
            )}
          </>
        }
        csvButton={mode === "all" ? <CSVExportButton filename="ck-motors-service-records-report" rows={rows} columns={csvColumns} /> : undefined}
      />

      <ReportLayout title={title} periodLabel={periodLabel} orientation={mode === "vehicle" ? "portrait" : "landscape"}>
        {mode === "vehicle" && selectedVehicle && (
          <div className="mb-5 grid gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 sm:grid-cols-3">
            <div><p className="text-[9px] font-bold uppercase text-gray-500">Registration</p><p className="font-black">{selectedVehicle.registration_number}</p></div>
            <div><p className="text-[9px] font-bold uppercase text-gray-500">Owner</p><p className="font-black">{getProfile(selectedVehicle.user_id)?.full_name || "—"}</p></div>
            <div><p className="text-[9px] font-bold uppercase text-gray-500">Current Mileage</p><p className="font-black">{selectedVehicle.mileage?.toLocaleString() ?? "—"} km</p></div>
          </div>
        )}

        {mode === "all" && <ReportSummary cards={[{ label: "Total Service Records", value: rows.length }]} />}

        <PrintableTable
          rowKey={(row) => row.id}
          rows={rows}
          columns={
            mode === "vehicle"
              ? [
                  { header: "Service Date", render: (row) => row.service_date },
                  { header: "Mileage", align: "right", render: (row) => row.mileage?.toLocaleString() ?? "—" },
                  { header: "Job No.", render: (row) => invoiceNumberFor(row) },
                  { header: "Service", render: (row) => row.services_performed },
                  { header: "Technician", render: (row) => row.technician_name || "—" },
                  { header: "Invoice Total", align: "right", render: (row) => money(row.total_cost) },
                  { header: "Next Service", render: (row) => row.next_service_date || "—" },
                ]
              : [
                  { header: "Job No.", render: (row) => invoiceNumberFor(row) },
                  { header: "Customer", render: (row) => getProfile(row.user_id)?.full_name || "—" },
                  { header: "Vehicle", render: (row) => getVehicle(row.vehicle_id)?.registration_number || "—" },
                  { header: "Mileage", align: "right", render: (row) => row.mileage?.toLocaleString() ?? "—" },
                  { header: "Date", render: (row) => row.service_date },
                  { header: "Technician", render: (row) => row.technician_name || "—" },
                  { header: "Service Performed", render: (row) => row.services_performed },
                  { header: "Invoice Total", align: "right", render: (row) => money(row.total_cost) },
                  { header: "Next Service", render: (row) => row.next_service_date || "—" },
                ]
          }
        />
      </ReportLayout>
    </div>
  );
}
