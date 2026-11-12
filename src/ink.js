// Painting the strokes of a drawing. A stroke's points are in UV (0 to 1 across the thing drawn on); `map` takes a UV point to the canvas.
import { strokeShows } from './design.js';
import { isRich, keepWidth, densify, halfWidths } from './stroke.js';

export { BRUSHES } from './design.js';

/** A small repeatable random number generator. */
const rng = (seed) => { let h = (seed | 0) || 1; return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };
const rgba = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };
/** Calls fn at points along a polyline, `step` apart, with the direction there. */
function along(P, step, fn) {
  let next = 0; let dist = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i]; const b = P[i + 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l < 1e-9) continue;
    while (next <= dist + l) { const t = (next - dist) / l; fn(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])); next += step; }
    dist += l;
  }
}
const smoothTrace = (ctx, P) => { ctx.beginPath(); ctx.moveTo(P[0][0], P[0][1]); for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2); ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]); };
/**
 * A stroke as one smooth ribbon of changing width: the centre line is a Catmull-Rom curve through the points, the two edges are offset by the half width there, and the whole is ONE filled path with round ends and round corners,
 * so a stroke at half opacity is one even tone where it crosses itself. P: points on the canvas; F: the width factor at each; w: the width asked for.
 */
function ribbon(ctx, P, F, w, brush, tp, minW) {
  const A = []; const B = []; for (let i = 0; i < P.length; i++) if (!i || Math.hypot(P[i][0] - A[A.length - 1][0], P[i][1] - A[A.length - 1][1]) > 0.05) { A.push(P[i]); B.push(F[i]); }
  if (A.length < 2) { ctx.beginPath(); ctx.arc(A[0][0], A[0][1], Math.max(minW, w * 0.5) / 2, 0, Math.PI * 2); ctx.fill(); return; }
  const { Q, V } = densify(A, B); let run = 0; for (let i = 1; i < A.length; i++) run += Math.hypot(A[i][0] - A[i - 1][0], A[i][1] - A[i - 1][1]);
  if (brush !== 'taper' && run > 6 * w && Math.hypot(A[0][0] - A[A.length - 1][0], A[0][1] - A[A.length - 1][1]) < Math.max(1.5 * w, 6)) tp = 3; // a line that comes back to where it began is a closed shape: no taper, or it would pinch where it meets itself and leak for the bucket
  const H = halfWidths(Q, V, w, brush, tp, minW); const n = Q.length; const L = []; const R = []; const turns = []; let nx = 0; let ny = 1;
  for (let i = 0; i < n; i++) {
    const a = Q[Math.max(0, i - 1)]; const b = Q[Math.min(n - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (l > 1e-9) { nx = -(b[1] - a[1]) / l; ny = (b[0] - a[0]) / l; }
    L.push([Q[i][0] + nx * H[i], Q[i][1] + ny * H[i]]); R.push([Q[i][0] - nx * H[i], Q[i][1] - ny * H[i]]);
    if (i && i < n - 1) { const c = Q[i - 1]; const d = Q[i + 1]; const t1 = Math.atan2(Q[i][1] - c[1], Q[i][0] - c[0]); const t2 = Math.atan2(d[1] - Q[i][1], d[0] - Q[i][0]); let da = Math.abs(t2 - t1); if (da > Math.PI) da = 2 * Math.PI - da; if (da > 0.5) turns.push(i); }
  }
  const edge = (E, rev) => { const idx = rev ? E.map((_, i) => n - 1 - i) : E.map((_, i) => i); const p = (k) => E[idx[k]]; if (rev) ctx.lineTo(p(0)[0], p(0)[1]); else ctx.moveTo(p(0)[0], p(0)[1]); for (let k = 1; k < n - 1; k++) ctx.quadraticCurveTo(p(k)[0], p(k)[1], (p(k)[0] + p(k + 1)[0]) / 2, (p(k)[1] + p(k + 1)[1]) / 2); ctx.lineTo(p(n - 1)[0], p(n - 1)[1]); };
  ctx.beginPath(); edge(L, false); edge(R, true); ctx.closePath();
  const dot = (i) => { ctx.moveTo(Q[i][0] + H[i], Q[i][1]); ctx.arc(Q[i][0], Q[i][1], H[i], 0, Math.PI * 2, true); }; // drawn the way round the ribbon goes, so they add to it and never cancel it
  dot(0); dot(n - 1); for (const i of turns) dot(i);
  ctx.fill('nonzero');
}
/** One line stroke in the brush it names. P: its points on the canvas; w: its width there. Everything that looks random is seeded from the stroke, so it is the same every time it is drawn. */
function brushStroke(ctx, s, P, w, minW, alpha) {
  const brush = s.b || 'round'; const seed = Math.round(s.pts[0][0] * 9973 + s.pts[0][1] * 7919 + s.pts.length * 31); const r = rng(seed);
  ctx.strokeStyle = s.c; ctx.fillStyle = s.c;
  if (isRich(s) && (brush === 'round' || brush === 'taper')) { ribbon(ctx, P, s.pts.map((q) => q[2] ?? 0.5), w, brush, s.tp || 0, minW); return; }
  if (brush === 'marker') { ctx.lineCap = 'square'; ctx.lineJoin = 'miter'; ctx.lineWidth = Math.max(minW, w); smoothTrace(ctx, P); ctx.stroke(); return; }
  if (brush === 'dashed') { ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(minW, w); ctx.setLineDash([Math.max(1, w * 2.4), Math.max(1, w * 1.6)]); smoothTrace(ctx, P); ctx.stroke(); ctx.setLineDash([]); return; }
  if (brush === 'dotted') { along(P, Math.max(1.2, w * 2), (x, y) => { ctx.beginPath(); ctx.arc(x, y, Math.max(minW / 2, w / 2), 0, Math.PI * 2); ctx.fill(); }); return; }
  if (brush === 'calligraphy') { const ry = Math.max(0.4, w * 0.1); along(P, Math.max(0.5, w * 0.1), (x, y) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(minW / 2, w / 2), ry, -Math.PI / 4, 0, Math.PI * 2); ctx.fill(); }); return; } // a flat nib held at an angle: thick one way, thin the other
  if (brush === 'taper') { // a brush pen: thin at both ends, full in the middle
    const n = P.length; const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1])); const L = cum[n - 1] || 1; const left = []; const right = [];
    for (let i = 0; i < n; i++) {
      const a = P[Math.max(0, i - 1)]; const b = P[Math.min(n - 1, i + 1)]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; const hw = (Math.max(minW, w) / 2) * Math.max(0.1, Math.pow(Math.sin(Math.PI * Math.min(1, cum[i] / L)), 0.6));
      left.push([P[i][0] - ((b[1] - a[1]) / l) * hw, P[i][1] + ((b[0] - a[0]) / l) * hw]); right.push([P[i][0] + ((b[1] - a[1]) / l) * hw, P[i][1] - ((b[0] - a[0]) / l) * hw]);
    }
    ctx.beginPath(); left.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); for (let i = n - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]); ctx.closePath(); ctx.fill(); return;
  }
  if (brush === 'pencil') { // three thin lines that do not quite agree
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(minW, w * 0.32);
    for (let k = 0; k < 3; k++) { ctx.globalAlpha = alpha * 0.55; const Q = P.map(([x, y]) => [x + (r() - 0.5) * w * 0.5, y + (r() - 0.5) * w * 0.5]); smoothTrace(ctx, Q); ctx.stroke(); }
    ctx.globalAlpha = alpha; return;
  }
  if (brush === 'chalk') { // grain scattered along it
    const sz = Math.max(0.7, w * 0.07); const count = Math.ceil(w * 0.9) + 3; ctx.globalAlpha = alpha * 0.8;
    along(P, Math.max(0.8, w * 0.18), (x, y) => { for (let j = 0; j < count; j++) { const rr = (w / 2) * Math.sqrt(r()); const th = r() * Math.PI * 2; ctx.fillRect(x + rr * Math.cos(th), y + rr * Math.sin(th), sz, sz); } });
    ctx.globalAlpha = alpha; return;
  }
  if (brush === 'soft') { // an airbrush: soft round dabs that build up
    const R = Math.max(minW, w) * 0.75; along(P, Math.max(0.8, w * 0.16), (x, y) => { const g = ctx.createRadialGradient(x, y, 0, x, y, R); g.addColorStop(0, rgba(s.c, 0.22)); g.addColorStop(1, rgba(s.c, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill(); });
    return;
  }
  ctx.lineWidth = Math.max(minW, w); smoothTrace(ctx, P); ctx.stroke(); // round
}
/**
 * Paints strokes that show on `frame`. `size` is the size of the thing drawn on, in the canvas's units: a stroke's width is a share of it.
 * `minW` is the thinnest line to draw. A line is painted in the brush it names; a fill stroke is a closed, filled shape.
 */
export function paintStrokes(ctx, strokes, map, size, frame = 0, minW = 0.6) {
  if (!strokes?.length) return;
  const base = ctx.globalAlpha; ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!strokeShows(s, frame)) continue;
    ctx.globalAlpha = base * s.a;
    if (s.loops) { // a region filled by the bucket: its outlines, the holes cut out
      ctx.beginPath(); for (const loop of s.loops) { loop.forEach(([u, v], i) => { const [x, y] = map(u, v); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.closePath(); }
      ctx.fillStyle = s.c; ctx.fill('evenodd'); continue;
    }
    const P = s.pts.map(([u, v]) => map(u, v));
    if (P.length === 1) { ctx.beginPath(); ctx.arc(P[0][0], P[0][1], Math.max(minW, (s.w * size) / 2), 0, Math.PI * 2); ctx.fillStyle = s.c; ctx.fill(); continue; }
    if (s.fill) { smoothTrace(ctx, P); ctx.closePath(); ctx.fillStyle = s.c; ctx.fill(); continue; }
    ctx.save(); brushStroke(ctx, s, P, s.w * size, minW, base * s.a); ctx.restore();
  }
  ctx.restore();
}

/**
 * The outlines of a region of a bitmap. mask: Uint8Array of w by h, 1 for in. Returns closed loops of [x, y] at the corners of pixels; a hole in the region comes out as a loop of its own,
 * so the whole is filled with the even-odd rule. Runs in a straight line are joined.
 */
export function maskLoops(mask, w, h) {
  const on = (x, y) => x >= 0 && y >= 0 && x < w && y < h && mask[y * w + x] === 1; const W1 = w + 1; const edges = new Map();
  const add = (x0, y0, x1, y1) => { const k = y0 * W1 + x0; const l = edges.get(k); if (l) l.push([x1, y1]); else edges.set(k, [[x1, y1]]); };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!on(x, y)) continue;
    if (!on(x, y - 1)) add(x, y, x + 1, y); if (!on(x + 1, y)) add(x + 1, y, x + 1, y + 1); if (!on(x, y + 1)) add(x + 1, y + 1, x, y + 1); if (!on(x - 1, y)) add(x, y + 1, x, y);
  }
  const loops = [];
  for (const [k, list] of edges) {
    while (list.length) {
      const sx = k % W1; const sy = Math.floor(k / W1); let cx = sx; let cy = sy; const pts = [];
      for (let guard = 0; guard < 4 * w * h + 8; guard++) { const l = edges.get(cy * W1 + cx); if (!l || !l.length) break; const e = l.pop(); pts.push([cx, cy]); cx = e[0]; cy = e[1]; if (cx === sx && cy === sy) break; }
      const out = []; // join runs in a line
      for (let i = 0; i < pts.length; i++) { const a = pts[(i + pts.length - 1) % pts.length]; const b = pts[i]; const c = pts[(i + 1) % pts.length]; if ((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) !== 0) out.push(b); }
      if (out.length >= 3) loops.push(out);
    }
  }
  return loops;
}
const loopArea = (p) => { let a = 0; for (let i = 0; i < p.length; i++) { const q = p[(i + 1) % p.length]; a += p[i][0] * q[1] - q[0] * p[i][1]; } return a / 2; };
export const loopSize = (p) => Math.abs(loopArea(p));
/** A loop with the points that matter kept (Ramer-Douglas-Peucker): the staircase of a bitmap edge becomes straight lines. */
export function simplifyLoop(pts, eps = 0.8) {
  if (pts.length < 5) return pts.slice();
  const rdp = (p) => {
    if (p.length < 3) return p; const a = p[0]; const b = p[p.length - 1]; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = Math.hypot(dx, dy); let worst = -1; let wi = 0;
    for (let i = 1; i < p.length - 1; i++) { const d = l < 1e-9 ? Math.hypot(p[i][0] - a[0], p[i][1] - a[1]) : Math.abs((p[i][0] - a[0]) * dy - (p[i][1] - a[1]) * dx) / l; if (d > worst) { worst = d; wi = i; } }
    if (worst <= eps) return [a, b]; const left = rdp(p.slice(0, wi + 1)); const right = rdp(p.slice(wi)); return [...left.slice(0, -1), ...right];
  };
  let fi = 0; let fd = -1; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > fd) { fd = d; fi = i; } }
  const a = rdp(pts.slice(0, fi + 1)); const b = rdp([...pts.slice(fi), pts[0]]); return [...a.slice(0, -1), ...b.slice(0, -1)];
}
/** The bucket: from a mask, the outlines of the region that holds the pixel (sx, sy), flood filled and grown by a pixel so it tucks under the lines. Returns { mask, loops } or null if the pixel is not in the mask. */
export function floodRegion(allowed, w, h, sx, sy) {
  if (sx < 0 || sy < 0 || sx >= w || sy >= h || !allowed[sy * w + sx]) return null;
  const seen = new Uint8Array(w * h); const stack = [sy * w + sx]; seen[sy * w + sx] = 1;
  while (stack.length) {
    const i = stack.pop(); const x = i % w; const y = (i - x) / w;
    if (x > 0 && allowed[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; stack.push(i - 1); } if (x < w - 1 && allowed[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; stack.push(i + 1); }
    if (y > 0 && allowed[i - w] && !seen[i - w]) { seen[i - w] = 1; stack.push(i - w); } if (y < h - 1 && allowed[i + w] && !seen[i + w]) { seen[i + w] = 1; stack.push(i + w); }
  }
  const grown = new Uint8Array(seen); for (let i = 0; i < w * h; i++) if (seen[i]) { const x = i % w; if (x > 0) grown[i - 1] = 1; if (x < w - 1) grown[i + 1] = 1; if (i >= w) grown[i - w] = 1; if (i < w * (h - 1)) grown[i + w] = 1; }
  return { mask: grown, loops: maskLoops(grown, w, h) };
}

/** The points of a shape dragged from a to b on the canvas, closely spaced so that it follows a curved surface when it is taken into UV: 'line', 'oval' or 'box'. A box and an oval end where they began. */
export function shapePoints(kind, a, b, step = 8) {
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const seg = (p, q) => { const n = Math.max(1, Math.ceil(dist(p, q) / step)); return Array.from({ length: n }, (_, i) => [p[0] + ((q[0] - p[0]) * i) / n, p[1] + ((q[1] - p[1]) * i) / n]); };
  if (kind === 'box') { const c = [a, [b[0], a[1]], b, [a[0], b[1]]]; return [...c.flatMap((p, i) => seg(p, c[(i + 1) % 4])), [a[0], a[1]]]; }
  if (kind === 'oval') {
    const cx = (a[0] + b[0]) / 2; const cy = (a[1] + b[1]) / 2; const rx = Math.abs(b[0] - a[0]) / 2; const ry = Math.abs(b[1] - a[1]) / 2;
    const n = Math.min(96, Math.max(16, Math.ceil((Math.PI * (rx + ry)) / step))); return Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)]);
  }
  return [...seg(a, b), [b[0], b[1]]];
}
/** A copy of a stroke with every point (and every point of a filled region) taken through fn([u, v]), and its width times k. */
export function mapStroke(s, fn, k = 1) {
  return { ...s, w: Math.min(0.5, Math.max(0.001, s.w * k)), pts: s.pts.map((p) => keepWidth(p, fn(p))), ...(s.loops ? { loops: s.loops.map((l) => l.map((p) => fn(p))) } : {}) };
}
/** A stroke for the other side of the body: the same, or turned over across (v to 1 - v) for a part that faces the other way. */
export const mirrorStroke = (s, flipAcross) => mapStroke(s, ([u, v]) => [u, flipAcross ? Math.round((1 - v) * 1000) / 1000 : v]);

