import test from 'node:test';
import assert from 'node:assert/strict';
import { MOODS, MOODS_DOG, newMood, cleanMood, moodWeights, cornerTarget, blendMood, moodKeys, CORNERS } from '../src/mood.js';
import { DEFAULTS } from '../src/rig.js';
import { pose3 } from '../src/rig3.js';
import { poseDog, legsOf } from '../src/dog3.js';
import { CONTROLS, PRESETS } from '../src/controls.js';
import { clipsForFigure } from '../src/clips.js';

const ctl = Object.fromEntries(CONTROLS.filter((c) => c.scope === 'p').map((c) => [c.id, c]));
const limit = (k, v) => (ctl[k]?.type === 'number' ? Math.min(ctl[k].max, Math.max(ctl[k].min, v)) : v);
const base = Object.fromEntries(Object.entries(DEFAULTS).filter(([, v]) => typeof v === 'number'));
const at = (x, y, over = {}) => blendMood({ ...newMood(), x, y, ...over }, base, DEFAULTS, 'human', PRESETS, limit);
const close = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} vs ${b}`);

test('the middle of the pad is the walk as it is, and each corner is all of its mood', () => {
  const w = moodWeights(0.5, 0.5); assert.equal(w.strength, 0); for (const c of CORNERS) assert.equal(w[c], 0);
  for (const [k, v] of Object.entries(at(0.5, 0.5))) close(v, base[k], k);
  assert.deepEqual([moodWeights(0, 0).tl, moodWeights(1, 0).tr, moodWeights(0, 1).bl, moodWeights(1, 1).br], [1, 1, 1, 1]);
  const happy = at(0, 0); for (const [k, v] of Object.entries(MOODS.Happy)) close(happy[k], limit(k, k === 'cycleFrames' ? Math.round(v) : v), `Happy ${k}`);
  const sneaky = at(1, 1); close(sneaky.stepLength, MOODS.Sneaky.stepLength, 'Sneaky');
  close(happy.duty, base.duty, 'a setting the mood does not name is left alone');
});

test('half way along an edge is half of each of its two moods; half way to a corner is half that mood', () => {
  const w = moodWeights(0.5, 0); close(w.tl, 0.5, 'tl'); close(w.tr, 0.5, 'tr'); close(w.bl + w.br, 0, 'bottom');
  const mix = at(0.5, 0); close(mix.lean, base.lean + 0.5 * (MOODS.Happy.lean - DEFAULTS.lean) + 0.5 * (MOODS.Angry.lean - DEFAULTS.lean), 'lean');
  const half = at(0.25, 0.25); close(half.bob, base.bob + 0.5 * (MOODS.Happy.bob - DEFAULTS.bob), 'half way to happy');
  for (const [x, y] of [[0.1, 0.9], [0.7, 0.2], [0.5, 0.8], [0.33, 0.5], [1, 0.4]]) { const q = moodWeights(x, y); close(q.tl + q.tr + q.bl + q.br, q.strength, 'the parts add up to how far out the dot is'); assert.ok(CORNERS.every((c) => q[c] >= 0 && q[c] <= 1)); }
  let prev = at(0.5, 0.5).lean; for (let i = 1; i <= 10; i++) { const v = at(0.5 + 0.05 * i, 0.5 - 0.05 * i).lean; assert.ok(v >= prev - 1e-9, 'it moves steadily toward the corner'); prev = v; }
});

test('a mood is a change to the walk in the middle, so a happy limp is still a limp', () => {
  const limp = { ...base, ...PRESETS.Limp }; const out = blendMood({ ...newMood(), x: 0, y: 0 }, limp, DEFAULTS, 'human', PRESETS, limit);
  close(out.stepLength, limit('stepLength', PRESETS.Limp.stepLength + (MOODS.Happy.stepLength - DEFAULTS.stepLength)), 'step');
  assert.equal(out.asymDuty, undefined, 'the limp itself is not something the pad moves'); assert.equal(Number.isInteger(out.cycleFrames), true);
});

test('corners can be one of the figure\'s own walks or a captured walk, and settings can be left out', () => {
  const corners = { ...newMood().corners, tl: { kind: 'preset', name: 'March' }, tr: { kind: 'custom', name: 'Mine', values: { lean: 20, armSwing: 50, nonsense: 3 } } };
  const march = at(0, 0, { corners }); close(march.footLift, PRESETS.March.footLift, 'the walk itself, not a change'); close(march.armSwing, PRESETS.March.armSwing, 'arm');
  const mine = at(1, 0, { corners }); close(mine.lean, 20, 'captured'); assert.equal(mine.nonsense, undefined);
  const keys = moodKeys({ ...newMood(), corners }, base, DEFAULTS, 'human', PRESETS); assert.ok(keys.includes('footLift') && keys.includes('lean') && !keys.includes('nonsense'));
  const skipped = at(0, 0, { skip: ['bob', 'cycleFrames'] }); close(skipped.bob, base.bob, 'left out'); close(skipped.cycleFrames, base.cycleFrames, 'left out'); assert.notEqual(skipped.armSwing, base.armSwing);
  assert.deepEqual(cornerTarget({ kind: 'preset', name: 'No such walk' }, base, DEFAULTS, 'human', PRESETS), {});
  for (const [k, v] of Object.entries(at(1, 0, { corners: { ...corners, tr: { kind: 'custom', values: { lean: 999 } } } }))) if (ctl[k]) assert.ok(v <= ctl[k].max && v >= ctl[k].min, `${k} stays on its slider`);
});

test('every mood names real settings, inside their sliders, and the figure can walk it', () => {
  for (const [name, m] of Object.entries(MOODS)) {
    for (const [k, v] of Object.entries(m)) { assert.equal(typeof DEFAULTS[k], 'number', `${name}.${k}`); if (ctl[k]) assert.ok(v >= ctl[k].min && v <= ctl[k].max, `${name}.${k}=${v}`); }
    for (const model of ['mannequin', 'hose']) for (const s of [0.5, 1]) {
      const p = { ...DEFAULTS, ...blendMood({ ...newMood(), corners: { ...newMood().corners, tl: { kind: 'mood', name } }, x: 0.5 - s / 2, y: 0.5 - s / 2 }, base, DEFAULTS, 'human', PRESETS, limit), model, proportions: {}, motion: {} };
      let bad = 0; for (let i = 0; i < 48; i++) { const z = pose3(p, {}, i / 48); if (!z.sides.R.reached || !z.sides.L.reached) bad++; assert.ok(z.headC.every(Number.isFinite)); }
      assert.ok(bad <= 1, `${name} ${model} at ${s}: ${bad} frames out of reach`);
    }
  }
  const dogBase = Object.fromEntries(Object.entries({ ...DEFAULTS, rig: 'dog' }).filter(([, v]) => typeof v === 'number'));
  for (const [name, m] of Object.entries(MOODS_DOG)) {
    for (const [k, v] of Object.entries(m)) { assert.equal(typeof DEFAULTS[k], 'number', `dog ${name}.${k}`); if (ctl[k]) assert.ok(v >= ctl[k].min && v <= ctl[k].max, `dog ${name}.${k}=${v}`); }
    const p = { ...DEFAULTS, rig: 'dog', motion: {}, ...blendMood({ ...newMood(), corners: { ...newMood().corners, tl: { kind: 'mood', name } }, x: 0, y: 0 }, dogBase, DEFAULTS, 'dog', {}, limit) };
    for (let i = 0; i < 24; i++) { const z = poseDog(p, {}, i / 24); for (const k of legsOf(p)) assert.ok(z.legs[k].reached, `dog ${name} ${k} at ${i}`); }
  }
  assert.deepEqual(Object.keys(MOODS).sort(), Object.keys(MOODS_DOG).sort(), 'the same moods for both');
});

test('a saved pad is cleaned', () => {
  const m = cleanMood({ x: 7, y: -2, corners: { tl: { kind: 'custom', name: 'x'.repeat(90), values: { lean: '12', bad: 'no' } }, tr: { kind: 'explode' } }, skip: ['bob', 5], base: { lean: 4, junk: 'a' } });
  assert.equal(m.x, 1); assert.equal(m.y, 0); assert.equal(m.corners.tl.name.length, 40); assert.deepEqual(m.corners.tl.values, { lean: 12 }); assert.deepEqual(m.corners.tr, newMood().corners.tr);
  assert.deepEqual(m.skip, ['bob']); assert.deepEqual(m.base, { lean: 4 }); assert.deepEqual(cleanMood(null), newMood());
});

test('posture: leaning to the side, chest out and slouching, the head tilted and turned, the arms carried', () => {
  const z = (o) => pose3({ ...DEFAULTS, proportions: {}, motion: {}, ...o }, {}, 0.1); const a = z({});
  assert.ok(z({ sideLean: 10 }).headC[2] > a.headC[2] + 0.05, 'positive leans toward the near side'); assert.ok(z({ sideLean: -10 }).headC[2] < a.headC[2] - 0.05);
  assert.ok(z({ chestOut: 15 }).j3[0] < a.j3[0] - 0.03 && z({ chestOut: -15 }).j3[0] > a.j3[0] + 0.03, 'the chest comes out as the shoulders go back; a slouch brings them forward');
  const fwd = (p) => [p.Rh[0], p.Rh[3], p.Rh[6]];
  assert.ok(fwd(z({ headTilt: 20 }))[1] < fwd(a)[1] - 0.2, 'looks down'); assert.ok(fwd(z({ headTilt: -20 }))[1] > fwd(a)[1] + 0.2, 'looks up');
  assert.ok(fwd(z({ headTurn: 45 }))[2] > 0.4 && fwd(z({ headTurn: -45 }))[2] < -0.4, 'turned toward the near side, and the far');
  assert.ok(Math.abs(fwd(z({ chestOut: 15 }))[1] - fwd(a)[1]) < 0.12, 'with the chest out the head still looks ahead');
  assert.ok(z({ armCarry: 30 }).sides.R.wrist[0] > a.sides.R.wrist[0] + 0.15 && z({ armCarry: 30 }).sides.L.wrist[0] > a.sides.L.wrist[0] + 0.15, 'both arms forward');
  for (const k of ['sideLean', 'chestOut', 'headTilt', 'headTurn', 'armCarry', 'carry']) { assert.equal(DEFAULTS[k], 0, k); assert.ok(ctl[k] && ctl[k].min < 0 && ctl[k].max > 0, k); }
});

test('carrying a load: that arm hangs still and straight, and the body leans away', () => {
  const run = (o) => Array.from({ length: 24 }, (_, i) => pose3({ ...DEFAULTS, proportions: {}, motion: {}, ...o }, {}, i / 24));
  const swing = (frames, side) => { const xs = frames.map((z) => z.sides[side].wrist[0] - z.sides[side].shoulder[0]); return Math.max(...xs) - Math.min(...xs); };
  const plain = run({}); const near = run({ carry: 1 }); const far = run({ carry: -1 });
  assert.ok(swing(near, 'R') < swing(plain, 'R') * 0.3, 'the loaded arm hardly swings'); assert.ok(swing(near, 'L') > swing(plain, 'L') * 0.8, 'the other still does');
  assert.ok(swing(far, 'L') < swing(plain, 'L') * 0.3);
  const mean = (frames, f) => frames.reduce((t, z) => t + f(z), 0) / frames.length;
  assert.ok(mean(near, (z) => z.headC[2]) < mean(plain, (z) => z.headC[2]) - 0.05, 'the body leans away from the load');
  assert.ok(mean(near, (z) => Math.abs(z.sides.L.wrist[2])) > mean(plain, (z) => Math.abs(z.sides.L.wrist[2])) + 0.03, 'the free arm comes out for balance');
  assert.ok(near.every((z) => z.sides.R.reached && z.sides.L.reached));
  for (const name of ['Carrying a bag', 'Slouch', 'Chest out', 'Looking back']) { assert.ok(PRESETS[name], name); const fr = run(Object.fromEntries(Object.entries(PRESETS[name]).filter(([k]) => k !== 'camYaw'))); assert.ok(fr.every((z) => z.sides.R.reached && z.sides.L.reached), `${name} reaches`); }
});

test('moods can come on over time as movements', () => {
  const ids = clipsForFigure('human').map((c) => c.id); for (const id of ['gettired', 'perkup', 'cheerup', 'getangry', 'gosneaky']) assert.ok(ids.includes(id), id);
  const tired = clipsForFigure('human').find((c) => c.id === 'gettired'); const lanes = tired.build({ ...DEFAULTS }, tired.frames);
  const step = lanes['p:stepLength']; assert.ok(step && step[0].v === DEFAULTS.stepLength && step[step.length - 1].v < DEFAULTS.stepLength - 0.2 && step[step.length - 1].t === tired.frames, 'the steps shorten across the whole stretch');
});
