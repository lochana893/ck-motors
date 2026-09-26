"use client";

import { Download } from "lucide-react";
import { downloadCSV, type CSVColumn } from "@/lib/csv";

export default function CSVExportButton<T>({
  filename,
  rows,
  columns,
}: {
  filename: string;
  rows: T[];
  columns: CSVColumn<T>[];
}) {
  return (
    <button
      type="button"
      onClick={() => downloadCSV(filename, rows, columns)}
      disabled={rows.length === 0}
      className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/10 bg-[#111] px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Download size={16} />
      Export CSV
    </button>
  );
}