/** Whether a filled region reaches the edge of its picture: a shape drawn outside a part that is not closed lets the fill run out to the edge. */
export function touchesEdge(mask, w, h) {
  for (let x = 0; x < w; x++) if (mask[x] || mask[(h - 1) * w + x]) return true;
  for (let y = 0; y < h; y++) if (mask[y * w] || mask[y * w + w - 1]) return true;
  return false;
}

/** Which of several outlines (a part drawn in pieces, such as the thigh and the shin of a leg) a point is in: the one it is inside, otherwise the one whose middle is nearest. */
export function segmentAt(polys, x, y) {
  let best = 0; let bd = Infinity;
  for (let i = 0; i < polys.length; i++) {
    const P = polys[i]; let inside = false;
    for (let j = 0, k = P.length - 1; j < P.length; k = j++) { const [xi, yi] = P[j]; const [xk, yk] = P[k]; if (yi > y !== yk > y && x < ((xk - xi) * (y - yi)) / (yk - yi) + xi) inside = !inside; }
    if (inside) return i;
    const cx = P.reduce((t, p) => t + p[0], 0) / (P.length || 1); const cy = P.reduce((t, p) => t + p[1], 0) / (P.length || 1); const d = Math.hypot(cx - x, cy - y); if (d < bd) { bd = d; best = i; }
  }
  return best;
}
