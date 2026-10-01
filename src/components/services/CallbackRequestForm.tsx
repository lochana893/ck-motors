"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { trackPublicEvent } from "@/lib/analytics-events";

export default function CallbackRequestForm({
  serviceId,
  serviceName,
  onCancel,
  onSuccess,
}: {
  serviceId: string | null;
  serviceName: string | null;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (trimmedPhone.replace(/[^\d]/g, "").length < 7) {
      setError("Please enter a valid phone number.");
      return;
    }

    setSubmitting(true);
    setError("");
    const supabase = createClient();
    const { error: insertError } = await supabase.from("callback_requests").insert({
      customer_name: trimmedName.slice(0, 150),
      phone: trimmedPhone.slice(0, 30),
      service_id: serviceId,
      service_name: serviceName,
      preferred_call_time: preferredTime.trim().slice(0, 100) || null,
      message: message.trim().slice(0, 500) || null,
    });
    setSubmitting(false);

    if (insertError) {
      setError(`Unable to send your callback request: ${insertError.message}`);
      return;
    }

    trackPublicEvent("callback_requested", { serviceId, serviceName });
    onSuccess();
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-slate-900">Request a Callback</p>
      {serviceName && (
        <p className="text-xs text-slate-500">
          Service: <span className="font-semibold text-slate-700">{serviceName}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      )}
      <label className="block text-xs font-semibold text-slate-600">
        Name *
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={150}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-500"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Phone Number *
        <input
          required
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          maxLength={30}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-500"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Preferred Call Time
        <input
          value={preferredTime}
          onChange={(event) => setPreferredTime(event.target.value)}
          placeholder="e.g. Today afternoon"
          maxLength={100}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-500"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-600">
        Short Message
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-red-500"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Sending..." : "Send Request"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
