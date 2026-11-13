import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, cycleFrames } from '../src/rig.js';
import { poseFor } from '../src/keyposes.js';
import { CONTROLS, PRESETS_SPECIES, presetsForFigure } from '../src/controls.js';
import { SPECIES } from '../src/dogdefaults.js';
import { legsOf } from '../src/dog3.js';
import { wordsFor } from '../src/words.js';
import { integrate } from '../src/automation.js';

const mk = (pr, extra = {}) => { const { camYaw, camPitch, ...p } = pr; return { ...DEFAULTS, rig: 'dog', motion: {}, ...p, ...extra }; };
const presets = Object.entries(PRESETS_SPECIES).flatMap(([sp, set]) => Object.entries(set).map(([name, pr]) => [`${sp} ${name}`, pr]));

test('every species has complete bones and the presets name their species', () => {
  for (const [id, s] of Object.entries(SPECIES)) {
    assert.ok([0, 2, 4, 6, 8].includes(s.legs), id);
    assert.ok(['leg', 'arm', 'wing'].includes(s.front), id);
    for (const k of Object.keys(s.bones)) assert.ok(Array.isArray(s.bones[k]) ? s.bones[k].every((v) => v > 0) : s.bones[k] >= 0, `${id}.${k}`);
    assert.ok(s.view.zoom > 0 && s.look.body > 0);
  }
  for (const [sp, set] of Object.entries(PRESETS_SPECIES)) for (const [n, pr] of Object.entries(set)) assert.equal(pr.dogSpecies, sp, `${sp} ${n}`);
  assert.equal(presetsForFigure('bird'), PRESETS_SPECIES.bird);
});

test('every preset value is inside its control range', () => {
  const by = Object.fromEntries(CONTROLS.filter((c) => c.scope === 'p').map((c) => [c.id, c]));
  for (const [name, pr] of presets) for (const [k, v] of Object.entries(pr)) {
    if (k === 'dogSpecies' || k === 'camYaw' || k === 'camPitch') continue;
    const c = by[k]; assert.ok(c, `${name}: ${k} has no control`);
    if (c.type === 'number') assert.ok(v >= c.min && v <= c.max, `${name}: ${k}=${v} outside ${c.min}..${c.max}`);
    if (c.type === 'enum') assert.ok(c.options.includes(v), `${name}: ${k}=${v}`);
  }
});

test('every preset gives finite poses with the feet on the ground and the limbs reaching', () => {
  for (const [name, pr] of presets) {
    if (/Flapping/.test(name)) continue;
    const p = mk(pr); const T = cycleFrames(p).frames.length;
    for (let f = 0; f < T; f++) {
      const z = poseFor(p, f);
      for (const q of [z.pelvis, z.headC, z.noseTip, z.tail[3], ...Object.values(z.legs).flatMap((l) => [l.root, l.mid, l.wrist, l.paw, l.toe])]) assert.ok(q.every(Number.isFinite), `${name} ${f}`);
      for (const k of legsOf(p)) { const l = z.legs[k]; assert.ok(l.reached, `${name} ${k} reaches at ${f}`); if (l.stance) assert.ok(l.paw[1] < 0.09, `${name} ${k} planted at ${f}: ${l.paw[1]}`); }
      assert.ok(Object.values(z.legs).every((l) => l.toe[1] > -0.02), `${name} nothing below ground at ${f}`);
    }
  }
});

test('two-legged figures plant two feet and leave the arms free', () => {
  for (const sp of ['theropod', 'bird']) {
    const p = mk(PRESETS_SPECIES[sp].Walk); const T = cycleFrames(p).frames.length; let both = 0;
    assert.deepEqual(legsOf(p), ['HR', 'HL']);
    for (let f = 0; f < T; f++) { const z = poseFor(p, f); assert.ok(!z.legs.FR.stance && !z.legs.FL.stance && z.legs.FR.free, sp); if (z.legs.HR.stance && z.legs.HL.stance) both++; assert.ok(z.legs.HR.stance || z.legs.HL.stance, `${sp} always has a foot down`); }
    assert.ok(both > 0, `${sp} has a double support`);
  }
  assert.deepEqual(legsOf(mk(PRESETS_SPECIES.sauropod.Walk)), ['HR', 'HL', 'FR', 'FL']);
});

