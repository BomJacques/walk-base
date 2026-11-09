import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { clipsFor, applyClip, CLIP_GROUPS } from '../src/clips.js';
import { integrate, paramsAt, motionAt, laneValue } from '../src/automation.js';
import { pose3, len, sub } from '../src/rig3.js';

const base = { ...DEFAULTS };
const clip = (id) => clipsFor('human').find((c) => c.id === id);
const run = (id, extra = {}) => {
  const c = clip(id); const at = 24; const lanes = applyClip({}, c, { ...base, ...extra }, at, c.frames); const T = at + c.frames + 72;
  const b = { ...base, ...extra }; const s = integrate(b, lanes, T, Math.round(b.cycleFrames), null);
  const poses = []; for (let t = 0; t < T; t++) poses.push(pose3({ ...paramsAt(b, lanes, t), proportions: {}, motion: {} }, motionAt({}, lanes, t), s.u[t], { worldX: s.x[t] }));
  return { c, lanes, poses, at, T };
};

test('the three movements are in the Action group', () => {
  for (const id of ['stumble', 'slip', 'stagger']) { assert.ok(clip(id), id); assert.ok(CLIP_GROUPS.find(([g]) => g === 'Action')[1].includes(id), id); }
});

test('a stumble pitches the body forward, throws the arms up, and recovers', () => {
  const { c, lanes, poses, at } = run('stumble');
  const spine = (z) => z.j3[0] - z.pelvis[0]; // how far the chest is ahead of the hips
  const before = spine(poses[at - 1]); let peak = -Infinity; let armUp = -Infinity; const reach0 = (z) => Math.max(z.sides.R.wrist[0] - z.sides.R.shoulder[0], z.sides.L.wrist[0] - z.sides.L.shoulder[0]);
  for (let t = at; t < at + c.frames; t++) { peak = Math.max(peak, spine(poses[t])); armUp = Math.max(armUp, reach0(poses[t])); }
  assert.ok(peak > before + 0.04, `the chest goes ahead of the hips (${before.toFixed(3)} to ${peak.toFixed(3)})`);
  assert.ok(armUp > Math.max(...poses.slice(0, at).map(reach0)) + 0.02, `an arm flings out ahead of the body (${armUp.toFixed(3)})`);
  const end = lanes['c:spine1.pitch:offset']; assert.equal(laneValue(end, at + c.frames, 0), 0, 'the body is back to neutral at the end');
  assert.ok(laneValue(lanes.cadence, at + c.frames * 0.3, 1) < 0.8, 'the pace drops as the toe catches');
  assert.ok(laneValue(lanes.cadence, at + c.frames * 0.5, 1) > 1.15, 'and quickens for the saving step');
});

test('a slip drops the hips and leans the body back', () => {
  const { c, poses, at } = run('slip');
  let low = Infinity; let lean = Infinity;
  for (let t = at; t < at + c.frames; t++) { low = Math.min(low, poses[t].pelvis[1]); lean = Math.min(lean, poses[t].j3[0] - poses[t].pelvis[0]); }
  assert.ok(low < poses[at - 1].pelvis[1] - 0.05, 'the hips drop');
  assert.ok(lean < poses[at - 1].j3[0] - poses[at - 1].pelvis[0] - 0.04, 'the chest goes behind where it was');
});

test('a stagger rocks the body from side to side', () => {
  const { c, poses, at } = run('stagger');
  const sides = []; for (let t = at; t < at + c.frames; t++) sides.push(poses[t].j3[2] - poses[t].pelvis[2]);
  assert.ok(Math.max(...sides) - Math.min(...sides) > 0.05, 'the chest swings across the hips');
});

test('the feet stay reachable through each movement, at a light, normal and heavy weight', () => {
  for (const w of [-0.6, 0, 0.8]) for (const id of ['stumble', 'slip', 'stagger']) {
    const { poses } = run(id, { weight: w }); let bad = 0;
    for (const z of poses) if (!z.sides.R.reached || !z.sides.L.reached) bad++;
    assert.ok(bad <= 4, `${id} at weight ${w}: ${bad} frames with a foot out of reach`);
  }
  void len; void sub;
});
