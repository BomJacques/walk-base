import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, withWeight, noiseSignal, noiseOf, sideGait, gaitSummary } from '../src/rig.js';
import { pose3, len, sub } from '../src/rig3.js';
import { poseDog, pawGait } from '../src/dog3.js';
import { PRESETS, PRESETS_DOG, PRESETS_HOSE, CONTROLS } from '../src/controls.js';

const human = (o = {}) => ({ ...DEFAULTS, proportions: {}, motion: {}, ...o });
const dog = (o = {}) => ({ ...DEFAULTS, rig: 'dog', proportions: {}, motion: {}, ...o });
const range = (p, key, n = 96) => { let lo = Infinity; let hi = -Infinity; for (let i = 0; i < n; i++) { const v = key(pose3(p, {}, i / n)); lo = Math.min(lo, v); hi = Math.max(hi, v); } return [lo, hi]; };

test('no weight changes nothing, and the same weight is applied once', () => {
  const p = { ...DEFAULTS };
  assert.equal(withWeight(p), p);
  const w = withWeight({ ...DEFAULTS, weight: 0.8 });
  assert.equal(withWeight(w), w, 'applying it again does nothing more');
  assert.deepEqual(pose3(human(), {}, 0.3).sides.R.ankle, pose3(human({ weight: 0 }), {}, 0.3).sides.R.ankle);
});

test('a heavy figure stays on the ground longer, lifts its feet less and drops deeper', () => {
  const h = withWeight({ ...DEFAULTS, weight: 1 }); const l = withWeight({ ...DEFAULTS, weight: -1 });
  assert.ok(h.duty > DEFAULTS.duty && l.duty < DEFAULTS.duty);
  assert.ok(h.footLift < DEFAULTS.footLift && l.footLift > DEFAULTS.footLift);
  assert.ok(h.bob > DEFAULTS.bob && h.armSwing < DEFAULTS.armSwing && h.stepLength < DEFAULTS.stepLength && h.lean > DEFAULTS.lean);
  assert.ok(sideGait({ ...DEFAULTS, weight: 1 }, 'R').p.duty > sideGait({ ...DEFAULTS }, 'R').p.duty, 'the gait the feet follow carries it');
  const [lo0, hi0] = range(human(), (z) => z.pelvis[1]); const [lo1, hi1] = range(human({ weight: 1 }), (z) => z.pelvis[1]);
  assert.ok(hi1 - lo1 > hi0 - lo0, 'the hips travel further up and down');
  const [a0, b0] = range(human(), (z) => z.sides.R.ankle[1]); const [a1, b1] = range(human({ weight: 1 }), (z) => z.sides.R.ankle[1]);
  assert.ok(b1 - a1 < b0 - a0, 'and the feet come up less');
  assert.ok(gaitSummary(human({ weight: 1 })).doubleSupport > gaitSummary(human()).doubleSupport, 'with more time with both feet down');
});

test('every foot stays reachable at the heaviest and the lightest, on every walk', () => {
  for (const w of [-1, -0.5, 0.5, 1]) {
    for (const [name, pr] of [...Object.entries(PRESETS).filter(([, q]) => !q.terrain), ...Object.entries(PRESETS_HOSE).map(([n, q]) => [`hose ${n}`, { ...q, model: 'hose' }])]) {
      const p = human({ ...pr, weight: w }); let bad = 0;
      for (let i = 0; i < 48; i++) { const z = pose3(p, {}, i / 48); if (!z.sides.R.reached || !z.sides.L.reached) bad++; }
      assert.ok(bad === 0 || bad <= 1, `${name} at weight ${w}: ${bad} frames out of reach`);
    }
  }
});

test('the dog and the animals take weight too', () => {
  const h = withWeight(dog({ weight: 1 }));
  assert.ok(h.dogDuty > DEFAULTS.dogDuty && h.dogLift < DEFAULTS.dogLift && h.dogStride < DEFAULTS.dogStride);
  assert.ok(pawGait(dog({ weight: 1 }), 'HR').duty > pawGait(dog(), 'HR').duty);
  for (const w of [-1, 1]) for (const sp of ['dog', 'theropod', 'sauropod', 'bird']) { const p = dog({ weight: w, dogSpecies: sp }); let bad = 0; for (let i = 0; i < 48; i++) { const z = poseDog(p, {}, i / 48); for (const leg of Object.keys(z.legs)) if (!z.legs[leg].reached) bad++; } assert.ok(bad <= 2, `${sp} weight ${w}: ${bad}`); }
});

