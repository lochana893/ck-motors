// Shared visitor/session identity helpers used by AnalyticsTracker and by the
// public contact-event tracker, so both write to the same first-party cookie
// and session id without duplicating the logic.

const VISITOR_COOKIE = "ck_motors_visitor_id";
const SESSION_STORAGE_KEY = "ck_motors_session";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // ~6 months
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function readCookie(name: string) {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function getOrCreateVisitorId() {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const value = crypto.randomUUID();
  writeCookie(VISITOR_COOKIE, value, VISITOR_COOKIE_MAX_AGE_SECONDS);
  return value;
}

export function getOrCreateSessionId() {
  const now = Date.now();
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { id: string; lastActivity: number };
      if (now - parsed.lastActivity < SESSION_IDLE_TIMEOUT_MS) {
        window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id: parsed.id, lastActivity: now }));
        return parsed.id;
      }
    }
  } catch {
    // fall through and create a new session below
  }
  const id = crypto.randomUUID();
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ id, lastActivity: now }));
  return id;
}
