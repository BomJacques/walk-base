// Between the body simulation (body.js) and the rig: the bone lengths of a figure, the body a pose gives, and the channel values that put the figure in the simulated body's pose.
// The simulation does not pose anything itself. Each frame its joint angles are written as the rig's own channels (hip tilt, neck tilt, arm swing, elbow bend, foot reach and lift),
// switched on by setting each channel's amount to 0 so the walk's built-in motion stands aside. Pure logic, no DOM.
import { DEFAULTS, BODY } from './rig.js';
import { pose3, TORSO } from './rig3.js';
import { PT, ELBOW, HAND, KNEE, ANKLE, createBody, anglesOf, anglesNow, bodyFromAngles } from './body.js';

const len2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const len3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const SIDES = ['R', 'L'];

/** The parameters of a figure standing still: no steps, no bob, no swing. */
export const standingParams = (params) => ({ ...DEFAULTS, ...params, stepLength: 0, bob: 0, armSwing: 0, elbowSwing: 0, sway: 0, pelvisYaw: 0, pelvisRoll: 0, pelvisPitch: 0, shoulderCounter: 0, torsoSway: 0, footLift: 0, headNod: 0, headKeep: 0, headBob: 0, lean: 0, hoseFollow: 0 });

/** Every channel the simulation writes, with the number that switches the walk's own motion off. */
export const PHYS_CHANNELS = ['pelvis.x', 'pelvis.y', 'pelvis.z', 'pelvis.yaw', 'pelvis.roll', 'pelvis.pitch',
  'spine1.pitch', 'spine1.roll', 'spine1.yaw', 'spine2.pitch', 'spine2.roll', 'spine2.yaw', 'spine3.pitch', 'spine3.roll', 'spine3.yaw',
  'neck.pitch', 'neck.yaw', 'neck.roll', 'head.pitch', 'head.yaw', 'head.roll',
  ...SIDES.flatMap((s) => [`arm.pitch.${s}`, `arm.roll.${s}`, `elbow.flex.${s}`, `wrist.flex.${s}`, `girdle.x.${s}`, `girdle.y.${s}`, `foot.x.${s}`, `foot.y.${s}`, `foot.pitch.${s}`])];

/** Bone lengths in leg lengths, taken from the rig itself so a longer leg or a bigger head is the same here. */
export function bodyDims(params, motion = {}) {
  const p = { ...standingParams(params), proportions: params.proportions || {} };
  const sc = (k) => (p.proportions || {})[k] ?? 1; const tl = sc('torso');
  const z = pose3(p, motion, 0); const R = z.sides.R;
  const total = 0.1 + TORSO.lower * tl * sc('waist') + TORSO.mid * tl + TORSO.upper * tl * sc('chest');
  return {
    Lt: total - BODY.shoulderDrop, drop: BODY.shoulderDrop, Lh: len3(z.neckTop, z.neckBase) + z.headR,
    ua: len3(R.elbow, R.shoulder), fa: len3(R.wrist, R.elbow) + len3(R.hand, R.wrist), l1: len3(R.knee, R.hip), l2: len3(R.ankle, R.knee),
  };
}

/** The body's joint angles in a pose (side view). */
export function anglesFromPose(z, dims) {
  const pts = [];
  pts[PT.P] = [z.pelvis[0], z.pelvis[1]];
  const sh = [(z.sides.R.shoulder[0] + z.sides.L.shoulder[0]) / 2, (z.sides.R.shoulder[1] + z.sides.L.shoulder[1]) / 2];
  pts[PT.S] = sh; pts[PT.H] = [z.headC[0], z.headC[1]];
  for (const s of SIDES) { const sd = z.sides[s]; pts[ELBOW[s]] = [sd.elbow[0], sd.elbow[1]]; pts[HAND[s]] = [sd.hand[0], sd.hand[1]]; pts[KNEE[s]] = [sd.knee[0], sd.knee[1]]; pts[ANKLE[s]] = [sd.ankle[0], sd.ankle[1]]; }
  return anglesOf(dims, pts);
}

