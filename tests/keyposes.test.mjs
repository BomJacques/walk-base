import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, cycleFrames } from '../src/rig.js';
import { integrate, hasLanes } from '../src/automation.js';
import { PRESETS_DOG } from '../src/controls.js';
import { turningPoints, findKeyFrames, laneTable, tableCsv, poseFor, trackedPoints } from '../src/keyposes.js';

const human = { ...DEFAULTS };
const dog = { ...DEFAULTS, rig: 'dog' };
const withPerf = (p, lanes, T) => { const s = integrate(p, lanes, T, Math.round(p.cycleFrames), null); return { ...p, perf: { T, u: s.u, x: s.x, plants: [], lanes, live: null } }; };

test('turning points find the highs and lows of a wave and ignore small wobbles', () => {
  const wave = Array.from({ length: 100 }, (_, t) => Math.sin((t / 25) * Math.PI * 2) + 0.01 * Math.sin(t * 5));
  const tp = turningPoints(wave, 0.3);
  assert.equal(tp.length, 8, 'four waves, a high and a low each');
  assert.ok(tp.every((q, i) => q.kind === (i % 2 ? 'low' : 'high')), 'they alternate');
  for (const q of tp.filter((x) => x.kind === 'high')) assert.ok(wave[q.t] > 0.95, 'a high is at the top of the wave');
  assert.equal(turningPoints([1, 1, 1, 1], 0.1).length, 0, 'a flat line has none');
  assert.equal(turningPoints([0, 1, 2, 3, 4], 0.1).length, 0, 'a steady rise has none');
});

test('key frames of a walk: where a foot lands, and the highs and lows of the bounce', () => {
  const keys = findKeyFrames(human);
  const T = cycleFrames(human).frames.length;
  assert.ok(keys.length >= 4 && keys.length < T, `a handful, not every frame: ${keys.length} of ${T}`);
  assert.equal(keys[0].frame, 0);
  const text = keys.flatMap((k) => k.reasons).join('|');
  assert.ok(/right foot lands/.test(text) && /left foot lands/.test(text), 'both feet land');
  assert.ok(/hip height (high|low)/.test(text), 'the bounce is there');
  assert.ok(keys.every((k, i) => i === 0 || k.frame > keys[i - 1].frame), 'in time order, once each');
});

test('key frames of a dog walk and a gallop name its paws', () => {
  for (const p of [dog, { ...dog, ...PRESETS_DOG.Gallop }]) {
    const keys = findKeyFrames(p);
    const text = keys.flatMap((k) => k.reasons).join('|');
    for (const leg of ['FL', 'FR', 'HL', 'HR']) assert.ok(text.includes(`${leg} paw lands`), `${leg} lands`);
    assert.ok(keys.length < cycleFrames(p).frames.length);
  }
});

test('a lower swing threshold finds more key frames than a higher one', () => {
  assert.ok(findKeyFrames(human, { minSwing: 0.03 }).length >= findKeyFrames(human, { minSwing: 0.3 }).length);
});

test('key frames follow a performance with automation', () => {
  const lanes = { cadence: { pts: [{ t: 0, v: 1 }, { t: 60, v: 0 }], interp: 'smooth' } };
  const perf = withPerf(human, lanes, 120);
  assert.ok(hasLanes(perf.perf.lanes));
  const keys = findKeyFrames(perf);
  const lands = keys.filter((k) => k.reasons.some((r) => /lands/.test(r)));
  assert.ok(lands.length >= 2 && lands.every((k) => k.frame < 100), 'feet land while it slows, none after it has stopped');
});

test('pose for a frame matches the cycle pose when there is no automation', () => {
  const a = poseFor(human, 3); const n = cycleFrames(human).frames.length;
  assert.deepEqual(poseFor(human, 3 + n).pelvis, a.pelvis, 'frames wrap');
  assert.ok(trackedPoints(a).length >= 10);
});

test('the lane table has one row per frame and one column per lane, with the base value where a lane is empty', () => {
  const lanes = { cadence: { pts: [{ t: 0, v: 1 }, { t: 20, v: 0.5 }], interp: 'linear' }, 'p:bob': { pts: [{ t: 10, v: 0.2 }, { t: 30, v: 0.4 }], interp: 'linear' } };
  const perf = withPerf(human, lanes, 40);
  const tb = laneTable(perf);
  assert.equal(tb.rows.length, 40);
  assert.deepEqual(tb.columns.slice(0, 4), ['frame', 'seconds', 'cycle_phase', 'position']);
  assert.ok(tb.columns.includes('cadence') && tb.columns.includes('p:bob'));
  const ci = tb.columns.indexOf('cadence');
  assert.equal(tb.rows[0][ci], 1); assert.equal(tb.rows[20][ci], 0.5); assert.equal(tb.rows[39][ci], 0.5);
  const csv = tableCsv(tb).trim().split('\n');
  assert.equal(csv.length, 41); assert.equal(csv[0].split(',').length, tb.columns.length);
  assert.equal(csv[1].split(',')[0], '1');
});

test('a walk with no automation still gives a table of phase and position', () => {
  const tb = laneTable(human);
  assert.equal(tb.rows.length, cycleFrames(human).frames.length);
  assert.equal(tb.columns.length, 4);
});
