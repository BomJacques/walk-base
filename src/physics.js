// Physics for things that hang off the body: a cape, a coat tail, a ponytail, a scarf. A strip is a chain of points pinned to its anchor on a part.
// The chain is simulated over the whole cycle (or performance) ahead of time, so scrubbing and exporting always give the same frame.
// Pure logic, no DOM. attach.js draws the result; draw.js asks for it with stripSims.
import { cycleFrames } from './rig.js';
import { poseFor } from './keyposes.js';
import { partBone, partRadius, edgePoint } from './attach.js';

import { STRIP_DEFAULTS, STRIP_LIMITS, cleanPhys } from './stripdefs.js';
export { STRIP_DEFAULTS, STRIP_LIMITS, cleanPhys };

const SUB = 4; // steps per frame
const ITER = 8; // distance passes per step
const G = 10.9; // gravity in leg lengths per second squared (about 9.8 m/s² for a leg of 0.9 m)
const norm = (x, y) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; };

/** Where the strip is pinned, in the pose's own world (before the walk's forward travel): the anchor point, and the direction of the part's bone. */
export function stripRoot(it, pz) {
  const bone = partBone(pz, it.part, it.seg, it.side);
  if (!bone) return null;
  const [A, B] = bone;
  const [dx, dy] = norm(B[0] - A[0], B[1] - A[1]);
  const L = Math.max(1e-4, Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]));
  let lx; let ly;
  if (it.anchor.mode === 'free') { lx = it.anchor.x; ly = it.anchor.y; } else { const e = edgePoint(L, partRadius(pz, it.part, it.seg), it.anchor.t); lx = e.x + e.nx * it.anchor.off; ly = e.y + e.ny * it.anchor.off; }
  // The local frame's y runs across the part, the screen's way round: (dy, -dx) in a y-up world.
  return { x: A[0] + dx * lx + dy * ly, y: A[1] + dy * lx - dx * ly, z: A[2], dir: [dx, dy] };
}

/**
 * Simulates one chain. roots[f] = { x, y, dir } is where it is pinned at each frame (x continuous, so a walk keeps going forward).
 * `loop` frames are run `lead` times first so the chain has settled into the motion; only the last pass is returned.
 * Returns an array per frame of nodes, each [dx, dy] from the root of that frame.
 */
export function simulateStrip(roots, phys, length, { fps = 24, cycle = roots.length, loops = 1, travel = 0, warm = 0 } = {}) {
  const P = cleanPhys(phys); const N = P.nodes; const seg = length / (N - 1);
  const T = roots.length; const dt = 1 / (fps * SUB);
  const damp = 1 - (1 - P.damp) ** (1 / SUB);
  const restVec = (r) => {
    const d = r.dir; const bx = (1 - P.follow) * 0 + P.follow * d[0]; const by = (1 - P.follow) * -1 + P.follow * d[1];
    const [vx, vy] = norm(bx, by); const a = (P.angle * Math.PI) / 180;
    return [vx * Math.cos(a) - vy * Math.sin(a), vx * Math.sin(a) + vy * Math.cos(a)];
  };
  const at = (k) => { const r = roots[((k % T) + T) % T]; const lap = Math.floor(k / T); return { x: r.x + lap * travel, y: r.y, dir: r.dir }; };
  const x = new Float64Array(N); const y = new Float64Array(N); const qx = new Float64Array(N); const qy = new Float64Array(N);
  const r0 = at(0); const v0 = restVec(r0);
  for (let i = 0; i < N; i++) { x[i] = qx[i] = r0.x + v0[0] * seg * i; y[i] = qy[i] = r0.y + v0[1] * seg * i; }
  let prev = r0;
  const total = (warm + loops) * T; const out = [];
  const step = (k, rootNow, s) => {
    const f = (s + 1) / SUB; const rx = prev.x + (rootNow.x - prev.x) * f; const ry = prev.y + (rootNow.y - prev.y) * f;
    const phase = (k + f) / cycle;
    const ax = P.wind * 6 * (1 + (P.gusts ? 0.6 * Math.sin(2 * Math.PI * P.gusts * phase) : 0)); const ay = -G * P.gravity;
    for (let i = 1; i < N; i++) {
      const vx = (x[i] - qx[i]) * (1 - damp); const vy = (y[i] - qy[i]) * (1 - damp);
      qx[i] = x[i]; qy[i] = y[i]; x[i] += vx + ax * dt * dt; y[i] += vy + ay * dt * dt;
    }
    x[0] = rx; y[0] = ry; qx[0] = rx; qy[0] = ry;
    const rest = restVec(rootNow);
    if (P.stiff > 0) {
      for (let i = 1; i < N; i++) { // bend resistance: each segment wants to carry on the way the one before pointed
        const [dx, dy] = i === 1 ? rest : norm(x[i - 1] - x[i - 2], y[i - 1] - y[i - 2]);
        x[i] += (x[i - 1] + dx * seg - x[i]) * P.stiff * 0.5; y[i] += (y[i - 1] + dy * seg - y[i]) * P.stiff * 0.5;
      }
    }
    for (let it = 0; it < ITER; it++) {
      for (let i = 0; i < N - 1; i++) {
        const dx = x[i + 1] - x[i]; const dy = y[i + 1] - y[i]; const d = Math.hypot(dx, dy) || 1e-9; const e = (d - seg) / d;
        if (i === 0) { x[1] -= dx * e; y[1] -= dy * e; } else { x[i] += dx * e * 0.5; y[i] += dy * e * 0.5; x[i + 1] -= dx * e * 0.5; y[i + 1] -= dy * e * 0.5; }
      }
    }
  };
  for (let k = 0; k < total; k++) {
    const rootNow = at(k);
    for (let s = 0; s < SUB; s++) step(k, rootNow, s);
    prev = rootNow;
    if (k >= warm * T) out.push(Array.from({ length: N }, (_, i) => [x[i] - rootNow.x, y[i] - rootNow.y]));
  }
  return out;
}

