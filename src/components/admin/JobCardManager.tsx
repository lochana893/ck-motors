"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClipboardList, ImagePlus, Plus, Printer, Search, Trash2, Video, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { whatsappUrl } from "@/lib/site-settings";
import MediaUploadProgress from "@/components/admin/MediaUploadProgress";
import {
  initialMediaUploadState,
  uploadErrorMessage,
  uploadFileWithProgress,
  type MediaUploadState,
} from "@/lib/supabase/upload-with-progress";
import { formatMediaCaption } from "@/lib/media-caption";

type Booking = {
  id: string;
  booking_reference: string;
  user_id: string;
  vehicle_id: string;
  booking_date: string;
  booking_time: string;
  service_name_snapshot: string | null;
};

type Customer = { id: string; full_name: string; phone: string | null };
type Vehicle = {
  id: string;
  user_id: string;
  registration_number: string;
  brand: string;
  model: string;
  mileage: number | null;
};
type Technician = { id: string; full_name: string; status: string };
type JobStatus =
  | "draft" | "booked" | "checked_in" | "inspection" | "diagnosing"
  | "waiting_approval" | "repairing" | "cleaning" | "quality_check"
  | "ready" | "delivered" | "cancelled";
type JobCard = {
  id: string;
  job_card_number: string;
  booking_id: string | null;
  customer_id: string;
  vehicle_id: string;
  assigned_technician_id: string | null;
  current_mileage: number | null;
  fuel_level: string | null;
  customer_complaint: string | null;
  inspection_notes: string | null;
  requested_services: string | null;
  estimated_completion_at: string | null;
  status: JobStatus;
  internal_notes: string | null;
  created_at: string;
};
type Media = {
  id: string;
  job_card_id: string;
  media_stage: "before" | "after";
  media_type: "image" | "video";
  storage_path: string;
  caption: string | null;
  signedUrl: string;
};
type StatusEntry = {
  id: string;
  job_card_id: string;
  previous_status: string | null;
  new_status: string;
  created_at: string;
};
type PendingMediaUpload = {
  card: JobCard;
  stage: "before" | "after";
  file: File;
  caption: string;
};

const statuses: JobStatus[] = [
  "draft", "booked", "checked_in", "inspection", "diagnosing",
  "waiting_approval", "repairing", "cleaning", "quality_check",
  "ready", "delivered", "cancelled",
];
const maximumImageSize = 5 * 1024 * 1024;
const maximumVideoSize = 100 * 1024 * 1024;

