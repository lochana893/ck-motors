"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function getOrCreateId(key: string) {
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const value = crypto.randomUUID();
  window.localStorage.setItem(key, value);
  return value;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    const visitorId = getOrCreateId("ck_motors_visitor_id");
    const sessionId = getOrCreateId("ck_motors_session_id");
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pagePath: pathname || "/",
        visitorId,
        sessionId,
        referrer: document.referrer || null,
      }),
    }).catch(() => undefined);
  }, [pathname]);

  return null;
}
