import Image from "next/image";
import sehasLogo from "@/assets/sehas-logo.png";

export default function SehasCredit({ dark = false }: { dark?: boolean }) {
  return (
    <a
      href="https://wa.me/94712800108"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contact Sehas on WhatsApp"
      className={`inline-flex items-center gap-3 rounded-xl px-2 py-1.5 text-xs font-semibold transition hover:-translate-y-0.5 hover:opacity-90 hover:shadow-sm ${
        dark ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      <span className="relative h-12 w-12 shrink-0 rounded-lg bg-white p-1.5 shadow-sm sm:h-14 sm:w-14">
        <Image
          src={sehasLogo}
          alt="Sehas Solutions"
          fill
          className="object-contain"
          sizes="(max-width: 640px) 48px, 56px"
        />
      </span>
      <span className="whitespace-nowrap">Designed &amp; Developed by Sehas</span>
    </a>
  );
}
