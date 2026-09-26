"use client";

import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import PrintButton from "./PrintButton";

// Screen-only toolbar (hidden on print via .no-print). Combines the back
// button, arbitrary filter controls, and Print/CSV actions.
export default function ReportToolbar({
  title,
  onBack,
  filters,
  csvButton,
  printLabel,
  orientation = "portrait",
}: {
  title: string;
  onBack: () => void;
  filters?: ReactNode;
  csvButton?: ReactNode;
  printLabel?: string;
  orientation?: "portrait" | "landscape";
}) {
  return (
    <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#111] p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-gray-300 hover:bg-white/10"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <h2 className="text-lg font-black">{title}</h2>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {filters}
        {csvButton}
        <PrintButton label={printLabel} orientation={orientation} />
      </div>
    </div>
  );
}
