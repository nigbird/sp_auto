/**
 * The dashboard's charts drawn as standalone SVG, for the PDF and Excel
 * exports (rendered to PNG with sharp). Same colours and encodings as the
 * on-screen charts: brand gold for magnitude, warm neutral for the comparison
 * series, reserved status colours for status, fixed pillar colours for pillars.
 */

export interface ChartSvg { svg: string; width: number; height: number }

export const C = {
  gold: '#df9a3a',
  neutral: '#c9bdac',
  text: '#2f2a25',
  muted: '#857b70',
  grid: '#ece5da',
  track: '#f1ece4',
  surface: '#ffffff',
};

const FONT = 'Arial, Helvetica, sans-serif';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const pctText = (v: number | null | undefined, digits = 1) => (v == null || !Number.isFinite(v) ? '—' : `${(v * 100).toFixed(digits)}%`);

function text(x: number, y: number, value: string, opts: { size?: number; weight?: number; fill?: string; anchor?: 'start' | 'middle' | 'end' } = {}) {
  const { size = 12, weight = 400, fill = C.text, anchor = 'start' } = opts;
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(value)}</text>`;
}

function frame(width: number, height: number, body: string, title?: string) {
  const heading = title ? text(16, 26, title, { size: 15, weight: 700 }) : '';
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" rx="14" fill="${C.surface}"/>${heading}${body}</svg>`,
    width,
    height,
  };
}

/** A rounded bar whose data end is rounded and whose baseline end is square. */
function hBar(x: number, y: number, w: number, h: number, fill: string) {
  if (w <= 0) return '';
  const r = Math.min(4, h / 2, w);
  return `<path d="M${x},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h - r} Q${x + w},${y + h} ${x + w - r},${y + h} H${x} Z" fill="${fill}"/>`;
}

function vBar(x: number, baseY: number, w: number, h: number, fill: string) {
  if (h <= 0) return '';
  const r = Math.min(4, w / 2, h);
  const top = baseY - h;
  return `<path d="M${x},${baseY} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${baseY} Z" fill="${fill}"/>`;
}

