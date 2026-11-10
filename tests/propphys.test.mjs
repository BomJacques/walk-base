import test from 'node:test';
import assert from 'node:assert/strict';
import { simulateProp, movedProp, hasPhysics } from '../src/propphys.js';
import { newProp, cleanScene, prismFaces } from '../src/scene.js';

const ball = (over = {}) => newProp('ball', { phys: 'drop', y: 2, ...over });
const box = (over = {}) => newProp('box', { phys: 'tip', y: 0, ...over });

test('a dropped ball falls, bounces lower each time and comes to rest on the ground', () => {
  const tr = simulateProp(ball(), 400, 24);
  assert.equal(tr[0].y, 2);
  assert.ok(tr[5].y < 2, 'it has started to fall');
  const peaks = []; for (let f = 1; f < tr.length - 1; f++) if (tr[f].y > tr[f - 1].y && tr[f].y >= tr[f + 1].y && tr[f].y > 0.01) peaks.push(tr[f].y);
  assert.ok(peaks.length >= 2, 'it bounces');
  for (let i = 0; i < peaks.length; i++) assert.ok(peaks[i] < (i ? peaks[i - 1] : 2) + 1e-9, `bounce ${i} (${peaks[i]}) is lower than the one before: energy never grows`);
  assert.ok(tr.every((s) => s.y >= -1e-9 && s.y <= 2 + 1e-9), 'never through the floor, never above where it was let go');
  assert.equal(tr[400].y, 0); assert.equal(tr[399].y, 0, 'at rest');
});

test('it waits for its start frame, and the same settings give the same motion', () => {
  const q = ball({ physStart: 30 });
  const a = simulateProp(q, 120, 24); const b = simulateProp(q, 120, 24);
  assert.deepEqual(a, b);
  for (let f = 0; f <= 30; f++) assert.equal(a[f].y, 2);
  assert.ok(a[32].y < 2);
});

test('a thrown ball rolls further than a thrown box slides, and both stop', () => {
  const b = simulateProp(ball({ throwX: 3 }), 2400, 24); const c = simulateProp(newProp('box', { phys: 'drop', y: 2, throwX: 3 }), 2400, 24);
  assert.ok(b[2400].dx > c[2400].dx && c[2400].dx > 0.5, `${b[2400].dx} > ${c[2400].dx}`);
  assert.equal(b[2400].dx, b[2399].dx); assert.equal(c[2400].dx, c[2399].dx);
  const back = simulateProp(ball({ throwX: -3 }), 600, 24); assert.ok(back[600].dx < -0.5, 'a negative throw goes the other way');
});

test('no bounce at all: it lands and stays', () => {
  const tr = simulateProp(ball({ bounce: 0 }), 100, 24); const land = tr.findIndex((s) => s.y === 0);
  assert.ok(land > 0); assert.ok(tr.slice(land).every((s) => s.y === 0));
});

test('a box pushed hard enough goes over and lies on its side; pushed too gently it rocks back', () => {
  const over = simulateProp(box({ push: 1.3 }), 300, 24);
  assert.equal(over[0].tilt, 0); assert.ok(Math.abs(over[300].tilt - 90) < 1e-6, `tilt ${over[300].tilt}`);
  assert.ok(over.every((s) => s.tilt >= 0 && s.tilt <= 90 + 1e-9));
  const weak = simulateProp(box({ push: 0.6 }), 300, 24);
  assert.ok(Math.max(...weak.map((s) => s.tilt)) > 3, 'it rocks'); assert.equal(weak[300].tilt, 0, 'and settles back');
  const other = simulateProp(box({ push: -1.3 }), 300, 24); assert.ok(Math.abs(other[300].tilt + 90) < 1e-6, 'a negative push falls the other way');
  for (const k of ['wall', 'step', 'fence']) { const t = simulateProp(newProp(k, { phys: 'tip' }), 600, 24); assert.ok(Math.abs(Math.abs(t[600].tilt) - 90) < 1e-6 || t[600].tilt === 0, `${k} ends lying down or standing`); }
});

test('a tipped box stays on the ground and keeps its size', () => {
  const q = { ...newProp('box', { x: 0, z: 0, w: 0.6, h: 1, d: 0.4 }), tilt: 90 };
  const pts = prismFaces(q, 4).flatMap((f) => f.pts);
  const ys = pts.map((p) => p[1]); const xs = pts.map((p) => p[0]);
  assert.ok(Math.abs(Math.min(...ys)) < 1e-9, 'it rests on the ground'); assert.ok(Math.abs(Math.max(...ys) - 0.6) < 1e-9, 'its width is now its height');
  assert.ok(Math.abs(Math.min(...xs) - 0.3) < 1e-9 && Math.abs(Math.max(...xs) - 1.3) < 1e-9, 'it lies beyond the edge it turned on');
  const top = prismFaces(q, 4)[4].normal; assert.ok(Math.abs(top[0] - 1) < 1e-9 && Math.abs(top[1]) < 1e-9, 'what was the top now faces along');
  const half = prismFaces({ ...q, tilt: 40 }, 4).flatMap((f) => f.pts); assert.ok(Math.min(...half.map((p) => p[1])) > -1e-9, 'half way over, nothing is under the ground');
});

test('the prop as it is at a frame, and props without physics are left alone', () => {
  const plain = newProp('ball'); assert.equal(hasPhysics(plain), false); assert.equal(movedProp(plain, 50), plain);
  assert.equal(hasPhysics(newProp('ball', { phys: 'tip' })), false, 'a ball cannot be pushed over');
  const q = ball({ throwX: 2, x: 1, z: 0, rot: 0 }); const m = movedProp(q, 20, 24);
  assert.ok(m.y < 2 && m.x > 1); assert.equal(q.y, 2, 'the prop itself is not changed');
  assert.deepEqual(movedProp(q, 20, 24), m); assert.ok(movedProp(q, 1000, 24).y === 0, 'far past what was worked out so far');
  const turned = movedProp({ ...q, id: 'turned', rot: 90 }, 20, 24); assert.ok(Math.abs(turned.x - 1) < 1e-9 && turned.z < 0, 'a turned prop is thrown the way it faces');
});

test('the settings are kept and cleaned in a saved scene', () => {
  const s = cleanScene({ props: [{ ...ball({ physStart: 12.4, bounce: 5, throwX: 99 }) }, { ...newProp('box'), phys: 'explode' }, { type: 'ball' }] }, ['human'], {});
  assert.equal(s.props[0].phys, 'drop'); assert.equal(s.props[0].physStart, 12); assert.equal(s.props[0].bounce, 0.95); assert.equal(s.props[0].throwX, 12);
  assert.equal(s.props[1].phys, 'none'); assert.equal(s.props[2].phys, 'none'); assert.equal(s.props[2].bounce, 0.5);
});
