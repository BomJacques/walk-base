// Shapes shared by the rubber hose figures (the person and the animals): a limb as one smooth curve, the outline of a tube, and the wobble that runs along it.
// Pure geometry: world points in, screen outlines out.

const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/** A limb as one curve through three joints. bend 1 is a single smooth curve that passes through the middle joint; 0 is the joint's sharp corner. */
export function hoseCurve(a, m, b, bend, n = 14) {
  const c = [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2, 2 * m[2] - (a[2] + b[2]) / 2];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const smooth = [0, 1, 2].map((k) => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * c[k] + t * t * b[k]);
    const joint = t < 0.5 ? lerp3(a, m, t * 2) : lerp3(m, b, t * 2 - 1);
    return lerp3(joint, smooth, bend);
  });
}

/** A curve through any number of joints (a leg with a hock, a neck, a tail): n points, evenly spread over the joints. bend 1 rounds every corner, 0 keeps them sharp. */
export function hosePath(pts, bend = 1, n = 18) {
  if (pts.length < 2) return pts.slice();
  const m = pts.length - 1; const at = (i) => pts[Math.max(0, Math.min(m, i))];
  return Array.from({ length: n }, (_, i) => {
    const s = (i / (n - 1)) * m; const k = Math.min(m - 1, Math.floor(s)); const t = s - k;
    const p0 = at(k - 1); const p1 = at(k); const p2 = at(k + 1); const p3 = at(k + 2);
    const smooth = [0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (p2[c] - p0[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t * t + (3 * p1[c] - p0[c] - 3 * p2[c] + p3[c]) * t * t * t));
    return lerp3(lerp3(p1, p2, t), smooth, bend);
  });
}

/**
 * A wave running along a tube, on the screen: each point moves sideways, most in the middle of the tube and not at all at its ends, so the hand or foot on the end stays where it is.
 * P: [{ x, y, d }]; amp in pixels; phase in turns (the cycle phase times the number of wobbles in a cycle, plus a different start for each limb); free: the far end swings too (a tail).
 */
export function wobble(P, amp, phase, free = false) {
  if (!amp || P.length < 3) return P;
  const n = P.length; const a = P[0]; const b = P[n - 1]; let tx = b.x - a.x; let ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
  return P.map((q, i) => {
    const t = i / (n - 1); const env = free ? t : Math.sin(Math.PI * t); const w = amp * env * Math.sin(2 * Math.PI * (phase - 1.25 * t));
    return { ...q, x: q.x - ty * w, y: q.y + tx * w };
  });
}

/** Radii along a tube of n points: r thick, tapering by taper (positive is thicker at the root, negative thicker at the tip). */
export const taperRadii = (n, r, taper = 0) => Array.from({ length: n }, (_, i) => r * Math.max(0.25, 1 + taper * (0.5 - i / Math.max(1, n - 1))));

/** The outline of a tube (a thick line with round ends and a radius that can change along it) from screen points and radii. */
export function tubePoly(pts, radii) {
  const n = pts.length; const L = []; const R = [];
  const nrm = (i) => { const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(n - 1, i + 1)]; let tx = b.x - a.x; let ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; return [-ty, tx]; };
  for (let i = 0; i < n; i++) { const [nx, ny] = nrm(i); L.push([pts[i].x + nx * radii[i], pts[i].y + ny * radii[i]]); R.push([pts[i].x - nx * radii[i], pts[i].y - ny * radii[i]]); }
  const cap = (c, r, a0, a1, steps = 9) => Array.from({ length: steps - 1 }, (_, k) => { const a = a0 + (a1 - a0) * ((k + 1) / steps); return [c.x + r * Math.cos(a), c.y + r * Math.sin(a)]; });
  const e = nrm(n - 1); const a1 = Math.atan2(e[1], e[0]); const s0 = nrm(0); const a0 = Math.atan2(s0[1], s0[0]);
  return [...L, ...cap(pts[n - 1], radii[n - 1], a1, a1 - Math.PI), ...R.reverse(), ...cap(pts[0], radii[0], a0 + Math.PI, a0)];
}
