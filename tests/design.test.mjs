import test from 'node:test';
import assert from 'node:assert/strict';
import { partKey, newSkin, newPart, cleanSkin, cleanPart, cleanDesign, isPlain, cellFor, shapeFrame, toUV, fromUV, cellToUV, uvToCell, skinMatrix, atlasLayout, atlasSkin, BLENDS } from '../src/design.js';

const close = (a, b, m = '', e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} vs ${b}`);
const rect = (cx, cy, L, W, ang = 0) => [[-L / 2, -W / 2], [L / 2, -W / 2], [L / 2, W / 2], [-L / 2, W / 2]].map(([x, y]) => [cx + x * Math.cos(ang) - y * Math.sin(ang), cy + x * Math.sin(ang) + y * Math.cos(ang)]);

test('a part says nothing until it is given a look, and plain parts are not kept', () => {
  assert.equal(isPlain(newPart()), true); assert.equal(isPlain({ ...newPart(), fill: '#ff0000' }), false); assert.equal(isPlain({ ...newPart(), skin: newSkin('x') }), false);
  assert.equal(isPlain({ ...newPart(), shadow: { ...newPart().shadow, on: true } }), false); assert.equal(isPlain({ ...newPart(), visible: false }), false); assert.equal(partKey('leg', 'R'), 'leg.R'); assert.equal(partKey('head', null), 'head');
});

test('a saved design is cleaned: colours, ranges, sheets and parts that mean nothing', () => {
  const s = cleanSkin({ img: 'abc', cols: 99, rows: 0, cell: 500, fit: 'warp', su: 0, rot: 999, blend: 'xor', anim: 'spin', cellFrames: 0, flip: 1 });
  assert.equal(s.cols, 16); assert.equal(s.rows, 1); assert.equal(s.cell, 15); assert.equal(s.fit, 'stretch'); assert.equal(s.su, 0.05); assert.equal(s.rot, 360); assert.equal(s.blend, 'source-over'); assert.equal(s.anim, 'none'); assert.equal(s.cellFrames, 1); assert.equal(s.flip, true);
  assert.equal(cleanSkin({}), null); assert.equal(cleanSkin({ img: '' }), null); assert.equal(cleanSkin(null), null);
  const p = cleanPart({ fill: 'red', line: '#ABCDEF', lineW: 99, opacity: -1, visible: false, skin: { img: 'i' } }); assert.equal(p.fill, ''); assert.equal(p.line, '#abcdef'); assert.equal(p.lineW, 5); assert.equal(p.opacity, 0); assert.equal(p.visible, false); assert.equal(p.skin.img, 'i');
  const d = cleanDesign({ human: { head: { fill: '#112233' }, plain: {}, 'leg.R': { skin: { img: 'x' } } }, robot: { head: { fill: '#112233' } }, dog: 'junk' }, ['human', 'dog']);
  assert.deepEqual(Object.keys(d), ['human']); assert.deepEqual(Object.keys(d.human).sort(), ['head', 'leg.R']); assert.deepEqual(cleanDesign(null, ['human']), {}); assert.ok(BLENDS.length >= 3);
});

test('a sprite sheet shows its chosen cell, or plays through its cells', () => {
  const sk = { ...newSkin('i'), cols: 3, rows: 2, cell: 4 }; assert.equal(cellFor(sk, 0), 4); assert.equal(cellFor(sk, 99), 4); assert.equal(cellFor({ ...sk, cell: 99 }, 0), 5, 'kept inside the sheet');
  const loop = { ...sk, anim: 'loop', cellFrames: 2 }; assert.deepEqual([0, 1, 2, 3, 4, 5, 10, 11, 12].map((f) => cellFor(loop, f)), [0, 0, 1, 1, 2, 2, 5, 5, 0]);
  const pp = { ...sk, cols: 4, rows: 1, anim: 'pingpong', cellFrames: 1 }; assert.deepEqual(Array.from({ length: 9 }, (_, f) => cellFor(pp, f)), [0, 1, 2, 3, 2, 1, 0, 1, 2]);
  assert.equal(cellFor({ ...newSkin('i'), anim: 'loop' }, 7), 0, 'one cell is always that cell');
});

test('the UV box of a part runs from its joint toward its middle, and is as big as the part', () => {
  const pts = rect(100, 50, 80, 20, 0.5); const pivot = { x: 100 - 40 * Math.cos(0.5), y: 50 - 40 * Math.sin(0.5) };
  const f = shapeFrame(pts, pivot); close(f.L, 80, 'length', 1e-6); close(f.W, 20, 'width', 1e-6); close(f.ax, Math.cos(0.5), 'axis x', 1e-9); close(f.ay, Math.sin(0.5), 'axis y', 1e-9); close(f.cx, 100, 'centre', 1e-6);
  const back = shapeFrame(pts, { x: 100 + 40 * Math.cos(0.5), y: 50 + 40 * Math.sin(0.5) }); close(back.ax, -Math.cos(0.5), 'from the other end, the other way');
  const lone = shapeFrame(pts, null); assert.ok(lone.ax >= -1e-9 || Math.abs(lone.ax) < 1, 'no joint: still a direction'); close(Math.hypot(lone.ax, lone.ay), 1, 'unit');
  for (const [x, y] of pts) { const [u, v] = toUV(f, x, y); assert.ok(u >= -1e-9 && u <= 1 + 1e-9 && v >= -1e-9 && v <= 1 + 1e-9, 'corners inside the box'); }
  const [u, v] = toUV(f, 100, 50); close(u, 0.5, 'middle', 1e-6); close(v, 0.5, 'middle', 1e-6);
  for (const [a, b] of [[0.1, 0.9], [0.5, 0.5], [1, 0]]) { const [x, y] = fromUV(f, a, b); const [a2, b2] = toUV(f, x, y); close(a2, a, 'round trip'); close(b2, b, 'round trip'); }
});

test('the skin turns with the part: the same spot of the picture stays on the same spot of the part as it swings', () => {
  const sk = { ...newSkin('i'), u: 0.1, v: -0.05, su: 0.8, sv: 1.3, rot: 25 };
  for (const ang of [0, 0.7, 2.1, -1]) {
    const pivot = { x: 100 - 40 * Math.cos(ang), y: 50 - 40 * Math.sin(ang) }; const fr = shapeFrame(rect(100, 50, 80, 20, ang), pivot);
    const M = skinMatrix(fr, sk, 200, 100); const at = (px, py) => [M[0] * px + M[2] * py + M[4], M[1] * px + M[3] * py + M[5]];
    const p = at(60, 30); const [s, t] = [60 / 200, 30 / 100]; const [u, v] = cellToUV(sk, s, t); const q = fromUV(fr, u, v); close(p[0], q[0], `x at ${ang}`, 1e-6); close(p[1], q[1], `y at ${ang}`, 1e-6);
    const local = toUV(fr, p[0], p[1]); const ref = (() => { const f0 = shapeFrame(rect(100, 50, 80, 20, 0), { x: 60, y: 50 }); const M0 = skinMatrix(f0, sk, 200, 100); const a0 = [M0[0] * 60 + M0[2] * 30 + M0[4], M0[1] * 60 + M0[3] * 30 + M0[5]]; return toUV(f0, a0[0], a0[1]); })();
    close(local[0], ref[0], `same u at ${ang}`, 1e-6); close(local[1], ref[1], `same v at ${ang}`, 1e-6);
  }
});

test('a plain skin fills the part exactly, and uvToCell undoes cellToUV', () => {
  const fr = shapeFrame(rect(100, 50, 80, 20, 0), { x: 60, y: 50 }); const M = skinMatrix(fr, newSkin('i'), 80, 20);
  const at = (px, py) => [M[0] * px + M[2] * py + M[4], M[1] * px + M[3] * py + M[5]]; const a = at(0, 0); const b = at(80, 20);
  close(a[0], 60, 'left', 1e-6); close(a[1], 40, 'top', 1e-6); close(b[0], 140, 'right', 1e-6); close(b[1], 60, 'bottom', 1e-6);
  const sk = { ...newSkin('i'), u: 0.2, v: 0.1, su: 0.5, sv: 2, rot: 40, flip: true };
  for (const [s, t] of [[0.2, 0.7], [0.5, 0.5], [1, 0]]) { const [u, v] = cellToUV(sk, s, t); const [s2, t2] = uvToCell(sk, u, v); close(s2, s, 'round trip s'); close(t2, t, 'round trip t'); }
  const fl = cellToUV({ ...newSkin('i'), flip: true }, 0, 0.5); close(fl[0], 1, 'flipped: the left of the picture is on the right');
});

test('a sheet of UV cells has one cell for each part, in a grid', () => {
  const keys = ['head', 'neck', 'arm.R', 'arm.L', 'leg.R']; const l = atlasLayout(keys);
  assert.equal(l.cols * l.rows >= keys.length, true); assert.equal(l.cols, 3); assert.equal(l.rows, 2); assert.deepEqual(keys.map((k) => l.cells[k]), [0, 1, 2, 3, 4]);
  const sk = atlasSkin('img1', l, 'arm.L'); assert.equal(sk.cols, 3); assert.equal(sk.rows, 2); assert.equal(sk.cell, 3); assert.equal(sk.fit, 'stretch'); assert.deepEqual(atlasLayout([]), { cols: 1, rows: 1, cells: {} });
});

test('ink: strokes are cleaned, capped and thinned; a part with ink is not plain', async () => {
  const { cleanInk, cleanPart, isPlain, thinStroke, MAX_STROKES, MAX_STROKE_PTS } = await import('../src/design.js');
  assert.equal(cleanInk(null), null); assert.equal(cleanInk({ strokes: [] }), null); assert.equal(cleanInk({ strokes: [{ pts: 'x' }, { pts: [] }] }), null);
  const k = cleanInk({ replace: 1, strokes: [{ c: 'red', w: 99, a: 5, pts: [[0.12345, 0.5], [NaN, 1], [9, -9]] }] });
  assert.equal(k.replace, true); assert.equal(k.strokes.length, 1); assert.deepEqual(k.strokes[0].pts, [[0.123, 0.5], [4, -3]]); assert.equal(k.strokes[0].c, '#000000'); assert.equal(k.strokes[0].w, 0.6); assert.equal(k.strokes[0].a, 1);
  const many = cleanInk({ strokes: Array.from({ length: MAX_STROKES + 20 }, () => ({ pts: Array.from({ length: MAX_STROKE_PTS + 50 }, (_, i) => [i / 1000, 0.5]) })) });
  assert.equal(many.strokes.length, MAX_STROKES); assert.equal(many.strokes[0].pts.length, MAX_STROKE_PTS);
  const p = cleanPart({ ink: { strokes: [{ c: '#ff0000', pts: [[0.5, 0.5]] }] } }); assert.equal(isPlain(p), false); assert.equal(isPlain(cleanPart({})), true);
  assert.equal(p.ink.strokes[0].c, '#ff0000');
  const line = Array.from({ length: 100 }, (_, i) => [i / 100, 0]); const th = thinStroke(line, 0.05); assert.ok(th.length < 25 && th.length > 10); assert.deepEqual(th[th.length - 1], line[99]); assert.deepEqual(th[0], line[0]);
  assert.deepEqual(thinStroke([[0, 0], [0, 0.001]], 1), [[0, 0], [0, 0.001]]);
});

test('a bent part has a frame that follows its curve, and a point goes there and back', async () => {
  const { spineFrame, toUV, fromUV, partFrame } = await import('../src/design.js');
  const pts = Array.from({ length: 21 }, (_, i) => { const t = i / 20; return { x: 100 * t, y: 30 * Math.sin(t * Math.PI) }; }); const fr = spineFrame(pts, pts.map(() => 5));
  assert.equal(fr.spine, true); assert.ok(fr.L > 100 && fr.W === 10);
  for (const [u, v] of [[0, 0.5], [0.5, 0.5], [1, 0.5], [0.3, 0.2], [0.7, 0.9], [0.5, 0.75]]) { const [x, y] = fromUV(fr, u, v); const [u2, v2] = toUV(fr, x, y); assert.ok(Math.abs(u2 - u) < 0.03 && Math.abs(v2 - v) < 0.06, `${u},${v} -> ${u2},${v2}`); }
  const mid = fromUV(fr, 0.5, 0.5); assert.ok(Math.abs(mid[0] - 50) < 3 && Math.abs(mid[1] - 30) < 1.5, 'the middle of the curve');
  const off = fromUV(fr, 0.5, 0.75); assert.ok(Math.hypot(off[0] - mid[0], off[1] - mid[1]) > 2.4 && Math.hypot(off[0] - mid[0], off[1] - mid[1]) < 2.6, 'a quarter across is half a half-width off the line');
  const past = fromUV(fr, 1.2, 0.5); assert.ok(past[0] > 100, 'beyond the end it carries straight on');
  const sh = { pts: [[0, 0], [10, 0], [10, 10]], spine: pts, spineR: pts.map(() => 5) }; assert.equal(partFrame(sh, null).spine, true); assert.equal(partFrame({ pts: sh.pts }, null).spine, undefined);
});
test('a part committed with nothing drawn is kept (a blank part), and a scene figure keeps its drawing', async () => {
  const { cleanInk, cleanPart, isPlain } = await import('../src/design.js'); const { cleanScene } = await import('../src/scene.js');
  assert.deepEqual(cleanInk({ replace: true, blank: true, strokes: [] }), { replace: true, blank: true, strokes: [] }); assert.equal(cleanInk({ replace: true, strokes: [] }), null); assert.equal(cleanInk({ replace: false, blank: true, strokes: [] }), null); assert.equal(isPlain(cleanPart({ ink: { replace: true, blank: true, strokes: [] } })), false);
  const defaults = { cycleFrames: 24 };
  const sc = cleanScene({ actors: [{ id: 'a1', fig: 'human', p: {}, design: { head: { ink: { strokes: [{ c: '#ff0000', pts: [[0.5, 0.5], [0.6, 0.5]] }] } }, junk: 5 } }, { id: 'a2', fig: 'human', p: {} }] }, ['human'], defaults);
  assert.equal(sc.actors[0].design.head.ink.strokes.length, 1); assert.equal(sc.actors[0].design.head.ink.strokes[0].c, '#ff0000'); assert.equal('design' in sc.actors[1], false);
});
