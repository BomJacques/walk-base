import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { pose3, footShape } from '../src/rig3.js';
import { CONTROLS, BODY_SHAPES } from '../src/controls.js';
import { bodyDims } from '../src/physpose.js';

const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const pz = (proportions = {}) => pose3({ ...DEFAULTS, proportions }, {}, 0.3);

test('the left arm can be a different length from the right, and nothing else moves', () => {
  const a = pz(); const b = pz({ armLeft: 1.4 });
  const arm = (z, s) => d3(z.sides[s].shoulder, z.sides[s].elbow) + d3(z.sides[s].elbow, z.sides[s].wrist);
  assert.ok(Math.abs(arm(b, 'L') / arm(a, 'L') - 1.4) < 0.01);
  assert.ok(Math.abs(arm(b, 'R') - arm(a, 'R')) < 1e-9);
  assert.deepEqual(a.sides.R.ankle, b.sides.R.ankle);
});

test('the left hand size and the shoulder slope are their own', () => {
  const a = pz(); const b = pz({ handLeft: 2 }); const c = pz({ shoulderSlope: 3 });
  assert.ok(d3(b.sides.L.wrist, b.sides.L.hand) > 1.9 * d3(a.sides.L.wrist, a.sides.L.hand));
  assert.ok(Math.abs(d3(b.sides.R.wrist, b.sides.R.hand) - d3(a.sides.R.wrist, a.sides.R.hand)) < 1e-9);
  assert.ok(c.sides.R.shoulder[1] < a.sides.R.shoulder[1] - 0.1);
});

test('a longer foot is longer and no taller, standing on the same ground', () => {
  const z = pz(); const f1 = footShape(z, 'R', 1, 1); const f2 = footShape(z, 'R', 1, 1.5);
  const reach = (f) => Math.max(...f.a.map((q) => q[0])) - Math.min(...f.a.map((q) => q[0]));
  assert.ok(reach(f2) > 1.4 * reach(f1));
  assert.ok(Math.abs(Math.min(...f2.a.map((q) => q[1])) - Math.min(...f1.a.map((q) => q[1]))) < 1e-9);
});

test('every body shape is inside the slider ranges and changes the figure', () => {
  const by = Object.fromEntries(CONTROLS.filter((c) => c.scope === 'r').map((c) => [c.id, c]));
  for (const [name, set] of Object.entries(BODY_SHAPES)) {
    for (const [k, v] of Object.entries(set)) { assert.ok(by[k], `${name}: ${k} has no slider`); assert.ok(v >= by[k].min && v <= by[k].max, `${name}: ${k}=${v} outside ${by[k].min}..${by[k].max}`); }
    const z = pz(set); assert.ok(z.pelvis.every(Number.isFinite) && z.sides.R.reached, name);
  }
  assert.ok(bodyDims({ ...DEFAULTS, proportions: BODY_SHAPES.Child }).l1 > 0, 'the physics body takes the same proportions');
});
