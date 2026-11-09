import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { PROP_KINDS, newProp, newActor, cleanScene, propParts, prismFaces, faceLight } from '../src/scene.js';

const FIGS = ['human', 'hose', 'dog', 'theropod', 'bird', 'sauropod', 'ceratopsian'];

test('every kind of scenery builds, with sensible faces', () => {
  for (const k of PROP_KINDS) {
    const q = newProp(k.id); const { faces, balls, image, line } = propParts(q);
    assert.ok(faces.length + balls.length > 0 || image || line, k.id);
    for (const f of faces) { assert.ok(f.pts.length >= 3 && f.pts.every((p) => p.every(Number.isFinite)), k.id); assert.ok(Math.abs(Math.hypot(...f.normal) - 1) < 1e-6, `${k.id} normal`); }
  }
});

test('a box has six faces standing on the ground, and its sides face outward', () => {
  const q = newProp('box', { x: 2, z: 1, rot: 0, w: 1, d: 1, h: 1 });
  const f = prismFaces(q, 4);
  assert.equal(f.length, 6);
  const ys = f.flatMap((x) => x.pts.map((p) => p[1])); assert.equal(Math.min(...ys), 0); assert.equal(Math.max(...ys), 1);
  for (const side of f.slice(0, 4)) {
    const c = side.pts.reduce((t, p) => [t[0] + p[0] / 4, t[1] + p[1] / 4, t[2] + p[2] / 4], [0, 0, 0]);
    const out = [c[0] - 2, 0, c[2] - 1];
    assert.ok(out[0] * side.normal[0] + out[2] * side.normal[2] > 0.3, 'the normal points away from the middle');
  }
  assert.ok(faceLight([0, 1, 0]) > faceLight([0, 0, 1]) && faceLight([0, 0, -1]) > 0.5);
});

test('turning a prop moves its corners round its middle', () => {
  const a = prismFaces(newProp('box', { x: 0, z: 0, rot: 0, w: 2, d: 1, h: 1 }), 4).flatMap((f) => f.pts);
  const b = prismFaces(newProp('box', { x: 0, z: 0, rot: 90, w: 2, d: 1, h: 1 }), 4).flatMap((f) => f.pts);
  assert.ok(Math.max(...a.map((p) => Math.abs(p[0]))) > 0.99 && Math.max(...b.map((p) => Math.abs(p[2]))) > 0.99);
});

test('a saved scene is cleaned on the way back in', () => {
  const actor = newActor('hose', 'Hose', { ...DEFAULTS, rig: 'human', model: 'hose' }, { head: 1.5 });
  const raw = JSON.parse(JSON.stringify({ actors: [actor, { fig: 'nope' }, null], props: [newProp('tree'), { type: 'nope' }, newProp('box', { w: 99, color: 'red' })] }));
  raw.actors[0].x = 999; raw.actors[0].p.stepLength = 'x'; raw.actors[0].fill = 'blue';
  const s = cleanScene(raw, FIGS, DEFAULTS);
  assert.equal(s.actors.length, 1); assert.equal(s.props.length, 2);
  assert.equal(s.actors[0].x, 12); assert.equal(s.actors[0].p.stepLength, DEFAULTS.stepLength); assert.equal(s.actors[0].fill, ''); assert.equal(s.actors[0].r.head, 1.5);
  assert.equal(s.props[1].w, 8); assert.match(s.props[1].color, /^#[0-9a-f]{6}$/);
  assert.deepEqual(cleanScene(null, FIGS, DEFAULTS), { actors: [], props: [] });
  assert.equal(cleanScene({ actors: Array.from({ length: 50 }, () => actor) }, FIGS, DEFAULTS).actors.length, 12);
});

test('scenery can be raised off the ground, and a figure has its own colours', () => {
  const q = newProp('box', { x: 0, z: 0, rot: 0, w: 1, d: 1, h: 1, y: 2 });
  const ys = prismFaces(q, 4).flatMap((f) => f.pts.map((p) => p[1])); assert.equal(Math.min(...ys), 2); assert.equal(Math.max(...ys), 3);
  const ball = propParts(newProp('ball', { y: 1.5 })).balls[0]; assert.ok(ball.c[1] > 1.5);
  const a = newActor('human', 'Walker', { ...DEFAULTS }, {}, { fill: '#ff0000', line: '#00ff00', tint: '#0000ff' });
  const s = cleanScene(JSON.parse(JSON.stringify({ actors: [a, { ...a, fill: 'red', line: '#123456' }], props: [newProp('box', { y: 99 })] })), FIGS, DEFAULTS);
  assert.deepEqual([s.actors[0].fill, s.actors[0].line, s.actors[0].tint], ['#ff0000', '#00ff00', '#0000ff']);
  assert.deepEqual([s.actors[1].fill, s.actors[1].line], ['', '#123456'], 'a bad colour falls back to the main figure colour');
  assert.equal(s.props[0].y, 8);
});

test('line-drawn scenery and pictures', () => {
  for (const id of ['tree', 'pine', 'bush']) { const q = newProp(id, { x: 1, z: 2, y: 0.5 }); const { line } = propParts(q); assert.ok(line && line.kind.startsWith('l') && line.h > 0, id); assert.deepEqual(line.base, [1, 0.5, 2]); }
  const pic = newProp('picture', { img: 'abc', asp: 0.5, w: 2, x: 0, z: 0, rot: 0 }); const { image } = propParts(pic);
  assert.equal(image.corners.length, 4); assert.equal(image.img, 'abc');
  const ys = image.corners.map((c) => c[1]); assert.equal(Math.min(...ys), 0); assert.ok(Math.abs(Math.max(...ys) - 1) < 1e-9, 'its height is its width times its shape');
  assert.ok(image.corners.every((c) => Math.abs(c[2]) < 1e-9), 'it faces the camera in the side view');
  const turned = propParts({ ...pic, rot: 90 }).image.corners; assert.ok(turned.some((c) => Math.abs(c[2]) > 0.9), 'turning it swings it round');
  const flipped = propParts({ ...pic, flip: true }).image.corners; assert.ok(flipped[0][0] > flipped[1][0], 'flipping mirrors it');
  const s = cleanScene({ props: [pic, { ...pic, img: 5, asp: 999, flip: 1 }, { type: 'picture', img: 'x'.repeat(80) }] }, ['human'], DEFAULTS);
  assert.equal(s.props[0].img, 'abc'); assert.equal(s.props[1].img, ''); assert.equal(s.props[1].asp, 20); assert.equal(s.props[1].flip, true); assert.equal(s.props[2].img.length, 40);
  assert.equal(cleanScene({ props: [{ type: 'tree' }] }, ['human'], DEFAULTS).props[0].kind, 'ltree', 'an old saved tree becomes a line-drawn one');
});
