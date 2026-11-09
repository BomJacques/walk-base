import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { integrate, CADENCE, laneValue } from '../src/automation.js';
import { makeSeamless, closeLane, loopGap } from '../src/loop.js';

const baseP = { ...DEFAULTS, proportions: {}, motion: {} };
const withPerf = (p, lanes, T) => { const s = integrate(p, lanes, T, Math.round(p.cycleFrames)); return { ...p, perf: { T, u: s.u, x: s.x, lanes, live: null, plants: [] } }; };

test('a plain cycle already loops: the join is like any other step', () => {
  const g = loopGap(baseP); assert.ok(g.ratio <= 1.05, `ratio ${g.ratio}`);
});

test('a cycle that does not fit the exposure is fitted to it', () => {
  const r = makeSeamless({ base: baseP, lanes: {}, cycleFrames: 25, exposure: 2 });
  assert.equal(r.cycleFrames % 2, 0); assert.equal(r.perfLen, 0); assert.ok(r.notes.length >= 1);
  const same = makeSeamless({ base: baseP, lanes: {}, cycleFrames: 24, exposure: 3 });
  assert.equal(same.cycleFrames, 24);
});

test('closeLane ends one step short of its start value and keeps the middle', () => {
  const lane = { interp: 'linear', pts: [{ t: 0, v: 1 }, { t: 40, v: 3 }, { t: 95, v: 5 }] };
  const c = closeLane(lane, 96, 12);
  assert.equal(laneValue(c, 0, 0), 1); assert.equal(laneValue(c, 40, 0), 3);
  const last = laneValue(c, 95, 0); assert.ok(Math.abs(last - (1 + (laneValue(c, 84, 0) - 1) / 12)) < 1e-9, 'the last frame is one step from the start');
  assert.ok(Math.abs(last - 1) < Math.abs(laneValue(c, 84, 0) - 1) / 8, 'so the wrap is a small step');
});

test('a performance that drifts becomes a seamless loop', () => {
  const lanes = {
    'p:stepLength': { interp: 'smooth', pts: [{ t: 0, v: 0.5 }, { t: 60, v: 0.9 }, { t: 100, v: 0.9 }] },
    'p:bob': { interp: 'smooth', pts: [{ t: 0, v: 0.04 }, { t: 100, v: 0.12 }] },
    [CADENCE]: { interp: 'smooth', pts: [{ t: 0, v: 0.8 }, { t: 50, v: 1.3 }, { t: 100, v: 1.1 }] },
  };
  const before = loopGap(withPerf(baseP, lanes, 100));
  assert.ok(before.ratio > 1.5, `the drifting performance jumps at the join (${before.ratio.toFixed(2)})`);
  const r = makeSeamless({ base: baseP, lanes, perfLen: 100, cycleFrames: 24, exposure: 1 });
  assert.equal(r.perfLen % 24, 0); assert.ok(r.perfLen >= 96 && r.perfLen <= 120);
  const s = integrate(baseP, r.lanes, r.perfLen, 24);
  assert.ok(Math.abs(s.u[r.perfLen] - Math.round(s.u[r.perfLen])) < 1e-9, 'a whole number of cycles of phase');
  const after = loopGap(withPerf({ ...baseP, cycleFrames: r.cycleFrames }, r.lanes, r.perfLen));
  assert.ok(after.ratio <= 1.1, `the join is now like the other steps (${after.ratio.toFixed(2)})`);
  assert.ok(r.notes.length >= 2);
});

test('doing it twice changes nothing more', () => {
  const lanes = { 'p:bob': { interp: 'smooth', pts: [{ t: 0, v: 0.04 }, { t: 70, v: 0.12 }] } };
  const a = makeSeamless({ base: baseP, lanes, perfLen: 72, cycleFrames: 24 });
  const b = makeSeamless({ base: baseP, lanes: a.lanes, perfLen: a.perfLen, cycleFrames: a.cycleFrames });
  assert.equal(b.perfLen, a.perfLen); assert.deepEqual(b.lanes['p:bob'].pts.map((q) => q.t), a.lanes['p:bob'].pts.map((q) => q.t));
});

test('the dog loops too', () => {
  const dog = { ...DEFAULTS, rig: 'dog', proportions: {}, motion: {} };
  const lanes = { 'p:dogStride': { interp: 'smooth', pts: [{ t: 0, v: 0.6 }, { t: 90, v: 1.4 }] } };
  const r = makeSeamless({ base: dog, lanes, perfLen: 90, cycleFrames: 24 });
  const after = loopGap(withPerf({ ...dog, cycleFrames: r.cycleFrames }, r.lanes, r.perfLen));
  assert.ok(after.ratio <= 1.15, `${after.ratio}`);
});
