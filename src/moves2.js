// Further movements: kneel, limp, scratch and roll over, and movements for the other animals (a bird's take-off and landing, a theropod's roar, a sauropod's rear-up).
// Written like moves.js: poses along the clip, every one starting from whatever the figure is doing.
import { targetOfParam as P, targetOfChannel as C, CADENCE } from './automation.js';
import { HUMAN_MOVES, DOG_MOVES, poseBuild, at, BASE_ARMS, dSit, dDown } from './moves.js';

const kneeling = { 'pelvis.y': -0.5, 'pelvis.x': -0.04, 'foot.x.L': 0.3, 'foot.x.R': -0.42, 'foot.y.R': 0.1, 'spine1.pitch': 0.12, 'spine2.pitch': 0.1, 'spine3.pitch': 0.06, 'arm.pitch.R': 0.5, 'arm.pitch.L': 0.5, 'elbow.flex.R': 0.8, 'elbow.flex.L': 0.8 };
const limpOn = (D, v) => ({
  [CADENCE]: at(D, [[0, v ? 1 : 0.82], [0.8, v ? 0.82 : 1]]),
  [C('pelvis.roll', 'amount')]: at(D, [[0, v ? 1 : 2.6], [0.8, v ? 2.6 : 1]]), [C('pelvis.z', 'amount')]: at(D, [[0, v ? 1 : 2.2], [0.8, v ? 2.2 : 1]]),
  [C('spine2.roll', 'offset')]: at(D, [[0, v ? 0 : 0.07], [0.8, v ? 0.07 : 0]]), [C('spine3.roll', 'offset')]: at(D, [[0, v ? 0 : 0.05], [0.8, v ? 0.05 : 0]]), [C('head.roll', 'offset')]: at(D, [[0, v ? 0 : -0.05], [0.8, v ? -0.05 : 0]]),
  [C('arm.pitch.R', 'amount')]: at(D, [[0, v ? 1 : 0.3], [0.8, v ? 0.3 : 1]]), [C('pelvis.y', 'offset')]: at(D, [[0, v ? 0 : -0.03], [0.8, v ? -0.03 : 0]]),
});

HUMAN_MOVES.push(
  {
    id: 'kneel', label: 'Kneel', frames: 64, ends: 'stays kneeling',
    help: 'From standing: the left foot steps forward, the right knee goes down to the ground behind it and the body settles upright, hands on the left thigh. Stand up to rise.',
    build: poseBuild([[0.4, { 'pelvis.y': -0.2, 'foot.x.L': 0.2, 'foot.x.R': -0.3, 'foot.y.R': 0.12, 'spine1.pitch': 0.25, 'spine2.pitch': 0.2, 'spine3.pitch': 0.12, 'arm.pitch.R': 0.4, 'arm.pitch.L': 0.4, 'elbow.flex.R': 0.4, 'elbow.flex.L': 0.4 }], [1, kneeling]], { kill: BASE_ARMS, stay: true }),
  },
  {
    id: 'limp', label: 'Limp', frames: 40, ends: 'keeps limping',
    help: 'While walking: the right leg is favoured, so the hips drop and sway further on that side, the body leans over it, the pace slows and the right arm hardly swings. Walk normally undoes it.',
    build: (b, D) => ({ ...limpOn(D, true), [P('stepLength')]: at(D, [[0, b.stepLength], [0.8, b.stepLength * 0.8]]), [P('footLift')]: at(D, [[0, b.footLift], [0.8, b.footLift * 0.7]]) }),
  },
  {
    id: 'nolimp', label: 'Walk normally', frames: 40, ends: 'walks normally',
    help: 'Undoes a limp: the hips, the lean, the pace and the arm swing return to the Gait tab settings.',
    build: (b, D) => ({ ...limpOn(D, false), [P('stepLength')]: at(D, [[0, b.stepLength * 0.8], [0.8, b.stepLength]]), [P('footLift')]: at(D, [[0, b.footLift * 0.7], [0.8, b.footLift]]) }),
  },
  {
    id: 'scratch', label: 'Scratch head', frames: 56, ends: 'arm comes down',
    help: 'The right hand goes up to the head and scratches with small quick movements, the head tilting into it, then comes down.',
    build: poseBuild([0.25, 0.35, 0.45, 0.55, 0.65].map((f, i) => [f, { 'arm.pitch.R': 2.3, 'elbow.flex.R': i % 2 ? 1.8 : 2.1, 'head.roll': 0.12, 'wrist.flex.R': 0.2 }]).concat([[0.78, { 'arm.pitch.R': 2.3, 'elbow.flex.R': 2.0, 'head.roll': 0.08 }]]), { kill: ['arm.pitch.R', 'elbow.flex.R'] }),
  },
);

