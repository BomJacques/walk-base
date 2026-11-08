// Motion channels. Every moving part of the figure is driven by named channels, each a cyclic curve over the walk cycle (u from 0 to 1).
// A channel's value = amount * base(u - phase) + offset, where base is the built-in motion unless you have drawn your own curve.
// Angles are stored in radians, distances in leg lengths. The `ui` fields convert for display.
import { DEFAULTS } from './rig.js';
import { DOG_GAITS } from './dogdefaults.js';

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (u) => u - Math.floor(u);

/** Periodic cubic Hermite through points [{u,v}] sorted by u, with slopes from neighbouring points. One point is a constant; none gives 0. */
export function evalCurve(pts, u) {
  const n = pts.length;
  if (n === 0) return 0;
  if (n === 1) return pts[0].v;
  const x = wrap(u);
  let i = n - 1;
  for (let k = 0; k < n; k++) { if (pts[k].u > x) { i = (k - 1 + n) % n; break; } }
  const at = (k) => { const j = ((k % n) + n) % n; return { u: pts[j].u + Math.floor(k / n), v: pts[j].v }; };
  const p0 = at(i - 1); const p1 = at(i); const p2 = at(i + 1); const p3 = at(i + 2);
  const xx = x >= p1.u ? x : x + 1;
  const hw = p2.u - p1.u;
  const t = (xx - p1.u) / hw;
  const m1 = ((p2.v - p0.v) / (p2.u - p0.u)) * hw;
  const m2 = ((p3.v - p1.v) / (p3.u - p1.u)) * hw;
  const t2 = t * t; const t3 = t2 * t;
  return (2 * t3 - 3 * t2 + 1) * p1.v + (t3 - 2 * t2 + t) * m1 + (-2 * t3 + 3 * t2) * p2.v + (t3 - t2) * m2;
}

/** The part a channel belongs to, its label, and how to show its numbers. */
const deg = { unit: '°', to: (v) => (v * 180) / Math.PI, from: (v) => (v * Math.PI) / 180, min: -45, max: 45, step: 0.5 };
const len = { unit: 'legs', to: (v) => v, from: (v) => v, min: -0.15, max: 0.15, step: 0.002 };

/**
 * Channel registry. `sided` channels exist for R and L; L is the same motion half a cycle later.
 * def(u, g, p) returns the built-in value at phase u. g(id) reads another channel at the same phase, so defaults follow your edits.
 */
const C = [];
const ch = (id, part, label, kind, def, extra = {}) => C.push({ id, part, label, sided: false, ...kind, def, ...extra });
const sided = (id, part, label, kind, def, extra = {}) => C.push({ id, part, label, sided: true, ...kind, def, ...extra });

const phi = (p) => p.downPhase + 0.25;
const bobWave = (u, p) => Math.cos(TAU * 2 * (u - phi(p)));

// Pelvis (hips)
ch('pelvis.y', 'pelvis', 'Up and down', { ...len, min: -0.12, max: 0.12 }, (u, g, p) => (p.bob / 2) * (bobWave(u, p) - bobWave(0, p)));
ch('pelvis.x', 'pelvis', 'Forward and back', { ...len, min: -0.1, max: 0.1 }, () => 0);
ch('pelvis.z', 'pelvis', 'Side sway', { ...len, min: -0.12, max: 0.12 }, (u, g, p) => p.sway * Math.sin(TAU * u));
ch('pelvis.yaw', 'pelvis', 'Twist', deg, (u, g, p) => rad(p.pelvisYaw) * Math.cos(TAU * u));
ch('pelvis.roll', 'pelvis', 'Side tilt (hip drop)', deg, (u, g, p) => -rad(p.pelvisRoll) * Math.sin(TAU * u));
ch('pelvis.pitch', 'pelvis', 'Tilt forward and back', deg, (u, g, p) => rad(p.pelvisPitch) * Math.cos(TAU * 2 * (u - phi(p))));

