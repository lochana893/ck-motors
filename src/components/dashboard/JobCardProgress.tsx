"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMediaCaption } from "@/lib/media-caption";

type CustomerJobCard = {
  id: string;
  job_card_number: string;
  vehicle_id: string;
  current_mileage: number | null;
  requested_services: string | null;
  status: string;
  created_at: string;
};
type VehicleLabel = { id: string; registration_number: string; brand: string; model: string };
type CustomerMedia = { id: string; job_card_id: string; media_stage: "before" | "after"; media_type: "image" | "video"; storage_path: string; caption: string | null; signedUrl: string };
const progressStatuses = ["booked", "checked_in", "inspection", "diagnosing", "waiting_approval", "repairing", "cleaning", "quality_check", "ready", "delivered"];

function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function JobCardProgress() {
  const supabase = useMemo(() => createClient(), []);
  const [cards, setCards] = useState<CustomerJobCard[]>([]);
  const [vehicles, setVehicles] = useState<VehicleLabel[]>([]);
  const [media, setMedia] = useState<CustomerMedia[]>([]);
  const [error, setError] = useState("");
  const [mediaError, setMediaError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) {
        if (active) setError("Service progress is temporarily unavailable.");
        return;
      }
      if (!authData.user) return;
      const [cardsResult, vehiclesResult, mediaResult] = await Promise.all([
        supabase.from("job_cards").select("id, job_card_number, vehicle_id, current_mileage, requested_services, status, created_at").order("created_at", { ascending: false }).limit(20),
        supabase.from("vehicles").select("id, registration_number, brand, model").eq("user_id", authData.user.id),
        supabase.from("service_media").select("id, job_card_id, media_stage, media_type, storage_path, caption").order("created_at", { ascending: false }).limit(100),
      ]);
      if (!active) return;
      if (cardsResult.error || vehiclesResult.error || mediaResult.error) {
        setError("Service progress is temporarily unavailable.");
        return;
      }
      const loadedMedia = mediaResult.data || [];
      const signedResult = loadedMedia.length
        ? await supabase.storage.from("service-media").createSignedUrls(loadedMedia.map((item) => item.storage_path), 3600)
        : { data: [], error: null };
      if (!active) return;
      if (signedResult.error) {
        setMediaError("Service progress is available, but service media could not be loaded.");
      }
      const signedUrls = new Map((signedResult.data || []).map((item) => [item.path, item.signedUrl]));
      setCards((cardsResult.data || []) as CustomerJobCard[]);
      setVehicles((vehiclesResult.data || []) as VehicleLabel[]);
      setMedia(loadedMedia.flatMap((item) => {
        const signedUrl = signedUrls.get(item.storage_path);
        return signedUrl ? [{ ...item, signedUrl } as CustomerMedia] : [];
      }));
    }
    void load();
    return () => { active = false; };
  }, [supabase]);

  if (error) return <p role="status" className="rounded-xl border border-white/10 bg-[#0d0d0d] p-4 text-xs text-gray-500">{error}</p>;
  if (!cards.length) return null;

  return (
    <section className="mb-8 rounded-2xl border border-white/10 bg-[#0d0d0d] p-5 md:p-6">
      <div className="mb-4"><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#63b4ff]">Workshop updates</p><h2 className="mt-1 text-lg font-black">Current Service Progress</h2></div>
      <div className="space-y-4">
        {cards.slice(0, 4).map((card) => {
          const vehicle = vehicles.find((item) => item.id === card.vehicle_id);
          const currentIndex = progressStatuses.indexOf(card.status);
          const cancelled = card.status === "cancelled";
          const complete = card.status === "delivered";
          const cardMedia = media.filter((item) => item.job_card_id === card.id);
          return (
            <article key={card.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs font-bold text-[#63b4ff]">{card.job_card_number}</p><h3 className="mt-1 text-sm font-bold">{vehicle?.registration_number || "Your vehicle"}{vehicle ? ` · ${vehicle.brand} ${vehicle.model}` : ""}</h3><p className="mt-1 text-xs text-gray-500">{card.requested_services || "Workshop service"}</p></div><span className={`rounded-full px-3 py-1 text-[10px] font-bold ${cancelled ? "bg-red-950/50 text-red-300" : complete ? "bg-emerald-950/50 text-emerald-300" : "bg-[#102741] text-[#8bc9ff]"}`}>{statusLabel(card.status)}</span></div>
              {!cancelled && <ol aria-label="Service progress" className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-10">{progressStatuses.map((status, index) => {
                const reached = complete || (currentIndex >= 0 && index <= currentIndex);
                return <li key={status} className={`rounded-md border px-2 py-2 text-center text-[9px] ${reached ? "border-[#1688ff]/40 bg-[#102741] text-[#b9ddff]" : "border-white/5 bg-white/[0.02] text-gray-600"}`}>{statusLabel(status)}</li>;
              })}</ol>}
              {cardMedia.length > 0 && <div className="mt-4 grid gap-3 sm:grid-cols-2">{(["before", "after"] as const).map((stage) => <div key={stage}><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-500">{stage}</p><div className="grid grid-cols-2 gap-2">{cardMedia.filter((item) => item.media_stage === stage).map((item) => <div key={item.id} className="min-w-0 overflow-hidden rounded-lg bg-black">{item.media_type === "video" ? <video src={item.signedUrl} controls playsInline preload="metadata" className="aspect-video w-full object-cover" /> : <img src={item.signedUrl} alt={item.caption || `${stage} service photo`} loading="lazy" className="aspect-video w-full object-cover" />}{item.caption && <p className="whitespace-pre-wrap break-words p-3 text-sm leading-relaxed text-gray-300">{formatMediaCaption(item.caption)}</p>}</div>)}</div></div>)}</div>}
              {card.current_mileage !== null && <p className="mt-2 text-[10px] text-gray-600">Intake mileage: {card.current_mileage.toLocaleString()} km · {new Date(card.created_at).toLocaleDateString()}</p>}
            </article>
          );
        })}
      </div>
      {mediaError && <p role="status" className="mt-3 text-xs text-amber-300">{mediaError}</p>}
    </section>
  );
}
