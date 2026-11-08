// Motion arcs: the path of any point of the figure through the cycle, one dot per frame, and dragging a dot to reshape the movement.
// Pure logic, no DOM. The stage draws what samplePaths returns and calls moveArcPoint while a dot is dragged.
import { cycleFrames } from './rig.js';
import { pose3, add, mul } from './rig3.js';
import { poseDog } from './dog3.js';
import { poseFor } from './keyposes.js';
import { makeEvaluator, CHANNEL_BY_ID } from './motion.js';
import { bakePoints, addHandle, mirrorPoints } from './curves.js';

const sides = [['R', 'Right', 'right'], ['L', 'Left', 'left']];
const LEGS = [['FR', 'Front right'], ['FL', 'Front left'], ['HR', 'Hind right'], ['HL', 'Hind left']];

/** Every point an arc can follow. `chain` lists the channels that move the point: dragging a dot reshapes just those curves. */
function humanPoints() {
  const out = [
    { id: 'head', label: 'Head', group: 'Head and body', pick: (z) => z.headC, chain: ['spine3.pitch', 'neck.pitch', 'head.pitch', 'neck.yaw', 'spine3.yaw'] },
    { id: 'chest', label: 'Chest', group: 'Head and body', pick: (z) => z.j3, chain: ['spine3.pitch', 'spine2.pitch', 'spine3.yaw', 'spine2.yaw'] },
    { id: 'hip', label: 'Hips', group: 'Head and body', pick: (z) => z.pelvis, chain: ['pelvis.y', 'pelvis.x', 'pelvis.z'] },
  ];
  for (const [s, Name] of sides) {
    out.push(
      { id: `toe.${s}`, label: `${Name} toe`, group: 'Legs', pick: (z) => add(z.sides[s].ankle, mul(z.sides[s].foot.fx, 0.16)), chain: [`foot.x.${s}`, `foot.y.${s}`, `foot.z.${s}`, `foot.pitch.${s}`] },
      { id: `shoulder.${s}`, label: `${Name} shoulder`, group: 'Arms', pick: (z) => z.sides[s].shoulder, chain: [`girdle.x.${s}`, `girdle.y.${s}`] },
      { id: `elbow.${s}`, label: `${Name} elbow`, group: 'Arms', pick: (z) => z.sides[s].elbow, chain: [`arm.pitch.${s}`, `arm.roll.${s}`, `girdle.y.${s}`, `girdle.x.${s}`] },
      { id: `wrist.${s}`, label: `${Name} wrist`, group: 'Arms', pick: (z) => z.sides[s].wrist, chain: [`arm.pitch.${s}`, `elbow.flex.${s}`, `arm.roll.${s}`, `girdle.y.${s}`, `girdle.x.${s}`] },
      { id: `hand.${s}`, label: `${Name} fingertips`, group: 'Arms', pick: (z) => z.sides[s].hand, chain: [`arm.pitch.${s}`, `elbow.flex.${s}`, `wrist.flex.${s}`, `arm.roll.${s}`, `girdle.y.${s}`, `girdle.x.${s}`] },
      { id: `knee.${s}`, label: `${Name} knee`, group: 'Legs', pick: (z) => z.sides[s].knee, chain: [`foot.x.${s}`, `foot.y.${s}`, `foot.z.${s}`, `knee.out.${s}`] },
      { id: `ankle.${s}`, label: `${Name} ankle`, group: 'Legs', pick: (z) => z.sides[s].ankle, chain: [`foot.x.${s}`, `foot.y.${s}`, `foot.z.${s}`] },
    );
  }
  return out;
}
function dogPoints() {
  const out = [
    { id: 'head', label: 'Head', group: 'Head and body', pick: (z) => z.headC, chain: ['dog.spine3.pitch', 'dog.neck.pitch', 'dog.head.pitch', 'dog.neck.yaw', 'dog.spine3.yaw'] },
    { id: 'nose', label: 'Nose', group: 'Head and body', pick: (z) => z.noseTip, chain: ['dog.spine3.pitch', 'dog.neck.pitch', 'dog.head.pitch', 'dog.neck.yaw', 'dog.head.yaw'] },
    { id: 'chest', label: 'Chest', group: 'Head and body', pick: (z) => z.j3, chain: ['dog.spine3.pitch', 'dog.spine2.pitch', 'dog.spine3.yaw', 'dog.spine2.yaw'] },
    { id: 'jaw', label: 'Jaw tip', group: 'Head and body', pick: (z) => z.jawEnd, chain: ['dog.jaw.open'] },
    { id: 'hip', label: 'Hips', group: 'Head and body', pick: (z) => z.pelvis, chain: ['dog.pelvis.y', 'dog.pelvis.x', 'dog.pelvis.z'] },
    { id: 'tailmid', label: 'Tail middle', group: 'Head and body', pick: (z) => z.tail[2], chain: ['dog.tail1.pitch', 'dog.tail2.pitch', 'dog.tail1.yaw', 'dog.tail2.yaw'] },
    { id: 'tail', label: 'Tail tip', group: 'Head and body', pick: (z) => z.tail[3], chain: ['dog.tail1.pitch', 'dog.tail2.pitch', 'dog.tail3.pitch', 'dog.tail1.yaw', 'dog.tail2.yaw', 'dog.tail3.yaw'] },
  ];
  for (const [k, Name] of LEGS) {
    const side = k[1]; const pre = k[0] === 'F' ? 'dog.fpaw' : 'dog.hpaw';
    out.push(
      { id: `joint.${k}`, label: `${Name} ${k[0] === 'F' ? 'elbow' : 'knee'}`, group: 'Legs', pick: (z) => z.legs[k].mid, chain: [`${pre}.x.${side}`, `${pre}.y.${side}`, `${pre}.z.${side}`, `${k[0] === 'F' ? 'dog.fleg' : 'dog.hleg'}.out.${side}`] },
      { id: `paw.${k}`, label: `${Name} paw`, group: 'Legs', pick: (z) => z.legs[k].paw, chain: [`${pre}.x.${side}`, `${pre}.y.${side}`, `${pre}.z.${side}`] },
      { id: `toe.${k}`, label: `${Name} toe`, group: 'Legs', pick: (z) => z.legs[k].toe, chain: [`${pre}.x.${side}`, `${pre}.y.${side}`, `${pre}.z.${side}`, `${pre}.pitch.${side}`] },
    );
  }
  return out;
}
const HUMAN = humanPoints(); const DOG = dogPoints();
export const arcPoints = (rig) => (rig === 'dog' ? DOG : HUMAN);
export const arcPoint = (rig, id) => arcPoints(rig).find((p) => p.id === id) || null;
/** The arcs shown to start with: both sides. */
export const DEFAULT_ARCS = { human: ['head', 'hip', 'wrist.R', 'wrist.L', 'ankle.R', 'ankle.L'], dog: ['head', 'hip', 'paw.FR', 'paw.FL', 'paw.HR', 'paw.HL', 'tail'] };
/** Which side of the body a point is on: 'R', 'L' or null. */
export const arcSide = (id) => (/\.(R|L)$/.test(id) ? id.slice(-1) : /\.[FH](R|L)$/.test(id) ? id.slice(-1) : null);

