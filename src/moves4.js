// More movements for the person: gait variants (tiptoe, march, crouch walk), a spin, a dance and gestures (think, facepalm, hands up, yawn, shiver) and actions (dodge, push).
// Written like moves3.js: poses along the clip, each starting from whatever the figure is doing, and ending back in the walk unless it says otherwise.
import { targetOfParam as P, targetOfChannel as C } from './automation.js';
import { HUMAN_MOVES, poseBuild, at, BASE_ARMS } from './moves.js';

const TAU = Math.PI * 2;
/** The same pose for both arms: { 'arm.pitch': 1 } becomes the right and the left channel. */
const arms = (o) => Object.fromEntries(Object.entries(o).flatMap(([k, v]) => [[`${k}.R`, v], [`${k}.L`, v]]));
/** Gait settings that move to new values, hold, and come back: { name: value } or { name: (base) => value }. */
const tempo = (to, a = 0.15, z = 0.85) => (b, D) => Object.fromEntries(Object.entries(to).map(([n, v]) => { const t = typeof v === 'function' ? v(b[n], b) : v; return [P(n), at(D, [[0, b[n]], [a, t], [z, t], [1, b[n]]])]; }));
const both = (...fs) => (b, D, k = 1) => Object.assign({}, ...fs.map((f) => f(b, D, k)));
const beats = (n, a, b, t0 = 0.08, t1 = 0.9) => Array.from({ length: n }, (_, i) => [t0 + ((t1 - t0) * i) / (n - 1), i % 2 ? b : a]);

const tipToe = { 'foot.pitch.R': -0.5, 'foot.pitch.L': -0.5, 'pelvis.y': 0.035, 'spine1.pitch': -0.04, ...arms({ 'elbow.flex': 0.5 }) };
const lowWalk = { 'pelvis.y': -0.22, 'spine1.pitch': 0.3, 'spine2.pitch': 0.25, 'spine3.pitch': 0.15, 'neck.pitch': -0.15, 'head.pitch': -0.1, ...arms({ 'elbow.flex': 0.9 }) };
const thinking = { 'arm.pitch.R': 0.95, 'elbow.flex.R': 2.65, 'arm.pitch.L': 0.45, 'elbow.flex.L': 1.9, 'head.pitch': 0.12, 'head.roll': 0.1, 'spine2.pitch': 0.04 };
const facepalm = { 'arm.pitch.R': 1.5, 'elbow.flex.R': 2.75, 'head.pitch': 0.3, 'spine2.pitch': 0.1, 'spine3.pitch': 0.08 };
const surrender = { ...arms({ 'arm.pitch': 2.7, 'elbow.flex': 0.5 }), 'head.pitch': -0.05 };
const yawning = { ...arms({ 'arm.pitch': 2.4, 'elbow.flex': 0.3 }), 'spine2.pitch': -0.15, 'spine3.pitch': -0.1, 'head.pitch': -0.3, 'neck.pitch': -0.1 };
const dodging = { 'pelvis.y': -0.1, 'pelvis.x': -0.08, 'spine1.roll': 0.25, 'spine2.roll': 0.2, 'head.roll': -0.15, ...arms({ 'arm.pitch': 0.9, 'elbow.flex': 1.5 }) };
const pushing = { ...arms({ 'arm.pitch': 1.55, 'elbow.flex': 0.15 }), 'spine1.pitch': 0.14, 'spine2.pitch': 0.12, 'pelvis.x': 0.05, 'pelvis.y': -0.03 };

