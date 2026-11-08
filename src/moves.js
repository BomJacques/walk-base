// More movements, written as poses along the clip. Each movement says where chosen channels go at moments in its length (fractions 0 to 1); between them the lanes
// ease from one to the next. Every movement starts from whatever the figure is doing when it begins (see applyClip), so movements chain: a sit can follow a walk to a stop,
// and a stand up can follow a sit, a crouch or a beg, and a walk can start again after it.
import { targetOfParam as P, targetOfChannel as C, CADENCE } from './automation.js';

const at = (D, list) => list.map(([f, v]) => ({ t: Math.round(f * D), v }));
const BASE_ARMS = ['arm.pitch.R', 'arm.pitch.L', 'elbow.flex.R', 'elbow.flex.L'];

/**
 * A movement from poses. keys: [[fraction, { channel: offset, ... }], ...]. A channel a pose does not name is at 0 there.
 * `kill` lists channels whose built-in walk motion is switched off while the movement is held (their offsets then are the angles themselves).
 * `stay` leaves them off at the end, for a movement that finishes in a held pose (a sit); a later stand up switches them back on.
 */
function poseBuild(keys, { kill = [], stay = false } = {}) {
  // Unless it stays in its pose, a movement always ends by returning every channel to 0 at its last frame.
  const ks = stay || keys[keys.length - 1][0] >= 1 ? keys : [...keys, [1, {}]];
  return (b, D, k = 1) => {
    const ids = [...new Set(ks.flatMap(([, pose]) => Object.keys(pose)))];
    const out = {};
    for (const id of ids) out[C(id, 'offset')] = at(D, [[0, 0], ...ks.map(([f, pose]) => [f, (pose[id] ?? 0) * k])]);
    const last = ks[ks.length - 1][0]; const first = Math.min(0.2, ks[0][0]);
    for (const id of kill) out[C(id, 'amount')] = at(D, stay ? [[0, 1], [first, 0], [1, 0]] : [[0, 1], [first, 0], [last - 0.08, 0], [last, 1]]);
    return out;
  };
}
/** The params a walk is made of, ramped from where they are to `to(b)`; used for starting, running and slowing down. */
const ramp = (names, to, D, from = 0, end = 0.85) => Object.fromEntries(names.map((n) => [P(n), at(D, [[0, 0], [end, to(n)]])]));

// ------------------------------------------------------------------------------------------------ human
const H_WALK = ['stepLength', 'footLift', 'bob', 'armSwing', 'elbowSwing', 'sway', 'pelvisYaw', 'shoulderCounter', 'torsoSway', 'heelStrike', 'toeOff', 'swingToe'];
/** Every channel the sitting, crouching and ducking movements touch, so a stand up can return all of them to neutral. */
const H_STATE = ['pelvis.y', 'pelvis.x', 'pelvis.pitch', 'spine1.pitch', 'spine2.pitch', 'spine3.pitch', 'neck.pitch', 'head.pitch', ...BASE_ARMS, 'foot.x.R', 'foot.x.L'];

const seated = { 'pelvis.x': -0.22, 'pelvis.y': -0.52, 'spine1.pitch': 0.04, 'spine2.pitch': 0.04, 'spine3.pitch': 0.02, 'arm.pitch.R': 0.45, 'arm.pitch.L': 0.45, 'elbow.flex.R': 0.8, 'elbow.flex.L': 0.8 };
const crouched = { 'pelvis.y': -0.38, 'pelvis.x': -0.18, 'spine1.pitch': 0.5, 'spine2.pitch': 0.4, 'spine3.pitch': 0.25, 'neck.pitch': -0.35, 'arm.pitch.R': 0.5, 'arm.pitch.L': 0.5, 'elbow.flex.R': 0.5, 'elbow.flex.L': 0.5 };