// Spine: three joints, each bending in three directions. The built-in motion spreads the total across them.
const LEAN = (u, g, p) => rad(p.lean) + rad(p.torsoSway) * bobWave(u, p) - g('pelvis.pitch');
const TWIST = (u, g, p) => -rad(p.shoulderCounter) * Math.cos(TAU * u) - g('pelvis.yaw');
const SIDE = (u, g, p) => 0.4 * rad(p.pelvisRoll) * Math.sin(TAU * u) - g('pelvis.roll');
const FR = { 1: 0.3, 2: 0.4, 3: 0.3 };
for (const k of [1, 2, 3]) {
  const part = ['', 'spine.lower', 'spine.mid', 'spine.upper'][k];
  const name = ['', 'Lower spine', 'Mid spine', 'Upper spine'][k];
  ch(`spine${k}.pitch`, part, `${name}: bend forward and back`, deg, (u, g, p) => FR[k] * LEAN(u, g, p));
  ch(`spine${k}.roll`, part, `${name}: side bend`, deg, (u, g, p) => FR[k] * SIDE(u, g, p));
  ch(`spine${k}.yaw`, part, `${name}: twist`, deg, (u, g, p) => FR[k] * TWIST(u, g, p));
}
const topPitch = (g) => g('pelvis.pitch') + g('spine1.pitch') + g('spine2.pitch') + g('spine3.pitch');
const topYaw = (g) => g('pelvis.yaw') + g('spine1.yaw') + g('spine2.yaw') + g('spine3.yaw');
const topRoll = (g) => g('pelvis.roll') + g('spine1.roll') + g('spine2.roll') + g('spine3.roll');

// Neck and head
const nod = (u, p) => rad(p.headNod) * Math.cos(TAU * 2 * (u - (p.downPhase + 0.45)));
ch('neck.pitch', 'neck', 'Bend forward and back', deg, (u, g, p) => -0.5 * topPitch(g) + 0.5 * nod(u, p));
ch('neck.yaw', 'neck', 'Turn', deg, (u, g, p) => -p.headKeep * 0.55 * topYaw(g));
ch('neck.roll', 'neck', 'Side tilt', deg, (u, g, p) => -p.headKeep * 0.55 * topRoll(g));
ch('head.pitch', 'head', 'Nod', deg, (u, g, p) => -0.2 * topPitch(g) + 0.5 * nod(u, p));
ch('head.yaw', 'head', 'Turn', deg, (u, g, p) => -p.headKeep * 0.45 * topYaw(g));
ch('head.roll', 'head', 'Side tilt', deg, (u, g, p) => -p.headKeep * 0.45 * topRoll(g));

// Shoulders and arms
const armPhase = (u, p) => u - p.armLag;
const fwd = (u, g, id, p) => clamp(g(id) / Math.max(1e-6, rad(p.armSwing)), -1, 1);
sided('girdle.y', 'girdle', 'Shrug (up and down)', { ...len, min: -0.06, max: 0.06 }, (u, g, p) => 0.008 * Math.sin(TAU * armPhase(u, p)) + p.shrug * 0);
sided('girdle.x', 'girdle', 'Reach (forward and back)', { ...len, min: -0.08, max: 0.08 }, (u, g, p) => 0.014 * fwd(u, g, 'arm.pitch', p));
sided('arm.pitch', 'arm', 'Swing', { ...deg, min: -70, max: 70 }, (u, g, p) => -rad(p.armSwing) * Math.cos(TAU * armPhase(u, p)));
sided('arm.roll', 'arm', 'Out from body', { ...deg, min: -20, max: 70 }, (u, g, p) => rad(p.armOut));
sided('elbow.flex', 'forearm', 'Bend', { ...deg, min: 0, max: 140 }, (u, g, p) => rad(p.elbowBase) + rad(p.elbowSwing) * (0.5 + 0.5 * fwd(u, g, 'arm.pitch', p)));
sided('wrist.flex', 'hand', 'Bend', { ...deg, min: -60, max: 60 }, (u, g, p) => rad(6) + rad(8) * (0.5 + 0.5 * fwd(u, g, 'arm.pitch', p)));

// Legs: the feet are planted by IK, so these move the foot targets and the knee direction. Hip height and turn are the pelvis channels.
sided('knee.out', 'leg', 'Knee in and out', { ...deg, min: -30, max: 40 }, (u, g, p) => rad(p.kneeOut));
sided('foot.x', 'foot', 'Reach (forward and back)', { ...len, min: -0.3, max: 0.3 }, () => 0);
sided('foot.y', 'foot', 'Lift', { ...len, min: -0.05, max: 0.4 }, () => 0);
sided('foot.z', 'foot', 'Width from centre', { ...len, min: 0, max: 0.35 }, (u, g, p) => p.stepWidth);
sided('foot.pitch', 'foot', 'Toe up and down', { ...deg, min: -45, max: 45 }, () => 0);
sided('foot.yaw', 'foot', 'Toe out', { ...deg, min: -30, max: 50 }, (u, g, p) => rad(p.toeOut));

