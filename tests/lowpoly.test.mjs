import test from 'node:test';
import assert from 'node:assert/strict';
import { capsuleFacets, ellipsoidFacets, chainFacets, slabFacets, withFacets } from '../src/lowpoly.js';
import { clayOutline, roundCorners } from '../src/clay.js';
import { STYLE_DEFAULTS } from '../src/draw.js';
import { CONTROLS } from '../src/controls.js';

// The camera looks along -z from +z: x to the right, y up on the world and down on the screen, and a larger d is nearer.
const sc = 100; const S = (p) => ({ x: p[0] * sc, y: -p[1] * sc, d: p[2] });
const len = (n) => Math.hypot(n[0], n[1], n[2]);

test('a limb is a solid of flat facets: only the ones that face the camera are kept, nearest last, each with a unit normal', () => {
  const f = capsuleFacets(S, sc, [0, 0, 0], [0, 1, 0], 0.1, 0.08, 6);
  assert.ok(f.length >= 5 && f.length <= 14, `${f.length} facets`);
  for (const q of f) { assert.ok(q.n[2] >= -0.02, 'no back faces'); assert.ok(Math.abs(len(q.n) - 1) < 0.03, `unit normal ${len(q.n)}`); assert.ok(q.pts.length >= 3 && q.pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1]))); }
  for (let i = 1; i < f.length; i++) assert.ok(f[i].d >= f[i - 1].d - 1e-12, 'back to front');
  const right = f.filter((q) => q.n[0] > 0.5); const left = f.filter((q) => q.n[0] < -0.5); assert.ok(right.length && left.length, 'a side facing each way');
  assert.ok(Math.max(...f.map((q) => q.n[2])) > 0.95, 'one facing straight at the camera');
});

test('the facets turn with the camera: from the front and from the side the same limb faces different ways', () => {
  const side = (p) => ({ x: p[2] * sc, y: -p[1] * sc, d: -p[0] }); // looking from the other side
  const a = capsuleFacets(S, sc, [0, 0, 0], [0, 1, 0], 0.1, 0.1, 6); const b = capsuleFacets(side, sc, [0, 0, 0], [0, 1, 0], 0.1, 0.1, 6);
  const key = (f) => f.map((q) => q.n.map((v) => v.toFixed(1)).join()).sort().join('|'); assert.notEqual(key(a), key(b));
  assert.ok(a.length > 0 && b.length > 0);
  const cross = capsuleFacets(S, sc, [0, 0, 0], [1, 0, 0], 0.1, 0.1, 6); assert.ok(cross.some((q) => q.n[1] !== 0), 'a limb lying sideways has facets above and below');
});

test('a sloping side is lit by its slope: a facet turned up has a negative y (up the screen), one turned down a positive', () => {
  const f = capsuleFacets(S, sc, [0, 0, 0], [1, 0, 0], 0.1, 0.1, 8);
  assert.ok(f.some((q) => q.n[1] < -0.5), 'top'); assert.ok(f.some((q) => q.n[1] > 0.5), 'underneath');
});

test('heads, bent tubes and body slabs make facets too, and the more sides the rounder', () => {
  const ball = ellipsoidFacets(S, sc, [0, 0, 0], (q) => q, [0.2, 0.25, 0.2], 6); assert.ok(ball.length > 6);
  const path = Array.from({ length: 10 }, (_, i) => [Math.sin(i / 3) * 0.2, i * 0.1, Math.cos(i / 3) * 0.05]); const tube = chainFacets(S, sc, path, Array(10).fill(0.05), 6); assert.ok(tube.length > 8);
  const ring = (y, r, n = 6) => Array.from({ length: n }, (_, i) => [r * Math.cos((i / n) * 6.2832), y, r * Math.sin((i / n) * 6.2832)]); assert.ok(slabFacets(S, sc, ring(0, 0.1), ring(0.2, 0.12)).length >= 3);
  assert.equal(chainFacets(S, sc, [[0, 0, 0]], [0.1], 6).length, 0, 'one point makes nothing');
  assert.ok(capsuleFacets(S, sc, [0, 0, 0], [0, 0, 0], 0.1, 0.1, 6).length > 0, 'a limb of no length is a ball, not a crash');
  const spread = (n) => { const f = capsuleFacets(S, sc, [0, 0, 0], [0, 1, 0], 0.1, 0.1, n); return f.length; }; assert.ok(spread(12) > spread(4));
});

