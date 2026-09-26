"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ReportToolbar from "@/components/reports/ReportToolbar";
import ReportLayout from "@/components/reports/ReportLayout";
import ReportSummary from "@/components/reports/ReportSummary";
import PrintableTable from "@/components/reports/PrintableTable";
import CSVExportButton from "@/components/reports/CSVExportButton";
import { resolveReportDateRange, formatReportPeriodLabel, type ReportDateRangeKey } from "@/lib/report-date-ranges";
import type { CSVColumn } from "@/lib/csv";

type InventoryPart = {
  id: string;
  part_name: string;
  sku: string | null;
  quantity_in_stock: number;
  minimum_stock_level: number;
  purchase_price: number | null;
  selling_price: number | null;
  is_active: boolean;
  category: { name: string } | null;
  supplier: { name: string } | null;
};

function money(value: number) {
  return `LKR ${Number(value || 0).toLocaleString()}`;
}

function useInventoryParts() {
  const supabase = useMemo(() => createClient(), []);
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("inventory_parts")
        .select(
          `id, part_name, sku, quantity_in_stock, minimum_stock_level, purchase_price, selling_price, is_active,
           category:inventory_categories ( name ), supplier:suppliers ( name )`
        )
        .order("part_name", { ascending: true });
      if (!active) return;
      setParts(((data || []) as unknown as InventoryPart[]));
      setError(loadError?.message || "");
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  return { parts, loading, error };
}

function stockStatus(part: InventoryPart) {
  if (part.quantity_in_stock <= 0) return "OUT OF STOCK";
  if (part.quantity_in_stock <= part.minimum_stock_level) return "LOW STOCK";
  return "IN STOCK";
}

export function InventoryReport({ onBack }: { onBack: () => void }) {
  const { parts, loading, error } = useInventoryParts();
  const [search, setSearch] = useState("");

  const rows = parts
    .filter((part) => part.is_active)
    .filter((part) => !search.trim() || [part.part_name, part.sku].filter(Boolean).join(" ").toLowerCase().includes(search.toLowerCase()));

  const csvColumns: CSVColumn<InventoryPart>[] = [
    { header: "SKU", value: (row) => row.sku || "" },
    { header: "Part Name", value: (row) => row.part_name },
    { header: "Category", value: (row) => row.category?.name || "" },
    { header: "Supplier", value: (row) => row.supplier?.name || "" },
    { header: "Current Stock", value: (row) => row.quantity_in_stock },
    { header: "Minimum Stock", value: (row) => row.minimum_stock_level },
    { header: "Purchase Price", value: (row) => row.purchase_price || 0 },
    { header: "Selling Price", value: (row) => row.selling_price || 0 },
    { header: "Status", value: (row) => stockStatus(row) },
  ];

  const totalCostValue = rows.reduce((sum, part) => sum + Number(part.purchase_price || 0) * part.quantity_in_stock, 0);
  const totalSellingValue = rows.reduce((sum, part) => sum + Number(part.selling_price || 0) * part.quantity_in_stock, 0);

  return (
    <div>
      <ReportToolbar
        title="Inventory Report"
        onBack={onBack}
        orientation="landscape"
        filters={<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search part or SKU..." className="min-w-[200px] rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm" />}
        csvButton={<CSVExportButton filename="ck-motors-inventory-report" rows={rows} columns={csvColumns} />}
      />
      {loading ? (
        <p className="p-8 text-sm text-gray-500">Loading inventory...</p>
      ) : error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">Unable to generate report. Please try again.</p>
      ) : (
        <ReportLayout title="Inventory Report" orientation="landscape">
          <ReportSummary
            cards={[
              { label: "Total Items", value: rows.length },
              { label: "Low Stock", value: rows.filter((part) => stockStatus(part) === "LOW STOCK").length },
              { label: "Out of Stock", value: rows.filter((part) => stockStatus(part) === "OUT OF STOCK").length },
              { label: "Total Units", value: rows.reduce((sum, part) => sum + part.quantity_in_stock, 0) },
              { label: "Total Cost Value", value: money(totalCostValue) },
              { label: "Total Selling Value", value: money(totalSellingValue) },
            ]}
          />
          <PrintableTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { header: "SKU", render: (row) => row.sku || "—" },
              { header: "Part Name", render: (row) => row.part_name },
              { header: "Category", render: (row) => row.category?.name || "—" },
              { header: "Supplier", render: (row) => row.supplier?.name || "—" },
              { header: "Stock", align: "center", render: (row) => row.quantity_in_stock },
              { header: "Min", align: "center", render: (row) => row.minimum_stock_level },
              { header: "Purchase Price", align: "right", render: (row) => money(row.purchase_price || 0) },
              { header: "Selling Price", align: "right", render: (row) => money(row.selling_price || 0) },
              { header: "Status", render: (row) => stockStatus(row) },
            ]}
          />
        </ReportLayout>
      )}
    </div>
  );
}

