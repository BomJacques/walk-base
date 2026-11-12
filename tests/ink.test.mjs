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

import { shapePoints, mapStroke, mirrorStroke } from '../src/ink.js';
import { sheetFrame, propSheet, propParts, newProp, cleanScene, PROP_BY_ID } from '../src/scene.js';

test('shapes: a line, an oval and a box are dragged out between two points, and the closed ones end where they began', () => {
  const l = shapePoints('line', [0, 0], [100, 0], 10); assert.deepEqual(l[0], [0, 0]); assert.deepEqual(l[l.length - 1], [100, 0]); assert.ok(l.length >= 10);
  const b = shapePoints('box', [10, 20], [110, 80], 10); assert.deepEqual(b[0], [10, 20]); assert.deepEqual(b[b.length - 1], [10, 20]); assert.ok(b.some((p) => p[0] === 110 && p[1] === 20) && b.some((p) => p[0] === 110 && p[1] === 80));
  const o = shapePoints('oval', [0, 0], [100, 60], 10); assert.ok(Math.abs(o[0][0] - 100) < 1e-9 && Math.abs(o[0][1] - 30) < 1e-9); assert.ok(Math.hypot(o[0][0] - o[o.length - 1][0], o[0][1] - o[o.length - 1][1]) < 1e-6);
  for (const [x, y] of o) assert.ok(Math.abs(((x - 50) / 50) ** 2 + ((y - 30) / 30) ** 2 - 1) < 1e-9);
});
test('mapStroke and mirrorStroke move every point, filled regions too, and leave the original alone', () => {
  const s = { c: '#000000', w: 0.02, a: 1, fill: true, pts: [[0.1, 0.2], [0.3, 0.4], [0.5, 0.2]], loops: [[[0.1, 0.2], [0.3, 0.4], [0.5, 0.2]]] };
  const m = mapStroke(s, ([u, v]) => [u + 0.1, v], 2); assert.deepEqual(m.pts[0], [0.2, 0.2]); assert.deepEqual(m.loops[0][1], [0.4, 0.4]); assert.equal(m.w, 0.04); assert.deepEqual(s.pts[0], [0.1, 0.2]);
  const f = mirrorStroke(s, true); assert.deepEqual(f.pts[1], [0.3, 0.6]); assert.deepEqual(mirrorStroke(s, false).pts, s.pts); assert.equal(mapStroke({ ...s, w: 0.4 }, (p) => p, 5).w, 0.5);
});
test('a sheet frame goes from the picture to the sheet and back, whatever way up the sheet is', () => {
  for (const c of [[{ x: 0, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 0 }, { x: 0, y: 0 }], [{ x: 20, y: 130 }, { x: 180, y: 110 }, { x: 190, y: 20 }, { x: 30, y: 40 }]]) {
    const fr = sheetFrame(c); assert.deepEqual(fr.to(c[3].x, c[3].y).map((v) => +v.toFixed(9)), [0, 0]); assert.deepEqual(fr.to(c[2].x, c[2].y).map((v) => +v.toFixed(9)), [1, 0]); assert.deepEqual(fr.to(c[0].x, c[0].y).map((v) => +v.toFixed(9)), [0, 1]);
    for (const [u, v] of [[0.3, 0.7], [0.9, 0.1], [0, 0], [1, 1]]) { const [x, y] = fr.from(u, v); const [u2, v2] = fr.to(x, y); assert.ok(Math.abs(u - u2) < 1e-9 && Math.abs(v - v2) < 1e-9); }
    assert.ok(fr.L > 100 && fr.W > 50);
  }
});
test('scenery: a drawing sheet exists, every kind of prop but the line-drawn trees has a sheet, and a drawing on a prop is kept', () => {
  assert.ok(PROP_BY_ID.sheet); const sh = newProp('sheet'); assert.equal(sh.kind, 'sheet'); assert.equal(propSheet(sh).length, 4); assert.equal(propParts(sh).image.sheet, true);
  for (const id of Object.keys(PROP_BY_ID)) { const q = newProp(id); const s = propSheet(q); if (q.kind === 'ltree' || q.kind === 'lpine' || q.kind === 'lbush') assert.equal(s, null, id); else { assert.equal(s.length, 4, id); assert.ok(s.every((p) => p.every(Number.isFinite)), id); assert.ok(s[2][1] > s[0][1], `${id} stands up`); } }
  const box = newProp('wall'); const front = propSheet(box); assert.ok(front.every((p) => Math.abs(p[2] - (box.z + box.d / 2)) < 1e-9), 'the front face is the one toward you');
  const raw = { actors: [], props: [{ ...sh, ink: { replace: false, strokes: [{ c: '#ff0000', w: 0.02, a: 1, fill: false, pts: [[0.1, 0.1], [0.5, 0.5]] }] } }, { ...newProp('box'), ink: { strokes: [] } }] };
  const out = cleanScene(raw, ['human'], {}); assert.equal(out.props[0].ink.strokes.length, 1); assert.equal(out.props[0].ink.strokes[0].c, '#ff0000'); assert.equal(out.props[1].ink, undefined);
});

import { touchesEdge } from '../src/ink.js';
test('a filled region that reaches the edge of its picture is one that was not closed in', () => {
  const w = 6; const h = 5; const m = (cells) => { const a = new Uint8Array(w * h); for (const [x, y] of cells) a[y * w + x] = 1; return a; };
  assert.equal(touchesEdge(m([[2, 2], [3, 2]]), w, h), false); assert.equal(touchesEdge(m([[2, 2], [2, 0]]), w, h), true); assert.equal(touchesEdge(m([[5, 3]]), w, h), true); assert.equal(touchesEdge(m([[0, 4]]), w, h), true); assert.equal(touchesEdge(m([]), w, h), false);
});

import { segmentAt } from '../src/ink.js';
test('which piece of a part a point is on: the outline it is inside, otherwise the nearest', () => {
  const thigh = [[0, 0], [10, 0], [10, 20], [0, 20]]; const shin = [[0, 22], [10, 22], [10, 44], [0, 44]];
  assert.equal(segmentAt([thigh, shin], 5, 10), 0); assert.equal(segmentAt([thigh, shin], 5, 30), 1); assert.equal(segmentAt([thigh, shin], 30, 40), 1, 'outside both: nearest'); assert.equal(segmentAt([thigh, shin], 5, 21), 0); assert.equal(segmentAt([thigh], 99, 99), 0);
});
test('a stroke remembers the piece it was drawn on, and a stroke with none is on the first', () => {
  assert.equal(cleanStroke({ pts: [[0, 0], [1, 1]], g: 1 }).g, 1); assert.equal(cleanStroke({ pts: [[0, 0], [1, 1]] }).g, undefined); assert.equal(cleanStroke({ pts: [[0, 0], [1, 1]], g: 99 }).g, 7); assert.equal(cleanStroke({ pts: [[0, 0], [1, 1]], g: 0 }).g, undefined);
});