test('Heavy and Light are presets, and the controls exist', () => {
  assert.ok(PRESETS.Heavy.weight > 0.5 && PRESETS.Light.weight < -0.5 && PRESETS_DOG.Heavy.weight > 0);
  for (const id of ['weight', 'noiseAmount', 'noiseSpeed', 'noiseSeed', 'noiseLoop']) assert.ok(CONTROLS.find((c) => c.id === id && c.scope === 'p'), id);
  for (const [name, pr] of [...Object.entries({ Heavy: PRESETS.Heavy, Light: PRESETS.Light }), ...Object.entries({ Heavy: PRESETS_DOG.Heavy, Light: PRESETS_DOG.Light })]) for (const [k, v] of Object.entries(pr)) { const c = CONTROLS.find((x) => x.id === k && x.scope === 'p'); assert.ok(c, `${name}.${k}`); assert.ok(v >= c.min - 1e-9 && v <= c.max + 1e-9, `${name}.${k}=${v}`); }
});

test('noise: nothing at zero, the same for the same seed, different for another, and bounded', () => {
  const base = human(); const a = pose3(base, {}, 0.3); const b = pose3({ ...base, noiseAmount: 0 }, {}, 0.3);
  assert.deepEqual(a.pelvis, b.pelvis);
  const n1 = pose3({ ...base, noiseAmount: 1, noiseSeed: 5 }, {}, 0.3); const n2 = pose3({ ...base, noiseAmount: 1, noiseSeed: 5 }, {}, 0.3); const n3 = pose3({ ...base, noiseAmount: 1, noiseSeed: 6 }, {}, 0.3);
  assert.deepEqual(n1.headC, n2.headC); assert.notDeepEqual(n1.headC, n3.headC); assert.notDeepEqual(n1.headC, a.headC);
  for (let i = 0; i < 400; i++) assert.ok(Math.abs(noiseSignal(3, 'head.yaw', i / 37, 3, false)) <= 1.4, 'a signal stays about as large as one unit');
  assert.ok(Math.abs(noiseOf({ noiseAmount: 1, noiseSeed: 2, noiseSpeed: 2 }, 'head.yaw', 0.4)) <= 0.08 * 1.4 + 1e-9);
  assert.equal(noiseOf({ noiseAmount: 1 }, 'not.a.channel', 0.4), 0);
});

test('looping noise repeats every cycle exactly; free noise drifts', () => {
  const loopP = human({ noiseAmount: 1, noiseLoop: true }); const freeP = human({ noiseAmount: 1, noiseLoop: false });
  const at = (p, t) => pose3(p, {}, t - Math.floor(t), { freeU: t }).headC;
  for (const t of [0.1, 0.45, 0.8]) { assert.ok(len(sub(at(loopP, t), at(loopP, t + 1))) < 1e-9, 'loop: a cycle later it is the same'); assert.ok(len(sub(at(loopP, t), at(loopP, t + 3))) < 1e-9); }
  assert.ok(len(sub(at(freeP, 0.45), at(freeP, 1.45))) > 1e-4, 'free: a cycle later it is not');
  // the loop: the last frame of a cycle leads into the first
  const p = human({ noiseAmount: 1, noiseLoop: true }); const steps = []; const n = 48;
  for (let i = 0; i < n; i++) steps.push(len(sub(pose3(p, {}, i / n).headC, pose3(p, {}, ((i + 1) % n) / n).headC)));
  assert.ok(steps.at(-1) <= Math.max(...steps.slice(0, -1)) * 1.05 + 1e-9, 'the join is no bigger than any other step');
});

test('the dog wobbles too', () => {
  const a = poseDog(dog(), {}, 0.3); const b = poseDog(dog({ noiseAmount: 1 }), {}, 0.3);
  assert.notDeepEqual(a.tail[3], b.tail[3]);
});