export function LowStockReport({ onBack }: { onBack: () => void }) {
  const { parts, loading, error } = useInventoryParts();
  const rows = parts.filter((part) => part.is_active && stockStatus(part) !== "IN STOCK");

  const csvColumns: CSVColumn<InventoryPart>[] = [
    { header: "Part Name", value: (row) => row.part_name },
    { header: "SKU", value: (row) => row.sku || "" },
    { header: "Supplier", value: (row) => row.supplier?.name || "" },
    { header: "Current Stock", value: (row) => row.quantity_in_stock },
    { header: "Minimum Stock", value: (row) => row.minimum_stock_level },
    { header: "Status", value: (row) => stockStatus(row) },
  ];

  return (
    <div>
      <ReportToolbar title="Low Stock Report" onBack={onBack} orientation="portrait" csvButton={<CSVExportButton filename="ck-motors-low-stock-report" rows={rows} columns={csvColumns} />} />
      {loading ? (
        <p className="p-8 text-sm text-gray-500">Loading inventory...</p>
      ) : error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">Unable to generate report. Please try again.</p>
      ) : (
        <ReportLayout title="Low Stock Report" orientation="portrait">
          <ReportSummary cards={[{ label: "Low Stock Items", value: rows.length }]} />
          <PrintableTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { header: "Part Name", render: (row) => row.part_name },
              { header: "SKU", render: (row) => row.sku || "—" },
              { header: "Supplier", render: (row) => row.supplier?.name || "—" },
              { header: "Current Stock", align: "center", render: (row) => row.quantity_in_stock },
              { header: "Minimum Stock", align: "center", render: (row) => row.minimum_stock_level },
              { header: "Status", render: (row) => stockStatus(row) },
            ]}
          />
        </ReportLayout>
      )}
    </div>
  );
}

type StockMovement = {
  id: string;
  inventory_part_id: string;
  movement_type: string;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  notes: string | null;
  created_at: string;
};

const MOVEMENT_LABELS: Record<string, string> = {
  stock_in: "Stock In",
  service_usage: "Service Usage",
  manual_stock_out: "Manual Stock Out",
  adjustment: "Adjustment",
  return: "Return",
};

export function StockMovementReport({ onBack }: { onBack: () => void }) {
  const supabase = useMemo(() => createClient(), []);
  const { parts } = useInventoryParts();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [range, setRange] = useState<ReportDateRangeKey>("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const { data, error: loadError } = await supabase
        .from("stock_movements")
        .select("id, inventory_part_id, movement_type, quantity, quantity_before, quantity_after, notes, created_at")
        .order("created_at", { ascending: false })
        .range(0, 499);
      if (!active) return;
      setMovements((data || []) as StockMovement[]);
      setError(loadError?.message || "");
      setLoading(false);
    }
    void load();
    return () => {
      active = false;
    };
  }, [supabase]);

  const getPart = (id: string) => parts.find((part) => part.id === id);

  const rows = useMemo(() => {
    const { start, end } = resolveReportDateRange(range, customStart, customEnd);
    return movements.filter((movement) => {
      const date = new Date(movement.created_at);
      if (start && date < start) return false;
      if (end && date > end) return false;
      if (typeFilter !== "all" && movement.movement_type !== typeFilter) return false;
      return true;
    });
  }, [movements, range, customStart, customEnd, typeFilter]);

  const periodLabel = formatReportPeriodLabel(range, customStart, customEnd);

  const csvColumns: CSVColumn<StockMovement>[] = [
    { header: "Date", value: (row) => new Date(row.created_at).toLocaleString() },
    { header: "Item", value: (row) => getPart(row.inventory_part_id)?.part_name || "" },
    { header: "Movement Type", value: (row) => MOVEMENT_LABELS[row.movement_type] || row.movement_type },
    { header: "Quantity", value: (row) => row.quantity },
    { header: "Previous Stock", value: (row) => row.quantity_before },
    { header: "New Stock", value: (row) => row.quantity_after },
    { header: "Notes", value: (row) => row.notes || "" },
  ];

  return (
    <div>
      <ReportToolbar
        title="Stock Movement Report"
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
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm">
              <option value="all">All Types</option>
              {Object.entries(MOVEMENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </>
        }
        csvButton={<CSVExportButton filename="ck-motors-stock-movement-report" rows={rows} columns={csvColumns} />}
      />
      {loading ? (
        <p className="p-8 text-sm text-gray-500">Loading stock movement...</p>
      ) : error ? (
        <p className="rounded-lg border border-red-900/60 bg-red-950/30 p-4 text-xs text-red-300">Unable to generate report. Please try again.</p>
      ) : (
        <ReportLayout title="Stock Movement Report" periodLabel={periodLabel} orientation="landscape">
          <ReportSummary cards={[{ label: "Total Movements", value: rows.length }]} />
          <PrintableTable
            rowKey={(row) => row.id}
            rows={rows}
            columns={[
              { header: "Date", render: (row) => new Date(row.created_at).toLocaleString() },
              { header: "Item", render: (row) => getPart(row.inventory_part_id)?.part_name || "—" },
              { header: "Movement Type", render: (row) => MOVEMENT_LABELS[row.movement_type] || row.movement_type },
              { header: "Qty", align: "center", render: (row) => row.quantity },
              { header: "Previous Stock", align: "center", render: (row) => row.quantity_before },
              { header: "New Stock", align: "center", render: (row) => row.quantity_after },
              { header: "Notes", render: (row) => row.notes || "—" },
            ]}
          />
        </ReportLayout>
      )}
    </div>
  );
}