const scr = { ...dSit, 'dog.hpaw.x.R': 0.78, 'dog.hpaw.y.R': 0.55, 'dog.head.roll': 0.22, 'dog.head.pitch': 0.15, 'dog.neck.pitch': 0.5 };
const rolled = (k) => ({ 'dog.pelvis.roll': 1.0 * k, 'dog.spine1.roll': 0.8 * k, 'dog.spine2.roll': 0.8 * k, 'dog.spine3.roll': 0.8 * k, 'dog.neck.roll': 0.4 * k, 'dog.head.roll': 0.3 * k });
DOG_MOVES.push(
  {
    id: 'scratch', label: 'Scratch', frames: 72, ends: 'sits',
    help: 'The dog sits, lifts a hind leg to its head and scratches with quick strokes, the head tilting into it, then puts the leg down and stays sitting. It sits first if it is standing.',
    build: poseBuild([[0.3, dSit], [0.42, scr], [0.5, { ...scr, 'dog.hpaw.y.R': 0.78 }], [0.58, scr], [0.66, { ...scr, 'dog.hpaw.y.R': 0.78 }], [0.74, scr], [0.82, { ...scr, 'dog.hpaw.y.R': 0.78 }], [0.9, dSit], [1, dSit]], { stay: true }),
  },
  {
    id: 'rollover', label: 'Roll over', frames: 80, ends: 'lies on its back',
    help: 'From lying: the body twists over onto its back, the legs folded up in the air. Stand up to get up again. The roll is about the length of the body, so turn the camera to look from the front or above.',
    build: poseBuild([[0.35, { ...dDown, ...rolled(0.5), 'dog.fpaw.y.R': 0.3, 'dog.fpaw.y.L': 0.3 }], [1, { ...dDown, ...rolled(1), 'dog.pelvis.y': -0.58, 'dog.fpaw.y.R': 0.55, 'dog.fpaw.y.L': 0.55, 'dog.hpaw.y.R': 0.5, 'dog.hpaw.y.L': 0.5, 'dog.fpaw.x.R': 0.1, 'dog.fpaw.x.L': 0.1 }]], { stay: true }),
  },
);