// ---------------------------------------------------------------------------------------------------------------
// Dog. Same kind of channel, same editing: ids start with "dog." and belong to the dog's own parts.
// ---------------------------------------------------------------------------------------------------------------
const dlen = { ...len, unit: 'heights' };
const dch = (id, part, label, kind, def, extra = {}) => ch(`dog.${id}`, `dog.${part}`, label, kind, def, extra);
const dsided = (id, part, label, kind, def, extra = {}) => sided(`dog.${id}`, `dog.${part}`, label, kind, def, extra);
/** The body's up and down rhythm: four beats a cycle in a walk, two in a trot or pace. */
const dbob = (u, p) => Math.cos(TAU * (DOG_GAITS[p.dogGait]?.bobRate ?? 2) * (u - (DOG_GAITS[p.dogGait]?.bobPhase ?? 0.1)));
/** The spine curl (squash and stretch) of a gallop or a run: +1 with the legs gathered (back arched up), -1 with them stretched out. Zero in the other gaits. A run does it once per step. */
const dCurl = (u, p) => (DOG_GAITS[p.dogGait]?.curlPhase == null ? 0 : rad(p.dogCurl) * Math.cos(TAU * (DOG_GAITS[p.dogGait].curlRate ?? 1) * (u - DOG_GAITS[p.dogGait].curlPhase)));
/** How the curl is shared out along the back, pelvis first. The tail end tips one way and the chest the other, so the back arches as a whole. */
const CURL = [-1, 0, 1, 1];
/** Phase at which the front right paw lands: its shoulder is lowest then. */
const dFront = (p) => DOG_GAITS[p.dogGait]?.front ?? 0.25;
/**
 * The hips and the shoulders counter-rotate along the spine (the book's top-down spine drawing). Written as the total each girdle
 * turns, then shared along the three spine joints so the back curves in an S.
 */
const dChestYaw = (u, p) => rad(p.dogFlex) * 0.5 * Math.cos(TAU * (u - dFront(p)));
const dChestRoll = (u, p) => rad(p.dogTwist) * 0.6 * Math.cos(TAU * (u - dFront(p)));
const SHARE = [0, 0.3, 0.4, 0.3];
/** Chest height follows the hips about two frames later and opposite: pelvis up, chest down (the book's chart). */
const dChestBob = (u, p) => {
  const g = DOG_GAITS[p.dogGait] || {};
  return (g.chestSign ?? -1) * (p.dogBob / 2) * Math.cos(TAU * (g.bobRate ?? 2) * (u - (g.bobPhase ?? 0.1) - (g.chestLag ?? 0.05))) - (g.bobDown ? p.dogBob / 2 : 0);
};
const SPINE_LEN = 0.9;
// Built-in values, written as plain functions so a spine joint's default never depends on what you did to another joint.
// A gallop bobs down from standing height (the highest the legs can reach), a walk bobs about it.
const dHipBob = (u, p) => (p.dogBob / 2) * (dbob(u, p) - (DOG_GAITS[p.dogGait]?.bobDown ? 1 : dbob(0, p)));
const dPelvisYaw = (u, p) => rad(p.dogFlex) * 0.6 * Math.cos(TAU * u);
const dPelvisRoll = (u, p) => -rad(p.dogTwist) * 0.4 * Math.cos(TAU * (u - dFront(p)));

