// 3D walk rig. Joints are in leg lengths: x forward, y up, z to the figure's right (toward the camera in the default side view).
// The built-in motion is the planar walk from rig.js plus the 3D parts a side view hides: hip twist, hip drop, shoulder counter-rotation,
// side sway and toe-out. Every moving part is a channel from motion.js, so any of it can be tuned or drawn by hand.
import { BODY, DEFAULTS, foot, sideGait, LEG_LENGTH, groundAt } from './rig.js';
import { makeEvaluator } from './motion.js';

const wrap = (u) => u - Math.floor(u);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// Tiny vector and matrix helpers: 3x3 row-major, column-vector convention.
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
export const apply = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
export const mm = (A, B) => {
  const R = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) R[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return R;
};
/** Lean the up axis toward +x (forward). */
export const Rpitch = (a) => [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1];
/** Tilt the up axis toward +z (the figure's right). */
export const Rroll = (a) => [1, 0, 0, 0, Math.cos(a), -Math.sin(a), 0, Math.sin(a), Math.cos(a)];
/** Turn about the vertical: positive brings the right side forward. */
export const Ryaw = (a) => [Math.cos(a), 0, Math.sin(a), 0, 1, 0, -Math.sin(a), 0, Math.cos(a)];
export const seg = (yaw, pitch, roll) => mm(Ryaw(yaw), mm(Rpitch(pitch), Rroll(roll)));

/** Spine segment lengths, in leg lengths. */
export const TORSO = Object.freeze({ lower: 0.2, mid: 0.22, upper: 0.24 });

/** Pelvis height at which the near leg is almost straight at contact. */
function contactHeight(p) {
  const d = p.stepLength * p.duty;
  const f0 = foot(0, p, d);
  return f0.y + Math.sqrt(Math.max(0.01, (p.legExtend * LEG_LENGTH) ** 2 - f0.x ** 2));
}

export function ik3(hip, ankle, l1, l2, pole) {
  let d = sub(ankle, hip);
  let dist = len(d);
  let reached = true;
  const reach = l1 + l2 - 1e-6;
  if (dist > reach) { d = mul(d, reach / dist); dist = reach; reached = false; }
  const b = norm(d);
  const a = Math.acos(clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1));
  let pp = sub(pole, mul(b, dot(pole, b)));
  if (len(pp) < 1e-6) pp = [1, 0, 0];
  pp = norm(pp);
  const knee = add(hip, add(mul(b, Math.cos(a) * l1), mul(pp, Math.sin(a) * l1)));
  return { knee, ankle: add(hip, d), reached };
}

/**
 * Full 3D pose at phase u. `motion` holds the channel edits.
 * Joints are relative to the figure's world position; add pelvisX for travel.
 */
