import test from 'node:test';
import assert from 'node:assert/strict';
import { pose3, len, sub, footCorners } from '../src/rig3.js';
import { BODY, DEFAULTS, pose } from '../src/rig.js';
import { evalCurve, makeEvaluator, CHANNELS, PARTS, partChannels, sampleDefault } from '../src/motion.js';

const dist = (a, b) => len(sub(a, b));
const N = 64;
const all = (m = {}, p = {}) => Array.from({ length: N }, (_, i) => pose3(p, m, i / N));

test('bone lengths never change', () => {
  for (const z of all()) for (const k of ['R', 'L']) {
    const s = z.sides[k];
    assert.ok(Math.abs(dist(s.hip, s.knee) - BODY.thigh) < 1e-9);
    if (s.reached) assert.ok(Math.abs(dist(s.knee, s.ankle) - BODY.shin) < 1e-9);
    assert.ok(Math.abs(dist(s.shoulder, s.elbow) - BODY.upperArm) < 1e-9);
    assert.ok(Math.abs(dist(s.elbow, s.wrist) - BODY.foreArm) < 1e-9);
  }
});

test('every pose reaches the ground', () => { for (const z of all()) for (const k of ['R', 'L']) assert.ok(z.sides[k].reached); });

test('the cycle closes', () => {
  const a = pose3({}, {}, 0); const b = pose3({}, {}, 1);
  for (const k of ['R', 'L']) assert.ok(dist(a.sides[k].ankle, b.sides[k].ankle) < 1e-12);
  assert.ok(dist(a.headC, b.headC) < 1e-12);
});

test('left is right half a cycle later, mirrored', () => {
  for (let i = 0; i < 16; i++) {
    const u = i / 16;
    const a = pose3({}, {}, u); const b = pose3({}, {}, u + 0.5);
    const r = a.sides.R; const l = b.sides.L;
    assert.ok(Math.abs(r.ankle[0] - l.ankle[0]) < 1e-9 && Math.abs(r.ankle[1] - l.ankle[1]) < 1e-9);
    assert.ok(Math.abs(r.elbow[1] - l.elbow[1]) < 1e-9);
  }
});

test('with the 3D extras off, x and y match the planar walk', () => {
  const off = { pelvisYaw: 0, pelvisRoll: 0, pelvisPitch: 0, sway: 0, shoulderCounter: 0, armOut: 0, kneeOut: 0, toeOut: 0, stepWidth: 0, torsoSway: 0 };
  for (let i = 0; i < 32; i++) {
    const u = i / 32;
    const a = pose3(off, {}, u); const b = pose(off, u);
    for (const k of [['R', 'left'], ['L', 'right']]) {
      assert.ok(Math.abs(a.sides[k[0]].ankle[0] - b.legs[k[1]].ankle.x) < 1e-9, `ankle x u=${u}`);
      assert.ok(Math.abs(a.sides[k[0]].ankle[1] - b.legs[k[1]].ankle.y) < 1e-9, `ankle y u=${u}`);
    }
    assert.ok(Math.abs(a.pelvis[1] - b.hip.y) < 1e-9);
  }
});

test('planted feet do not slide in world space', () => {
  const p = { ...DEFAULTS };
  const flat = [];
  for (let k = 0; k < 60; k++) {
    const u = p.duty * (0.25 + 0.25 * (k / 60));
    const a = pose3(p, {}, u); const b = pose3(p, {}, u + 1e-4);
    flat.push(Math.abs((b.pelvisX + b.sides.R.ankle[0]) - (a.pelvisX + a.sides.R.ankle[0])) / 1e-4);
  }
  assert.ok(Math.max(...flat) < 1e-6);
});

test('the hips twist and the shoulders counter-twist', () => {
  const c = pose3({}, {}, 0);
  assert.ok(c.sides.R.hip[0] > c.sides.L.hip[0], 'hips twist');
  assert.ok(c.sides.R.shoulder[0] < c.sides.L.shoulder[0], 'shoulders counter-twist');
});

test('hips sway toward the supporting foot', () => {
  assert.ok(pose3({}, {}, 0.25).pelvis[2] > 0);
  assert.ok(pose3({}, {}, 0.75).pelvis[2] < 0);
});

test('editing a channel changes only that motion', () => {
  const base = pose3({}, {}, 0.3);
  const ed = pose3({}, { 'pelvis.yaw': { amount: 3 } }, 0.3);
  assert.ok(Math.abs(ed.sides.R.hip[0] - base.sides.R.hip[0]) > 1e-4);
  assert.ok(dist(ed.sides.R.ankle, base.sides.R.ankle) < 1e-12, 'planted ankle stays');
});

test('amount, offset and phase act as stated', () => {
  const ev0 = makeEvaluator({}, {});
  const ev = makeEvaluator({}, { 'arm.pitch.R': { amount: 2, offset: 0.1, phase: 0.25 } });
  assert.ok(Math.abs(ev.value('arm.pitch.R', 0.4) - (2 * ev0.value('arm.pitch.R', 0.4 - 0.25) + 0.1)) < 1e-12);
});

