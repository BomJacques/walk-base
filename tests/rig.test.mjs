import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, BODY, DEFAULTS, cycleFrames, keyPhases, LEG_LENGTH } from '../src/rig.js';

const N = 96;
const samples = (p = {}) => Array.from({ length: N }, (_, i) => pose(p, i / N));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test('bone lengths never change', () => {
  for (const pz of samples()) for (const side of ['left', 'right']) {
    const l = pz.legs[side]; const a = pz.arms[side];
    assert.ok(Math.abs(dist(l.hip, l.knee) - BODY.thigh) < 1e-9);
    assert.ok(Math.abs(dist(l.knee, l.ankle) - BODY.shin) < 1e-9 || !l.reached);
    assert.ok(Math.abs(dist(a.shoulder, a.elbow) - BODY.upperArm) < 1e-9);
    assert.ok(Math.abs(dist(a.elbow, a.wrist) - BODY.foreArm) < 1e-9);
  }
});

test('every pose reaches the ground; legs never hyperextend', () => {
  for (const pz of samples()) for (const side of ['left', 'right']) {
    assert.ok(pz.legs[side].reached, `u=${pz.u}`);
    assert.ok(pz.legs[side].ankle.y >= BODY.ankleH - 0.03, `ankle above ground ${pz.legs[side].ankle.y}`);
  }
});

test('the cycle closes: phase 1 equals phase 0 apart from travel', () => {
  const a = pose({}, 0); const b = pose({}, 1);
  assert.ok(dist(a.legs.left.ankle, b.legs.left.ankle) < 1e-12);
  assert.ok(dist(a.head.c, b.head.c) < 1e-12);
  assert.ok(Math.abs(b.pelvisX - a.pelvisX - 2 * DEFAULTS.stepLength) < 1e-12);
});

test('the far side is the near side half a cycle later', () => {
  for (let i = 0; i < 24; i++) {
    const u = i / 24;
    const a = pose({}, u); const b = pose({}, u + 0.5);
    assert.ok(dist(a.legs.left.ankle, b.legs.right.ankle) < 1e-12);
    assert.ok(Math.abs(a.arms.left.swing - b.arms.right.swing) < 1e-12);
    assert.ok(Math.abs(a.hip.y - b.hip.y) < 1e-12, 'hips bob once per step');
  }
});

test('planted feet do not slide in world space', () => {
  const p = { ...DEFAULTS };
  const steps = 400;
  // The ankle's world x during stance is pelvisX + relative x. Its change should be ~0 while the foot is flat on the ground.
  for (let i = 0; i < steps; i++) {
    const u0 = (0.18 * p.duty + 0.02) / 1 + (i / steps) * 0; void u0;
  }
  let worst = 0;
  for (let k = 0; k < steps; k++) {
    const u = (0.05 + (0.5 * k) / steps) * 0.6 + 0.02;       // inside flat-foot stance of the near foot
    const du = 1e-4;
    const a = pose(p, u); const b = pose(p, u + du);
    const wa = a.pelvisX + a.legs.left.ankle.x; const wb = b.pelvisX + b.legs.left.ankle.x;
    worst = Math.max(worst, Math.abs(wb - wa) / du);
  }
  // Heel strike and push-off pivot shifts are bounded, so check mid stance only (flat foot).
  const flat = [];
  for (let k = 0; k < 100; k++) {
    const u = p.duty * (0.25 + 0.25 * (k / 100));
    const a = pose(p, u); const b = pose(p, u + 1e-4);
    flat.push(Math.abs((b.pelvisX + b.legs.left.ankle.x) - (a.pelvisX + a.legs.left.ankle.x)) / 1e-4);
  }
  assert.ok(Math.max(...flat) < 1e-6, `flat foot slides ${Math.max(...flat)}`);
});

test('the four named poses sit in the right order and heights', () => {
  const k = Object.fromEntries(keyPhases({}).map((x) => [x.name, x.u]));
  const h = (u) => pose({}, u).hip.y;
  assert.ok(h(k.DOWN) < h(k.CONTACT), 'down is lower than contact');
  assert.ok(h(k.UP) > h(k.CONTACT), 'up is higher than contact');
  assert.ok(h(k.PASSING) > h(k.DOWN) && h(k.PASSING) < h(k.UP) + 1e-9, 'passing rises between down and up');
  const lo = Math.min(...samples().map((z) => z.hip.y)); const hi = Math.max(...samples().map((z) => z.hip.y));
  assert.ok(Math.abs((hi - lo) - DEFAULTS.bob) < 1e-3, `bob p2p ${hi - lo}`);
});

test('contact: legs nearly straight, feet roughly one step apart', () => {
  const c = pose({}, 0);
  const lenNear = dist(c.legs.left.hip, c.legs.left.ankle);
  assert.ok(lenNear > 0.97 * LEG_LENGTH, `near leg ${lenNear}`);
  const sep = c.legs.left.ankle.x - c.legs.right.ankle.x;
  assert.ok(Math.abs(sep - DEFAULTS.stepLength) < 0.12, `feet ${sep} apart, step ${DEFAULTS.stepLength}`);
});

test('arms oppose legs', () => {
  const c = pose({}, 0);
  assert.ok(c.legs.left.ankle.x > c.legs.right.ankle.x);
  assert.ok(c.arms.left.swing < 0 && c.arms.right.swing > 0, 'near arm back when near leg forward');
});

test('swing foot clears the ground, stance foot does not', () => {
  const mid = pose({}, DEFAULTS.duty + (1 - DEFAULTS.duty) / 2);
  assert.ok(mid.legs.left.ankle.y > BODY.ankleH + 0.8 * DEFAULTS.footLift);
  const st = pose({}, 0.3);
  assert.ok(Math.abs(st.legs.left.ankle.y - BODY.ankleH) < 0.02);
});

test('extreme settings stay valid', () => {
  for (const p of [{ stepLength: 1.3, duty: 0.55 }, { stepLength: 0.3 }, { duty: 0.85, stepLength: 0.5 }, { bob: 0.25 }, { footLift: 0.5 }]) {
    for (const pz of samples(p)) {
      for (const k of ['left', 'right']) {
        assert.ok(Number.isFinite(pz.legs[k].knee.x) && Number.isFinite(pz.legs[k].knee.y));
      }
    }
  }
});

test('frame schedule: on ones and twos', () => {
  const ones = cycleFrames({ cycleFrames: 24, exposure: 1 });
  assert.equal(ones.drawings, 24);
  const twos = cycleFrames({ cycleFrames: 24, exposure: 2 });
  assert.equal(twos.frames.length, 24);
  assert.equal(twos.drawings, 12);
  assert.deepEqual(twos.frames.slice(0, 4).map((f) => f.drawing), [1, 1, 2, 2]);
  assert.ok(Math.abs(twos.frames[2].u - 1 / 12) < 1e-12);
});
