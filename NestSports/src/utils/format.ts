/** Whole-rupee INR amount, e.g. ₹12,500. Missing values render as ₹0. */
export function formatCurrency(n?: number | null): string {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

/** "05 Jan 2026"; returns "—" for a missing value. */
export function formatDateOrDash(d?: string | Date | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
}

/** Best-effort message from a caught value (Error, API error object or anything else). */
export function getErrorMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (e instanceof Error && e.message) return e.message;
  if (typeof e === 'object' && e !== null && 'message' in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return typeof e === 'string' && e ? e : fallback;
}
