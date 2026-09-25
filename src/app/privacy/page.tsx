import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f8] px-5 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <Link href="/" className="text-sm font-bold text-red-600">← CK Motors</Link>
        <h1 className="mt-8 text-3xl font-black">Privacy Policy</h1>
        <p className="mt-3 text-sm text-slate-500">CK Motors collects information needed to provide accounts, vehicle services, bookings and customer support.</p>
        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-600">
          <section><h2 className="font-bold text-slate-900">Information we collect</h2><p>We may collect account and contact details, vehicle information, bookings, service history and messages you choose to send to CK Motors.</p></section>
          <section><h2 className="font-bold text-slate-900">Security and analytics</h2><p>For account security and abuse prevention, we may record login status, IP address, browser and device information. We also use anonymous first-party visitor identifiers and page-view events to understand website usage. Ordinary website analytics do not store raw visitor IP addresses.</p></section>
          <section><h2 className="font-bold text-slate-900">How information is used</h2><p>Information is used to manage your account, schedule and complete vehicle services, communicate about bookings, troubleshoot problems, prevent abuse and improve the website.</p></section>
          <section><h2 className="font-bold text-slate-900">Contact</h2><p>To ask about your information or request help, contact CK Motors through the phone, WhatsApp or email details shown on the website.</p></section>
        </div>
      </article>
    </main>
  );
}
