// Seamless loop: adjusts the timeline so the last frame leads straight back into the first, with no jump.
// A plain walk cycle already repeats (it is one cycle), so there it only makes the frame count fit the exposure. A performance (automation lanes) does not: its
// length is made a whole number of cycles, every lane eases back to where it started, and the pace is trimmed so the walk arrives back at the same moment of
// its stride. Pure logic; the app applies the result and shows how smooth the join is.
import { laneValue, integrate, CADENCE } from './automation.js';
import { poseFor } from './keyposes.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** Lane `lane` eased so it ends one step short of its own start value, over the last `blend` frames of a performance T frames long. */
export function closeLane(lane, T, blend) {
  const pts = lane?.pts; if (!pts?.length) return lane;
  const v0 = laneValue(lane, 0, pts[0].v); const tb = T - blend; const vb = laneValue(lane, tb, v0);
  const kept = pts.filter((q) => q.t < tb && q.t <= T - 1);
  const closed = [...kept, { t: tb, v: vb }, { t: T - 1, v: v0 + (vb - v0) / blend }];
  if (closed[0].t > 0 && closed[0].v !== v0) closed.unshift({ t: 0, v: v0 });
  return { ...lane, pts: closed.filter((q, i, a) => i === 0 || q.t > a[i - 1].t) };
}

/**
 * What to change to make the loop seamless. base: the walk's parameters; lanes: the automation lanes; perfLen: the performance length (0 for none);
 * returns { cycleFrames, perfLen, lanes, notes } (the same values when nothing needs doing).
 */
export function makeSeamless({ base, lanes, perfLen = 0, cycleFrames, exposure = 1 }) {
  const notes = []; const ex = Math.max(1, Math.round(exposure));
  let n = Math.max(2, Math.round(cycleFrames));
  const n2 = Math.max(ex * 2, Math.round(n / ex) * ex);
  if (n2 !== n) { notes.push(`The cycle is ${n2} frames, a whole number of drawings at exposure ${ex} (it was ${n}).`); n = n2; }
  const hasLanes = lanes && Object.keys(lanes).some((k) => lanes[k]?.pts?.length);
  if (!hasLanes && !(perfLen > 0)) {
    notes.push(`One cycle of ${n} frames: it repeats exactly.`);
    return { cycleFrames: n, perfLen: 0, lanes: lanes || {}, notes };
  }
  // a performance: a whole number of cycles
  const T0 = perfLen > 0 ? perfLen : n; const cycles = Math.max(1, Math.round(T0 / n)); const T = cycles * n;
  if (T !== T0) notes.push(`The performance is ${T} frames, ${cycles} whole cycle${cycles > 1 ? 's' : ''} (it was ${T0}).`);
  const blend = clamp(Math.round(T * 0.15), 2, 24);
  let out = {};
  let closed = 0;
  for (const [k, lane] of Object.entries(lanes || {})) { if (!lane?.pts?.length) continue; const c = closeLane(lane, T, blend); out[k] = c; if (JSON.stringify(c.pts) !== JSON.stringify(lane.pts)) closed++; }
  if (closed) notes.push(`${closed} lane${closed > 1 ? 's' : ''} ease back to their starting value over the last ${blend} frames.`);
  // the walk has to arrive back at the same point of its stride: a whole number of cycles of phase
  if (out[CADENCE]?.pts?.length) {
    const s = integrate(base, out, T, n); const U = s.u[T]; const target = Math.max(1, Math.round(U));
    const f = target / U;
    if (Math.abs(f - 1) > 1e-6) { out = { ...out, [CADENCE]: { ...out[CADENCE], pts: out[CADENCE].pts.map((q) => ({ ...q, v: q.v * f })) } }; notes.push(`The pace is trimmed by ${((f - 1) * 100).toFixed(1)}% so the walk covers exactly ${target} cycle${target > 1 ? 's' : ''}.`); }
  }
  return { cycleFrames: n, perfLen: T, lanes: out, notes };
}

/** The joints that show a jump at the join, in the figure's own frame. */
const JOINTS = (z) => (z.legs ? [z.pelvis, z.headC, z.noseTip, z.legs.HR?.paw, z.legs.HL?.paw, z.legs.FR?.paw, z.legs.FL?.paw, z.tail?.[3]] : [z.pelvis, z.headC, z.sides.R.wrist, z.sides.L.wrist, z.sides.R.ankle, z.sides.L.ankle]).filter(Boolean);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * How big the step from the last frame to the first is next to the biggest step between other frames. 1 or less means the join is no bigger than a step the walk takes anyway;
 * a jump shows as a ratio well above 1. params carries the performance (params.perf) the way the stage reads it.
 */
export function loopGap(params) {
  const ex = Math.max(1, params.exposure ?? 1);
  const T = params.perf ? params.perf.T : Math.max(2, Math.round(params.cycleFrames));
  const frames = []; for (let f = 0; f < T; f += ex) frames.push(f);
  const poses = frames.map((f) => JOINTS(poseFor(params, f)));
  const step = (a, b) => a.reduce((t, p, i) => t + dist(p, b[i]), 0);
  const steps = []; for (let i = 1; i < poses.length; i++) steps.push(step(poses[i - 1], poses[i]));
  const wrap = step(poses[poses.length - 1], poses[0]);
  const sorted = steps.slice().sort((a, b) => a - b); const typical = sorted.length ? sorted[Math.floor(sorted.length / 2)] : wrap; const worst = sorted.length ? sorted[sorted.length - 1] : wrap;
  return { wrap, typical, worst, ratio: wrap / Math.max(1e-9, worst), frames: frames.length };
}
