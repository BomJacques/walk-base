// Side-view 2D walk rig. Pure math, no DOM. Original figure: nothing here is traced from or copied out of any book.
//
// World units are leg lengths (leg = 1), x to the right (the figure faces +x), y UP, ground at y = 0.
// One cycle is two steps: the near (left) foot makes contact at u = 0, the far (right) foot at u = 0.5.
//
// The four named poses follow standard animation practice:
//   CONTACT  heel meets ground, leg nearly straight, body at mid height
//   DOWN     weight arrives, body at its lowest, support knee bends
//   PASSING  free leg passes the support leg, body rising
//   UP       push off, body at its highest, support heel lifts
// Feet are planted: during stance the ankle is fixed in the world, so there is no sliding in travel mode.

import { DOG_DEFAULTS } from './dogdefaults.js';

export const DEFAULTS = Object.freeze({
  rig: 'human',         // which figure: human | dog
  model: 'mannequin',   // how the human rig is dressed: mannequin | hose (the rubber hose figure shares the walk and the channels)
  ...DOG_DEFAULTS,
  // timing
  fps: 24,
  cycleFrames: 24,      // frames for a full cycle (two steps)
  exposure: 1,          // 1 = on ones, 2 = on twos, 3 = on threes
  // gait
  stepLength: 0.78,     // contact to contact, in leg lengths
  duty: 0.60,           // fraction of the cycle a foot is on the ground
  legExtend: 0.985,     // how straight the leg gets at contact
  bob: 0.075,           // vertical travel of the hips, peak to peak
  downPhase: 0.125,     // cycle phase of DOWN, after near-foot contact (a quarter of a step)
  footLift: 0.16,       // swing foot clearance
  heelStrike: 14,       // degrees, toe up at contact
  toeOff: 32,           // degrees, heel up at push off
  swingToe: 8,          // degrees, toe angle mid swing
  heelDown: 0.18,       // fraction of the stance the heel takes to come down after contact
  heelUp: 0.52,         // fraction of the stance at which the heel starts to lift
  liftPeak: 0.42,       // fraction of the swing at which the foot is highest
  swingReach: 0.85,     // how early the swinging foot is brought forward (0 even, 1 early)
  // the far (left) foot against the near one: an uneven walk, a limp
  asymTiming: 0,        // cycle fraction the far foot lands late
  asymDuty: 0,          // far foot time on the ground, added to duty
  asymLift: 0,          // far foot lift, as a fraction more or less
  asymArm: 0,           // far arm swing, as a fraction more or less
  // upper body
  lean: 4,              // degrees forward
  torsoSway: 1.6,       // degrees of torso rock per step
  headBob: 0.35,        // 0 = head rides the hips, 1 = head stays level
  headNod: 2.5,         // degrees
  armSwing: 26,         // degrees each way
  armLag: 0.07,         // cycle fraction the arms trail the legs
  elbowBase: 14,        // degrees
  elbowSwing: 26,       // extra degrees when the arm is forward
  // hips, shoulders and head (3D)
  pelvisYaw: 6,
  pelvisRoll: 3,
  pelvisPitch: 1.5,
  sway: 0.03,
  shoulderCounter: 9,
  headKeep: 0.8,
  armOut: 4,
  shrug: 0,
  kneeOut: 3,
  stepWidth: 0.075,
  toeOut: 8,
  // travel
  travel: 'follow',     // 'follow' keeps the figure still and scrolls the ground, 'across' lets it cross the frame
});

/** Body proportions in leg lengths. Used by both the rig and the renderer. */
export const BODY = Object.freeze({
  thigh: 0.52, shin: 0.48, foot: 0.30, ankleH: 0.075, heel: 0.07, ball: 0.20,
  torso: 0.66, neck: 0.10, head: 0.30, shoulderDrop: 0.06,
  upperArm: 0.37, foreArm: 0.34, hand: 0.11, hipWidth: 0.09, shoulderWidth: 0.2,
});

const rad = (d) => (d * Math.PI) / 180;
const TAU = Math.PI * 2;
const wrap = (u) => u - Math.floor(u);
const smooth = (t) => t * t * (3 - 2 * t);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** Ankle displacement from the flat-footed position when the foot pivots about its heel (theta > 0) or ball (theta < 0). */
export function pivotShift(theta) {
  const px = theta > 0 ? -BODY.heel : BODY.ball;
  const py = -BODY.ankleH;
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return { dx: px - (px * c - py * s), dy: py - (px * s + py * c) };
}

