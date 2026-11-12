// 3D dog rig. Joints are in shoulder heights (a standing dog's withers are about 1.0 high): x forward, y up, z to the dog's right.
// Like the human it is built on channels, so every part can be tuned, drawn by hand and automated. The four paws are planted by IK.
import { DEFAULTS, groundAt, withWeight, noiseOf } from './rig.js';
import { DOG_GAITS, speciesOf } from './dogdefaults.js';
import { makeEvaluator } from './motion.js';
import { paramsAt } from './automation.js';
import { poseCrawler } from './crawler.js';
import { add, sub, mul, norm, apply, mm, Rpitch, seg, ik3 } from './rig3.js';

const TAU = Math.PI * 2;
const wrap = (u) => u - Math.floor(u);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => x * x * (3 - 2 * x);
const mixv = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const rad = (d) => (d * Math.PI) / 180;

/** Bone lengths in shoulder heights. */
export const DOGB = Object.freeze({
  spine: [0.30, 0.30, 0.30], neck: 0.40, skull: 0.26, snout: 0.22, jaw: 0.28,
  upper: 0.32, fore: 0.32, pastern: 0.20, thigh: 0.36, shin: 0.34, meta: 0.26, paw: 0.05, pawLen: 0.12,
  shoulderDrop: 0.12, shoulderBack: 0.04, hipWidth: 0.075, shoulderWidth: 0.09,
  // The shoulder blade lies on the ribs. Its top (by the withers) is up and behind the shoulder joint, sloping at about 62 degrees.
  scapula: 0.26, scapulaSlope: (62 * Math.PI) / 180, scapulaWidth: 0.07,
  tail: [0.20, 0.20, 0.18], ear: 0.16,
});
/** The bones of this figure's species, in shoulder heights. */
export const bonesOf = (p) => ({ ...DOGB, ...speciesOf(p).bones });
/** The limbs that carry the body: two for a theropod or a bird, four otherwise. */
export const legsOf = (p) => { const sp = speciesOf(p); return sp.legKeys ? sp.legKeys.filter((k) => k[0] !== 'C') : sp.legs === 2 ? ['HR', 'HL'] : ['HR', 'HL', 'FR', 'FL']; }; // a spider's eight, a snake's none

/** One paw relative to its joint, at foot phase w in [0,1) where 0 is its contact. D is the ground it covers while planted. */
export function pawPath(w, duty, D, lift) {
  if (w < duty) return { x: D / 2 - (D * w) / duty, y: 0, theta: 0, stance: true };
  const k = (w - duty) / (1 - duty);
  const prog = 0.85 * (1 - Math.pow(1 - k, 1.8)) + 0.15 * smooth(k);
  return { x: -D / 2 + D * prog, y: lift * Math.pow(Math.sin(Math.PI * Math.pow(k, 0.8)), 1.3), theta: -0.4 * Math.sin(Math.PI * k), stance: false };
}

/** The foot phase of each paw. Hind right contacts at 0; the front paw on a side trails by the gait's offset; left is half a cycle later. */
export const pawPhase = (gait, leg) => {
  const g = DOG_GAITS[gait] || DOG_GAITS.walk;
  if (g.phases) return g.phases[leg];
  return { HR: 0, HL: 0.5, FR: g.front, FL: wrap(g.front + 0.5) }[leg];
};

/**
 * The gait one paw follows: its phase, time on the ground and lift. The left paws can land late, stay down for a different time and lift differently
 * (a limp, an uneven walk). The planted ground each covers follows its time on the ground, so a paw never slides.
 */
export function pawGait(params, leg) {
  const p = withWeight(params);
  const left = leg[1] === 'L';
  return {
    ph: wrap((speciesOf(p).phases?.[leg] ?? (speciesOf(p).legKeys ? ((Math.floor(speciesOf(p).legKeys.indexOf(leg) / 2) + (left ? 1 : 0)) % 2) * 0.5 : pawPhase(p.dogGait, leg))) + (left ? p.dogAsymTiming || 0 : 0)),
    duty: clamp(p.dogDuty + (left ? p.dogAsymDuty || 0 : 0), 0.15, 0.9),
    lift: p.dogLift * (left ? Math.max(0, 1 + (p.dogAsymLift || 0)) : 1),
  };
}

