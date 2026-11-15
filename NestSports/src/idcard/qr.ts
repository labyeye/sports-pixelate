// QR matrix built with the pure-JS core of `qrcode` (the package's main entry pulls in Node-only code).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const QR = require('qrcode/lib/core/qrcode');

const cache = new Map<string, { size: number; dark: boolean[] }>();

export function qrMatrix(value: string): { size: number; dark: boolean[] } | null {
  if (!value) return null;
  const hit = cache.get(value);
  if (hit) return hit;
  try {
    const q = QR.create(value, { errorCorrectionLevel: 'M' });
    const out = {
      size: q.modules.size as number,
      dark: Array.from(q.modules.data as ArrayLike<number>, v => !!v),
    };
    cache.set(value, out);
    return out;
  } catch {
    return null;
  }
}

/** SVG path covering every dark module (one path, so it stays small). */
export function qrPath(value: string): { size: number; d: string } | null {
  const m = qrMatrix(value);
  if (!m) return null;
  let d = '';
  for (let y = 0; y < m.size; y++)
    for (let x = 0; x < m.size; x++)
      if (m.dark[y * m.size + x]) d += `M${x} ${y}h1v1h-1z`;
  return { size: m.size, d };
}
