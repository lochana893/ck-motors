"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Check, Globe2, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  DEFAULT_SITE_SETTINGS,
  loadSiteSettings,
  saveSiteSettings,
  type SiteSettings,
} from "@/lib/site-settings";

type Props = { onSaved: (message: string) => void; onError: (message: string) => void };

const groups: Array<{ title: string; fields: Array<{ key: keyof SiteSettings; label: string; type?: string; wide?: boolean }> }> = [
  {
    title: "Business Information",
    fields: [
      { key: "business_name", label: "Business name" },
      { key: "tagline", label: "Tagline" },
      { key: "business_description", label: "Business description", wide: true },
      { key: "address", label: "Address" },
      { key: "city_area", label: "City / area" },
    ],
  },
  {
    title: "Contact Information",
    fields: [
      { key: "primary_phone", label: "Primary phone" },
      { key: "secondary_phone", label: "Secondary phone" },
      { key: "whatsapp_number", label: "WhatsApp number" },
      { key: "email", label: "Email address", type: "email" },
      { key: "maps_url", label: "Google Maps URL", type: "url", wide: true },
      { key: "opening_hours", label: "Opening hours", wide: true },
    ],
  },
  {
    title: "Social Media",
    fields: [
      { key: "facebook_url", label: "Facebook URL", type: "url" },
      { key: "instagram_url", label: "Instagram URL", type: "url" },
      { key: "tiktok_url", label: "TikTok URL", type: "url" },
      { key: "youtube_url", label: "YouTube URL", type: "url" },
    ],
  },
  {
    title: "Homepage Content",
    fields: [
      { key: "hero_eyebrow", label: "Hero eyebrow" },
      { key: "hero_heading", label: "Hero heading" },
      { key: "hero_description", label: "Hero description", wide: true },
      { key: "primary_cta_text", label: "Primary CTA text" },
      { key: "secondary_cta_text", label: "Secondary CTA text" },
      { key: "contact_heading", label: "Contact CTA heading" },
      { key: "contact_description", label: "Contact CTA description", wide: true },
      { key: "whatsapp_message", label: "WhatsApp default message", wide: true },
    ],
  },
];

export default function WebsiteSettingsSection({ onSaved, onError }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [saved, setSaved] = useState<SiteSettings>(DEFAULT_SITE_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const next = await loadSiteSettings(supabase);
        if (active) {
          setForm(next);
          setSaved(next);
        }
      } catch (loadError) {
        if (active) {
          onError(loadError instanceof Error ? loadError.message : "Website settings could not be loaded.");
        }
      }
      if (active) setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, [onError, supabase]);

  const changed = JSON.stringify(form) !== JSON.stringify(saved);

  function update(key: keyof SiteSettings, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function validate() {
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address.";
    for (const key of ["maps_url", "facebook_url", "instagram_url", "tiktok_url", "youtube_url"] as const) {
      if (form[key]) {
        try {
          const url = new URL(form[key]);
          if (!["http:", "https:"].includes(url.protocol)) throw new Error();
        } catch {
          return `Enter a valid URL for ${key.replaceAll("_", " ")}.`;
        }
      }
    }
    return "";
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      onError(validationError);
      return;
    }
    setSaving(true);
    let saveError = "";
    try {
      await saveSiteSettings(supabase, form);
    } catch (error) {
      saveError = error instanceof Error ? error.message : "Website settings could not be saved.";
    }
    setSaving(false);
    if (saveError) {
      onError(saveError);
      return;
    }
    setSaved(form);
    onSaved("Website settings updated successfully.");
  }

  if (loading) return <div className="rounded-2xl border border-white/10 bg-[#111] p-8 text-sm text-gray-500">Loading website settings...</div>;

  return (
    <form onSubmit={submit} className="space-y-6">
      {groups.map((group) => (
        <section key={group.title} className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-7">
          <div className="mb-5 flex items-center gap-3"><Globe2 size={19} className="text-red-500" /><div><h2 className="font-black">{group.title}</h2><p className="mt-1 text-xs text-gray-500">Public website information managed by administrators.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {group.fields.map((field) => (
              <label key={field.key} className={`block text-xs font-bold text-gray-400 ${field.wide ? "sm:col-span-2" : ""}`}>
                {field.label}
                {field.key === "opening_hours" || field.key === "business_description" || field.key === "hero_description" || field.key === "contact_description" || field.key === "whatsapp_message" ? (
                  <textarea rows={field.key === "opening_hours" ? 5 : 3} value={form[field.key]} onChange={(event) => update(field.key, event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm font-normal text-white outline-none focus:border-red-500" />
                ) : (
                  <input type={field.type || "text"} value={form[field.key]} onChange={(event) => update(field.key, event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-4 py-3 text-sm font-normal text-white outline-none focus:border-red-500" />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {changed && <span className="text-xs text-gray-500">You have unsaved changes.</span>}
        <button type="submit" disabled={!changed || saving} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Saving..." : <><Save size={15} /> Save Changes</>}
        </button>
        {!changed && <Check size={17} className="text-emerald-500" aria-label="Saved" />}
      </div>
    </form>
  );
}
