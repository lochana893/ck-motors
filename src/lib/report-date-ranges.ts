// Shared date-range helpers for admin report filters.
// Kept independent from VisitorAnalyticsSection's local range helpers so
// existing, already-verified analytics code is left untouched.

export type ReportDateRangeKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "this_year"
  | "custom"
  | "all";

export const REPORT_DATE_RANGE_OPTIONS: { value: ReportDateRangeKey; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
  { value: "all", label: "All Time" },
];

function startOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfDay(date: Date) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

export function resolveReportDateRange(
  key: ReportDateRangeKey,
  customStart: string,
  customEnd: string,
  now: Date = new Date()
): { start: Date | null; end: Date | null } {
  switch (key) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    case "this_week": {
      const start = new Date(now);
      const day = start.getDay();
      const diff = (day + 6) % 7; // week starts Monday
      start.setDate(start.getDate() - diff);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: startOfDay(start), end: endOfDay(end) };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { start: startOfDay(start), end: endOfDay(now) };
    }
    case "custom": {
      const start = customStart ? startOfDay(new Date(customStart)) : null;
      const end = customEnd ? endOfDay(new Date(customEnd)) : null;
      return { start, end };
    }
    case "all":
    default:
      return { start: null, end: null };
  }
}

export function formatReportPeriodLabel(
  key: ReportDateRangeKey,
  customStart: string,
  customEnd: string,
  now: Date = new Date()
) {
  const { start, end } = resolveReportDateRange(key, customStart, customEnd, now);
  if (!start && !end) return "All Time";
  const fmt = (date: Date) =>
    new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "long", year: "numeric" }).format(date);
  if (start && end) return `${fmt(start)} - ${fmt(end)}`;
  if (start) return `From ${fmt(start)}`;
  if (end) return `Up to ${fmt(end)}`;
  return "All Time";
}
