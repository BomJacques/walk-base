import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { pose3, len, sub } from '../src/rig3.js';
import { PRESETS_HOSE, CONTROLS } from '../src/controls.js';

const hose = (o = {}) => ({ ...DEFAULTS, ...PRESETS_HOSE.Bouncy, model: 'hose', proportions: {}, motion: {}, ...o });
const dist = (a, b) => len(sub(a, b));

test('with follow-through the hand trails the wrist, and with none it is where the arm puts it', () => {
  const on = hose({ hoseFollow: 1 }); const off = hose({ hoseFollow: 0 });
  let moved = 0;
  for (let i = 0; i < 48; i++) {
    const u = i / 48; const a = pose3(on, {}, u).sides.R; const b = pose3(off, {}, u).sides.R;
    assert.deepEqual(b.handF, b.hand, 'no follow-through leaves the hand alone');
    assert.deepEqual(a.hand, b.hand, 'the arm itself does not change');
    if (dist(a.handF, a.hand) > 0.01) moved++;
  }
  assert.ok(moved > 20, `the hand trails in most of the cycle (${moved} of 48)`);
});

test('the mannequin has no follow-through, whatever the setting says', () => {
  const m = { ...hose({ hoseFollow: 1 }), model: 'mannequin' };
  const z = pose3(m, {}, 0.3).sides.R; assert.deepEqual(z.handF, z.hand);
});

test('a planted foot stays planted: follow-through only moves a foot in the air', () => {
  const on = hose({ hoseFollow: 1.5 }); const off = hose({ hoseFollow: 0 });
  let stance = 0; let swingMoved = 0;
  for (let i = 0; i < 96; i++) {
    const u = i / 96; const a = pose3(on, {}, u).sides.R; const b = pose3(off, {}, u).sides.R;
    if (a.stance) { stance++; assert.ok(dist(a.ankle, b.ankle) < 1e-9, `planted at ${i}`); } else if (dist(a.ankle, b.ankle) > 0.005) swingMoved++;
  }
  assert.ok(stance > 30 && swingMoved > 10, `${stance} planted, ${swingMoved} trailing`);
});

test('every hose walk still keeps both feet reachable with follow-through at full', () => {
  for (const [name, preset] of Object.entries(PRESETS_HOSE)) {
    const p = { ...DEFAULTS, ...preset, model: 'hose', hoseFollow: 1.5, proportions: {}, motion: {} };
    for (let i = 0; i < 96; i++) { const z = pose3(p, {}, i / 96); assert.ok(z.sides.R.reached && z.sides.L.reached, `${name} at ${i}`); }
  }
});

test('the controls are for the rubber hose figure only', async () => {
  const { wordsFor } = await import('../src/words.js');
  for (const id of ['hoseFollow', 'hoseStretch']) { const c = CONTROLS.find((x) => x.id === id); assert.ok(c && c.tab === 'Gait', id); assert.equal(wordsFor('human').hides(c), true); assert.equal(wordsFor('hose').hides(c), false); }
});
