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
  model: 'mannequin',   // how the human rig is dressed: mannequin | hose | robot | alien (the rubber hose figure shares the walk and the channels)
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
  hoseFollow: 0.6,      // rubber hose figure: how far the hands and feet trail behind the limb they are on (follow-through)
  hoseWobble: 0,        // rubber hose figures: how far a wave running along each limb bends it, like jelly
  hoseWobbleRate: 2,    // rubber hose figures: wobbles in each cycle (a whole number, so a cycle still loops)
  hoseStretch: 0.5,     // rubber hose figure: how far an arm or a swinging leg stretches when it reaches
  weight: 0,            // how heavy the figure feels: positive is heavy (slower, flatter feet, a deeper drop), negative is light (springy, higher feet)
  noiseAmount: 0,       // variety: how much small random wobble is added to the walk (0 is none)
  noiseSpeed: 2,        // how quickly the wobble changes (1 slow to 4 quick)
  noiseSeed: 7,         // which wobble: the same seed always gives the same take
  noiseLoop: true,      // keep the wobble repeating every cycle, so the loop stays seamless
  heading: 0,           // degrees the figure faces and walks away from straight along the stage (automate it to walk a curve or turn a corner)
  terrain: 'flat',      // the ground under the walk: flat | slope | steps
  terrainGrade: 8,      // degrees the ground rises (negative falls) along a slope
  terrainRise: 0.14,    // height of each step, in leg lengths (negative goes down)
  terrainRun: 1,        // length of each step's flat top
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
  // posture: held all the time, on top of the walk
  sideLean: 0,          // degrees the body leans to one side (positive toward the near side)
  chestOut: 0,          // degrees the back arches and the chest comes out (negative slouches, the back rounding forward)
  headTilt: 0,          // degrees the head looks down (negative looks up)
  headTurn: 0,          // degrees the head is turned to one side (positive toward the near side)
  armCarry: 0,          // degrees both arms are carried forward of where they hang (negative behind)
  carry: 0,             // a heavy load in one hand: positive the near hand, negative the far hand. That arm hangs still, the body leans away, the other arm comes out
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

/** The height of the ground at a world x. A slope rises evenly; steps are flat treads joined by short smooth risers, the first riser comes a tread after x = 0.6. */
export function groundAt(p, x) {
  const t = p.terrain;
  if (t === 'slope') return Math.tan(rad(clamp(p.terrainGrade ?? 0, -30, 30))) * x;
  if (t === 'steps') {
    const run = Math.max(0.2, p.terrainRun ?? 1); const q = (x - 0.6) / run;
    if (q < 0) return 0;
    const n = Math.floor(q); const f = q - n; const ew = Math.min(0.3, 0.45 / run);
    const r = clamp((f - (1 - ew)) / ew, 0, 1);
    return (p.terrainRise ?? 0) * (n + r * r * (3 - 2 * r));
  }
  return 0;
}

/**
 * What one foot does in the cycle. The near foot (R) is the reference; the far foot (L) lands half a cycle later,
 * shifted by asymTiming, and can stay down for a different time and lift differently. Returns the gait the foot follows,
 * its phase offset and the stride half-length d (so a planted foot still holds one place on the ground).
 */
/**
 * The walk's settings with the weight applied: a heavy figure stays on the ground longer, lifts its feet less and flatter, drops deeper into each step, swings its arms less,
 * takes shorter steps and leans in; a light one is the other way round. Done once (the result is marked), so every part of the program sees the same numbers.
 */
