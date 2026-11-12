import test from 'node:test';
import assert from 'node:assert/strict';
import { maskLoops, simplifyLoop, floodRegion, loopSize } from '../src/ink.js';
import { cleanStroke } from '../src/design.js';

const grid = (rows) => { const h = rows.length; const w = rows[0].length; const m = new Uint8Array(w * h); rows.forEach((r, y) => [...r].forEach((c, x) => { m[y * w + x] = c === '#' ? 1 : 0; })); return { m, w, h }; };

test('the outline of a block of pixels is its four corners', () => {
  const { m, w, h } = grid(['....', '.##.', '.##.', '....']); const loops = maskLoops(m, w, h);
  assert.equal(loops.length, 1); assert.equal(loops[0].length, 4); assert.equal(loopSize(loops[0]), 4);
});
test('a ring has an outer outline and one for its hole', () => {
  const { m, w, h } = grid(['.....', '.###.', '.#.#.', '.###.', '.....']); const loops = maskLoops(m, w, h);
  assert.equal(loops.length, 2); const sizes = loops.map(loopSize).sort((a, b) => a - b); assert.deepEqual(sizes, [1, 9]);
});
test('separate blocks give an outline each; an L shape gives six corners', () => {
  const g = grid(['#..#', '....', '#..#']); assert.equal(maskLoops(g.m, g.w, g.h).length, 4);
  const { m, w, h } = grid(['#.', '##']); const l = maskLoops(m, w, h); assert.equal(l.length, 1); assert.equal(l[0].length, 6);
});
test('simplifying a staircase along a diagonal leaves a straight line', () => {
  const pts = []; for (let i = 0; i < 20; i++) { pts.push([i, i]); pts.push([i + 1, i]); } pts.push([20, 20], [0, 20]);
  const s = simplifyLoop(pts, 1.1); assert.ok(s.length < 12, String(s.length)); assert.equal(simplifyLoop([[0, 0], [1, 0], [1, 1]], 1).length, 3);
});
test('flood filling stops at walls, grows by a pixel so it tucks under a line, and a tap on a wall fills nothing', () => {
  const split = new Uint8Array([1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1]); const left = floodRegion(split, 5, 3, 0, 0); const col = (x) => [0, 1, 2].map((y) => left.mask[y * 5 + x]).join('');
  assert.equal(col(0), '111'); assert.equal(col(1), '111'); assert.equal(col(2), '111', 'grown by one pixel into the wall'); assert.equal(col(3), '000'); assert.equal(floodRegion(split, 5, 3, 2, 1), null);
  assert.equal(floodRegion(split, 5, 3, 9, 9), null);
});
test('a stroke can be a filled region of loops', () => {
  const s = cleanStroke({ c: '#ff0000', loops: [[[0, 0], [1, 0], [1, 1]], [[0.4, 0.4], [0.6, 0.4]], [[0.2, 0.2], [0.3, 0.2], [0.3, 0.3]]] });
  assert.equal(s.fill, true); assert.equal(s.loops.length, 2, 'a loop of two points is dropped'); assert.equal(s.pts.length, 3); assert.equal(cleanStroke({ loops: [] }), null);
});
