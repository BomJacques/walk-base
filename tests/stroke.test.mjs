import test from 'node:test';
import assert from 'node:assert/strict';
import { isRich, keepWidth, roundP, widthFactor, speedToP, lagFor, newSmoother, smoothStep, decimate, densify, halfWidths } from '../src/stroke.js';
import { paintStrokes, mapStroke, mirrorStroke } from '../src/ink.js';
import { cleanStroke, cleanInk } from '../src/design.js';

const run = (pts, strength, dt = 8, finish = true) => { const st = newSmoother(); const out = pts.map(([x, y], i) => smoothStep(st, x, y, null, i * dt, strength)); if (finish) { const [x, y] = pts[pts.length - 1]; for (const f of [0.35, 0.6, 0.8, 1]) out.push(smoothStep(st, x, y, null, 0, strength, f)); } return out; };
const line = (n, step) => Array.from({ length: n }, (_, i) => [i * step, 0]);
const recorder = () => { const calls = []; const ctx = new Proxy({ calls, globalAlpha: 1, createRadialGradient: () => ({ addColorStop() {} }) }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); }), set: (t, k, v) => { calls.push(['set ' + String(k), v]); return true; } }); return { ctx, calls }; };

test('smoothing 0 follows the pen exactly; more smoothing lags more', () => {
  const pts = Array.from({ length: 40 }, (_, i) => [i * 3, (i % 2) * 2]);
  assert.deepEqual(run(pts, 0, 8, false).map((r) => [r.x, r.y]), pts);
  const wobble = (s) => { const r = run(pts, s, 8, false); let t = 0; for (let i = 5; i < r.length; i++) t += Math.abs(r[i].y - r[i - 1].y); return t; };
  assert.ok(wobble(1) < wobble(0.5) && wobble(0.5) < wobble(0), 'jitter is taken out in proportion to the strength');
  assert.equal(lagFor(0), 0); assert.ok(lagFor(1) > lagFor(0.5));
});
test('the stabilised line starts where the pen went down and ends exactly where it lifted', () => {
  const pts = line(30, 4); const r = run(pts, 1);
  assert.deepEqual([r[0].x, r[0].y], [0, 0]);
  const last = r[r.length - 1]; assert.ok(Math.abs(last.x - 116) < 1e-9 && last.y === 0);
  assert.ok(r[29].x < 116 - 5, 'it lags behind the pen while drawing');
  assert.ok(r[3].x > 8, 'but the lag builds up gradually, so the beginning follows the pen');
});
test('the stabiliser does not depend on how often the events come', () => {
  const sparse = line(21, 6); const dense = line(61, 2); const a = run(sparse, 0.7, 24, false); const b = run(dense, 0.7, 8, false);
  const at = (r, x) => r.find((q) => q.x >= x) ; // the point where the smoothed line passes x = 60:
  assert.ok(Math.abs(a[20].x - b[60].x) < 3, `${a[20].x} ${b[60].x}`); assert.ok(at(a, 30) && at(b, 30));
});
test('with no pressure the width follows speed: thinner when quick; pressure is used as it is', () => {
  assert.ok(speedToP(0) > speedToP(1) && speedToP(1) > speedToP(3)); assert.ok(speedToP(0) <= 0.6 && speedToP(9) >= 0.35);
  const slow = run(line(30, 1), 0.5, 20, false); const fast = run(line(30, 20), 0.5, 4, false);
  assert.ok(slow[29].p > fast[29].p, 'slow is wider than fast');
  const st = newSmoother(); let r; for (let i = 0; i < 12; i++) r = smoothStep(st, i * 3, 0, 0.9, i * 8, 0.5); assert.ok(r.p > 0.8, 'real pressure comes through');
});
test('the width of a point: 0.5 is the width asked for; rounding to two decimals', () => {
  assert.ok(Math.abs(widthFactor(0.5) - 1) < 1e-9); assert.ok(widthFactor(0) < 0.5 && widthFactor(1) > 1.4); assert.equal(roundP(0.12345), 0.12); assert.equal(roundP(7), 1); assert.equal(roundP(-1), 0);
});
test('the round brush tapers a little at both ends; the brush pen to a fine point; the ends can be left alone', () => {
  const Q = Array.from({ length: 41 }, (_, i) => [i * 3, 0]); const F = Q.map(() => 0.5); const w = 8;
  const H = halfWidths(Q, F, w, 'round', 0, 0.6); const mid = H[20];
  assert.ok(Math.abs(mid - 4) < 1e-9); assert.ok(H[0] < mid * 0.6 && H[40] < mid * 0.6 && H[0] > 0.5, 'a soft tip, not a point');
  const T = halfWidths(Q, F, w, 'taper', 0, 0.6); assert.ok(T[0] < 1 && T[40] < 1 && T[20] > 3.9);
  const free = halfWidths(Q, F, w, 'round', 3, 0.6); assert.equal(free[0], mid); assert.equal(free[40], mid);
  assert.equal(halfWidths(Q, F, w, 'round', 1, 0.6)[0], mid); assert.ok(halfWidths(Q, F, w, 'round', 1, 0.6)[40] < mid);
  const thick = halfWidths(Q, F.map((_, i) => (i > 15 && i < 25 ? 1 : 0.5)), w, 'round', 0, 0.6); assert.ok(thick[20] > mid * 1.4, 'pressure widens it');
  const same = halfWidths(Q, F, w, 'round', 0, 0.6); assert.deepEqual(same, H, 'the same every time');
  assert.ok(halfWidths([[0, 0], [1, 0]], [0.5, 0.5], 0.1, 'round', 0, 0.6).every((x) => x >= 0.3), 'never thinner than the thinnest line');
});
test('a fast stroke with wide gaps is filled in along a curve, and the ends are kept', () => {
  const P = [[0, 0], [30, 20], [60, 20], [90, 0]]; const { Q, V } = densify(P, [0.2, 0.4, 0.6, 0.8]);
  assert.ok(Q.length > 15 && Q.length === V.length); assert.deepEqual(Q[0], [0, 0]); assert.deepEqual(Q[Q.length - 1], [90, 0]);
  assert.ok(Q.some(([x, y]) => x === 30 && y === 20), 'it passes through the points'); assert.ok(V[1] > 0.2 && V[1] < 0.4 || Q.length > 4);
  assert.equal(densify([[0, 0], [2, 0], [4, 0]], [0, 0, 0]).Q.length, 3, 'close points are left alone');
});
test('a stroke that has got long is thinned and keeps both ends', () => {
  const pts = Array.from({ length: 499 }, (_, i) => [i, i, 0.5]); const d = decimate(pts); assert.ok(d.length <= 251); assert.deepEqual(d[0], pts[0]); assert.deepEqual(d[d.length - 1], pts[498]);
});
test('points are [u, v] or [u, v, p]; the old format loads as it was and the new keeps p', () => {
  const old = cleanStroke({ c: '#112233', w: 0.04, a: 1, pts: [[0.1, 0.2], [0.3, 0.4]] }); assert.deepEqual(old.pts, [[0.1, 0.2], [0.3, 0.4]]); assert.ok(!isRich(old)); assert.equal(old.tp, undefined);
  const nw = cleanStroke({ c: '#112233', w: 0.04, a: 1, pts: [[0.1234, 0.2, 0.456], [0.3, 0.4, 2], [0.5, 0.6]], tp: 2 });
  assert.deepEqual(nw.pts, [[0.123, 0.2, 0.46], [0.3, 0.4, 1], [0.5, 0.6]]); assert.ok(isRich(nw)); assert.equal(nw.tp, 2);
  assert.equal(cleanStroke({ c: '#000000', pts: [[0, 0, 0.5], [1, 1, 0.5]], tp: 9 }).tp, 1, 'only the two end flags are kept');
  assert.equal(cleanStroke({ c: '#000000', pts: [[0, 0], [1, 1]], tp: 2 }).tp, undefined, 'a flag means nothing without widths');
  assert.deepEqual(cleanStroke({ pts: [[0, 0, 'x'], [1, 1, null]] }).pts, [[0, 0], [1, 1]]);
  const ink = cleanInk({ replace: true, strokes: [{ c: '#000000', pts: [[0.5, 0.5, 0.3], [0.6, 0.6, 0.3]] }] }); assert.deepEqual(ink.strokes[0].pts[1], [0.6, 0.6, 0.3]);
  assert.deepEqual(cleanStroke(JSON.parse(JSON.stringify(nw))), nw, 'saving and loading changes nothing');
});
test('moving, resizing and mirroring a stroke keep the width factors', () => {
  const s = { c: '#000000', w: 0.04, a: 1, fill: false, pts: [[0.2, 0.3, 0.7], [0.4, 0.5, 0.2], [0.5, 0.5]] };
  const m = mapStroke(s, ([u, v]) => [Math.round((u + 0.1) * 1000) / 1000, v], 2); assert.deepEqual(m.pts, [[0.3, 0.3, 0.7], [0.5, 0.5, 0.2], [0.6, 0.5]]); assert.equal(m.w, 0.08);
  const f = mirrorStroke(s, true); assert.deepEqual(f.pts.map((p) => p[2]), [0.7, 0.2, undefined]); assert.equal(f.pts[0][1], 0.7);
  assert.deepEqual(keepWidth([1, 2], [3, 4]), [3, 4]); assert.deepEqual(keepWidth([1, 2, 0.5], [3, 4]), [3, 4, 0.5]);
});
test('an old stroke is painted exactly as before; a new one is one filled ribbon at one opacity', () => {
  const pts2 = Array.from({ length: 20 }, (_, i) => [i * 5, Math.sin(i / 3) * 10]); const base = { c: '#000000', w: 0.05, a: 0.5, fill: false };
  const a = recorder(); paintStrokes(a.ctx, [{ ...base, pts: pts2 }], (u, v) => [u, v], 100); const names = a.calls.map((c) => c[0]);
  assert.ok(names.includes('stroke') && names.includes('quadraticCurveTo') && !names.includes('fill'), 'the old way: a stroked line');
  const b = recorder(); paintStrokes(b.ctx, [{ ...base, pts: pts2.map(([u, v]) => [u, v, 0.5]) }], (u, v) => [u, v], 100); const nb = b.calls.map((c) => c[0]);
  assert.equal(nb.filter((n) => n === 'fill').length, 1, 'one fill, so the stroke does not darken where it crosses itself'); assert.ok(!nb.includes('stroke'));
  assert.ok(b.calls.find((c) => c[0] === 'set globalAlpha' && c[1] === 0.5), 'at the stroke opacity');
  const c = recorder(); paintStrokes(c.ctx, [{ ...base, pts: pts2.map(([u, v]) => [u, v, 0.5]) }], (u, v) => [u, v], 100); assert.deepEqual(c.calls, b.calls, 'the same every time');
  for (const brush of ['marker', 'calligraphy', 'pencil', 'chalk', 'soft', 'dotted', 'dashed', 'taper']) { const r = recorder(); paintStrokes(r.ctx, [{ ...base, b: brush, pts: pts2.map(([u, v]) => [u, v, 0.6]) }], (u, v) => [u, v], 100); assert.ok(r.calls.length > 5, brush); }
  const one = recorder(); paintStrokes(one.ctx, [{ ...base, pts: [[5, 5, 0.5]] }], (u, v) => [u, v], 100); assert.ok(one.calls.some((c) => c[0] === 'arc'), 'a tap is a dot');
});
