export function normalizeSriLankanPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const compact = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?\d+$/.test(compact)) return null;
  let digits = compact.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("94")) digits = digits.slice(2);
  if (digits.length === 9 && digits.startsWith("7")) digits = `0${digits}`;

  if (!/^07\d{8}$/.test(digits)) return null;
  return `+94${digits.slice(1)}`;
}