/** A colour for each point, steady while you tick others on and off. */
export const ARC_PALETTE = ['#d0342c', '#1f77b4', '#2a9d4b', '#c77700', '#8e44ad', '#0b8f8c', '#b5338a', '#6b6b6b'];
export const arcColor = (rig, id) => ARC_PALETTE[Math.max(0, arcPoints(rig).findIndex((p) => p.id === id)) % ARC_PALETTE.length];

/** Old files named four fixed arcs; map them to the new points. Unknown names are dropped. */
export function adoptArcs(rig, list) {
  if (!Array.isArray(list)) return null;
  const old = { wrist: rig === 'dog' ? 'paw.FR' : 'wrist.R', ankle: rig === 'dog' ? 'paw.HR' : 'ankle.R' };
  const ok = new Set(arcPoints(rig).map((p) => p.id));
  return [...new Set(list.map((a) => old[a] || a))].filter((a) => ok.has(a));
}

/** Where along x the arc sits: with the figure walking across it follows the pelvis, otherwise it stays beside the figure as it is now. */
export const arcOffsetX = (params, q, cur) => (params.travel === 'across' ? q.pelvisX : cur.pelvisX);

/** The path of each point over every frame of the cycle or performance. Returns Map id → [{ frame, p: [x, y, z] }] with p in world units. */
export function samplePaths(params, defs, cur) {
  const T = cycleFrames(params).frames.length;
  const out = new Map(defs.map((d) => [d.id, []]));
  for (let f = 0; f < T; f++) {
    const q = poseFor(params, f); const ox = arcOffsetX(params, q, cur);
    for (const d of defs) { const pt = d.pick(q); out.get(d.id).push({ frame: f, p: [pt[0] + ox, pt[1], pt[2]] }); }
  }
  return out;
}

