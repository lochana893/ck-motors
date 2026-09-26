// Generic CSV export utility shared by every admin report.
// Never pass password/token/secret fields into `rows` — this module has no
// knowledge of which fields are sensitive, so callers are responsible for
// only including safe, already-filtered data.

export type CSVColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

function escapeCSVValue(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function buildCSV<T>(rows: T[], columns: CSVColumn<T>[]) {
  const header = columns.map((column) => escapeCSVValue(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCSVValue(column.value(row))).join(","));
  return [header, ...lines].join("\r\n");
}

export function downloadCSV<T>(filename: string, rows: T[], columns: CSVColumn<T>[]) {
  const csv = buildCSV(rows, columns);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