export const HUMAN_MOVES = [
  {
    id: 'begin', label: 'Start walking', frames: 48, ends: 'walks on',
    help: 'From standing: the steps grow, the arms begin to swing and the body starts to bob, until it is walking as the Gait tab says. The opposite of Walk to stop.',
    build: (b, D) => ({ [CADENCE]: at(D, [[0, 0], [0.12, 0.6], [0.6, 1], [1, 1]]), ...ramp(H_WALK, (n) => b[n], D) }),
  },
  {
    id: 'sit', label: 'Sit down', frames: 64, ends: 'stays seated',
    help: 'From standing: the hips go back, the body leans forward for balance, the knees bend and the figure settles upright on a seat, hands on the thighs. Use Walk to stop first if it is walking.',
    build: poseBuild([[0.3, { 'pelvis.x': -0.12, 'pelvis.y': -0.18, 'spine1.pitch': 0.32, 'spine2.pitch': 0.24, 'spine3.pitch': 0.16, 'neck.pitch': -0.2, 'arm.pitch.R': 0.8, 'arm.pitch.L': 0.8, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 }], [0.72, { ...seated, 'spine1.pitch': 0.12, 'spine2.pitch': 0.1, 'spine3.pitch': 0.06, 'pelvis.y': -0.5, 'arm.pitch.R': 0.55, 'arm.pitch.L': 0.55, 'elbow.flex.R': 0.6, 'elbow.flex.L': 0.6 }], [1, seated]], { kill: BASE_ARMS, stay: true }),
  },
  {
    id: 'standup', label: 'Stand up', frames: 56, ends: 'stands',
    help: 'From sitting, crouching or ducking: the body leans forward to bring the weight over the feet, then rises and straightens. Everything the sit and crouch changed goes back to neutral.',
    build: (b, D, k = 1) => {
      const lean = { 'pelvis.x': -0.04 * k, 'pelvis.y': -0.34 * k, 'spine1.pitch': 0.4 * k, 'spine2.pitch': 0.3 * k, 'spine3.pitch': 0.2 * k, 'neck.pitch': -0.25 * k, 'arm.pitch.R': 0.9 * k, 'arm.pitch.L': 0.9 * k, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 };
      const out = {};
      for (const id of H_STATE) out[C(id, 'offset')] = at(D, [[0, 0], [0.32, lean[id] ?? 0], [0.78, 0.0], [1, 0]]);
      for (const id of BASE_ARMS) out[C(id, 'amount')] = at(D, [[0, 0], [0.8, 0], [1, 1]]);
      return out;
    },
  },
  {
    id: 'crouch', label: 'Crouch', frames: 40, ends: 'stays crouched',
    help: 'Knees bend, the hips drop back, the back rounds and the head comes forward, as if ducking under something or hiding. Stand up to rise. It can also be done while walking, for a sneak.',
    build: poseBuild([[1, crouched]], { kill: BASE_ARMS, stay: true }),
  },
  {
    id: 'jump', label: 'Jump', frames: 48, ends: 'lands',
    help: 'From standing: crouch with the arms back, spring up with the arms swinging overhead and the feet leaving the ground, then land and absorb it.',
    build: poseBuild([
      [0.28, { 'pelvis.y': -0.3, 'pelvis.x': -0.12, 'spine1.pitch': 0.35, 'spine2.pitch': 0.28, 'spine3.pitch': 0.18, 'neck.pitch': -0.25, 'arm.pitch.R': -0.7, 'arm.pitch.L': -0.7, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 }],
      [0.42, { 'pelvis.y': 0.34, 'foot.y.R': 0.3, 'foot.y.L': 0.3, 'spine1.pitch': -0.05, 'arm.pitch.R': 2.6, 'arm.pitch.L': 2.6, 'elbow.flex.R': 0.1, 'elbow.flex.L': 0.1 }],
      [0.56, { 'pelvis.y': 0.5, 'foot.y.R': 0.48, 'foot.y.L': 0.48, 'foot.x.R': 0.04, 'foot.x.L': -0.04, 'arm.pitch.R': 2.8, 'arm.pitch.L': 2.8, 'elbow.flex.R': 0.15, 'elbow.flex.L': 0.15 }],
      [0.74, { 'pelvis.y': -0.26, 'pelvis.x': -0.1, 'spine1.pitch': 0.3, 'spine2.pitch': 0.22, 'arm.pitch.R': 0.4, 'arm.pitch.L': 0.4, 'elbow.flex.R': 0.4, 'elbow.flex.L': 0.4 }],
    ], { kill: BASE_ARMS }),
  },
  {
    id: 'wave', label: 'Wave', frames: 56, ends: 'arm comes down',
    help: 'The right arm lifts, the forearm waves from side to side, and the arm comes down. Best from standing.',
    build: (b, D) => ({
      [C('arm.pitch.R', 'amount')]: at(D, [[0, 1], [0.14, 0], [0.86, 0], [1, 1]]),
      [C('arm.pitch.R', 'offset')]: at(D, [[0, 0], [0.22, 2.7], [0.78, 2.7], [1, 0]]),
      [C('arm.roll.R', 'offset')]: at(D, [[0, 0], [0.22, 0.5], [0.78, 0.5], [1, 0]]),
      [C('elbow.flex.R', 'amount')]: at(D, [[0, 1], [0.14, 0], [0.86, 0], [1, 1]]),
      [C('elbow.flex.R', 'offset')]: at(D, [[0, 0], [0.22, 0.9], [0.3, 1.4], [0.4, 0.55], [0.5, 1.4], [0.6, 0.55], [0.7, 1.4], [0.78, 0.9], [1, 0]]),
      [C('head.yaw', 'offset')]: at(D, [[0, 0], [0.25, -0.15], [0.75, -0.15], [1, 0]]),
    }),
  },
  {
    id: 'look', label: 'Look around', frames: 72, ends: 'looks ahead',
    help: 'The head turns left, then right, then back to the front, with the neck and shoulders following a little.',
    build: poseBuild([[0.22, { 'head.yaw': 0.8, 'neck.yaw': 0.4, 'spine3.yaw': 0.18 }], [0.5, { 'head.yaw': 0.8, 'neck.yaw': 0.4, 'spine3.yaw': 0.18 }], [0.72, { 'head.yaw': -0.8, 'neck.yaw': -0.4, 'spine3.yaw': -0.18 }], [0.88, { 'head.yaw': -0.7, 'neck.yaw': -0.35, 'spine3.yaw': -0.15 }], [1, {}]]),
  },
  {
    id: 'nod', label: 'Nod yes', frames: 32, ends: 'head level',
    help: 'Three nods.',
    build: poseBuild([[0.12, { 'head.pitch': 0.3, 'neck.pitch': 0.1 }], [0.28, { 'head.pitch': -0.08 }], [0.44, { 'head.pitch': 0.3, 'neck.pitch': 0.1 }], [0.6, { 'head.pitch': -0.08 }], [0.76, { 'head.pitch': 0.28, 'neck.pitch': 0.08 }], [1, {}]]),
  },
  {
    id: 'shake', label: 'Shake head no', frames: 32, ends: 'head level',
    help: 'The head turns from side to side three times.',
    build: poseBuild([[0.12, { 'head.yaw': 0.5, 'neck.yaw': 0.15 }], [0.28, { 'head.yaw': -0.5, 'neck.yaw': -0.15 }], [0.44, { 'head.yaw': 0.5, 'neck.yaw': 0.15 }], [0.6, { 'head.yaw': -0.5, 'neck.yaw': -0.15 }], [0.78, { 'head.yaw': 0.3 }], [1, {}]]),
  },
  {
    id: 'shrug', label: 'Shrug', frames: 36, ends: 'relaxes',
    help: 'The shoulders rise, the hands turn out, the head tilts, and everything drops again.',
    build: poseBuild([[0.35, { 'girdle.y.R': 0.05, 'girdle.y.L': 0.05, 'arm.pitch.R': 0.25, 'arm.pitch.L': 0.25, 'elbow.flex.R': 1.0, 'elbow.flex.L': 1.0, 'head.roll': 0.12, 'head.pitch': 0.05 }], [0.7, { 'girdle.y.R': 0.05, 'girdle.y.L': 0.05, 'arm.pitch.R': 0.25, 'arm.pitch.L': 0.25, 'elbow.flex.R': 1.0, 'elbow.flex.L': 1.0, 'head.roll': 0.12, 'head.pitch': 0.05 }], [1, {}]], { kill: BASE_ARMS }),
  },
  {
    id: 'stretch', label: 'Stretch up', frames: 64, ends: 'relaxes',
    help: 'The arms go up and back, the back arches, the head tips back, then the whole body relaxes.',
    build: poseBuild([[0.4, { 'arm.pitch.R': 3.0, 'arm.pitch.L': 3.0, 'elbow.flex.R': 0.1, 'elbow.flex.L': 0.1, 'spine1.pitch': -0.1, 'spine2.pitch': -0.12, 'spine3.pitch': -0.14, 'neck.pitch': -0.2, 'head.pitch': -0.15 }], [0.65, { 'arm.pitch.R': 3.0, 'arm.pitch.L': 3.0, 'elbow.flex.R': 0.1, 'elbow.flex.L': 0.1, 'spine1.pitch': -0.1, 'spine2.pitch': -0.12, 'spine3.pitch': -0.14, 'neck.pitch': -0.2, 'head.pitch': -0.15 }], [1, {}]], { kill: BASE_ARMS }),
  },
  {
    id: 'bow', label: 'Bow', frames: 64, ends: 'stands upright',
    help: 'Bends forward from the hips with the back straight, holds, and comes up.',
    build: poseBuild([[0.4, { 'pelvis.pitch': 0.5, 'spine1.pitch': 0.3, 'spine2.pitch': 0.2, 'spine3.pitch': 0.1, 'neck.pitch': 0.1, 'pelvis.x': -0.12, 'arm.pitch.R': 0.3, 'arm.pitch.L': 0.3 }], [0.65, { 'pelvis.pitch': 0.5, 'spine1.pitch': 0.3, 'spine2.pitch': 0.2, 'spine3.pitch': 0.1, 'neck.pitch': 0.1, 'pelvis.x': -0.12, 'arm.pitch.R': 0.3, 'arm.pitch.L': 0.3 }], [1, {}]], { kill: BASE_ARMS }),
  },
  {
    id: 'kick', label: 'Kick', frames: 40, ends: 'foot returns',
    help: 'Weight over the left leg, the right foot swings back and then forward through the ball, with the arms balancing. Best from standing.',
    build: poseBuild([
      [0.3, { 'foot.x.R': -0.34, 'foot.y.R': 0.18, 'pelvis.x': 0.04, 'spine1.pitch': 0.1, 'arm.pitch.L': 0.7, 'arm.pitch.R': -0.5, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 }],
      [0.55, { 'foot.x.R': 0.5, 'foot.y.R': 0.3, 'pelvis.x': 0.05, 'spine1.pitch': -0.1, 'spine2.pitch': -0.08, 'arm.pitch.L': -0.5, 'arm.pitch.R': 0.8, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 }],
      [0.72, { 'foot.x.R': 0.4, 'foot.y.R': 0.12, 'arm.pitch.R': 0.4, 'elbow.flex.R': 0.3 }],
    ], { kill: BASE_ARMS }),
  },
  {
    id: 'throw', label: 'Throw', frames: 44, ends: 'follows through',
    help: 'The right arm cocks back with the body twisting away, then whips forward overarm and follows through. Best from standing.',
    build: poseBuild([
      [0.3, { 'arm.pitch.R': -1.6, 'elbow.flex.R': 1.1, 'spine2.yaw': -0.25, 'spine3.yaw': -0.3, 'spine1.pitch': -0.05, 'arm.pitch.L': 1.0, 'elbow.flex.L': 0.3, 'pelvis.x': -0.05 }],
      [0.5, { 'arm.pitch.R': 2.4, 'elbow.flex.R': 0.15, 'spine2.yaw': 0.2, 'spine3.yaw': 0.25, 'spine1.pitch': 0.2, 'spine2.pitch': 0.1, 'arm.pitch.L': 0.2, 'pelvis.x': 0.06 }],
      [0.72, { 'arm.pitch.R': 1.0, 'elbow.flex.R': 0.3, 'spine2.yaw': 0.1, 'spine3.yaw': 0.12, 'spine1.pitch': 0.25, 'spine2.pitch': 0.15, 'pelvis.x': 0.04 }],
    ], { kill: BASE_ARMS }),
  },
  {
    id: 'point', label: 'Point', frames: 40, ends: 'arm comes down',
    help: 'The right arm swings up and straight forward, the head turns to look along it, and it comes down.',
    build: poseBuild([[0.3, { 'arm.pitch.R': 1.55, 'elbow.flex.R': 0.05, 'head.yaw': 0.12, 'spine3.yaw': 0.1 }], [0.7, { 'arm.pitch.R': 1.55, 'elbow.flex.R': 0.05, 'head.yaw': 0.12, 'spine3.yaw': 0.1 }], [1, {}]], { kill: ['arm.pitch.R', 'elbow.flex.R'] }),
  },
  {
    id: 'cheer', label: 'Cheer', frames: 56, ends: 'arms come down',
    help: 'Both arms thrown up, with two small bounces and the head back.',
    build: poseBuild([[0.2, { 'arm.pitch.R': 2.9, 'arm.pitch.L': 2.9, 'elbow.flex.R': 0.2, 'elbow.flex.L': 0.2, 'head.pitch': -0.2, 'neck.pitch': -0.1, 'pelvis.y': -0.1 }], [0.38, { 'arm.pitch.R': 3.0, 'arm.pitch.L': 3.0, 'pelvis.y': 0.12, 'foot.y.R': 0.1, 'foot.y.L': 0.1, 'head.pitch': -0.2, 'elbow.flex.R': 0.2, 'elbow.flex.L': 0.2 }], [0.5, { 'arm.pitch.R': 2.9, 'arm.pitch.L': 2.9, 'pelvis.y': -0.1, 'head.pitch': -0.2, 'elbow.flex.R': 0.2, 'elbow.flex.L': 0.2 }], [0.68, { 'arm.pitch.R': 3.0, 'arm.pitch.L': 3.0, 'pelvis.y': 0.12, 'foot.y.R': 0.1, 'foot.y.L': 0.1, 'head.pitch': -0.2, 'elbow.flex.R': 0.2, 'elbow.flex.L': 0.2 }], [0.82, { 'arm.pitch.R': 2.9, 'arm.pitch.L': 2.9, 'pelvis.y': -0.04, 'head.pitch': -0.1 }], [1, {}]], { kill: BASE_ARMS }),
  },
  {
    id: 'run', label: 'Break into a run', frames: 40, ends: 'keeps running',
    help: 'While walking: the steps lengthen and quicken, the arms pump, the body leans in and the feet leave the ground between steps. Slow to a walk undoes it.',
    build: (b, D) => ({
      [CADENCE]: at(D, [[0, 1], [0.7, 1.4], [1, 1.4]]),
      [P('stepLength')]: at(D, [[0, b.stepLength], [0.8, b.stepLength * 1.4]]),
      [P('footLift')]: at(D, [[0, b.footLift], [0.8, b.footLift * 1.7]]),
      [P('bob')]: at(D, [[0, b.bob], [0.8, b.bob * 1.8]]),
      [P('armSwing')]: at(D, [[0, b.armSwing], [0.8, b.armSwing * 1.5]]),
      [P('elbowBase')]: at(D, [[0, b.elbowBase], [0.8, Math.max(b.elbowBase, 70)]]),
      [P('lean')]: at(D, [[0, b.lean], [0.8, b.lean + 9]]),
      [P('duty')]: at(D, [[0, b.duty], [0.8, Math.min(b.duty, 0.42)]]),
    }),
  },
  {
    id: 'slow', label: 'Slow to a walk', frames: 40, ends: 'walks as the Gait tab says',
    help: 'Returns the pace, lean and arms to the walk set on the Gait tab, from a run or a quick walk.',
    build: (b, D) => ({
      [CADENCE]: at(D, [[0, 1.4], [0.8, 1]]),
      ...Object.fromEntries(['stepLength', 'footLift', 'bob', 'armSwing', 'elbowBase', 'lean', 'duty'].map((n) => [P(n), at(D, [[0, b[n]], [0.8, b[n]]])])),
    }),
    resetsParams: ['stepLength', 'footLift', 'bob', 'armSwing', 'elbowBase', 'lean', 'duty'],
  },
];