dch('pelvis.y', 'pelvis', 'Up and down', { ...dlen, min: -0.3, max: 0.3 }, (u, g, p) => dHipBob(u, p));
dch('pelvis.x', 'pelvis', 'Forward and back', { ...dlen, min: -0.15, max: 0.15 }, () => 0);
dch('pelvis.z', 'pelvis', 'Side sway', { ...dlen, min: -0.12, max: 0.12 }, (u) => 0.01 * Math.sin(TAU * u));
dch('pelvis.yaw', 'pelvis', 'Twist', deg, (u, g, p) => dPelvisYaw(u, p));
dch('pelvis.roll', 'pelvis', 'Side tilt (hip drop)', deg, (u, g, p) => dPelvisRoll(u, p));
dch('pelvis.pitch', 'pelvis', 'Tilt up and down', deg, (u, g, p) => rad(p.dogArch) * 0.5 * dbob(u, p) + CURL[0] * dCurl(u, p));
const DSPINE = [['', '', ''], ['spine1', 'Lower back', 0.6], ['spine2', 'Mid back', -1], ['spine3', 'Chest', 0.6]];
for (const k of [1, 2, 3]) {
  const [id, name, arch] = DSPINE[k];
  // The mid back also takes up whatever pitch the chest needs to rise as the hips fall, so the weight appears to shift.
  dch(`${id}.pitch`, id, `${name}: arch and dip`, deg, k === 2
    ? (u, g, p) => (dHipBob(u, p) - dChestBob(u, p)) / SPINE_LEN - rad(p.dogArch) * 1.7 * dbob(u, p) + CURL[2] * dCurl(u, p)
    : (u, g, p) => rad(p.dogArch) * arch * dbob(u, p) + CURL[k] * dCurl(u, p));
  dch(`${id}.roll`, id, `${name}: twist`, deg, (u, g, p) => SHARE[k] * (dChestRoll(u, p) - dPelvisRoll(u, p)));
  dch(`${id}.yaw`, id, `${name}: bend sideways`, deg, (u, g, p) => SHARE[k] * (dChestYaw(u, p) - dPelvisYaw(u, p)));
}
const dTopPitch = (g) => g('dog.pelvis.pitch') + g('dog.spine1.pitch') + g('dog.spine2.pitch') + g('dog.spine3.pitch');
const dTopYaw = (g) => g('dog.pelvis.yaw') + g('dog.spine1.yaw') + g('dog.spine2.yaw') + g('dog.spine3.yaw');
const dTopRoll = (g) => g('dog.pelvis.roll') + g('dog.spine1.roll') + g('dog.spine2.roll') + g('dog.spine3.roll');
const dnod = (u, p) => rad(p.dogHeadNod) * Math.cos(TAU * 2 * (u - 0.3));
dch('neck.pitch', 'neck', 'Bend down and up', { ...deg, min: -60, max: 90 }, (u, g, p) => -0.5 * dTopPitch(g) + 0.5 * dnod(u, p) - 0.5 * dCurl(u, p));
dch('neck.yaw', 'neck', 'Turn', deg, (u, g) => -0.5 * dTopYaw(g));
dch('neck.roll', 'neck', 'Side tilt', deg, (u, g) => -0.5 * dTopRoll(g));
dch('head.pitch', 'head', 'Nod', { ...deg, min: -60, max: 70 }, (u, g, p) => -0.2 * dTopPitch(g) + 0.5 * dnod(u, p) - 0.3 * dCurl(u, p));
dch('head.yaw', 'head', 'Turn', deg, (u, g) => -0.4 * dTopYaw(g));
dch('head.roll', 'head', 'Side tilt', deg, (u, g) => -0.4 * dTopRoll(g));
dch('jaw.open', 'jaw', 'Mouth open', { ...deg, min: 0, max: 45 }, () => 0);
dsided('ear.flop', 'ear', 'Flop', { ...deg, min: -45, max: 60 }, (u, g, p) => rad(p.dogEar) * Math.sin(TAU * 2 * (u - 0.25)));
// Tail: three joints. The wag lags a little more along the tail, so it whips instead of swinging stiffly.
[['tail1', 'Tail base', 0.5, 0], ['tail2', 'Tail middle', 0.7, 0.06], ['tail3', 'Tail tip', 1, 0.12]].forEach(([id, name, amt, lag]) => {
  dch(`${id}.yaw`, id, `${name}: wag`, { ...deg, min: -60, max: 60 }, (u, g, p) => rad(p.dogWag) * amt * Math.sin(TAU * 2 * (u - lag)));
  dch(`${id}.pitch`, id, `${name}: up and down`, { ...deg, min: -60, max: 80 }, (u, g, p) => rad(3) * amt * dbob(u, p));
});
// Shoulder blades: a bone on the ribs, pivoting at the withers. It drops, slides and swings forward as its paw lands, then rises and swings back as the leg passes under.
dsided('fshoulder.x', 'fshoulder', 'Blade slide forward and back', { ...dlen, min: -0.1, max: 0.1 }, (u, g, p) => 0.1 * p.dogShoulder * Math.cos(TAU * (u - dFront(p))));
dsided('fshoulder.y', 'fshoulder', 'Blade rise and drop', { ...dlen, min: -0.1, max: 0.1 }, (u, g, p) => -(p.dogShoulder / 2) * Math.cos(TAU * (u - dFront(p))));
dsided('fshoulder.rot', 'fshoulder', 'Blade swing (pivots at the withers)', { ...deg, min: -30, max: 30 }, (u, g, p) => rad(80 * p.dogShoulder) * Math.cos(TAU * (u - dFront(p))));
// Legs: the paws are planted by IK, so these move the paw targets and which way the elbows and knees point.
for (const [pre, nm] of [['f', 'front'], ['h', 'hind']]) {
  dsided(`${pre}leg.out`, `${pre}leg`, nm === 'front' ? 'Elbow in and out' : 'Knee in and out', { ...deg, min: -30, max: 40 }, (u, g, p) => rad(p.dogElbowOut));
  dsided(`${pre}paw.x`, `${pre}paw`, 'Reach (forward and back)', { ...dlen, min: -0.4, max: 0.4 }, () => 0);
  dsided(`${pre}paw.y`, `${pre}paw`, 'Lift', { ...dlen, min: -0.05, max: 0.5 }, () => 0);
  dsided(`${pre}paw.z`, `${pre}paw`, 'Width from centre', { ...dlen, min: 0, max: 0.35 }, (u, g, p) => p.dogWidth);
  dsided(`${pre}paw.pitch`, `${pre}paw`, 'Paw up and down', { ...deg, min: -60, max: 60 }, () => 0);
}

