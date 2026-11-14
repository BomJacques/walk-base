import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanIdle, idleLayer, applyLayer, scheduleFidgets, IDLE_STYLES, IDLE_DEFAULTS, STANCES, FIDGETS, rng } from '../src/idle.js';
import { laneValue, targetOfChannel } from '../src/automation.js';
import { CHANNEL_BY_ID } from '../src/motion.js';
import { clipsForFigure } from '../src/clips.js';

const fps = 24; const N = 24 * 20;
const sum = (a) => a.reduce((t, v) => t + Math.abs(v), 0);

test('settings are cleaned: every number in range, the lists of known things only', () => {
  const c = cleanIdle({ seconds: 9999, breathRate: -5, fidgets: ['scratch', 'dance', 7], stance: 'nonsense', pose: 'flying', seed: 'x' });
  assert.equal(c.seconds, 300); assert.equal(c.breathRate, 4); assert.deepEqual(c.fidgets, ['scratch']); assert.equal(c.stance, IDLE_DEFAULTS.stance); assert.equal(c.pose, 'standing'); assert.equal(c.seed, IDLE_DEFAULTS.seed);
  assert.deepEqual(cleanIdle(null).fidgets, IDLE_DEFAULTS.fidgets);
});

test('the same settings give the same idle, and another seed gives another', () => {
  const a = idleLayer({ seed: 5 }, fps, N).layer; const b = idleLayer({ seed: 5 }, fps, N).layer; const c = idleLayer({ seed: 6 }, fps, N).layer;
  assert.deepEqual(Array.from(a['head.yaw']), Array.from(b['head.yaw']));
  assert.ok(sum(Array.from(a['head.yaw']).map((v, i) => v - c['head.yaw'][i])) > 0.5);
});

test('the idle eases in and out: it starts and ends at nothing', () => {
  const { layer } = idleLayer({ seed: 3, stance: 'Hands on hips', tap: true }, fps, N);
  for (const [id, v] of Object.entries(layer)) { assert.ok(Math.abs(v[0]) < 1e-6 && Math.abs(v[N - 1]) < 1e-6, `${id} starts at ${v[0]} and ends at ${v[N - 1]}`); assert.ok(v.every(Number.isFinite), id); }
});

test('breathing goes at the chosen rate and the chest moves with it', () => {
  const { layer } = idleLayer({ breathing: 1, breathRate: 12, shift: 0, look: 0, tap: false, stance: 'Arms down', fidgets: [] }, fps, N);
  const v = layer['spine3.pitch']; let crossings = 0; for (let i = 1; i < N; i++) if (v[i - 1] < 0 !== v[i] < 0) crossings++;
  assert.ok(Math.abs(crossings / 2 - (12 * 20) / 60) <= 1.5, `${crossings / 2} breaths in 20 s`);
  assert.ok(Math.max(...v) > 0.02);
});

test('with every control at nothing the idle does hardly anything but a faint sway', () => {
  const { layer } = idleLayer({ breathing: 0, shift: 0, look: 0, tap: false, stance: 'Arms down', fidgets: [] }, fps, N);
  for (const v of Object.values(layer)) assert.ok(Math.max(...Array.from(v).map(Math.abs)) < 0.02);
});

test('weight shifts move the hips sideways and looking moves the head, both more when asked', () => {
  const peak = (s, id) => Math.max(...Array.from(idleLayer(s, fps, N).layer[id]).map(Math.abs));
  assert.ok(peak({ seed: 2, shift: 1 }, 'pelvis.z') > 2 * peak({ seed: 2, shift: 0.2 }, 'pelvis.z'));
  assert.ok(peak({ seed: 2, look: 1 }, 'head.yaw') > 2 * peak({ seed: 2, look: 0.2 }, 'head.yaw'));
});

