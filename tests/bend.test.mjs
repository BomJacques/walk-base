import test from 'node:test';
import assert from 'node:assert/strict';
import { bendPoint, canBend, toScreen, newItem } from '../src/attach.js';

const chain = (A, B, C, L1, L2) => ({ ox: A.x, oy: A.y, scale: 100, chain: { A, B, C, L1, L2 } });

test('only a picture on the upper leg or the upper arm can bend', () => {
  assert.equal(canBend(newItem('image', { part: 'leg', seg: 0, side: 'R' })), true);
  assert.equal(canBend(newItem('image', { part: 'arm', side: 'L' })), true);
  assert.equal(canBend(newItem('image', { part: 'leg', seg: 1, side: 'R' })), false);
  assert.equal(canBend(newItem('ellipse', { part: 'leg', seg: 0, side: 'R' })), false);
  assert.equal(canBend(newItem('image', { part: 'dog.hleg', seg: 0, side: 'R' })), false);
  assert.equal(newItem('image', { part: 'arm', side: 'R' }).bend, false);
});

test('on a straight limb a bent picture lands where a flat one does', () => {
  const f = chain({ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 0, y: 80 }, 0.4, 0.4);
  for (const [s, n] of [[0, 0], [0.2, 0.05], [0.6, -0.05], [0.8, 0.1], [1.0, 0]]) {
    const q = bendPoint(f, s, n);
    const flat = toScreen({ ox: 0, oy: 0, cos: 0, sin: 1, scale: 100 }, s, n);
    assert.ok(Math.hypot(q.x - flat.x, q.y - flat.y) < 1e-6, `${s},${n}: ${q.x},${q.y} vs ${flat.x},${flat.y}`);
  }
});

test('over a bent knee the picture follows the limb with no gap or jump at the joint', () => {
  const f = chain({ x: 0, y: 0 }, { x: 0, y: 40 }, { x: 30, y: 74 }, 0.4, 0.4);
  let prev = bendPoint(f, 0, 0);
  for (let s = 0.01; s <= 0.8; s += 0.01) { const q = bendPoint(f, s, 0); const step = Math.hypot(q.x - prev.x, q.y - prev.y); assert.ok(step > 0.3 && step < 1.6, `step ${step} at ${s}`); prev = q; }
  const end = bendPoint(f, 0.8, 0); assert.ok(end.x > 20 && end.y > 60, 'the far end is on the shin');
});
