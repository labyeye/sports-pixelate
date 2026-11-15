/** Display form of a stored value: "half_day" or "PENDING" becomes "Half day" / "Pending". */
export function sentence(value?: string | null): string {
  const t = String(value ?? '')
    .replace(/_/g, ' ')
    .trim();
  return t ? t[0].toUpperCase() + t.slice(1).toLowerCase() : '';
}