export function pose3(params, motion, u, extra = null) {
  const p = { ...DEFAULTS, ...params };
  const ev = makeEvaluator(p, motion, extra?.freeU ?? null);
  const uw = wrap(u);
  const c = (id) => ev.value(id, uw);
  const sc = (k) => (p.proportions || {})[k] ?? 1;
  // Follow-through (rubber hose): the pose a little earlier in the cycle, so a hand or a swinging foot can trail behind the limb it is on.
  const fol = p.model === 'hose' && !extra?.noLag ? Math.max(0, p.hoseFollow || 0) : 0;
  const prev = fol > 0 ? pose3(params, motion, uw - 0.12, { ...(extra || {}), noLag: true, worldX: extra?.worldX != null ? extra.worldX - 0.12 * 2 * p.stepLength : undefined }) : null;
  const d = p.stepLength * p.duty;
  const hContact = contactHeight(p);
  const phi = p.downPhase + 0.25;
  const meanDev = -(p.bob / 2) * Math.cos(2 * Math.PI * 2 * (0 - phi));

  // Uneven ground: each foot stands on the ground at its own place, the swinging foot lifts to clear what is ahead, and the hips ride at the mean height of the two.
  const tf = {}; let gY = 0;
  if (p.terrain && p.terrain !== 'flat') {
    const wx = extra?.worldX ?? uw * 2 * p.stepLength;
    for (const sideT of ['R', 'L']) {
      const sgT = sideGait(p, sideT); const fT = foot(wrap(uw - sgT.off), sgT.p, sgT.d);
      const x = wx + fT.x; const g = groundAt(p, x); const ahead = groundAt(p, x + 0.3);
      const wT = wrap(uw - sgT.off); const swing = wT < sgT.p.duty ? 0 : clamp((fT.y - BODY.ankleH) / Math.max(0.01, sgT.p.footLift), 0, 1);
      tf[sideT] = { y: g + Math.max(0, ahead - g) * swing, g, slope: Math.atan2(groundAt(p, x + 0.08) - groundAt(p, x - 0.08), 0.16) * (1 - swing) };
    }
    const lo = Math.min(tf.R.g, tf.L.g); gY = lo + 0.12 * (Math.max(tf.R.g, tf.L.g) - lo); // the hips ride near the lower foot, so the higher leg bends and the lower one never overreaches
  }
  const P = [c('pelvis.x'), hContact + gY + c('pelvis.y'), c('pelvis.z')];
  const Rp = seg(c('pelvis.yaw'), c('pelvis.pitch'), c('pelvis.roll'));
  const hw = BODY.hipWidth * sc('hipWidth');

  const R1 = mm(Rp, seg(c('spine1.yaw'), c('spine1.pitch'), c('spine1.roll')));
  const R2 = mm(R1, seg(c('spine2.yaw'), c('spine2.pitch'), c('spine2.roll')));
  const R3 = mm(R2, seg(c('spine3.yaw'), c('spine3.pitch'), c('spine3.roll')));
  const tl = sc('torso');
  const base0 = add(P, apply(Rp, [0, 0.1, 0]));
  const j1 = add(base0, apply(R1, [0, TORSO.lower * tl * sc('waist'), 0]));
  const j2 = add(j1, apply(R2, [0, TORSO.mid * tl, 0]));
  const j3 = add(j2, apply(R3, [0, TORSO.upper * tl * sc('chest'), 0]));

  // The head's vertical wobble is steadied toward level by headBob.
  const steady = -(P[1] - hContact - gY - meanDev) * clamp(p.headBob, 0, 1);
  const neckBase = add(j3, [0, steady, 0]);
  const Rn = mm(R3, seg(c('neck.yaw'), c('neck.pitch'), c('neck.roll')));
  const neckTop = add(neckBase, apply(Rn, [0, BODY.neck * sc('neck'), 0]));
  const Rh = mm(Rn, seg(c('head.yaw'), c('head.pitch'), c('head.roll')));
  const headR = BODY.head * 0.5 * sc('head');
  const headC = add(neckTop, apply(Rh, [0, headR, 0]));

  const sides = {};
  for (const side of ['R', 'L']) {
    const s = side === 'R' ? 1 : -1;
    const k = (id) => c(`${id}.${side}`);
    const sw = BODY.shoulderWidth * sc('shoulderWidth');
    const shoulder = add(j3, add(apply(R3, [k('girdle.x'), -BODY.shoulderDrop, s * sw]), [0, k('girdle.y'), 0]));
    const armScale = side === 'L' ? Math.max(0, 1 + (p.asymArm || 0)) : 1; // the far arm can swing more or less
    const Ru = mm(R3, mm(Rpitch(-k('arm.pitch') * armScale), Rroll(-s * k('arm.roll'))));
    const aL = sc('arm');
    const elbow = add(shoulder, apply(Ru, [0, -BODY.upperArm * aL * sc('upperArm'), 0]));
    const Rf = mm(Ru, Rpitch(-k('elbow.flex')));
    const wrist = add(elbow, apply(Rf, [0, -BODY.foreArm * aL * sc('foreArm'), 0]));
    const Rw = mm(Rf, Rpitch(-k('wrist.flex')));
    const hand = add(wrist, apply(Rw, [0, -BODY.hand * aL * sc('handSize'), 0]));
    const wristF = prev ? add(wrist, mul(sub(prev.sides[side].wrist, wrist), 0.35 * fol)) : wrist; // the wrist and the hand drag behind the arm
    let handF = hand; // the hand keeps its length from the wrist and only its direction trails, so it stays on the end of the arm
    if (prev) { const lagged = add(hand, mul(sub(prev.sides[side].hand, hand), 0.6 * fol)); const dir = sub(lagged, wristF); const l = len(dir); handF = l > 1e-9 ? add(wristF, mul(dir, len(sub(hand, wrist)) / l)) : hand; }

    const sg = sideGait(p, side);
    const w = wrap(uw - sg.off);
    const f = foot(w, sg.p, sg.d);
    let ankle = [f.x + k('foot.x'), f.y + k('foot.y') + (tf[side]?.y ?? 0), s * k('foot.z')];
    // a swinging foot trails behind the leg, and eases back to nothing as it lands and as it leaves the ground
    const kSwing = w >= sg.p.duty ? Math.sin(Math.PI * ((w - sg.p.duty) / Math.max(1e-6, 1 - sg.p.duty))) : 0;
    if (prev && kSwing > 0) ankle = add(ankle, mul(sub(prev.sides[side].ankle, ankle), 0.3 * fol * kSwing));
    const hip = add(P, apply(Rp, [0, 0, s * hw]));
    const fwdDir = norm([Rp[0], 0, Rp[2]]);
    const out = k('knee.out');
    const pole = norm(add(mul(fwdDir, Math.cos(out)), [0, 0, s * Math.sin(out)]));
    // the thigh takes a bigger or smaller share of the same leg length, so the gait is untouched
    const l1 = clamp(BODY.thigh * sc('thighShare'), 0.35 * LEG_LENGTH, 0.65 * LEG_LENGTH);
    const leg = ik3(hip, ankle, l1, LEG_LENGTH - l1, pole);

    const psi = -s * k('foot.yaw');
    let theta = f.theta + k('foot.pitch') + (tf[side]?.slope ?? 0);
    if (prev && kSwing > 0) theta += (prev.sides[side].foot.theta - theta) * 0.6 * fol * kSwing;
    const fHead = [Math.cos(psi), 0, -Math.sin(psi)];
    const lat = [Math.sin(psi), 0, Math.cos(psi)];
    const fx = add(mul(fHead, Math.cos(theta)), [0, Math.sin(theta), 0]);
    const fy = add(mul(fHead, -Math.sin(theta)), [0, Math.cos(theta), 0]);
    sides[side] = { s, shoulder, elbow, wrist, hand, wristF, handF, hip, knee: leg.knee, ankle: leg.ankle, reached: leg.reached, stance: w < sg.p.duty, w, foot: { fx, fy, lat, theta }, frames: { Ru, Rf, Rw } };
  }
  return { u: uw, pelvisX: extra?.worldX ?? uw * 2 * p.stepLength, bobDev: P[1] - hContact - gY - meanDev, groundY: gY, params: p, hw, pelvis: P, Rp, R1, R2, R3, Rn, Rh, base0, j1, j2, j3, neckBase, neckTop, headC, headR, sides };
}

