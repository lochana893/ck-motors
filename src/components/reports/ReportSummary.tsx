export default function ReportSummary({
  cards,
}: {
  cards: { label: string; value: string | number }[];
}) {
  return (
    <div className="report-summary mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{card.label}</p>
          <p className="mt-1 text-lg font-black text-gray-900">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