// ------------------------------------------------------------------------------------------------ dog
const D_WALK = ['dogStride', 'dogLift', 'dogBob', 'dogFlex', 'dogArch', 'dogTwist', 'dogShoulder', 'dogHeadNod'];
const D_STATE = ['dog.pelvis.y', 'dog.pelvis.pitch', 'dog.spine1.pitch', 'dog.spine2.pitch', 'dog.spine3.pitch', 'dog.neck.pitch', 'dog.head.pitch', 'dog.jaw.open',
  'dog.hpaw.x.R', 'dog.hpaw.x.L', 'dog.hpaw.y.R', 'dog.hpaw.y.L', 'dog.fpaw.x.R', 'dog.fpaw.x.L', 'dog.fpaw.y.R', 'dog.fpaw.y.L', 'dog.fpaw.pitch.R', 'dog.fpaw.pitch.L',
  'dog.tail1.pitch', 'dog.tail2.pitch', 'dog.tail3.pitch', 'dog.hleg.out.R', 'dog.hleg.out.L'];

const dSit = { 'dog.pelvis.y': -0.5, 'dog.pelvis.pitch': -0.6, 'dog.neck.pitch': 0.35, 'dog.hpaw.x.R': 0.3, 'dog.hpaw.x.L': 0.3, 'dog.tail1.pitch': -0.5, 'dog.tail2.pitch': -0.3, 'dog.tail3.pitch': -0.2 };
const dDown = { 'dog.pelvis.y': -0.62, 'dog.pelvis.pitch': -0.12, 'dog.spine3.pitch': -0.1, 'dog.neck.pitch': 0.1, 'dog.hpaw.x.R': 0.32, 'dog.hpaw.x.L': 0.32, 'dog.fpaw.x.R': 0.42, 'dog.fpaw.x.L': 0.42, 'dog.tail1.pitch': -0.5, 'dog.tail2.pitch': -0.3 };

