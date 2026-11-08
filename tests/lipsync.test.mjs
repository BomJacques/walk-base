import test from 'node:test';
import assert from 'node:assert/strict';
import { VISEMES, VISEME_BY_ID, wordToShapes, buildSpeech, speechAt, keyOn, cleanSpeech, mouthShape } from '../src/lipsync.js';

test('the set has 15 mouth shapes, each with a name, sounds and a hint', () => {
  assert.equal(VISEMES.length, 15);
  assert.equal(new Set(VISEMES.map((v) => v.id)).size, 15);
  for (const v of VISEMES) { assert.ok(v.label && v.sounds && v.hint && v.code, v.id); assert.ok(v.open >= 0 && v.open <= 1, v.id); }
});

test('every mouth shape has an outline with two lip lines that meet at the corners', () => {
  for (const v of VISEMES) {
    const m = mouthShape(v.id);
    assert.equal(m.top.length, m.bot.length);
    assert.ok(m.W > 0.05 && m.W < 0.6, `${v.id} width ${m.W}`);
    assert.ok(Math.abs(m.top[0][1] - m.bot[0][1]) < 1e-9 && Math.abs(m.top.at(-1)[1] - m.bot.at(-1)[1]) < 1e-9, `${v.id} corners meet`);
    for (let i = 0; i < m.top.length; i++) assert.ok(m.top[i][1] >= m.bot[i][1] - 1e-9, `${v.id} top is above bottom`);
  }
});

test('the shapes differ the way mouths do', () => {
  const g = (id) => mouthShape(id);
  assert.equal(g('mbp').H, 0, 'M B P is shut');
  assert.ok(g('ah').H > g('ee').H * 2, 'AH is far more open than EE');
  assert.ok(g('ee').W > g('oo').W * 1.8, 'EE is wide and OO is small');
  assert.ok(g('fv').tuck === 1 && g('th').tongue === 3);
  assert.ok(g('oo').round > 0.9 && g('ee').round === 0);
});

test('spelling rules give sensible shapes', () => {
  assert.deepEqual(wordToShapes('map'), ['mbp', 'ae', 'mbp']);
  assert.deepEqual(wordToShapes('hello'), ['ae', 'l', 'oh']);
  assert.deepEqual(wordToShapes('ship'), ['chsh', 'ee', 'mbp']);
  assert.deepEqual(wordToShapes('phone'), ['fv', 'oh', 'l']);
  assert.deepEqual(wordToShapes('moon'), ['mbp', 'oo', 'l']);
  assert.deepEqual(wordToShapes('make'), ['mbp', 'ae', 'kg']); // the final e is silent and makes the a long
  assert.deepEqual(wordToShapes('the'), ['th', 'uh']);
  assert.deepEqual(wordToShapes('three'), ['th', 'r', 'ee']);
  assert.deepEqual(wordToShapes('!!'), []);
  assert.ok(wordToShapes('zxqv').every((s) => VISEME_BY_ID[s]));
});

test('any word comes out as known shapes', () => {
  for (const w of ['strength', 'beautiful', 'though', 'queue', 'rhythm', 'xylophone', "don't", 'a', 'I', 'mississippi', 'knight', 'wrapped']) {
    const s = wordToShapes(w);
    assert.ok(s.every((x) => VISEME_BY_ID[x]), `${w}: ${s}`);
  }
});

test('speech becomes key shapes in time order, starting and ending at rest', () => {
  const sp = buildSpeech('Hello world, this is a test.', { fps: 24, start: 10, speed: 1 });
  assert.equal(sp.keys[0].v, 'rest'); assert.equal(sp.keys[0].f, 10);
  assert.equal(sp.keys.at(-1).v, 'rest'); assert.equal(sp.end, sp.keys.at(-1).f);
  for (let i = 1; i < sp.keys.length; i++) { assert.ok(sp.keys[i].f > sp.keys[i - 1].f, 'one key per frame, in order'); assert.notEqual(sp.keys[i].v, sp.keys[i - 1].v, 'no repeats'); }
  assert.ok(sp.keys.length > 15);
  assert.ok(sp.keys.every((k) => VISEME_BY_ID[k.v]));
});

test('speed changes how long the speech lasts, and the frame rate scales it', () => {
  const slow = buildSpeech('the quick brown fox', { fps: 24, speed: 0.5 }).end;
  const fast = buildSpeech('the quick brown fox', { fps: 24, speed: 2 }).end;
  assert.ok(slow > fast * 2.5, `${slow} vs ${fast}`);
  const at12 = buildSpeech('the quick brown fox', { fps: 12, speed: 1 }).end;
  const at24 = buildSpeech('the quick brown fox', { fps: 24, speed: 1 }).end;
  assert.ok(at24 > at12 * 1.7);
});

test('punctuation makes pauses', () => {
  const run = buildSpeech('one two', { fps: 24 }); const pause = buildSpeech('one. two', { fps: 24 });
  assert.ok(pause.end > run.end + 1);
  assert.ok(pause.keys.some((k) => k.v === 'rest' && k.f > 0 && k.f < pause.end));
});

test('M, B and P keep their frame when a vowel wants the same one', () => {
  const sp = buildSpeech('map bop', { fps: 12, speed: 2 });
  assert.ok(sp.keys.some((k) => k.v === 'mbp'));
});

test('speechAt holds each shape until the next key', () => {
  const sp = buildSpeech('hello', { fps: 24, start: 5 });
  assert.equal(speechAt(sp, 0), null, 'before the speech there is nothing');
  assert.equal(speechAt(sp, 5), 'rest');
  const k = sp.keys[2];
  assert.equal(speechAt(sp, k.f), k.v); assert.equal(speechAt(sp, k.f + 0), k.v);
  assert.equal(speechAt(sp, sp.end + 50), 'rest', 'after the end it rests');
  assert.equal(keyOn(sp, k.f).v, k.v); assert.equal(keyOn(sp, k.f - 1) === null || keyOn(sp, k.f - 1).f !== k.f, true);
  assert.equal(speechAt(null, 3), null);
});

test('a saved speech is cleaned on the way back in', () => {
  const sp = buildSpeech('hi there');
  assert.deepEqual(cleanSpeech(JSON.parse(JSON.stringify(sp))).keys, sp.keys);
  assert.equal(cleanSpeech(null), null); assert.equal(cleanSpeech({ keys: 'no' }), null);
  const dirty = cleanSpeech({ text: 'x', start: -4, speed: 99, keys: [{ f: 9, v: 'ah' }, { f: 2, v: 'nope' }, { f: 'x', v: 'oo' }, { f: 3, v: 'mbp' }] });
  assert.deepEqual(dirty.keys, [{ f: 3, v: 'mbp' }, { f: 9, v: 'ah' }]);
  assert.ok(dirty.start === 0 && dirty.speed === 2.5);
});
