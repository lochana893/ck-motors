"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { getOrCreateSessionId, getOrCreateVisitorId } from "@/lib/visitor-identity";

// Guards against duplicate inserts from React Strict Mode's dev-only double effect
// invocation and rapid re-renders that don't represent a real navigation.
const DUPLICATE_GUARD_MS = 2000;

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
