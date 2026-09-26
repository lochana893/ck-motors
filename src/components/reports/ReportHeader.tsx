// Professional CK Motors report header shown only inside printed / PDF output.
// Uses a plain <img> against the public logo path (matching the existing
// invoice pattern) so it always paints reliably before window.print() runs.

export default function ReportHeader({
  title,
  periodLabel,
}: {
  title: string;
  periodLabel?: string;
}) {
  const generated = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Colombo",
  }).format(new Date());

  return (
    <div className="report-header flex flex-wrap items-start justify-between gap-6 border-b-2 border-red-600 pb-5">
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ck-motors-logo.png" alt="CK Motors" className="report-logo h-14 w-auto object-contain" />
        <div>
          <p className="text-lg font-black leading-tight">C.K MOTORS</p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Ibulgoda, Akuressa, Sri Lanka</p>
          <p className="text-[10px] text-gray-500">077 272 3940 · 077 725 8599 · ckmotors.lk</p>
        </div>
      </div>

      <div className="text-right">
        <h2 className="text-xl font-black uppercase">{title}</h2>
        {periodLabel && <p className="mt-1 text-xs font-bold text-red-600">Period: {periodLabel}</p>}
        <p className="mt-1 text-[10px] text-gray-500">Generated: {generated}</p>
      </div>
    </div>
  );
}
