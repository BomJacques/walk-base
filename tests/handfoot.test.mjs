import test from 'node:test';
import assert from 'node:assert/strict';
import { handPolys, STYLE_DEFAULTS } from '../src/draw.js';
import { CONTROLS } from '../src/controls.js';

const area = (p) => Math.abs(p.reduce((t, q, i) => { const r = p[(i + 1) % p.length]; return t + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
const box = (polys) => { const pts = polys.flat(); const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]); return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), x1: Math.max(...xs) }; };
const H = { x: 100, y: 100 }; const W = { x: 80, y: 100 }; // the hand points along +x

test('the default hand is the figure\'s own', () => {
  assert.equal(handPolys(H, W, 10, 'default'), null); assert.equal(handPolys(H, W, 10, undefined), null); assert.equal(handPolys(H, W, 10, 'nonsense'), null);
  assert.equal(STYLE_DEFAULTS.handStyle, 'default'); assert.equal(STYLE_DEFAULTS.footStyle, 'default');
});

test('each hand style is made of real outlines, sized by the hand', () => {
  for (const style of ['mitten', 'fist', 'fingers', 'pointing']) {
    const a = handPolys(H, W, 10, style); const b = handPolys(H, W, 20, style);
    assert.ok(a.length >= 1); for (const p of a) { assert.ok(p.length >= 3 && area(p) > 1, `${style} outline has an area`); for (const q of p) assert.ok(Number.isFinite(q[0]) && Number.isFinite(q[1])); }
    assert.ok(Math.abs(box(b).w / box(a).w - 2) < 0.05, `${style} is twice as big at twice the size`);
  }
});

test('fingers and a pointing finger reach beyond a fist, along the way the hand points', () => {
  const fist = box(handPolys(H, W, 10, 'fist')); const fingers = box(handPolys(H, W, 10, 'fingers')); const point = box(handPolys(H, W, 10, 'pointing'));
  assert.ok(fingers.x1 > fist.x1 + 5 && point.x1 > fist.x1 + 5);
  assert.equal(handPolys(H, W, 10, 'fingers').length, 6, 'a palm, four fingers and a thumb');
  const up = box(handPolys(H, { x: 100, y: 120 }, 10, 'pointing')); assert.ok(up.h > up.w, 'turned with the arm');
  assert.ok(handPolys(H, H, 10, 'mitten')[0].every((q) => Number.isFinite(q[0])), 'a wrist on top of the hand still draws');
});

test('Hands and Feet are choices in the Figure group', () => {
  const hs = CONTROLS.find((c) => c.id === 'handStyle'); const fs = CONTROLS.find((c) => c.id === 'footStyle');
  assert.deepEqual(hs.options, ['default', 'mitten', 'fist', 'fingers', 'pointing']); assert.deepEqual(fs.options, ['default', 'boot', 'bare', 'round']);
});
