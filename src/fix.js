// Corrections: move a part back into line at one frame without touching the animation underneath.
// A correction is a lane of its own ('c:<channel>:fix') that is added to the channel's value. Dragging the end of a part at a frame solves for the small
// change in that part's channels that puts the end where you drop it, and writes a smooth bump into the correction lanes round that frame.
// Take the lane away and the animation is exactly as it was. Pure logic, no DOM.
import { cycleFrames } from './rig.js';
import { poseFor } from './keyposes.js';
import { partBone } from './attach.js';
import { partChannels, CHANNEL_BY_ID, PARTS } from './motion.js';
import { laneValue, addPoint, targetOfChannel } from './automation.js';
import { solveMove } from './arcs.js';

export const fixTarget = (id) => targetOfChannel(id, 'fix');

/** The channels that move the end of a part. Roll is left out unless it is all the part has, so a drag does not twist the part sideways. */
export function fixChain(part, side) {
  const all = partChannels(part, side).filter((c) => CHANNEL_BY_ID[c.id]);
  const noRoll = all.filter((c) => !/\.roll(\.|$)/.test(c.id));
  return (noRoll.length ? noRoll : all).map((c) => c.id);
}

/** The end (or the start) of a part's bone in the world (with the walk's travel), for the handle. */
export function fixEnd(pz, part, seg, side, which = 'end') {
  const bone = partBone(pz, part, seg ?? null, side ?? null);
  const pt = bone ? bone[which === 'start' ? 0 : 1] : null;
  return pt ? [pt[0] + pz.pelvisX, pt[1], pt[2]] : null;
}

/**
 * The start of a part is where the part before it ends, so moving it means moving that part's end: the base of the neck is the end of the upper spine.
 * A part that starts the chain (the hips) or is placed by its own channels (a foot) moves its own start.
 */
export const FIX_PARENT = {
  neck: 'spine.upper', head: 'neck', 'spine.upper': 'spine.mid', 'spine.mid': 'spine.lower', 'spine.lower': 'pelvis', arm: 'girdle', forearm: 'arm', hand: 'forearm', leg: 'pelvis',
  'dog.neck': 'dog.spine3', 'dog.head': 'dog.neck', 'dog.jaw': 'dog.head', 'dog.ear': 'dog.head', 'dog.spine3': 'dog.spine2', 'dog.spine2': 'dog.spine1', 'dog.spine1': 'dog.pelvis',
  'dog.tail1': 'dog.pelvis', 'dog.tail2': 'dog.tail1', 'dog.tail3': 'dog.tail2', 'dog.fshoulder': 'dog.spine3', 'dog.fleg': 'dog.fshoulder', 'dog.hleg': 'dog.pelvis',
};
/** Which part's channels move the point you drag, and which point of that part it is. which: 'end' (the tip) or 'start' (the base). */
export function fixPlan(part, side, which = 'end') {
  if (which === 'start' && FIX_PARENT[part]) { const p = FIX_PARENT[part]; return { part: p, side: PARTS.find((q) => q.id === p)?.sided ? side : null, point: 'end' }; }
  return { part, side, point: which === 'start' ? 'start' : 'end' };
}

/**
 * Finds the change in the part's channels (added to whatever the animation gives at `frame`) that puts the end of the part on `target`.
 * `project` turns a world point into the screen point the handle is drawn at. Returns { delta: {channel: change}, err } or null.
 */
export function solveFix({ params, frame, part, seg = null, side = null, target, project, which = 'end' }) {
  const plan = fixPlan(part, side, which);
  const ids = fixChain(plan.part, plan.side);
  if (!ids.length || params.sampled) return null;
  const at = (vals) => {
    const delta = {}; ids.forEach((id, i) => { delta[id] = vals[i]; });
    const pz = poseFor(params, frame, delta); const w = fixEnd(pz, plan.part, plan.part === part ? seg : null, plan.side, plan.point);
    if (!w) return [0, 0];
    const s = project(w); return [s.x, s.y];
  };
  const scales = ids.map((id) => { const c = CHANNEL_BY_ID[id]; return Math.max(1e-3, Math.abs(c.from(c.max) - c.from(c.min)) / 2); });
  const r = solveMove(at, ids.map(() => 0), target, scales, { iters: 12, damp: 0.06 });
  const delta = {}; ids.forEach((id, i) => { delta[id] = r.v[i]; });
  return { delta, err: r.err };
}

/**
 * Writes the corrections into the lanes: at `t` each channel's correction becomes its value there plus `delta`, and the correction eases back to what it was
 * `spread` frames either side. The lanes it starts from are not changed, so calling this again from the same lanes with a new delta replaces the last try.
 */
export function writeFix(lanes, delta, t, spread, T) {
  const out = { ...lanes };
  for (const [id, dv] of Object.entries(delta)) {
    const target = fixTarget(id); const lane0 = lanes[target];
    let lane = addPoint(lane0, t, laneValue(lane0, t, 0) + dv);
    if (spread > 0) for (const a of [Math.max(0, t - spread), Math.min(T - 1, t + spread)]) if (a !== t && !lane.pts.some((q) => q.t === a)) lane = addPoint(lane, a, laneValue(lane0, a, 0));
    out[target] = lane;
  }
  return out;
}

/** Corrections on a part: how many points, and removing them. */
export const fixPoints = (lanes, part, side) => fixChain(part, side).reduce((n, id) => n + (lanes[fixTarget(id)]?.pts?.length || 0), 0);
export function clearFix(lanes, part, side) {
  const out = { ...lanes };
  for (const id of fixChain(part, side)) delete out[fixTarget(id)];
  return out;
}
/** Every correction lane, for a figure. */
export const hasFix = (lanes) => Object.keys(lanes || {}).some((t) => t.endsWith(':fix'));
