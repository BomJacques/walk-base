import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { newItem } from '../src/attach.js';
import { simulateStrip, stripSims, cleanPhys, STRIP_DEFAULTS } from '../src/physics.js';

const still = (n, x = 0) => Array.from({ length: n }, () => ({ x, y: 1, dir: [1, 0] }));
const lenOk = (nodes, seg, tol = 2e-3) => nodes.every((_, i) => i === 0 || Math.abs(Math.hypot(nodes[i][0] - nodes[i - 1][0], nodes[i][1] - nodes[i - 1][1]) - seg) < tol);

test('a strip on a still anchor hangs straight down and keeps its length', () => {
  const f = simulateStrip(still(24), { ...STRIP_DEFAULTS, gusts: 0 }, 0.7, { warm: 4 });
  const last = f[23]; const tip = last[last.length - 1];
  assert.ok(Math.abs(tip[0]) < 0.01, `tip x ${tip[0]}`);
  assert.ok(Math.abs(tip[1] + 0.7) < 0.02, `tip y ${tip[1]}`);
  assert.ok(lenOk(last, 0.7 / 7));
});

test('gravity off with a stiff strip holds the rest direction', () => {
  const f = simulateStrip(still(12), { ...STRIP_DEFAULTS, gravity: 0, stiff: 1, angle: 45, gusts: 0 }, 0.6, { warm: 2 });
  const tip = f[11][7];
  assert.ok(tip[0] > 0.3 && tip[1] < -0.3, `tip ${tip}`); // swung forward of straight down
});

test('moving forward trails the strip behind; wind pushes it forward', () => {
  const run = Array.from({ length: 24 }, (_, i) => ({ x: i * 0.06, y: 1, dir: [1, 0] })); // 1.44 legs per second
  const calm = simulateStrip(run, { ...STRIP_DEFAULTS, gusts: 0 }, 0.7, { warm: 1, travel: 24 * 0.06 });
  const tip = calm[23][7];
  assert.ok(tip[0] < -0.05, `trails behind ${tip[0]}`);
  const blown = simulateStrip(still(24), { ...STRIP_DEFAULTS, wind: 1, gusts: 0 }, 0.7, { warm: 3 })[23][7];
  const none = simulateStrip(still(24), { ...STRIP_DEFAULTS, wind: 0, gusts: 0 }, 0.7, { warm: 3 })[23][7];
  assert.ok(blown[0] > none[0] + 0.1, `wind ${blown[0]} vs ${none[0]}`);
  assert.ok(lenOk(calm[23], 0.7 / 7));
});

test('a looping cycle settles into the same loop however long it is run in', () => {
  const sway = Array.from({ length: 24 }, (_, i) => ({ x: 0.1 * Math.sin((i / 24) * Math.PI * 2), y: 1 + 0.03 * Math.sin((i / 12) * Math.PI * 2), dir: [1, 0] }));
  const a = simulateStrip(sway, STRIP_DEFAULTS, 0.6, { warm: 6 }); const b = simulateStrip(sway, STRIP_DEFAULTS, 0.6, { warm: 12 });
  let worst = 0; a.forEach((fr, f) => fr.forEach((p, i) => { worst = Math.max(worst, Math.hypot(p[0] - b[f][i][0], p[1] - b[f][i][1])); }));
  assert.ok(worst < 0.01, `worst ${worst}`);
});

test('the simulation of a walking figure is repeatable, cached, and follows edits', () => {
  const p = { ...DEFAULTS, rig: 'human', motion: {} };
  const it = newItem('strip', { part: 'spine.upper', seg: null, side: null }, { id: 'cape1' });
  const a = stripSims(p, [it]).get('cape1'); const b = stripSims(p, [it]).get('cape1');
  assert.ok(a && a === b, 'cached');
  assert.equal(a.frames.length, Math.round(p.cycleFrames));
  const tips = a.frames.map((f) => f.nodes[f.nodes.length - 1][0]);
  assert.ok(Math.max(...tips) - Math.min(...tips) > 0.02, 'the tip moves through the cycle');
  assert.ok(a.frames.every((f) => lenOk(f.nodes, it.h / (it.phys.nodes - 1), 5e-3)), 'length kept every frame');
  const it2 = { ...it, phys: { ...it.phys, gravity: 0.2 } };
  const c = stripSims(p, [it2]).get('cape1');
  assert.notEqual(c, a); assert.notDeepEqual(c.frames[5].nodes, a.frames[5].nodes);
  const moved = stripSims({ ...p, motion: { 'pelvis.y': { amount: 3 } } }, [it]).get('cape1');
  assert.notEqual(moved, c);
});

test('the dog can wear one too, and a part that is missing gives none', () => {
  const d = { ...DEFAULTS, rig: 'dog', motion: {} };
  const it = newItem('strip', { part: 'dog.spine3', seg: null, side: null }, { id: 'd1' });
  assert.equal(stripSims(d, [it]).get('d1')?.frames.length, Math.round(d.cycleFrames));
  const bad = newItem('strip', { part: 'dog.ear', seg: null, side: 'R' }, { id: 'd2' });
  assert.ok(stripSims({ ...d, rig: 'human' }, [bad]).get('d2') === undefined);
});

test('settings are forced into range', () => {
  const c = cleanPhys({ nodes: 99, stiff: -3, wind: 'x', gusts: 2.6 });
  assert.equal(c.nodes, 16); assert.equal(c.stiff, 0); assert.equal(c.wind, STRIP_DEFAULTS.wind); assert.equal(c.gusts, 3);
});