const cache = new Map(); // item id -> { key, value }
const perfSig = (perf) => (perf ? JSON.stringify([perf.T, perf.lanes, perf.live]) : '');
/** One key for everything the simulation depends on, apart from the item's own physics. */
const worldKey = (params) => JSON.stringify([params.rig, params.motion, params.travel, params.cycleFrames, params.fps, params.exposure, params.stepLength, params.dogStride, params.dogGait,
  Object.fromEntries(Object.entries(params).filter(([k, v]) => typeof v === 'number' && k !== 'attach')), perfSig(params.perf)]);

/**
 * The simulated strips of a figure over every frame. Returns Map id → { frames: [{ root: [x, y, z], nodes: [[dx, dy] ...] }] }, root before the walk's travel.
 * Results are kept until the item, the movement or the settings change.
 */
export function stripSims(params, items) {
  const strips = (items || []).filter((it) => it.kind === 'strip' && it.visible !== false);
  const out = new Map();
  if (!strips.length) return out;
  const wk = worldKey(params);
  const T = cycleFrames(params).frames.length;
  let poses = null;
  for (const it of strips) {
    const key = `${wk}|${JSON.stringify([it.part, it.seg, it.side, it.anchor, it.h, it.phys])}`;
    const hit = cache.get(it.id);
    if (hit && hit.key === key) { out.set(it.id, hit.value); continue; }
    poses = poses || Array.from({ length: T }, (_, f) => poseFor(params, f));
    const roots = poses.map((pz) => { const r = stripRoot(it, pz); return r ? { ...r, pelvisX: pz.pelvisX } : null; });
    if (roots.some((r) => !r)) continue;
    const perf = Boolean(params.perf);
    const dog = params.rig === 'dog';
    const stride = dog ? params.dogStride : 2 * params.stepLength;
    const world = roots.map((r) => ({ x: r.x + r.pelvisX, y: r.y, dir: r.dir }));
    const nodes = simulateStrip(world, it.phys, it.h, { fps: params.fps || 24, cycle: Math.max(2, Math.round(params.cycleFrames)), loops: 1, travel: perf ? 0 : stride, warm: perf ? 0 : 6 });
    const value = { frames: roots.map((r, f) => ({ root: [r.x, r.y, r.z], pelvisX: r.pelvisX, nodes: nodes[f] })) };
    cache.set(it.id, { key, value }); out.set(it.id, value);
  }
  return out;
}
