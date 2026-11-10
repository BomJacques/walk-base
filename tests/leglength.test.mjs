import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, LEG_LENGTH } from '../src/rig.js';
import { pose3, legLength } from '../src/rig3.js';
import { CONTROLS, PRESETS, PRESETS_HOSE, HOSE_PROPORTIONS } from '../src/controls.js';

const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const z = (leg, over = {}, u = 0.1) => pose3({ ...DEFAULTS, ...over, proportions: { ...(over.proportions || {}), ...(leg == null ? {} : { leg }) }, motion: {} }, {}, u);

test('Leg length is a proportion for the human and the rubber hose figure', () => {
  const c = CONTROLS.find((x) => x.id === 'leg' && x.scope === 'r'); assert.ok(c, 'there is a Leg length control'); assert.equal(c.label, 'Leg length'); assert.equal(c.group, 'Proportions');
  assert.ok(c.min < 0.6 && c.max > 1.8, `${c.min} to ${c.max}`);
  assert.equal(legLength({}), LEG_LENGTH); assert.equal(legLength({ proportions: { leg: 1.5 } }), LEG_LENGTH * 1.5);
});

test('the legs really are that long, the hips ride higher, and the feet stay on the ground', () => {
  const a = z(null); const long = z(1.4); const short = z(0.75);
  for (const [p, k] of [[a, 1], [long, 1.4], [short, 0.75]]) for (const s of ['R', 'L']) {
    const sd = p.sides[s]; const bone = len(sd.hip, sd.knee) + len(sd.knee, sd.ankle);
    assert.ok(Math.abs(bone - LEG_LENGTH * k) < 1e-6, `thigh and shin add up to the leg (${k}): ${bone}`); assert.ok(sd.reached, `reaches at ${k}`);
    assert.ok(Math.abs(len(sd.hip, sd.knee) / bone - len(a.sides[s].hip, a.sides[s].knee) / LEG_LENGTH) < 1e-6, 'the thigh keeps its share');
  }
  assert.ok(long.pelvis[1] > a.pelvis[1] + 0.3 && short.pelvis[1] < a.pelvis[1] - 0.15, 'longer legs stand taller, shorter ones lower');
  assert.ok(long.headC[1] - long.pelvis[1] - (a.headC[1] - a.pelvis[1]) < 1e-9, 'the body above the hips is the same size');
  for (let i = 0; i < 24; i++) for (const k of [0.75, 1, 1.4]) { const p = z(k, {}, i / 24); for (const s of ['R', 'L']) if (p.sides[s].stance) assert.ok(Math.abs(p.sides[s].ankle[1] - a.sides.R.ankle[1]) < 0.2 && p.sides[s].ankle[1] < 0.2, `a planted foot is on the ground at ${k}`); }
  assert.ok(Math.abs(long.pelvisX - a.pelvisX) < 1e-9, 'the steps are the same length');
});

test('every walk still reaches the ground on long and short legs, for both figures', () => {
  for (const [set, model, base] of [[PRESETS, 'mannequin', {}], [PRESETS_HOSE, 'hose', HOSE_PROPORTIONS]]) for (const [name, pr] of Object.entries(set)) {
    if (pr.terrain) continue;
    for (const k of [0.8, 1.3]) {
      const { camYaw, ...q } = pr; let bad = 0;
      for (let i = 0; i < 48; i++) { const p = pose3({ ...DEFAULTS, ...q, model, proportions: { ...base, leg: k }, motion: {} }, {}, i / 48); if (!p.sides.R.reached || !p.sides.L.reached) bad++; assert.ok(p.pelvis.every(Number.isFinite)); }
      assert.ok(bad <= 2, `${model} ${name} with legs at ${k}: ${bad} frames out of reach`);
    }
  }
});
