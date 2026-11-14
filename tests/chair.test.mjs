import test from 'node:test';
import assert from 'node:assert/strict';
import { newProp, cleanScene, propParts, CHAIR_STYLES, PROP_BY_ID, EMPTY_SCENE } from '../src/scene.js';

const chair = (over = {}) => newProp('chair', { x: 1, z: 0.5, ...over });

test('a chair is a scenery item with its own settings', () => {
  assert.ok(PROP_BY_ID.chair); const q = chair();
  assert.equal(q.kind, 'chair'); assert.equal(q.style, 'Kitchen'); assert.ok(q.back > 0 && q.cushionOn === true);
});

test('every style is built from solid faces, standing on the ground, with its seat top at the seat height', () => {
  for (const style of Object.keys(CHAIR_STYLES)) {
    const d = CHAIR_STYLES[style]; const q = chair({ style, h: d.h, back: d.back, arms: d.arms, w: d.w, d: d.d });
    const { faces } = propParts(q); assert.ok(faces.length >= 12, `${style}: ${faces.length} faces`);
    const ys = faces.flatMap((f) => f.pts.map((p) => p[1])); assert.ok(ys.every(Number.isFinite)); assert.ok(Math.min(...ys) >= -1e-9 && Math.min(...ys) < 0.07, `${style}: stands on the ground (${Math.min(...ys)})`);
    const seatTop = Math.max(...faces.filter((f) => f.normal[1] > 0.9 && f.pts.every((p) => Math.abs(p[1] - q.h) < 1e-6 || p[1] > q.h)).flatMap((f) => f.pts.map((p) => p[1]).filter((y) => Math.abs(y - q.h) < 1e-6)), -1);
    assert.ok(Math.abs(seatTop - q.h) < 1e-6, `${style}: the seat top is at ${q.h}`);
    const top = Math.max(...ys); if (d.back > 0) assert.ok(top > q.h + d.back * 0.9, `${style}: the back rises to ${top}`); else assert.ok(top < q.h + 0.08, `${style}: no back`);
    const xs = faces.flatMap((f) => f.pts.map((p) => p[0])); assert.ok(Math.max(...xs) - Math.min(...xs) <= d.w + 0.05 + (style === 'Office' ? 0.1 : 0), `${style}: within its depth`);
  }
});

test('the back, the arms and the cushion change what is built', () => {
  const n = (o) => propParts(chair(o)).faces.length;
  assert.ok(n({ back: 0.6 }) > n({ back: 0 })); assert.ok(n({ arms: true }) > n({ arms: false })); assert.ok(n({ cushionOn: true }) > n({ cushionOn: false }));
  const colours = new Set(propParts(chair({ color: '#112233', cushion: '#aa0000' })).faces.map((f) => f.color)); assert.ok(colours.has('#112233') && colours.has('#aa0000'));
  const bigger = propParts(chair({ w: 0.8 })).faces.flatMap((f) => f.pts.map((p) => p[0])); const small = propParts(chair({ w: 0.4 })).faces.flatMap((f) => f.pts.map((p) => p[0]));
  assert.ok(Math.max(...bigger) - Math.min(...bigger) > Math.max(...small) - Math.min(...small) + 0.3);
});

test('a chair is saved and cleaned with its style, back, arms and colours', () => {
  const scene = { ...EMPTY_SCENE(), props: [chair({ style: 'Armchair', back: 0.7, arms: true, cushion: '#336699', color: '#222222' })] };
  const back = cleanScene(JSON.parse(JSON.stringify(scene)), ['human'], {}); const q = back.props[0];
  assert.equal(q.kind, 'chair'); assert.equal(q.style, 'Armchair'); assert.equal(q.back, 0.7); assert.equal(q.arms, true); assert.equal(q.cushion, '#336699'); assert.equal(q.color, '#222222');
  const bad = cleanScene({ actors: [], props: [{ ...chair(), style: 'Throne', back: 'x', cushion: 'red' }] }, ['human'], {}).props[0];
  assert.equal(bad.style, 'Kitchen'); assert.equal(bad.back, 0.5); assert.equal(bad.cushion, '#b9503f');
});
