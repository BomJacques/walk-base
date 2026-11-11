// The outline of a shape as modelling clay: the corners are rounded off and the edge is a little lumpy, as if shaped by hand, so the figure is soft all the way to its edge
// and not only in its shading. The lumps belong to the shape, not the screen: they are measured from the shape's own long axis, so a limb that turns carries its lumps with it
// and nothing shimmers as the figure walks. Pure: screen points in, screen points out.

const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const phase = (key, i) => ((Math.imul(hash(`${key}#${i}`), 2246822507) >>> 0) / 4294967296) * Math.PI * 2;

/** Rounds the corners of a closed polygon: each pass cuts every corner (Chaikin), so the points multiply by two. */
export function roundCorners(pts, passes = 2) {
  let p = pts;
  for (let k = 0; k < passes; k++) { const out = []; for (let i = 0; i < p.length; i++) { const a = p[i]; const b = p[(i + 1) % p.length]; out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]); } p = out; }
  return p;
}

/**
 * pts: the outline [[x, y], ...]; key: names the shape, so it always has the same lumps; k: the scale of the drawing (1 at 1080 lines); lump: how lumpy, 0 smooth to 1 very.
 * Returns a smooth closed outline about the same size as the one it was given.
 */
export function clayOutline(pts, key, k = 1, lump = 0.6) {
  const n = pts.length; if (n < 4) return pts;
  let cx = 0; let cy = 0; let area = 0; let per = 0;
  for (let i = 0; i < n; i++) { const a = pts[i]; const b = pts[(i + 1) % n]; cx += a[0]; cy += a[1]; area += a[0] * b[1] - b[0] * a[1]; per += Math.hypot(b[0] - a[0], b[1] - a[1]); }
  cx /= n; cy /= n; area = Math.abs(area) / 2;
  const half = area / Math.max(1e-6, per); // about half the width of the shape, whatever its length
  let far = pts[0]; let fd = -1; for (const q of pts) { const d = (q[0] - cx) ** 2 + (q[1] - cy) ** 2; if (d > fd) { fd = d; far = q; } }
  const ax = Math.atan2(far[1] - cy, far[0] - cx); const reach = Math.sqrt(fd) || 1;
  const smooth = roundCorners(pts, 2); if (half < 1.5 * k || lump <= 0) return smooth;
  const amp = Math.min(half * 0.26, 7 * k) * Math.min(1, lump);
  const p1 = phase(key, 1); const p2 = phase(key, 2); const p3 = phase(key, 3); const p4 = phase(key, 4);
  const m = smooth.length;
  return smooth.map((q, i) => {
    const a = smooth[(i + m - 1) % m]; const b = smooth[(i + 1) % m]; let nx = b[1] - a[1]; let ny = a[0] - b[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    if (nx * (q[0] - cx) + ny * (q[1] - cy) < 0) { nx = -nx; ny = -ny; } // outward
    const th = Math.atan2(q[1] - cy, q[0] - cx) - ax; const u = ((q[0] - cx) * Math.cos(ax) + (q[1] - cy) * Math.sin(ax)) / reach;
    // even harmonics only, so the result is the same whichever end of the shape counts as the first
    const w = 0.6 * Math.sin(2 * th + p1) + 0.5 * Math.sin(4 * th + p2) + 0.32 * Math.sin(6 * th + p3) + 0.5 * Math.cos(6 * u + p4);
    return [q[0] + nx * amp * w, q[1] + ny * amp * w];
  });
}