test('a shape with facets takes its outline from them', () => {
  const f = capsuleFacets(S, sc, [0, 0, 0], [0, 1, 0], 0.1, 0.1, 6); const sh = withFacets({ pts: [[0, 0], [1, 0], [1, 1]] }, f);
  assert.equal(sh.facets, f); const xs = sh.pts.map((p) => p[0]); assert.ok(Math.min(...xs) <= -9 && Math.max(...xs) >= 9, 'about as wide as the limb');
  const empty = withFacets({ pts: [[0, 0]] }, []); assert.equal(empty.facets, undefined);
});

const ellipse = (rx, ry, n = 24, rot = 0) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; const x = rx * Math.cos(t); const y = ry * Math.sin(t); return [x * Math.cos(rot) - y * Math.sin(rot) + 200, x * Math.sin(rot) + y * Math.cos(rot) + 100]; });
const area = (p) => Math.abs(p.reduce((t, q, i) => { const r = p[(i + 1) % p.length]; return t + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;

test('clay rounds the corners and makes the edge lumpy, about the same size as before', () => {
  const box = [[0, 0], [60, 0], [60, 20], [0, 20]]; const r = roundCorners(box, 2); assert.equal(r.length, 16); assert.ok(area(r) < area(box) && area(r) > area(box) * 0.8, 'corners cut, not much lost');
  const limb = ellipse(60, 12); const c = clayOutline(limb, 'legR', 1, 0.6);
  assert.ok(c.length > limb.length && c.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])));
  assert.ok(Math.abs(area(c) / area(limb) - 1) < 0.2, `size kept: ${area(c) / area(limb)}`);
  const plain = clayOutline(limb, 'legR', 1, 0); assert.ok(area(plain) > 0); const dev = c.reduce((t, p, i) => Math.max(t, Math.hypot(p[0] - plain[i][0], p[1] - plain[i][1])), 0); assert.ok(dev > 0.8, `lumpy: ${dev}`); assert.ok(dev < 8, `not mangled: ${dev}`);
});

test('the lumps are the same every time, differ from shape to shape, and turn with the shape', () => {
  const limb = ellipse(60, 12); const a = clayOutline(limb, 'legR', 1, 0.6); assert.deepEqual(clayOutline(limb, 'legR', 1, 0.6), a);
  const b = clayOutline(limb, 'armL', 1, 0.6); assert.ok(a.some((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]) > 0.3), 'another part has other lumps');
  const rot = 0.6; const turned = clayOutline(ellipse(60, 12, 24, rot), 'legR', 1, 0.6); const c0 = [200, 100];
  const back = a.map(([x, y]) => { const dx = x - c0[0]; const dy = y - c0[1]; return [c0[0] + dx * Math.cos(rot) - dy * Math.sin(rot), c0[1] + dx * Math.sin(rot) + dy * Math.cos(rot)]; });
  const worst = back.reduce((t, p, i) => Math.max(t, Math.hypot(p[0] - turned[i][0], p[1] - turned[i][1])), 0); assert.ok(worst < 1.5, `turning the shape turns its lumps with it (${worst.toFixed(2)} px apart)`);
  assert.equal(clayOutline([[0, 0], [1, 1]], 'x').length, 2, 'too few points: left alone');
});

test('Block size and Facets are controls, with defaults inside their ranges', () => {
  for (const [id, lo, hi] of [['blockSize', 3, 40], ['polySides', 4, 12]]) { const c = CONTROLS.find((x) => x.id === id && x.scope === 's'); assert.ok(c && c.tab === 'View' && c.group === 'Blocks and facets', id); assert.equal(c.min, lo); assert.equal(c.max, hi); assert.ok(STYLE_DEFAULTS[id] >= c.min && STYLE_DEFAULTS[id] <= c.max, id); }
});