/** Channel ids for R and L: 'arm.pitch' becomes 'arm.pitch.R' and 'arm.pitch.L'. */
export const CHANNELS = C.flatMap((c) => (c.sided ? [{ ...c, id: `${c.id}.R`, base: c.id, side: 'R', shift: 0 }, { ...c, id: `${c.id}.L`, base: c.id, side: 'L', shift: 0.5 }] : [{ ...c, base: c.id, side: null, shift: 0 }]));
export const CHANNEL_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c]));

const sideOf = (id) => (id.endsWith('.R') ? 'R' : id.endsWith('.L') ? 'L' : null);

/** Parts the figure is made of, in the order the Parts tab lists them. */
export const PARTS = [
  { id: 'dog.pelvis', label: 'Hips', group: 'Body', rig: 'dog' },
  { id: 'dog.spine1', label: 'Lower back', group: 'Body', rig: 'dog' },
  { id: 'dog.spine2', label: 'Mid back', group: 'Body', rig: 'dog' },
  { id: 'dog.spine3', label: 'Chest', group: 'Body', rig: 'dog' },
  { id: 'dog.neck', label: 'Neck', group: 'Head', rig: 'dog' },
  { id: 'dog.head', label: 'Head', group: 'Head', rig: 'dog' },
  { id: 'dog.jaw', label: 'Jaw', group: 'Head', rig: 'dog' },
  { id: 'dog.ear', label: 'Ear', group: 'Head', sided: true, rig: 'dog' },
  { id: 'dog.tail1', label: 'Tail base', group: 'Tail', rig: 'dog' },
  { id: 'dog.tail2', label: 'Tail middle', group: 'Tail', rig: 'dog' },
  { id: 'dog.tail3', label: 'Tail tip', group: 'Tail', rig: 'dog' },
  { id: 'dog.fshoulder', label: 'Shoulder blade', group: 'Front legs', sided: true, rig: 'dog' },
  { id: 'dog.fleg', label: 'Front leg and elbow', group: 'Front legs', sided: true, rig: 'dog' },
  { id: 'dog.fpaw', label: 'Front paw', group: 'Front legs', sided: true, rig: 'dog' },
  { id: 'dog.hleg', label: 'Hind leg and knee', group: 'Hind legs', sided: true, rig: 'dog' },
  { id: 'dog.hpaw', label: 'Hind paw', group: 'Hind legs', sided: true, rig: 'dog' },
  { id: 'pelvis', label: 'Hips and pelvis', group: 'Core' },
  { id: 'spine.lower', label: 'Lower spine', group: 'Core' },
  { id: 'spine.mid', label: 'Mid spine', group: 'Core' },
  { id: 'spine.upper', label: 'Upper spine', group: 'Core' },
  { id: 'neck', label: 'Neck', group: 'Core' },
  { id: 'head', label: 'Head', group: 'Core' },
  { id: 'girdle', label: 'Shoulder', group: 'Arms', sided: true },
  { id: 'arm', label: 'Upper arm', group: 'Arms', sided: true },
  { id: 'forearm', label: 'Forearm and elbow', group: 'Arms', sided: true },
  { id: 'hand', label: 'Hand and wrist', group: 'Arms', sided: true },
  { id: 'leg', label: 'Leg and knee', group: 'Legs', sided: true },
  { id: 'foot', label: 'Foot', group: 'Legs', sided: true },
];
export const partChannels = (part, side) => CHANNELS.filter((c) => c.part === part && (!c.sided || c.side === side));
export const partLabel = (part, side) => `${PARTS.find((p) => p.id === part)?.label ?? part}${side ? ` (${side === 'R' ? 'right' : 'left'})` : ''}`;

