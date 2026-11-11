import test from 'node:test';
import assert from 'node:assert/strict';
import { packCharacter, readCharacter, lookOf, CHARACTER_FORMAT } from '../src/character.js';
import { DEFAULTS } from '../src/rig.js';
import { STYLE_DEFAULTS } from '../src/draw.js';

const figs = ['human', 'hose', 'dog'];
const src = { name: 'Captain', figure: 'human', p: { ...DEFAULTS, lean: 9, rig: 'human', model: 'hose', dogSpecies: 'dog' }, r: { head: 1.4, torso: 0.9 }, s: { ...STYLE_DEFAULTS, style: 'comic', camYaw: 40, focus: 'head', fillColor: '#123456', eyeStyle: 'almond' }, motion: { 'arm.pitch.R': { offset: 0.3 } }, attach: [{ id: 'a1', kind: 'rect', part: 'head' }], design: { human: { head: { fill: '#ff0000' } } }, pads: { pads: [null] }, images: { img1: 'data:image/png;base64,AAAA' } };

test('a character keeps the person and leaves the stage behind', () => {
  const c = packCharacter(src); assert.equal(c.format, CHARACTER_FORMAT); assert.equal(c.figure, 'human'); assert.equal(c.name, 'Captain');
  assert.equal(c.p.lean, 9); for (const k of ['rig', 'model', 'dogSpecies']) assert.equal(k in c.p, false, `${k} is the figure's own`);
  assert.equal(c.s.style, 'comic'); assert.equal(c.s.fillColor, '#123456'); assert.equal(c.s.eyeStyle, 'almond'); for (const k of ['camYaw', 'focus']) assert.equal(k in c.s, false, `${k} is the camera's`);
  assert.deepEqual(c.r, src.r); assert.notEqual(c.r, src.r, 'a copy'); assert.deepEqual(c.attach, src.attach); assert.deepEqual(c.images, src.images);
  assert.ok(!('showGround' in lookOf(STYLE_DEFAULTS)) && !('background' in lookOf(STYLE_DEFAULTS)) && 'lineColor' in lookOf(STYLE_DEFAULTS));
});

test('a character is read back whole, through the JSON of a file', () => {
  const r = readCharacter(JSON.parse(JSON.stringify(packCharacter(src))), figs, DEFAULTS, STYLE_DEFAULTS);
  assert.equal(r.ok, true); assert.equal(r.figure, 'human'); assert.equal(r.p.lean, 9); assert.equal(r.s.style, 'comic'); assert.deepEqual(r.r, { head: 1.4, torso: 0.9 }); assert.equal(r.attach.length, 1); assert.equal(r.design.human.head.fill, '#ff0000'); assert.deepEqual(r.motion, src.motion); assert.ok(r.images.img1);
});

test('a file that is not a character, or is not one this version has, is turned away with a reason', () => {
  assert.equal(readCharacter(null, figs, DEFAULTS, STYLE_DEFAULTS).ok, false); assert.match(readCharacter({ format: 'something' }, figs, DEFAULTS, STYLE_DEFAULTS).error, /not a Walk Base character/);
  const bad = readCharacter({ ...packCharacter(src), figure: 'unicorn' }, figs, DEFAULTS, STYLE_DEFAULTS); assert.equal(bad.ok, false); assert.match(bad.error, /unicorn/);
});

test('what is read is made safe: only known settings of the right kind, proportions in range, pictures that are pictures', () => {
  const raw = { ...packCharacter(src), p: { lean: 'lots', stepLength: 0.5, nonsense: 3, bob: NaN, rig: 'dog' }, s: { style: 5, lineColor: '#abcdef', camYaw: 90, madeUp: true }, r: { head: 99, neck: -5, tail: 'x' }, images: { a: 'data:image/png;base64,AA', b: 'http://evil/x.png', c: 5 } };
  const r = readCharacter(raw, figs, DEFAULTS, STYLE_DEFAULTS);
  assert.deepEqual(r.p, { stepLength: 0.5 }); assert.deepEqual(r.s, { lineColor: '#abcdef' }); assert.deepEqual(r.r, { head: 6, neck: 0.05 }); assert.deepEqual(Object.keys(r.images), ['a']);
  const odd = readCharacter({ ...packCharacter(src), attach: 'no', design: 7, motion: null, pads: 'x' }, figs, DEFAULTS, STYLE_DEFAULTS); assert.deepEqual(odd.attach, []); assert.deepEqual(odd.design, {}); assert.deepEqual(odd.motion, {}); assert.equal(odd.pads, null);
});