test('a running theropod has a flight phase; a walking one does not', () => {
  const air = (pr) => { const p = mk(pr); const T = cycleFrames(p).frames.length; let n = 0; for (let f = 0; f < T; f++) { const z = poseFor(p, f); if (!z.legs.HR.stance && !z.legs.HL.stance) n++; } return n; };
  assert.ok(air(PRESETS_SPECIES.theropod.Run) > 0); assert.equal(air(PRESETS_SPECIES.theropod.Walk), 0);
});

test('a bird holds its head still in space while the body moves under it', () => {
  const run = (hold) => { const p = mk(PRESETS_SPECIES.bird.Walk, { dogHeadHold: hold }); const T = cycleFrames(p).frames.length; const hx = []; for (let f = 0; f <= T; f++) { const z = poseFor(p, f % T); hx.push(z.headC[0] + z.pelvisX + (f === T ? p.dogStride : 0)); } return hx; };
  const still = (hx) => hx.slice(1).filter((x, i) => Math.abs(x - hx[i]) < 0.02).length;
  assert.ok(still(run(1)) > still(run(0)) + 5, `${still(run(1))} vs ${still(run(0))}`);
});

test('wings fold, spread and beat', () => {
  const wrist = (o) => poseFor(mk(PRESETS_SPECIES.bird.Walk, o), 4).legs.FR.wrist;
  assert.ok(Math.abs(wrist({ dogWingOpen: 1 })[2]) > Math.abs(wrist({ dogWingOpen: 0 })[2]) + 0.2, 'spread wing is out to the side');
  const up = (f) => poseFor(mk(PRESETS_SPECIES.bird.Flapping), f).legs.FR.wrist[1]; const ys = Array.from({ length: 12 }, (_, f) => up(f));
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.2, 'the wing beats');
});

test('the dog is unchanged', () => {
  const p = mk({}); const z = poseFor(p, 0);
  assert.equal(Object.values(z.legs).filter((l) => l.free).length, 0); assert.equal(legsOf(p).length, 4);
});

test('a flying bird is off the ground with its feet tucked, and its wings beat with the tips trailing', () => {
  const p = mk(PRESETS_SPECIES.bird.Flying); const T = cycleFrames(p).frames.length;
  const walk = poseFor(mk(PRESETS_SPECIES.bird.Walk), 0);
  let minToe = 9; let minHip = 9; let maxHip = -9; const tips = []; const wr = [];
  for (let f = 0; f < T; f++) {
    const z = poseFor(p, f);
    for (const k of ['HR', 'HL']) { assert.ok(!z.legs[k].stance, 'no foot is planted in flight'); assert.ok(z.legs[k].reached, `${k} reaches at ${f}`); minToe = Math.min(minToe, z.legs[k].toe[1]); }
    minHip = Math.min(minHip, z.pelvis[1]); maxHip = Math.max(maxHip, z.pelvis[1]); wr.push(z.legs.FR.wrist[1]); tips.push(z.legs.FR.paw[1] - z.legs.FR.wrist[1]);
  }
  assert.ok(minToe > 0.5, `feet stay clear of the ground: ${minToe}`);
  assert.ok(minHip > walk.pelvis[1] + 0.6, 'the body flies above its standing height');
  assert.ok(maxHip - minHip > 0.03, 'the body rises and sinks with the wing beat');
  assert.ok(Math.max(...wr) - Math.min(...wr) > 0.3, 'the wing beats');
  assert.ok(Math.max(...tips) - Math.min(...tips) > 0.1, 'the wing tip trails the beat');
  // body is lowest when the wing is highest
  const hi = wr.indexOf(Math.max(...wr)); const lo = Array.from({ length: T }, (_, f) => poseFor(p, f).pelvis[1]); assert.ok(lo[hi] <= Math.min(...lo) + 0.02, 'lowest with the wings up');
  const glide = mk(PRESETS_SPECIES.bird.Gliding); const gw = Array.from({ length: 12 }, (_, f) => poseFor(glide, f * 4).legs.FR.wrist[1]);
  assert.ok(Math.max(...gw) - Math.min(...gw) < 0.2, 'gliding barely moves the wings');
});