test('fidgets are spread out, never overlap, and stay clear of the ends', () => {
  const len = () => 56; const f = scheduleFidgets(cleanIdle({ seed: 4, fidgets: ['scratch', 'shrug', 'yawn'], fidgetRate: 6 }), fps, N, len);
  assert.ok(f.length >= 2);
  for (let i = 0; i < f.length; i++) { assert.ok(f[i].start >= fps * 2 && f[i].start + f[i].frames <= N, 'inside the idle'); if (i) assert.ok(f[i].start >= f[i - 1].start + f[i - 1].frames + fps, 'a gap between them'); }
  assert.equal(scheduleFidgets(cleanIdle({ fidgets: [] }), fps, N, len).length, 0);
});

test('the arm stance steps aside while a fidget has the arms', () => {
  const { layer, fidgets, busy } = idleLayer({ seed: 9, stance: 'Hands on hips', fidgets: ['scratch'], fidgetRate: 6, breathing: 0, shift: 0, look: 0, tap: false }, fps, N);
  assert.ok(fidgets.length);
  const q = fidgets[0]; const mid = q.start + 10; assert.equal(busy[mid], 1);
  assert.ok(Math.abs(layer['elbow.flex.R'][mid]) < 1e-9, 'no stance while it scratches');
  assert.ok(Math.abs(layer['elbow.flex.R'][Math.floor(N / 2)]) > 0.5 || busy[Math.floor(N / 2)] > 0, 'and the stance outside it');
});

test('laying the idle over lanes adds to what is there and leaves the rest alone', () => {
  const range = () => 2; const target = targetOfChannel('spine2.pitch', 'offset');
  const lanes = { [target]: { pts: [{ t: 0, v: 0 }, { t: 60, v: 0.5 }, { t: 400, v: 0.5 }], interp: 'smooth' }, other: { pts: [{ t: 0, v: 1 }] } };
  const layer = { 'spine2.pitch': Float64Array.from({ length: 120 }, (_, k) => 0.1 * Math.sin(k / 6) * Math.sin((Math.PI * k) / 119)) };
  const next = applyLayer(lanes, layer, 100, range);
  assert.deepEqual(next.other, lanes.other);
  for (const t of [100, 130, 160, 219]) assert.ok(Math.abs(laneValue(next[target], t, 0) - (laneValue(lanes[target], t, 0) + layer['spine2.pitch'][t - 100])) < 0.004, `at ${t}`);
  for (const t of [10, 40, 59, 230, 300]) assert.ok(Math.abs(laneValue(next[target], t, 0) - laneValue(lanes[target], t, 0)) < 0.004, `outside, at ${t}`);
  assert.ok(next[target].pts.length < 200, 'thinned');
});

test('every style, stance and fidget is valid, and every fidget is a movement the person has', () => {
  for (const [n, s] of Object.entries(IDLE_STYLES)) { const c = cleanIdle({ ...s, style: n }); assert.equal(c.style, n); assert.deepEqual(c.fidgets, s.fidgets, n); assert.equal(c.stance, s.stance, n); }
  const ids = clipsForFigure('human').map((c) => c.id);
  for (const [id] of FIDGETS) assert.ok(ids.includes(id), id);
  for (const st of Object.values(STANCES)) for (const k of Object.keys(st)) assert.ok(CHANNEL_BY_ID[k], k);
  assert.equal(typeof rng(1)(), 'number');
});

test('a seated or crouched figure keeps its head on its neck: the head steadying only works against the walk\'s own bob', async () => {
  const { DEFAULTS } = await import('../src/rig.js'); const { pose3 } = await import('../src/rig3.js');
  const z = pose3({ ...DEFAULTS, headBob: 1, stepLength: 0 }, { 'pelvis.y': { amount: 1, offset: -0.5 } }, 0.2);
  assert.ok(Math.abs(z.neckBase[1] - z.j3[1]) < 0.06, `the neck base is ${z.neckBase[1] - z.j3[1]} from the top of the spine`);
});