HUMAN_MOVES.push(
  {
    id: 'tiptoe', label: 'Tiptoe', frames: 96, ends: 'walks as before',
    help: 'While walking: the heels stay up, the steps shorten and the feet barely lift, the arms bend. Held, then back to the walk.',
    build: both(poseBuild([[0.15, tipToe], [0.85, tipToe]]), tempo({ stepLength: (v) => v * 0.7, footLift: (v) => v * 0.6, bob: (v) => v * 0.5 })),
  },
  {
    id: 'march', label: 'March', frames: 96, ends: 'walks as before',
    help: 'While walking: high, even steps with the knees lifted, the arms bent at a right angle and swinging stiffly. Held, then back to the walk.',
    build: tempo({ footLift: 0.3, stepLength: 0.75, armSwing: 45, elbowBase: 85, elbowSwing: 3, bob: 0.03, torsoSway: 0, duty: 0.6 }),
  },
  {
    id: 'crouchwalk', label: 'Crouch walk', frames: 96, ends: 'walks as before',
    help: 'While walking: down low and forward, the knees well bent and the steps shorter, as if keeping out of sight. Held, then back up.',
    build: both(poseBuild([[0.2, lowWalk], [0.85, lowWalk]]), tempo({ stepLength: (v) => v * 0.7, bob: 0.02 })),
  },
  {
    id: 'spin', label: 'Spin', frames: 48, ends: 'facing the same way',
    help: 'A full turn on the spot about the body\'s upright, quick at the start and easing out, the arms out for balance.',
    build: (b, D) => ({ [C('pelvis.yaw', 'offset')]: at(D, [[0, 0], [0.12, 0], [0.8, TAU], [(D - 1) / D, TAU], [1, 0]]), ...Object.fromEntries(BASE_ARMS.map((id) => [C(id, 'offset'), at(D, [[0, 0], [0.15, id.startsWith('arm') ? 1.2 : 0.2], [0.85, id.startsWith('arm') ? 1.2 : 0.2], [1, 0]])])) }),
  },
  {
    id: 'dance', label: 'Dance', frames: 96, ends: 'stops dancing',
    help: 'A bouncing sway on the beat: the hips swing from side to side, the shoulders answer, the arms pump alternately and the head bobs. Eight beats, then it settles.',
    build: poseBuild([...beats(9, { 'pelvis.roll': 0.12, 'spine2.roll': -0.1, 'head.roll': 0.1, 'pelvis.y': -0.03, 'arm.pitch.R': 2.0, 'arm.pitch.L': 0.4, 'elbow.flex.R': 1.2, 'elbow.flex.L': 1.0 }, { 'pelvis.roll': -0.12, 'spine2.roll': 0.1, 'head.roll': -0.1, 'pelvis.y': 0.0, 'arm.pitch.R': 0.4, 'arm.pitch.L': 2.0, 'elbow.flex.R': 1.0, 'elbow.flex.L': 1.2 })], { kill: BASE_ARMS }),
  },
  {
    id: 'think', label: 'Think', frames: 72, ends: 'arm comes down',
    help: 'The right hand comes up to the chin, the other arm across the body, the head tipped to one side, held while it thinks.',
    build: poseBuild([[0.25, thinking], [0.75, thinking]], { kill: BASE_ARMS }),
  },
  {
    id: 'facepalm', label: 'Facepalm', frames: 56, ends: 'arm comes down',
    help: 'The right hand slaps up to the face, the head drops into it and the shoulders slump, held, then it lets go.',
    build: poseBuild([[0.25, facepalm], [0.78, facepalm]], { kill: ['arm.pitch.R', 'elbow.flex.R'] }),
  },
  {
    id: 'handsup', label: 'Hands up', frames: 48, ends: 'arms come down',
    help: 'Both hands thrown up beside the head, held, then lowered.',
    build: poseBuild([[0.22, surrender], [0.75, surrender]], { kill: BASE_ARMS }),
  },
  {
    id: 'yawn', label: 'Yawn and stretch', frames: 72, ends: 'relaxes',
    help: 'The arms go up, the back arches and the head tips back, held, then everything slumps and relaxes.',
    build: poseBuild([[0.3, yawning], [0.6, yawning], [0.78, { 'spine2.pitch': 0.12, 'head.pitch': 0.15 }]], { kill: BASE_ARMS }),
  },
  {
    id: 'shiver', label: 'Shiver', frames: 48, ends: 'stops shivering',
    help: 'Arms hugged in and shoulders hunched, the whole body trembling in quick small shakes, then it settles.',
    build: poseBuild([...beats(15, { 'pelvis.roll': 0.05, 'spine2.roll': -0.05, 'head.roll': 0.06, 'pelvis.y': -0.015, ...arms({ 'arm.pitch': 0.45, 'elbow.flex': 2.0 }) }, { 'pelvis.roll': -0.05, 'spine2.roll': 0.05, 'head.roll': -0.06, 'pelvis.y': 0.0, ...arms({ 'arm.pitch': 0.5, 'elbow.flex': 2.1 }) }, 0.1, 0.85)], { kill: BASE_ARMS }),
  },
  {
    id: 'dodge', label: 'Dodge', frames: 32, ends: 'recovers',
    help: 'A quick duck to one side with the body bent away and the arms up, then it recovers.',
    build: poseBuild([[0.3, dodging], [0.55, { ...dodging, 'pelvis.x': -0.06 }]], { kill: BASE_ARMS }),
  },
  {
    id: 'push', label: 'Push', frames: 64, ends: 'arms come down',
    help: 'Both arms straight out in front and the body leaning into them, held as if against something heavy, then it lets go.',
    build: poseBuild([[0.25, pushing], [0.75, pushing]], { kill: BASE_ARMS }),
  },
);
