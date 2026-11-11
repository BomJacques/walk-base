// The creatures that are not a dog on four legs: a snake (no legs, a wave runs down its body), a spider (eight legs, in two sets that take turns) and a crab (eight legs, walking sideways, with two claws).
// Each returns a pose with the same fields as the dog's (hips, back, neck, head, tail, legs by name), so the stage, the arcs, the stick view and the gait chart treat them as legged figures,
// and the extras (`chain`, `body`, `centreX`) that their own drawing, in crawldraw.js, uses. Units are shoulder heights. x is the way it travels, y up, z to its right.
import { DEFAULTS, withWeight, noiseOf } from './rig.js';
import { speciesOf } from './dogdefaults.js';
import { makeEvaluator } from './motion.js';
import { add, sub, mul, norm, apply, ik3, seg } from './rig3.js';

const TAU = Math.PI * 2;
const wrap = (u) => u - Math.floor(u);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };
const rad = (d) => (d * Math.PI) / 180;
const I3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const LEG_KEYS = ['FR', 'FL', 'AR', 'AL', 'BR', 'BL', 'HR', 'HL'];

/** One foot's step: planted while it covers the ground D, then lifted and brought forward. w is the foot's phase, 0 at its landing. */
function step(w, duty, D, lift) {
  if (w < duty) return { x: D / 2 - (D * w) / duty, y: 0, stance: true };
  const k = (w - duty) / (1 - duty); const prog = 0.85 * (1 - Math.pow(1 - k, 1.8)) + 0.15 * smooth(k);
  return { x: -D / 2 + D * prog, y: lift * Math.pow(Math.sin(Math.PI * Math.pow(k, 0.8)), 1.3), stance: false };
}

/** The same fields as the dog's pose, filled in from what a creature has. */
function dressed(p, o) {
  const head = o.headC; const ear = { root: head, tip: head };
  return {
    u: o.u, pelvisX: o.pelvisX, params: p, groundY: 0, pelvis: o.pelvis, Rp: I3, R1: I3, R2: I3, R3: I3, Rn: I3, Rh: o.Rh || I3, Rj: I3,
    j1: o.j1, j2: o.j2, j3: o.j3, neckBase: o.neck[0], neckTop: o.neck[o.neck.length - 1], neck: o.neck, headC: head, noseTip: o.noseTip, hinge: o.hinge || head, jawEnd: o.jawEnd || o.noseTip,
    ears: { R: ear, L: ear }, tail: o.tail, legs: o.legs, heights: { hip: o.pelvis[1], shoulder: o.j3[1] }, baseTilt: 0, centreX: o.centreX, crawler: o.kind, chain: o.chain || null, body: o.body || null,
  };
}

/** A snake: a chain of nodes from the head back, each following the one in front, so the wave pattern stays where it is on the ground and the snake slides through it. */
function snake(p, sc, c, uw, extra) {
  const B = { spine: [1, 1, 1], neck: 0.8, skull: 0.2, snout: 0.12, jaw: 0.2, tail: [0.9, 0.8, 0.7], ...speciesOf(p).bones }; const body = sc('dBody'); const girth = sc('dGirth');
  const Ls = (B.spine.reduce((t, v) => t + v, 0) + B.neck + B.tail.reduce((t, v) => t + v, 0)) * body;
  const lam = Math.max(0.3, p.dogStride); const kw = TAU / lam; const A = Math.min(0.42 * lam, (Math.tan(rad(clamp(p.dogFlex, 0, 80))) * lam) / TAU); const comp = 1 / Math.sqrt(1 + (A * kw) ** 2 / 2);
  const wx = extra?.worldX ?? uw * lam; const N = 44; const Hr = Math.min(0.5 * Ls, 0.2 * Ls + 0.5) * Math.sin(rad(clamp(p.dogNeckAngle, 0, 90))) * 0.55; const Lr = Math.min(0.42 * Ls, 3.2);
  const rmax = 0.075 * girth; const pts = []; const radii = [];
  for (let i = 0; i < N; i++) {
    const s = (i / (N - 1)) * Ls; const t = s / Ls; const xl = -s * comp; const lift = smooth(1 - s / Lr); const env = (0.45 + 0.55 * clamp(t / 0.6, 0, 1)) * (1 - 0.75 * lift);
    const z = A * env * Math.sin(TAU * ((wx + xl) / lam)) + c('pelvis.z');
    const y = 0.5 * rmax + Hr * Math.pow(lift, 1.3) + p.dogBob * 0.5 * Math.sin(TAU * (2 * (wx + xl) / lam)) * (1 - lift);
    pts.push([xl + c('pelvis.x'), y + c('pelvis.y'), z]);
    radii.push(rmax * (t < 0.04 ? 0.55 + 0.3 * (t / 0.04) : t < 0.35 ? 0.85 + 0.15 * smooth((t - 0.04) / 0.31) : 1 - 0.95 * Math.pow((t - 0.35) / 0.65, 1.15)) * (t > 0.35 ? 1 : 1));
  }
  const at = (f) => { const x = clamp(f, 0, 1) * (N - 1); const i = Math.min(N - 2, Math.floor(x)); return add(pts[i], mul(sub(pts[i + 1], pts[i]), x - i)); };
  const dir = norm(sub(pts[0], pts[2])); const head = add(pts[0], mul(dir, B.skull * 0.35 * sc('dHead'))); const nose = add(pts[0], mul(dir, (B.skull + B.snout) * 0.7 * sc('dHead')));
  const Rh = seg(Math.atan2(-dir[2], dir[0]), Math.asin(clamp(dir[1], -1, 1)), 0);
  return dressed(p, { kind: 'snake', u: uw, pelvisX: wx, centreX: -Ls / 2, pelvis: at(0.62), j1: at(0.5), j2: at(0.38), j3: at(0.26), neck: [at(0.2), at(0.14), at(0.08), at(0.03)], headC: head, noseTip: nose, Rh,
    hinge: head, jawEnd: add(nose, [0, -0.04 - 0.12 * clamp(c('jaw.open'), 0, 1), 0]), tail: [at(0.78), at(0.86), at(0.93), at(1)], legs: {}, chain: { pts, radii, N }, body: { length: Ls, head: B.skull * sc('dHead'), tongue: 0.5 + 0.5 * Math.sin(TAU * 3 * uw) } });
}