function label(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function JobCardManager() {
  const supabase = useMemo(() => createClient(), []);
  const [cards, setCards] = useState<JobCard[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [media, setMedia] = useState<Media[]>([]);
  const [history, setHistory] = useState<StatusEntry[]>([]);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingCard, setEditingCard] = useState<JobCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadState, setUploadState] = useState<MediaUploadState | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const retryUploadRef = useRef<PendingMediaUpload | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [printCard, setPrintCard] = useState<JobCard | null>(null);
  const [whatsAppTemplate, setWhatsAppTemplate] = useState("booking_confirmed");
  const [flow, setFlow] = useState<"booking" | "walk-in">("booking");
  const [bookingId, setBookingId] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [form, setForm] = useState({
    mileage: "",
    fuel_level: "",
    customer_complaint: "",
    inspection_notes: "",
    requested_services: "",
    technician_id: "",
    estimated_completion_at: "",
    internal_notes: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const [cardResult, bookingResult, customerResult, vehicleResult, technicianResult, mediaResult, historyResult] = await Promise.all([
      supabase.from("job_cards").select("id, job_card_number, booking_id, customer_id, vehicle_id, assigned_technician_id, current_mileage, fuel_level, customer_complaint, inspection_notes, requested_services, estimated_completion_at, status, internal_notes, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("bookings").select("id, booking_reference, user_id, vehicle_id, booking_date, booking_time, service_name_snapshot").neq("status", "cancelled").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, full_name, phone").eq("role", "customer").order("full_name").limit(1000),
      supabase.from("vehicles").select("id, user_id, registration_number, brand, model, mileage").order("registration_number").limit(1000),
      supabase.from("technicians").select("id, full_name, status").neq("status", "inactive").order("full_name"),
      supabase.from("service_media").select("id, job_card_id, media_stage, media_type, storage_path, caption").order("created_at", { ascending: false }).limit(500),
      supabase.from("job_card_status_history").select("id, job_card_id, previous_status, new_status, created_at").order("created_at", { ascending: false }).limit(1000),
    ]);
    const queryError = cardResult.error || bookingResult.error || customerResult.error || vehicleResult.error || technicianResult.error || mediaResult.error || historyResult.error;
    if (queryError) {
      setError(`Unable to load job cards: ${queryError.message}`);
      setLoading(false);
      return;
    }
    const loadedMedia = mediaResult.data || [];
    const signedResult = loadedMedia.length
      ? await supabase.storage.from("service-media").createSignedUrls(loadedMedia.map((item) => item.storage_path), 3600)
      : { data: [], error: null };
    if (signedResult.error) {
      setError(`Job cards loaded, but service media could not be previewed: ${signedResult.error.message}`);
    }
    const signedUrls = new Map((signedResult.data || []).map((item) => [item.path, item.signedUrl]));
    setCards((cardResult.data || []) as JobCard[]);
    setBookings((bookingResult.data || []) as Booking[]);
    setCustomers((customerResult.data || []) as Customer[]);
    setVehicles((vehicleResult.data || []) as Vehicle[]);
    setTechnicians((technicianResult.data || []) as Technician[]);
    setMedia(loadedMedia.flatMap((item) => {
      const signedUrl = signedUrls.get(item.storage_path);
      return signedUrl ? [{ ...item, signedUrl } as Media] : [];
    }));
    setHistory((historyResult.data || []) as StatusEntry[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  const selectedBooking = bookings.find((booking) => booking.id === bookingId);
  const effectiveCustomerId = flow === "booking" ? selectedBooking?.user_id || "" : customerId;
  const customerVehicles = vehicles.filter((vehicle) => vehicle.user_id === effectiveCustomerId);
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === (flow === "booking" ? selectedBooking?.vehicle_id : vehicleId));
  const usedBookingIds = new Set(cards.filter((card) => card.status !== "cancelled").map((card) => card.booking_id).filter(Boolean));
  const filteredCards = cards.filter((card) => {
    const customer = customers.find((item) => item.id === card.customer_id);
    const vehicle = vehicles.find((item) => item.id === card.vehicle_id);
    const text = [card.job_card_number, customer?.full_name, customer?.phone, vehicle?.registration_number, vehicle?.brand, vehicle?.model, card.customer_complaint]
      .filter(Boolean).join(" ").toLowerCase();
    return text.includes(search.toLowerCase());
  });

  function startNew() {
    setEditingCard(null);
    setFlow("booking");
    setBookingId("");
    setCustomerId("");
    setVehicleId("");
    setForm({ mileage: "", fuel_level: "", customer_complaint: "", inspection_notes: "", requested_services: "", technician_id: "", estimated_completion_at: "", internal_notes: "" });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function startEdit(card: JobCard) {
    setEditingCard(card);
    setFlow(card.booking_id ? "booking" : "walk-in");
    setBookingId(card.booking_id || "");
    setCustomerId(card.customer_id);
    setVehicleId(card.vehicle_id);
    setForm({
      mileage: card.current_mileage?.toString() || "",
      fuel_level: card.fuel_level || "",
      customer_complaint: card.customer_complaint || "",
      inspection_notes: card.inspection_notes || "",
      requested_services: card.requested_services || "",
      technician_id: card.assigned_technician_id || "",
      estimated_completion_at: card.estimated_completion_at ? new Date(card.estimated_completion_at).toISOString().slice(0, 16) : "",
      internal_notes: card.internal_notes || "",
    });
    setError("");
    setNotice("");
    setShowForm(true);
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    const selectedCustomer = customers.find((item) => item.id === effectiveCustomerId);
    if (!selectedCustomer || !selectedVehicle) {
      setError("Choose a customer and one of their vehicles.");
      return;
    }
    const mileage = form.mileage === "" ? null : Number(form.mileage);
    if (mileage !== null && (!Number.isInteger(mileage) || mileage < 0)) {
      setError("Enter a valid non-negative mileage.");
      return;
    }
    if (mileage !== null && selectedVehicle.mileage !== null && mileage < selectedVehicle.mileage && (!editingCard || mileage !== editingCard.current_mileage)) {
      const profile = await supabase.auth.getUser();
      const { data: currentProfile } = profile.data.user
        ? await supabase.from("profiles").select("role").eq("id", profile.data.user.id).maybeSingle()
        : { data: null };
      if (currentProfile?.role !== "admin" || !window.confirm("The entered mileage is below the vehicle's previous reading. Confirm this correction?")) {
        setError("Mileage must not be lower than the vehicle's previous reading unless an admin confirms a correction.");
        return;
      }
    }
    setSaving(true);
    const payload = {
      booking_id: flow === "booking" ? bookingId || null : null,
      customer_id: selectedCustomer.id,
      vehicle_id: selectedVehicle.id,
      assigned_technician_id: form.technician_id || null,
      current_mileage: mileage,
      fuel_level: form.fuel_level || null,
      customer_complaint: form.customer_complaint.trim() || null,
      inspection_notes: form.inspection_notes.trim() || null,
      requested_services: form.requested_services.trim() || (flow === "booking" ? selectedBooking?.service_name_snapshot : null) || null,
      estimated_completion_at: form.estimated_completion_at ? new Date(form.estimated_completion_at).toISOString() : null,
      internal_notes: form.internal_notes.trim() || null,
      status: flow === "booking" ? "booked" : "draft",
    };
    const result = editingCard
      ? await supabase.from("job_cards").update({ ...payload, status: editingCard.status }).eq("id", editingCard.id)
      : await supabase.from("job_cards").insert(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error.code === "23505" && bookingId
        ? "An active job card already exists for this booking."
        : `Job card could not be saved: ${result.error.message}`);
      return;
    }
    setShowForm(false);
    setEditingCard(null);
    setNotice(editingCard ? "Job card updated." : "Job card created.");
    await load();
  }

  async function updateStatus(card: JobCard, nextStatus: JobStatus) {
    if (card.status === nextStatus) return;
    setError("");
    const { error: updateError } = await supabase.from("job_cards").update({ status: nextStatus }).eq("id", card.id);
    if (updateError) {
      setError(`Status could not be updated: ${updateError.message}`);
      return;
    }
    setNotice(`${card.job_card_number} moved to ${label(nextStatus)}.`);
    await load();
  }

  async function uploadMedia(card: JobCard, stage: "before" | "after", event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    const isVideo = ["video/mp4", "video/webm"].includes(file.type);
    if (!isImage && !isVideo) {
      setError("Choose a JPG, PNG, WEBP, MP4 or WEBM file.");
      return;
    }
    if (file.size > (isImage ? maximumImageSize : maximumVideoSize)) {
      setError(isImage ? "Images must be 5 MB or smaller." : "Videos must be 100 MB or smaller.");
      return;
    }
    const caption = window.prompt("Add a caption for this media (optional):")?.trim() || "";
    retryUploadRef.current = { card, stage, file, caption };
    await runMediaUpload(retryUploadRef.current);
  }

  async function runMediaUpload(pending: PendingMediaUpload) {
    const { card, stage, file, caption } = pending;
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(file.type);
    if (abortControllerRef.current) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    const validExtensions = isImage ? ["jpg", "jpeg", "png", "webp"] : ["mp4", "webm"];
    if (!extension || !validExtensions.includes(extension)) {
      setError("The selected file extension does not match a supported media format.");
      return;
    }
    const path = `job-cards/${card.id}/${stage}/${crypto.randomUUID()}.${extension}`;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setUploading(card.id);
    setError("");
    setNotice("");
    setUploadState(initialMediaUploadState(file));
    try {
      await uploadFileWithProgress({
        client: supabase,
        bucket: "service-media",
        path,
        file,
        signal: controller.signal,
        onProgress: (progress) => setUploadState((current) => current ? { ...current, ...progress, status: "uploading" } : current),
      });
    } catch (uploadError) {
      if (controller.signal.aborted || (uploadError instanceof DOMException && uploadError.name === "AbortError")) {
        const cleanup = await supabase.storage.from("service-media").remove([path]);
        if (cleanup.error) console.warn("Cancelled service-media cleanup failed:", cleanup.error);
        setUploadState((current) => current ? { ...current, status: "cancelled" } : current);
        setUploading(null);
        abortControllerRef.current = null;
        return;
      }
      const message = uploadErrorMessage(uploadError);
      setUploadState((current) => current ? { ...current, status: "error", error: message } : current);
      setUploading(null);
      setError(`Media upload failed: ${message}`);
      abortControllerRef.current = null;
      return;
    }
    if (controller.signal.aborted) {
      const cleanup = await supabase.storage.from("service-media").remove([path]);
      if (cleanup.error) console.warn("Cancelled service-media cleanup failed:", cleanup.error);
      setUploadState((current) => current ? { ...current, status: "cancelled" } : current);
      setUploading(null);
      abortControllerRef.current = null;
      return;
    }
    setUploadState((current) => current ? { ...current, status: "saving" } : current);
    const { error: insertError } = await supabase.from("service_media").insert({
      job_card_id: card.id,
      media_stage: stage,
      media_type: isImage ? "image" : "video",
      storage_path: path,
      caption: caption || null,
    });
    if (insertError) {
      const cleanup = await supabase.storage.from("service-media").remove([path]);
      setUploading(null);
      const message = `Media metadata could not be saved: ${insertError.message}${cleanup.error ? ` Storage cleanup warning: ${cleanup.error.message}` : ""}`;
      setUploadState((current) => current ? { ...current, status: "error", error: message } : current);
      setError(message);
      abortControllerRef.current = null;
      return;
    }
    setUploading(null);
    abortControllerRef.current = null;
    setUploadState((current) => current ? { ...current, status: "complete" } : current);
    setNotice(`${label(stage)} media uploaded.`);
    await load();
  }

  async function deleteMedia(item: Media) {
    if (!window.confirm("Delete this service photo or video?")) return;
    const { error: rowError } = await supabase.from("service_media").delete().eq("id", item.id);
    if (rowError) {
      setError(`Service media could not be deleted: ${rowError.message}`);
      return;
    }
    setMedia((current) => current.filter((entry) => entry.id !== item.id));
    const { error: storageError } = await supabase.storage.from("service-media").remove([item.storage_path]);
    if (storageError) setError(`Media record deleted, but storage cleanup failed: ${storageError.message}`);
    else setNotice("Service media deleted.");
  }

  if (loading) return <div className="rounded-2xl border border-white/10 bg-[#111] p-10 text-center text-sm text-gray-500">Loading job cards...</div>;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#63b4ff]">Workshop Operations</p><h2 className="mt-1 text-2xl font-black">Job Cards</h2><p className="mt-2 text-xs text-gray-500">Track vehicle intake, technician work, service progress and before/after media.</p></div>
        <button type="button" onClick={startNew} className="inline-flex items-center gap-2 rounded-lg bg-[#087fe8] px-4 py-3 text-xs font-bold text-white hover:bg-[#1688ff]"><Plus size={16} /> New Job Card</button>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs text-red-300">{error}</p>}
      {notice && <p role="status" className="admin-alert admin-alert--success rounded-lg border px-4 py-3 text-xs font-semibold">{notice}</p>}
      {uploadState && (
        <MediaUploadProgress
          upload={uploadState}
          onCancel={() => abortControllerRef.current?.abort()}
          onRetry={() => {
            if (retryUploadRef.current && !abortControllerRef.current) void runMediaUpload(retryUploadRef.current);
          }}
        />
      )}
      <div className="relative max-w-lg"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search job card, customer, phone, vehicle..." className="w-full rounded-lg border border-white/10 bg-[#111] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#1688ff]" /></div>
      {showForm && (
        <form onSubmit={saveCard} className="space-y-4 rounded-2xl border border-[#1688ff]/30 bg-[#10151e] p-5 md:p-7">
          <div className="flex items-center justify-between"><h3 className="text-lg font-black">{editingCard ? `Edit ${editingCard.job_card_number}` : "Create Job Card"}</h3><button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 px-3 py-2 text-xs">Cancel</button></div>
          <div className="flex gap-2"><button type="button" onClick={() => { setFlow("booking"); setBookingId(""); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${flow === "booking" ? "bg-[#087fe8]" : "bg-white/5 text-gray-400"}`}>From Booking</button><button type="button" onClick={() => { setFlow("walk-in"); setBookingId(""); }} className={`rounded-lg px-3 py-2 text-xs font-bold ${flow === "walk-in" ? "bg-[#087fe8]" : "bg-white/5 text-gray-400"}`}>Walk-In</button></div>
          <div className="grid gap-4 sm:grid-cols-2">
            {flow === "booking" ? (
              <label className="text-xs font-bold text-gray-400">Booking<select required value={bookingId} onChange={(event) => setBookingId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white"><option value="">Select booking</option>{bookings.filter((booking) => !usedBookingIds.has(booking.id)).map((booking) => <option key={booking.id} value={booking.id}>{booking.booking_reference} · {booking.booking_date} {booking.booking_time}</option>)}</select></label>
            ) : (
              <>
                <label className="text-xs font-bold text-gray-400">Customer<select required value={customerId} onChange={(event) => { setCustomerId(event.target.value); setVehicleId(""); }} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white"><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.full_name}{customer.phone ? ` · ${customer.phone}` : ""}</option>)}</select></label>
                <label className="text-xs font-bold text-gray-400">Vehicle<select required value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white"><option value="">Select vehicle</option>{customerVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration_number} · {vehicle.brand} {vehicle.model}</option>)}</select></label>
              </>
            )}
            <label className="text-xs font-bold text-gray-400">Technician<select value={form.technician_id} onChange={(event) => setForm({ ...form, technician_id: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white"><option value="">Not assigned</option>{technicians.map((tech) => <option key={tech.id} value={tech.id}>{tech.full_name} · {label(tech.status)}</option>)}</select></label>
            <label className="text-xs font-bold text-gray-400">Current mileage<input type="number" min="0" value={form.mileage} onChange={(event) => setForm({ ...form, mileage: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm" /></label>
            <label className="text-xs font-bold text-gray-400">Fuel level<select value={form.fuel_level} onChange={(event) => setForm({ ...form, fuel_level: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm"><option value="">Not recorded</option><option>Empty</option><option>1/4</option><option>1/2</option><option>3/4</option><option>Full</option></select></label>
            <label className="text-xs font-bold text-gray-400">Estimated completion<input type="datetime-local" value={form.estimated_completion_at} onChange={(event) => setForm({ ...form, estimated_completion_at: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm" /></label>
            <label className="text-xs font-bold text-gray-400 sm:col-span-2">Customer complaint<textarea rows={2} value={form.customer_complaint} onChange={(event) => setForm({ ...form, customer_complaint: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm" /></label>
            <label className="text-xs font-bold text-gray-400 sm:col-span-2">Inspection notes<textarea rows={2} value={form.inspection_notes} onChange={(event) => setForm({ ...form, inspection_notes: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm" /></label>
            <label className="text-xs font-bold text-gray-400 sm:col-span-2">Requested services<textarea rows={2} value={form.requested_services} onChange={(event) => setForm({ ...form, requested_services: event.target.value })} placeholder={selectedBooking?.service_name_snapshot || ""} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm" /></label>
            <label className="text-xs font-bold text-gray-400 sm:col-span-2">Internal notes<textarea rows={2} value={form.internal_notes} onChange={(event) => setForm({ ...form, internal_notes: event.target.value })} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm" /></label>
          </div>
          {selectedVehicle && <p className="text-xs text-gray-500">Selected vehicle: <span className="font-bold text-white">{selectedVehicle.registration_number} · {selectedVehicle.brand} {selectedVehicle.model}</span> · Previous mileage {selectedVehicle.mileage?.toLocaleString() || "not recorded"}</p>}
          <button disabled={saving} className="rounded-lg bg-[#087fe8] px-5 py-3 text-xs font-bold disabled:opacity-50">{saving ? "Saving..." : editingCard ? "Update Job Card" : "Save Job Card"}</button>
        </form>
      )}
      {!filteredCards.length ? <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center text-sm text-gray-500">No job cards found.</div> : (
        <div className="space-y-4">
          {filteredCards.map((card) => {
            const customer = customers.find((item) => item.id === card.customer_id);
            const vehicle = vehicles.find((item) => item.id === card.vehicle_id);
            const technician = technicians.find((item) => item.id === card.assigned_technician_id);
            const notificationOptions = [
              ["booking_confirmed", "Booking Confirmed"],
              ["vehicle_checked_in", "Vehicle Checked In"],
              ["estimate_ready", "Estimate Ready"],
              ["repair_started", "Repair Started"],
              ["vehicle_ready", "Vehicle Ready"],
              ["service_completed", "Service Completed"],
              ["payment_reminder", "Payment Reminder"],
              ["next_service_reminder", "Next Service Reminder"],
            ] as const;
            const notificationMessages: Record<string, string> = {
              booking_confirmed: `Hello ${customer?.full_name || "there"}, your CK Motors booking for ${vehicle?.registration_number || "your vehicle"} (${card.requested_services || "vehicle service"}) is confirmed. Your job card is ${card.job_card_number}.`,
              vehicle_checked_in: `Hello ${customer?.full_name || "there"}, we have checked in ${vehicle?.registration_number || "your vehicle"} at CK Motors. Job card: ${card.job_card_number}.`,
              estimate_ready: `Hello ${customer?.full_name || "there"}, the estimate for ${vehicle?.registration_number || "your vehicle"} is ready. Please contact CK Motors regarding your ${card.requested_services || "service"}.`,
              repair_started: `Hello ${customer?.full_name || "there"}, work has started on ${vehicle?.registration_number || "your vehicle"} at CK Motors. Job card: ${card.job_card_number}.`,
              vehicle_ready: `Hello ${customer?.full_name || "there"}, ${vehicle?.registration_number || "your vehicle"} is ready for collection at CK Motors. Job card: ${card.job_card_number}.`,
              service_completed: `Hello ${customer?.full_name || "there"}, service for ${vehicle?.registration_number || "your vehicle"} is complete. Please contact CK Motors for your invoice and collection details.`,
              payment_reminder: `Hello ${customer?.full_name || "there"}, this is a friendly reminder to check the outstanding payment on your CK Motors invoice for ${vehicle?.registration_number || "your vehicle"}. Please contact us if you need assistance.`,
              next_service_reminder: `Hello ${customer?.full_name || "there"}, it may be time to plan your next service for ${vehicle?.registration_number || "your vehicle"}. Contact CK Motors to book a convenient appointment.`,
            };
            const whatsappHref = customer?.phone
              ? whatsappUrl(customer.phone, notificationMessages[whatsAppTemplate])
              : "";
            const cardMedia = media.filter((item) => item.job_card_id === card.id);
            const cardHistory = history.filter((item) => item.job_card_id === card.id);
            return (
              <article key={card.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#10151e] text-slate-100">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-5">
                  <div className="min-w-0"><p className="font-mono text-xs font-black tracking-wider text-[#63b4ff]">{card.job_card_number}</p><h3 className="job-card-vehicle-title mt-1 text-lg font-bold text-white">{vehicle?.registration_number || "Vehicle"} · {vehicle ? `${vehicle.brand} ${vehicle.model}` : ""}</h3><p className="mt-1 text-xs text-slate-300">{customer?.full_name || "Customer"}{customer?.phone ? ` · ${customer.phone}` : ""}</p><p className="mt-2 text-xs text-slate-300"><span className="text-sky-300">Technician:</span> {technician?.full_name || "Unassigned"} <span className="text-sky-300">· Mileage:</span> {card.current_mileage?.toLocaleString() || "—"} <span className="text-sky-300">· Fuel:</span> {card.fuel_level || "—"}</p></div>
                  <div className="flex items-start gap-3">
                    <button type="button" onClick={() => startEdit(card)} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-300 hover:border-[#1688ff] hover:text-white">Edit</button>
                    <button type="button" onClick={() => setPrintCard(card)} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-300 hover:border-[#1688ff] hover:text-white"><Printer size={14} /> Print / PDF</button>
                    {whatsappHref && <div className="flex items-center gap-1"><select aria-label="Choose customer WhatsApp message" value={whatsAppTemplate} onChange={(event) => setWhatsAppTemplate(event.target.value)} className="rounded-lg border border-white/10 bg-[#080808] px-2 py-2 text-[10px] text-gray-300">{notificationOptions.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select><a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-900/50 px-3 py-2 text-[10px] font-bold text-emerald-300 hover:bg-emerald-950/40">WhatsApp</a></div>}
                    <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Status<select value={card.status} onChange={(event) => void updateStatus(card, event.target.value as JobStatus)} className="mt-1 block rounded-lg border border-white/10 bg-[#080808] px-3 py-2 text-xs text-white">{statuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select></label>
                  </div>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <div className="space-y-2 text-xs text-slate-100"><p><span className="text-sky-300">Complaint:</span> {card.customer_complaint || "—"}</p><p><span className="text-sky-300">Inspection:</span> {card.inspection_notes || "—"}</p><p><span className="text-sky-300">Requested:</span> {card.requested_services || "—"}</p><p><span className="text-sky-300">Estimate:</span> {card.estimated_completion_at ? new Date(card.estimated_completion_at).toLocaleString() : "—"}</p></div>
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-sky-300">Status history</p>{cardHistory.length ? cardHistory.slice(0, 5).reverse().map((entry) => <p key={entry.id} className="border-l border-[#1688ff]/50 py-1 pl-3 text-[10px] text-slate-200">{label(entry.new_status)} · {new Date(entry.created_at).toLocaleString()}</p>) : <p className="text-xs text-slate-400">No status updates.</p>}</div>
                </div>
                <div className="grid gap-4 border-t border-white/10 p-5 sm:grid-cols-2">
                  {(["before", "after"] as const).map((stage) => (
                    <div key={stage} className="rounded-xl border border-white/10 bg-black/25 p-3 text-slate-100">
                      <div className="mb-3 flex items-center justify-between"><h4 className="text-xs font-black uppercase tracking-wider text-[#8bc9ff]">{stage}</h4><label className={`inline-flex cursor-pointer items-center gap-1 rounded-lg border border-white/10 px-2 py-1 text-[10px] font-bold ${uploading !== null ? "cursor-not-allowed opacity-50" : "hover:border-[#1688ff]"}`}><input disabled={uploading !== null} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" className="sr-only" onChange={(event) => void uploadMedia(card, stage, event)} />{uploading !== null ? "Uploading..." : <><ImagePlus size={13} /> Add media</>}</label></div>
                      <div className="grid grid-cols-2 gap-2">{cardMedia.filter((item) => item.media_stage === stage).map((item) => <div key={item.id} className="relative min-w-0 overflow-hidden rounded-lg bg-black"><button type="button" title="Delete media" onClick={() => void deleteMedia(item)} className="absolute right-1 top-1 z-10 rounded bg-black/80 p-1 text-red-300"><Trash2 size={13} /></button>{item.media_type === "video" ? <video src={item.signedUrl} controls playsInline preload="metadata" className="aspect-video w-full object-cover" /> : <img src={item.signedUrl} alt={item.caption || `${stage} service photo`} loading="lazy" className="aspect-video w-full object-cover" />}{item.caption && <p className="whitespace-pre-wrap break-words p-3 text-sm leading-relaxed text-gray-300">{formatMediaCaption(item.caption)}</p>}</div>)}</div>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="flex items-center gap-2 text-[10px] text-gray-600"><ClipboardList size={14} /><Video size={14} /> Video playback is manual; uploaded media is restricted to the assigned customer&apos;s authenticated account and active staff.</div>
      {printCard && (
        <div className="job-card-print-overlay fixed inset-0 z-[120] overflow-y-auto bg-black/85 p-4 md:p-8">
          <div className="mx-auto max-w-3xl">
            <div className="no-print mb-4 flex justify-end gap-3">
              <button type="button" onClick={() => setPrintCard(null)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-[#111] px-4 py-3 text-xs font-bold"><X size={15} /> Close</button>
              <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-lg bg-[#087fe8] px-5 py-3 text-xs font-bold text-white"><Printer size={15} /> Print / Save PDF</button>
            </div>
            <div className="job-card-print rounded-2xl bg-white p-7 text-black md:p-10">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#1688ff] pb-5">
                <div><p className="text-xl font-black">CK MOTORS AND CLEANING CENTER</p><p className="mt-1 text-xs text-gray-600">Imbulgoda, Akuressa · 077 272 3940 · 077 725 8599</p></div>
                <div className="text-right"><h2 className="text-2xl font-black">JOB CARD</h2><p className="mt-1 font-mono font-bold text-[#087fe8]">{printCard.job_card_number}</p><p className="mt-1 text-xs text-gray-500">Opened: {new Date(printCard.created_at).toLocaleDateString()}</p></div>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 text-sm">
                <div><p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Customer</p><p className="mt-2 font-bold">{customers.find((item) => item.id === printCard.customer_id)?.full_name || "Customer"}</p><p className="text-gray-600">{customers.find((item) => item.id === printCard.customer_id)?.phone || ""}</p></div>
                <div><p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Vehicle</p><p className="mt-2 font-bold">{vehicles.find((item) => item.id === printCard.vehicle_id)?.registration_number || ""}</p><p className="text-gray-600">{vehicles.find((item) => item.id === printCard.vehicle_id)?.brand} {vehicles.find((item) => item.id === printCard.vehicle_id)?.model}</p><p className="text-gray-600">Mileage: {printCard.current_mileage?.toLocaleString() || "—"} km · Fuel: {printCard.fuel_level || "—"}</p></div>
              </div>
              <div className="mt-6 space-y-4 text-sm">
                <p><b>Customer complaint:</b><br />{printCard.customer_complaint || "—"}</p>
                <p><b>Inspection notes:</b><br />{printCard.inspection_notes || "—"}</p>
                <p><b>Requested services:</b><br />{printCard.requested_services || "—"}</p>
                <p><b>Assigned technician:</b> {technicians.find((item) => item.id === printCard.assigned_technician_id)?.full_name || "Unassigned"}</p>
                <p><b>Estimated completion:</b> {printCard.estimated_completion_at ? new Date(printCard.estimated_completion_at).toLocaleString() : "—"}</p>
                <p><b>Current status:</b> {label(printCard.status)}</p>
                <p><b>Internal notes:</b><br />{printCard.internal_notes || "—"}</p>
              </div>
              <div className="mt-12 grid grid-cols-2 gap-12 text-center text-xs text-gray-600"><p className="border-t border-gray-400 pt-2">Customer signature</p><p className="border-t border-gray-400 pt-2">CK Motors representative</p></div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
