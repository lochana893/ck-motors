"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { createElement, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Mail,
  MapPin,
  MapPinned,
  MessageCircle,
  Menu,
  Phone,
  Play,
  ScrollText,
  Shield,
  UserRound,
  Wrench,
  Images,
  X,
} from "lucide-react";
import CKLogo from "@/components/CKLogo";
import SehasCredit from "@/components/SehasCredit";
import PublicVisitCounter from "@/components/PublicVisitCounter";
import { createClient } from "@/lib/supabase/client";
import { signOutAndEndLoginSession } from "@/lib/login-session-client";
import { loadSiteSettings, phoneUrl, validEmail, whatsappUrl, type SiteSettings } from "@/lib/site-settings";
import { resolveServiceIcon } from "@/lib/service-icons";
import { formatMediaCaption } from "@/lib/media-caption";
import { type BusinessHoursRow } from "@/lib/business-hours";
import { trackPublicEvent } from "@/lib/analytics-events";
import ServiceContactModal from "@/components/services/ServiceContactModal";

type PublicService = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_from: number | null;
  estimated_duration_minutes: number | null;
  icon_name: string | null;
  is_popular: boolean;
  is_recommended: boolean;
};

type GalleryItem = {
  id: string;
  title: string | null;
  caption: string | null;
  media_type?: "image" | "video" | null;
  image_url: string | null;
  video_url: string | null;
  thumbnail_url: string | null;
};
type Promotion = {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  start_date: string;
  end_date: string;
  cta_text: string;
  cta_url: string | null;
};
type PublicReview = { id: string; customer_name: string; rating: number; review: string; created_at: string };

const benefits = [
  ["01", "Experienced technicians", "Skilled hands, careful inspections and clear advice."],
  ["02", "Quality parts", "Reliable OEM-grade parts selected for your vehicle."],
  ["03", "Transparent pricing", "Know what your vehicle needs before work begins."],
];

function formatSlotTime(time: string) {
  const [hoursRaw, minutesRaw] = time.split(":").map(Number);
  const period = hoursRaw >= 12 ? "PM" : "AM";
  const hour = hoursRaw % 12 === 0 ? 12 : hoursRaw % 12;
  return `${hour}:${String(minutesRaw || 0).padStart(2, "0")} ${period}`;
}

function formatOpeningTime(time: string) {
  const [hoursRaw, minutesRaw] = time.split(":").map(Number);
  const period = hoursRaw >= 12 ? "PM" : "AM";
  const hour = hoursRaw % 12 || 12;
  return `${hour}:${String(minutesRaw || 0).padStart(2, "0")} ${period}`;
}