export const DOG_MOVES = [
  {
    id: 'begin', label: 'Start walking', frames: 48, ends: 'walks on',
    help: 'From standing: the strides grow and the body begins to bob and flex, until the dog is walking as the Gait tab says. The opposite of Walk to stop.',
    build: (b, D) => ({ [CADENCE]: at(D, [[0, 0], [0.12, 0.6], [0.6, 1], [1, 1]]), ...ramp(D_WALK, (n) => b[n], D) }),
  },
  {
    id: 'sit', label: 'Sit', frames: 48, ends: 'stays sitting',
    help: 'From standing: the hind paws come forward, the hips drop to the ground and the chest lifts until the dog sits upright on its haunches, tail on the ground.',
    build: poseBuild([[0.45, { 'dog.pelvis.y': -0.3, 'dog.pelvis.pitch': -0.4, 'dog.hpaw.x.R': 0.18, 'dog.hpaw.x.L': 0.18, 'dog.neck.pitch': 0.2 }], [1, dSit]], { stay: true }),
  },
  {
    id: 'down', label: 'Lie down', frames: 64, ends: 'stays lying',
    help: 'From standing or sitting: the front paws slide forward, the chest lowers between them and the hips settle, until the dog lies in a sphinx pose with the head up.',
    build: poseBuild([[0.35, { 'dog.pelvis.y': -0.3, 'dog.pelvis.pitch': -0.3, 'dog.hpaw.x.R': 0.2, 'dog.hpaw.x.L': 0.2, 'dog.fpaw.x.R': 0.25, 'dog.fpaw.x.L': 0.25, 'dog.neck.pitch': 0.3 }], [1, dDown]], { stay: true }),
  },
  {
    id: 'standup', label: 'Stand up', frames: 48, ends: 'stands',
    help: 'From sitting, lying or begging: the front end pushes up, the hind paws draw back and the dog stands. Everything the sit, lie down and beg changed goes back to neutral.',
    build: (b, D, k = 1) => {
      const out = {};
      for (const id of D_STATE) out[C(id, 'offset')] = at(D, [[0, 0], [0.4, (id === 'dog.pelvis.pitch' ? -0.3 : id === 'dog.pelvis.y' ? -0.28 : 0) * k], [1, 0]]);
      return out;
    },
  },
  {
    id: 'beg', label: 'Sit up and beg', frames: 56, ends: 'stays begging',
    help: 'From sitting: the chest rises further and both front paws come up and fold in front of it, head tilted.',
    build: poseBuild([[0.5, { ...dSit, 'dog.pelvis.pitch': -0.8, 'dog.neck.pitch': 0.5, 'dog.fpaw.y.R': 0.4, 'dog.fpaw.y.L': 0.4, 'dog.fpaw.x.R': -0.1, 'dog.fpaw.x.L': -0.1 }], [1, { ...dSit, 'dog.pelvis.pitch': -0.9, 'dog.neck.pitch': 0.55, 'dog.head.pitch': 0.2, 'dog.fpaw.y.R': 0.65, 'dog.fpaw.y.L': 0.65, 'dog.fpaw.x.R': -0.2, 'dog.fpaw.x.L': -0.2, 'dog.fpaw.pitch.R': 0.6, 'dog.fpaw.pitch.L': 0.6 }]], { stay: true }),
  },
  {
    id: 'tailchase', label: 'Chase tail', frames: 96, ends: 'stands, head up',
    help: 'The dog curls round after its tail, snaps back the other way and curls again, stepping in small circles, then stops and looks up. Best from standing. The curl is sideways, so turn the camera to look from above or at an angle.',
    build: (b, D) => ({
      [CADENCE]: at(D, [[0, 0], [0.1, 1.2], [0.85, 1.2], [1, 0]]),
      [P('dogStride')]: at(D, [[0, 0], [0.1, 0.3], [0.85, 0.3], [1, 0]]),
      [P('dogLift')]: at(D, [[0, 0], [0.1, 0.08], [0.85, 0.08], [1, 0]]),
      ...Object.fromEntries([['dog.spine1.yaw', 0.28], ['dog.spine2.yaw', 0.3], ['dog.spine3.yaw', 0.3], ['dog.neck.yaw', 0.45], ['dog.head.yaw', 0.4], ['dog.tail1.yaw', -0.55], ['dog.tail2.yaw', -0.55], ['dog.tail3.yaw', -0.5]]
        .map(([id, a]) => [C(id, 'offset'), at(D, [[0, 0], [0.16, a], [0.3, a], [0.4, -a * 0.9], [0.52, -a * 0.9], [0.62, a], [0.74, a], [0.82, -a * 0.6], [1, 0]])])),
      [C('dog.pelvis.pitch', 'offset')]: at(D, [[0, 0], [0.16, 0.12], [0.85, 0.12], [1, 0]]),
      [C('dog.jaw.open', 'offset')]: at(D, [[0, 0], [0.3, 0.3], [0.34, 0], [0.52, 0.3], [0.56, 0], [0.74, 0.3], [0.78, 0], [1, 0]]),
    }),
  },
  {
    id: 'sniff', label: 'Sniff the ground', frames: 72, ends: 'head up',
    help: 'The head drops to the ground and the nose works along it in small quick movements, then lifts.',
    build: poseBuild([[0.22, { 'dog.neck.pitch': 1.15, 'dog.head.pitch': 0.3, 'dog.spine3.pitch': 0.15, 'dog.pelvis.pitch': 0.1 }], [0.32, { 'dog.neck.pitch': 1.15, 'dog.head.pitch': 0.38, 'dog.spine3.pitch': 0.15, 'dog.pelvis.pitch': 0.1 }], [0.42, { 'dog.neck.pitch': 1.2, 'dog.head.pitch': 0.26, 'dog.spine3.pitch': 0.15, 'dog.pelvis.pitch': 0.1 }], [0.52, { 'dog.neck.pitch': 1.15, 'dog.head.pitch': 0.4, 'dog.head.yaw': 0.2, 'dog.spine3.pitch': 0.15, 'dog.pelvis.pitch': 0.1 }], [0.62, { 'dog.neck.pitch': 1.18, 'dog.head.pitch': 0.28, 'dog.head.yaw': -0.2, 'dog.spine3.pitch': 0.15, 'dog.pelvis.pitch': 0.1 }], [0.76, { 'dog.neck.pitch': 1.1, 'dog.head.pitch': 0.34, 'dog.spine3.pitch': 0.15, 'dog.pelvis.pitch': 0.1 }], [1, {}]]),
  },
  {
    id: 'bark', label: 'Bark', frames: 36, ends: 'mouth closes',
    help: 'Three barks: the head jerks up and back, the mouth snaps open and shut, and the body recoils a little each time.',
    build: poseBuild([
      [0.1, { 'dog.neck.pitch': -0.3, 'dog.head.pitch': -0.25, 'dog.jaw.open': 0.55 }], [0.2, { 'dog.neck.pitch': -0.1, 'dog.jaw.open': 0.05 }],
      [0.4, { 'dog.neck.pitch': -0.3, 'dog.head.pitch': -0.25, 'dog.jaw.open': 0.55 }], [0.5, { 'dog.neck.pitch': -0.1, 'dog.jaw.open': 0.05 }],
      [0.7, { 'dog.neck.pitch': -0.3, 'dog.head.pitch': -0.25, 'dog.jaw.open': 0.55 }], [0.82, { 'dog.neck.pitch': -0.1 }], [1, {}],
    ]),
  },
  {
    id: 'howl', label: 'Howl', frames: 72, ends: 'head comes down',
    help: 'The nose points to the sky, the mouth opens in a long oval, and the head sways slightly before lowering.',
    build: poseBuild([[0.3, { 'dog.neck.pitch': -0.65, 'dog.head.pitch': -0.75, 'dog.jaw.open': 0.35, 'dog.tail1.pitch': 0.15 }], [0.6, { 'dog.neck.pitch': -0.7, 'dog.head.pitch': -0.85, 'dog.jaw.open': 0.3, 'dog.tail1.pitch': 0.15, 'dog.head.yaw': 0.1 }], [0.8, { 'dog.neck.pitch': -0.55, 'dog.head.pitch': -0.6, 'dog.jaw.open': 0.1 }], [1, {}]]),
  },
  {
    id: 'jump', label: 'Leap', frames: 44, ends: 'lands',
    help: 'From standing: the dog crouches on the hind legs, springs up with the front legs reaching and the head up, and lands front paws first.',
    build: poseBuild([
      [0.28, { 'dog.pelvis.y': -0.22, 'dog.pelvis.pitch': 0.1, 'dog.neck.pitch': 0.25, 'dog.spine3.pitch': 0.1, 'dog.hpaw.x.R': -0.08, 'dog.hpaw.x.L': -0.08 }],
      [0.5, { 'dog.pelvis.y': 0.3, 'dog.pelvis.pitch': -0.45, 'dog.neck.pitch': -0.25, 'dog.hpaw.y.R': 0.25, 'dog.hpaw.y.L': 0.25, 'dog.hpaw.x.R': -0.18, 'dog.hpaw.x.L': -0.18, 'dog.fpaw.y.R': 0.4, 'dog.fpaw.y.L': 0.4, 'dog.fpaw.x.R': 0.25, 'dog.fpaw.x.L': 0.25, 'dog.tail1.pitch': 0.3 }],
      [0.7, { 'dog.pelvis.y': 0.08, 'dog.pelvis.pitch': -0.1, 'dog.hpaw.y.R': 0.08, 'dog.hpaw.y.L': 0.08, 'dog.fpaw.y.R': 0.08, 'dog.fpaw.y.L': 0.08, 'dog.fpaw.x.R': 0.15, 'dog.fpaw.x.L': 0.15 }],
      [0.84, { 'dog.pelvis.y': -0.12, 'dog.neck.pitch': 0.15, 'dog.spine3.pitch': 0.08 }],
    ]),
  },
  {
    id: 'shake', label: 'Shake off', frames: 44, ends: 'settles',
    help: 'The body twists quickly from side to side along its length, the head and tail whipping the other way, and the ears flap, then it settles. The twist is sideways, so turn the camera to look from above or at an angle.',
    build: (b, D) => ({
      ...Object.fromEntries([['dog.spine1.yaw', 0.3], ['dog.spine2.yaw', 0.25], ['dog.spine3.yaw', 0.25], ['dog.neck.yaw', -0.25], ['dog.head.yaw', -0.3], ['dog.tail1.yaw', -0.4], ['dog.tail2.yaw', -0.4]]
        .map(([id, a]) => [C(id, 'offset'), at(D, [[0, 0], [0.1, a], [0.2, -a], [0.3, a], [0.4, -a], [0.5, a], [0.6, -a], [0.7, a * 0.7], [0.8, -a * 0.5], [0.9, a * 0.2], [1, 0]])])),
      [C('dog.pelvis.y', 'offset')]: at(D, [[0, 0], [0.1, -0.03], [0.9, -0.03], [1, 0]]),
      ...Object.fromEntries(['dog.ear.flop.R', 'dog.ear.flop.L'].map((id) => [C(id, 'offset'), at(D, [[0, 0], [0.1, 0.8], [0.2, -0.5], [0.3, 0.8], [0.4, -0.5], [0.5, 0.8], [0.6, -0.5], [0.7, 0.5], [1, 0]])])),
    }),
  },
  {
    id: 'playbow', label: 'Play bow', frames: 48, ends: 'stands',
    help: 'The front legs stretch forward and the chest drops to the ground while the hips stay up and the tail wags: the invitation to play.',
    build: poseBuild([[0.45, { 'dog.pelvis.pitch': 0.35, 'dog.spine3.pitch': 0.1, 'dog.neck.pitch': -0.2, 'dog.fpaw.x.R': 0.3, 'dog.fpaw.x.L': 0.3, 'dog.tail1.pitch': 0.5, 'dog.jaw.open': 0.2 }], [0.7, { 'dog.pelvis.pitch': 0.38, 'dog.spine3.pitch': 0.1, 'dog.neck.pitch': -0.2, 'dog.fpaw.x.R': 0.3, 'dog.fpaw.x.L': 0.3, 'dog.tail1.pitch': 0.5, 'dog.jaw.open': 0.2 }], [1, {}]]),
  },
  {
    id: 'lookaround', label: 'Look around', frames: 72, ends: 'looks ahead',
    help: 'The head and neck turn left, then right, then front, with the ears following.',
    build: poseBuild([[0.22, { 'dog.head.yaw': 0.7, 'dog.neck.yaw': 0.5, 'dog.spine3.yaw': 0.1 }], [0.5, { 'dog.head.yaw': 0.7, 'dog.neck.yaw': 0.5, 'dog.spine3.yaw': 0.1 }], [0.72, { 'dog.head.yaw': -0.7, 'dog.neck.yaw': -0.5, 'dog.spine3.yaw': -0.1 }], [0.88, { 'dog.head.yaw': -0.6, 'dog.neck.yaw': -0.4 }], [1, {}]]),
  },
  {
    id: 'wag', label: 'Excited tail wag', frames: 48, ends: 'wag settles',
    help: 'The wag widens and the whole back end sways with it, then calms. Use it on any movement.',
    build: (b, D) => ({ [P('dogWag')]: at(D, [[0, b.dogWag], [0.2, Math.min(60, b.dogWag * 2.4)], [0.75, Math.min(60, b.dogWag * 2.4)], [1, b.dogWag]]), [C('dog.pelvis.yaw', 'offset')]: at(D, [[0, 0], [0.2, 0.06], [0.3, -0.06], [0.4, 0.06], [0.5, -0.06], [0.6, 0.06], [0.7, -0.06], [1, 0]]) }),
  },
  {
    id: 'speedup', label: 'Speed up', frames: 40, ends: 'keeps the faster pace',
    help: 'While walking: the strides lengthen and quicken, the paws lift higher and the body bobs more. Slow down undoes it.',
    build: (b, D) => ({
      [CADENCE]: at(D, [[0, 1], [0.7, 1.4], [1, 1.4]]),
      [P('dogStride')]: at(D, [[0, b.dogStride], [0.8, b.dogStride * 1.5]]), [P('dogLift')]: at(D, [[0, b.dogLift], [0.8, b.dogLift * 1.4]]), [P('dogBob')]: at(D, [[0, b.dogBob], [0.8, b.dogBob * 1.6]]),
    }),
  },
  {
    id: 'slowdown', label: 'Slow down', frames: 40, ends: 'back to the Gait tab pace',
    help: 'Returns the pace to what the Gait tab says.',
    build: (b, D) => ({ [CADENCE]: at(D, [[0, 1.4], [0.8, 1]]), ...Object.fromEntries(['dogStride', 'dogLift', 'dogBob'].map((n) => [P(n), at(D, [[0, b[n]], [0.8, b[n]]])])) }),
  },
];
