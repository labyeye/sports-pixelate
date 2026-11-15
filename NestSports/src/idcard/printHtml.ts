import RNPrint from 'react-native-print';
import { assetUrl } from './data';
import { qrPath } from './qr';
import {
  FONT_STACKS,
  cardDims,
  fieldValue,
  qrValue,
  type IdCardTemplate,
  type IdCompany,
  type IdEl,
} from './idCard';

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string),
  );

const grad = (a: string, b: string, angle: number) => `linear-gradient(${angle}deg, ${a}, ${b})`;
const radiusOf = (el: IdEl) =>
  el.shape === 'circle' ? '50%' : el.shape === 'rounded' ? `${el.radius}%` : '0';
const borderOf = (el: IdEl) =>
  el.borderWidth > 0 ? `border:${el.borderWidth}mm solid ${el.borderColor};box-sizing:border-box;` : '';
const initials = (emp: any) =>
  `${emp?.firstName?.[0] || ''}${emp?.lastName?.[0] || ''}`.toUpperCase() || 'ID';

function elementHtml(el: IdEl, emp: any, company: IdCompany): string {
  const full = 'width:100%;height:100%;';
  if (el.kind === 'text' || el.kind === 'field') {
    const raw = el.kind === 'text' ? el.text : fieldValue(el.field, emp, company);
    const v = el.kind === 'field' ? (raw ? `${el.prefix}${raw}` : '') : raw;
    const jc = el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start';
    return `<div style="${full}display:flex;align-items:center;justify-content:${jc};text-align:${el.align};overflow:hidden;font-family:${FONT_STACKS[el.font]};font-size:${el.size}pt;line-height:1.15;color:${el.color};font-weight:${el.bold ? 700 : 400};font-style:${el.italic ? 'italic' : 'normal'};text-transform:${el.upper ? 'uppercase' : 'none'};${el.spacing ? `letter-spacing:${el.spacing}em;` : ''}white-space:pre-wrap;word-break:break-word">${esc(v)}</div>`;
  }
  if (el.kind === 'photo') {
    const src = assetUrl(emp?.avatar);
    return src
      ? `<img src="${esc(src)}" style="${full}object-fit:cover;display:block;border-radius:${radiusOf(el)};${borderOf(el)}"/>`
      : `<div style="${full}border-radius:${radiusOf(el)};${borderOf(el)}background:#e2e8f0;color:#64748b;display:flex;align-items:center;justify-content:center;font:700 14pt Helvetica,Arial,sans-serif">${esc(initials(emp))}</div>`;
  }
  if (el.kind === 'logo')
    return company.logoUrl
      ? `<img src="${esc(company.logoUrl)}" style="${full}object-fit:contain;display:block"/>`
      : '';
  if (el.kind === 'image') {
    const src = assetUrl(el.src);
    return src
      ? `<img src="${esc(src)}" style="${full}object-fit:${el.fit};display:block;border-radius:${radiusOf(el)};${borderOf(el)}"/>`
      : '';
  }
  if (el.kind === 'qr') {
    const q = qrPath(qrValue(el, emp, company));
    return q
      ? `<svg viewBox="0 0 ${q.size} ${q.size}" style="${full}display:block" shape-rendering="crispEdges" preserveAspectRatio="xMidYMid meet"><path d="${q.d}" fill="#000"/></svg>`
      : '';
  }
  return `<div style="${full}background:${el.fill2 ? grad(el.fill, el.fill2, el.angle) : el.fill};border-radius:${radiusOf(el)};${borderOf(el)}"></div>`;
}

export function cardHtml(
  t: IdCardTemplate,
  side: 'front' | 'back',
  emp: any,
  company: IdCompany,
): string {
  const { w, h } = cardDims(t);
  const s = side === 'front' ? t.front : t.back;
  const layers: string[] = [];
  if (s.bgImage) layers.push(`url("${assetUrl(s.bgImage)}") center / cover no-repeat`);
  layers.push(s.bg2 ? grad(s.bg, s.bg2, s.bgAngle ?? 135) : s.bg);
  const els = s.elements
    .filter(e => e.visible)
    .map(
      e =>
        `<div style="position:absolute;left:${e.x}%;top:${e.y}%;width:${e.w}%;height:${e.h}%;opacity:${e.opacity};${e.rotate ? `transform:rotate(${e.rotate}deg);` : ''}">${elementHtml(e, emp, company)}</div>`,
    )
    .join('');
  return `<div style="position:relative;width:${w}mm;height:${h}mm;background:${layers.join(',')};border-radius:${t.cornerRadius}mm;overflow:hidden;box-sizing:border-box">${els}</div>`;
}

/** A4 sheets of cards with cut lines; backs are mirrored per row so they line up when printed double-sided. */
export function buildSheetsHtml(
  employees: any[],
  template: IdCardTemplate,
  company: IdCompany,
  sides: 'front' | 'both',
): string {
  const { w, h } = cardDims(template);
  const withBack = sides === 'both' && template.backEnabled;
  const M = 10;
  const G = 4;
  const cols = Math.max(1, Math.floor((210 - 2 * M + G) / (w + G)));
  const rows = Math.max(1, Math.floor((297 - 2 * M + G) / (h + G)));
  const per = cols * rows;
  const sheet = (cells: string[]) =>
    `<div class="sheet">${cells.map(c => `<div class="cell">${c}</div>`).join('')}</div>`;
  let body = '';
  for (let i = 0; i < employees.length; i += per) {
    const chunk = employees.slice(i, i + per);
    body += sheet(chunk.map(e => cardHtml(template, 'front', e, company)));
    if (withBack) {
      const backs: string[] = [];
      for (let r = 0; r < chunk.length; r += cols) {
        const row = chunk
          .slice(r, r + cols)
          .map(e => cardHtml(template, 'back', e, company))
          .reverse();
        while (row.length < cols) row.unshift('');
        backs.push(...row);
      }
      body += sheet(backs);
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:A4;margin:${M}mm}
    html,body{margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    *{box-sizing:border-box}
    .sheet{display:grid;grid-template-columns:repeat(${cols},${w}mm);gap:${G}mm;justify-content:center;align-content:start;page-break-after:always}
    .sheet:last-child{page-break-after:auto}
    .cell{outline:0.2mm dashed #b8b8b8;width:${w}mm;height:${h}mm}
  </style></head><body>${body}</body></html>`;
}

export async function printIdCards(
  employees: any[],
  template: IdCardTemplate,
  company: IdCompany,
  sides: 'front' | 'both',
) {
  await RNPrint.print({
    html: buildSheetsHtml(employees, template, company, sides),
    jobName: 'ID cards',
  });
}
