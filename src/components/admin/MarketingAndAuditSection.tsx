"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, Eye, EyeOff, Plus, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Promotion = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  start_date: string;
  end_date: string;
  is_active: boolean;
  cta_text: string;
  cta_url: string | null;
};
type Review = {
  id: string;
  service_record_id: string;
  customer_id: string;
  rating: number;
  review: string;
  status: "pending" | "approved" | "hidden";
  created_at: string;
};
type AuditEntry = {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
};

const blankPromotion = {
  title: "",
  description: "",
  image_url: "",
  start_date: "",
  end_date: "",
  cta_text: "Learn more",
  cta_url: "",
};

function validOptionalUrl(value: string) {
  if (!value) return true;
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export default function MarketingAndAuditSection({ isAdmin }: { isAdmin: boolean }) {
  const supabase = useMemo(() => createClient(), []);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [customers, setCustomers] = useState<Record<string, string>>({});
  const [form, setForm] = useState(blankPromotion);
  const [editing, setEditing] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [promotionResult, reviewResult, auditResult, profileResult] = await Promise.all([
      supabase.from("promotions").select("id, title, description, image_url, start_date, end_date, is_active, cta_text, cta_url").order("created_at", { ascending: false }).limit(200),
      supabase.from("service_reviews").select("id, service_record_id, customer_id, rating, review, status, created_at").order("created_at", { ascending: false }).limit(200),
      isAdmin ? supabase.from("audit_logs").select("id, actor_id, action, entity, entity_id, old_value, new_value, created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [], error: null }),
      supabase.from("profiles").select("id, full_name").eq("role", "customer").limit(1000),
    ]);
    const loadError = promotionResult.error || reviewResult.error || auditResult.error || profileResult.error;
    if (loadError) setError(`Unable to load marketing and activity data: ${loadError.message}`);
    else {
      setPromotions((promotionResult.data || []) as Promotion[]);
      setReviews((reviewResult.data || []) as Review[]);
      setAudit((auditResult.data || []) as AuditEntry[]);
      setCustomers(Object.fromEntries((profileResult.data || []).map((profile) => [profile.id, profile.full_name])));
    }
    setLoading(false);
  }, [isAdmin, supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function startEdit(item: Promotion) {
    setEditing(item.id);
    setForm({
      title: item.title,
      description: item.description,
      image_url: item.image_url || "",
      start_date: item.start_date,
      end_date: item.end_date,
      cta_text: item.cta_text,
      cta_url: item.cta_url || "",
    });
    setShowForm(true);
  }

  async function savePromotion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!validOptionalUrl(form.image_url) || !validOptionalUrl(form.cta_url)) {
      setError("Image and CTA links must use http or https URLs.");
      return;
    }
    if (!form.start_date || !form.end_date || form.end_date < form.start_date) {
      setError("Enter a valid promotion date range.");
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError(authError?.message || "Your session has expired. Please sign in again.");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      image_url: form.image_url.trim() || null,
      start_date: form.start_date,
      end_date: form.end_date,
      cta_text: form.cta_text.trim() || "Learn more",
      cta_url: form.cta_url.trim() || null,
      created_by: authData.user.id,
    };
    const result = editing
      ? await supabase.from("promotions").update(payload).eq("id", editing)
      : await supabase.from("promotions").insert(payload);
    setSaving(false);
    if (result.error) {
      setError(`Promotion could not be saved: ${result.error.message}`);
      return;
    }
    setShowForm(false);
    setEditing(null);
    setForm(blankPromotion);
    setNotice(editing ? "Promotion updated." : "Promotion created.");
    await load();
  }

  async function togglePromotion(item: Promotion) {
    const { error: updateError } = await supabase.from("promotions").update({ is_active: !item.is_active }).eq("id", item.id);
    if (updateError) setError(`Promotion could not be updated: ${updateError.message}`);
    else {
      setNotice(item.is_active ? "Promotion deactivated." : "Promotion activated.");
      await load();
    }
  }

  async function deletePromotion(item: Promotion) {
    if (!window.confirm(`Delete promotion "${item.title}"?`)) return;
    const { error: deleteError } = await supabase.from("promotions").delete().eq("id", item.id);
    if (deleteError) setError(`Promotion could not be deleted: ${deleteError.message}`);
    else {
      setNotice("Promotion deleted.");
      await load();
    }
  }

  async function setReviewStatus(review: Review, status: Review["status"]) {
    const { error: updateError } = await supabase.from("service_reviews").update({ status }).eq("id", review.id);
    if (updateError) setError(`Review could not be updated: ${updateError.message}`);
    else {
      setNotice(`Review ${status}.`);
      await load();
    }
  }

  async function deleteReview(review: Review) {
    if (!window.confirm("Permanently delete this customer review?")) return;
    const { error: deleteError } = await supabase.from("service_reviews").delete().eq("id", review.id);
    if (deleteError) setError(`Review could not be deleted: ${deleteError.message}`);
    else {
      setNotice("Review deleted.");
      await load();
    }
  }

  if (loading) return <div className="rounded-2xl border border-white/10 bg-[#111] p-8 text-sm text-gray-500">Loading promotions and reviews...</div>;

  return (
    <section className="space-y-6">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#63b4ff]">Customer Engagement</p><h2 className="mt-1 text-2xl font-black">Promotions & Reviews</h2></div>
      {error && <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-[#1688ff]/30 bg-[#101d2b] px-4 py-3 text-xs text-[#b9ddff]">{notice}</p>}
      <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">Offers & Promotions</h3><p className="mt-1 text-xs text-gray-500">Only active offers within their date range appear on the public site.</p></div><button type="button" onClick={() => { setEditing(null); setForm(blankPromotion); setShowForm((open) => !open); }} className="inline-flex items-center gap-2 rounded-lg bg-[#087fe8] px-4 py-3 text-xs font-bold"><Plus size={15} /> Add Promotion</button></div>
        {showForm && <form onSubmit={savePromotion} className="mb-5 grid gap-3 rounded-xl border border-white/10 bg-black/20 p-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-gray-400">Title<input required maxLength={150} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs font-bold text-gray-400">Image URL<input type="url" value={form.image_url} onChange={(event) => setForm({ ...form, image_url: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs font-bold text-gray-400 sm:col-span-2">Description<textarea required rows={2} maxLength={2000} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs font-bold text-gray-400">Start date<input required type="date" value={form.start_date} onChange={(event) => setForm({ ...form, start_date: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs font-bold text-gray-400">End date<input required type="date" value={form.end_date} onChange={(event) => setForm({ ...form, end_date: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs font-bold text-gray-400">CTA text<input maxLength={80} value={form.cta_text} onChange={(event) => setForm({ ...form, cta_text: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white" /></label>
          <label className="text-xs font-bold text-gray-400">CTA link<input type="url" value={form.cta_url} onChange={(event) => setForm({ ...form, cta_url: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-sm text-white" /></label>
          <div className="flex gap-2 sm:col-span-2"><button disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#087fe8] px-4 py-2 text-xs font-bold disabled:opacity-50">{saving ? "Saving..." : <><Save size={14} /> Save Promotion</>}</button><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 px-4 py-2 text-xs font-bold">Cancel</button></div>
        </form>}
        {promotions.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">No promotions created.</p> : <div className="grid gap-3 md:grid-cols-2">{promotions.map((item) => <article key={item.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold">{item.title}</h4><p className="mt-1 text-xs text-gray-400">{item.description}</p></div><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${item.is_active ? "bg-emerald-950 text-emerald-300" : "bg-white/5 text-gray-500"}`}>{item.is_active ? "Active" : "Inactive"}</span></div><p className="mt-3 text-[10px] text-gray-500">{item.start_date} – {item.end_date}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => startEdit(item)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">Edit</button><button type="button" onClick={() => void togglePromotion(item)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold">{item.is_active ? "Deactivate" : "Activate"}</button><button type="button" onClick={() => void deletePromotion(item)} className="rounded-lg border border-red-900/50 px-3 py-2 text-[10px] font-bold text-red-300"><Trash2 size={13} /></button></div></article>)}</div>}
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-7">
        <h3 className="font-black">Customer Reviews</h3><p className="mt-1 text-xs text-gray-500">Only approved reviews are shown publicly.</p>
        {reviews.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">No reviews submitted.</p> : <div className="mt-4 space-y-3">{reviews.map((review) => <article key={review.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold">{customers[review.customer_id] || "Customer"} · <span className="text-amber-300">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></p><p className="mt-2 text-sm text-gray-300">{review.review}</p><p className="mt-2 text-[10px] text-gray-600">{new Date(review.created_at).toLocaleDateString()} · Service {review.service_record_id.slice(0, 8)}</p></div><span className="rounded-full bg-white/5 px-2 py-1 text-[9px] uppercase text-gray-400">{review.status}</span></div><div className="mt-3 flex gap-2">{review.status !== "approved" && <button type="button" onClick={() => void setReviewStatus(review, "approved")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-900/50 px-3 py-2 text-[10px] font-bold text-emerald-300"><Check size={13} /> Approve</button>}{review.status !== "hidden" && <button type="button" onClick={() => void setReviewStatus(review, "hidden")} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-300"><EyeOff size={13} /> Hide</button>}{review.status === "hidden" && <button type="button" onClick={() => void setReviewStatus(review, "pending")} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-300"><Eye size={13} /> Restore pending</button>}<button type="button" onClick={() => void deleteReview(review)} className="rounded-lg border border-red-900/50 px-3 py-2 text-[10px] font-bold text-red-300"><Trash2 size={13} /></button></div></article>)}</div>}
      </div>
      {isAdmin && <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-7"><h3 className="font-black">Admin Audit Log</h3><p className="mt-1 text-xs text-gray-500">Recent database changes to bookings, job cards, service records, and inventory.</p>{audit.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">No audit events recorded.</p> : <div className="mt-4 max-h-[32rem] overflow-auto">{audit.map((entry) => <details key={entry.id} className="border-b border-white/5 py-3"><summary className="cursor-pointer text-xs text-gray-300"><span className="font-bold text-[#8bc9ff]">{entry.action.toUpperCase()}</span> · {entry.entity} {entry.entity_id?.slice(0, 12) || ""} · {new Date(entry.created_at).toLocaleString()}</summary><pre className="mt-2 overflow-auto rounded bg-black/30 p-3 text-[10px] text-gray-400">{JSON.stringify({ actor: entry.actor_id, before: entry.old_value, after: entry.new_value }, null, 2)}</pre></details>)}</div>}</div>}
    </section>
  );
}