function niceMax(max: number) {
  if (max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function legend(x: number, y: number, items: { label: string; color: string }[]) {
  let cx = x;
  return items.map(i => {
    const s = `<rect x="${cx}" y="${y - 9}" width="10" height="10" rx="2.5" fill="${i.color}"/>${text(cx + 15, y, i.label, { size: 11, fill: C.muted })}`;
    cx += 26 + i.label.length * 6.2;
    return s;
  }).join('');
}

// ---------------------------------------------------------------------------

/** Semicircle gauge for one ratio. */
export function gaugeSvg(value: number | null, label: string, caption: string): ChartSvg {
  const W = 380, H = 250, cx = W / 2, cy = 180, r = 120, sw = 26;
  const v = value == null ? 0 : Math.max(0, Math.min(1, value));
  const pt = (t: number) => [cx - r * Math.cos(Math.PI * t), cy - r * Math.sin(Math.PI * t)];
  const [sx, sy] = pt(0), [ex, ey] = pt(1), [vx, vy] = pt(v);
  const body =
    `<path d="M${sx},${sy} A${r},${r} 0 0 1 ${ex},${ey}" fill="none" stroke="${C.track}" stroke-width="${sw}" stroke-linecap="round"/>` +
    (v > 0 ? `<path d="M${sx},${sy} A${r},${r} 0 0 1 ${vx.toFixed(2)},${vy.toFixed(2)}" fill="none" stroke="${C.gold}" stroke-width="${sw}" stroke-linecap="round"/>` : '') +
    text(cx, cy - 18, pctText(value), { size: 40, weight: 700, anchor: 'middle' }) +
    text(cx, cy + 8, label, { size: 13, fill: C.muted, anchor: 'middle' }) +
    text(cx, cy + 50, caption, { size: 12, fill: C.muted, anchor: 'middle' });
  return frame(W, H, body);
}

/** Line + area across reporting periods (values are ratios). */
export function trendSvg(points: { name: string; value: number | null }[], title: string): ChartSvg {
  const W = 760, H = 300, L = 56, R = 24, T = 54, B = 40;
  const pw = W - L - R, ph = H - T - B;
  const max = Math.max(1, ...points.map(p => p.value ?? 0));
  const yMax = Math.ceil(max * 4) / 4;
  const x = (i: number) => L + (points.length === 1 ? pw / 2 : (i / (points.length - 1)) * pw);
  const y = (v: number) => T + ph - (v / yMax) * ph;
  let body = '';
  for (let k = 0; k <= 4; k++) {
    const v = (yMax * k) / 4;
    body += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/>` + text(L - 8, y(v) + 4, `${Math.round(v * 100)}%`, { size: 11, fill: C.muted, anchor: 'end' });
  }
  const valid = points.map((p, i) => ({ ...p, i })).filter(p => p.value != null);
  if (valid.length) {
    const line = valid.map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.value!).toFixed(1)}`).join(' ');
    const area = `${line} L${x(valid[valid.length - 1].i).toFixed(1)},${T + ph} L${x(valid[0].i).toFixed(1)},${T + ph} Z`;
    body += `<defs><linearGradient id="ta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.gold}" stop-opacity="0.3"/><stop offset="1" stop-color="${C.gold}" stop-opacity="0"/></linearGradient></defs>`;
    body += `<path d="${area}" fill="url(#ta)"/><path d="${line}" fill="none" stroke="${C.gold}" stroke-width="2.5" stroke-linejoin="round"/>`;
    for (const p of valid) {
      body += `<circle cx="${x(p.i)}" cy="${y(p.value!)}" r="4.5" fill="${C.surface}" stroke="${C.gold}" stroke-width="2.5"/>`;
    }
    const last = valid[valid.length - 1];
    body += text(x(last.i), y(last.value!) - 12, pctText(last.value), { size: 12, weight: 700, anchor: 'middle' });
  }
  points.forEach((p, i) => { body += text(x(i), H - 14, cut(p.name, 16), { size: 11, fill: C.muted, anchor: 'middle' }); });
  return frame(W, H, body, title);
}

/** One bar per status, with count and share. */
export function statusBarsSvg(items: { label: string; count: number; share: number; color: string }[], title: string): ChartSvg {
  const W = 420, rowH = 44, T = 56;
  const H = T + items.length * rowH + 12;
  let body = '';
  items.forEach((it, k) => {
    const y = T + k * rowH;
    body += text(16, y + 12, it.label, { size: 13 }) + text(W - 16, y + 12, `${it.count} · ${pctText(it.share, 0)}`, { size: 12, fill: C.muted, anchor: 'end' });
    body += `<rect x="16" y="${y + 20}" width="${W - 32}" height="9" rx="4.5" fill="${C.track}"/>` + (it.share > 0 ? `<rect x="16" y="${y + 20}" width="${Math.max(9, (W - 32) * it.share)}" height="9" rx="4.5" fill="${it.color}"/>` : '');
  });
  return frame(W, H, body, title);
}

/** Donut with an HTML-style legend on the right carrying every value. */
export function donutSvg(slices: { label: string; sub?: string; value: number; color: string; display: string }[], center: { value: string; label: string }, title: string): ChartSvg {
  const W = 760, rowH = 38, T = 50;
  const H = Math.max(300, T + slices.length * rowH + 24);
  const cx = 150, cy = T + (H - T) / 2 - 6, R = 104, r = 68;
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  let body = '';
  if (total <= 0) {
    body += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${C.track}" stroke-width="${R - r}"/>`;
  } else {
    let angle = -Math.PI / 2;
    const gap = slices.filter(s => s.value > 0).length > 1 ? 0.02 : 0;
    for (const s of slices) {
      if (s.value <= 0) continue;
      const sweep = (s.value / total) * Math.PI * 2;
      const a0 = angle + gap / 2, a1 = angle + sweep - gap / 2;
      angle += sweep;
      if (a1 <= a0) continue;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`;
      if (sweep >= Math.PI * 2 - 0.001) {
        body += `<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${s.color}" stroke-width="${R - r}"/>`;
      } else {
        body += `<path d="M${p(R, a0)} A${R},${R} 0 ${large} 1 ${p(R, a1)} L${p(r, a1)} A${r},${r} 0 ${large} 0 ${p(r, a0)} Z" fill="${s.color}"/>`;
      }
    }
  }
  body += text(cx, cy + 4, center.value, { size: 24, weight: 700, anchor: 'middle' }) + text(cx, cy + 22, center.label, { size: 11, fill: C.muted, anchor: 'middle' });
  const lx = 290;
  const ly0 = cy - (slices.length * rowH) / 2 + 8;
  slices.forEach((s, k) => {
    const y = ly0 + k * rowH;
    body += `<rect x="${lx}" y="${y}" width="12" height="12" rx="3" fill="${s.color}"/>`;
    body += text(lx + 20, y + 10, cut(s.label, 44), { size: 13 });
    if (s.sub) body += text(lx + 20, y + 26, cut(s.sub, 56), { size: 10.5, fill: C.muted });
    body += text(W - 70, y + 10, s.display, { size: 13, weight: 700, anchor: 'end' });
    body += text(W - 16, y + 10, total > 0 ? pctText(s.value / total, 0) : '—', { size: 11, fill: C.muted, anchor: 'end' });
  });
  return frame(W, H, body, title);
}

