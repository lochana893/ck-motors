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
      <span className="flex h-10 w-[100px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white px-2 shadow-sm">
        <Image
          src={sehasLogo}
          alt="Sehas Solutions"
          className="h-auto w-[90px] object-contain sm:w-[120px]"
        />
      </span>
      <span className="whitespace-nowrap">Designed &amp; Developed by Sehas</span>
    </a>
  );
}
