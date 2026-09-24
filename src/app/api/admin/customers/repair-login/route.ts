import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

function generateTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => alphabet.charAt(byte % alphabet.length)).join("");
}

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Customer login repair requires server configuration." },
      { status: 503 },
    );
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll() {} } },
  );
  const {
    data: { user: requestingUser },
  } = await authClient.auth.getUser();

  if (!requestingUser) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { data: adminProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", requestingUser.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can repair customer logins." }, { status: 403 });
  }

  const body = (await request.json()) as { profileId?: string };
  if (!body.profileId) {
    return NextResponse.json({ error: "A customer profile is required." }, { status: 400 });
  }

  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, email, role, status")
    .eq("id", body.profileId)
    .eq("role", "customer")
    .single();

  if (profileError || !profile) {
    return NextResponse.json({ error: "Customer profile could not be found." }, { status: 404 });
  }

  const { data: authUser, error: authLookupError } = await adminClient.auth.admin.getUserById(profile.id);
  let matchingAuthUser = authUser.user || null;

  if (authLookupError || !matchingAuthUser) {
    const { data: usersPage, error: usersError } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (usersError) {
      return NextResponse.json({ error: `Auth account could not be checked: ${usersError.message}` }, { status: 400 });
    }
    matchingAuthUser = usersPage.users.find(
      (user) => user.email?.trim().toLowerCase() === profile.email.trim().toLowerCase(),
    ) || null;
  }

  if (!matchingAuthUser) {
    return NextResponse.json(
      {
        error:
          "No Supabase Auth user exists for this profile. The profile ID is referenced by existing customer history, so creating a new Auth ID would orphan that history. Do not repair this account automatically; review the Auth/profile conflict first.",
        conflict: "missing-auth-user",
      },
      { status: 409 },
    );
  }

  if (matchingAuthUser.id !== profile.id) {
    return NextResponse.json(
      {
        error:
          "A Supabase Auth user exists for this email, but its ID does not match the profile ID used by customer history. No changes were made because relinking would risk orphaning vehicles, bookings, service records, invoices, messages, or notifications.",
        conflict: "id-mismatch",
      },
      { status: 409 },
    );
  }

  const temporaryPassword = generateTemporaryPassword();
  const { error: passwordError } = await adminClient.auth.admin.updateUserById(
    matchingAuthUser.id,
    { password: temporaryPassword },
  );
  if (passwordError) {
    return NextResponse.json({ error: `Customer password could not be reset: ${passwordError.message}` }, { status: 400 });
  }

  const { error: profileUpdateError } = await adminClient
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", profile.id);

  if (profileUpdateError) {
    return NextResponse.json(
      { error: `Password reset, but the first-login flag could not be set: ${profileUpdateError.message}` },
      { status: 400 },
    );
  }

  return NextResponse.json({
    success: true,
    customer: { id: profile.id, full_name: profile.full_name, email: profile.email },
    temporaryPassword,
  });
}
