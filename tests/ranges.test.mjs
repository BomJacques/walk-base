import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLS, PRESETS, PRESETS_HOSE, PRESETS_DOG } from '../src/controls.js';
import { CHANNELS } from '../src/motion.js';
import { DEFAULTS } from '../src/rig.js';

const ctl = (id, scope = 'p') => CONTROLS.find((c) => c.id === id && c.scope === scope);

test('the adjustments reach further, positive and negative', () => {
  assert.equal(ctl('armSwing').max, 120, 'arm swing goes to twice what it did');
  assert.equal(ctl('lean').min, -30); assert.equal(ctl('lean').max, 60, 'a signed slider goes twice as far each way');
  assert.equal(ctl('kneeOut').min, -30);
  assert.ok(ctl('stepLength').max >= 2, 'a longer step');
  assert.ok(ctl('head', 'r').max > 3.5 && ctl('head', 'r').min < 0.4, 'proportions reach smaller and bigger');
  for (const ch of CHANNELS.filter((c) => c.id === 'pelvis.y')) assert.equal(ch.max, 0.24);
});

test('what has a natural limit is left alone', () => {
  assert.equal(ctl('duty').max, 0.85); assert.equal(ctl('weight').max, 1); assert.equal(ctl('weight').min, -1);
  assert.equal(ctl('heading').max, 180); assert.equal(ctl('cycleFrames').max, 96); assert.equal(ctl('noiseAmount').max, 1);
});

test('every default and every preset is still inside its range', () => {
  for (const c of CONTROLS.filter((x) => x.type === 'number' && x.scope === 'p')) { const v = DEFAULTS[c.id]; if (typeof v === 'number') assert.ok(v >= c.min - 1e-9 && v <= c.max + 1e-9, `${c.id} default ${v}`); }
  for (const [set, name] of [[PRESETS, 'human'], [PRESETS_HOSE, 'hose'], [PRESETS_DOG, 'dog']]) for (const [pn, pr] of Object.entries(set)) for (const [k, v] of Object.entries(pr)) { const c = ctl(k); if (c?.type === 'number') assert.ok(v >= c.min - 1e-9 && v <= c.max + 1e-9, `${name} ${pn}.${k}=${v} within ${c.min}..${c.max}`); }
});
