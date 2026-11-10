import test from 'node:test';
import assert from 'node:assert/strict';
import { PAD_COUNT, BLENDS, newBank, capturePad, transitionValues, blendFrames, cleanBank, cleanBanks } from '../src/pads.js';
import { DEFAULTS } from '../src/rig.js';
import { PRESETS } from '../src/controls.js';
import { newMood } from '../src/mood.js';
import { pose3 } from '../src/rig3.js';

test('a bank has eight empty pads, changes at once and blends over one cycle', () => {
  const b = newBank(); assert.equal(PAD_COUNT, 8); assert.equal(b.pads.length, 8); assert.ok(b.pads.every((p) => p === null)); assert.equal(b.when, 'now'); assert.equal(b.blend, 1); assert.equal(b.active, null);
  assert.deepEqual(BLENDS.map(([v]) => v), [0, 0.5, 1, 2, 4]);
});

test('a pad keeps the whole walk and the mood pad, but not which figure it is or the frame rate', () => {
  const mood = { ...newMood(), x: 0.1, y: 0.2 }; const p = { ...DEFAULTS, ...PRESETS.March, terrain: 'slope', noiseLoop: false };
  const pad = capturePad(p, mood, 'March up a hill, with a very long name indeed');
  assert.equal(pad.name.length, 24); assert.equal(pad.values.footLift, PRESETS.March.footLift); assert.equal(pad.values.cycleFrames, PRESETS.March.cycleFrames); assert.equal(pad.values.lean, PRESETS.March.lean);
  for (const k of ['rig', 'model', 'fps', 'exposure', 'travel', 'dogSpecies']) { assert.equal(pad.values[k], undefined, k); assert.equal(pad.flags[k], undefined, k); }
  assert.equal(pad.flags.terrain, 'slope'); assert.equal(pad.flags.noiseLoop, false); assert.equal(pad.flags.noiseSeed, DEFAULTS.noiseSeed, 'whole-number settings switch, they do not blend');
  assert.deepEqual([pad.mood.x, pad.mood.y], [0.1, 0.2]); mood.x = 0.9; assert.equal(pad.mood.x, 0.1, 'its own copy');
});

test('a blend starts at the walk that is playing, ends exactly at the pad, and eases in and out', () => {
  const from = { lean: 0, bob: 0.05, cycleFrames: 24 }; const to = { lean: 10, bob: 0.15, cycleFrames: 16 };
  assert.deepEqual(transitionValues(from, to, 0), from); assert.deepEqual(transitionValues(from, to, 1), to); assert.deepEqual(transitionValues(from, to, 3), to);
  const mid = transitionValues(from, to, 0.5); assert.equal(mid.lean, 5); assert.equal(mid.cycleFrames, 20);
  const steps = Array.from({ length: 21 }, (_, i) => transitionValues(from, to, i / 20).lean);
  for (let i = 1; i < steps.length; i++) assert.ok(steps[i] >= steps[i - 1], 'it only ever moves toward the pad');
  assert.ok(steps[1] - steps[0] < steps[10] - steps[9] && steps[20] - steps[19] < steps[10] - steps[9], 'slow at each end, quicker in the middle');
  assert.ok(Number.isInteger(transitionValues(from, to, 0.37).cycleFrames));
  assert.deepEqual(transitionValues({}, { lean: 7 }, 0.2), { lean: 7 }, 'a setting the walk does not have yet starts where it is going');
  assert.equal(transitionValues({ lean: 1, bob: 9 }, { lean: 3 }, 0.5).bob, undefined, 'only what the pad holds');
});

test('every walk between two pads is one the figure can do', () => {
  for (const [a, b] of [['Normal', 'Sneak'], ['March', 'Tired'], ['Run', 'Shuffle'], ['Strut', 'Limp']]) {
    const A = capturePad({ ...DEFAULTS, ...PRESETS[a] }, null, a).values; const B = capturePad({ ...DEFAULTS, ...PRESETS[b] }, null, b).values;
    for (const t of [0.25, 0.5, 0.75]) { const p = { ...DEFAULTS, ...transitionValues(A, B, t), proportions: {}, motion: {} }; let bad = 0; for (let i = 0; i < 24; i++) { const z = pose3(p, {}, i / 24); if (!z.sides.R.reached || !z.sides.L.reached) bad++; assert.ok(z.headC.every(Number.isFinite)); } assert.ok(bad <= 2, `${a} to ${b} at ${t}: ${bad} frames out of reach`); }
  }
});

test('the blend takes so many cycles of the walk that is playing', () => {
  assert.equal(blendFrames({ blend: 1 }, 24), 24); assert.equal(blendFrames({ blend: 0.5 }, 24), 12); assert.equal(blendFrames({ blend: 2 }, 16), 32); assert.equal(blendFrames({ blend: 0 }, 24), 0); assert.equal(blendFrames(null, 24), 0);
});

test('a saved bank is cleaned, and banks are kept for each figure', () => {
  const pad = capturePad({ ...DEFAULTS, ...PRESETS.Sneak }, newMood(), 'Sneak');
  const b = cleanBank({ name: 'x'.repeat(80), pads: [pad, { values: {} }, 'junk', { name: 'bad', values: { lean: 'no' } }, { values: { lean: 5, rig: 3 }, flags: { terrain: 'steps', model: 'hose' } }], when: 'cycle', blend: 2, active: 4 });
  assert.equal(b.name.length, 40); assert.equal(b.pads.length, 8); assert.equal(b.pads[0].values.stepLength, PRESETS.Sneak.stepLength); assert.equal(b.pads[1], null); assert.equal(b.pads[2], null); assert.equal(b.pads[3], null);
  assert.deepEqual(b.pads[4].values, { lean: 5 }); assert.deepEqual(b.pads[4].flags, { terrain: 'steps' }); assert.equal(b.when, 'cycle'); assert.equal(b.blend, 2); assert.equal(b.active, 4);
  assert.equal(cleanBank({ blend: 3, active: 1, when: 'later' }).blend, 1); assert.equal(cleanBank({ active: 1 }).active, null, 'an empty pad cannot be the one that is on'); assert.equal(cleanBank({ when: 'later' }).when, 'now');
  const all = cleanBanks({ human: { pads: [pad] }, dog: { pads: [] }, robot: { pads: [pad] } }, ['human', 'dog', 'hose']);
  assert.deepEqual(Object.keys(all).sort(), ['dog', 'human']); assert.deepEqual(cleanBanks(null, ['human']), {});
});
