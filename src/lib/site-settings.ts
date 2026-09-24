import type { SupabaseClient } from "@supabase/supabase-js";

export type SiteSettings = {
  business_name: string;
  tagline: string;
  business_description: string;
  address: string;
  city_area: string;
  primary_phone: string;
  secondary_phone: string;
  whatsapp_number: string;
  email: string;
  maps_url: string;
  opening_hours: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  youtube_url: string;
  hero_eyebrow: string;
  hero_heading: string;
  hero_description: string;
  primary_cta_text: string;
  secondary_cta_text: string;
  contact_heading: string;
  contact_description: string;
  whatsapp_message: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettings = {
  business_name: "CK Motors",
  tagline: "Drive With Confidence",
  business_description: "Professional vehicle maintenance, repairs and automotive care.",
  address: "",
  city_area: "Sri Lanka",
  primary_phone: "",
  secondary_phone: "",
  whatsapp_number: "",
  email: "",
  maps_url: "",
  opening_hours: "",
  facebook_url: "",
  instagram_url: "",
  tiktok_url: "",
  youtube_url: "",
  hero_eyebrow: "Drive with confidence",
  hero_heading: "Professional vehicle care, done right.",
  hero_description: "Full-service maintenance, repairs, diagnostics and detailing from a team that treats your vehicle like their own.",
  primary_cta_text: "Book a service",
  secondary_cta_text: "Explore services",
  contact_heading: "Ready for a smoother drive?",
  contact_description: "Create your customer account and schedule your next service in minutes.",
  whatsapp_message: "Hello CK Motors, I would like to inquire about a service.",
};

export const SITE_SETTING_KEYS = Object.keys(DEFAULT_SITE_SETTINGS) as Array<keyof SiteSettings>;

type WebsiteSettingsRow = Record<string, unknown> & {
  id?: string | number;
};

function settingsFromRow(row: WebsiteSettingsRow | null): SiteSettings {
  const settings = { ...DEFAULT_SITE_SETTINGS };

  if (!row) {
    return settings;
  }

  for (const key of SITE_SETTING_KEYS) {
    if (typeof row[key] === "string") {
      settings[key] = row[key];
    }
  }

  return settings;
}

export async function loadSiteSettings(supabase: SupabaseClient): Promise<SiteSettings> {
  const { data, error } = await supabase
    .from("website_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("Unable to load website settings:", error.message);
    return DEFAULT_SITE_SETTINGS;
  }

  return settingsFromRow(data as WebsiteSettingsRow | null);
}

export async function saveSiteSettings(
  supabase: SupabaseClient,
  settings: SiteSettings,
): Promise<void> {
  const { data: existingRow, error: readError } = await supabase
    .from("website_settings")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (readError) {
    throw new Error(readError.message);
  }

  const row = existingRow as WebsiteSettingsRow | null;
  if (!row) {
    throw new Error("No website settings row exists to update.");
  }

  if (row.id === undefined || row.id === null) {
    throw new Error("The existing website settings row has no usable identifier.");
  }

  const payload = Object.fromEntries(
    SITE_SETTING_KEYS
      .filter((key) => Object.prototype.hasOwnProperty.call(row, key))
      .map((key) => [key, settings[key]]),
  );

  if (Object.keys(payload).length === 0) {
    throw new Error("The existing website settings row has no supported settings columns.");
  }

  const { error: updateError } = await supabase
    .from("website_settings")
    .update(payload)
    .eq("id", row.id);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

export function whatsappUrl(number: string, message: string) {
  const raw = number.trim().replace(/[^\d]/g, "");
  const digits = raw.startsWith("0")
    ? `94${raw.slice(1)}`
    : raw.startsWith("94")
      ? raw
      : raw;
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : "";
}

export function phoneUrl(number: string) {
  const raw = number.trim().replace(/[^\d+]/g, "");
  if (!raw) return "";
  if (raw.startsWith("0")) return `tel:+94${raw.slice(1)}`;
  return `tel:${raw.startsWith("+") ? raw : `+${raw}`}`;
}

export function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}
