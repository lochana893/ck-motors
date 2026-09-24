import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { isProtectedOwnerEmail } from "@/lib/protected-owner";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const adminClient = getSupabaseAdminClient();
  if (!adminClient) {
    return NextResponse.json(
      { error: "Customer creation requires the server-only SUPABASE_SERVICE_ROLE_KEY configuration." },
      { status: 503 }
    );
  }

  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );
  const {
    data: { user },
  } = await authClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "You must be signed in." }, { status: 401 });
  }

  const { data: adminProfile } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Only administrators can create customers." }, { status: 403 });
  }

  const body = (await request.json()) as {
    full_name?: string;
    email?: string;
    phone?: string;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    district?: string;
    postal_code?: string;
  };
  const fullName = body.full_name?.trim();
  const email = body.email?.trim().toLowerCase();

  if (!fullName || !email) {
    return NextResponse.json({ error: "Full name and email are required." }, { status: 400 });
  }
  if (isProtectedOwnerEmail(email)) {
    return NextResponse.json({ error: "The primary CK Motors owner account already exists and cannot be recreated." }, { status: 409 });
  }

  const { data: existingProfile, error: existingProfileError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfileError) {
    return NextResponse.json(
      { error: `Customer account could not be checked: ${existingProfileError.message}` },
      { status: 400 },
    );
  }

  if (existingProfile) {
    return NextResponse.json(
      {
        error:
          "A customer profile already exists for this email. Verify its Supabase Auth account before creating another customer.",
      },
      { status: 409 },
    );
  }

  const passwordBytes = new Uint8Array(18);
  crypto.getRandomValues(passwordBytes);
  const temporaryPassword = Array.from(passwordBytes, (byte) =>
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%".charAt(
      byte % 62
    )
  ).join("");

  const { data: created, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone: body.phone?.trim() || null },
  });

  if (authError || !created.user) {
    return NextResponse.json({ error: authError?.message || "Auth account could not be created." }, { status: 400 });
  }

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: created.user.id,
      full_name: fullName,
      email,
      phone: body.phone?.trim() || null,
      address_line1: body.address_line1?.trim() || null,
      address_line2: body.address_line2?.trim() || null,
      city: body.city?.trim() || null,
      district: body.district?.trim() || null,
      postal_code: body.postal_code?.trim() || null,
      role: "customer",
      status: "active",
      must_change_password: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    return NextResponse.json({ error: `Customer profile could not be created: ${profileError.message}` }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    customer: { id: created.user.id, full_name: fullName, email },
    temporaryPassword,
  });
}
