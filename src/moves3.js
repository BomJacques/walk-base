// Movements for the running figure and a few more actions and gestures. Written like moves.js: poses along the clip, each starting from whatever the figure is doing.
import { targetOfParam as P, targetOfChannel as C, CADENCE } from './automation.js';
import { HUMAN_MOVES, DOG_MOVES, poseBuild, at, BASE_ARMS } from './moves.js';

/** Settings of a jog and a sprint, the same as the presets on the Gait tab (a run has a moment with neither foot down). */
const JOG = { stepLength: 0.9, duty: 0.46, footLift: 0.26, bob: 0.09, downPhase: 0.2, lean: 7, armSwing: 40, elbowBase: 70, elbowSwing: 8 };
const SPRINT = { stepLength: 1.35, duty: 0.28, footLift: 0.4, bob: 0.14, downPhase: 0.14, lean: 16, armSwing: 60, elbowBase: 90, elbowSwing: 12 };
const pace = (to) => (b, D) => Object.fromEntries(Object.keys(to).map((n) => [P(n), at(D, [[0, b[n]], [0.8, to[n]]])]));
/** The same pose for both arms: { 'arm.pitch': 1 } becomes the right and the left channel. */
const arms = (o) => Object.fromEntries(Object.entries(o).flatMap(([k, v]) => [[`${k}.R`, v], [`${k}.L`, v]]));

const ducked = { 'pelvis.y': -0.26, 'spine1.pitch': 0.55, 'spine2.pitch': 0.45, 'spine3.pitch': 0.3, 'neck.pitch': 0.15, 'head.pitch': 0.2, ...arms({ 'arm.pitch': 2.1, 'elbow.flex': 1.7 }) };
const guard = { 'arm.pitch.R': 1.0, 'arm.pitch.L': 1.0, 'elbow.flex.R': 1.9, 'elbow.flex.L': 1.9, 'pelvis.y': -0.05, 'spine2.pitch': 0.08 };
const salute = { 'arm.pitch.R': 1.5, 'elbow.flex.R': 2.5, 'head.pitch': -0.1, 'spine2.pitch': -0.04 };

HUMAN_MOVES.push(
  {
    id: 'jog', label: 'Jog', frames: 40, ends: 'keeps jogging',
    help: 'While walking: a steady jog. The steps lengthen, the feet are off the ground for a moment between steps, the arms bend and swing. Slow to a walk undoes it.',
    build: pace(JOG),
  },
  {
    id: 'sprint', label: 'Sprint', frames: 40, ends: 'keeps sprinting',
    help: 'While walking or jogging: a flat-out run. Long strides with a long time in the air, the body leaning well forward and the arms pumping hard. Slow to a walk undoes it.',
    build: pace(SPRINT),
  },
  {
    id: 'duck', label: 'Duck', frames: 36, ends: 'stands up again',
    help: 'Quickly down and forward with the head tucked and the arms up over it, held for a moment, then back up.',
    build: poseBuild([[0.25, ducked], [0.65, ducked]], { kill: BASE_ARMS }),
  },
  {
    id: 'punch', label: 'Punch', frames: 40, ends: 'hands come down',
    help: 'Hands up in a guard, then the right arm shoots straight out with the body behind it and snaps back.',
    build: poseBuild([[0.2, guard], [0.42, { 'arm.pitch.R': 1.55, 'arm.pitch.L': 0.8, 'elbow.flex.R': 0.05, 'elbow.flex.L': 2.0, 'pelvis.y': -0.06, 'spine1.pitch': 0.14, 'spine2.pitch': 0.16, 'pelvis.x': 0.05 }], [0.6, guard]], { kill: BASE_ARMS }),
  },
  {
    id: 'clap', label: 'Clap', frames: 48, ends: 'hands come down',
    help: 'Both hands up in front of the chest, clapping three times, a little quicker each time.',
    build: poseBuild([[0.15, arms({ 'arm.pitch': 1.15, 'elbow.flex': 1.5 })], [0.27, arms({ 'arm.pitch': 1.2, 'elbow.flex': 1.1 })], [0.37, arms({ 'arm.pitch': 1.15, 'elbow.flex': 1.55 })], [0.46, arms({ 'arm.pitch': 1.2, 'elbow.flex': 1.1 })], [0.55, arms({ 'arm.pitch': 1.15, 'elbow.flex': 1.55 })], [0.63, arms({ 'arm.pitch': 1.2, 'elbow.flex': 1.1 })], [0.72, arms({ 'arm.pitch': 1.15, 'elbow.flex': 1.4 })]], { kill: BASE_ARMS }),
  },
  {
    id: 'salute', label: 'Salute', frames: 44, ends: 'arm comes down',
    help: 'The right hand snaps up to the brow, held, then comes down crisply, the head lifting a little.',
    build: poseBuild([[0.22, salute], [0.7, salute]], { kill: ['arm.pitch.R', 'elbow.flex.R'] }),
  },
);

