// Numbers about a performance: the pose at any frame, the key poses (where the movement changes direction or a foot lands), and every lane as a table.
// Pure logic, no DOM, so it can be tested and reused by the exporters.
import { cycleFrames, DEFAULTS } from './rig.js';
import { pose3 } from './rig3.js';
import { poseDog } from './dog3.js';
import { paramsAt, motionAt, parseTarget, laneValue, CADENCE } from './automation.js';

/** The pose the figure has at timeline frame `frame`, the same one the stage draws. */
const withDelta = (m, d) => { const o = { ...m }; for (const [id, v] of Object.entries(d)) o[id] = { ...(o[id] || {}), offset: (o[id]?.offset || 0) + v }; return o; };
export function poseFor(params, frame, delta = null) {
  const dog = params.rig === 'dog';
  const poser = dog ? poseDog : pose3;
  const perf = params.perf || null;
  if (perf) {
    const ex = Math.max(1, params.exposure ?? 1);
    const t = Math.min(perf.T - 1, Math.floor(frame / ex) * ex);
    const p = paramsAt(params, perf.lanes, t, perf.live); let m = motionAt(params.motion || {}, perf.lanes, t, perf.live); if (delta) m = withDelta(m, delta);
    return poser(p, m, perf.u[t], { worldX: perf.x[t], freeU: t / Math.max(2, Math.round(params.cycleFrames)) });
  }
  const { frames } = cycleFrames(params);
  const f = frames[((frame % frames.length) + frames.length) % frames.length];
  return poser(params, delta ? withDelta(params.motion || {}, delta) : params.motion || {}, f.u, null);
}

/** The points whose paths define a pose, with a name for each. Positions are relative to the pelvis except for the vertical ones that show the bounce. */
export function trackedPoints(pz) {
  const rel = (pt) => [pt[0] - pz.pelvis[0], pt[1] - pz.pelvis[1]];
  const out = [{ name: 'head height', v: pz.headC[1] }, { name: 'hip height', v: pz.pelvis[1] }];
  if (pz.sides) {
    for (const s of ['R', 'L']) {
      const side = s === 'R' ? 'right' : 'left';
      const hand = rel(pz.sides[s].wrist); const foot = rel(pz.sides[s].ankle);
      out.push({ name: `${side} hand forward`, v: hand[0] }, { name: `${side} hand height`, v: hand[1] }, { name: `${side} foot forward`, v: foot[0] }, { name: `${side} foot height`, v: foot[1] });
    }
  } else if (pz.legs) {
    for (const k of ['FL', 'FR', 'HL', 'HR']) {
      const paw = rel(pz.legs[k].paw);
      out.push({ name: `${k} paw forward`, v: paw[0] }, { name: `${k} paw height`, v: paw[1] });
    }
    out.push({ name: 'tail tip height', v: pz.tail[3][1] });
  }
  return out;
}
const contacts = (pz) => (pz.sides ? { 'right foot': pz.sides.R.stance, 'left foot': pz.sides.L.stance } : Object.fromEntries(Object.entries(pz.legs).map(([k, l]) => [`${k} paw`, l.stance])));

/**
 * The highs and lows of a series. A turn counts only once the series has moved `eps` away from it, so small wobbles are ignored.
 * Returns [{ t, kind: 'high' | 'low' }] in time order. The first and last frames are not counted as turns.
 */
export function turningPoints(s, eps) {
  const out = [];
  let dir = 0; let hi = 0; let lo = 0;
  for (let t = 1; t < s.length; t++) {
    if (s[t] > s[hi]) hi = t;
    if (s[t] < s[lo]) lo = t;
    if (dir <= 0 && s[t] - s[lo] >= eps) { if (dir === -1) out.push({ t: lo, kind: 'low' }); dir = 1; hi = t; }
    else if (dir >= 0 && s[hi] - s[t] >= eps) { if (dir === 1) out.push({ t: hi, kind: 'high' }); dir = -1; lo = t; }
  }
  return out;
}

/** Frames where a tracked point turns round (a high or low), and frames where a foot or paw lands. `minSwing` is the smallest turn that counts, as a share of the point's range. */
export function findKeyFrames(params, { minSwing = 0.08 } = {}) {
  const T = cycleFrames(params).frames.length;
  const pzs = Array.from({ length: T }, (_, t) => poseFor(params, t));
  const names = trackedPoints(pzs[0]).map((q) => q.name);
  const series = names.map((_, i) => pzs.map((z) => trackedPoints(z)[i].v));
  const found = new Map();
  const add = (t, why) => { if (!found.has(t)) found.set(t, []); found.get(t).push(why); };
  add(0, 'start');
  series.forEach((s, i) => {
    const range = Math.max(...s) - Math.min(...s);
    if (range < 1e-6) return;
    for (const q of turningPoints(s, range * minSwing)) add(q.t, `${names[i]} ${q.kind}`);
  });
  // A plain cycle loops, so a foot that lands on the first frame has just come down from the last one.
  for (let t = params.perf ? 1 : 0; t < T; t++) {
    const a = contacts(pzs[(t - 1 + T) % T]); const b = contacts(pzs[t]);
    for (const k of Object.keys(b)) if (b[k] && !a[k]) add(t, `${k} lands`);
  }
  return [...found.entries()].sort((x, y) => x[0] - y[0]).map(([frame, reasons]) => ({ frame, reasons: [...new Set(reasons)] }));
}

/** Every lane (and the cycle phase and position) at each frame, as a table. */
export function laneTable(params) {
  const perf = params.perf;
  const T = cycleFrames(params).frames.length;
  const lanes = perf?.lanes || {};
  const targets = Object.keys(lanes).filter((t) => lanes[t].pts?.length);
  const base = (target) => {
    const k = parseTarget(target);
    if (k.kind === 'cadence') return 1;
    if (k.kind === 'param') return params[k.id] ?? DEFAULTS[k.id];
    return k.what === 'amount' ? (params.motion?.[k.id]?.amount ?? 1) : (params.motion?.[k.id]?.offset ?? 0);
  };
  const columns = ['frame', 'seconds', 'cycle_phase', 'position', ...targets];
  const rows = [];
  for (let t = 0; t < T; t++) {
    rows.push([t + 1, t / params.fps, perf ? perf.u[t] : cycleFrames(params).frames[t].u, perf ? perf.x[t] : 0, ...targets.map((g) => laneValue(lanes[g], t, base(g)))]);
  }
  return { columns, rows, targets };
}
const num = (v) => (typeof v === 'number' ? String(Math.round(v * 1e6) / 1e6) : String(v));
export const tableCsv = (tb) => [tb.columns.join(','), ...tb.rows.map((r) => r.map(num).join(','))].join('\n') + '\n';
export { CADENCE };