test('labels are rewritten for each figure and controls that do not apply are left out', () => {
  const bird = wordsFor('bird'); const ther = wordsFor('theropod'); const dog = wordsFor('dog');
  assert.equal(bird('Dog stride'), 'Bird stride'); assert.equal(bird('Paw lift'), 'Foot lift'); assert.equal(bird('Paws width'), 'Feet width');
  assert.equal(bird('Front paw'), 'Wing tip'); assert.equal(bird('Front legs'), 'Wings'); assert.equal(ther('Front leg and elbow'), 'Arm and elbow'); assert.equal(ther('Dog gait'), 'Theropod gait');
  assert.equal(wordsFor('sauropod')('Hind paw'), 'Hind foot'); assert.equal(dog('Dog stride'), 'Dog stride');
  const by = Object.fromEntries(CONTROLS.map((c) => [c.id, c]));
  assert.ok(dog.hides(by.dogWingOpen) && dog.hides(by.dogFlight) && !dog.hides(by.dogEar));
  assert.ok(bird.hides(by.dogEar) && !bird.hides(by.dogFlight) && !bird.hides(by.dogHeadHold));
  assert.ok(ther.hides(by.dogWingOpen) && !ther.hides(by.dogArmSwing) && !ther.hides(by.dogCurl) && ther.hides(by.dogShoulder));
  assert.ok(bird.hidesPart('dog.ear') && !dog.hidesPart('dog.ear'));
  for (const c of CONTROLS.filter((x) => /\bDog\b|\bdog\b|\bpaws?\b/i.test(`${x.label} ${x.group} ${x.help}`))) for (const f of ['bird', 'theropod', 'sauropod', 'ceratopsian']) {
    const w = wordsFor(f); assert.ok(!/\bdog\b|\bpaws?\b/i.test(`${w(c.label)} ${w(c.group)} ${w(c.help)}`), `${f}: "${w(c.label)}" still says dog or paw`);
  }
});

test('the wing beat has a clock of its own: it carries on when the walk has stopped, if Frames per wing beat is set', () => {
  const still = { cadence: { pts: [{ t: 0, v: 0 }] } };
  const run = (frames) => {
    const base = mk(PRESETS_SPECIES.bird.Flying, { dogFlapFrames: frames }); const T = 40;
    const s = integrate(base, still, T, Math.round(base.cycleFrames), null);
    const p = { ...base, perf: { T, u: s.u, x: s.x, plants: [], lanes: still, live: null } };
    return Array.from({ length: T }, (_, f) => poseFor(p, f).legs.FR.wrist[1]);
  };
  const free = run(8); const tied = run(0);
  assert.ok(Math.max(...free) - Math.min(...free) > 0.3, 'beats on its own clock with the walk stopped');
  assert.ok(Math.max(...tied) - Math.min(...tied) < 1e-6, 'tied to the walk cycle it stands still with the walk');
  const period = free.findIndex((v, i) => i > 2 && Math.abs(v - free[0]) < 1e-6 && Math.abs(free[i + 1] - free[1]) < 1e-6);
  assert.equal(period, 8, 'one beat takes 8 frames');
});

test('a flying bird has feathers: its wing shapes include separate quills', async () => {
  const { buildDogShapes } = await import('../src/dogdraw.js');
  const cam = { scale: 100, p: (pt) => ({ x: pt[0] * 100, y: -pt[1] * 100, d: pt[2] }), k: 1, lw: 1 };
  const count = (pr) => buildDogShapes(poseFor(mk(pr), 3), cam).shapes.filter((q) => q.part === 'dog.fleg' && q.side === 'R').length;
  assert.ok(count(PRESETS_SPECIES.bird.Flying) > count(PRESETS_SPECIES.theropod.Walk) + 10, 'many quills on the wing');
});