/** The hip and knee angles that put an ankle at a point, the knee in front (two-bone IK in the side view). With the torso upright, the hip angle is the thigh's swing. */
export function legAngles(d, P, A) {
  const dx = A[0] - P[0]; const dy = P[1] - A[1]; const dist = Math.min(d.l1 + d.l2 - 1e-6, Math.max(1e-3, Math.hypot(dx, dy)));
  const base = Math.atan2(dx, dy); // from straight down
  const k = Math.acos(Math.max(-1, Math.min(1, (d.l1 * d.l1 + dist * dist - d.l2 * d.l2) / (2 * d.l1 * dist))));
  const tt = base + k; // the thigh swings forward of the line to the ankle
  const knee = [P[0] + d.l1 * Math.sin(tt), P[1] - d.l1 * Math.cos(tt)];
  const ts = Math.atan2(A[0] - knee[0], knee[1] - A[1]);
  return [tt, tt - ts]; // with the torso upright: hip = thigh angle, bend = thigh angle minus shin angle
}

/** A body in the pose the figure has now (the pose at `u`), standing on the ground. `stand` makes it a plain standing pose instead. */
export function bodyFromRig(params, motion, u, { stand = false, x = 0 } = {}) {
  const dims = bodyDims(params, {});
  const p = stand ? standingParams(params) : { ...DEFAULTS, ...params };
  const z = pose3({ ...p, proportions: params.proportions || {} }, motion || {}, u);
  const a = anglesFromPose(z, dims);
  if (stand) { // both feet flat on the ground, side by side
    for (const s of SIDES) { a.leg[s] = legAngles(dims, a.P, [s === 'R' ? 0.03 : -0.03, BODY.ankleH]); }
  }
  // set the lowest ankle on the ground
  const pts = bodyFromAngles(dims, a); const low = Math.min(pts[PT.AR][1], pts[PT.AL][1]);
  a.P[1] += BODY.ankleH - low; a.P[0] = (stand ? 0 : a.P[0]) + x;
  const b = createBody(dims, a); b.footTheta = { R: 0, L: 0 };
  return b;
}

/** The pose with every simulated channel at zero: where the feet would be, the hip height the figure stands at. */
export function neutralPose(params, motion, u) {
  const m = { ...(motion || {}) };
  for (const id of PHYS_CHANNELS) m[id] = { ...(m[id] || {}), amount: 0, offset: 0 };
  return pose3({ ...DEFAULTS, ...params, headBob: 0 }, m, u);
}

/**
 * The channel values that put the figure where the body is. nz is neutralPose(...) for the same frame. Returns { channel: value }, with every channel in PHYS_CHANNELS.
 * Call once a frame: the feet's tilt eases (b.footTheta) from flat on the ground to relaxed in the air.
 */
export function bodyChannels(b, nz) {
  const a = anglesNow(b); const out = {};
  for (const id of PHYS_CHANNELS) out[id] = 0;
  out['pelvis.x'] = a.P[0] - nz.pelvis[0]; out['pelvis.y'] = a.P[1] - nz.pelvis[1];
  out['pelvis.pitch'] = a.phi; out['neck.pitch'] = a.psi - a.phi;
  for (const s of SIDES) {
    out[`arm.pitch.${s}`] = a.arm[s][0]; out[`elbow.flex.${s}`] = a.arm[s][1];
    const A = [b.x[ANKLE[s]], b.y[ANKLE[s]]]; const base = nz.sides[s].ankle;
    out[`foot.x.${s}`] = A[0] - base[0]; out[`foot.y.${s}`] = A[1] - base[1];
    const flat = b.contact[ANKLE[s]] === 1; b.footTheta = b.footTheta || { R: 0, L: 0 };
    const want = flat ? 0 : -0.45; b.footTheta[s] += (want - b.footTheta[s]) * 0.3;
    out[`foot.pitch.${s}`] = b.footTheta[s] - nz.sides[s].foot.theta;
  }
  return out;
}

/** The channel values as live automation targets: each channel's amount at 0 and its offset at the value, and the head steadiness off. */
export function liveOf(values) {
  const live = { 'p:headBob': 0 };
  for (const [id, v] of Object.entries(values)) { live[`c:${id}:amount`] = 0; live[`c:${id}:offset`] = v; }
  return live;
}
