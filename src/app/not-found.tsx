import Link from "next/link";
import { Home } from "lucide-react";
import CKLogo from "@/components/CKLogo";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080b10] px-5 text-white">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#10151e] p-8 text-center shadow-2xl shadow-black/40 sm:p-12">
        <Link href="/" aria-label="CK Motors home" className="mx-auto inline-flex"><CKLogo size="small" className="w-[140px] brightness-0 invert" /></Link>
        <p className="mt-10 text-sm font-black tracking-[0.35em] text-[#63b4ff]">404</p>
        <h1 className="mt-3 text-3xl font-black sm:text-4xl">We couldn&apos;t find that page.</h1>
        <p className="mx-auto mt-4 max-w-md text-sm leading-6 text-slate-400">The address may have changed, or the page may no longer be available. Head back to CK Motors and we&apos;ll help you get moving.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg bg-[#087fe8] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#1688ff]"><Home size={16} /> Go to homepage</Link>
        </div>
      </div>
    </main>
  );
}
