import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { poseDog, pawGait } from '../src/dog3.js';
import { PRESETS_DOG, CONTROLS } from '../src/controls.js';

const base = { ...DEFAULTS, rig: 'dog', motion: {}, proportions: {} };
const stanceShare = (p, leg) => { let n = 0; for (let i = 0; i < 96; i++) if (poseDog(p, {}, i / 96).legs[leg].stance) n++; return n / 96; };

test('with no difference the two sides are the same, half a cycle apart', () => {
  for (const [a, b] of [['HR', 'HL'], ['FR', 'FL']]) {
    const ga = pawGait(base, a); const gb = pawGait(base, b);
    assert.equal(ga.duty, gb.duty); assert.equal(ga.lift, gb.lift); assert.ok(Math.abs(((gb.ph - ga.ph + 1) % 1) - 0.5) < 1e-9);
  }
});

test('the left paws can stay down for a different time, land late and lift differently', () => {
  const p = { ...base, dogAsymDuty: -0.14, dogAsymTiming: 0.05, dogAsymLift: -0.5 };
  assert.ok(stanceShare(p, 'HL') < stanceShare(p, 'HR') - 0.1, 'the left hind is hurried off the ground');
  assert.ok(Math.abs(stanceShare(p, 'HR') - base.dogDuty) < 0.03, 'the right side is untouched');
  assert.ok(Math.abs(pawGait(p, 'HL').ph - (pawGait(base, 'HL').ph + 0.05)) < 1e-9);
  assert.ok(Math.abs(pawGait(p, 'FL').lift - base.dogLift * 0.5) < 1e-9);
  assert.equal(pawGait(p, 'FR').lift, base.dogLift);
});

test('a planted paw does not slide, even with an uneven gait', () => {
  const p = { ...base, dogAsymDuty: -0.12, dogAsymTiming: 0.04 };
  for (const leg of ['HR', 'HL', 'FR', 'FL']) {
    const xs = [];
    // one planted stretch at a time: the paw's place in the world stays put while the body moves over it
    const runs = []; let cur = [];
    for (let i = 0; i < 192; i++) { const u = i / 96; const l = poseDog(p, {}, u).legs[leg]; if (l.stance) cur.push(u * p.dogStride + l.paw[0]); else if (cur.length) { runs.push(cur); cur = []; } }
    if (cur.length) runs.push(cur);
    const full = runs.filter((r) => r.length > 8);
    assert.ok(full.length >= 1, leg);
    for (const r of full) assert.ok(Math.max(...r) - Math.min(...r) < 0.08, `${leg} slides ${Math.max(...r) - Math.min(...r)}`);
  }
});

test('every paw still reaches the ground, and the controls and the Limp preset exist', () => {
  const p = { ...base, ...PRESETS_DOG.Limp };
  for (let i = 0; i < 96; i++) { const z = poseDog(p, {}, i / 96); for (const leg of ['HR', 'HL', 'FR', 'FL']) assert.ok(z.legs[leg].reached, `${leg} at ${i}`); }
  for (const id of ['dogAsymTiming', 'dogAsymDuty', 'dogAsymLift']) assert.ok(CONTROLS.find((c) => c.id === id), id);
  assert.ok(PRESETS_DOG.Limp.dogAsymDuty < 0);
});