/**
 * One foot, relative to the pelvis, at foot phase w in [0,1) where 0 is its contact.
 * Returns the ankle position and foot angle (radians, positive = toe up).
 */
export function foot(w, p, d) {
  const s = p.duty;
  const hs = rad(p.heelStrike);
  const to = rad(p.toeOff);
  if (w < s) {
    const k = w / s;
    // Planted: the ankle holds one world position, so relative to a pelvis moving at constant speed it slides back linearly.
    let theta = 0;
    const hd = clamp(p.heelDown ?? 0.18, 0.02, 0.5); const hu = clamp(p.heelUp ?? 0.52, hd + 0.05, 0.95);
    if (k < hd) theta = hs * (1 - smooth(k / hd));
    else if (k > hu) theta = -to * smooth((k - hu) / (1 - hu));
    const sh = pivotShift(theta);
    return { x: d - 2 * d * k + sh.dx, y: BODY.ankleH + sh.dy, theta };
  }
  // Swing: from the toe-off pose to the next contact pose, lifting through the middle.
  const k = (w - s) / (1 - s);
  const a = pivotShift(-to);
  const b = pivotShift(hs);
  const x0 = -d + a.dx;
  const x1 = d + b.dx;
  const ease = smooth(k);
  // The swing foot is brought forward early so it passes the support ankle about 40% through the swing.
  const reach = clamp(p.swingReach ?? 0.85, 0, 1);
  const prog = reach * (1 - Math.pow(1 - k, 1.8)) + (1 - reach) * ease;
  const x = x0 + (x1 - x0) * prog;
  const base = (BODY.ankleH + a.dy) * (1 - ease) + (BODY.ankleH + b.dy) * ease;
  const peak = clamp(p.liftPeak ?? 0.42, 0.15, 0.8); // the exponent that puts the highest point there
  const lift = p.footLift * Math.pow(Math.sin(Math.PI * Math.pow(clamp(k, 0, 1), Math.log(0.5) / Math.log(peak))), 1.3);
  const theta = k < 0.5 ? -to + (rad(p.swingToe) + to) * smooth(k / 0.5) : rad(p.swingToe) + (hs - rad(p.swingToe)) * smooth((k - 0.5) / 0.5);
  return { x, y: base + lift, theta };
}

/**
 * What one foot does in the cycle. The near foot (R) is the reference; the far foot (L) lands half a cycle later,
 * shifted by asymTiming, and can stay down for a different time and lift differently. Returns the gait the foot follows,
 * its phase offset and the stride half-length d (so a planted foot still holds one place on the ground).
 */
export function sideGait(params, side) {
  const p = params;
  if (side === 'R' || side === 'right' ) return { p, off: 0, d: p.stepLength * p.duty };
  const duty = clamp(p.duty + (p.asymDuty || 0), 0.52, 0.88);
  const q = { ...p, duty, footLift: p.footLift * Math.max(0, 1 + (p.asymLift || 0)) };
  return { p: q, off: 0.5 + (p.asymTiming || 0), d: p.stepLength * duty };
}

/** Feet on the ground over the cycle, from { start, duty } rows: the average number down, the share of time with none down, with all down. */
export function supportStats(rows, n = 400) {
  let sum = 0; let none = 0; let all = 0;
  for (let i = 0; i < n; i++) {
    const u = i / n; let down = 0;
    for (const r of rows) if (wrap(u - r.start) < r.duty) down++;
    sum += down; if (down === 0) none++; if (down === rows.length) all++;
  }
  return { mean: sum / n, flight: none / n, all: all / n };
}

/** A walk in numbers: stance bars, double support, cadence, speed and stride. */
export function gaitSummary(params) {
  const p = { ...DEFAULTS, ...params };
  const near = sideGait(p, 'R'); const far = sideGait(p, 'L');
  const rows = [{ name: 'Near foot', start: 0, duty: near.p.duty }, { name: 'Far foot', start: wrap(far.off), duty: far.p.duty }];
  const st = supportStats(rows);
  const perSec = p.fps / Math.max(1, p.cycleFrames);
  return { rows, doubleSupport: Math.max(0, st.mean - 1 + st.flight), flight: st.flight, stepsPerMin: 120 * perSec, speed: 2 * p.stepLength * perSec, stride: 2 * p.stepLength, stepRatio: wrap(far.off) / Math.max(1e-6, 1 - wrap(far.off)) };
}

