import test from 'node:test';
import assert from 'node:assert/strict';
import { laneValue, paramsAt, motionAt, integrate, thinPoints, replaceSpan, Recorder, parseTarget, hasLanes } from '../src/automation.js';
import { DEFAULTS, foot } from '../src/rig.js';

const lane = (pts, interp) => ({ pts, interp });

test('a lane eases between points, holds at the ends, and an empty lane uses the fallback', () => {
  const l = lane([{ t: 10, v: 0 }, { t: 20, v: 1 }]);
  assert.equal(laneValue(l, 0, 9), 0);
  assert.equal(laneValue(l, 99, 9), 1);
  assert.equal(laneValue(l, 15, 9), 0.5);
  assert.ok(laneValue(l, 12, 9) < 0.2 && laneValue(l, 18, 9) > 0.8, 'eases in and out');
  assert.equal(laneValue(lane([{ t: 0, v: 0 }, { t: 10, v: 1 }], 'linear'), 5, 9), 0.5);
  assert.equal(laneValue(null, 5, 7), 7);
  assert.equal(laneValue(lane([]), 5, 7), 7);
});

test('targets parse', () => {
  assert.deepEqual(parseTarget('p:stepLength'), { kind: 'param', id: 'stepLength' });
  assert.deepEqual(parseTarget('c:arm.pitch.R:offset'), { kind: 'channel', id: 'arm.pitch.R', what: 'offset' });
  assert.deepEqual(parseTarget('cadence'), { kind: 'cadence' });
  assert.equal(parseTarget('nonsense'), null);
});

test('automation overrides parameters and channel settings at a frame, and leaves the originals alone', () => {
  const base = { ...DEFAULTS };
  const lanes = { 'p:stepLength': lane([{ t: 0, v: 0.8 }, { t: 10, v: 0 }]), 'c:arm.pitch.R:amount': lane([{ t: 0, v: 1 }, { t: 10, v: 0 }]) };
  assert.ok(Math.abs(paramsAt(base, lanes, 5).stepLength - 0.4) < 1e-9);
  assert.equal(base.stepLength, DEFAULTS.stepLength);
  assert.equal(paramsAt(base, {}, 5), base, 'no lanes returns the same object');
  const m = motionAt({ 'arm.pitch.R': { offset: 0.1 } }, lanes, 10);
  assert.deepEqual(m['arm.pitch.R'], { offset: 0.1, amount: 0 });
  assert.equal(hasLanes({}), false); assert.equal(hasLanes(lanes), true);
});

test('integration: with no automation, phase and travel are linear and match the built-in walk', () => {
  const T = 48; const r = integrate({ ...DEFAULTS }, {}, T, 24);
  assert.ok(Math.abs(r.u[24] - 1) < 1e-12 && Math.abs(r.u[48] - 2) < 1e-12);
  assert.ok(Math.abs(r.x[24] - 2 * DEFAULTS.stepLength) < 1e-12);
});

test('integration: slowing the cadence slows the walk, and travel tracks step length times cadence', () => {
  const lanes = { cadence: lane([{ t: 0, v: 1 }, { t: 24, v: 0 }], 'linear') };
  const r = integrate({ ...DEFAULTS }, lanes, 48, 24);
  const d1 = r.u[2] - r.u[1]; const d2 = r.u[24] - r.u[23];
  assert.ok(d2 < d1, 'phase advances more slowly later');
  assert.ok(Math.abs(r.u[48] - r.u[30]) < 1e-9, 'and stops once cadence reaches zero');
  assert.ok(Math.abs(r.x[48] - r.x[30]) < 1e-9, 'so the figure stops too');
  const sl = { 'p:stepLength': lane([{ t: 0, v: 0.8 }, { t: 40, v: 0 }], 'linear') };
  const r2 = integrate({ ...DEFAULTS }, sl, 40, 24);
  assert.ok(r2.x[40] < 2 * 0.8 * (40 / 24) * 0.8, 'shorter steps cover less ground');
});