/** A foot's local frame to world: x forward along the sole, y up from the ankle, z across. */
const footPt = (sd, x, y, z) => add(sd.ankle, add(mul(sd.foot.fx, x), add(mul(sd.foot.fy, y), mul(sd.foot.lat, z))));
/** Outline of a shoe-shaped foot: a rounded heel, a collar at the ankle, a slope over the instep, a toe cap that tapers and a flat sole. Each profile point is [forward, up, half width]. */
const SHOE = [ // in order round the outline: a squared heel, a high collar at the ankle, a gentle slope over the instep, a blunt toe box, a flat sole with a lifted arch
  [-0.072, -0.075, 0.032], [-0.082, -0.03, 0.036], [-0.07, 0.025, 0.037], [-0.05, 0.056, 0.037],
  [0.0, 0.046, 0.04], [0.07, 0.022, 0.044], [0.14, 0.0, 0.048], [0.23, -0.012, 0.05], [0.285, -0.02, 0.048],
  [0.305, -0.04, 0.044], [0.305, -0.065, 0.044], [0.295, -0.075, 0.044], [0.2, -0.075, 0.05], [0.12, -0.067, 0.042], [0.0, -0.067, 0.034], [-0.02, -0.075, 0.032],
];
/** Both faces of the shoe as ordered outlines (the near side and the far side), world space. Seen from the side either one is the shoe; seen from above the two spread to its width. */
export function footShape(pz, side, k = 1) {
  const sd = pz.sides[side];
  // k scales the shoe about the ankle and the sole, so a bigger foot still stands on the ground
  const face = (sg) => SHOE.map(([x, y, hw]) => footPt(sd, x * k, -0.075 + (y + 0.075) * k, sg * hw * k));
  return { a: face(1), b: face(-1) };
}
/** Named places on the foot (world space), for labels. */
export function footMarks(pz, side) {
  const sd = pz.sides[side];
  return [['ankle', footPt(sd, 0, 0, 0)], ['heel', footPt(sd, -0.078, -0.06, 0)], ['ball', footPt(sd, 0.2, -0.075, 0)], ['toe', footPt(sd, 0.3, -0.07, 0)]].map(([name, p]) => ({ name, p }));
}

