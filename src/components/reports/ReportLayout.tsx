import ReportHeader from "./ReportHeader";
import ReportFooter from "./ReportFooter";

// Wraps any report's content in the shared print-area used by the single
// @media print block in globals.css. Only one ReportLayout should be visible
// at a time (the active report), matching the existing invoice print pattern.
export default function ReportLayout({
  title,
  periodLabel,
  orientation = "portrait",
  children,
}: {
  title: string;
  periodLabel?: string;
  orientation?: "portrait" | "landscape";
  children: React.ReactNode;
}) {
  return (
    <div className={`print-area ${orientation === "landscape" ? "print-landscape" : "print-portrait"} rounded-2xl bg-white p-6 text-black shadow-2xl md:p-8`}>
      <ReportHeader title={title} periodLabel={periodLabel} />
      <div className="report-body mt-6">{children}</div>
      <ReportFooter />
    </div>
  );
}
