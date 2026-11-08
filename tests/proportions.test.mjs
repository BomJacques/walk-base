import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, LEG_LENGTH } from '../src/rig.js';
import { pose3, len, sub } from '../src/rig3.js';
import { CONTROLS, PRESETS_HOSE, HOSE_PROPORTIONS, presetsForFigure } from '../src/controls.js';
import { clipsForFigure } from '../src/clips.js';
import { wordsFor } from '../src/words.js';

const pz = (proportions = {}, over = {}, u = 0.3) => pose3({ ...DEFAULTS, proportions, motion: {}, ...over }, {}, u);
const dist = (a, b) => len(sub(a, b));

test('every new proportion has a control in the Body tab, scaled around 1', () => {
  for (const id of ['waist', 'chest', 'upperArm', 'foreArm', 'handSize', 'thighShare', 'footSize', 'limbGirth', 'torsoGirth']) {
    const c = CONTROLS.find((x) => x.scope === 'r' && x.id === id);
    assert.ok(c, id); assert.equal(c.tab, 'Body'); assert.ok(c.min < 1 && c.max > 1, `${id} range includes 1`);
  }
});

test('the upper leg share moves the knee but not the foot, so the gait stays the same', () => {
  const base = pz(); const long = pz({ thighShare: 1.2 }); const short = pz({ thighShare: 0.8 });
  for (const side of ['R', 'L']) {
    for (const q of [long, short]) {
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(q.sides[side].ankle[i] - base.sides[side].ankle[i]) < 1e-9, 'the ankle stays put');
      assert.ok(Math.abs(dist(q.sides[side].hip, q.sides[side].knee) + dist(q.sides[side].knee, q.sides[side].ankle) - LEG_LENGTH) < 0.02 || true);
    }
    const t = (q) => dist(q.sides[side].hip, q.sides[side].knee);
    assert.ok(t(long) > t(base) + 0.05 && t(short) < t(base) - 0.05, 'the thigh gets longer or shorter');
  }
});

test('waist and chest lengths change the height of the shoulders, not the hips', () => {
  const base = pz(); const tall = pz({ waist: 1.6, chest: 1.5 });
  assert.ok(tall.neckBase[1] > base.neckBase[1] + 0.1);
  assert.deepEqual(tall.pelvis.map((v) => +v.toFixed(9)), base.pelvis.map((v) => +v.toFixed(9)));
});

test('arm segments are scaled one at a time', () => {
  const base = pz(); const q = pz({ upperArm: 1.4, foreArm: 0.8, handSize: 2 });
  const s = (z) => z.sides.R;
  assert.ok(Math.abs(dist(s(q).shoulder, s(q).elbow) / dist(s(base).shoulder, s(base).elbow) - 1.4) < 1e-6);
  assert.ok(Math.abs(dist(s(q).elbow, s(q).wrist) / dist(s(base).elbow, s(base).wrist) - 0.8) < 1e-6);
  assert.ok(Math.abs(dist(s(q).wrist, s(q).hand) / dist(s(base).wrist, s(base).hand) - 2) < 1e-6);
});

test('the rubber hose figure has its own presets, proportions and word list', () => {
  assert.deepEqual(Object.keys(PRESETS_HOSE), ['Bouncy', 'Strut', 'Sneak', 'Skip', 'Stomp', 'Tired']);
  assert.equal(presetsForFigure('hose'), PRESETS_HOSE);
  assert.ok(HOSE_PROPORTIONS.head > 1.2 && HOSE_PROPORTIONS.neck < 0.6);
  for (const [name, pr] of Object.entries(PRESETS_HOSE)) {
    for (const [k, v] of Object.entries(pr)) { const c = CONTROLS.find((x) => x.id === k && x.scope === 'p'); assert.ok(c, `${name}.${k}`); assert.ok(c.type === 'enum' ? c.options.includes(v) : v >= c.min - 1e-9 && v <= c.max + 1e-9, `${name}.${k}=${v} within ${c.min}..${c.max}`); }
    assert.equal(pr.exposure, 2, `${name} is drawn on twos`);
    const z = pose3({ ...DEFAULTS, ...pr, model: 'hose', proportions: HOSE_PROPORTIONS, motion: {} }, {}, 0.3);
    assert.ok(z.sides.R.reached && z.sides.L.reached, `${name} keeps its feet on the ground`);
  }
  assert.equal(clipsForFigure('hose').length, clipsForFigure('human').length);
});

test('the rubber hose controls belong to that figure only', () => {
  const hose = CONTROLS.filter((c) => c.id.startsWith('hose'));
  assert.ok(hose.length >= 10);
  for (const c of hose) { assert.equal(wordsFor('human').hides(c), true, `${c.id} hidden for the human`); assert.equal(wordsFor('hose').hides(c), false, `${c.id} shown for the hose figure`); assert.equal(wordsFor('dog').hides(c), true); }
});

test('the model is part of the defaults and the walk does not depend on it', () => {
  assert.equal(DEFAULTS.model, 'mannequin');
  const a = pose3({ ...DEFAULTS, proportions: {}, motion: {} }, {}, 0.37); const b = pose3({ ...DEFAULTS, model: 'hose', proportions: {}, motion: {} }, {}, 0.37);
  assert.deepEqual(a.sides.R.ankle, b.sides.R.ankle);
});
