import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

// Public, read-only endpoint. Only ever returns a total page-view count when an admin
// has explicitly enabled the public counter; never exposes visitor-level data.
export async function GET() {
  const admin = getSupabaseAdminClient();
  if (!admin) return NextResponse.json({ enabled: false });

  try {
    const { data: settings } = await admin
      .from("analytics_settings")
      .select("show_public_visit_count")
      .eq("id", true)
      .maybeSingle();

    if (!settings?.show_public_visit_count) {
      return NextResponse.json({ enabled: false });
    }

    const { count, error } = await admin
      .from("site_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "page_view");

    if (error || count === null) {
      return NextResponse.json({ enabled: false });
    }

    return NextResponse.json({ enabled: true, count });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Public visit count lookup failed:", error);
    }
    return NextResponse.json({ enabled: false });
  }
}
