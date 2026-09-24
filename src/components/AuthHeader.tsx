import Link from "next/link";
import CKLogo from "@/components/CKLogo";

export default function AuthHeader() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <Link
          href="/"
          aria-label="Go to CK Motors Home"
          className="inline-flex shrink-0 items-center rounded-lg py-1"
        >
          <CKLogo size="small" className="w-[130px]" />
        </Link>

        <Link
          href="/"
          className="shrink-0 text-sm font-medium text-slate-500 transition hover:text-red-600"
        >
          &larr; Back to Home
        </Link>
      </div>
    </header>
  );
}