/** Cubic Hermite through (k, v) knots with given end slopes; interior slopes from the neighbours. */
function knots(ks, vs, s0, s1, k) {
  const n = ks.length;
  const m = vs.map((_, i) => (i === 0 ? s0 : i === n - 1 ? s1 : (vs[i + 1] - vs[i - 1]) / (ks[i + 1] - ks[i - 1])));
  let i = 0; while (i < n - 2 && k > ks[i + 1]) i++;
  const h = ks[i + 1] - ks[i]; const t = clamp((k - ks[i]) / h, 0, 1); const t2 = t * t; const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * vs[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * vs[i + 1] + (t3 - t2) * h * m[i + 1];
}

/**
 * A paw in a gallop. It is planted like any other, but the swing is the point: the paw trails back, then tucks up under the body
 * (the hind paws forward under the belly, the front paws back under the chest), then reaches out and sweeps back to meet the ground.
 */
export function gallopPawPath(w, duty, D, lift, front) {
  if (w < duty) return { x: D / 2 - (D * w) / duty, y: 0, theta: 0, stance: true };
  const k = (w - duty) / (1 - duty);
  const ks = [0, 0.18, 0.55, 0.85, 1];
  const xs = front ? [-D / 2, -D / 2 - 0.04, -0.05, D / 2 + 0.2, D / 2] : [-D / 2, -D / 2 - 0.2, D / 2 - 0.05, D / 2 + 0.1, D / 2];
  const ys = (front ? [0, 0.55, 1, 0.75, 0] : [0, 0.8, 1, 0.55, 0]).map((v) => v * lift);
  const sx = -0.4 * D * (1 - duty) / Math.max(duty, 0.05);
  return { x: knots(ks, xs, sx, sx, k), y: Math.max(0, knots(ks, ys, 0, 0, k)), theta: -0.5 * Math.sin(Math.PI * k), stance: false };
}

/**
 * A foot in a two-legged run. The foot pushes off and trails behind, then comes up fast and tucks high under the body (the knee drives forward, as a running
 * chicken's does), then reaches out ahead and comes down to meet the ground, so the swing is long, high and quick, with the toe pitched down as it lands.
 */
export function runPawPath(w, duty, D, lift) {
  if (w < duty) return { x: D / 2 - (D * w) / duty, y: 0, theta: 0, stance: true };
  const k = (w - duty) / (1 - duty);
  const ks = [0, 0.22, 0.55, 0.85, 1];
  const xs = [-D / 2, -D / 2 - 0.04 * D, 0.05 * D, D / 2 + 0.04 * D, D / 2];
  const ys = [0, 0.8, 1, 0.5, 0].map((v) => v * lift);
  const sx = -0.4 * D * (1 - duty) / Math.max(duty, 0.05);
  return { x: knots(ks, xs, sx, sx, k), y: Math.max(0, knots(ks, ys, 0, 0, k)), theta: -0.6 * Math.sin(Math.PI * k), stance: false };
}

/** Ground a planted paw covers. Limited to what the legs can span, so a very long stride on short legs shortens its steps instead of tearing the leg off. */
export function stanceTravel(p, sc, duty = p.dogDuty) {
  const L = bonesOf(p); const legH = sc('dLeg') * sc('dLegH'); const legF = sc('dLeg') * sc('dLegF'); const { hock, pastern } = speciesOf(p).lean;
  const hind = 0.88 * (L.thigh + L.shin) * legH - L.meta * legH * Math.sin(hock);
  const dmax = 2 * (speciesOf(p).legs === 2 ? hind : Math.min(hind, 0.88 * (L.upper + L.fore) * legF - L.pastern * legF * Math.sin(pastern)));
  return Math.min(p.dogStride * duty, Math.max(0.05, dmax));
}

/** Body height at which the hind hips and the shoulders keep every planted paw within reach. */
export function standHeights(p, sc) {
  const L = bonesOf(p); const legH = sc('dLeg') * sc('dLegH'); const legF = sc('dLeg') * sc('dLegF'); const { hock: HOCK_LEAN, pastern: PASTERN_LEAN } = speciesOf(p).lean;
  const D = stanceTravel(p, sc);
  const hockY = L.paw + L.meta * legH * Math.cos(HOCK_LEAN);
  const hockDx = L.meta * legH * Math.sin(HOCK_LEAN);
  const reachH = 0.95 * (L.thigh + L.shin) * legH;
  const hip = hockY + Math.sqrt(Math.max(0.01, reachH ** 2 - (D / 2 + hockDx) ** 2));
  const wristY = L.paw + L.pastern * legF * Math.cos(PASTERN_LEAN);
  const wristDx = L.pastern * legF * Math.sin(PASTERN_LEAN);
  const reachF = 0.95 * (L.upper + L.fore) * legF;
  const shoulder = wristY + Math.sqrt(Math.max(0.01, reachF ** 2 - (D / 2 + wristDx) ** 2));
  return { hip, shoulder };
}

export function poseDog(params, motion, u, extra = null) {
  if (speciesOf(params).crawler) return poseCrawler(params, motion, u, extra); // the snake, the spider and the crab have a rig of their own
  const p = withWeight({ ...DEFAULTS, ...params });
  const ev = makeEvaluator(p, motion, extra?.freeU ?? null);
  const uw = wrap(u);
  const noiseT = extra?.freeU != null ? extra.freeU : uw;
  const c = (id) => ev.value(`dog.${id}`, uw) + (p.noiseAmount > 0 ? noiseOf(p, `dog.${id}`, noiseT) : 0);
  const sc = (k) => (p.proportions || {})[k] ?? 1;
  const L = bonesOf(p); const sp = speciesOf(p); const biped = sp.legs === 2;
  const fl = clamp(p.dogFlight ?? 0, 0, 1); // in the air: the body lifts and the feet tuck up
  // The wing beat has a clock of its own when Frames per wing beat is set: in a performance it is the timeline frame, so it carries on whatever the walk does.
  const flapPhase = p.dogFlapFrames > 0 ? (extra?.freeU != null ? (TAU * extra.freeU * Math.max(2, Math.round(p.cycleFrames))) / p.dogFlapFrames : TAU * Math.max(1, Math.round(p.cycleFrames / p.dogFlapFrames)) * uw) : TAU * p.dogFlapRate * uw;
  const HOCK_LEAN = sp.lean.hock; const PASTERN_LEAN = sp.lean.pastern;
  const body = sc('dBody'); const leg = sc('dLeg');
  const D = stanceTravel(p, sc);
  const lens = L.spine.map((l) => l * body);
  const heights = standHeights(p, sc);

  // Spine: the hips are the root; the back is tilted so the shoulders sit at the height the front legs need.
  const spineLen = lens[0] + lens[1] + lens[2];
  // Uneven ground: each paw stands on the ground where it lands, a swinging paw lifts to clear what is ahead, the hips ride at the height under the hind paws,
  // and the back tilts to carry the shoulders at the height under the front paws.
  const terr = p.terrain && p.terrain !== 'flat' && fl < 0.5;
  const tilt0 = biped ? -rad(p.dogTilt) : -Math.asin(clamp((heights.shoulder + L.shoulderDrop - heights.hip) / spineLen, -0.6, 0.6));
  const restX0 = spineLen * Math.cos(tilt0) - L.shoulderBack;
  const wx = extra?.worldX ?? uw * p.dogStride;
  const tG = {}; let gHind = 0; let gFront = 0;
  if (terr) {
    const gs = { H: [], F: [] };
    for (const leg4 of legsOf(p)) {
      const front0 = leg4[0] === 'F'; const gt = pawGait(p, leg4); const w0 = wrap(uw - gt.ph); const Dp0 = gt.duty === p.dogDuty ? D : stanceTravel(p, sc, gt.duty);
      const f0 = p.dogGait === 'gallop' ? gallopPawPath(w0, gt.duty, Dp0, gt.lift, front0) : p.dogGait === 'run' ? runPawPath(w0, gt.duty, Dp0, gt.lift) : pawPath(w0, gt.duty, Dp0, gt.lift);
      const x = wx + (front0 ? restX0 : 0) + f0.x; const g0 = groundAt(p, x); const ahead = groundAt(p, x + 0.3);
      const swing = f0.stance ? 0 : clamp(f0.y / Math.max(0.01, gt.lift), 0, 1);
      tG[leg4] = { y: g0 + Math.max(0, ahead - g0) * swing, slope: Math.atan2(groundAt(p, x + 0.06) - groundAt(p, x - 0.06), 0.12) * (1 - swing) };
      gs[front0 ? 'F' : 'H'].push(g0);
    }
    // The hips and the shoulders ride near the lower paw of their pair, so the higher leg bends and the lower one never overreaches.
    const near = (a) => { if (!a.length) return null; const lo = Math.min(...a); return lo + 0.12 * (Math.max(...a) - lo); };
    gHind = near(gs.H) ?? 0; gFront = near(gs.F) ?? gHind;
  }
  const rise = heights.shoulder + L.shoulderDrop - heights.hip + (gFront - gHind);
  const baseTilt = biped ? -rad(p.dogTilt) : -Math.asin(clamp(rise / spineLen, -0.6, 0.6));
  // In flight the body rises on each down-stroke of the wings and sinks on each up-stroke.
  const flightLift = fl * (p.dogFlightHeight - Math.min(1, clamp(p.dogFlap / 40, 0, 1.5)) * 0.07 * Math.sin(flapPhase));
  const P = [c('pelvis.x'), heights.hip + c('pelvis.y') + flightLift + gHind, c('pelvis.z')];
  const Rp = seg(c('pelvis.yaw'), c('pelvis.pitch') + baseTilt, c('pelvis.roll'));
  const R1 = mm(Rp, seg(c('spine1.yaw'), c('spine1.pitch'), c('spine1.roll')));
  const R2 = mm(R1, seg(c('spine2.yaw'), c('spine2.pitch'), c('spine2.roll')));
  const R3 = mm(R2, seg(c('spine3.yaw'), c('spine3.pitch'), c('spine3.roll')));
  const j1 = add(P, apply(R1, [lens[0], 0, 0]));
  const j2 = add(j1, apply(R2, [lens[1], 0, 0]));
  const j3 = add(j2, apply(R3, [lens[2], 0, 0]));

  // Neck and head. The neck rises from the back; the head tips back down from the neck.
  // A bird holds its head still in space while the body moves on under it, then thrusts it forward: a sawtooth in the body's own frame.
  let holdShift = 0;
  if (p.dogHeadHold > 0) {
    const steps = p.dogGait === 'hop' ? 1 : 2; const ph = wrap(steps * uw - 0.3); const H = 0.65; const A = (p.dogHeadHold * p.dogStride) / steps;
    holdShift = ph < H ? -A * ph : -A * H * (1 - smooth((ph - H) / (1 - H)));
  }
  const neckBase = add(add(j3, apply(R3, [0.04, 0.05, 0])), [holdShift, 0, 0]);
  let Rn = mm(R3, seg(c('neck.yaw'), c('neck.pitch') - rad(p.dogNeckAngle), c('neck.roll')));
  // The neck is one bone or several. With several, each carries on from the one before with its share of the curve and a wave that runs up the neck as the animal walks.
  const nSegs = clamp(Math.round(p.dogNeckSegs ?? 1), 1, 12); const segLen = (L.neck * sc('dNeck')) / nSegs;
  const neck = [neckBase]; let Rk = Rn;
  for (let i = 0; i < nSegs; i++) {
    if (i > 0) Rk = mm(Rk, seg(rad(p.dogNeckSway || 0) * Math.sin(TAU * uw - i * 0.6 + 1.2), rad(p.dogNeckCurve || 0) / nSegs + rad(p.dogNeckWave || 0) * Math.sin(TAU * uw - i * 0.7), 0));
    neck.push(add(neck[i], apply(Rk, [segLen, 0, 0])));
  }
  const neckTop = neck[nSegs]; Rn = Rk;
  const hs = sc('dHead');
  const Rh = mm(Rn, seg(c('head.yaw'), c('head.pitch') + rad(p.dogHeadAngle), c('head.roll')));
  const headC = add(neckTop, apply(Rh, [L.skull * 0.5 * hs, 0, 0]));
  const snoutK = sc('dSnout'); const noseTip = add(neckTop, apply(Rh, [(L.skull + L.snout * snoutK) * hs, -0.02 * hs, 0]));
  const hinge = add(neckTop, apply(Rh, [L.skull * 0.45 * hs, -0.05 * hs, 0]));
  const Rj = mm(Rh, Rpitch(c('jaw.open')));
  const jawEnd = add(hinge, apply(Rj, [L.jaw * hs * snoutK, 0, 0]));
  const ears = {};
  for (const side of ['R', 'L']) {
    const s = side === 'R' ? 1 : -1;
    const root = add(neckTop, apply(Rh, [L.skull * 0.3 * hs, 0.07 * hs, s * 0.07 * hs]));
    const Re = mm(Rh, Rpitch(c(`ear.flop.${side}`)));
    ears[side] = { root, tip: add(root, apply(Re, [-0.02, -L.ear * sc('dEar'), s * 0.04])) };
  }

  // Tail: three joints behind the hips, carried above the back.
  const tail = [add(P, apply(Rp, [-0.05, 0.05, 0]))];
  let Rt = Rp;
  [1, 2, 3].forEach((k) => {
    Rt = mm(Rt, seg(c(`tail${k}.yaw`), c(`tail${k}.pitch`) + (k === 1 ? rad(p.dogTailAngle) : 0), 0));
    tail.push(add(tail[k - 1], apply(Rt, [-L.tail[k - 1] * sc('dTail'), 0, 0])));
  });

  // Legs. Every paw is planted by IK. Front elbows point back, hind knees point forward.
  const shoulderRestX = spineLen * Math.cos(baseTilt) - L.shoulderBack;
  const legs = {};
  for (const leg4 of ['HR', 'HL', 'FR', 'FL']) {
    const front = leg4[0] === 'F'; const side = leg4[1]; const s = side === 'R' ? 1 : -1;
    const k = (id) => c(`${front ? 'f' : 'h'}${id}.${side}`); const lg = leg * sc(front ? 'dLegF' : 'dLegH'); // the front legs and the hind legs can be different lengths
    const g = pawGait(p, leg4); const w = wrap(uw - g.ph); const Dp = g.duty === p.dogDuty ? D : stanceTravel(p, sc, g.duty);
    const f = p.dogGait === 'gallop' ? gallopPawPath(w, g.duty, Dp, g.lift, front) : p.dogGait === 'run' ? runPawPath(w, g.duty, Dp, g.lift) : pawPath(w, g.duty, Dp, g.lift);
    const ang = front ? PASTERN_LEAN : HOCK_LEAN;
    const bone = (front ? L.pastern : L.meta) * lg;
    const pitch = f.theta + k('paw.pitch') + (tG[leg4]?.slope ?? 0);
    const lean = ang - 0.6 * pitch;
    const pawC = [(front ? shoulderRestX : 0) + f.x + k('paw.x'), L.paw + f.y + k('paw.y') + (tG[leg4]?.y ?? 0), s * k('paw.z')];
    const targetWalk = add(pawC, [-bone * Math.sin(lean), bone * Math.cos(lean), 0]);
    const target = !front && fl > 0 ? mixv(targetWalk, add(P, apply(Rp, [-0.32 * lg, -0.2 * lg, s * 0.05])), fl) : targetWalk;
    // Front leg: the shoulder blade is a bone of its own. Its top rides on the ribs by the withers (it slides and drops there),
    // it swings about that point, and the shoulder joint hangs from its lower end. The upper arm starts at that joint.
    let top = null; let root;
    if (front) {
      const rest = [-L.shoulderBack, -L.shoulderDrop];
      const j0 = [L.scapula * Math.cos(L.scapulaSlope), -L.scapula * Math.sin(L.scapulaSlope)]; // top to joint at rest
      const r = k('shoulder.rot'); const cr = Math.cos(r); const sr = Math.sin(r);
      const j = [j0[0] * cr - j0[1] * sr, j0[0] * sr + j0[1] * cr];
      const t = [rest[0] - j0[0] + k('shoulder.x'), rest[1] - j0[1] + k('shoulder.y')];
      top = add(j3, apply(R3, [t[0], t[1], s * L.scapulaWidth]));
      root = add(j3, apply(R3, [t[0] + j[0], t[1] + j[1], s * L.shoulderWidth]));
    } else root = add(P, apply(Rp, [0, -0.02, s * L.hipWidth]));
    const out = k('leg.out');
    const pole = front ? norm([-Math.cos(out), 0, s * Math.sin(out)]) : norm([Math.cos(out), 0, s * Math.sin(out)]);
    const l1 = (front ? L.upper : L.thigh) * lg; const l2 = (front ? L.fore : L.shin) * lg;
    if ((front && sp.front !== 'leg') || (!front && sp.hind === 'wing')) {
      // An arm, a wing or a flipper hangs free: it is placed, not planted. Arms swing a little against the legs; a wing or flipper folds or spreads and beats (a hind one a quarter beat behind).
      const ar = front ? sp.armRest : (sp.hindRest || sp.armRest); const off = [k('paw.x'), k('paw.y'), s * k('paw.z')]; let reach = Math.min((l1 + l2) * 0.93, 0.98 * (l1 + l2) - Math.hypot(...off)); // the paw offsets (how far apart the paws are) move the goal too, so they come out of the reach
      let loc; let lag = 0; let handScale = 1;
      if ((front ? sp.front : sp.hind) === 'wing') {
        // The wing sweeps back a little, folds at the elbow on the up-stroke, and the tip trails behind the beat (it lags below going up, above going down).
        const open = clamp(p.dogWingOpen, 0, 1); const ph = front ? flapPhase : flapPhase - Math.PI / 2; const beat = rad(p.dogFlap) * Math.sin(ph); const amp = clamp(p.dogFlap / 30, 0, 1);
        reach *= 1 - 0.28 * Math.max(0, Math.sin(ph)) * amp;
        const ext = mul(norm([-0.3, Math.sin(beat), Math.cos(beat)]), reach);
        loc = [ar[0] * (1 - open) + ext[0] * open, ar[1] * (1 - open) + ext[1] * open, s * (ar[2] * (1 - open) + ext[2] * open)];
        lag = open * amp * 0.9 * Math.cos(ph); handScale = 1 + 0.8 * open;
      } else loc = [ar[0] + p.dogArmSwing * Math.sin(TAU * (uw - (side === 'R' ? 0 : 0.5))), ar[1], s * ar[2]];
      const goal = add(add(root, apply(front ? R3 : Rp, loc)), off);
      const arm = ik3(root, goal, l1, l2, pole);
      const dir0 = norm(sub(arm.ankle, arm.knee)); const dir = lag ? norm([dir0[0], dir0[1] - lag, dir0[2]]) : dir0;
      const hand = add(arm.ankle, mul(dir, (front ? L.pastern : L.meta) * lg * handScale));
      legs[leg4] = { front, side, s, top, root, mid: arm.knee, wrist: arm.ankle, paw: hand, toe: add(hand, mul(dir, L.pawLen * 0.6 * sc('dPaw'))), reached: arm.reached, stance: false, w: 0, theta: 0, free: true };
      continue;
    }
    const ik = ik3(root, target, l1, l2, pole);
    let pawF = pawC; let toe = add(pawC, [Math.cos(pitch) * L.pawLen * sc('dPaw'), Math.sin(pitch) * L.pawLen * sc('dPaw'), 0]);
    if (!front && fl > 0) { // tucked: the foot trails back under the tail
      pawF = mixv(pawC, add(ik.ankle, apply(Rp, [-0.09 * lg, -0.09 * lg, 0])), fl);
      toe = mixv(toe, add(pawF, apply(Rp, [-0.1 * lg, -0.03 * lg, 0])), fl);
    }
    legs[leg4] = { front, side, s, top, root, mid: ik.knee, wrist: ik.ankle, paw: pawF, toe, reached: ik.reached, stance: f.stance && fl < 0.5, w, theta: pitch };
  }
  return { u: uw, pelvisX: extra?.worldX ?? uw * p.dogStride, params: p, groundY: gHind, pelvis: P, Rp, R1, R2, R3, Rn, Rh, Rj, j1, j2, j3, neckBase, neckTop, neck, headC, noseTip, hinge, jawEnd, ears, tail, legs, heights, baseTilt };
}

/** Where each paw lands during a performance, for the footprint guide. s is the result of integrate(). */
export function dogPlants(base, lanes, T, s) {
  const out = [];
  if ((base.dogFlight || 0) > 0.5) return out;
  for (let t = 0; t < T; t++) {
    for (const leg of legsOf(base)) {
      const ph = pawGait(base, leg).ph;
      if (Math.floor(s.u[t + 1] - ph + 1e-9) > Math.floor(s.u[t] - ph + 1e-9)) {
        const p = paramsAt(base, lanes, t + 1);
        const z = poseDog(p, {}, pawGait(p, leg).ph).legs[leg];
        out.push({ leg, side: leg[1], t: t + 1, x: s.x[t + 1] + z.paw[0], z: z.paw[2] });
      }
    }
  }
  return out;
}