test('the theropod has walk and run only, and the run is a real run: flight, squash and stretch, a tail held out clear of the ground', () => {
  const ther = wordsFor('theropod'); const gait = CONTROLS.find((c) => c.id === 'dogGait');
  assert.deepEqual(ther.options(gait), ['walk', 'run']);
  assert.deepEqual(wordsFor('bird').options(gait), ['walk', 'run', 'hop']);
  assert.deepEqual(wordsFor('dog').options(gait), ['walk', 'trot', 'pace', 'gallop']);
  assert.deepEqual(wordsFor('sauropod').options(gait), ['walk']);
  for (const name of ['Walk', 'Stalk', 'Run', 'Small fast runner']) assert.ok(['walk', 'run'].includes(PRESETS_SPECIES.theropod[name].dogGait), name);
  const p = mk(PRESETS_SPECIES.theropod.Run); const T = cycleFrames(p).frames.length; assert.equal(T, 12, 'a twelve frame cycle');
  const zs = Array.from({ length: T }, (_, f) => poseFor(p, f));
  const air = zs.filter((z) => !z.legs.HR.stance && !z.legs.HL.stance).length; assert.ok(air >= 2 && air <= 6, `flight in ${air} of ${T} frames`);
  const hip = zs.map((z) => z.pelvis[1]); assert.ok(Math.max(...hip) - Math.min(...hip) > 0.1, 'the body rises and falls');
  const peaks = hip.filter((v, i) => v > hip[(i + T - 1) % T] && v >= hip[(i + 1) % T]).length; assert.equal(peaks, 2, 'one rise and fall every step');
  // squash and stretch: the distance from the pelvis to the head changes as the back arches and straightens
  const span = zs.map((z) => Math.hypot(z.headC[0] - z.pelvis[0], z.headC[1] - z.pelvis[1])); assert.ok(Math.max(...span) - Math.min(...span) > 0.05, 'the body compresses and stretches');
  assert.ok(zs.every((z) => z.tail[3][1] > 0.4), 'the tail never drags on the ground'); assert.ok(zs.every((z) => z.tail[3][1] > z.pelvis[1] - 0.45), 'and is held out level with the body');
  const lift = zs.map((z) => Math.max(z.legs.HR.paw[1], z.legs.HL.paw[1])); assert.ok(Math.max(...lift) > 0.3, 'the swing foot tucks up high under the body');
  const walk = mk(PRESETS_SPECIES.theropod.Walk); const w0 = Array.from({ length: 30 }, (_, f) => poseFor(walk, f)); assert.ok(w0.every((z) => z.legs.HR.stance || z.legs.HL.stance), 'a walk always has a foot down');
});

test('the theropod run arches and flattens its back, and the tail rises and falls through each step', () => {
  const p = mk(PRESETS_SPECIES.theropod.Run); const T = cycleFrames(p).frames.length; const zs = Array.from({ length: T }, (_, f) => poseFor(p, f));
  const ang = (z) => { const a = [z.j1[0] - z.pelvis[0], z.j1[1] - z.pelvis[1]]; const b = [z.j3[0] - z.j1[0], z.j3[1] - z.j1[1]]; return Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]); };
  const arch = zs.map(ang); assert.ok(Math.max(...arch) - Math.min(...arch) > 0.12, `the back bends by ${(Math.max(...arch) - Math.min(...arch)).toFixed(2)} rad`);
  const tail = zs.map((z) => z.tail[3][1]); assert.ok(Math.max(...tail) - Math.min(...tail) > 0.2, 'the tail tip rises and falls');
  assert.ok(zs.every((z) => z.tail[3][1] > 0.8), 'and never comes near the ground');
});
