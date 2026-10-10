import type { SupabaseClient } from "@supabase/supabase-js";

type LoginActivityInsert = {
  user_id: string | null;
  email: string | null;
  role: "admin" | "staff" | "customer" | null;
  role_at_login: "admin" | "staff" | "customer" | null;
  login_method: "email" | "phone";
  ip_address: string | null;
  user_agent: string | null;
  device_type: string;
  browser: string;
  operating_system: string;
  country: string | null;
  region: string | null;
  city: string | null;
  session_id: null;
  login_status: "success" | "failed";
};

export async function insertLoginActivity(
  client: SupabaseClient,
  activity: LoginActivityInsert,
) {
  const variants: Record<string, unknown>[] = [
    activity,
    withoutFields(activity, ["login_method"]),
    withoutFields(activity, ["role_at_login"]),
    withoutFields(activity, ["role"]),
    withoutFields(activity, ["login_method", "role_at_login"]),
    withoutFields(activity, ["login_method", "role"]),
    withoutFields(activity, ["role_at_login", "role"]),
    withoutFields(activity, ["login_method", "role_at_login", "role"]),
  ];

  for (const candidate of variants) {
    const { error } = await client.from("login_activity").insert(candidate);
    if (!error) return null;
    if (error.code !== "42703") return error;
  }

  return new Error("Login activity schema is missing required fields.");
}

function withoutFields(
  activity: LoginActivityInsert,
  fields: ("login_method" | "role_at_login" | "role")[],
) {
  const candidate: Record<string, unknown> = { ...activity };
  for (const field of fields) delete candidate[field];
  return candidate;
}
