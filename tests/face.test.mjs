import test from 'node:test';
import assert from 'node:assert/strict';
import { lidAt, eyeOutline, paintEyes, paintBrows, mouthOptions, EYE_BASE, EYE_STYLES, BROW_STYLES, MOUTH_STYLES } from '../src/face.js';
import { paintMouth } from '../src/mouth.js';
import { VISEMES as MOUTH_SHAPES } from '../src/lipsync.js';
import { STYLE_DEFAULTS } from '../src/draw.js';
import { CONTROLS } from '../src/controls.js';
import { wordsFor } from '../src/words.js';

/** A canvas that only keeps count of what was asked of it. */
const fakeCtx = () => { const log = { fill: 0, stroke: 0, pts: [], fills: [] }; const ctx = new Proxy({ log }, { get: (t, k) => (k === 'log' ? log : k === 'fill' ? () => { log.fill++; log.fills.push(t.fillStyle); } : k === 'stroke' ? () => { log.stroke++; } : k === 'moveTo' || k === 'lineTo' ? (x, y) => { log.pts.push([x, y]); } : typeof k === 'string' && !(k in t) ? () => {} : t[k]), set: (t, k, v) => { t[k] = v; return true; } }); return ctx; };
const map = ([z, y]) => ({ x: z * 100, y: -y * 100, d: 1 });
const o = { base: EYE_BASE.mannequin, lw: 2, line: '#000000', skin: '#eeeeee', u: 0.5 };

test('the defaults leave every figure as it was', () => {
  assert.equal(STYLE_DEFAULTS.eyeStyle, 'default'); assert.equal(STYLE_DEFAULTS.browStyle, 'none'); assert.equal(STYLE_DEFAULTS.mouthStyle, 'full'); assert.equal(STYLE_DEFAULTS.mouthShow, 'when speaking');
  const c = fakeCtx(); assert.equal(paintEyes(c, map, STYLE_DEFAULTS, o), false); assert.equal(paintBrows(c, map, STYLE_DEFAULTS, o), false); assert.equal(c.log.fill + c.log.stroke, 0, 'nothing is painted');
  const m = mouthOptions(STYLE_DEFAULTS, 2); assert.equal(m.lipK, 1); assert.equal(m.width, 1); assert.equal(m.smile, 0); assert.equal(m.lip, '#d98c8c');
});

test('every eye style paints two eyes, and they move with size, spacing, height and look', () => {
  for (const style of EYE_STYLES.filter((s) => s !== 'default')) {
    const c = fakeCtx(); assert.equal(paintEyes(c, map, { ...STYLE_DEFAULTS, eyeStyle: style }, o), true); assert.ok(c.log.fill + c.log.stroke >= 2, style);
    assert.ok(c.log.pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])), style);
    const xs = c.log.pts.map((p) => p[0]); assert.ok(Math.min(...xs) < -10 && Math.max(...xs) > 10, `${style}: one eye on each side`);
  }
  const span = (st) => { const c = fakeCtx(); paintEyes(c, map, { ...STYLE_DEFAULTS, eyeStyle: 'round', ...st }, o); const xs = c.log.pts.map((p) => p[0]); const ys = c.log.pts.map((p) => p[1]); return { w: Math.max(...xs) - Math.min(...xs), top: Math.min(...ys) }; };
  assert.ok(span({ eyeSpacing: 1.6 }).w > span({}).w + 20); assert.ok(span({ eyeHeight: 0.3 }).top < span({}).top - 20, 'higher on the head');
  const first = (st) => { const c = fakeCtx(); paintEyes(c, map, { ...STYLE_DEFAULTS, eyeStyle: 'dots', ...st }, o); return c.log.pts[0][0]; };
  assert.ok(first({ eyeLookX: 1 }) > first({ eyeLookX: -1 }), 'the pupils follow the look');
  const c = fakeCtx(); paintEyes(c, map, { ...STYLE_DEFAULTS, eyeStyle: 'almond', eyeColor: '#3a7bd5' }, o); assert.ok(c.log.fills.includes('#3a7bd5'), 'the iris takes the eye colour');
});

test('lids and blinks: a whole number of blinks a cycle, open most of the time, shut for a moment', () => {
  assert.equal(lidAt({ eyeLid: 0.4, blinkRate: 0 }, 0.3), 0.4);
  for (const n of [1, 2, 3]) {
    const v = Array.from({ length: 240 }, (_, i) => lidAt({ eyeLid: 0, blinkRate: n }, i / 240));
    let shuts = 0; for (let i = 0; i < 240; i++) if (v[i] === 1 && v[(i + 239) % 240] !== 1) shuts++;
    assert.equal(shuts, n, `${n} blinks`); assert.ok(v.filter((x) => x === 0).length > 240 * (1 - 0.11 * n) - 2, 'open the rest of the time');
    assert.equal(lidAt({ blinkRate: n }, 0), lidAt({ blinkRate: n }, 1), 'the cycle loops'); assert.equal(lidAt({ blinkRate: n }, 0), 0, 'open on the first frame');
  }
  assert.equal(lidAt({ eyeLid: 0.6, blinkRate: 2 }, 0.2), 0.6, 'a sleepy lid stays down between blinks');
  const shut = fakeCtx(); paintEyes(shut, map, { ...STYLE_DEFAULTS, eyeStyle: 'round', eyeLid: 1 }, o); const open = fakeCtx(); paintEyes(open, map, { ...STYLE_DEFAULTS, eyeStyle: 'round' }, o);
  assert.ok(shut.log.fill === 0 && shut.log.stroke === 2 && open.log.fill >= 4, 'a shut eye is one line');
});