test('integration finds where each foot lands, once per step, alternating', () => {
  const r = integrate({ ...DEFAULTS }, {}, 72, 24, (p) => foot(0, p, p.stepLength * p.duty));
  const sides = r.plants.map((q) => q.side);
  assert.equal(sides.length, 6);
  assert.deepEqual(sides, ['L', 'R', 'L', 'R', 'L', 'R'].slice(0, 6).map((s, i) => (i % 2 === 0 ? 'L' : 'R')));
  for (let i = 1; i < r.plants.length; i++) assert.ok(r.plants[i].x > r.plants[i - 1].x);
});

test('thinning keeps the shape within the tolerance and the end points', () => {
  const pts = Array.from({ length: 100 }, (_, i) => ({ t: i, v: Math.sin(i / 15) }));
  const thin = thinPoints(pts, 0.01);
  assert.ok(thin.length < 40 && thin[0].t === 0 && thin[thin.length - 1].t === 99);
  for (const q of pts) { const l = laneValue({ pts: thin, interp: 'linear' }, q.t, 0); assert.ok(Math.abs(l - q.v) <= 0.0105, `t=${q.t}`); }
  assert.equal(thinPoints([{ t: 0, v: 0 }, { t: 1, v: 1 }], 0.1).length, 2);
});

test('replacing a span keeps what lies outside it', () => {
  const l = replaceSpan(lane([{ t: 0, v: 0 }, { t: 10, v: 1 }, { t: 20, v: 2 }, { t: 30, v: 3 }]), 8, 22, [{ t: 12, v: 9 }]);
  assert.deepEqual(l.pts.map((q) => q.t), [0, 12, 30]);
});

const rec = (mode) => { const r = new Recorder(); r.setMode(mode); return r; };

test('latch: records from the first touch and holds the last value to the end of the take', () => {
  const r = rec('latch');
  r.touch('p:bob', 10, 0.05);
  for (let t = 11; t <= 14; t++) { r.tick(t); r.set('p:bob', t, 0.05 + (t - 10) * 0.01); }
  r.release('p:bob', 15);
  for (let t = 15; t <= 30; t++) r.tick(t);
  const lanes = r.commit({}, 30, () => 0.3);
  const l = lanes['p:bob'];
  assert.ok(l.pts[0].t === 9 && l.pts[1].t === 10 && l.pts[l.pts.length - 1].t === 31, 'an anchor one frame before the first touch, the take, then it lets go');
  assert.ok(Math.abs(laneValue(l, 40, 0) - 0.05) < 1e-9, 'after the take the control is back to what it was');
  assert.ok(Math.abs(laneValue(l, 30, 0) - 0.09) < 1e-9, 'holds the value you let go on');
  assert.ok(Math.abs(laneValue(l, 25, 0) - 0.09) < 1e-9);
});

test('touch: records only while held, then glides back to the old lane', () => {
  const old = { 'p:bob': lane([{ t: 0, v: 0.2 }, { t: 100, v: 0.2 }], 'linear') };
  const r = rec('touch');
  r.touch('p:bob', 20, 0.05);
  for (let t = 21; t <= 30; t++) { r.tick(t); r.set('p:bob', t, 0.05); }
  r.release('p:bob', 30);
  for (let t = 31; t <= 60; t++) r.tick(t);
  const l = r.commit(old, 60, () => 0.3)['p:bob'];
  assert.ok(Math.abs(laneValue(l, 25, 0) - 0.05) < 1e-9, 'the take is written while held');
  assert.ok(Math.abs(laneValue(l, 50, 0) - 0.2) < 1e-9, 'afterwards it is back to the old value');
  assert.ok(laneValue(l, 34, 0) > 0.05 && laneValue(l, 34, 0) < 0.2, 'and glides, rather than jumping');
  assert.ok(Math.abs(laneValue(l, 10, 0) - 0.2) < 1e-9, 'before the take is untouched');
  assert.ok(Math.abs(laneValue(l, 19, 0) - 0.2) < 1e-9, 'right up to the moment you touched it');
});

