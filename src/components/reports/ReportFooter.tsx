import sehasLogo from "@/assets/sehas-logo.png";

// Every printed report / Save-as-PDF output ends with this footer.
// CK Motors branding stays visually dominant; the Sehas developer credit is
// intentionally tiny (7-9pt equivalent) and placed last, per spec.

export default function ReportFooter() {
  return (
    <div className="report-footer mt-8 border-t border-gray-300 pt-4 text-center text-gray-500">
      <p className="text-xs font-bold text-gray-700">CK Motors | ckmotors.lk</p>
      <p className="mt-1 text-[10px]">Computer Generated Report</p>

      <div className="mt-4 flex items-center justify-center gap-2 sm:justify-end">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={sehasLogo.src} alt="Sehas Solutions" className="report-sehas-logo h-auto w-9 object-contain" />
        <span className="text-[8px] text-gray-400">Designed &amp; Developed by Sehas</span>
      </div>
    </div>
  );
}
