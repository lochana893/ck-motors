export type PrintableColumn<T> = {
  header: string;
  align?: "left" | "right" | "center";
  render: (row: T) => React.ReactNode;
};

// Print-friendly table: repeats the header row on each printed page and
// avoids splitting a single row across a page break.
export default function PrintableTable<T>({
  columns,
  rows,
  rowKey,
  emptyLabel = "No records found for the selected filters.",
}: {
  columns: PrintableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-xs text-gray-500">{emptyLabel}</p>;
  }

  return (
    <table className="printable-table w-full border-collapse text-left text-xs">
      <thead>
        <tr className="border-b-2 border-gray-800">
          {columns.map((column) => (
            <th
              key={column.header}
              className={`p-2 font-black uppercase tracking-wide ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
            >
              {column.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={rowKey(row)} className="report-row border-b border-gray-200">
            {columns.map((column) => (
              <td
                key={column.header}
                className={`p-2 align-top ${column.align === "right" ? "text-right" : column.align === "center" ? "text-center" : "text-left"}`}
              >
                {column.render(row)}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
