import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, groundAt, sideGait, foot } from '../src/rig.js';
import { pose3 } from '../src/rig3.js';
import { PRESETS, CONTROLS } from '../src/controls.js';

const params = (over = {}) => ({ ...DEFAULTS, proportions: {}, motion: {}, ...over });
const stride = (p) => 2 * p.stepLength;
/** The pose at the i-th of n frames of a long walk: the world position keeps growing, as it does in a performance. */
const walk = (p, i, per = 24) => { const total = i / per; return pose3(p, {}, total - Math.floor(total), { worldX: total * stride(p) }); };

test('flat ground is height 0 everywhere, a slope rises evenly, steps rise tread by tread', () => {
  assert.equal(groundAt(params(), 3), 0);
  const s = params({ terrain: 'slope', terrainGrade: 10 });
  assert.ok(Math.abs(groundAt(s, 2) - 2 * Math.tan((10 * Math.PI) / 180)) < 1e-9);
  assert.ok(groundAt({ ...s, terrainGrade: -10 }, 2) < 0);
  const st = params({ terrain: 'steps', terrainRise: 0.15, terrainRun: 1 });
  assert.equal(groundAt(st, 0), 0); assert.equal(groundAt(st, 0.5), 0);
  assert.ok(Math.abs(groundAt(st, 1.7) - 0.15) < 1e-9, 'the first tread');
  assert.ok(Math.abs(groundAt(st, 2.7) - 0.3) < 1e-9, 'the second');
  let prev = 0; for (let x = 0; x < 6; x += 0.02) { const g = groundAt(st, x); assert.ok(g >= prev - 1e-9 && g - prev < 0.05, `no cliff at ${x}`); prev = g; }
});

test('on a slope each planted foot stands on the ground where it lands, and the hips climb with it', () => {
  for (const grade of [12, -12]) {
    const p = params({ terrain: 'slope', terrainGrade: grade });
    const flat = params();
    let lastHip = -Infinity;
    for (let i = 0; i < 96; i++) {
      const z = walk(p, i); const f0 = walk(flat, i);
      for (const side of ['R', 'L']) {
        const sd = z.sides[side];
        assert.ok(sd.reached, `${grade}° frame ${i} ${side} reaches`);
        if (sd.stance && sd.w > 0.05 && sd.w < p.duty - 0.08) {
          const wx = i / 24 * stride(p) + sd.ankle[0];
          assert.ok(Math.abs(sd.ankle[1] - groundAt(p, wx) - f0.sides[side].ankle[1]) < 0.02, `planted foot on the ground at ${i}`);
        }
      }
      void lastHip;
    }
    const a = walk(p, 0).pelvis[1]; const b = walk(p, 96).pelvis[1];
    assert.ok(grade > 0 ? b > a + 0.2 : b < a - 0.2, `the hips ${grade > 0 ? 'climb' : 'descend'}`);
  }
});

test('on steps every foot still reaches the ground, and the swinging foot clears the next step', () => {
  for (const name of ['Up the steps', 'Down the steps', 'Uphill', 'Downhill']) {
    const p = params(PRESETS[name]); const n = Math.round(p.cycleFrames);
    for (let i = 0; i < n * 6; i++) { const z = walk(p, i, n); for (const side of ['R', 'L']) assert.ok(z.sides[side].reached, `${name} frame ${i} ${side}`); }
  }
  const up = params(PRESETS['Up the steps']); const per = Math.round(up.cycleFrames);
  for (let i = 0; i < per * 6; i++) {
    const z = walk(up, i, per);
    for (const side of ['R', 'L']) { const wx = i / per * stride(up) + z.sides[side].ankle[0]; assert.ok(z.sides[side].ankle[1] >= groundAt(up, wx) + 0.03, `the foot is not through the ground at ${i}`); }
  }
});

test('flat ground changes nothing, and the controls and presets exist', () => {
  const a = pose3(params(), {}, 0.37); const b = pose3(params({ terrainGrade: 20, terrainRise: 0.2 }), {}, 0.37);
  assert.deepEqual(a.sides.R.ankle, b.sides.R.ankle); assert.equal(a.groundY, 0);
  for (const id of ['terrain', 'terrainGrade', 'terrainRise', 'terrainRun']) assert.ok(CONTROLS.find((c) => c.id === id), id);
  for (const name of ['Uphill', 'Downhill', 'Up the steps', 'Down the steps']) {
    const pr = PRESETS[name]; assert.ok(pr, name);
    for (const [k, v] of Object.entries(pr)) { const c = CONTROLS.find((x) => x.id === k && x.scope === 'p'); assert.ok(c, `${name}.${k}`); assert.ok(c.type === 'enum' ? c.options.includes(v) : v >= c.min - 1e-9 && v <= c.max + 1e-9, `${name}.${k}=${v}`); }
  }
  void sideGait; void foot;
});