// Heading and path: each of these turns the direction the figure faces and walks, from wherever it points now. The path curves while the heading changes, so a quick turn is a corner and a slow one is a bend.
const slowBend = (D) => ({ [CADENCE]: at(D, [[0, 1], [0.4, 0.88], [0.8, 0.88], [1, 1]]) }); // the pace eases through the bend
const turn = (deg, from = 0.12, to = 0.85) => (b, D) => ({ ...slowBend(D), [P('heading')]: at(D, [[0, b.heading], [from, b.heading], [to, b.heading + deg], [1, b.heading + deg]]) });
const TURNS = [
  { id: 'turnright', label: 'Turn right', frames: 36, ends: 'walks the new way', help: 'While walking: turns a quarter of a turn toward you and carries on that way, so the path makes a corner. It changes Heading on the Gait tab as it goes, so it can be repeated.', build: turn(90) },
  { id: 'turnleft', label: 'Turn left', frames: 36, ends: 'walks the new way', help: 'While walking: turns a quarter of a turn away from you and carries on that way, so the path makes a corner.', build: turn(-90) },
  { id: 'uturn', label: 'U-turn', frames: 56, ends: 'walks back', help: 'Turns right round, half a turn toward you, in a wide curve, and walks back the way it came.', build: turn(180, 0.1, 0.9) },
  { id: 'curve', label: 'Walk a curve', frames: 96, ends: 'walks the new way', help: 'A long gentle bend: the heading eases round by 45 degrees toward you over the whole movement.', build: turn(45, 0.05, 0.95) },
  { id: 'straighten', label: 'Face straight on', frames: 36, ends: 'walks straight along the stage', help: 'Turns back to Heading 0, straight along the stage, by the shorter way.', build: (b, D) => { const h = ((b.heading % 360) + 540) % 360 - 180; return { ...slowBend(D), [P('heading')]: at(D, [[0, b.heading], [0.12, b.heading], [0.85, b.heading - h], [1, b.heading - h]]) }; } },
];
HUMAN_MOVES.push(...TURNS);
DOG_MOVES.push(...TURNS);

// Stumbles: the walk is thrown off and recovered. Each is a pose along the clip for the body and the arms, plus a change of pace and step, and each starts from whatever the figure is doing.
const withPace = (poses, opts, pace) => (b, D, k = 1) => ({ ...poseBuild(poses, opts)(b, D, k), ...pace(b, D) });
const fwd = (a, c, d) => ({ 'spine1.pitch': a, 'spine2.pitch': c, 'spine3.pitch': d });
HUMAN_MOVES.push(
  {
    id: 'stumble', label: 'Stumble', frames: 44, ends: 'recovers and walks on',
    help: 'While walking: a toe catches, the body pitches forward, the arms fling up and out, a quick short step saves it, then the figure straightens and carries on. Run it again from a heavy walk (Weight) for a harder stumble.',
    build: withPace([
      [0.2, { 'pelvis.y': -0.03, ...fwd(0.12, 0.1, 0.06) }],
      [0.32, { 'pelvis.y': -0.07, ...fwd(0.3, 0.24, 0.16), 'neck.pitch': -0.12, 'head.pitch': -0.1, 'arm.pitch.R': 1.9, 'arm.pitch.L': 1.7, 'elbow.flex.R': 0.4, 'elbow.flex.L': 0.4 }],
      [0.5, { 'pelvis.y': -0.04, ...fwd(0.16, 0.12, 0.08), 'arm.pitch.R': 1.1, 'arm.pitch.L': 0.9, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3, 'head.pitch': -0.05 }],
      [0.78, { ...fwd(0.04, 0.03, 0.02) }],
    ], { kill: BASE_ARMS }, (b, D) => ({
      [CADENCE]: at(D, [[0, 1], [0.3, 0.72], [0.5, 1.3], [0.8, 1], [1, 1]]),
      [P('stepLength')]: at(D, [[0, b.stepLength], [0.3, b.stepLength * 0.7], [0.5, b.stepLength * 1.2], [0.8, b.stepLength], [1, b.stepLength]]),
    })),
  },
  {
    id: 'slip', label: 'Slip', frames: 40, ends: 'regains balance',
    help: 'While walking: a foot slides out from under the figure, the hips drop, the body leans back, the arms fling out, then it finds its feet and straightens.',
    build: withPace([
      [0.2, { 'foot.x.R': 0.22, 'pelvis.y': -0.1, ...fwd(-0.1, -0.1, -0.06) }],
      [0.34, { 'foot.x.R': 0.3, 'pelvis.y': -0.17, ...fwd(-0.24, -0.18, -0.1), 'arm.pitch.R': 1.7, 'arm.pitch.L': 1.6, 'elbow.flex.R': 0.2, 'elbow.flex.L': 0.2, 'head.pitch': 0.1, 'neck.pitch': 0.08 }],
      [0.56, { 'foot.x.R': 0.1, 'pelvis.y': -0.06, ...fwd(-0.08, -0.06, -0.04), 'arm.pitch.R': 0.7, 'arm.pitch.L': 0.6, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 }],
      [0.8, { ...fwd(0.02, 0.02, 0.01) }],
    ], { kill: BASE_ARMS }, (b, D) => ({ [CADENCE]: at(D, [[0, 1], [0.3, 0.6], [0.6, 0.9], [0.85, 1], [1, 1]]) })),
  },
  {
    id: 'stagger', label: 'Stagger', frames: 72, ends: 'steadies',
    help: 'While walking: the body sways from side to side, the head rolls and the arms swing wide for balance, the steps are short and uneven, and then it steadies.',
    build: withPace([0.14, 0.28, 0.42, 0.56, 0.7].map((f, i) => { const sg = i % 2 ? -1 : 1; return [f, { 'spine2.roll': 0.16 * sg, 'spine3.roll': 0.1 * sg, 'head.roll': -0.12 * sg, 'pelvis.y': -0.02, 'arm.pitch.R': 0.5 + 0.4 * sg, 'arm.pitch.L': 0.5 - 0.4 * sg, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 }]; }).concat([[0.86, { 'spine2.roll': 0.03 }]]), { kill: BASE_ARMS }, (b, D) => ({
      [CADENCE]: at(D, [[0, 1], [0.15, 0.85], [0.75, 0.85], [1, 1]]),
      [P('stepLength')]: at(D, [[0, b.stepLength], [0.15, b.stepLength * 0.85], [0.75, b.stepLength * 0.85], [1, b.stepLength]]),
    })),
  },
);
export { C };