/** Corners of a foot box in world space, for drawing and tests. */
export function footCorners(pz, side) {
  const sd = pz.sides[side];
  const pts = [];
  for (const x of [-BODY.heel, BODY.foot]) for (const y of [-BODY.ankleH, 0.035]) for (const z of [-0.045, 0.045]) {
    pts.push(add(sd.ankle, add(mul(sd.foot.fx, x), add(mul(sd.foot.fy, y), mul(sd.foot.lat, z)))));
  }
  return pts;
}

/**
 * The limbs of the rubber hose figure as they are drawn: the wrist and hand trail behind the arm (follow-through), and an arm that reaches, or a leg that swings out,
 * stretches. Stretch grows each limb about its root as it straightens, up to half again as long at full strength; a leg stretches along the ground, not down through it.
 */
export function hoseLimbs(sd, p) {
  const wrist = sd.wristF || sd.wrist; const hand = sd.handF || sd.hand; const k = Math.max(0, p?.hoseStretch ?? 0);
  if (!k) return { ...sd, wrist, hand };
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const grow = (root, pts, ext, flat) => pts.map((q) => { const v = sub(q, root); return add(root, flat ? [v[0] * (1 + ext), v[1], v[2] * (1 + ext)] : mul(v, 1 + ext)); });
  const armL = len(sub(sd.elbow, sd.shoulder)) + len(sub(wrist, sd.elbow)); const eA = clamp01((len(sub(wrist, sd.shoulder)) / armL - 0.7) / 0.3);
  const [elbow, wrist2, hand2] = grow(sd.shoulder, [sd.elbow, wrist, hand], k * 0.5 * eA * eA, false);
  const legL = len(sub(sd.knee, sd.hip)) + len(sub(sd.ankle, sd.knee)); // a leg only stretches while it swings, and eases in and out, so it does not jump when the foot lands or leaves the ground (that jump was a pop at the loop join)
  const g = sideGait(p, sd.s > 0 ? 'R' : 'L'); const kSwing = sd.w >= g.p.duty ? Math.sin(Math.PI * ((sd.w - g.p.duty) / Math.max(1e-6, 1 - g.p.duty))) : 0;
  const eL = kSwing * clamp01((len(sub(sd.ankle, sd.hip)) / legL - 0.8) / 0.2);
  const [knee, ankle] = grow(sd.hip, [sd.knee, sd.ankle], k * 0.5 * eL * eL, true);
  return { ...sd, elbow, wrist: wrist2, hand: hand2, knee, ankle };
}
