import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f8] px-5 py-12 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
        <Link href="/" className="text-sm font-bold text-red-600">← CK Motors</Link>
        <h1 className="mt-8 text-3xl font-black">Service Terms</h1>
        <div className="mt-8 space-y-6 text-sm leading-7 text-slate-600">
          <section><h2 className="font-bold text-slate-900">Bookings</h2><p>Booking requests are subject to confirmation by CK Motors. Please arrive on time and contact us promptly if you need to change an appointment.</p></section>
          <section><h2 className="font-bold text-slate-900">Service estimates and parts</h2><p>Initial descriptions and estimates are subject to inspection. Parts availability, vehicle condition and additional work may affect the final service scope and amount.</p></section>
          <section><h2 className="font-bold text-slate-900">Customer information</h2><p>Please provide accurate contact and vehicle information and tell the workshop about relevant known issues.</p></section>
          <section><h2 className="font-bold text-slate-900">Payment</h2><p>Customers currently pay in person at the CK Motors workshop. Payment details and any applicable charges will be explained before completion where practical.</p></section>
        </div>
      </article>
    </main>
  );
}