test('an almond eye has pointed corners and is flatter than a round one', () => {
  const a = eyeOutline('almond', 0, 0, 1, 1); const r = eyeOutline('round', 0, 0, 1, 1);
  const h = (p) => Math.max(...p.map((q) => q[1])) - Math.min(...p.map((q) => q[1])); const w = (p) => Math.max(...p.map((q) => q[0])) - Math.min(...p.map((q) => q[0]));
  assert.ok(h(a) < h(r) * 0.75 && w(a) > w(r));
});

test('eyebrows: each style draws two, raise lifts them, furrow tilts the inner ends down', () => {
  const ys = (st) => { const c = fakeCtx(); assert.equal(paintBrows(c, map, { ...STYLE_DEFAULTS, browStyle: 'line', ...st }, o), true); return c.log.pts; };
  for (const s of BROW_STYLES.filter((x) => x !== 'none')) { const c = fakeCtx(); paintBrows(c, map, { ...STYLE_DEFAULTS, browStyle: s }, o); assert.equal(c.log.stroke, 2, s); }
  assert.ok(ys({ browRaise: 1 })[0][1] < ys({})[0][1] - 5, 'raised (up the screen)');
  const f = ys({ browFurrow: 1 }); assert.ok(f[0][1] > f[1][1], 'the inner end is lower than the outer in a frown');
  const sad = ys({ browFurrow: -1 }); assert.ok(sad[0][1] < sad[1][1]);
});

test('every mouth shape paints in every style, wider, thicker and smiling', () => {
  for (const style of MOUTH_STYLES) for (const sh of MOUTH_SHAPES) {
    const c = fakeCtx(); paintMouth(c, sh.id, map, mouthOptions({ ...STYLE_DEFAULTS, mouthStyle: style, mouthWidth: 1.5, lipThickness: 2, mouthSmile: 0.8 }, 2));
    assert.ok(c.log.fill + c.log.stroke >= 1, `${style} ${sh.id}`); assert.ok(c.log.pts.every((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])), `${style} ${sh.id}`);
  }
  const run = (st, id = 'rest') => { const c = fakeCtx(); paintMouth(c, id, map, mouthOptions({ ...STYLE_DEFAULTS, ...st }, 2)); return c.log; };
  const w = (l) => Math.max(...l.pts.map((p) => p[0])) - Math.min(...l.pts.map((p) => p[0]));
  assert.ok(Math.abs(w(run({ mouthWidth: 1.5 })) / w(run({})) - 1.5) < 0.02, 'half as wide again');
  assert.equal(run({ mouthStyle: 'line' }).fill, 0, 'a line mouth at rest has no lips to fill'); assert.ok(run({}).fill >= 1);
  const corners = (l) => { const xs = l.pts.map((p) => p[0]); const i = xs.indexOf(Math.min(...xs)); return l.pts[i][1]; };
  assert.ok(corners(run({ mouthSmile: 1 })) < corners(run({ mouthSmile: -1 })) - 5, 'a smile lifts the corners, a frown drops them');
  const open = MOUTH_SHAPES.find((s) => s.id !== 'rest' && run({}, s.id).fills.includes('#5b2c2c')).id;
  assert.ok(run({ cavityColor: '#123456', teethColor: '#abcdef' }, open).fills.includes('#123456'), 'the inside takes its colour');
  assert.ok(!run({ mouthStyle: 'curve' }, open).fills.includes('#ffffff'), 'a curve mouth has no teeth');
});

test('the face settings are controls in the Speech tab, and are left out for the animals', () => {
  for (const id of ['eyeStyle', 'eyeSize', 'eyeSpacing', 'eyeHeight', 'eyeLookX', 'eyeLookY', 'eyeLid', 'blinkRate', 'eyeColor', 'browStyle', 'browRaise', 'browFurrow', 'mouthShow', 'mouthStyle', 'mouthWidth', 'lipThickness', 'mouthSmile', 'lipColor', 'teethColor', 'tongueColor', 'cavityColor']) {
    const c = CONTROLS.find((x) => x.id === id && x.scope === 's'); assert.ok(c && c.tab === 'Speech', id); assert.ok(id in STYLE_DEFAULTS, id);
    if (c.type === 'number') assert.ok(STYLE_DEFAULTS[id] >= c.min && STYLE_DEFAULTS[id] <= c.max, id);
    if (c.type === 'enum') assert.ok(c.options.includes(STYLE_DEFAULTS[id]), id);
    assert.equal(wordsFor('human').hides(c), false, id); assert.equal(wordsFor('hose').hides(c), false, id);
    for (const fig of ['dog', 'bird', 'horse', 'hosehorse']) assert.equal(wordsFor(fig).hides(c), true, `${fig} ${id}`);
  }
});
