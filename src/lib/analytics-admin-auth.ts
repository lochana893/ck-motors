import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type AnalyticsAdminContext =
  | { admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>; user: User }
  | { error: string; status: 401 | 403 | 503 };

export async function getAnalyticsAdminContext(): Promise<AnalyticsAdminContext> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const admin = getSupabaseAdminClient();
  if (!url || !anonKey || !admin) {
    return { error: "Server-side analytics access is not configured.", status: 503 };
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll() {} },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) {
    return { error: "You must be signed in to view analytics.", status: 401 };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    console.error("Analytics administrator check failed:", profileError.message);
    return { error: "Analytics permissions could not be verified.", status: 503 };
  }
  if (profile?.role !== "admin" || profile.status !== "active") {
    return { error: "Only active administrators can view analytics.", status: 403 };
  }

  return { admin, user };
}
