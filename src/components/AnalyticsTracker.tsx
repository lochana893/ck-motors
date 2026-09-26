"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const VISITOR_COOKIE = "ck_motors_visitor_id";
const SESSION_STORAGE_KEY = "ck_motors_session";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180; // ~6 months
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
// Guards against duplicate inserts from React Strict Mode's dev-only double effect
// invocation and rapid re-renders that don't represent a real navigation.
const DUPLICATE_GUARD_MS = 2000;

function readCookie(name: string) {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

function getOrCreateVisitorId() {
  const existing = readCookie(VISITOR_COOKIE);
  if (existing) return existing;
  const value = crypto.randomUUID();
  writeCookie(VISITOR_COOKIE, value, VISITOR_COOKIE_MAX_AGE_SECONDS);
  return value;
}

function getOrCreateSessionId() {
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

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastTrackedRef = useRef<{ path: string; at: number } | null>(null);

  useEffect(() => {
    const path = pathname || "/";
    const last = lastTrackedRef.current;
    if (last && last.path === path && Date.now() - last.at < DUPLICATE_GUARD_MS) {
      return;
    }
    lastTrackedRef.current = { path, at: Date.now() };

    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pagePath: path,
        visitorId,
        sessionId,
        referrer: document.referrer || null,
      }),
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
