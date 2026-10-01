"use client";

import { createElement, useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  Clock3,
  Copy,
  MapPin,
  MessageCircle,
  PhoneCall,
  Share2,
  X,
} from "lucide-react";
import { resolveServiceIcon } from "@/lib/service-icons";
import { phoneUrl, whatsappUrl, type SiteSettings } from "@/lib/site-settings";
import { formatDurationMinutes, getWorkshopStatus, type BusinessHoursRow } from "@/lib/business-hours";
import { trackPublicEvent } from "@/lib/analytics-events";
import CallbackRequestForm from "@/components/services/CallbackRequestForm";

const DEFAULT_PRIMARY_PHONE = "0772723940";
const DEFAULT_SECONDARY_PHONE = "0777258599";

function formatPhoneDisplay(number: string) {
  const digits = number.replace(/[^\d]/g, "");
  if (digits.length !== 10) return number;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

export type ServiceContactModalService = {
  id: string;
  name: string;
  category: string | null;
  icon_name: string | null;
  estimated_duration_minutes: number | null;
};

export default function ServiceContactModal({
  service,
  priceLabel,
  settings,
  businessHours,
  blockedDates,
  nextAvailableLabel,
  bookingHref,
  onClose,
}: {
  service: ServiceContactModalService;
  priceLabel: string;
  settings: SiteSettings | null;
  businessHours: BusinessHoursRow[];
  blockedDates: string[];
  nextAvailableLabel: string | null;
  bookingHref: string;
  onClose: () => void;
}) {
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [shareFeedback, setShareFeedback] = useState("");
  const [callbackState, setCallbackState] = useState<"hidden" | "form" | "success">("hidden");

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const ServiceIcon = resolveServiceIcon(service.icon_name);
  const resolvedPrimary = settings?.primary_phone?.trim() || DEFAULT_PRIMARY_PHONE;
  const resolvedSecondary = settings?.secondary_phone?.trim() || DEFAULT_SECONDARY_PHONE;
  const whatsappNumber = settings?.whatsapp_number?.trim() || "";
  const showRealPrice = Boolean(priceLabel) && priceLabel !== "Price on request";
  const whatsappMessage = `Hello CK Motors, I would like to know the price and details for ${service.name}.${showRealPrice ? ` Displayed price: ${priceLabel}` : ""}`;
  const whatsappHref = whatsappNumber ? whatsappUrl(whatsappNumber, whatsappMessage) : "";
  const durationLabel = formatDurationMinutes(service.estimated_duration_minutes);
  const workshopStatus = getWorkshopStatus(businessHours, blockedDates);

  async function copyNumber(number: string) {
    try {
      await navigator.clipboard.writeText(number);
      setCopiedNumber(number);
      window.setTimeout(() => setCopiedNumber((current) => (current === number ? null : current)), 2000);
    } catch {
      // Clipboard API may be unavailable in some browsers; fail silently.
    }
  }

  async function shareService() {
    trackPublicEvent("service_shared", { serviceId: service.id, serviceName: service.name });
    const shareUrl = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: `${service.name} at CK Motors`, text: `${service.name} at CK Motors`, url: shareUrl });
      } catch {
        // User cancelled the native share sheet; nothing to report.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareFeedback("Link copied");
      window.setTimeout(() => setShareFeedback(""), 2000);
    } catch {
      // Clipboard API unavailable; silently ignore.
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-contact-title"
        className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl sm:max-h-[90dvh] sm:w-[calc(100%-24px)] sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="service-contact-title" className="text-lg font-black text-slate-900">Contact CK Motors</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close contact popup"
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
            {createElement(ServiceIcon, { size: 21, "aria-hidden": true })}
          </span>
          <div className="min-w-0">
            <p className="break-words text-base font-bold text-slate-900">{service.name}</p>
            {service.category && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{service.category}</p>}
          </div>
        </div>

        <p className="mt-3 text-sm font-bold text-red-600">{priceLabel}</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Call us for pricing and more information about {service.name}.
        </p>

        {(durationLabel || workshopStatus || settings?.opening_hours) && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {durationLabel && (
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                <Clock3 size={14} className="shrink-0 text-slate-400" aria-hidden /> Approx. duration: {durationLabel}
              </div>
            )}
            {workshopStatus ? (
              <div
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                  workshopStatus.isOpen
                    ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                    : "border-red-300 bg-red-50 text-red-800"
                }`}
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${workshopStatus.isOpen ? "bg-emerald-600" : "bg-red-600"}`} aria-hidden />
                {workshopStatus.label}{workshopStatus.detail ? ` · ${workshopStatus.detail}` : ""}
              </div>
            ) : settings?.opening_hours ? (
              <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                <Clock3 size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden />
                <span className="whitespace-pre-line">{settings.opening_hours}</span>
              </div>
            ) : null}
          </div>
        )}

        {nextAvailableLabel && (
          <div className="mt-2 flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-semibold text-sky-800">
            <Calendar size={14} className="shrink-0 text-sky-500" aria-hidden /> {nextAvailableLabel}
          </div>
        )}

        <div className="mt-5 flex flex-col gap-3">
          {[resolvedPrimary, resolvedSecondary].map((number) => (
            <div key={number} className="flex items-stretch gap-2">
              <a
                href={phoneUrl(number)}
                onClick={() => trackPublicEvent("service_phone_clicked", { serviceId: service.id, serviceName: service.name })}
                className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3.5 text-base font-bold text-white transition hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                <PhoneCall size={18} className="shrink-0 text-white" aria-hidden /> {formatPhoneDisplay(number)}
              </a>
              <button
                type="button"
                onClick={() => void copyNumber(number)}
                aria-label={`Copy ${formatPhoneDisplay(number)}`}
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
              >
                {copiedNumber === number ? <Check size={14} className="text-emerald-600" aria-hidden /> : <Copy size={14} aria-hidden />}
                {copiedNumber === number ? "Copied!" : "Copy"}
              </button>
            </div>
          ))}

          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackPublicEvent("service_whatsapp_clicked", { serviceId: service.id, serviceName: service.name })}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3.5 text-base font-bold text-white transition hover:bg-[#1ebe5a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
            >
              <MessageCircle size={18} className="text-white" aria-hidden /> WhatsApp CK Motors
            </a>
          )}

          <Link
            href={bookingHref}
            onClick={() => trackPublicEvent("service_book_clicked", { serviceId: service.id, serviceName: service.name })}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-red-600 bg-red-600 px-4 py-3.5 text-base font-black text-white transition hover:bg-red-700"
          >
            Book This Service
          </Link>

          {callbackState === "hidden" && (
            <button
              type="button"
              onClick={() => setCallbackState("form")}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
            >
              Request a Callback
            </button>
          )}

          {callbackState === "form" && (
            <CallbackRequestForm
              serviceId={service.id}
              serviceName={service.name}
              onCancel={() => setCallbackState("hidden")}
              onSuccess={() => setCallbackState("success")}
            />
          )}

          {callbackState === "success" && (
            <p role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
              Callback request sent successfully. CK Motors will contact you soon.
            </p>
          )}

          <div className="flex gap-2">
            {settings?.maps_url && (
              <a
                href={settings.maps_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPublicEvent("service_directions_clicked", { serviceId: service.id, serviceName: service.name })}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-red-300 hover:text-red-600"
              >
                <MapPin size={14} aria-hidden /> Get Directions
              </a>
            )}
            <button
              type="button"
              onClick={() => void shareService()}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-red-300 hover:text-red-600"
            >
              <Share2 size={14} aria-hidden /> {shareFeedback || "Share"}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700 transition hover:border-red-300 hover:text-red-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500"
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
          Final price may vary depending on vehicle condition, parts and inspection.
        </p>
      </div>
    </div>
  );
}
