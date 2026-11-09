import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateStrip } from '../src/physics.js';
import { STRIP_DEFAULTS } from '../src/stripdefs.js';

const T = 24; const stride = 1.56;
const roots = Array.from({ length: T }, (_, f) => ({ x: (f / T) * stride, y: 1.3 + 0.04 * Math.cos((4 * Math.PI * f) / T), dir: [1, 0] }));
const vec = (a, b) => a.flatMap((p, i) => [b[i][0] - p[0], b[i][1] - p[1]]);
const acc = (a, b, c) => { const v1 = vec(a, b); const v2 = vec(b, c); return Math.hypot(...v1.map((x, i) => v2[i] - x)); };
const median = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];

test('a cape or hair on a looping walk joins its last frame to its first without a kink', () => {
  for (const phys of [STRIP_DEFAULTS, { ...STRIP_DEFAULTS, damp: 0.02, stiff: 0.1 }, { ...STRIP_DEFAULTS, wind: 0.6, gusts: 2 }]) {
    for (const warm of [6, 30]) {
      const out = simulateStrip(roots, phys, 0.55, { fps: 24, cycle: T, loops: 1, travel: stride, warm });
      assert.equal(out.length, T);
      const others = []; for (let f = 1; f < T - 1; f++) others.push(acc(out[f - 1], out[f], out[f + 1]));
      const joins = [acc(out[T - 2], out[T - 1], out[0]), acc(out[T - 1], out[0], out[1])];
      for (const j of joins) assert.ok(j <= Math.max(...others) * 1.05, `the join (${j.toFixed(4)}) is no sharper than the sharpest bend elsewhere (${Math.max(...others).toFixed(4)}), warm ${warm}`);
    }
  }
});

test('the frame after the last is the first one', () => {
  const out = simulateStrip(roots, STRIP_DEFAULTS, 0.55, { fps: 24, cycle: T, loops: 1, travel: stride, warm: 6 });
  // continuing the cycle: the step from the last frame to the first is a step like the others
  const steps = []; for (let f = 1; f < T; f++) steps.push(Math.hypot(...vec(out[f - 1], out[f])));
  const wrap = Math.hypot(...vec(out[T - 1], out[0]));
  assert.ok(wrap <= median(steps) * 2.5 + 1e-9, `${wrap} vs ${median(steps)}`);
});

test('a performance is not forced to loop', () => {
  const out = simulateStrip(roots, STRIP_DEFAULTS, 0.55, { fps: 24, cycle: T, loops: 1, travel: 0, warm: 0 });
  assert.equal(out.length, T);
});
