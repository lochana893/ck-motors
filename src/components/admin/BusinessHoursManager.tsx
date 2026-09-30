"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type BusinessHours = {
  day_of_week: number;
  is_open: boolean;
  opens_at: string;
  closes_at: string;
  slot_duration_minutes: number;
  max_bookings_per_slot: number;
};
type BlockedDate = { blocked_date: string; reason: string | null };
const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function BusinessHoursManager() {
  const supabase = useMemo(() => createClient(), []);
  const [hours, setHours] = useState<BusinessHours[]>([]);
  const [blockedDates, setBlockedDates] = useState<BlockedDate[]>([]);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [savingDay, setSavingDay] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const [hoursResult, blockedResult] = await Promise.all([
      supabase.from("business_hours").select("day_of_week, is_open, opens_at, closes_at, slot_duration_minutes, max_bookings_per_slot").order("day_of_week"),
      supabase.from("blocked_booking_dates").select("blocked_date, reason").order("blocked_date", { ascending: true }).limit(500),
    ]);
    const loadError = hoursResult.error || blockedResult.error;
    if (loadError) {
      setError(`Booking availability could not be loaded: ${loadError.message}`);
      return;
    }
    setHours((hoursResult.data || []) as BusinessHours[]);
    setBlockedDates((blockedResult.data || []) as BlockedDate[]);
  }, [supabase]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function saveDay(day: BusinessHours) {
    setError("");
    setNotice("");
    setSavingDay(day.day_of_week);
    const { error: updateError } = await supabase.from("business_hours").update({
      is_open: day.is_open,
      opens_at: day.opens_at,
      closes_at: day.closes_at,
      slot_duration_minutes: Number(day.slot_duration_minutes),
      max_bookings_per_slot: Number(day.max_bookings_per_slot),
    }).eq("day_of_week", day.day_of_week);
    setSavingDay(null);
    if (updateError) {
      setError(`Unable to save ${weekdays[day.day_of_week]} hours: ${updateError.message}`);
      return;
    }
    setNotice(`${weekdays[day.day_of_week]} availability updated.`);
    await load();
  }

  async function addBlockedDate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!date) {
      setError("Choose a date to block.");
      return;
    }
    const { error: insertError } = await supabase.from("blocked_booking_dates").insert({ blocked_date: date, reason: reason.trim() || null });
    if (insertError) {
      setError(insertError.code === "23505" ? "That date is already blocked." : `Unable to block the date: ${insertError.message}`);
      return;
    }
    setDate("");
    setReason("");
    setNotice("Date blocked for new bookings.");
    await load();
  }

  async function removeBlockedDate(item: BlockedDate) {
    if (!window.confirm(`Allow bookings again on ${item.blocked_date}?`)) return;
    const { error: deleteError } = await supabase.from("blocked_booking_dates").delete().eq("blocked_date", item.blocked_date);
    if (deleteError) setError(`Unable to remove blocked date: ${deleteError.message}`);
    else {
      setNotice("Blocked date removed.");
      await load();
    }
  }

  return (
    <section className="space-y-6">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#63b4ff]">Appointment Setup</p><h2 className="mt-1 text-2xl font-black">Business Hours & Booking Slots</h2><p className="mt-2 text-xs text-gray-500">Available slots are checked again in the database when a booking is submitted, so parallel requests cannot overbook a slot.</p></div>
      {error && <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/20 p-3 text-xs text-red-300">{error}</p>}
      {notice && <p role="status" className="rounded-lg border border-[#1688ff]/30 bg-[#101d2b] p-3 text-xs text-[#b9ddff]">{notice}</p>}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[#111]">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="border-b border-white/10 text-[10px] uppercase tracking-wider text-gray-500"><tr><th className="p-4">Day</th><th className="p-4">Open</th><th className="p-4">Opening</th><th className="p-4">Closing</th><th className="p-4">Slot minutes</th><th className="p-4">Bookings per slot</th><th className="p-4"></th></tr></thead>
          <tbody>{hours.map((day) => <tr key={day.day_of_week} className="border-b border-white/5 last:border-0">
            <td className="p-4 font-bold">{weekdays[day.day_of_week]}</td>
            <td className="p-4"><input aria-label={`${weekdays[day.day_of_week]} open`} type="checkbox" checked={day.is_open} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, is_open: event.target.checked } : item))} /></td>
            <td className="p-4"><input aria-label={`${weekdays[day.day_of_week]} opening time`} type="time" value={day.opens_at.slice(0, 5)} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, opens_at: event.target.value } : item))} className="rounded border border-white/10 bg-[#080808] px-2 py-1" /></td>
            <td className="p-4"><input aria-label={`${weekdays[day.day_of_week]} closing time`} type="time" value={day.closes_at.slice(0, 5)} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, closes_at: event.target.value } : item))} className="rounded border border-white/10 bg-[#080808] px-2 py-1" /></td>
            <td className="p-4"><select aria-label={`${weekdays[day.day_of_week]} slot length`} value={day.slot_duration_minutes} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, slot_duration_minutes: Number(event.target.value) } : item))} className="rounded border border-white/10 bg-[#080808] px-2 py-2">{[15, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></td>
            <td className="p-4"><input aria-label={`${weekdays[day.day_of_week]} bookings per slot`} type="number" min="1" max="100" value={day.max_bookings_per_slot} onChange={(event) => setHours((current) => current.map((item) => item.day_of_week === day.day_of_week ? { ...item, max_bookings_per_slot: Number(event.target.value) } : item))} className="w-20 rounded border border-white/10 bg-[#080808] px-2 py-2" /></td>
            <td className="p-4"><button type="button" disabled={savingDay === day.day_of_week} onClick={() => void saveDay(day)} className="rounded-lg bg-[#087fe8] px-3 py-2 text-[10px] font-bold disabled:opacity-50">{savingDay === day.day_of_week ? "Saving..." : "Save"}</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#111] p-5 md:p-7">
        <h3 className="font-black">Blocked dates & holidays</h3>
        <form onSubmit={addBlockedDate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <label className="text-xs font-bold text-gray-400">Date<input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white" /></label>
          <label className="text-xs font-bold text-gray-400">Reason<input maxLength={250} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Holiday, workshop closure..." className="mt-2 w-full rounded-lg border border-white/10 bg-[#080808] px-3 py-3 text-sm text-white" /></label>
          <button className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg bg-[#087fe8] px-4 py-3 text-xs font-bold"><CalendarPlus size={15} /> Block date</button>
        </form>
        <div className="mt-4 space-y-2">{blockedDates.map((item) => <div key={item.blocked_date} className="flex items-center justify-between gap-3 rounded-lg border border-white/5 bg-black/20 p-3"><p className="text-xs"><b>{item.blocked_date}</b><span className="ml-3 text-gray-500">{item.reason || "Closed"}</span></p><button type="button" onClick={() => void removeBlockedDate(item)} aria-label={`Remove blocked date ${item.blocked_date}`} className="rounded border border-red-900/50 p-2 text-red-300"><Trash2 size={14} /></button></div>)}</div>
      </div>
    </section>
  );
}