/** Planar forward-kinematics helper: point at distance len in direction angle (from straight down, forward positive). */
const fromDown = (o, len, ang) => ({ x: o.x + len * Math.sin(ang), y: o.y - len * Math.cos(ang) });

/** Pelvis height curve over the cycle, referenced so the near foot's contact sits at the extension limit. */
function pelvisHeight(u, p, hContact) {
  const A = p.bob / 2;
  const phi = p.downPhase + 0.25;       // lowest point at downPhase, highest a quarter step later
  const ref = Math.cos(TAU * 2 * (0 - phi));
  return hContact + A * (Math.cos(TAU * 2 * (u - phi)) - ref);
}

/**
 * Full pose at cycle phase u (any real number; it wraps). Always returns a fresh object.
 * Joint names follow the figure's left (near) and right (far) sides.
 */
export function pose(params, u) {
  const p = { ...DEFAULTS, ...params };
  const uw = wrap(u);
  const L = BODY.thigh + BODY.shin;
  const d = p.stepLength * p.duty;
  // Height at near-foot contact so the planted leg is almost straight but never hyperextended.
  const f0 = foot(0, p, d);
  const hContact = f0.y + Math.sqrt(Math.max(0.01, (p.legExtend * L) ** 2 - f0.x ** 2));
  const hipY = pelvisHeight(uw, p, hContact);
  const pelvisX = (u * 2 * p.stepLength);       // forward travel over the cycle, unwrapped so travel is continuous
  const hip = { x: 0, y: hipY };

  const legs = {};
  for (const side of ['left', 'right']) {
    const sg = sideGait(p, side === 'left' ? 'R' : 'L');
    const w = wrap(uw - sg.off);
    const f = foot(w, sg.p, sg.d);
    const ankle = { x: f.x, y: f.y };
    const r = ikLeg(hip, ankle);
    legs[side] = { w, hip: { ...hip }, knee: r.knee, ankle: r.ankle, theta: f.theta, reached: r.reached, stance: w < sg.p.duty };
  }

  // Upper body.
  const lean = rad(p.lean) + rad(p.torsoSway) * Math.cos(TAU * 2 * (uw - (p.downPhase + 0.25)));
  const shoulder = {
    x: hip.x + Math.sin(lean) * BODY.torso,
    y: hip.y + Math.cos(lean) * BODY.torso,
  };
  const nod = rad(p.headNod) * Math.cos(TAU * 2 * (uw - (p.downPhase + 0.45)));
  const headAng = lean * 0.35 + nod;
  // headBob 0 lets the head ride the hips, 1 holds it level against the hip bob.
  const meanH = hContact - (p.bob / 2) * Math.cos(TAU * 2 * (0 - (p.downPhase + 0.25)));
  const stabilise = -(hipY - meanH) * clamp(p.headBob, 0, 1);
  const neckBase = { x: shoulder.x, y: shoulder.y };
  const neckTop = { x: neckBase.x + Math.sin(lean * 0.6) * BODY.neck, y: neckBase.y + Math.cos(lean * 0.6) * BODY.neck + stabilise };
  const headC = { x: neckTop.x + Math.sin(headAng) * BODY.head * 0.5, y: neckTop.y + Math.cos(headAng) * BODY.head * 0.5 };

  const arms = {};
  for (const side of ['left', 'right']) {
    // The near arm swings opposite the near leg. Positive angle = forward.
    const phase = uw - (side === 'left' ? 0 : 0.5) - p.armLag;
    const swing = -rad(p.armSwing) * Math.cos(TAU * phase);
    const shoulderPt = { x: shoulder.x, y: shoulder.y - BODY.shoulderDrop };
    const fwd = clamp(swing / Math.max(1e-6, rad(p.armSwing)), -1, 1);
    const elbowFlex = rad(p.elbowBase) + rad(p.elbowSwing) * (0.5 + 0.5 * fwd);
    const elbow = fromDown(shoulderPt, BODY.upperArm, swing);
    const wrist = fromDown(elbow, BODY.foreArm, swing + elbowFlex);
    const hand = fromDown(wrist, BODY.hand, swing + elbowFlex * 1.1);
    arms[side] = { shoulder: shoulderPt, elbow, wrist, hand, swing, elbowFlex };
  }

  return {
    u: uw, pelvisX, hip, legs, arms, lean, shoulder, neckBase, neckTop, head: { c: headC, ang: headAng },
    params: p,
  };
}