test('drawn curves are periodic and pass through their points', () => {
  const pts = [{ u: 0.1, v: 0.2 }, { u: 0.4, v: -0.3 }, { u: 0.7, v: 0.5 }];
  for (const q of pts) assert.ok(Math.abs(evalCurve(pts, q.u) - q.v) < 1e-12);
  assert.ok(Math.abs(evalCurve(pts, 0.05) - evalCurve(pts, 1.05)) < 1e-12);
  assert.ok(Math.abs(evalCurve(pts, 0.999) - evalCurve(pts, -0.001)) < 1e-12);
  assert.equal(evalCurve([{ u: 0.5, v: 0.7 }], 0.2), 0.7);
  for (let i = 0; i < 20; i++) assert.ok(Number.isFinite(evalCurve([{ u: 0, v: 0 }, { u: 0.5, v: 1 }], i / 20)));
});

test('a drawn curve replaces a channel and only joints above it move', () => {
  const pts = Array.from({ length: 8 }, (_, i) => ({ u: i / 8, v: 0.3 }));
  const z = pose3({}, { 'spine2.pitch': { pts } }, 0.2);
  const z0 = pose3({}, {}, 0.2);
  assert.ok(dist(z.j1, z0.j1) < 1e-9, 'below the edited joint is unchanged');
  assert.ok(dist(z.j3, z0.j3) > 0.01, 'above it follows');
});

test('every part has channels, and sided parts have both sides', () => {
  for (const part of PARTS) for (const side of part.sided ? ['R', 'L'] : [null]) assert.ok(partChannels(part.id, side).length > 0, `${part.id} ${side}`);
  assert.ok(CHANNELS.length >= 45, `${CHANNELS.length} channels`);
  assert.equal(sampleDefault('pelvis.yaw', {}, 8).length, 8);
});

test('foot box sits on the ground in stance', () => {
  const low = Math.min(...footCorners(pose3({}, {}, 0.3), 'R').map((c) => c[1]));
  assert.ok(low > -0.02 && low < 0.03, `lowest foot point ${low}`);
});

test('extreme settings stay finite', () => {
  const m = { 'pelvis.roll': { amount: 8 }, 'spine1.pitch': { amount: 5 }, 'foot.z.R': { offset: 0.3 }, 'foot.y.L': { offset: 0.35 } };
  for (const p of [{}, { stepLength: 1.3 }, { stepLength: 0.3, bob: 0.25 }]) for (const z of all(m, p)) {
    for (const k of ['R', 'L']) for (const v of [z.sides[k].knee, z.sides[k].ankle, z.sides[k].wrist]) assert.ok(v.every(Number.isFinite));
  }
});

test('frequency repeats a motion more often and keeps the loop closed', () => {
  const base = makeEvaluator({}, {});
  const twice = makeEvaluator({}, { 'pelvis.y': { freq: 2 } });
  for (let i = 0; i < 24; i++) { const u = i / 24; assert.ok(Math.abs(twice.value('pelvis.y', u) - base.value('pelvis.y', (2 * u) % 1)) < 1e-12, `u=${u}`); }
  for (const f of [0.5, 2, 3, 4]) {
    const m = { 'pelvis.y': { freq: f }, 'pelvis.pitch': { freq: f } };
    const a = pose3({}, m, 0); const b = pose3({}, m, 1);
    assert.ok(dist(a.pelvis, b.pelvis) < 1e-12 && dist(a.headC, b.headC) < 1e-12, `closes at ×${f}`);
    for (let i = 0; i < 12; i++) { const u = i / 12; assert.ok(Math.abs(makeEvaluator({}, m).value('pelvis.y', u) - makeEvaluator({}, m).value('pelvis.y', u + 1)) < 1e-12, `periodic at ×${f}`); }
  }
});

test('frequency applies to a drawn curve as repeats, and keeps left half a period behind right', () => {
  const pts = Array.from({ length: 8 }, (_, i) => ({ u: i / 8, v: Math.sin((2 * Math.PI * i) / 8) * 0.1 }));
  const ev = makeEvaluator({}, { 'arm.pitch.R': { pts, freq: 3 } });
  for (let i = 0; i < 10; i++) { const u = i / 10; assert.ok(Math.abs(ev.value('arm.pitch.R', u) - evalCurve(pts, 3 * u)) < 1e-12); }
  const sw = makeEvaluator({}, { 'arm.pitch.R': { freq: 2 }, 'arm.pitch.L': { freq: 2 } });
  for (let i = 0; i < 12; i++) { const u = i / 12; assert.ok(Math.abs(sw.value('arm.pitch.L', u + 0.25) - sw.value('arm.pitch.R', u)) < 1e-9, 'at ×2 the left lags a quarter cycle: half of its shorter period'); }
});

test('half frequency is offered only where the loop still closes', async () => {
  const { allowedFrequencies, isEdited } = await import('../src/motion.js');
  assert.deepEqual(allowedFrequencies('pelvis.y', {}), [0.5, 1, 2, 3, 4]);
  assert.deepEqual(allowedFrequencies('arm.pitch.R', {}), [1, 2, 3, 4]);
  assert.deepEqual(allowedFrequencies('pelvis.y', { 'pelvis.y': { pts: [{ u: 0, v: 0 }, { u: 0.5, v: 1 }] } }), [1, 2, 3, 4]);
  assert.equal(isEdited({ 'pelvis.y': { freq: 2 } }, 'pelvis.y'), true);
  assert.equal(isEdited({ 'pelvis.y': { freq: 1 } }, 'pelvis.y'), false);
});