/** The eight legs of a spider or a crab, each: a root on the body, a knee, an ankle and a foot, with the foot planted by IK. */
function eightLegs(p, sc, uw, o) {
  const B = speciesOf(p).bones; const leg = sc('dLeg'); const legs = {}; const D0 = Math.min(p.dogStride * p.dogDuty, 0.6 * (B.upper + B.fore) * leg);
  const femur = B.upper * leg; const tibia = B.fore * leg; const tars = Math.max(0.03, B.pastern * leg);
  LEG_KEYS.forEach((key, idx) => {
    const j = Math.floor(idx / 2); const side = key[1]; const s = side === 'R' ? 1 : -1; const grp = (j + (side === 'L' ? 1 : 0)) % 2; const asym = side === 'L' ? p.dogAsymTiming || 0 : 0;
    const w = wrap(uw - grp * 0.5 - asym); const f = step(w, clamp(p.dogDuty + (side === 'L' ? p.dogAsymDuty || 0 : 0), 0.15, 0.9), D0, p.dogLift * (side === 'L' ? Math.max(0, 1 + (p.dogAsymLift || 0)) : 1));
    const { root, rest } = o.slot(j, s);
    const foot = [rest[0] + f.x, f.y + B.paw, rest[2]]; const ankle = add(foot, [0, tars * 0.9, o.ankleOut * s * (o.axis === 'z' ? 1 : 0)]);
    const ik = ik3(root, ankle, femur, tibia, norm(o.pole(j, s)));
    legs[key] = { front: j < 2, side, s, top: null, root, mid: ik.knee, wrist: ik.ankle, paw: foot, toe: add(foot, [0.04 * (o.axis === 'x' ? s : 1), 0, 0]), reached: ik.reached, stance: f.stance, w, theta: 0, free: false };
  });
  return legs;
}

/** A spider: a round body on eight legs that splay out sideways, the knees held high, walking on alternate sets of four. */
function spider(p, sc, c, uw, extra) {
  const B = speciesOf(p).bones; const leg = sc('dLeg'); const body = sc('dBody'); const girth = sc('dGirth'); const wx = extra?.worldX ?? uw * p.dogStride;
  const reach = (B.upper + B.fore) * leg; const Hb = 0.5 * reach + B.paw + 0.05; const bob = p.dogBob * Math.cos(TAU * 2 * uw); const Cc = [c('pelvis.x'), Hb + bob + c('pelvis.y'), c('pelvis.z')];
  const abdL = B.spine[0] * body; const thoL = B.spine[2] * body; const span = [0.62, 0.78, 0.8, 0.68]; const xs = [0.5, 0.26, -0.04, -0.34]; const rx = [0.5, 0.3, -0.02, -0.3];
  const slot = (j, s) => ({ root: add(Cc, [thoL * (0.42 - 0.3 * j) * 0.8, 0.02, s * 0.05 * girth]), rest: [Cc[0] + xs[j] * reach * 0.6 + rx[j] * 0, 0, s * span[j] * reach * 0.95] });
  const legs = eightLegs(p, sc, uw, { slot, pole: (j, s) => [0.15, 1, s * 0.45], ankleOut: 0.06, axis: 'z' });
  const head = add(Cc, [thoL * 0.55, 0.0, 0]); const nose = add(Cc, [thoL * 0.75, -0.02, 0]); const abd = add(Cc, [-abdL * 0.55, 0.04 * girth, 0]);
  return dressed(p, { kind: 'spider', u: uw, pelvisX: wx, centreX: 0, pelvis: abd, j1: add(Cc, [-abdL * 0.1, 0.02, 0]), j2: Cc, j3: add(Cc, [thoL * 0.3, 0, 0]), neck: [Cc, add(Cc, [thoL * 0.3, 0, 0])], headC: head, noseTip: nose, hinge: head, jawEnd: add(nose, [0.02, -0.05 - 0.1 * clamp(c('jaw.open'), 0, 1), 0]),
    tail: [abd, abd, abd, abd], legs, body: { abdomen: abd, abdL, thorax: Cc, thoL, girth, eyes: [-1, 1].flatMap((sg) => [[0.1, 0.07, 0.04], [0.14, 0.055, 0.075]].map(([x, y, z]) => add(Cc, [thoL * (0.55 + x), y * 1.0, sg * z]))) } });
}

