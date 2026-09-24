import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isProtectedOwnerEmail } from "@/lib/protected-owner";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const ROLES = ["admin", "staff", "customer"] as const;
const STATUSES = ["active", "disabled"] as const;
type Role = (typeof ROLES)[number];
type Status = (typeof STATUSES)[number];

function temporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

async function getAdminContext() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const adminClient = getSupabaseAdminClient();
  if (!adminClient || !url || !anonKey) {
    return { error: "Admin user management requires server-side Supabase configuration.", status: 503 as const };
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(url, anonKey, {
    cookies: { getAll: () => cookieStore.getAll(), setAll() {} },
  });
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return { error: "You must be signed in.", status: 401 as const };

  const { data: profile, error } = await adminClient
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .single();
  if (error || profile?.role !== "admin" || profile.status !== "active") {
    return { error: "Only active administrators can manage users.", status: 403 as const };
  }
  return { adminClient, user };
}

function invalidRole(role: unknown): role is Role {
  return typeof role !== "string" || !ROLES.includes(role as Role);
}

function invalidStatus(status: unknown): status is Status {
  return typeof status !== "string" || !STATUSES.includes(status as Status);
}

async function hasRelatedData(client: SupabaseClient, userId: string) {
  const checks = await Promise.all([
    client.from("vehicles").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("bookings").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("service_records").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("message_recipients").select("id", { count: "exact", head: true }).eq("user_id", userId),
    client.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  const failed = checks.find((result) => result.error);
  if (failed?.error) throw new Error(`Related account data could not be checked: ${failed.error.message}`);
  return checks.some((result) => (result.count || 0) > 0);
}

export async function GET() {
  const context = await getAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  const { data, error } = await context.adminClient
    .from("profiles")
    .select("id, full_name, email, phone, role, status, must_change_password, created_at")
    .in("role", ROLES)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ users: data || [] });
}

export async function POST(request: Request) {
  const context = await getAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  const body = (await request.json()) as { full_name?: string; email?: string; phone?: string; role?: Role };
  const fullName = body.full_name?.trim();
  const email = body.email?.trim().toLowerCase();
  const role = body.role || "customer";
  if (!fullName || !email || invalidRole(role)) {
    return NextResponse.json({ error: "Full name, email and a valid role are required." }, { status: 400 });
  }
  if (isProtectedOwnerEmail(email)) {
    return NextResponse.json({ error: "The primary CK Motors owner account already exists and cannot be recreated." }, { status: 409 });
  }
  const password = temporaryPassword();
  const { data, error } = await context.adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: body.phone?.trim() || null },
  });
  if (error || !data.user) return NextResponse.json({ error: error?.message || "Auth account could not be created." }, { status: 400 });
  const { error: profileError } = await context.adminClient.from("profiles").upsert({
    id: data.user.id,
    full_name: fullName,
    email,
    phone: body.phone?.trim() || null,
    role,
    status: "active",
    must_change_password: true,
  }, { onConflict: "id" });
  if (profileError) {
    await context.adminClient.auth.admin.deleteUser(data.user.id);
    return NextResponse.json({ error: `Profile could not be created: ${profileError.message}` }, { status: 400 });
  }
  return NextResponse.json({ user: { id: data.user.id, full_name: fullName, email, phone: body.phone?.trim() || null, role, status: "active", must_change_password: true }, temporaryPassword }, { status: 201 });
}

export async function PATCH(request: Request) {
  const context = await getAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  const body = (await request.json()) as { id?: string; action?: "update" | "reset"; full_name?: string; phone?: string; role?: Role; status?: Status };
  if (!body.id) return NextResponse.json({ error: "A user ID is required." }, { status: 400 });
  const { data: target, error: targetError } = await context.adminClient.from("profiles").select("id, full_name, email, phone, role, status, must_change_password").eq("id", body.id).single();
  if (targetError || !target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const { data: authTarget } = await context.adminClient.auth.admin.getUserById(target.id);
  const protectedOwner = isProtectedOwnerEmail(target.email) || isProtectedOwnerEmail(authTarget.user?.email);

  if (body.action === "reset") {
    const password = temporaryPassword();
    const { error } = await context.adminClient.auth.admin.updateUserById(target.id, { password });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const { error: profileError } = await context.adminClient.from("profiles").update({ must_change_password: true }).eq("id", target.id);
    if (profileError) return NextResponse.json({ error: `Password reset, but the one-time flag could not be set: ${profileError.message}` }, { status: 400 });
    return NextResponse.json({ user: target, temporaryPassword: password });
  }

  const nextRole = body.role || target.role;
  const nextStatus = body.status || target.status;
  if (invalidRole(nextRole) || invalidStatus(nextStatus)) return NextResponse.json({ error: "Invalid role or status." }, { status: 400 });
  if (protectedOwner && nextRole !== "admin") {
    return NextResponse.json({ error: "The primary owner account role cannot be changed." }, { status: 409 });
  }
  if (protectedOwner && nextStatus !== "active") {
    return NextResponse.json({ error: "The primary owner account cannot be deactivated." }, { status: 409 });
  }
  if (target.id === context.user.id && (nextRole !== "admin" || nextStatus !== "active")) {
    return NextResponse.json({ error: "You cannot remove your own active administrator access." }, { status: 409 });
  }
  if (target.role === "admin" && (nextRole !== "admin" || nextStatus !== "active")) {
    const { count, error } = await context.adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("status", "active");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if ((count || 0) <= 1) return NextResponse.json({ error: "At least one active administrator must remain." }, { status: 409 });
  }
  const { data, error } = await context.adminClient.from("profiles").update({
    full_name: body.full_name?.trim() || target.full_name,
    phone: body.phone?.trim() || null,
    role: nextRole,
    status: nextStatus,
  }).eq("id", target.id).select("id, full_name, email, phone, role, status, must_change_password, created_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ user: data });
}

export async function DELETE(request: Request) {
  const context = await getAdminContext();
  if ("error" in context) return NextResponse.json({ error: context.error }, { status: context.status });
  const body = (await request.json()) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "A user ID is required." }, { status: 400 });
  const { data: target, error: targetError } = await context.adminClient.from("profiles").select("id, email, role, status, full_name").eq("id", body.id).single();
  if (targetError || !target) return NextResponse.json({ error: "User not found." }, { status: 404 });
  const { data: authTarget } = await context.adminClient.auth.admin.getUserById(target.id);
  if (isProtectedOwnerEmail(target.email) || isProtectedOwnerEmail(authTarget.user?.email)) {
    return NextResponse.json({ error: "The primary CK Motors owner account cannot be deleted." }, { status: 409 });
  }
  if (body.id === context.user.id) return NextResponse.json({ error: "You cannot delete your own administrator account." }, { status: 409 });
  if (target.role === "admin" && target.status === "active") {
    const { count, error } = await context.adminClient.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin").eq("status", "active");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if ((count || 0) <= 1) return NextResponse.json({ error: "The last active administrator cannot be deleted." }, { status: 409 });
  }
  if (await hasRelatedData(context.adminClient, target.id)) {
    return NextResponse.json({ error: "This account has vehicles, bookings, service history, messages, or notifications. Deactivate it instead of deleting it." }, { status: 409 });
  }
  const { error } = await context.adminClient.auth.admin.deleteUser(target.id);
  if (error) return NextResponse.json({ error: `Auth account could not be deleted: ${error.message}` }, { status: 400 });
  return NextResponse.json({ success: true });
}
