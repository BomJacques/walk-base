import test from 'node:test';
import assert from 'node:assert/strict';
import { bakePoints, applyStroke, moveHandle, smoothPoints, removeHandle, addHandle, mirrorPoints } from '../src/curves.js';
import { evalCurve, makeEvaluator } from '../src/motion.js';

const sorted = (pts) => pts.every((p, i) => i === 0 || p.u >= pts[i - 1].u);

test('baking reproduces the current curve at the handles', () => {
  const ev = makeEvaluator({}, {});
  const pts = bakePoints((u) => ev.value('pelvis.yaw', u), 12);
  assert.equal(pts.length, 12);
  for (const q of pts) assert.ok(Math.abs(evalCurve(pts, q.u) - ev.value('pelvis.yaw', q.u)) < 1e-12);
  // Between handles the spline stays close to the built-in curve.
  let worst = 0;
  for (let i = 0; i < 200; i++) worst = Math.max(worst, Math.abs(evalCurve(pts, i / 200) - ev.value('pelvis.yaw', i / 200)));
  assert.ok(worst < 0.003, `bake error ${worst}`);
});

test('a freehand stroke replaces only the part it covers', () => {
  const base = Array.from({ length: 12 }, (_, i) => ({ u: i / 12, v: 0 }));
  const stroke = Array.from({ length: 30 }, (_, i) => ({ u: 0.3 + i * 0.01, v: 0.5 }));
  const out = applyStroke(base, stroke);
  assert.ok(sorted(out));
  assert.ok(out.some((p) => p.u >= 0.3 && p.u <= 0.6 && p.v > 0.4), 'stroke applied');
  for (const p of out.filter((q) => q.u < 0.25 || q.u > 0.65)) assert.equal(p.v, 0, 'untouched elsewhere');
  assert.ok(Math.abs(evalCurve(out, 0.45) - 0.5) < 0.05);
});

test('a stroke drawn right to left works the same', () => {
  const base = Array.from({ length: 12 }, (_, i) => ({ u: i / 12, v: 0 }));
  const stroke = Array.from({ length: 30 }, (_, i) => ({ u: 0.6 - i * 0.01, v: -0.4 }));
  const out = applyStroke(base, stroke);
  assert.ok(Math.abs(evalCurve(out, 0.45) + 0.4) < 0.05);
});

test('a tiny stroke changes nothing', () => {
  const base = Array.from({ length: 6 }, (_, i) => ({ u: i / 6, v: i }));
  assert.deepEqual(applyStroke(base, [{ u: 0.5, v: 1 }, { u: 0.5, v: 2 }]), base);
});

test('moving handles keeps them ordered and apart', () => {
  const pts = Array.from({ length: 6 }, (_, i) => ({ u: i / 6, v: 0 }));
  moveHandle(pts, 2, 0.9, 0.3);
  assert.ok(pts[2].u < pts[3].u, 'cannot pass its neighbour');
  assert.equal(pts[2].v, 0.3);
  moveHandle(pts, 0, 0.99, 0.1);
  assert.ok(sorted(pts) || pts[0].u > 0.9, 'first handle can wrap back past the start');
});

test('add, remove, smooth, mirror', () => {
  let pts = Array.from({ length: 4 }, (_, i) => ({ u: i / 4, v: i % 2 }));
  pts = addHandle(pts, 0.1, 0.9);
  assert.equal(pts.length, 5); assert.ok(sorted(pts));
  assert.equal(removeHandle(removeHandle(pts, 1), 1).length, 3);
  assert.equal(removeHandle(pts.slice(0, 3), 0).length, 3, 'never fewer than three');
  const sm = smoothPoints(pts);
  assert.equal(sm.length, pts.length);
  assert.ok(Math.max(...sm.map((p) => p.v)) <= Math.max(...pts.map((p) => p.v)));
  const m = mirrorPoints([{ u: 0.1, v: 1 }, { u: 0.7, v: 2 }]);
  assert.deepEqual(m.map((p) => +p.u.toFixed(6)), [0.2, 0.6]);
  assert.deepEqual(m.map((p) => p.v), [2, 1]);
});

test('mirrored curve makes the left motion half a cycle after the right', () => {
  const pts = bakePoints((u) => Math.sin(2 * Math.PI * u) * 0.2, 12);
  const motion = { 'arm.pitch.R': { pts }, 'arm.pitch.L': { pts: mirrorPoints(pts) } };
  const ev = makeEvaluator({}, motion);
  for (let i = 0; i < 12; i++) {
    const u = i / 12;
    assert.ok(Math.abs(ev.value('arm.pitch.L', u + 0.5) - ev.value('arm.pitch.R', u)) < 1e-9);
  }
});

test('a tap is not a stroke: nothing changes', () => {
  const base = Array.from({ length: 12 }, (_, i) => ({ u: i / 12, v: 0.1 * i }));
  assert.equal(applyStroke(base, [{ u: 0.4, v: 0.2 }]), base);
  assert.equal(applyStroke(base, [{ u: 0.4, v: 0.2 }, { u: 0.405, v: 0.3 }]), base);
});