/** Movements for the other animals. They use the dog's channels, so a theropod or a bird starts, stops and speeds up the way the dog does. */
export const SPECIES_MOVES = {
  bird: [
    {
      id: 'takeoff', label: 'Take off', frames: 56, ends: 'keeps flying',
      help: 'From walking or running: the wings open and beat harder, the body tips up and speeds forward, and the feet leave the ground and tuck up under the tail. Land brings it back down.',
      build: (b, D) => ({
        [CADENCE]: at(D, [[0, 1], [1, 1]]),
        [P('dogWingOpen')]: at(D, [[0, b.dogWingOpen], [0.25, 1], [1, 1]]), [P('dogFlap')]: at(D, [[0, b.dogFlap], [0.22, 30], [0.5, 55], [1, 55]]),
        [P('dogFlapFrames')]: at(D, [[0, b.dogFlapFrames], [0.18, b.dogFlapFrames], [0.2, 10], [1, 10]]),
        [P('dogFlight')]: at(D, [[0, b.dogFlight], [0.3, b.dogFlight], [0.78, 1], [1, 1]]),
        [P('dogTilt')]: at(D, [[0, b.dogTilt], [0.3, b.dogTilt + 10], [1, 8]]), [P('dogStride')]: at(D, [[0, b.dogStride], [1, 3.2]]),
        [P('dogNeckAngle')]: at(D, [[0, b.dogNeckAngle], [1, 16]]), [P('dogHeadAngle')]: at(D, [[0, b.dogHeadAngle], [1, 22]]), [P('dogTailAngle')]: at(D, [[0, b.dogTailAngle], [1, 8]]),
        [P('dogHeadHold')]: at(D, [[0, b.dogHeadHold], [0.5, 0], [1, 0]]),
      }),
    },
    {
      id: 'land', label: 'Land', frames: 56, ends: 'stands, wings folded',
      help: 'From flying: the wings flare and beat to slow it, the body tips up, the feet come down and reach for the ground, then the wings fold and it walks on as the Gait tab says.',
      build: (b, D) => ({
        [P('dogFlight')]: at(D, [[0, 1], [0.55, 0.92], [0.85, b.dogFlight], [1, b.dogFlight]]),
        [P('dogTilt')]: at(D, [[0, 8], [0.5, 40], [1, b.dogTilt]]), [P('dogStride')]: at(D, [[0, 3.2], [1, b.dogStride]]),
        [P('dogFlap')]: at(D, [[0, 55], [0.5, 60], [0.85, 30], [1, b.dogFlap]]), [P('dogWingOpen')]: at(D, [[0, 1], [0.85, 1], [1, b.dogWingOpen]]),
        [P('dogNeckAngle')]: at(D, [[0, 16], [1, b.dogNeckAngle]]), [P('dogHeadAngle')]: at(D, [[0, 22], [1, b.dogHeadAngle]]), [P('dogTailAngle')]: at(D, [[0, 8], [0.5, -10], [1, b.dogTailAngle]]),
        [P('dogHeadHold')]: at(D, [[0, 0], [0.9, 0], [1, b.dogHeadHold]]),
      }),
    },
    {
      id: 'peck', label: 'Peck', frames: 40, ends: 'head up',
      help: 'The head drops to the ground and pecks three times, quick and sharp, then lifts. Best from standing.',
      build: poseBuild([[0.12, { 'dog.neck.pitch': 1.0, 'dog.head.pitch': 0.3, 'dog.spine3.pitch': 0.08 }], [0.22, { 'dog.neck.pitch': 0.3 }], [0.38, { 'dog.neck.pitch': 1.05, 'dog.head.pitch': 0.3, 'dog.spine3.pitch': 0.08 }], [0.48, { 'dog.neck.pitch': 0.3 }], [0.64, { 'dog.neck.pitch': 1.0, 'dog.head.pitch': 0.3, 'dog.spine3.pitch': 0.08 }], [0.76, { 'dog.neck.pitch': 0.2 }]]),
    },
  ],
  theropod: [
    {
      id: 'roar', label: 'Roar', frames: 64, ends: 'jaw closes',
      help: 'The chest rises, the head goes back and the jaw opens wide, the head and tail trembling, then it settles.',
      build: poseBuild([[0.25, { 'dog.pelvis.pitch': -0.15, 'dog.neck.pitch': -0.55, 'dog.head.pitch': -0.75, 'dog.jaw.open': 0.75, 'dog.tail1.pitch': 0.2 }], [0.4, { 'dog.pelvis.pitch': -0.15, 'dog.neck.pitch': -0.6, 'dog.head.pitch': -0.8, 'dog.jaw.open': 0.6, 'dog.tail1.pitch': 0.2, 'dog.head.yaw': 0.05 }], [0.55, { 'dog.pelvis.pitch': -0.15, 'dog.neck.pitch': -0.55, 'dog.head.pitch': -0.75, 'dog.jaw.open': 0.78, 'dog.tail1.pitch': 0.2, 'dog.head.yaw': -0.05 }], [0.75, { 'dog.pelvis.pitch': -0.12, 'dog.neck.pitch': -0.5, 'dog.head.pitch': -0.7, 'dog.jaw.open': 0.7, 'dog.tail1.pitch': 0.15 }], [0.9, { 'dog.neck.pitch': -0.2, 'dog.jaw.open': 0.1 }]]),
    },
    {
      id: 'lunge', label: 'Lunge and bite', frames: 40, ends: 'recovers',
      help: 'The body drops and winds back, then the head and neck shoot forward with the jaw open, snapping shut, and it recovers.',
      build: poseBuild([[0.25, { 'dog.pelvis.y': -0.1, 'dog.pelvis.pitch': -0.1, 'dog.neck.pitch': -0.35, 'dog.head.pitch': -0.2, 'dog.jaw.open': 0.2, 'dog.tail1.pitch': 0.2 }], [0.45, { 'dog.pelvis.y': -0.08, 'dog.pelvis.pitch': 0.3, 'dog.neck.pitch': 0.45, 'dog.head.pitch': 0.1, 'dog.jaw.open': 0.8, 'dog.tail1.pitch': 0.3 }], [0.55, { 'dog.pelvis.pitch': 0.3, 'dog.neck.pitch': 0.45, 'dog.head.pitch': 0.1, 'dog.jaw.open': 0.02, 'dog.tail1.pitch': 0.3 }], [0.8, { 'dog.pelvis.pitch': 0.08, 'dog.neck.pitch': 0.1 }]]),
    },
  ],
  sauropod: [
    {
      id: 'rearup', label: 'Rear up', frames: 80, ends: 'comes down',
      help: 'The weight shifts back onto the hind legs, the front legs come off the ground and the neck rises to reach high, then it comes down again.',
      build: poseBuild([[0.35, { 'dog.pelvis.pitch': -0.3, 'dog.fpaw.y.R': 0.4, 'dog.fpaw.y.L': 0.4, 'dog.neck.pitch': -0.2 }], [0.6, { 'dog.pelvis.pitch': -0.5, 'dog.fpaw.y.R': 0.9, 'dog.fpaw.y.L': 0.9, 'dog.fpaw.x.R': -0.1, 'dog.fpaw.x.L': -0.1, 'dog.neck.pitch': -0.45, 'dog.head.pitch': -0.2, 'dog.hpaw.x.R': 0.08, 'dog.hpaw.x.L': 0.08 }], [0.78, { 'dog.pelvis.pitch': -0.45, 'dog.fpaw.y.R': 0.8, 'dog.fpaw.y.L': 0.8, 'dog.neck.pitch': -0.4, 'dog.head.pitch': -0.2 }]]),
    },
    {
      id: 'neckswing', label: 'Swing the neck', frames: 72, ends: 'neck straightens',
      help: 'The long neck sweeps out to one side and then the other, the head lagging behind it. The sweep is sideways, so turn the camera to look from above.',
      build: poseBuild([[0.25, { 'dog.neck.yaw': 0.7, 'dog.head.yaw': 0.3, 'dog.neck.pitch': 0.1 }], [0.55, { 'dog.neck.yaw': -0.7, 'dog.head.yaw': -0.3, 'dog.neck.pitch': -0.1 }], [0.82, { 'dog.neck.yaw': 0.3, 'dog.head.yaw': 0.15 }]]),
    },
  ],
  ceratopsian: [
    {
      id: 'headdown', label: 'Lower the head', frames: 48, ends: 'stays lowered',
      help: 'The head and horns drop and point forward, the front legs bracing, ready to charge. Stand up raises the head.',
      build: poseBuild([[1, { 'dog.neck.pitch': 0.7, 'dog.head.pitch': 0.55, 'dog.spine3.pitch': 0.08, 'dog.fpaw.x.R': -0.06, 'dog.fpaw.x.L': -0.06 }]], { stay: true }),
    },
    {
      id: 'toss', label: 'Toss the head', frames: 40, ends: 'head level',
      help: 'The head dips, then flicks up and back, as if tossing something off the horns.',
      build: poseBuild([[0.25, { 'dog.neck.pitch': 0.55, 'dog.head.pitch': 0.5 }], [0.45, { 'dog.neck.pitch': -0.6, 'dog.head.pitch': -0.5 }], [0.65, { 'dog.neck.pitch': -0.25, 'dog.head.pitch': -0.2 }]]),
    },
  ],
};
const SHARED = { bird: ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown', 'lookaround', 'wag', 'shake'], theropod: ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown', 'lookaround', 'wag', 'sniff'], sauropod: ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown', 'lookaround', 'wag', 'sniff', 'standup'], ceratopsian: ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown', 'lookaround', 'wag', 'sniff', 'standup'] };
SPECIES_MOVES.lizard = []; SPECIES_MOVES.snake = []; SPECIES_MOVES.spider = []; SPECIES_MOVES.crab = [];
SHARED.snake = ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown'];
SHARED.spider = ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown'];
SHARED.crab = ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown']; SPECIES_MOVES.plesiosaur = [];
SHARED.lizard = ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown', 'lookaround', 'wag', 'shake', 'sniff'];
SHARED.plesiosaur = ['stop', 'begin', 'turnright', 'turnleft', 'uturn', 'curve', 'straighten', 'speedup', 'slowdown', 'lookaround', 'neckswing'];
export const speciesSharedIds = (fig) => SHARED[fig] || null;
