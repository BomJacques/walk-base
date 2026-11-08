// Movement clips: recipes that write automation lanes, so a movement is ordinary automation you can edit afterwards.
// A clip says where each controlled value goes, as fractions of its length. Applying one at a frame writes those lanes there.
// Angles are radians (forward is positive). `k` scales how strongly it is done.
import { laneValue, replaceSpan, targetOfParam, targetOfChannel, CADENCE } from './automation.js';
import { HUMAN_MOVES, DOG_MOVES } from './moves.js';
import { SPECIES_MOVES, speciesSharedIds } from './moves2.js'; // also adds the kneel, limp, scratch and roll over movements to the two lists above

const P = targetOfParam;
const C = targetOfChannel;
/** Points from [fraction, value] pairs. */
const at = (D, list) => list.map(([f, v]) => ({ t: Math.round(f * D), v }));

export const CLIPS = {
  human: [
    {
      id: 'stop', label: 'Walk to stop', frames: 48, ends: 'stays stopped',
      help: 'Steps shorten and slow until the feet come together and the body settles. It stays stopped afterwards.',
      build: (b, D) => ({
        [CADENCE]: at(D, [[0, 1], [0.5, 0.7], [1, 0]]),
        [P('stepLength')]: at(D, [[0, b.stepLength], [0.8, 0]]),
        [P('footLift')]: at(D, [[0, b.footLift], [0.7, 0]]),
        [P('bob')]: at(D, [[0, b.bob], [0.8, 0]]),
        [P('armSwing')]: at(D, [[0, b.armSwing], [0.9, 0]]),
        [P('elbowSwing')]: at(D, [[0, b.elbowSwing], [0.9, 0]]),
        [P('sway')]: at(D, [[0, b.sway], [0.9, 0]]),
        [P('pelvisYaw')]: at(D, [[0, b.pelvisYaw], [0.9, 0]]),
        [P('shoulderCounter')]: at(D, [[0, b.shoulderCounter], [0.9, 0]]),
        [P('torsoSway')]: at(D, [[0, b.torsoSway], [0.9, 0]]),
        [P('heelStrike')]: at(D, [[0, b.heelStrike], [0.8, 0]]),
        [P('toeOff')]: at(D, [[0, b.toeOff], [0.8, 0]]),
        [P('swingToe')]: at(D, [[0, b.swingToe], [0.8, 0]]),
      }),
    },
    {
      id: 'reach', label: 'Reach for', frames: 48, ends: 'arm returns',
      help: 'The right arm lifts and reaches forward with the torso leaning in, holds, then comes back. Best from standing.',
      build: (b, D, k = 1) => ({
        [C('arm.pitch.R', 'amount')]: at(D, [[0, 1], [0.25, 0], [0.8, 0], [1, 1]]),
        [C('arm.pitch.R', 'offset')]: at(D, [[0, 0], [0.3, 1.35 * k], [0.7, 1.35 * k], [1, 0]]),
        [C('elbow.flex.R', 'amount')]: at(D, [[0, 1], [0.25, 0], [0.8, 0], [1, 1]]),
        [C('elbow.flex.R', 'offset')]: at(D, [[0, 0], [0.3, 0.15], [0.7, 0.15], [1, 0]]),
        [C('wrist.flex.R', 'offset')]: at(D, [[0, 0], [0.3, 0.25 * k], [0.7, 0.25 * k], [1, 0]]),
        [C('girdle.x.R', 'offset')]: at(D, [[0, 0], [0.3, 0.06 * k], [0.7, 0.06 * k], [1, 0]]),
        [C('spine2.pitch', 'offset')]: at(D, [[0, 0], [0.3, 0.12 * k], [0.7, 0.12 * k], [1, 0]]),
        [C('spine3.pitch', 'offset')]: at(D, [[0, 0], [0.3, 0.16 * k], [0.7, 0.16 * k], [1, 0]]),
        [C('head.pitch', 'offset')]: at(D, [[0, 0], [0.3, -0.12 * k], [0.7, -0.12 * k], [1, 0]]),
      }),
    },
    {
      id: 'pickup', label: 'Pick up', frames: 72, ends: 'stands again',
      help: 'Knees bend, the back tips forward and the right hand goes to the ground, then lifts it to carrying height. Best from standing.',
      build: (b, D, k = 1) => ({
        [C('pelvis.y', 'offset')]: at(D, [[0, 0], [0.35, -0.42 * k], [0.55, -0.42 * k], [0.85, 0], [1, 0]]),
        [C('pelvis.x', 'offset')]: at(D, [[0, 0], [0.35, -0.16 * k], [0.55, -0.16 * k], [0.85, 0], [1, 0]]),
        [C('spine1.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.55 * k], [0.55, 0.55 * k], [0.85, 0.05], [1, 0]]),
        [C('spine2.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.45 * k], [0.55, 0.45 * k], [0.85, 0.03], [1, 0]]),
        [C('spine3.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.25 * k], [0.55, 0.25 * k], [0.85, 0], [1, 0]]),
        [C('neck.pitch', 'offset')]: at(D, [[0, 0], [0.35, -0.3 * k], [0.55, -0.3 * k], [0.85, 0], [1, 0]]),
        [C('arm.pitch.R', 'amount')]: at(D, [[0, 1], [0.2, 0], [0.9, 0], [1, 1]]),
        [C('arm.pitch.R', 'offset')]: at(D, [[0, 0], [0.35, 1.35 * k], [0.55, 1.35 * k], [0.85, 0.5], [1, 0]]),
        [C('elbow.flex.R', 'amount')]: at(D, [[0, 1], [0.2, 0], [0.9, 0], [1, 1]]),
        [C('elbow.flex.R', 'offset')]: at(D, [[0, 0], [0.35, 0.1], [0.55, 0.1], [0.85, 1.25], [1, 0]]),
        [C('arm.pitch.L', 'amount')]: at(D, [[0, 1], [0.2, 0], [0.9, 0], [1, 1]]),
        [C('arm.pitch.L', 'offset')]: at(D, [[0, 0], [0.35, 0.5 * k], [0.55, 0.5 * k], [0.85, 0.1], [1, 0]]),
      }),
    },
    {
      id: 'trip', label: 'Trip forward', frames: 40, ends: 'recovers and walks on',
      help: 'The toe catches, the steps shorten and quicken, the body pitches forward and the arms fling up. Then the figure recovers. Use it while walking. Arm angles are measured against the leaning torso, so they go well past 90 degrees.',
      build: (b, D, k = 1) => ({
        [P('stepLength')]: at(D, [[0, b.stepLength], [0.25, b.stepLength * 0.55], [0.6, b.stepLength * 0.5], [1, b.stepLength]]),
        [P('footLift')]: at(D, [[0, b.footLift], [0.15, b.footLift * 0.15], [0.55, b.footLift * 0.3], [1, b.footLift]]),
        [CADENCE]: at(D, [[0, 1], [0.25, 1.5], [0.7, 1.3], [1, 1]]),
        [C('spine1.pitch', 'offset')]: at(D, [[0, 0], [0.3, 0.5 * k], [0.65, 0.55 * k], [1, 0]]),
        [C('spine2.pitch', 'offset')]: at(D, [[0, 0], [0.3, 0.4 * k], [0.65, 0.45 * k], [1, 0]]),
        [C('spine3.pitch', 'offset')]: at(D, [[0, 0], [0.3, 0.3 * k], [0.65, 0.3 * k], [1, 0]]),
        [C('neck.pitch', 'offset')]: at(D, [[0, 0], [0.3, -0.35 * k], [0.65, -0.3 * k], [1, 0]]),
        [C('pelvis.y', 'offset')]: at(D, [[0, 0], [0.4, -0.08 * k], [1, 0]]),
        [C('pelvis.pitch', 'offset')]: at(D, [[0, 0], [0.4, 0.15 * k], [1, 0]]),
        [C('arm.pitch.R', 'amount')]: at(D, [[0, 1], [0.2, 0], [0.8, 0], [1, 1]]),
        [C('arm.pitch.R', 'offset')]: at(D, [[0, 0], [0.35, 3.1 * k], [0.7, 2.4 * k], [1, 0]]),
        [C('arm.pitch.L', 'amount')]: at(D, [[0, 1], [0.2, 0], [0.8, 0], [1, 1]]),
        [C('arm.pitch.L', 'offset')]: at(D, [[0, 0], [0.35, 2.8 * k], [0.7, 2.1 * k], [1, 0]]),
        [C('arm.roll.R', 'offset')]: at(D, [[0, 0], [0.4, 0.5 * k], [1, 0]]),
        [C('arm.roll.L', 'offset')]: at(D, [[0, 0], [0.4, 0.5 * k], [1, 0]]),
        [C('elbow.flex.R', 'offset')]: at(D, [[0, 0], [0.4, 0.3], [1, 0]]),
        [C('elbow.flex.L', 'offset')]: at(D, [[0, 0], [0.4, 0.3], [1, 0]]),
      }),
    },
  ],
  dog: [
    {
      id: 'stop', label: 'Walk to stop', frames: 48, ends: 'stands, tail and ears still moving',
      help: 'Strides shorten and slow until the paws come together and the dog stands still. The tail and ears are set to Free running, so they carry on with their own clock after the walk has stopped.',
      free: ['dog.tail1.yaw', 'dog.tail2.yaw', 'dog.tail3.yaw', 'dog.tail1.pitch', 'dog.tail2.pitch', 'dog.tail3.pitch', 'dog.ear.flop.R', 'dog.ear.flop.L'],
      build: (b, D) => ({
        [CADENCE]: at(D, [[0, 1], [0.5, 0.7], [1, 0]]),
        [P('dogStride')]: at(D, [[0, b.dogStride], [0.8, 0]]),
        [P('dogLift')]: at(D, [[0, b.dogLift], [0.7, 0]]),
        [P('dogBob')]: at(D, [[0, b.dogBob], [0.8, 0]]),
        [P('dogFlex')]: at(D, [[0, b.dogFlex], [0.8, 0]]),
        [P('dogArch')]: at(D, [[0, b.dogArch], [0.8, 0]]),
        [P('dogTwist')]: at(D, [[0, b.dogTwist], [0.8, 0]]),
        [P('dogShoulder')]: at(D, [[0, b.dogShoulder], [0.8, 0]]),
        [P('dogHeadNod')]: at(D, [[0, b.dogHeadNod], [0.8, 0]]),
      }),
    },
    {
      id: 'reach', label: 'Reach for', frames: 48, ends: 'comes back',
      help: 'The neck stretches forward, the chest dips and the right front paw lifts and reaches out, then everything returns. Best from standing.',
      build: (b, D, k = 1) => ({
        [C('dog.neck.pitch', 'offset')]: at(D, [[0, 0], [0.3, 0.6 * k], [0.7, 0.6 * k], [1, 0]]),
        [C('dog.head.pitch', 'offset')]: at(D, [[0, 0], [0.3, -0.25 * k], [0.7, -0.25 * k], [1, 0]]),
        [C('dog.spine3.pitch', 'offset')]: at(D, [[0, 0], [0.3, 0.14 * k], [0.7, 0.14 * k], [1, 0]]),
        [C('dog.fpaw.x.R', 'offset')]: at(D, [[0, 0], [0.3, 0.3 * k], [0.7, 0.3 * k], [1, 0]]),
        [C('dog.fpaw.y.R', 'offset')]: at(D, [[0, 0], [0.3, 0.2 * k], [0.7, 0.2 * k], [1, 0]]),
        [C('dog.fpaw.pitch.R', 'offset')]: at(D, [[0, 0], [0.3, 0.35 * k], [0.7, 0.35 * k], [1, 0]]),
        [C('dog.tail1.pitch', 'offset')]: at(D, [[0, 0], [0.3, 0.2 * k], [0.7, 0.2 * k], [1, 0]]),
      }),
    },
    {
      id: 'pickup', label: 'Pick up', frames: 72, ends: 'head up again',
      help: 'The head and chest go down, the mouth opens, closes on the object and lifts it. Best from standing.',
      build: (b, D, k = 1) => ({
        [C('dog.pelvis.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.22 * k], [0.55, 0.22 * k], [0.85, 0], [1, 0]]),
        [C('dog.spine3.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.2 * k], [0.55, 0.2 * k], [0.85, 0], [1, 0]]),
        [C('dog.neck.pitch', 'offset')]: at(D, [[0, 0], [0.35, 1.2 * k], [0.55, 1.2 * k], [0.85, 0.1], [1, 0]]),
        [C('dog.head.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.3 * k], [0.55, 0.3 * k], [0.85, -0.1], [1, 0]]),
        [C('dog.jaw.open', 'offset')]: at(D, [[0, 0], [0.25, 0.1], [0.4, 0.55], [0.55, 0.55], [0.62, 0.08], [0.9, 0.08], [1, 0]]),
        [C('dog.tail1.pitch', 'offset')]: at(D, [[0, 0], [0.4, 0.3 * k], [0.8, 0.3 * k], [1, 0]]),
      }),
    },
    {
      id: 'trip', label: 'Trip forward', frames: 40, ends: 'recovers and trots on',
      help: 'The front paws catch, the steps shorten and quicken, the chest and nose dive and the hind legs kick forward. Then the dog recovers. Use it while walking or trotting.',
      build: (b, D, k = 1) => ({
        [P('dogStride')]: at(D, [[0, b.dogStride], [0.25, b.dogStride * 0.55], [0.6, b.dogStride * 0.5], [1, b.dogStride]]),
        [P('dogLift')]: at(D, [[0, b.dogLift], [0.2, b.dogLift * 0.2], [0.6, b.dogLift * 0.4], [1, b.dogLift]]),
        [CADENCE]: at(D, [[0, 1], [0.25, 1.5], [0.7, 1.3], [1, 1]]),
        [C('dog.pelvis.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.4 * k], [0.7, 0.25 * k], [1, 0]]),
        [C('dog.spine3.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.3 * k], [0.7, 0.2 * k], [1, 0]]),
        [C('dog.neck.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.7 * k], [0.7, 0.4 * k], [1, 0]]),
        [C('dog.head.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.3 * k], [1, 0]]),
        [C('dog.fpaw.x.R', 'offset')]: at(D, [[0, 0], [0.35, -0.18 * k], [0.7, -0.08 * k], [1, 0]]),
        [C('dog.fpaw.x.L', 'offset')]: at(D, [[0, 0], [0.35, -0.18 * k], [0.7, -0.08 * k], [1, 0]]),
        [C('dog.hpaw.x.R', 'offset')]: at(D, [[0, 0], [0.4, 0.12 * k], [1, 0]]),
        [C('dog.hpaw.x.L', 'offset')]: at(D, [[0, 0], [0.4, 0.12 * k], [1, 0]]),
        [C('dog.tail1.pitch', 'offset')]: at(D, [[0, 0], [0.35, 0.6 * k], [1, 0]]),
        [C('dog.ear.flop.R', 'offset')]: at(D, [[0, 0], [0.35, 0.5 * k], [1, 0]]),
        [C('dog.ear.flop.L', 'offset')]: at(D, [[0, 0], [0.35, 0.5 * k], [1, 0]]),
      }),
    },
  ],
};

// More movements (moves.js) follow the first four. Every one starts from whatever the figure is doing, so they chain.
CLIPS.human = [...CLIPS.human, ...HUMAN_MOVES];
CLIPS.dog = [...CLIPS.dog, ...DOG_MOVES];
/** The movements are shown in these groups, in this order. */
export const CLIP_GROUPS = [
  ['Pace', ['begin', 'stop', 'run', 'slow', 'speedup', 'slowdown', 'limp', 'nolimp', 'takeoff', 'land', 'trip']],
  ['Posture', ['sit', 'down', 'beg', 'kneel', 'crouch', 'standup', 'bow', 'stretch', 'playbow', 'headdown', 'rollover']],
  ['Action', ['jump', 'kick', 'throw', 'pickup', 'reach', 'point', 'tailchase', 'shake', 'bark', 'howl', 'sniff', 'peck', 'roar', 'lunge', 'rearup', 'toss']],
  ['Gesture', ['wave', 'cheer', 'shrug', 'nod', 'look', 'lookaround', 'wag', 'scratch', 'neckswing']],
];
export const groupOfClip = (id) => CLIP_GROUPS.find(([, ids]) => ids.includes(id))?.[0] || 'Other';
export const clipsFor = (rig) => CLIPS[rig] || [];
/** The movements for one figure: the human's, the dog's, or (for the other animals) the dog's that suit them and their own. */
export function clipsForFigure(fig) {
  if (fig === 'human' || fig === 'hose') return CLIPS.human;
  if (fig === 'dog' || !SPECIES_MOVES[fig]) return CLIPS.dog;
  const keep = speciesSharedIds(fig) || [];
  return [...CLIPS.dog.filter((c) => keep.includes(c.id)), ...SPECIES_MOVES[fig]];
}
const neutral = (target) => (target.endsWith(':amount') ? 1 : target === CADENCE ? 1 : 0);

/**
 * Writes a clip into lanes, starting at frame `start` and lasting D frames. Returns new lanes; the originals are untouched.
 * Each lane is anchored at the frame before the clip with whatever it held there, so nothing earlier changes.
 */
export function applyClip(lanes, clip, base, start, D = clip.frames, k = 1) {
  const out = { ...lanes };
  const built = clip.build(base, D, k);
  for (const [target, rel] of Object.entries(built)) {
    const old = out[target];
    const fallback = target.startsWith('p:') ? base[target.slice(2)] : neutral(target);
    const anchor = { t: Math.max(0, start - 1), v: laneValue(old, Math.max(0, start - 1), fallback) };
    const pts = rel.map((q) => ({ t: start + q.t, v: q.v }));
    // Chaining: a movement begins from what the lane held just before it, so it eases out of the one before (or out of a held pose) instead of jumping.
    if (start > 0 && rel[0].t === 0) pts[0] = { ...pts[0], v: anchor.v };
    out[target] = replaceSpan(old, anchor.t, start + D, start > 0 ? [anchor, ...pts] : pts);
  }
  return out;
}
