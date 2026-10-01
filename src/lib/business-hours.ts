// Shared workshop-hours formatting used by the public Service Contact popup.
// Always evaluated in the Asia/Colombo timezone so the "open/closed" status is
// correct for CK Motors regardless of the visitor's own device timezone.

export type BusinessHoursRow = {
  day_of_week: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
};

export type WorkshopStatus = {
  isOpen: boolean;
  label: string;
  detail: string | null;
};

const TIMEZONE = "Asia/Colombo";
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getColomboParts(date: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const map = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    dayOfWeek: WEEKDAYS_SHORT.indexOf(map.weekday),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    dateKey: `${map.year}-${map.month}-${map.day}`,
  };
}

function toMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + (minutes || 0);
}

function formatTime12h(time: string) {
  const [hoursRaw, minutesRaw] = time.split(":").map(Number);
  const period = hoursRaw >= 12 ? "PM" : "AM";
  const hour = hoursRaw % 12 === 0 ? 12 : hoursRaw % 12;
  return `${hour}:${String(minutesRaw || 0).padStart(2, "0")} ${period}`;
}

/**
 * Computes a human-readable open/closed status for the workshop using the
 * existing business_hours rows and blocked_booking_dates, in Asia/Colombo time.
 * Returns null when no business-hours rows are configured, so callers can fall
 * back to the free-text `opening_hours` website setting instead.
 */
export function getWorkshopStatus(
  hours: BusinessHoursRow[],
  blockedDates: string[],
  referenceDate: Date = new Date(),
): WorkshopStatus | null {
  if (!hours.length) return null;

  const now = getColomboParts(referenceDate);
  const nowMinutes = now.hour * 60 + now.minute;
  const todayHours = hours.find((row) => row.day_of_week === now.dayOfWeek);
  const isTodayBlocked = blockedDates.includes(now.dateKey);

  if (todayHours && todayHours.is_open && !isTodayBlocked) {
    const opensAt = toMinutes(todayHours.opens_at);
    const closesAt = toMinutes(todayHours.closes_at);
    if (nowMinutes >= opensAt && nowMinutes < closesAt) {
      return { isOpen: true, label: "Open now", detail: `Closes at ${formatTime12h(todayHours.closes_at)}` };
    }
    if (nowMinutes < opensAt) {
      return { isOpen: false, label: "Closed now", detail: `Opens today at ${formatTime12h(todayHours.opens_at)}` };
    }
  }

  for (let offset = 1; offset <= 7; offset += 1) {
    const candidateDate = new Date(referenceDate.getTime() + offset * 86_400_000);
    const candidateParts = getColomboParts(candidateDate);
    const candidate = hours.find((row) => row.day_of_week === candidateParts.dayOfWeek);
    if (!candidate || !candidate.is_open || blockedDates.includes(candidateParts.dateKey)) continue;
    const dayLabel = offset === 1
      ? "tomorrow"
      : new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: TIMEZONE }).format(candidateDate);
    return { isOpen: false, label: "Closed now", detail: `Opens ${dayLabel} at ${formatTime12h(candidate.opens_at)}` };
  }

  return { isOpen: false, label: "Closed now", detail: null };
}

/** Formats a minutes duration like "1 hour 30 minutes" for display. Returns null for empty/zero values. */
export function formatDurationMinutes(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 0) return `${remainder} minutes`;
  if (remainder === 0) return `${hours} hour${hours > 1 ? "s" : ""}`;
  return `${hours} hour${hours > 1 ? "s" : ""} ${remainder} minutes`;
}
