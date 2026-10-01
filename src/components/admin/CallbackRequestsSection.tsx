"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Clock3, MessageCircle, Phone, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { phoneUrl, whatsappUrl } from "@/lib/site-settings";

type CallbackRequest = {
  id: string;
  customer_name: string;
  phone: string;
  service_id: string | null;
  service_name: string | null;
  preferred_call_time: string | null;
  message: string | null;
  status: "new" | "contacted" | "completed" | "cancelled";
  created_at: string;
  handled_at: string | null;
};

const statusStyles: Record<CallbackRequest["status"], string> = {
  new: "admin-status-pending",
  contacted: "admin-status-info",
  completed: "admin-status-active",
  cancelled: "admin-status-inactive",
};

export default function CallbackRequestsSection({ onCountChange }: { onCountChange?: (count: number) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [requests, setRequests] = useState<CallbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from("callback_requests")
      .select("id, customer_name, phone, service_id, service_name, preferred_call_time, message, status, created_at, handled_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (loadError) {
      setError(`Unable to load callback requests: ${loadError.message}`);
      setLoading(false);
      return;
    }
    const rows = (data || []) as CallbackRequest[];
    setRequests(rows);
    onCountChange?.(rows.filter((row) => row.status === "new").length);
    setLoading(false);
  }, [supabase, onCountChange]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function updateStatus(request: CallbackRequest, status: CallbackRequest["status"]) {
    setUpdatingId(request.id);
    setError("");
    const { data: { user } } = await supabase.auth.getUser();
    const { error: updateError } = await supabase
      .from("callback_requests")
      .update({ status, handled_at: new Date().toISOString(), handled_by: user?.id || null })
      .eq("id", request.id);
    setUpdatingId(null);
    if (updateError) {
      setError(`Unable to update this request: ${updateError.message}`);
      return;
    }
    setRequests((current) => current.map((item) => item.id === request.id ? { ...item, status, handled_at: new Date().toISOString() } : item));
    onCountChange?.(requests.filter((item) => item.id !== request.id && item.status === "new").length);
  }

  if (loading) {
    return <div className="rounded-2xl border border-white/10 bg-[#111] p-10 text-center text-sm text-gray-500">Loading callback requests...</div>;
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-red-500">Customer Interest</p>
        <h2 className="mt-1 text-2xl font-black">Callback Requests</h2>
        <p className="mt-2 text-xs text-gray-500">Visitors who asked CK Motors to call them back from the public Service Contact popup.</p>
      </div>
      {error && <p role="alert" className="rounded-lg border border-red-900/60 bg-red-950/20 px-4 py-3 text-xs text-red-300">{error}</p>}
      {requests.length === 0 ? (
        <div className="flex min-h-40 items-center justify-center rounded-xl border border-dashed border-white/10 text-center text-sm text-gray-600">No callback requests yet.</div>
      ) : (
        <div className="grid gap-3">
          {requests.map((request) => (
            <div key={request.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold">{request.customer_name}</h3>
                    <span className={`admin-status-badge rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wide ${statusStyles[request.status]}`}>{request.status}</span>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{request.phone}{request.service_name ? ` · ${request.service_name}` : ""}</p>
                  {request.preferred_call_time && <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-500"><Clock3 size={12} /> {request.preferred_call_time}</p>}
                  {request.message && <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-relaxed text-gray-400">{request.message}</p>}
                  <p className="mt-2 text-[10px] text-gray-600">{new Date(request.created_at).toLocaleString()}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a href={phoneUrl(request.phone)} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-300 hover:border-[#1688ff] hover:text-[#63b4ff]"><Phone size={12} /> Call</a>
                  <a href={whatsappUrl(request.phone, `Hello ${request.customer_name}, this is CK Motors calling about your callback request${request.service_name ? ` for ${request.service_name}` : ""}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-900/50 px-3 py-2 text-[10px] font-bold text-emerald-300"><MessageCircle size={12} /> WhatsApp</a>
                  {request.status !== "contacted" && <button type="button" disabled={updatingId === request.id} onClick={() => void updateStatus(request, "contacted")} className="rounded-lg border border-white/10 px-3 py-2 text-[10px] font-bold text-gray-300 hover:border-[#1688ff] disabled:opacity-50">Mark Contacted</button>}
                  {request.status !== "completed" && <button type="button" disabled={updatingId === request.id} onClick={() => void updateStatus(request, "completed")} className="inline-flex items-center gap-1 rounded-lg border border-emerald-900/50 px-3 py-2 text-[10px] font-bold text-emerald-300 disabled:opacity-50"><Check size={12} /> Mark Completed</button>}
                  {request.status !== "cancelled" && <button type="button" disabled={updatingId === request.id} onClick={() => void updateStatus(request, "cancelled")} className="inline-flex items-center gap-1 rounded-lg border border-red-900/50 px-3 py-2 text-[10px] font-bold text-red-400 disabled:opacity-50"><X size={12} /> Cancel</button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
