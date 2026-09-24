"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BadgeCheck,
  BatteryCharging,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Clock3,
  Disc3,
  Mail,
  MapPin,
  MessageCircle,
  Menu,
  Phone,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import CKLogo from "@/components/CKLogo";
import SehasCredit from "@/components/SehasCredit";
import { createClient } from "@/lib/supabase/client";
import { loadSiteSettings, phoneUrl, validEmail, whatsappUrl, type SiteSettings } from "@/lib/site-settings";

type PublicService = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_from: number | null;
  estimated_duration_minutes: number | null;
};

type GalleryItem = {
  id: string;
  title: string | null;
  caption: string | null;
  image_url: string;
};

const iconMap = {
  wrench: Wrench,
  diagnostics: CircleGauge,
  safety: ShieldCheck,
  electrical: BatteryCharging,
  detailing: Sparkles,
  comfort: ShieldCheck,
  brakes: Disc3,
} as const;

const benefits = [
  ["01", "Experienced technicians", "Skilled hands, careful inspections and clear advice."],
  ["02", "Quality parts", "Reliable OEM-grade parts selected for your vehicle."],
  ["03", "Transparent pricing", "Know what your vehicle needs before work begins."],
];

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [services, setServices] = useState<PublicService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [selectedGallery, setSelectedGallery] = useState<GalleryItem | null>(null);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [accountName, setAccountName] = useState("Customer Account");
  const [accountRole, setAccountRole] = useState("customer");
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    async function loadServices() {
      const [{ data, error }, galleryResult, siteSettings] = await Promise.all([
        supabase
        .from("services")
        .select("id, name, category, description, price_from, estimated_duration_minutes")
        .eq("active", true)
        .order("name", { ascending: true }),
        supabase
          .from("gallery")
          .select("id, title, caption, image_url")
          .eq("is_active", true)
          .order("display_order", { ascending: true })
          .order("created_at", { ascending: false }),
        loadSiteSettings(supabase),
      ]);

      if (error) {
        setServicesError(error.message);
      } else {
        setServices(data || []);
      }
      setServicesLoading(false);
      if (!galleryResult.error) setGallery((galleryResult.data || []) as GalleryItem[]);
      setSettings(siteSettings);
    }

    void loadServices();
  }, [supabase]);

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
    site?.opening_hours && { icon: Clock3, label: "Opening hours", value: site.opening_hours, href: "" },
  ].filter(Boolean) as Array<{ icon: typeof Phone; label: string; value: string; href: string }>;

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
            {loggedIn ? <div className="relative hidden sm:block"><button type="button" onClick={() => setAccountOpen((open) => !open)} className="rounded-lg px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100">{accountName} <span aria-hidden>▾</span></button>{accountOpen && <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-2 text-sm font-medium shadow-xl"><Link href={accountRole === "admin" || accountRole === "staff" ? "/admin" : "/dashboard?section=dashboard"} className="block rounded-lg px-3 py-2 hover:bg-slate-50">{accountRole === "admin" || accountRole === "staff" ? "Admin Dashboard" : "Dashboard"}</Link>{accountRole === "admin" && <><Link href="/admin?section=customers" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Customer Management</Link><Link href="/admin?section=gallery" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Gallery Management</Link></>}{accountRole === "customer" && <><Link href="/dashboard?section=vehicles" className="block rounded-lg px-3 py-2 hover:bg-slate-50">My Vehicles</Link><Link href="/dashboard?section=bookings" className="block rounded-lg px-3 py-2 hover:bg-slate-50">My Bookings</Link><Link href="/dashboard?section=history" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Service History</Link><Link href="/dashboard?section=messages" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Messages</Link><Link href="/dashboard?section=notifications" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Notifications</Link><Link href="/dashboard?section=profile" className="block rounded-lg px-3 py-2 hover:bg-slate-50">Profile</Link></>}<button type="button" onClick={async () => { await supabase.auth.signOut(); setLoggedIn(false); setAccountOpen(false); }} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-slate-50">Logout</button></div>}</div> : <Link href="/login" className="hidden rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 sm:block">Customer login</Link>}
            <Link href={loggedIn ? "/dashboard?section=bookings" : "/register"} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700 sm:px-5">
              Book a service <ArrowRight size={16} />
            </Link>
            <button onClick={() => setMobileMenuOpen((open) => !open)} className="rounded-lg p-2 text-slate-500 lg:hidden" aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}>{mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}</button>
          </div>
        </div>
        {mobileMenuOpen && <div className="border-t border-slate-200 bg-white px-5 py-4 lg:hidden"><div className="grid gap-2 text-sm font-medium text-slate-700"><a href="#services" onClick={() => setMobileMenuOpen(false)}>Services</a><a href="#why-us" onClick={() => setMobileMenuOpen(false)}>Why us</a><a href="#process" onClick={() => setMobileMenuOpen(false)}>Our process</a><a href="#gallery" onClick={() => setMobileMenuOpen(false)}>Gallery</a><a href="#contact" onClick={() => setMobileMenuOpen(false)}>Contact</a>{loggedIn ? <><Link href={accountRole === "admin" || accountRole === "staff" ? "/admin" : "/dashboard?section=dashboard"} onClick={() => setMobileMenuOpen(false)}>Dashboard</Link>{accountRole === "customer" && <><Link href="/dashboard?section=vehicles" onClick={() => setMobileMenuOpen(false)}>Vehicles</Link><Link href="/dashboard?section=bookings" onClick={() => setMobileMenuOpen(false)}>Bookings</Link><Link href="/dashboard?section=messages" onClick={() => setMobileMenuOpen(false)}>Messages</Link><Link href="/dashboard?section=notifications" onClick={() => setMobileMenuOpen(false)}>Notifications</Link><Link href="/dashboard?section=profile" onClick={() => setMobileMenuOpen(false)}>Profile</Link></>}<button type="button" className="text-left" onClick={async () => { await supabase.auth.signOut(); setMobileMenuOpen(false); setLoggedIn(false); }}>Logout</button></> : <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Customer login</Link>}</div></div>}
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
              const Icon = iconMap[(service.category || "").toLowerCase() as keyof typeof iconMap] || Wrench;
              return <article key={service.id} className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-red-200 hover:shadow-md"><div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600"><Icon size={21} /></div><span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-500">{service.category || "Automotive"}</span></div><h3 className="mt-5 text-lg font-bold">{service.name}</h3><p className="mt-2 min-h-14 text-sm leading-6 text-slate-500">{service.description || "Professional vehicle care from CK Motors."}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm font-bold text-red-600">{service.price_from !== null ? `From LKR ${Number(service.price_from).toLocaleString()}` : "Price on request"}</span><Link href={loggedIn ? "/dashboard?section=bookings" : "/register"} className="text-sm font-bold text-slate-700 transition group-hover:text-red-600">Book now <span aria-hidden>→</span></Link></div></article>;
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
              <button key={item.id} type="button" onClick={() => setSelectedGallery(item)} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm">
                <img src={item.image_url} alt={item.title || "CK Motors workshop"} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-300 group-hover:scale-105" />
                {(item.title || item.caption) && <span className="block p-4"><strong className="block text-sm">{item.title}</strong><span className="mt-1 block text-xs text-slate-500">{item.caption}</span></span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section id="process" className="mx-auto max-w-7xl px-5 py-20 sm:px-8"><div className="rounded-2xl bg-[#17191f] px-6 py-12 text-white sm:px-12"><div className="max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.2em] text-red-400">Simple from start to finish</p><h2 className="mt-3 text-3xl font-black sm:text-4xl">Book. Inspect. Repair. Drive.</h2></div><div className="mt-10 grid gap-6 sm:grid-cols-4">{["Book your visit", "We inspect", "We get to work", "Drive with confidence"].map((step, index) => <div key={step} className="border-l border-white/15 pl-4"><div className="text-sm font-black text-red-400">0{index + 1}</div><div className="mt-3 font-bold">{step}</div></div>)}</div></div></section>

      <section id="contact" className="bg-red-600"><div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 text-white sm:px-8"><div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between"><div><h2 className="text-2xl font-black">{site?.contact_heading || "Ready for a smoother drive?"}</h2><p className="mt-2 text-sm text-red-100">{site?.contact_description || "Create your customer account and schedule your next service in minutes."}</p></div><Link href="/register" className="inline-flex w-fit items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50">Schedule service <ArrowRight size={17} /></Link></div>{contactItems.length > 0 && <div className="grid gap-3 border-t border-white/20 pt-6 sm:grid-cols-2 lg:grid-cols-4">{contactItems.map(({ icon: Icon, label, value, href }) => <a key={label} href={href || undefined} target={href?.startsWith("http") ? "_blank" : undefined} rel={href?.startsWith("http") ? "noopener noreferrer" : undefined} className="flex min-w-0 items-start gap-3 rounded-xl bg-black/10 p-3 transition hover:bg-black/20"><Icon size={18} className="mt-0.5 shrink-0" /><span className="min-w-0"><span className="block text-xs text-red-100">{label}</span><span className="block truncate text-sm font-semibold">{value}</span></span></a>)}</div>}</div></section>

      <footer className="bg-[#111318] text-slate-400"><div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-8 sm:px-8"><div className="grid gap-6 md:grid-cols-3"><div><Link href="/" aria-label="CK Motors home"><CKLogo size="small" className="w-[120px] brightness-0 invert" /></Link><p className="mt-3 text-sm">{site?.tagline || "Reliable vehicle care in Sri Lanka."}</p></div><div><h3 className="text-xs font-bold uppercase tracking-wider text-white">Quick Links</h3><div className="mt-3 grid gap-2 text-sm"><a href="#services" className="hover:text-white">Services</a><a href="#gallery" className="hover:text-white">Gallery</a><a href="#contact" className="hover:text-white">Contact</a><Link href="/login" className="hover:text-white">Customer Login</Link></div></div><div><h3 className="text-xs font-bold uppercase tracking-wider text-white">Contact</h3><div className="mt-3 grid gap-2 text-sm">{site?.primary_phone && <a href={phoneUrl(site.primary_phone)} className="hover:text-white">{site.primary_phone}</a>}{site?.whatsapp_number && <a href={whatsappUrl(site.whatsapp_number, site.whatsapp_message)} target="_blank" rel="noopener noreferrer" className="hover:text-white">WhatsApp</a>}{site?.email && validEmail(site.email) && <a href={`mailto:${site.email}`} className="hover:text-white">{site.email}</a>}{site?.address && (site.maps_url ? <a href={site.maps_url} target="_blank" rel="noopener noreferrer" className="hover:text-white">{site.address}, {site.city_area}</a> : <span>{site.address}, {site.city_area}</span>)}</div></div></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs"><span>© {new Date().getFullYear()} {site?.business_name || "CK Motors"}. All rights reserved.</span><SehasCredit dark /></div>{site?.opening_hours && <div className="flex items-start gap-2 text-sm"><Clock3 size={16} className="mt-0.5 shrink-0" /><span className="whitespace-pre-line">{site.opening_hours}</span></div>}{[["Facebook", site?.facebook_url], ["Instagram", site?.instagram_url], ["TikTok", site?.tiktok_url], ["YouTube", site?.youtube_url]].some(([, href]) => href) && <div className="flex flex-wrap gap-4 text-sm">{[["Facebook", site?.facebook_url], ["Instagram", site?.instagram_url], ["TikTok", site?.tiktok_url], ["YouTube", site?.youtube_url]].filter(([, href]) => href).map(([label, href]) => <a key={label} href={href} target="_blank" rel="noopener noreferrer" className="transition hover:text-white">{label}</a>)}</div>}</div></footer>
      {selectedGallery && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4" onClick={() => setSelectedGallery(null)}>
          <div className="relative max-h-[90vh] max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button type="button" onClick={() => setSelectedGallery(null)} className="absolute right-2 top-2 rounded-full bg-black/70 p-2 text-white" aria-label="Close gallery preview"><X size={18} /></button>
            <img src={selectedGallery.image_url} alt={selectedGallery.title || "CK Motors workshop"} className="max-h-[82vh] max-w-full rounded-xl object-contain" />
            {(selectedGallery.title || selectedGallery.caption) && <div className="rounded-b-xl bg-white p-4 text-slate-900"><p className="font-bold">{selectedGallery.title}</p><p className="mt-1 text-sm text-slate-500">{selectedGallery.caption}</p></div>}
          </div>
        </div>
      )}
    </main>
  );
}
