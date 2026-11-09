import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { pose3, hoseLimbs, len, sub } from '../src/rig3.js';
import { partBone, attachTargets } from '../src/attach.js';
import { PRESETS_HOSE } from '../src/controls.js';

const hose = { ...DEFAULTS, ...PRESETS_HOSE.Bouncy, model: 'hose', hoseFollow: 1, hoseStretch: 1.5, proportions: {}, motion: {} };

test('a picture on the rubber hose figure goes with the glove, the stretched arm and the trailing foot', () => {
  let moved = 0;
  for (let i = 0; i < 48; i++) {
    const z = pose3(hose, {}, i / 48);
    for (const side of ['R', 'L']) {
      const sd = hoseLimbs(z.sides[side], z.params);
      const hand = partBone(z, 'hand', null, side); const arm = partBone(z, 'arm', null, side); const foot = partBone(z, 'foot', null, side);
      assert.deepEqual(hand[0], sd.wrist); assert.deepEqual(hand[1], sd.hand);
      assert.deepEqual(arm, [sd.shoulder, sd.elbow]);
      assert.deepEqual(foot[0], sd.ankle);
      if (len(sub(hand[1], z.sides[side].hand)) > 0.01) moved++;
    }
  }
  assert.ok(moved > 10, `the drawn hand is somewhere else than the plain one in ${moved} of 96 cases`);
});

test('the mannequin is untouched', () => {
  const z = pose3({ ...hose, model: 'mannequin' }, {}, 0.3);
  assert.deepEqual(partBone(z, 'hand', null, 'R'), [z.sides.R.wrist, z.sides.R.hand]);
});

test('every arm and hand is a place to attach, on both sides', () => {
  const keys = attachTargets('human').map((t) => t.key);
  for (const k of ['arm/R', 'arm/L', 'forearm/R', 'forearm/L', 'hand/R', 'hand/L']) assert.ok(keys.includes(k), k);
});
