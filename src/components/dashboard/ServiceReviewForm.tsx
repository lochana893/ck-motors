"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type RecordItem = { id: string; vehicle_id: string; service_date: string; services_performed: string };
type ReviewItem = { id: string; service_record_id: string; rating: number; review: string; status: string };
type VehicleItem = { id: string; registration_number: string; brand: string; model: string };

export default function ServiceReviewForm() {
  const supabase = useMemo(() => createClient(), []);
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [recordId, setRecordId] = useState("");
  const [rating, setRating] = useState("5");
  const [reviewText, setReviewText] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setError("Sign in again to submit a service review.");
      setLoading(false);
      return;
    }
    setCustomerId(authData.user.id);
    const [recordResult, reviewResult, vehicleResult] = await Promise.all([
      supabase.from("service_records").select("id, vehicle_id, service_date, services_performed").eq("user_id", authData.user.id).order("service_date", { ascending: false }).limit(100),
      supabase.from("service_reviews").select("id, service_record_id, rating, review, status").eq("customer_id", authData.user.id),
      supabase.from("vehicles").select("id, registration_number, brand, model").eq("user_id", authData.user.id),
    ]);
    const loadError = recordResult.error || reviewResult.error || vehicleResult.error;
    if (loadError) setError(`Service reviews could not be loaded: ${loadError.message}`);
    else {
      setRecords((recordResult.data || []) as RecordItem[]);
      setReviews((reviewResult.data || []) as ReviewItem[]);
      setVehicles((vehicleResult.data || []) as VehicleItem[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (!recordId || !Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5 || !reviewText.trim()) {
      setError("Choose a service, select a rating, and write a review.");
      return;
    }
    setSaving(true);
    const { error: insertError } = await supabase.from("service_reviews").insert({
      service_record_id: recordId,
      customer_id: customerId,
      rating: Number(rating),
      review: reviewText.trim(),
      status: "pending",
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.code === "23505" ? "You have already reviewed this service." : `Review could not be submitted: ${insertError.message}`);
      return;
    }
    setReviewText("");
    setRecordId("");
    setMessage("Thanks — your review is awaiting approval.");
    await load();
  }

  if (loading || records.length === 0) return null;

  return (
    <section className="mb-8 rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 md:p-6">
      <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#63b4ff]">Customer feedback</p><h2 className="mt-1 text-lg font-black">Review a Completed Service</h2></div>
      {error && <p role="alert" className="mb-3 rounded-lg border border-red-900/50 bg-red-950/20 p-3 text-xs text-red-300">{error}</p>}
      {message && <p role="status" className="mb-3 rounded-lg border border-[#1688ff]/30 bg-[#101d2b] p-3 text-xs text-[#b9ddff]">{message}</p>}
      <div className="space-y-3">
        {records.map((record) => {
          const existing = reviews.find((item) => item.service_record_id === record.id);
          const vehicle = vehicles.find((item) => item.id === record.vehicle_id);
          return <article key={record.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-bold">{vehicle?.registration_number || "Vehicle"} · {record.services_performed}</p><p className="mt-1 text-[10px] text-gray-500">{record.service_date} · {vehicle ? `${vehicle.brand} ${vehicle.model}` : ""}</p></div>{existing && <span className="rounded-full bg-white/5 px-3 py-1 text-[10px] font-bold text-gray-400">{existing.status === "approved" ? `${"★".repeat(existing.rating)} · Published` : existing.status === "hidden" ? "Review hidden" : "Awaiting approval"}</span>}</div>
            {!existing && <form onSubmit={submit} className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]"><div className="grid gap-3 sm:grid-cols-[auto_1fr]"><label className="text-[10px] font-bold text-gray-500">Rating<select value={recordId === record.id ? rating : "5"} onChange={(event) => { setRecordId(record.id); setRating(event.target.value); }} className="mt-1 block rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white">{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} {value === 1 ? "star" : "stars"}</option>)}</select></label><label className="text-[10px] font-bold text-gray-500">Your review<textarea required maxLength={2000} value={recordId === record.id ? reviewText : ""} onFocus={() => setRecordId(record.id)} onChange={(event) => { setRecordId(record.id); setReviewText(event.target.value); }} rows={2} placeholder="How was your CK Motors service?" className="mt-1 block w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white" /></label></div><button disabled={saving} className="self-end inline-flex items-center justify-center gap-2 rounded-lg bg-[#087fe8] px-4 py-3 text-xs font-bold disabled:opacity-50"><Star size={14} /> {saving ? "Submitting..." : "Submit Review"}</button></form>}
            {existing && <p className="mt-2 text-xs text-gray-400">{existing.review}</p>}
          </article>;
        })}
      </div>
    </section>
  );
}
