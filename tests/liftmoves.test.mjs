// New walks (robot, skip and others), the movements that carry weight (float, hang, dangle, climb), and muting a lane.
import test from 'node:test';
import assert from 'node:assert/strict';
import { PRESETS, PRESETS_DOG, CONTROLS } from '../src/controls.js';
import { DEFAULTS } from '../src/rig.js';
import { clipsFor, applyClip, CLIP_GROUPS, groupOfClip } from '../src/clips.js';
import { unmuted, paramsAt, laneValue } from '../src/automation.js';

const inRange = (set) => { const bad = []; for (const [name, v] of Object.entries(set)) for (const [k, x] of Object.entries(v)) { const c = CONTROLS.find((q) => q.scope === 'p' && q.id === k); if (!c) { if (k !== 'camYaw' && k !== 'camPitch') bad.push(`${name}: unknown ${k}`); continue; } if (c.type === 'number' && (x < c.min || x > c.max)) bad.push(`${name}: ${k}=${x}`); if (c.type === 'enum' && !c.options.includes(x)) bad.push(`${name}: ${k}=${x}`); } return bad; };

test('the new walks exist and every value is a real setting inside its range', () => {
  for (const n of ['Robot', 'Skip', 'Tiptoe', 'Catwalk', 'Zombie', 'Drunk', 'Power walk']) assert.ok(PRESETS[n], n);
  for (const n of ['Robot', 'Skip']) assert.ok(PRESETS_DOG[n], `dog ${n}`);
  assert.deepEqual(inRange(PRESETS), []); assert.deepEqual(inRange(PRESETS_DOG), []);
});
test('the robot is stiff: straight legs, flat feet, no bob, on twos', () => {
  const r = PRESETS.Robot; assert.ok(r.legExtend >= 0.99); assert.equal(r.heelStrike, 0); assert.equal(r.toeOff, 0); assert.ok(r.bob < 0.02); assert.equal(r.exposure, 2); assert.equal(r.pelvisRoll, 0);
});
test('the skip has an uneven rhythm and leaves the ground', () => {
  const s = PRESETS.Skip; assert.ok(Math.abs(s.asymTiming) > 0.03); assert.ok(s.duty < 0.5);
});

const base = { ...DEFAULTS };
const human = clipsFor('human');
test('float, hang, dangle and climb are movements, in their own group', () => {
  for (const id of ['float', 'hang', 'dangle', 'climb']) { assert.ok(human.find((c) => c.id === id), id); assert.equal(groupOfClip(id), 'Weight'); }
  assert.ok(CLIP_GROUPS.some(([g]) => g === 'Weight'));
});
test('a float lifts the body and the feet, stops the walk and comes back down', () => {
  const lanes = applyClip({}, human.find((c) => c.id === 'float'), base, 10, 96, 1);
  const y = lanes['c:pelvis.y:offset']; assert.ok(y && Math.max(...y.pts.map((p) => p.v)) > 0.3, 'the body rises'); assert.ok(Math.abs(y.pts.at(-1).v) < 0.1, 'and comes back');
  assert.ok(Math.max(...lanes['c:foot.y.R:offset'].pts.map((p) => p.v)) > 0.1);
  assert.equal(laneValue(lanes.cadence, 10 + 48, 1), 0, 'the walk has stopped');
  assert.equal(laneValue(lanes['p:headBob'], 10 + 48, 1), 0, 'the head rides the body while it floats');
  assert.ok(Math.abs(laneValue(lanes['p:headBob'], 10 + 96, 0) - base.headBob) < 1e-6, 'and steadies again at the end');
});
test('a hang reaches up and stays hanging by the arms with the feet off the ground', () => {
  const lanes = applyClip({}, human.find((c) => c.id === 'hang'), base, 0, 64, 1);
  assert.ok(laneValue(lanes['c:arm.pitch.R:offset'], 64, 0) > 2, 'arms overhead'); assert.ok(laneValue(lanes['c:pelvis.y:offset'], 64, 0) > 0.4, 'the body hangs under the hands');
  assert.equal(laneValue(lanes.cadence, 64, 1), 0, 'no walking while hanging');
});
test('a dangle swings the legs out of step and the swing dies down', () => {
  const lanes = applyClip({}, human.find((c) => c.id === 'dangle'), base, 0, 96, 1); const R = lanes['c:foot.x.R:offset'].pts; const L = lanes['c:foot.x.L:offset'].pts;
  const swings = R.filter((p) => Math.abs(p.v) > 0.02); assert.ok(swings.length >= 4); assert.ok(R.some((p, i) => Math.sign(p.v) !== Math.sign(L[i].v) && Math.abs(p.v) > 0.02), 'opposite legs');
  const peaks = swings.map((p) => Math.abs(p.v)); assert.ok(peaks[0] > peaks[peaks.length - 1], 'it dies down');
});
test('a climb moves the arms in turn and the body rises', () => {
  const lanes = applyClip({}, human.find((c) => c.id === 'climb'), base, 0, 96, 1); const a = lanes['c:arm.pitch.R:offset'].pts; const b = lanes['c:arm.pitch.L:offset'].pts;
  assert.ok(a.some((p, i) => p.v > 2 && b[i].v < 1.5) && a.some((p, i) => p.v < 1.5 && b[i].v > 2), 'each arm reaches high in turn');
  const y = lanes['c:pelvis.y:offset'].pts; assert.ok(Math.max(...y.map((p) => p.v)) > Math.min(...y.filter((p) => p.t > 5).map((p) => p.v)) + 0.1, 'the body rises');
});

test('a muted lane does nothing until it is switched on again', () => {
  const lanes = { 'p:stepLength': { pts: [{ t: 0, v: 0.5 }, { t: 10, v: 0.5 }] }, 'p:bob': { pts: [{ t: 0, v: 0.2 }], mute: true } };
  const on = unmuted(lanes); assert.ok('p:stepLength' in on); assert.ok(!('p:bob' in on));
  assert.equal(paramsAt(base, on, 5).bob, base.bob); assert.equal(paramsAt(base, on, 5).stepLength, 0.5);
  assert.equal(unmuted(null), null); const plain = { 'p:bob': { pts: [{ t: 0, v: 0.2 }] } }; assert.equal(unmuted(plain), plain, 'with nothing muted the lanes are used as they are');
});
