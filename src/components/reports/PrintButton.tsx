"use client";

import { Printer } from "lucide-react";

const PAGE_SIZE_STYLE_ID = "report-print-page-size";

// Generic print trigger for any `.print-area`. Waits for images inside the
// active print area to finish decoding first (same technique already used
// by the invoice printer) so logos never print blank. Also injects an
// override @page rule for landscape reports, since @page size cannot be
// scoped by a CSS class selector.
export default function PrintButton({
  label = "Print / Save PDF",
  orientation = "portrait",
}: {
  label?: string;
  orientation?: "portrait" | "landscape";
}) {
  async function handlePrint() {
    document.getElementById(PAGE_SIZE_STYLE_ID)?.remove();
    if (orientation === "landscape") {
      const style = document.createElement("style");
      style.id = PAGE_SIZE_STYLE_ID;
      style.textContent = "@media print { @page { size: A4 landscape; margin: 8mm; } }";
      document.head.appendChild(style);
    }

    const images = document.querySelectorAll<HTMLImageElement>(".print-area img");
    await Promise.all(
      Array.from(images).map((image) => (image.complete ? Promise.resolve() : image.decode().catch(() => undefined)))
    );
    window.print();
  }

  return (
    <button
      type="button"
      onClick={() => void handlePrint()}
      className="flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-500"
    >
      <Printer size={16} />
      {label}
    </button>
  );
}