/** A crab: a broad shell on eight legs, four a side, walking sideways (the way it travels is across its shell), with two claws held up in front and snipping. */
function crab(p, sc, c, uw, extra) {
  const B = speciesOf(p).bones; const leg = sc('dLeg'); const body = sc('dBody'); const girth = sc('dGirth'); const wx = extra?.worldX ?? uw * p.dogStride;
  const reach = (B.upper + B.fore) * leg; const half = 0.3 * body; const Hb = 0.62 * reach + B.paw + 0.04; const bob = p.dogBob * Math.cos(TAU * 2 * uw); const Cc = [c('pelvis.x'), Hb + bob + c('pelvis.y'), c('pelvis.z')];
  const zs = [0.14, 0.05, -0.05, -0.14].map((v) => v * body * 1.3);
  const slot = (j, s) => ({ root: add(Cc, [s * half * 0.9, -0.01, zs[j]]), rest: [Cc[0] + s * (half * 0.9 + (0.36 - 0.03 * j) * reach), 0, zs[j] * 1.5] });
  const legs = eightLegs(p, sc, uw, { slot, pole: (j, s) => [s * 0.5, 1, 0.1], ankleOut: 0, axis: 'x' });
  // the claws: an upper arm and a forearm held up and out, the pincer opening and closing
  const snip = clamp(p.dogWag / 30, 0, 1.5); const claws = {};
  for (const side of ['R', 'L']) {
    const s = side === 'R' ? 1 : -1; const root = add(Cc, [s * half * 0.55, 0.02, 0.2 * body]); const lift = 0.1 * Math.sin(TAU * (uw + (side === 'R' ? 0 : 0.5)));
    const goal = add(root, [s * 0.16 * body * 1.2, 0.2 * leg + lift, 0.3 * body]); const L1 = (B.thigh ?? 0.3) * leg; const L2 = (B.shin ?? 0.28) * leg;
    const ik = ik3(root, goal, L1, L2, norm([s * 0.3, 1, 0.5])); const open = (0.5 + 0.5 * Math.sin(TAU * 2 * (uw + (side === 'R' ? 0 : 0.25)))) * 0.55 * snip + 0.1;
    claws[`C${side}`] = { front: true, side, s, top: null, root, mid: ik.knee, wrist: ik.ankle, paw: add(ik.ankle, [s * 0.05, 0.1, 0.05]), toe: add(ik.ankle, [s * 0.09, 0.17, 0.09]), reached: ik.reached, stance: false, free: true, open, theta: 0, w: 0 };
  }
  const head = add(Cc, [0, 0.06, 0.2 * body]);
  return dressed(p, { kind: 'crab', u: uw, pelvisX: wx, centreX: 0, pelvis: add(Cc, [-half * 0.6, 0, 0]), j1: add(Cc, [-half * 0.2, 0, 0]), j2: Cc, j3: add(Cc, [half * 0.4, 0, 0]), neck: [Cc, head], headC: head, noseTip: add(head, [0, 0, 0.1]), tail: [Cc, Cc, Cc, Cc], legs: { ...legs, ...claws },
    body: { centre: Cc, half, girth, eyes: [-1, 1].map((sg) => ({ base: add(Cc, [sg * half * 0.28, 0.05 * girth, 0.17 * body]), tip: add(Cc, [sg * half * 0.3, 0.17 * girth, 0.21 * body]) })) } });
}

export function poseCrawler(params, motion, u, extra = null) {
  const p = withWeight({ ...DEFAULTS, ...params }); const sp = speciesOf(p); const uw = wrap(u);
  const ev = makeEvaluator(p, motion, extra?.freeU ?? null); const noiseT = extra?.freeU != null ? extra.freeU : uw;
  const c = (id) => ev.value(`dog.${id}`, uw) + (p.noiseAmount > 0 ? noiseOf(p, `dog.${id}`, noiseT) : 0);
  const sc = (k) => (p.proportions || {})[k] ?? 1;
  return sp.crawler === 'snake' ? snake(p, sc, c, uw, extra) : sp.crawler === 'spider' ? spider(p, sc, c, uw, extra) : crab(p, sc, c, uw, extra);
}
