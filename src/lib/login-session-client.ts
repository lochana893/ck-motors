import type { SupabaseClient } from "@supabase/supabase-js";

export const LOGIN_SESSION_STORAGE_KEY = "ck_motors_login_session_key";

export async function signOutAndEndLoginSession(supabase: SupabaseClient) {
  try {
    const sessionKey = window.sessionStorage.getItem(LOGIN_SESSION_STORAGE_KEY);
    if (sessionKey) {
      const response = await fetch("/api/security/session-heartbeat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_key: sessionKey }),
        keepalive: true,
      });
      if (!response.ok) {
        console.warn("Login session could not be ended before sign-out.");
      }
    }
  } catch (error) {
    console.warn("Login session cleanup failed before sign-out.", error);
  } finally {
    try {
      window.sessionStorage.removeItem(LOGIN_SESSION_STORAGE_KEY);
    } catch (error) {
      console.warn("Login session key could not be cleared.", error);
    }
  }

  await supabase.auth.signOut();
}
