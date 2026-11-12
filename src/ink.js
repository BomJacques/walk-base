// Painting the strokes of a drawing. A stroke's points are in UV (0 to 1 across the thing drawn on); `map` takes a UV point to the canvas.
import { strokeShows } from './design.js';

/**
 * Paints strokes that show on `frame`. `size` is the size of the thing drawn on, in the canvas's units: a stroke's width is a share of it.
 * `minW` is the thinnest line to draw. Strokes are smoothed through the midpoints of their points; a fill stroke is a closed, filled shape.
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
    const P = s.pts.map(([u, v]) => map(u, v)); ctx.beginPath();
    if (P.length === 1) { ctx.arc(P[0][0], P[0][1], Math.max(minW, (s.w * size) / 2), 0, Math.PI * 2); ctx.fillStyle = s.c; ctx.fill(); continue; }
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    if (s.fill) { ctx.closePath(); ctx.fillStyle = s.c; ctx.fill(); } else { ctx.strokeStyle = s.c; ctx.lineWidth = Math.max(minW, s.w * size); ctx.stroke(); }
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
