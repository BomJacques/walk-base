import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { poseDog } from '../src/dog3.js';
import { SPECIES } from '../src/dogdefaults.js';
import { PRESETS_SPECIES, presetsForFigure, PRESETS_ROBOT, PRESETS_ALIEN, propsFor } from '../src/controls.js';
import { clipsForFigure } from '../src/clips.js';

const mk = (fig, name) => { const { camYaw, camPitch, ...p } = presetsForFigure(fig)[name || Object.keys(presetsForFigure(fig))[0]]; return { ...DEFAULTS, rig: 'dog', motion: {}, ...p }; };

test('the new animals are all there, each with walks of its own', () => {
  for (const f of ['ant', 'beetle', 'monkey', 'stegosaurus', 'crocodile', 'dragon', 'centaur']) { assert.ok(SPECIES[f], f); assert.ok(Object.keys(PRESETS_SPECIES[f]).length >= 3, f); }
  assert.equal(Object.keys(PRESETS_ROBOT).length >= 3 && Object.keys(PRESETS_ALIEN).length >= 3, true);
  assert.ok(propsFor('alien').head > 1.3 && propsFor('robot').limbGirth > 1 && Object.keys(propsFor('human')).length === 0);
});

test('an ant or a beetle walks on two sets of three, the legs a little apart in their timing', () => {
  for (const f of ['ant', 'beetle']) {
    const p = { ...mk(f), dogLegVariety: 0 }; let together = 0; const N = 240;
    for (let i = 0; i < N; i++) { const l = poseDog(p, {}, i / N, { worldX: (i / N) * p.dogStride }).legs; const a = ['FR', 'AL', 'HR'].map((k) => l[k].stance); const b = ['FL', 'AR', 'HL'].map((k) => l[k].stance); if (a.every((v) => v === a[0]) && b.every((v) => v === b[0])) together++; assert.equal(Object.keys(l).length, 6); }
    assert.ok(together > N * 0.9, `${f}: ${together}`);
  }
});

test('a dragon has wings: folded on the walk, spread in flight, and its front feet tuck up when it flies', () => {
  const walk = poseDog(mk('dragon', 'Prowl'), {}, 0.2).legs; const fly = poseDog(mk('dragon', 'Flying'), {}, 0.2).legs;
  const span = (l) => Math.hypot(l.WR.wrist[2] - l.WL.wrist[2], l.WR.wrist[1] - l.WL.wrist[1]);
  assert.ok(span(fly) > span(walk) + 1, `${span(walk)} -> ${span(fly)}`);
  assert.ok(fly.FR.paw[1] > 0.6 && walk.FR.paw[1] < 0.2);
  for (const k of ['WR', 'WL']) assert.equal(fly[k].tips.length, 3);
});

test('a centaur has a horse\'s legs and a person\'s arms', () => {
  const l = poseDog(mk('centaur'), {}, 0.3).legs; assert.ok(l.AR && l.AL && l.HR && l.FR);
  assert.ok(l.AR.root[1] > 1, 'the arms start high on the trunk');
});

test('every animal with a head can open its mouth in a movement', () => {
  for (const f of ['theropod', 'sauropod', 'ceratopsian', 'stegosaurus', 'pterodactyl', 'plesiosaur', 'bird', 'horse', 'lizard', 'crocodile', 'snake', 'monkey', 'dragon', 'centaur']) {
    const jawClip = clipsForFigure(f).find((c) => Object.keys(c.build(mk(f), 60, 1)).some((k) => /jaw\.open/.test(k)));
    if (f === 'centaur') continue; // it has a person's head: it speaks with the human mouth shapes, not a jaw
    assert.ok(jawClip, `${f} has a jaw movement`);
  }
});