function validExternalUrl(value: string | null | undefined) {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [services, setServices] = useState<PublicService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<GalleryItem | null>(null);
  const [contactService, setContactService] = useState<PublicService | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHoursRow[]>([]);
  const [blockedDates, setBlockedDates] = useState<string[]>([]);
  const [nextAvailableLabel, setNextAvailableLabel] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [accountName, setAccountName] = useState("Customer Account");
  const [accountRole, setAccountRole] = useState("customer");
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadServices() {
      const [{ data, error }, galleryResult, promotionResult, reviewResult, siteSettings, businessHoursResult, blockedDatesResult] = await Promise.all([
        supabase
        .from("services")
        .select("id, name, category, description, price_from, estimated_duration_minutes, icon_name, is_popular, is_recommended")
        .eq("active", true)
        .order("name", { ascending: true }),
        supabase
          .from("gallery")
          .select("id, title, caption, image_url, media_type, video_url, thumbnail_url")
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false }),
        supabase
          .from("promotions")
          .select("id, title, description, image_url, start_date, end_date, cta_text, cta_url")
          .eq("is_active", true)
          .lte("start_date", new Date().toISOString().slice(0, 10))
          .gte("end_date", new Date().toISOString().slice(0, 10))
          .order("end_date", { ascending: true })
          .limit(6),
        supabase
          .from("approved_service_reviews")
          .select("id, customer_name, rating, review, created_at")
          .order("created_at", { ascending: false })
          .limit(6),
        loadSiteSettings(supabase),
        supabase
          .from("business_hours")
          .select("day_of_week, is_open, opens_at, closes_at, slot_duration_minutes, max_bookings_per_slot"),
        supabase
          .from("blocked_booking_dates")
          .select("blocked_date")
          .limit(500),
      ]);

      if (error) {
        setServicesError(error.message);
      } else {
        setServices((data || []) as PublicService[]);
      }
      setServicesLoading(false);
      if (!galleryResult.error) setGallery((galleryResult.data || []) as GalleryItem[]);
      if (!promotionResult.error) setPromotions((promotionResult.data || []) as Promotion[]);
      if (!reviewResult.error) setReviews((reviewResult.data || []) as PublicReview[]);
      setSettings(siteSettings);
      if (!businessHoursResult.error) setBusinessHours((businessHoursResult.data || []) as BusinessHoursRow[]);
      if (!blockedDatesResult.error) {
        setBlockedDates((blockedDatesResult.data || []).map((row) => (row as { blocked_date: string }).blocked_date));
      }

      const todayKey = new Date().toISOString().slice(0, 10);
      const tomorrowKey = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const [todaySlots, tomorrowSlots] = await Promise.all([
        supabase.rpc("get_available_booking_slots", { target_date: todayKey }),
        supabase.rpc("get_available_booking_slots", { target_date: tomorrowKey }),
      ]);
      const today = (todaySlots.data || []) as Array<{ slot_time: string; remaining_capacity: number }>;
      const tomorrow = (tomorrowSlots.data || []) as Array<{ slot_time: string; remaining_capacity: number }>;
      if (today.length > 0) {
        setNextAvailableLabel("Available today");
      } else if (tomorrow.length > 0) {
        setNextAvailableLabel(`Next available: Tomorrow ${formatSlotTime(tomorrow[0].slot_time)}`);
      } else {
        setNextAvailableLabel(null);
      }
    }

    void loadServices();
  }, [supabase]);

  useEffect(() => {
    if (!selectedGallery) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedGallery(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selectedGallery]);

  useEffect(() => {
    let mounted = true;
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!mounted) return;
      setLoggedIn(Boolean(data.user));
      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("full_name, role").eq("id", data.user.id).maybeSingle();
        if (mounted && profile) {
          setAccountName(profile.full_name || "Customer Account");
          setAccountRole(profile.role || "customer");
        }
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setLoggedIn(Boolean(session?.user));
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  const site = settings;
  const contactItems = [
    site?.primary_phone && { icon: Phone, label: "Phone", value: site.primary_phone, href: phoneUrl(site.primary_phone) },
    site?.secondary_phone && { icon: Phone, label: "Phone", value: site.secondary_phone, href: phoneUrl(site.secondary_phone) },
    site?.whatsapp_number && { icon: MessageCircle, label: "WhatsApp", value: site.whatsapp_number, href: whatsappUrl(site.whatsapp_number, site.whatsapp_message) },
    site?.email && validEmail(site.email) && { icon: Mail, label: "Email", value: site.email, href: `mailto:${site.email}` },
    site?.address && { icon: MapPin, label: "Address", value: [site.address, site.city_area].filter(Boolean).join(", "), href: site.maps_url },
    site?.maps_url && !site.address && { icon: MapPin, label: "View location", value: "Open Google Maps", href: site.maps_url },
    site?.opening_hours && { icon: Clock3, label: "Opening hours", value: site.opening_hours, href: null },
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; value: string; href: string | null }>;
  const openingDayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const openingHoursByDay = new Map(businessHours.map((hours) => [hours.day_of_week, hours]));
  const footerPhone = site?.primary_phone.trim() || "077 272 3940";
  const footerPhoneHref = `tel:${footerPhone.replace(/[^\d+]/g, "")}`;
  const footerWhatsappUrl = site?.whatsapp_number
    ? whatsappUrl(site.whatsapp_number, site.whatsapp_message)
    : "";
  const footerAddress = [site?.address, site?.city_area].filter(Boolean).join(", ");
  const footerMapsUrl = validExternalUrl(site?.maps_url) ? site?.maps_url : "";

  return (
    <main id="top" className="min-h-screen bg-[#f5f6f8] text-slate-900">
      <nav className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-6 px-5 sm:px-8">
          <Link href="/" aria-label="CK Motors home" className="shrink-0">
            <CKLogo size="small" className="w-[118px] sm:w-[132px]" />
          </Link>
          <div className="hidden items-center gap-7 text-sm font-medium text-slate-600 lg:flex">
            <a href="#top" className="transition hover:text-red-600">Home</a>
            <a href="#services" className="transition hover:text-red-600">Services</a>
            <a href="#why-us" className="transition hover:text-red-600">Why us</a>
            <a href="#process" className="transition hover:text-red-600">Our process</a>
            <a href="#gallery" className="transition hover:text-red-600">Gallery</a>
            <a href="#contact" className="transition hover:text-red-600">Contact</a>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {loggedIn ? <div className="relative hidden sm:block"><button type="button" onClick={() => setAccountOpen((open) => !open)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">{accountName} <span aria-hidden>▾</span></button>{accountOpen && <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 text-sm font-medium shadow-xl"><Link href={accountRole === "admin" || accountRole === "staff" ? "/admin" : "/dashboard?section=dashboard"} className="block rounded-lg px-3 py-2 hover:bg-slate-50">{accountRole === "admin" || accountRole === "staff" ? "Admin Dashboard" : "Dashboard"}</Link>{accountRole === "admin" && <><Link href="/admin?section=customers" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Customer Management</Link><Link href="/admin?section=gallery" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Gallery Management</Link></>}{accountRole === "customer" && <><Link href="/dashboard?section=vehicles" className="block rounded-lg px-3 py-2 hover:bg-slate-50">My Vehicles</Link><Link href="/dashboard?section=bookings" className="block rounded-lg px-3 py-2 hover:bg-slate-50">My Bookings</Link><Link href="/dashboard?section=history" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Service History</Link><Link href="/dashboard?section=messages" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Messages</Link><Link href="/dashboard?section=notifications" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Notifications</Link><Link href="/dashboard?section=profile" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Profile</Link></> }<button type="button" onClick={async () => { await signOutAndEndLoginSession(supabase); setLoggedIn(false); setAccountOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50">Logout</button></div>}</div> : <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:block">Customer login</Link>}
            <Link href={loggedIn ? "/dashboard?section=bookings" : "/register"} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 sm:px-5">
              Book a service <ArrowRight size={16} />
            </Link>
            <button onClick={() => setMobileMenuOpen((open) => !open)} className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}>{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          </div>
        </div>
        {mobileMenuOpen && <div className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden"><div className="grid gap-2 text-sm font-medium text-slate-700"><a href="#services" onClick={() => setMobileMenuOpen(false)}>Services</a><a href="#why-us" onClick={() => setMobileMenuOpen(false)}>Why us</a><a href="#process" onClick={() => setMobileMenuOpen(false)}>Our process</a><a href="#gallery" onClick={() => setMobileMenuOpen(false)}>Gallery</a><a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>{loggedIn ? <><Link href={accountRole === "admin" || accountRole === "staff" ? "/admin" : "/dashboard?section=dashboard"} onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>{accountRole === "customer" && <><Link href="/dashboard?section=vehicles" onClick={() => setMobileMenuOpen(false)}>Vehicles</Link><Link href="/dashboard?section=bookings" onClick={() => setMobileMenuOpen(false)}>Bookings</Link><Link href="/dashboard?section=messages" onClick={() => setMobileMenuOpen(false)}>Messages</Link><Link href="/dashboard?section=notifications" onClick={() => setMobileMenuOpen(false)}>Notifications</Link><Link href="/dashboard?section=profile" onClick={() => setMobileMenuOpen(false)}>Profile</Link></>}<button type="button" className="text-left" onClick={async () => { await signOutAndEndLoginSession(supabase); setMobileMenuOpen(false); setLoggedIn(false); }}>Logout</button></> : <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Customer login</Link>}</div></div>}
      </nav>

      <section className="relative overflow-hidden bg-[#17191f]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_35%,rgba(220,38,38,0.28),transparent_33%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:py-28">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-red-400/30 bg-red-500/10 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-red-300">
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" /> {site?.hero_eyebrow || "Drive with confidence"}
            </div>
            <h1 className="max-w-2xl text-4xl font-black leading-[1.06] tracking-tight text-white sm:text-6xl">
              {site?.hero_heading || "Professional vehicle care, done right."}
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              {site?.hero_description || "Full-service maintenance, repairs, diagnostics and detailing from a team that treats your vehicle like their own."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={loggedIn ? "/dashboard?section=bookings" : "/register"} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700">{site?.primary_cta_text || "Book a service"} <ArrowRight size={17} /></Link>
              <a href="#services" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-bold text-white transition hover:border-white/50">{site?.secondary_cta_text || "Explore services"} <ChevronRight size={17} /></a>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-sm text-slate-300">
              {["Certified technicians", "Quality parts", "Honest pricing"].map((item) => <span key={item} className="inline-flex items-center gap-2"><CheckCircle2 size={16} className="text-red-400" />{item}</span>)}
            </div>
          </div>
          <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/20 backdrop-blur sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-red-300">The CK standard</p><h2 className="mt-2 text-2xl font-bold text-white">Care that keeps you moving.</h2></div>
              <BadgeCheck className="text-red-400" size={32} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["10+", "Years experience"], ["5,000+", "Vehicles serviced"], ["98%", "Customer satisfaction"], ["50+", "Services available"]].map(([value, label]) => <div key={label} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-2xl font-black text-white">{value}</div><div className="mt-1 text-xs text-slate-400">{label}</div></div>)}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-xl bg-red-600 p-4 text-sm font-semibold text-white"><Clock3 size={19} /> Same-day appointments available <ArrowRight className="ml-auto" size={17} /></div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">What we do</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Complete automotive services</h2><p className="mt-4 leading-7 text-slate-500">From routine care to complex repairs, our workshop combines experienced people with dependable equipment.</p></div>
        {servicesLoading ? (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Loading services...</div>
        ) : servicesError ? (
          <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-600">Services are temporarily unavailable.</div>
        ) : services.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Our service menu is being updated. Please contact CK Motors for assistance.</div>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => {
              const priceLabel = service.price_from !== null ? `From LKR ${Number(service.price_from).toLocaleString()}` : "Price on request";
              return <article key={service.id} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-md"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600">{createElement(resolveServiceIcon(service.icon_name), { size: 21 })}</div><div className="flex flex-wrap items-center justify-end gap-1.5"><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">{service.category || "Automotive"}</span>{service.is_popular && <span className="rounded-full border border-amber-300 bg-amber-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-amber-800">Popular</span>}{service.is_recommended && <span className="rounded-full border border-sky-300 bg-sky-100 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-sky-800">Recommended</span>}</div></div><h3 className="mt-5 text-lg font-bold">{service.name}</h3><p className="mt-2 min-h-14 text-sm leading-6 text-slate-500">{service.description || "Professional vehicle care from CK Motors."}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><button type="button" onClick={() => { trackPublicEvent("service_price_opened", { serviceId: service.id, serviceName: service.name }); setContactService(service); }} className="inline-flex cursor-pointer items-center gap-1.5 rounded-md text-sm font-bold text-red-600 transition-colors hover:text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500" aria-label={`Contact CK Motors about pricing for ${service.name}`}><Phone size={14} aria-hidden /> {priceLabel}</button><Link href={loggedIn ? "/dashboard?section=bookings" : "/register"} className="text-sm font-bold text-slate-700 transition group-hover:text-red-600">Book now <span aria-hidden>→</span></Link></div></article>;
            })}
          </div>
        )}
      </section>

      <section id="why-us" className="border-y border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Why CK Motors</p><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A better way to look after your vehicle.</h2><p className="mt-5 leading-7 text-slate-500">We make servicing straightforward: clear communication, careful workmanship and a record of every visit.</p></div>
          <div className="grid gap-4 sm:grid-cols-3">{benefits.map(([number, title, text]) => <div key={number} className="rounded-2xl bg-[#f8f9fb] p-5"><span className="text-sm font-black text-red-600">{number}</span><h3 className="mt-8 font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p></div>)}</div>
        </div>
      </section>

      {gallery.length > 0 && (
        <section id="gallery" className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Our workshop</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">A closer look at CK Motors</h2>
            <p className="mt-4 leading-7 text-slate-500">A closer look at our workshop, vehicle care and completed work.</p>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-3">
            {gallery.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedGallery(item)} aria-label={`Open ${item.media_type === "video" ? "video" : "image"}: ${item.title || "CK Motors workshop media"}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:border-[#1688ff]/60 hover:shadow-lg">
                <span className="relative block aspect-[4/3] overflow-hidden bg-[#080c12]">
                  {item.media_type === "video" && item.video_url ? (
                    <>
                      <video src={item.video_url} poster={item.thumbnail_url || undefined} playsInline preload="metadata" muted className="h-full w-full object-cover" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/20 text-white transition group-hover:bg-black/35"><span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/50 bg-[#080c12]/70 text-[#63b4ff]"><Play size={21} fill="currentColor" /></span></span>
                      <span className="absolute left-3 top-3 rounded-md border border-white/20 bg-black/75 px-2 py-1 text-[10px] font-bold tracking-wider text-white">VIDEO</span>
                    </>
                  ) : item.image_url ? (
                    <>
                      <img src={item.image_url} alt={item.title || "CK Motors workshop"} loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      <span className="absolute left-3 top-3 rounded-md border border-white/20 bg-black/75 px-2 py-1 text-[10px] font-bold tracking-wider text-white">IMAGE</span>
                    </>
                  ) : null}
                </span>
                {(item.title || item.caption) && <span className="block min-w-0 border-t border-slate-100 p-4"><strong className="block break-words text-sm">{item.title}</strong>{item.caption && <span className="mt-2 block whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">{formatMediaCaption(item.caption)}</span>}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="process" className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="rounded-2xl bg-[#17191f] px-6 py-12 text-white sm:px-12"><div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Simple from start to finish</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Book. Inspect. Repair. Drive.</h2></div><div className="mt-10 grid gap-6 sm:grid-cols-4">{["Book your visit", "We inspect", "We get to work", "Drive with confidence"].map((step, index) => <div key={step} className="border-l border-white/15 pl-4"><div className="text-sm font-black text-red-400">0{index + 1}</div><div className="mt-3 font-bold">{step}</div></div>)}</div></div></section>

      {promotions.length > 0 && (
        <section className="border-y border-[#223147] bg-[#0a1019]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <div className="mb-8 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63b4ff]">Limited-time offers</p><h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Current CK Motors promotions</h2></div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{promotions.map((promotion) => <article key={promotion.id} className="overflow-hidden rounded-2xl border border-white/10 bg-[#10151e] shadow-xl shadow-black/20">{promotion.image_url && <img src={promotion.image_url} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />}<div className="p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#63b4ff]">Offer until {new Date(`${promotion.end_date}T00:00:00`).toLocaleDateString()}</p><h3 className="mt-2 text-lg font-black text-white">{promotion.title}</h3><p className="mt-2 text-sm leading-6 text-slate-400">{promotion.description}</p><a href={promotion.cta_url || "#contact"} target={promotion.cta_url?.startsWith("http") ? "_blank" : undefined} rel={promotion.cta_url?.startsWith("http") ? "noopener noreferrer" : undefined} className="mt-5 inline-flex rounded-lg border border-[#1688ff]/50 px-4 py-2.5 text-xs font-bold text-[#8bc9ff] transition hover:bg-[#1688ff]/10">{promotion.cta_text}</a></div></article>)}</div>
          </div>
        </section>
      )}

      {reviews.length > 0 && (
        <section className="bg-[#0e1117]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
            <div className="mb-8 max-w-2xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-[#63b4ff]">Customer experiences</p><h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">Trusted by drivers</h2></div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{reviews.map((review) => <article key={review.id} className="rounded-2xl border border-white/10 bg-[#141a23] p-5"><p aria-label={`${review.rating} out of 5 stars`} className="text-lg tracking-widest text-[#63b4ff]">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p><p className="mt-3 text-sm leading-6 text-slate-300">{review.review}</p><p className="mt-5 border-t border-white/10 pt-4 text-xs font-bold text-white">{review.customer_name}</p></article>)}</div>
          </div>
        </section>
      )}

      <section id="contact" className="bg-red-600"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 text-white sm:px-8"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><h2 className="text-2xl font-black">{site?.contact_heading || "Ready for a smoother drive?"}</h2><p className="mt-2 text-sm text-red-100">{site?.contact_description || "Create your customer account and schedule your next service in minutes."}</p></div><Link href="/register" className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50">Schedule service <ArrowRight size={17} /></Link></div>{contactItems.length > 0 && <div className="grid gap-3 border-t border-white/20 pt-6 sm:grid-cols-2 lg:grid-cols-4">{contactItems.map(({ icon: Icon, label, value, href }) => { const content = <span className="flex min-w-0 items-start gap-3 rounded-xl bg-black/10 p-3 transition hover:bg-black/20"><Icon size={18} className="mt-0.5 shrink-0" /><span className="min-w-0"><span className="block text-xs text-red-100">{label}</span><span className="block whitespace-pre-line text-sm font-semibold">{value}</span></span></span>; return href ? <a key={`${label}-${value}`} href={href} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined}>{content}</a> : <div key={`${label}-${value}`}>{content}</div>; })}</div>}</div></section>

      <footer className="border-t-4 border-red-600 bg-[#101318] text-slate-300">
        <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
          <div className="grid grid-cols-1 gap-9 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Link href="/" aria-label="CK Motors home" className="inline-flex cursor-pointer">
                <CKLogo size="small" className="w-[120px] brightness-0 invert" />
              </Link>
              <p className="mt-3 text-sm font-semibold uppercase tracking-wider text-slate-300">
                {site?.tagline || "Drive With Confidence"}
              </p>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Quick Links</h3>
              <div className="mt-4 grid gap-3 text-sm">
                <a href="#services" className="inline-flex w-fit cursor-pointer items-center gap-2 transition-colors hover:text-white"><Wrench size={15} aria-hidden />Services</a>
                <a href="#gallery" className="inline-flex w-fit cursor-pointer items-center gap-2 transition-colors hover:text-white"><Images size={15} aria-hidden />Gallery</a>
                <a href="#contact" className="inline-flex w-fit cursor-pointer items-center gap-2 transition-colors hover:text-white"><Phone size={15} aria-hidden />Contact</a>
                <Link href="/login" className="inline-flex w-fit cursor-pointer items-center gap-2 transition-colors hover:text-white"><UserRound size={15} aria-hidden />Customer Login</Link>
                <Link href="/privacy" className="inline-flex w-fit cursor-pointer items-center gap-2 transition-colors hover:text-white"><Shield size={15} aria-hidden />Privacy Policy</Link>
                <Link href="/terms" className="inline-flex w-fit cursor-pointer items-center gap-2 transition-colors hover:text-white"><ScrollText size={15} aria-hidden />Terms &amp; Conditions</Link>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Contact</h3>
              <div className="mt-4 grid justify-items-start gap-3 text-sm">
                <a href={footerPhoneHref} aria-label={`Call CK Motors at ${footerPhone}`} className="inline-flex cursor-pointer items-center gap-2 text-blue-300 transition-colors hover:text-white hover:underline">
                  <Phone size={15} aria-hidden />{footerPhone}
                </a>
                {site?.secondary_phone.trim() && (
                  <a href={`tel:${site.secondary_phone.replace(/[^\d+]/g, "")}`} aria-label={`Call CK Motors at ${site.secondary_phone}`} className="inline-flex cursor-pointer items-center gap-2 text-blue-300 transition-colors hover:text-white hover:underline">
                    <Phone size={15} aria-hidden />{site.secondary_phone}
                  </a>
                )}
                {footerWhatsappUrl && (
                  <a href={footerWhatsappUrl} target="_blank" rel="noopener noreferrer" aria-label="Contact CK Motors on WhatsApp" className="inline-flex cursor-pointer items-center gap-2 text-green-400 transition-colors hover:text-green-300 hover:underline">
                    <MessageCircle size={15} aria-hidden />WhatsApp
                  </a>
                )}
                {site?.email && validEmail(site.email) && (
                  <a href={`mailto:${site.email}`} className="inline-flex cursor-pointer items-center gap-2 text-blue-300 transition-colors hover:text-white hover:underline">
                    <Mail size={15} aria-hidden />{site.email}
                  </a>
                )}
                {footerAddress && (
                  footerMapsUrl
                    ? <a href={footerMapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex cursor-pointer items-center gap-2 transition-colors hover:text-sky-300 hover:underline"><MapPin size={15} aria-hidden />{footerAddress}</a>
                    : <span className="inline-flex items-center gap-2"><MapPin size={15} aria-hidden />{footerAddress}</span>
                )}
                {footerMapsUrl && (
                  <a href={footerMapsUrl} target="_blank" rel="noopener noreferrer" aria-label="View CK Motors on Google Maps" className="inline-flex cursor-pointer items-center gap-2 text-blue-400 transition-colors hover:text-sky-300 hover:underline">
                    <MapPinned size={15} aria-hidden />View on Google Maps ↗
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="mt-9 grid gap-8 border-t border-white/10 pt-7 md:grid-cols-2">
            <section aria-labelledby="footer-hours-heading">
              <h3 id="footer-hours-heading" className="flex items-center gap-2 text-sm font-bold text-white"><Clock3 size={16} aria-hidden />Opening Hours</h3>
              {site?.opening_hours ? (
                <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-300">{site.opening_hours}</p>
              ) : businessHours.length > 0 ? (
                <dl className="mt-4 grid max-w-md grid-cols-[minmax(6rem,1fr)_auto] gap-x-6 gap-y-2 text-sm">
                  {openingDayNames.map((day, index) => {
                    const hours = openingHoursByDay.get(index);
                    const time = hours?.is_open
                      ? `${formatOpeningTime(hours.opens_at)} – ${formatOpeningTime(hours.closes_at)}`
                      : "Closed";
                    return (
                      <div key={day} className="contents">
                        <dt className="text-slate-300">{day}</dt>
                        <dd className="text-right text-slate-300">{time}</dd>
                      </div>
                    );
                  })}
                </dl>
              ) : (
                <dl className="mt-4 grid max-w-md grid-cols-[minmax(6rem,1fr)_auto] gap-x-6 gap-y-2 text-sm">
                  {openingDayNames.map((day) => (
                    <div key={day} className="contents">
                      <dt className="text-slate-300">{day}</dt>
                      <dd className="text-right text-slate-300">7:00 AM – 6:30 PM</dd>
                    </div>
                  ))}
                </dl>
              )}
            </section>

            {(validExternalUrl(site?.facebook_url) || validExternalUrl(site?.instagram_url) || validExternalUrl(site?.tiktok_url)) && (
              <section aria-labelledby="footer-social-heading">
                <h3 id="footer-social-heading" className="text-sm font-bold text-white">Follow CK Motors</h3>
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-3 text-sm">
                  {site?.facebook_url && validExternalUrl(site.facebook_url) && <a href={site.facebook_url} target="_blank" rel="noopener noreferrer" className="cursor-pointer text-slate-300 transition-colors hover:text-white hover:underline">📘 Facebook</a>}
                  {site?.instagram_url && validExternalUrl(site.instagram_url) && <a href={site.instagram_url} target="_blank" rel="noopener noreferrer" className="cursor-pointer text-slate-300 transition-colors hover:text-white hover:underline">📸 Instagram</a>}
                  {site?.tiktok_url && validExternalUrl(site.tiktok_url) && <a href={site.tiktok_url} target="_blank" rel="noopener noreferrer" className="cursor-pointer text-slate-300 transition-colors hover:text-white hover:underline">🎵 TikTok</a>}
                </div>
              </section>
            )}
          </div>

          <div className="mt-8 flex flex-col items-center gap-3 border-t border-white/10 pt-5 text-center text-xs text-slate-400 md:flex-row md:justify-between md:text-left">
            <span>© {new Date().getFullYear()} CK MOTORS. All rights reserved.</span>
            <PublicVisitCounter />
            <SehasCredit dark compact />
          </div>
        </div>
      </footer>
      {selectedGallery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setSelectedGallery(null)}>
          <div role="dialog" aria-modal="true" aria-label={selectedGallery.title || "Gallery media"} className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-xl border border-white/15 bg-[#10151e] shadow-2xl shadow-[#1688ff]/10" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setSelectedGallery(null)} className="absolute right-3 top-3 z-10 rounded-full bg-black/75 p-2 text-white transition hover:text-[#63b4ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1688ff]" aria-label="Close gallery preview"><X size={18} /></button>
            {selectedGallery.media_type === "video" && selectedGallery.video_url ? (
              <video src={selectedGallery.video_url} poster={selectedGallery.thumbnail_url || undefined} controls playsInline preload="metadata" className="max-h-[82vh] max-w-full bg-black" />
            ) : selectedGallery.image_url ? (
              <img src={selectedGallery.image_url} alt={selectedGallery.title || "CK Motors workshop"} className="max-h-[82vh] max-w-full object-contain" />
            ) : null}
            {(selectedGallery.title || selectedGallery.caption) && <div className="min-w-0 bg-[#10151e] p-4 text-white"><p className="break-words font-bold">{selectedGallery.title}</p>{selectedGallery.caption && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-300">{formatMediaCaption(selectedGallery.caption)}</p>}</div>}
          </div>
        </div>
      )}
      {contactService && (
        <ServiceContactModal
          service={contactService}
          priceLabel={contactService.price_from !== null ? `From LKR ${Number(contactService.price_from).toLocaleString()}` : "Price on request"}
          settings={site}
          businessHours={businessHours}
          blockedDates={blockedDates}
          nextAvailableLabel={nextAvailableLabel}
          bookingHref={loggedIn ? `/dashboard?section=bookings&serviceId=${contactService.id}` : "/register"}
          onClose={() => setContactService(null)}
        />
      )}
    </main>
  );
}
