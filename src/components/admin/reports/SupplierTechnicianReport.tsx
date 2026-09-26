"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ReportToolbar from "@/components/reports/ReportToolbar";
import ReportLayout from "@/components/reports/ReportLayout";
import ReportSummary from "@/components/reports/ReportSummary";
import PrintableTable from "@/components/reports/PrintableTable";
import CSVExportButton from "@/components/reports/CSVExportButton";
import type { CSVColumn } from "@/lib/csv";
import type { ReportServiceRecord } from "./types";

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
};

export function SupplierListReport({ onBack }: { onBack: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const [supplierResult, partResult] = await Promise.all([
        supabase.from("suppliers").select("id, name, phone, email, address, is_active").order("name", { ascending: true }),
        supabase.from("inventory_parts").select("supplier_id").eq("is_active", true),
      ]);
      if (!active) return;
      setSuppliers((supplierResult.data || []) as Supplier[]);
      const counts: Record<string, number> = {};
      for (const row of (partResult.data || []) as { supplier_id: string | null }[]) {
        if (!row.supplier_id) continue;
        counts[row.supplier_id] = (counts[row.supplier_id] || 0) + 1;
      }
      setItemCounts(counts);
      setError(supplierResult.error?.message || "");
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const rows = suppliers.filter((supplier) => supplier.is_active);

  const csvColumns: CSVColumn<Supplier>[] = [
    { header: "Supplier Name", value: (row) => row.name },
    { header: "Phone", value: (row) => row.phone || "" },
    { header: "Email", value: (row) => row.email || "" },
    { header: "Address", value: (row) => row.address || "" },
    { header: "Items Supplied", value: (row) => itemCounts[row.id] || 0 },
  ];

  return (
    <div>
      <ReportToolbar title="Supplier Report" onBack={onBack} orientation="landscape" csvButton={<CSVExportButton filename="ck-motors-supplier-report" rows={rows} columns={csvColumns} />} />
      {loading ? (
        <p className="p-8 text-sm text-gray-500">Loading suppliers...</p>
      ) : error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">Unable to generate report. Please try again.</p>
      ) : (
        <ReportLayout title="Supplier Report" orientation="landscape">
          <ReportSummary cards={[{ label: "Total Suppliers", value: rows.length }]} />
          <PrintableTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { header: "Supplier Name", render: (row) => row.name },
              { header: "Phone", render: (row) => row.phone || "—" },
              { header: "Email", render: (row) => row.email || "—" },
              { header: "Address", render: (row) => row.address || "—" },
              { header: "Items Supplied", align: "center", render: (row) => itemCounts[row.id] || 0 },
            ]}
          />
        </ReportLayout>
      )}
    </div>
  );
}

type Technician = {
  id: string;
  full_name: string;
  phone: string | null;
  specialization: string | null;
  status: "available" | "busy" | "inactive";
};

export function TechnicianReportView({ records, onBack }: { records: ReportServiceRecord[]; onBack: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase.from("technicians").select("id, full_name, phone, specialization, status").order("full_name", { ascending: true });
      if (!active) return;
      setTechnicians((data || []) as Technician[]);
      setError(loadError?.message || "");
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const jobsFor = (name: string) => records.filter((record) => record.technician_name === name);

  const csvColumns: CSVColumn<Technician>[] = [
    { header: "Technician", value: (row) => row.full_name },
    { header: "Phone", value: (row) => row.phone || "" },
    { header: "Specialization", value: (row) => row.specialization || "" },
    { header: "Status", value: (row) => row.status },
    { header: "Completed Jobs", value: (row) => jobsFor(row.full_name).length },
  ];

  return (
    <div>
      <ReportToolbar title="Technician Report" onBack={onBack} orientation="landscape" csvButton={<CSVExportButton filename="ck-motors-technician-report" rows={technicians} columns={csvColumns} />} />
      {loading ? (
        <p className="p-8 text-sm text-gray-500">Loading technicians...</p>
      ) : error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">Unable to generate report. Please try again.</p>
      ) : (
        <ReportLayout title="Technician Report" orientation="landscape">
          <ReportSummary cards={[{ label: "Total Technicians", value: technicians.length }]} />
          <PrintableTable
            rowKey={(row) => row.id}
            rows={technicians}
            columns={[
              { header: "Technician", render: (row) => row.full_name },
              { header: "Phone", render: (row) => row.phone || "—" },
              { header: "Specialization", render: (row) => row.specialization || "—" },
              { header: "Status", render: (row) => row.status },
              { header: "Completed Jobs", align: "center", render: (row) => jobsFor(row.full_name).length },
            ]}
          />
        </ReportLayout>
      )}
    </div>
  );
}
