import test from 'node:test';
import assert from 'node:assert/strict';
import { SHADOW_MODES, hasGround, hasDrop, rgbaOf, newShadow, cleanShadow, stageDrop, groundOval, groundStrength, castShadow } from '../src/shadow.js';
import { STYLE_DEFAULTS } from '../src/draw.js';
import { CONTROLS } from '../src/controls.js';
import { newItem } from '../src/attach.js';
import { newProp, newActor, cleanScene } from '../src/scene.js';

test('the stage starts with no shadow, and each mode turns on the right kinds', () => {
  assert.equal(STYLE_DEFAULTS.shadowMode, 'off'); assert.deepEqual(SHADOW_MODES, ['off', 'ground', 'drop', 'both']);
  assert.deepEqual(['off', 'ground', 'drop', 'both'].map((m) => [hasGround({ shadowMode: m }), hasDrop({ shadowMode: m })]), [[false, false], [true, false], [false, true], [true, true]]);
  assert.equal(stageDrop({ shadowMode: 'ground' }).on, false); const d = stageDrop({ shadowMode: 'drop', shadowX: 5, shadowY: 9, shadowBlur: 3, shadowColor: '#112233', shadowOpacity: 0.5 });
  assert.deepEqual(d, { on: true, x: 5, y: 9, blur: 3, color: '#112233', opacity: 0.5 });
});

test('every shadow setting is a control in the View tab, with a default inside its range', () => {
  for (const id of ['shadowMode', 'shadowOpacity', 'shadowBlur', 'shadowX', 'shadowY', 'shadowSize', 'shadowColor', 'lineBoil', 'boilRate', 'lineDash', 'lineJoin', 'lineDepth', 'lineOffset']) {
    const c = CONTROLS.find((x) => x.id === id && x.scope === 's'); assert.ok(c && c.tab === 'View', id); assert.ok(id in STYLE_DEFAULTS, id);
    if (c.type === 'number') assert.ok(STYLE_DEFAULTS[id] >= c.min && STYLE_DEFAULTS[id] <= c.max, id); if (c.type === 'enum') assert.ok(c.options.includes(STYLE_DEFAULTS[id]), id);
  }
});

test('colours become rgba, and a bad one falls back to black', () => {
  assert.equal(rgbaOf('#ff8000', 0.5), 'rgba(255,128,0,0.5)'); assert.equal(rgbaOf('nonsense', 2), 'rgba(0,0,0,1)'); assert.equal(rgbaOf('#000000', -1), 'rgba(0,0,0,0)');
});

test('an attachment has a drop shadow of its own, off to begin with, and a saved one is cleaned', () => {
  const it = newItem('rect', { part: 'head' }); assert.deepEqual(it.shadow, newShadow()); assert.equal(it.shadow.on, false);
  const s = cleanShadow({ on: 1, x: 500, y: -500, blur: -3, color: 'red', opacity: 7 }); assert.deepEqual(s, { on: true, x: 60, y: -60, blur: 0, color: '#000000', opacity: 1 });
  assert.deepEqual(cleanShadow(null), newShadow()); assert.deepEqual(cleanShadow('x'), newShadow());
});

test('the ground oval lies on the ground and is as wide as asked', () => {
  const o = groundOval([2, 0.5, -1], 0.4, 0.1, 16); assert.equal(o.length, 16);
  assert.ok(o.every((p) => p[1] === 0.5)); const xs = o.map((p) => p[0]); const zs = o.map((p) => p[2]);
  assert.ok(Math.abs(Math.max(...xs) - 2.4) < 1e-9 && Math.abs(Math.min(...xs) - 1.6) < 1e-9 && Math.abs(Math.max(...zs) - (-0.9)) < 1e-9);
});

test('the ground shadow fades as the feet leave the ground', () => {
  assert.equal(groundStrength(0), 1); assert.equal(groundStrength(-1), 1); assert.ok(groundStrength(0.2) < 1 && groundStrength(0.2) > groundStrength(1) && groundStrength(1) > groundStrength(5) && groundStrength(5) > 0);
});

test('without a canvas, or when off, a shadow just draws the thing', () => {
  let n = 0; const fake = { canvas: null }; assert.equal(castShadow(fake, { on: true }, 1, () => { n++; return 7; }), 7); assert.equal(castShadow(fake, { on: false }, 1, () => { n++; return 8; }), 8); assert.equal(n, 2);
});

test('scenery and scene figures can opt out of casting a shadow, and it is kept', () => {
  assert.equal(newProp('box').noShadow, false); assert.equal(newActor('human', 'x', {}, {}).noShadow, false);
  const s = cleanScene({ props: [{ ...newProp('ball'), noShadow: true }], actors: [{ ...newActor('human', 'a', {}, {}), noShadow: 1 }] }, ['human'], {});
  assert.equal(s.props[0].noShadow, true); assert.equal(s.actors[0].noShadow, true);
});