/** Leg IK with the knee forward. */
function ikLeg(hip, ankle) {
  const l1 = BODY.thigh;
  const l2 = BODY.shin;
  let dx = ankle.x - hip.x;
  let dy = ankle.y - hip.y;
  let dist = Math.hypot(dx, dy);
  let reached = true;
  const reach = l1 + l2 - 1e-6;
  if (dist > reach) { dx *= reach / dist; dy *= reach / dist; dist = reach; reached = false; }
  const baseAng = Math.atan2(dy, dx);
  const cosA = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1);
  const a = Math.acos(cosA);
  // The ankle is below the hip, so the direction points roughly down. Rotating it toward +x puts the knee forward.
  const kneeAng = baseAng + a;
  const knee = { x: hip.x + l1 * Math.cos(kneeAng), y: hip.y + l1 * Math.sin(kneeAng) };
  return { knee, ankle: { x: hip.x + dx, y: hip.y + dy }, reached };
}

export const LEG_LENGTH = BODY.thigh + BODY.shin;

/** Total ground travel over one cycle, in leg lengths. */
export const cycleTravel = (params) => (params.rig === 'dog' ? params.dogStride : 2 * params.stepLength);

/**
 * Phases of the four named poses for the near foot; the far foot's come 0.5 later.
 * DOWN and UP are where the hips are lowest and highest. PASSING is where the swinging ankle crosses the support ankle.
 */
export function keyPhases(params) {
  if (params?.rig === 'dog') return []; // the four named poses are a human walk's
  const p = { ...DEFAULTS, ...params };
  let best = p.downPhase + 0.125;
  let bestGap = Infinity;
  for (let i = 0; i <= 400; i++) {
    const u = (i / 400) * 0.5;
    const pz = pose(p, u);
    const gap = Math.abs(pz.legs.right.ankle.x - pz.legs.left.ankle.x);
    // Only count the crossing where the far foot is swinging and the near foot is in stance.
    if (pz.legs.left.stance && !pz.legs.right.stance && gap < bestGap) { bestGap = gap; best = u; }
  }
  return [
    { name: 'CONTACT', u: 0 },
    { name: 'DOWN', u: wrap(p.downPhase) },
    { name: 'PASSING', u: wrap(best) },
    { name: 'UP', u: wrap(p.downPhase + 0.25) },
  ];
}

/** Sample the whole cycle as drawing numbers: frame i of N, with the exposure that holds each drawing. */
export function cycleFrames(params) {
  if (params?.perf) {
    // A performance: one entry per frame of a timeline longer than a cycle, drawings held for the exposure.
    const T = params.perf.T; const ex = Math.max(1, params.exposure ?? 1);
    const out = [];
    for (let k = 0; k < T; k++) out.push({ frame: k, drawing: Math.floor(k / ex) + 1, u: params.perf.u[Math.floor(k / ex) * ex] });
    return { frames: out, drawings: Math.ceil(T / ex) };
  }
  if (params?.sampled?.active) {
    // Sampled drawings: one entry per frame, each slice held for its own number of frames.
    const slices = params.sampled.slices;
    const out = [];
    slices.forEach((s, i) => { for (let k = 0; k < Math.max(1, s.exposure); k++) out.push({ frame: out.length, drawing: i + 1, u: i / slices.length }); });
    return { frames: out, drawings: slices.length };
  }
  const p = { ...DEFAULTS, ...params };
  const n = Math.max(2, Math.round(p.cycleFrames));
  const drawings = Math.max(2, Math.round(n / p.exposure));
  const out = [];
  for (let k = 0; k < n; k++) {
    const dIdx = Math.min(drawings - 1, Math.floor(k / p.exposure));
    out.push({ frame: k, drawing: dIdx + 1, u: dIdx / drawings });
  }
  return { frames: out, drawings };
}