/**
 * Damped least squares: finds channel values near v0 that put the point (f gives its screen position) on target.
 * Variables are scaled by `scales` so radians and leg lengths count alike. Returns { v, err } with err in the units of f.
 */
export function solveMove(f, v0, target, scales, { iters = 10, damp = 0.04, tol = 0.2, maxStep = 0.25 } = {}) {
  const n = v0.length; let v = v0.slice();
  const err = (p) => Math.hypot(target[0] - p[0], target[1] - p[1]);
  let p = f(v);
  for (let it = 0; it < iters && err(p) > tol; it++) {
    const J = [[], []];
    for (let i = 0; i < n; i++) {
      const w = v.slice(); const h = 0.004 * scales[i]; w[i] += h;
      const q = f(w); J[0][i] = ((q[0] - p[0]) / h) * scales[i]; J[1][i] = ((q[1] - p[1]) / h) * scales[i];
    }
    const a = J[0].reduce((s, x) => s + x * x, 0); const b = J[0].reduce((s, x, i) => s + x * J[1][i], 0); const c = J[1].reduce((s, x) => s + x * x, 0);
    const lam = damp * ((a + c) / 2 + 1e-9);
    const A = a + lam; const D = c + lam; const det = A * D - b * b;
    if (Math.abs(det) < 1e-12) break;
    const ex = target[0] - p[0]; const ey = target[1] - p[1];
    const y0 = (D * ex - b * ey) / det; const y1 = (-b * ex + A * ey) / det;
    let step = J[0].map((x, i) => x * y0 + J[1][i] * y1);
    const big = Math.max(...step.map(Math.abs)); if (big > maxStep) step = step.map((s) => (s * maxStep) / big);
    const w = v.map((x, i) => x + step[i] * scales[i]); const q = f(w);
    if (err(q) >= err(p)) { // overshoot: take half
      const w2 = v.map((x, i) => x + (step[i] * scales[i]) / 2); const q2 = f(w2);
      if (err(q2) >= err(p)) break;
      v = w2; p = q2;
    } else { v = w; p = q; }
  }
  return { v, err: err(p) };
}

/** How the two sides are tied together when you reshape an arc: not at all, the other side half a cycle later (a gait), or the other side doing the same at the same moment, mirrored left to right. */
export const SYMMETRY = [['none', 'Independent'], ['alt', 'Alternate'], ['mirror', 'Mirror']];
/** The other side's curve for a curve on this side, in a symmetry mode: half a cycle later for Alternate, the same moment for Mirror. */
export const otherSideCurve = (pts, mode) => (mode === 'mirror' ? pts.map((q) => ({ ...q })) : mirrorPoints(pts));
const flip = (id) => (id.endsWith('.R') ? `${id.slice(0, -1)}L` : id.endsWith('.L') ? `${id.slice(0, -1)}R` : null);
/**
 * Makes the two sides of the figure symmetrical for the points given: the curves that drive the points on side `from` are copied to the other side
 * (half a cycle later for 'alt', the same moment for 'mirror'). Returns the new settings for the channels on both sides.
 */