test('with no earlier automation, the frames before the take keep the value the control had', () => {
  const r = rec('latch');
  r.touch('p:bob', 30, 0.075);                       // the control read 0.075 when touched
  for (let t = 31; t <= 40; t++) { r.tick(t); r.set('p:bob', t, 0.2); }
  const l = r.commit({}, 40, () => 0.3)['p:bob'];
  assert.ok(Math.abs(laneValue(l, 5, 0) - 0.075) < 1e-9, 'before the take: the old value, not the new one');
  assert.ok(Math.abs(laneValue(l, 40, 0) - 0.2) < 1e-9);
});

test('live values follow the hand while recording, and touch drops them on release', () => {
  const r = rec('touch');
  r.touch('p:armSwing', 5, 40);
  assert.deepEqual(r.liveValues(), { 'p:armSwing': 40 });
  assert.equal(paramsAt({ ...DEFAULTS }, { 'p:armSwing': lane([{ t: 0, v: 10 }]) }, 5, r.liveValues()).armSwing, 40, 'live wins over the lane');
  r.release('p:armSwing', 8);
  assert.deepEqual(r.liveValues(), {});
  const l = rec('latch'); l.touch('p:armSwing', 5, 40); l.release('p:armSwing', 8);
  assert.deepEqual(l.liveValues(), { 'p:armSwing': 40 }, 'latch keeps holding it');
});

test('a recorder that is off records nothing; unrelated controls are ignored', () => {
  const r = rec('off'); r.touch('p:bob', 1, 1); r.tick(2);
  assert.deepEqual(r.commit({}, 10), {});
  const r2 = rec('latch'); r2.set('p:bob', 3, 1);
  assert.deepEqual(r2.commit({}, 10), {}, 'moving a control that was never touched writes nothing');
});

test('several controls record at once, each in its own lane', () => {
  const r = rec('latch');
  r.touch('p:bob', 0, 0.1); r.touch('c:pelvis.y:offset', 0, -0.05);
  for (let t = 1; t <= 10; t++) { r.tick(t); r.set('p:bob', t, 0.1 + t * 0.01); }
  const lanes = r.commit({}, 10, () => 0.3);
  assert.deepEqual(Object.keys(lanes).sort(), ['c:pelvis.y:offset', 'p:bob']);
  assert.ok(Math.abs(laneValue(lanes['c:pelvis.y:offset'], 10, 0) + 0.05) < 1e-9);
});

import { moveLanePoint, insertLanePoint, removeLanePoint, strokeLane } from '../src/lanes.js';

test('lane editing: points stay in order and inside the timeline', () => {
  const pts = [{ t: 0, v: 0 }, { t: 20, v: 1 }, { t: 40, v: 0 }];
  moveLanePoint(pts, 1, 100, 2, 60);
  assert.deepEqual(pts[1], { t: 39, v: 2 }, 'cannot pass its neighbour');
  moveLanePoint(pts, 0, -30, 5, 60);
  assert.equal(pts[0].t, 0);
  moveLanePoint(pts, 2, 500, 0, 60);
  assert.equal(pts[2].t, 59, 'the last point stops at the final frame');
  const ins = insertLanePoint([{ t: 0, v: 0 }, { t: 30, v: 1 }], 12.4, 0.5);
  assert.deepEqual(ins.map((q) => q.t), [0, 12, 30]);
  assert.deepEqual(insertLanePoint(ins, 12, 9).find((q) => q.t === 12), { t: 12, v: 9 }, 'a point on an existing frame replaces it');
  assert.equal(removeLanePoint(ins, 1).length, 2);
});

test('a freehand stroke replaces only the frames it covers', () => {
  const lane = { pts: [{ t: 0, v: 5 }, { t: 100, v: 5 }], interp: 'smooth' };
  const stroke = Array.from({ length: 31 }, (_, i) => ({ t: 40 + i, v: Math.sin(i / 5) }));
  const out = strokeLane(lane, stroke, 0.01);
  assert.ok(out.pts[0].t === 0 && out.pts[out.pts.length - 1].t === 100, 'the ends outside the stroke stay');
  assert.ok(out.pts.some((q) => q.t >= 40 && q.t <= 70));
  assert.equal(strokeLane(lane, [{ t: 5, v: 1 }], 0.01), lane, 'a tap is not a stroke');
});
