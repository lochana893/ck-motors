"use client";

// Lightweight, fire-and-forget tracking for public Service Contact popup
// interactions. Reuses the existing /api/analytics endpoint and the same
// first-party visitor/session identifiers as AnalyticsTracker, so this does
// not create a second analytics system. Never blocks or throws for the
// caller; a failed analytics call must never interrupt a customer action.

import { getOrCreateSessionId, getOrCreateVisitorId } from "@/lib/visitor-identity";

export type PublicContactEventType =
  | "service_price_opened"
  | "service_phone_clicked"
  | "service_whatsapp_clicked"
  | "service_book_clicked"
  | "service_directions_clicked"
  | "service_shared"
  | "callback_requested";

export function trackPublicEvent(
  eventType: PublicContactEventType,
  details?: { serviceId?: string | null; serviceName?: string | null },
) {
  try {
    const visitorId = getOrCreateVisitorId();
    const sessionId = getOrCreateSessionId();
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pagePath: window.location.pathname || "/",
        visitorId,
        sessionId,
        eventType,
        serviceId: details?.serviceId || null,
        serviceName: details?.serviceName || null,
      }),
    }).catch(() => undefined);
  } catch {
    // Analytics must never block or break a customer-facing action.
  }
}
