"use client";

import { REPORT_DATE_RANGE_OPTIONS, type ReportDateRangeKey } from "@/lib/report-date-ranges";

export default function DateRangeFilter({
  value,
  onChange,
  customStart,
  customEnd,
  onCustomChange,
}: {
  value: ReportDateRangeKey;
  onChange: (value: ReportDateRangeKey) => void;
  customStart: string;
  customEnd: string;
  onCustomChange: (start: string, end: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as ReportDateRangeKey)}
        className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
      >
        {REPORT_DATE_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {value === "custom" && (
        <>
          <input
            type="date"
            value={customStart}
            onChange={(event) => onCustomChange(event.target.value, customEnd)}
            className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
          />
          <span className="text-xs text-gray-500">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(event) => onCustomChange(customStart, event.target.value)}
            className="rounded-lg border border-white/10 bg-[#111] px-3 py-2 text-sm"
          />
        </>
      )}
    </div>
  );
}