/** Vertical grouped bars with value labels. */
export function groupedBarsSvg(
  categories: string[],
  series: { name: string; color: string; values: number[]; labels?: string[] }[],
  title: string,
  yFormat: (v: number) => string = v => String(v),
  /** Counts: keep axis ticks on whole numbers. */
  integer = false
): ChartSvg {
  const W = 760, H = 330, L = 56, R = 20, T = 78, B = 42;
  const pw = W - L - R, ph = H - T - B;
  const rawMax = Math.max(0, ...series.flatMap(s => s.values));
  const yMax = integer ? Math.max(4, Math.ceil((rawMax * 1.08) / 4) * 4) : niceMax(rawMax * 1.08);
  const y = (v: number) => T + ph - (v / yMax) * ph;
  const groupW = pw / Math.max(1, categories.length);
  const barW = Math.min(34, (groupW * 0.7) / series.length);
  let body = legend(16, 52, series.map(s => ({ label: s.name, color: s.color })));
  for (let k = 0; k <= 4; k++) {
    const v = (yMax * k) / 4;
    body += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="${C.grid}"/>` + text(L - 8, y(v) + 4, yFormat(v), { size: 11, fill: C.muted, anchor: 'end' });
  }
  categories.forEach((cat, i) => {
    const gx = L + i * groupW + (groupW - barW * series.length - 2 * (series.length - 1)) / 2;
    series.forEach((s, j) => {
      const v = s.values[i] ?? 0;
      const bx = gx + j * (barW + 2);
      body += vBar(bx, T + ph, barW, (v / yMax) * ph, s.color);
      const label = s.labels?.[i] ?? String(v);
      if (label) body += text(bx + barW / 2, y(v) - 6, label, { size: 10.5, weight: j === series.length - 1 ? 700 : 400, anchor: 'middle' });
    });
    body += text(L + i * groupW + groupW / 2, H - 16, cut(cat, 18), { size: 11, fill: C.muted, anchor: 'middle' });
  });
  return frame(W, H, body, title);
}

/** Horizontal bars (0–100%) with labels, optional reference line. */
export function hBarsSvg(rows: { label: string; value: number | null; text: string }[], title: string, marker?: number): ChartSvg {
  const W = 760, rowH = 30, T = 52, L = 250, R = 70;
  const H = T + Math.max(1, rows.length) * rowH + 34;
  const pw = W - L - R;
  let body = '';
  for (const t of [0, 25, 50, 75, 100]) {
    const gx = L + (t / 100) * pw;
    body += `<line x1="${gx}" x2="${gx}" y1="${T - 6}" y2="${T + rows.length * rowH}" stroke="${C.grid}"/>` + text(gx, H - 12, `${t}%`, { size: 10.5, fill: C.muted, anchor: 'middle' });
  }
  rows.forEach((r, k) => {
    const y = T + k * rowH;
    body += text(L - 10, y + 17, cut(r.label, 38), { size: 12, anchor: 'end' });
    body += `<rect x="${L}" y="${y + 6}" width="${pw}" height="16" rx="4" fill="${C.track}"/>`;
    body += hBar(L, y + 6, Math.max(0, Math.min(1, (r.value ?? 0) / 100)) * pw, 16, C.gold);
    body += text(L + Math.max(0, Math.min(1, (r.value ?? 0) / 100)) * pw + 6, y + 18, r.text, { size: 11, weight: 700 });
  });
  if (marker != null) {
    const mx = L + (marker / 100) * pw;
    body += `<line x1="${mx}" x2="${mx}" y1="${T - 6}" y2="${T + rows.length * rowH}" stroke="${C.gold}" stroke-opacity="0.7" stroke-width="1.5"/>`;
  }
  return frame(W, H, body, title);
}

/** Horizontal paired bars (e.g. due vs completed) per row. */
export function hPairsSvg(rows: { label: string; a: number; b: number }[], names: [string, string], title: string): ChartSvg {
  const W = 760, rowH = 38, T = 72, L = 250, R = 50;
  const H = T + Math.max(1, rows.length) * rowH + 34;
  const pw = W - L - R;
  const max = Math.max(4, Math.ceil(Math.max(1, ...rows.flatMap(r => [r.a, r.b])) / 4) * 4); // counts: whole-number ticks
  let body = legend(16, 52, [{ label: names[0], color: C.neutral }, { label: names[1], color: C.gold }]);
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4, gx = L + (v / max) * pw;
    body += `<line x1="${gx}" x2="${gx}" y1="${T - 6}" y2="${T + rows.length * rowH}" stroke="${C.grid}"/>` + text(gx, H - 12, String(Math.round(v * 10) / 10), { size: 10.5, fill: C.muted, anchor: 'middle' });
  }
  rows.forEach((r, k) => {
    const y = T + k * rowH;
    body += text(L - 10, y + 20, cut(r.label, 38), { size: 12, anchor: 'end' });
    body += hBar(L, y + 4, (r.a / max) * pw, 13, C.neutral) + text(L + (r.a / max) * pw + 5, y + 15, String(r.a), { size: 10.5 });
    body += hBar(L, y + 19, (r.b / max) * pw, 13, C.gold) + text(L + (r.b / max) * pw + 5, y + 30, String(r.b), { size: 10.5, weight: 700 });
  });
  return frame(W, H, body, title);
}

/** One 100% stacked status bar per row (e.g. initiatives by status per pillar). */
export function stackedRowsSvg(rows: { label: string; note: string; parts: { count: number; color: string }[] }[], legendItems: { label: string; color: string }[], title: string): ChartSvg {
  const W = 760, rowH = 46, T = 52;
  const H = T + rows.length * rowH + 50;
  const L = 16, pw = W - 32;
  let body = '';
  rows.forEach((r, k) => {
    const y = T + k * rowH;
    body += text(L, y + 12, cut(r.label, 70), { size: 12.5, weight: 600 }) + text(W - 16, y + 12, r.note, { size: 11, fill: C.muted, anchor: 'end' });
    const total = r.parts.reduce((s, p) => s + p.count, 0);
    if (total === 0) {
      body += `<rect x="${L}" y="${y + 20}" width="${pw}" height="12" rx="6" fill="${C.track}"/>`;
      return;
    }
    let x = L;
    const visible = r.parts.filter(p => p.count > 0);
    const gaps = (visible.length - 1) * 2;
    visible.forEach(p => {
      const w = ((pw - gaps) * p.count) / total;
      body += `<rect x="${x.toFixed(1)}" y="${y + 20}" width="${w.toFixed(1)}" height="12" rx="3" fill="${p.color}"/>`;
      if (w > 18) body += text(x + w / 2, y + 30, String(p.count), { size: 9.5, weight: 700, fill: '#ffffff', anchor: 'middle' });
      x += w + 2;
    });
  });
  body += legend(16, H - 18, legendItems);
  return frame(W, H, body, title);
}

/** Achievement (x) vs planned weight (y); bubble area ∝ total weight. One hue. */
export function scatterSvg(points: { x: number; y: number; size: number; label: string }[], title: string): ChartSvg {
  const W = 760, H = 380, L = 64, R = 24, T = 52, B = 52;
  const pw = W - L - R, ph = H - T - B;
  const yMax = niceMax(Math.max(1, ...points.map(p => p.y)) * 1.1);
  const X = (v: number) => L + (Math.min(v, 1.1) / 1.1) * pw;
  const Y = (v: number) => T + ph - (v / yMax) * ph;
  const sMax = Math.max(1, ...points.map(p => p.size));
  let body = '';
  for (const t of [0, 0.25, 0.5, 0.75, 1]) body += `<line x1="${X(t)}" x2="${X(t)}" y1="${T}" y2="${T + ph}" stroke="${t === 0.75 ? C.neutral : t === 1 ? C.gold : C.grid}" stroke-width="${t >= 0.75 ? 1.5 : 1}"/>` + text(X(t), T + ph + 18, `${t * 100}%`, { size: 10.5, fill: C.muted, anchor: 'middle' });
  for (let k = 0; k <= 4; k++) { const v = (yMax * k) / 4; body += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.grid}"/>` + text(L - 8, Y(v) + 4, `${v.toFixed(v < 10 ? 1 : 0)}%`, { size: 10.5, fill: C.muted, anchor: 'end' }); }
  for (const p of [...points].sort((a, b) => b.size - a.size)) {
    const r = 6 + 16 * Math.sqrt(p.size / sMax);
    body += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="${r.toFixed(1)}" fill="${C.gold}" fill-opacity="0.7" stroke="#ffffff" stroke-width="1.5"/>`;
    body += text(X(p.x) + r + 3, Y(p.y) + 4, p.label, { size: 10, fill: C.muted });
  }
  body += text(L + pw / 2, H - 10, 'Achievement this period', { size: 11, fill: C.muted, anchor: 'middle' });
  body += `<text transform="translate(16 ${T + ph / 2}) rotate(-90)" font-family="${FONT}" font-size="11" fill="${C.muted}" text-anchor="middle">Planned weight</text>`;
  return frame(W, H, body, title);
}