export function withWeight(p) {
  const w = clamp(p.weight || 0, -1, 1);
  if (!w || p._weighted) return p;
  const q = { ...p, _weighted: true };
  const f = (k) => 1 + k * w;
  if (p.rig === 'dog') {
    q.dogLift = p.dogLift * clamp(f(-0.35), 0.4, 1.6); q.dogDuty = clamp(p.dogDuty + 0.06 * w, 0.15, 0.85); q.dogBob = p.dogBob * clamp(f(0.4), 0.4, 1.8);
    q.dogStride = p.dogStride * clamp(f(-0.12), 0.7, 1.2); q.dogFlex = p.dogFlex * clamp(f(0.2), 0.6, 1.4);
    return q;
  }
  q.duty = clamp(p.duty + 0.06 * w, 0.25, 0.85); q.footLift = p.footLift * clamp(f(-0.35), 0.4, 1.6); q.bob = Math.min(p.bob * clamp(f(0.25), 0.5, 1.5), Math.max(p.bob, 0.1)); // a deeper drop, but never past what the legs can reach
  q.downPhase = clamp(p.downPhase + 0.02 * w, 0.03, 0.22); q.armSwing = p.armSwing * clamp(f(-0.35), 0.4, 1.6); q.stepLength = p.stepLength * clamp(f(-0.08), 0.8, 1.15);
  q.heelStrike = p.heelStrike * clamp(f(0.3), 0.5, 1.5); q.lean = p.lean + 3 * w; q.pelvisRoll = Math.min(p.pelvisRoll * clamp(f(0.4), 0.5, 1.6), Math.max(p.pelvisRoll, 7)); q.headNod = p.headNod * clamp(f(0.4), 0.5, 1.6);
  return q;
}

/** Smooth variety, the same for the same seed. t is where we are in the walk (cycles); id names what is being wobbled. Periodic in the cycle when loop is on. */
const hash = (n) => { let x = Math.sin(n * 12.9898) * 43758.5453; x -= Math.floor(x); return x; };
const strHash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
export function noiseSignal(seed, id, t, speed = 2, loop = true) {
  const base = strHash(id) * 0.001 + seed * 7.31; const sp = clamp(Math.round(speed), 1, 4);
  const freqs = loop ? [sp, sp + 1, sp + 3] : [0.37 * sp, 0.61 * sp, 0.89 * sp]; // whole numbers of waves per cycle repeat exactly; the others drift from cycle to cycle
  let v = 0;
  freqs.forEach((f, k) => { const a = 0.45 + 0.55 * hash(base + k * 3.7); const ph = hash(base + k * 11.3) * 2 * Math.PI; v += a * Math.sin(2 * Math.PI * f * t + ph); });
  return v / 1.5;
}
/** How much each channel wobbles at full noise: lengths in leg lengths, angles in radians. */
const NOISE_AMP = {
  'pelvis.y': 0.012, 'pelvis.z': 0.01, 'pelvis.yaw': 0.05, 'pelvis.roll': 0.04, 'spine1.pitch': 0.03, 'spine2.pitch': 0.03, 'spine3.pitch': 0.03, 'spine2.roll': 0.03, 'spine3.roll': 0.03,
  'neck.pitch': 0.05, 'head.yaw': 0.08, 'head.pitch': 0.05, 'arm.pitch.R': 0.14, 'arm.pitch.L': 0.14, 'elbow.flex.R': 0.1, 'elbow.flex.L': 0.1,
  'dog.pelvis.y': 0.01, 'dog.spine1.pitch': 0.03, 'dog.spine2.pitch': 0.03, 'dog.neck.pitch': 0.06, 'dog.head.yaw': 0.1, 'dog.head.pitch': 0.05, 'dog.tail1.yaw': 0.15, 'dog.tail1.pitch': 0.08, 'dog.tail2.yaw': 0.12,
};
/** The wobble to add to a channel now (0 when noise is off or the channel does not wobble). t is the walk's phase in cycles, running on over a performance. */
export function noiseOf(p, id, t) {
  const a = NOISE_AMP[id]; if (!a || !(p.noiseAmount > 0)) return 0;
  return a * clamp(p.noiseAmount, 0, 1) * noiseSignal(p.noiseSeed ?? 7, id, t, p.noiseSpeed ?? 2, p.noiseLoop !== false);
}

export function sideGait(params, side) {
  const p = withWeight(params);
  if (side === 'R' || side === 'right' ) return { p, off: 0, d: p.stepLength * p.duty };
  const duty = clamp(p.duty + (p.asymDuty || 0), 0.25, 0.88);
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
  const p = withWeight({ ...DEFAULTS, ...params });
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
  const p = withWeight({ ...DEFAULTS, ...params });
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
