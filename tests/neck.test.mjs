import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { poseDog } from '../src/dog3.js';
import { PRESETS_SPECIES, CONTROLS, TABS } from '../src/controls.js';

const base = { ...DEFAULTS, rig: 'dog', dogSpecies: 'sauropod', motion: {}, proportions: {} };
const len = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);

test('one segment is the plain neck, several are a chain of equal bones', () => {
  const one = poseDog(base, {}, 0.3);
  assert.equal(one.neck.length, 2); assert.deepEqual(one.neck[1], one.neckTop);
  const six = poseDog({ ...base, dogNeckSegs: 6 }, {}, 0.3);
  assert.equal(six.neck.length, 7);
  const l = len(six.neck[0], six.neck[1]);
  for (let i = 1; i < 6; i++) assert.ok(Math.abs(len(six.neck[i], six.neck[i + 1]) - l) < 1e-9);
  assert.ok(Math.abs(len(six.neck[0], six.neckTop) - len(one.neckBase, one.neckTop)) < 1e-9, 'with no curve or wave the neck is as long and as straight as before');
});

test('the curve bends the neck and the wave moves it with the walk', () => {
  const s = (o, u) => poseDog({ ...base, dogNeckSegs: 6, ...o }, {}, u).neckTop;
  const straight = s({}, 0.3); const drooped = s({ dogNeckCurve: 60 }, 0.3);
  assert.ok(drooped[1] < straight[1] - 0.1, 'a positive curve droops the top');
  assert.ok(s({ dogNeckCurve: -60 }, 0.3)[1] > drooped[1]);
  const w = (u) => s({ dogNeckWave: 8, dogNeckSway: 8 }, u);
  const pts = [0, 0.25, 0.5, 0.75].map(w);
  assert.ok(Math.max(...pts.map((p) => p[2])) - Math.min(...pts.map((p) => p[2])) > 0.02, 'it sways sideways through the cycle');
  assert.ok(Math.max(...pts.map((p) => p[1])) - Math.min(...pts.map((p) => p[1])) > 0.01, 'it nods');
  assert.ok(w(0.1).every((v, i) => Math.abs(v - w(1.1)[i]) < 1e-9), 'the same each cycle');
});

test('the sauropod walks with a long jointed neck, and the controls are in the Gait tab', () => {
  assert.ok(PRESETS_SPECIES.sauropod.Walk.dogNeckSegs >= 5);
  for (const id of ['dogNeckSegs', 'dogNeckCurve', 'dogNeckWave', 'dogNeckSway']) { const c = CONTROLS.find((x) => x.id === id); assert.ok(c && c.tab === 'Gait' && c.area === 'Body', id); }
  assert.ok(!TABS.includes('Body'));
});