export function symmetrize({ params, defs, from, mode = 'alt' }) {
  const motion = params.motion || {}; const ev = makeEvaluator(params, motion); const out = {};
  const ids = new Set(defs.flatMap((d) => d.chain).filter((id) => CHANNEL_BY_ID[id]?.sided && id.endsWith(`.${from}`)));
  for (const id of ids) {
    const o = flip(id); if (!o || !CHANNEL_BY_ID[o]) continue;
    const s = motion[id]; const plain = s?.pts?.length >= 2 && (s.amount ?? 1) === 1 && !s.offset && !s.phase && (s.freq ?? 1) === 1;
    const pts = plain ? s.pts.map((q) => ({ ...q })) : bakePoints((x) => ev.value(id, x), 12);
    out[id] = { pts }; out[o] = { pts: otherSideCurve(pts, mode) };
  }
  return out;
}

const nearHandle = (pts, u, tol) => pts.findIndex((q) => Math.min(Math.abs(q.u - u), 1 - Math.abs(q.u - u)) <= tol);

/**
 * Drags the point of arc `def` at `frame` so that it lands on `target`. `project(world, ...)` turns a world position into the screen position the
 * dot is drawn at. Only the curves in def.chain change. Returns { entries, err } with the new settings for those channels, or null when the
 * point cannot be reshaped here (a performance, or a channel that runs free).
 * `entries` are baked curves (amount 1, offset 0), so the movement is the same as before everywhere except round the dragged frame.
 */
export function moveArcPoint({ params, def, frame, curFrame = frame, target, project }) {
  if (params.perf || params.sampled) return null;
  const rig = params.rig === 'dog' ? 'dog' : 'human';
  const poser = rig === 'dog' ? poseDog : pose3;
  const motion = params.motion || {};
  const { frames } = cycleFrames(params); const T = frames.length;
  const u = frames[frame].u;
  const ev = makeEvaluator(params, motion);
  const ids = def.chain.filter((id) => CHANNEL_BY_ID[id]);
  if (ids.some((id) => motion[id]?.free)) return null;
  const work = ids.map((id) => {
    const s = motion[id];
    const plain = s?.pts?.length >= 2 && (s.amount ?? 1) === 1 && !s.offset && !s.phase && (s.freq ?? 1) === 1;
    let pts = plain ? s.pts.map((q) => ({ ...q })) : bakePoints((x) => ev.value(id, x), 12);
    let idx = nearHandle(pts, u, 0.4 / T);
    if (idx < 0) { pts = addHandle(pts, u, ev.value(id, u)); idx = nearHandle(pts, u, 1e-6); }
    return { id, pts, idx };
  });
  const ox = arcOffsetX(params, poser(params, motion, u, null), poseFor(params, curFrame)); // the offset the dots were drawn with
  const at = (vals) => {
    const m2 = { ...motion };
    work.forEach((w, i) => { const pts = w.pts.map((q, k) => (k === w.idx ? { u: q.u, v: vals[i] } : q)); m2[w.id] = { pts }; });
    const pt = def.pick(poser(params, m2, u, null));
    const s = project([pt[0] + ox, pt[1], pt[2]]);
    return [s.x, s.y];
  };
  const v0 = work.map((w) => w.pts[w.idx].v);
  const scales = work.map((w) => { const c = CHANNEL_BY_ID[w.id]; return Math.max(1e-3, Math.abs((c.from ? c.from(c.max) : c.max) - (c.from ? c.from(c.min) : c.min)) / 2); });
  const r = solveMove(at, v0, target, scales);
  const entries = {};
  // Only the channels the drag actually changed are written, so a side-on drag leaves the sideways channels alone.
  work.forEach((w, i) => { if (Math.abs(r.v[i] - v0[i]) < 1e-7) return; const pts = w.pts.map((q, k) => (k === w.idx ? { u: q.u, v: r.v[i] } : q)); entries[w.id] = { pts }; });
  return { entries, err: r.err };
}
