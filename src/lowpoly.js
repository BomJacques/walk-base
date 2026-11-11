// The low-poly look as a real solid: every limb is a prism of a few flat sides built in the figure's own 3D space, so the facets turn with the camera,
// hide their own backs and catch the light by which way each one faces. This file makes the facets; draw.js paints them.
// S is the projector of the figure being drawn: world point -> { x, y, d } on the screen (d larger is nearer). sc is pixels per world unit.

import { hull } from './geom.js';

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const mean = (pts) => mul(pts.reduce((t, p) => add(t, p), [0, 0, 0]), 1 / pts.length);
export const SIDES = 6;
/** Gives a shape its facets, and (for a straight solid) an outline that is the outline of the facets themselves, so the silhouette and the faces agree. */
export function withFacets(sh, facets, ownOutline = true) { if (facets.length) { sh.facets = facets; sh.facetOutline = ownOutline; if (ownOutline) sh.pts = hull(facets.flatMap((f) => f.pts)); } return sh; } // a bent tube keeps its own outline: the hull of a bend would bridge it

/** One flat face: its corners on the screen, how near it is, and which way it faces as seen ([across, down, toward you], length 1). `inside` is a point within the solid. */
function facet(S, sc, pts, inside) {
  const c = mean(pts); let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) n = add(n, cross(sub(pts[i], c), sub(pts[(i + 1) % pts.length], c))); // the mean of the corner normals, so a slightly bent quad still has one
  n = unit(n); if (dot(n, sub(c, inside)) < 0) n = mul(n, -1);
  const P = pts.map(S); const C = S(c); const T = S(add(c, mul(n, 0.05))); const k = 0.05 * sc || 1;
  const sx = (T.x - C.x) / k; const sy = (T.y - C.y) / k; const sz = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy)) * (T.d >= C.d ? 1 : -1);
  return { pts: P.map((q) => [q.x, q.y]), d: P.reduce((t, q) => t + q.d, 0) / P.length, n: [sx, sy, sz] };
}

/** Rings of points (each the same count, going the same way round) joined into side faces, with each end closed by a point (a blunt cone) or, with none, a flat lid. */
export function ringsToFacets(S, sc, rings, tipA = null, tipB = null) {
  const out = []; const inside = mean(rings.flat()); const n = rings[0].length;
  for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; out.push(facet(S, sc, [rings[r][i], rings[r][j], rings[r + 1][j], rings[r + 1][i]], inside)); }
  const close = (ring, tip) => { if (tip) for (let i = 0; i < n; i++) out.push(facet(S, sc, [ring[i], ring[(i + 1) % n], tip], inside)); else out.push(facet(S, sc, ring, inside)); };
  close(rings[0], tipA); close(rings[rings.length - 1], tipB);
  return out.filter((f) => f.n[2] > -0.02).sort((a, b) => a.d - b.d); // the backs are hidden by the fronts: leave them out
}

/** Two directions square to an axis and to each other. */
function frame(axis) { const ref = Math.abs(axis[2]) > 0.9 ? [0, 1, 0] : [0, 0, 1]; const u = unit(cross(axis, ref)); return [u, cross(axis, u)]; }
const ring = (c, u, v, ru, rv, n = SIDES, turn = 0) => Array.from({ length: n }, (_, i) => { const t = turn + (i / n) * Math.PI * 2; return add(c, add(mul(u, ru * Math.cos(t)), mul(v, rv * Math.sin(t)))); });

/** A limb: a prism from a to b, as thick as ra and rb, with a blunt point at each end where the round end of the limb was. */
export function capsuleFacets(S, sc, a, b, ra, rb, n = SIDES) {
  const ax = unit(sub(b, a)); if (!Number.isFinite(ax[0]) || Math.hypot(...sub(b, a)) < 1e-6) return ellipsoidFacets(S, sc, a, (q) => q, [ra, ra, ra]);
  const [u, v] = frame(ax);
  return ringsToFacets(S, sc, [ring(a, u, v, ra, ra, n), ring(b, u, v, rb, rb, n)], add(a, mul(ax, -ra * 0.7)), add(b, mul(ax, rb * 0.7)));
}

/** A bent tube (a rubber hose limb, a tail, a neck): a ring at every other point of its path, joined up. */
export function chainFacets(S, sc, pts, radii, n = SIDES) {
  if (pts.length < 2) return [];
  const keep = pts.length > 6 ? pts.map((_, i) => i).filter((i) => i % 2 === 0 || i === pts.length - 1) : pts.map((_, i) => i);
  let prevU = null; const rings = keep.map((i) => {
    const t = unit(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])); let [u, v] = frame(t);
    if (prevU && dot(u, prevU) < 0) { u = mul(u, -1); v = mul(v, -1); } // keep the rings from flipping over along a bend
    prevU = u; return ring(pts[i], u, v, radii[i], radii[i], n);
  });
  const a = pts[0]; const b = pts[pts.length - 1]; const ta = unit(sub(pts[1], a)); const tb = unit(sub(b, pts[pts.length - 2]));
  return ringsToFacets(S, sc, rings, add(a, mul(ta, -radii[0] * 0.7)), add(b, mul(tb, radii[radii.length - 1] * 0.7)));
}

/** A body section between two cross-sections that are already in place (each a ring of world points): a box-like slab with flat lids. */
export const slabFacets = (S, sc, ringA, ringB) => ringsToFacets(S, sc, [ringA, ringB]);

/** A head or a ball: three rings between a point at the top and a point at the bottom. place(q) puts a point of the unit shape into the world about the centre. */
export function ellipsoidFacets(S, sc, center, place, rad, n = SIDES) {
  const at = (lat, i, turn) => { const ph = lat * Math.PI; const th = turn + (i / n) * Math.PI * 2; return add(center, place([rad[0] * Math.sin(ph) * Math.cos(th), rad[1] * Math.cos(ph), rad[2] * Math.sin(ph) * Math.sin(th)])); };
  const rings = [0.28, 0.52, 0.76].map((lat) => Array.from({ length: n }, (_, i) => at(lat, i, 0)));
  return ringsToFacets(S, sc, rings, add(center, place([0, rad[1], 0])), add(center, place([0, -rad[1], 0])));
}
