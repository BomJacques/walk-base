// Movements for the running figure and a few more actions and gestures. Written like moves.js: poses along the clip, each starting from whatever the figure is doing.
import { targetOfParam as P, CADENCE } from './automation.js';
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