/** Default motion settings: nothing changed from the built-in walk. */
export const newMotion = () => ({});
const settingsOf = (motion, id) => motion?.[id];

/**
 * An evaluator for one pose. valueAt(id, u) is memoised per call, so defaults that read other channels stay cheap.
 */
export function makeEvaluator(params, motion = {}, free = null) {
  const p = { ...DEFAULTS, ...params };
  const memo = new Map();
  const evalAt = (id, u) => {
    const key = `${id}@${u.toFixed(7)}`;
    if (memo.has(key)) return memo.get(key);
    const c = CHANNEL_BY_ID[id];
    const s = settingsOf(motion, id);
    // A free-running channel keeps its own clock (the timeline frame over the walk's base cycle), so it carries on when the walk slows or stops.
    const x = (s?.free && free != null ? free : u) - (s?.phase || 0);
    // Frequency multiplies how often the motion repeats in a walk cycle. Whole multiples (and one half for even-rate motion) keep the loop closed.
    const xs = (s?.freq ?? 1) * x;
    let base;
    if (s?.pts?.length >= 2) base = evalCurve(s.pts, xs);
    else {
      // Cross-references stay on the same side. A sided default is written for the right side, so the left reads half a cycle later.
      base = c.def(c.sided ? xs - c.shift : xs, (other) => {
        const sid = c.sided ? `${other}.${c.side}` : other;
        return evalAt(CHANNEL_BY_ID[sid] ? sid : other, x);
      }, p);
    }
    const v = (s?.amount ?? 1) * base + (s?.offset || 0);
    memo.set(key, v);
    return v;
  };
  return { value: (id, u) => evalAt(id, u), p };
}

/** What a channel does with no edits, sampled at n points. For the curve editor's ghost line. */
export function sampleDefault(id, params, n = 96, motion = {}) {
  const c = CHANNEL_BY_ID[id];
  const clean = { ...motion, [id]: undefined };
  const ev = makeEvaluator(params, clean);
  return Array.from({ length: n }, (_, i) => ev.value(c.id, i / n));
}
export function sampleFinal(id, params, motion, n = 96) {
  const ev = makeEvaluator(params, motion);
  return Array.from({ length: n }, (_, i) => ev.value(id, i / n));
}

/** Channels whose built-in motion repeats an even number of times per cycle, so half the frequency still closes the loop. */
const EVEN_RATE = new Set(['pelvis.y', 'pelvis.pitch', 'spine1.pitch', 'spine2.pitch', 'spine3.pitch', 'neck.pitch', 'head.pitch',
  'dog.pelvis.y', 'dog.pelvis.pitch', 'dog.spine1.pitch', 'dog.spine2.pitch', 'dog.spine3.pitch', 'dog.neck.pitch', 'dog.head.pitch',
  'dog.tail1.yaw', 'dog.tail2.yaw', 'dog.tail3.yaw', 'dog.tail1.pitch', 'dog.tail2.pitch', 'dog.tail3.pitch', 'dog.ear.flop.R', 'dog.ear.flop.L']);
export const FREQUENCIES = [1, 2, 3, 4];
/** The frequencies a channel can use now. A drawn curve spans one cycle, so it only repeats in whole numbers. */
export function allowedFrequencies(id, motion) {
  const drawn = Boolean(motion?.[id]?.pts?.length >= 2);
  return EVEN_RATE.has(id) && !drawn ? [0.5, ...FREQUENCIES] : FREQUENCIES;
}

/** True when a channel differs from the built-in walk. */
export const isEdited = (motion, id) => {
  const s = motion?.[id];
  return Boolean(s && ((s.pts && s.pts.length) || (s.amount != null && s.amount !== 1) || s.offset || s.phase || s.free || (s.freq != null && s.freq !== 1)));
};
