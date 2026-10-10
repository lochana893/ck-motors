"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { LOGIN_SESSION_STORAGE_KEY } from "@/lib/login-session-client";

const HEARTBEAT_INTERVAL_MS = 60_000;

function getSessionKey(forceNew = false) {
  try {
    const current = forceNew ? null : window.sessionStorage.getItem(LOGIN_SESSION_STORAGE_KEY);
    if (current) return current;
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(LOGIN_SESSION_STORAGE_KEY, created);
    return created;
  } catch (error) {
    console.warn("Login session key could not be stored for this browser tab.", error);
    return null;
  }
}

export default function SessionHeartbeat() {
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let authenticated = false;
    let heartbeatInFlight = false;

    async function heartbeat() {
      if (!active || !authenticated || heartbeatInFlight) return;
      const sessionKey = getSessionKey();
      if (!sessionKey) return;

      heartbeatInFlight = true;
      try {
        const response = await fetch("/api/security/session-heartbeat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_key: sessionKey }),
          keepalive: true,
        });
        if (response.status === 409 && active && authenticated) {
          const replacementKey = getSessionKey(true);
          if (replacementKey) {
            const retry = await fetch("/api/security/session-heartbeat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ session_key: replacementKey }),
              keepalive: true,
            });
            if (!retry.ok && retry.status !== 401) {
              console.warn("Login session heartbeat retry was rejected.", { status: retry.status });
            }
          }
        } else if (!response.ok && response.status !== 401) {
          console.warn("Login session heartbeat was rejected.", { status: response.status });
        }
      } catch (error) {
        console.warn("Login session heartbeat failed.", error);
      } finally {
        heartbeatInFlight = false;
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authenticated = Boolean(session?.user && event !== "SIGNED_OUT");
      if (authenticated && active) {
        window.setTimeout(() => void heartbeat(), 0);
      }
    });

    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        console.warn("Login session state could not be checked.", error.message);
        return;
      }
      authenticated = Boolean(data.user);
      if (authenticated) void heartbeat();
    });

    const interval = window.setInterval(() => void heartbeat(), HEARTBEAT_INTERVAL_MS);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void heartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
