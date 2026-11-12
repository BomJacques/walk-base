import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { poseDog } from '../src/dog3.js';
import { lookOf, SPECIES } from '../src/dogdefaults.js';
import { CONTROLS, presetsForFigure } from '../src/controls.js';
import { wordsFor } from '../src/words.js';

const mk = (fig, pr = {}) => { const { camYaw, camPitch, ...q } = presetsForFigure(fig).Walk; return { ...DEFAULTS, rig: 'dog', motion: {}, ...q, dogSpecies: q.dogSpecies ?? fig, proportions: pr }; };
const ctl = (id) => CONTROLS.find((c) => c.id === id);
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

test('the new body controls exist, with ranges around 1', () => {
  for (const id of ['dEarW', 'dLegF', 'dLegH', 'dSnout', 'dPaw', 'dTorso', 'dLimb', 'dNeckW', 'dTailW']) { const c = ctl(id); assert.ok(c, id); assert.ok(c.min < 1 && c.max > 1, `${id} range`); assert.equal(c.group, 'Dog proportions'); }
});
test('longer front legs raise the shoulders, longer hind legs raise the hips, and every paw is still reached and planted', () => {
  const base = poseDog(mk('dog'), {}, 0.2); const front = poseDog(mk('dog', { dLegF: 1.3 }), {}, 0.2); const hind = poseDog(mk('dog', { dLegH: 1.3 }), {}, 0.2);
  assert.ok(front.j3[1] > base.j3[1] + 0.04, `shoulders ${front.j3[1]} against ${base.j3[1]}`); assert.ok(hind.pelvis[1] > base.pelvis[1] + 0.04, `hips ${hind.pelvis[1]} against ${base.pelvis[1]}`);
  for (const pr of [{ dLegF: 1.3 }, { dLegH: 0.8 }, { dLegF: 0.8, dLegH: 1.3 }]) {
    const p = mk('dog', pr); const N = 32;
    for (let i = 0; i < N; i++) { const z = poseDog(p, {}, i / N, { worldX: (i / N) * p.dogStride }); for (const k of ['FR', 'FL', 'HR', 'HL']) { assert.ok(z.legs[k].reached, `${JSON.stringify(pr)} ${k} reaches at ${i}`); assert.ok(z.legs[k].paw.every(Number.isFinite)); } }
    for (const k of ['FR', 'HL']) for (let i = 0; i < N - 1; i++) { const a = poseDog(p, {}, i / N, { worldX: (i / N) * p.dogStride }); const b = poseDog(p, {}, (i + 1) / N, { worldX: ((i + 1) / N) * p.dogStride }); if (a.legs[k].stance && b.legs[k].stance) assert.ok(Math.abs(a.pelvisX + a.legs[k].paw[0] - (b.pelvisX + b.legs[k].paw[0])) < 1e-4, `${JSON.stringify(pr)} ${k} slides at ${i}`); }
  }
});
test('a longer snout puts the nose and the jaw further out, a bigger paw is a longer paw', () => {
  const base = poseDog(mk('dog'), {}, 0.2); const long = poseDog(mk('dog', { dSnout: 2 }), {}, 0.2); const short = poseDog(mk('dog', { dSnout: 0.5 }), {}, 0.2);
  assert.ok(d3(long.noseTip, long.neckTop) > d3(base.noseTip, base.neckTop) * 1.2); assert.ok(d3(short.noseTip, short.neckTop) < d3(base.noseTip, base.neckTop) * 0.9);
  assert.ok(d3(long.jawEnd, long.neckTop) > d3(base.jawEnd, base.neckTop));
  const big = poseDog(mk('dog', { dPaw: 2 }), {}, 0.2); const pawLen = (z) => d3(z.legs.FR.paw, z.legs.FR.toe); assert.ok(pawLen(big) > pawLen(base) * 1.8 && pawLen(big) < pawLen(base) * 2.2, `${pawLen(big)} against ${pawLen(base)}`);
  assert.equal(base.noseTip.every(Number.isFinite), true);
});
test('the thickness controls multiply how thick each part is drawn, and leave the rest alone', () => {
  const k0 = lookOf(mk('dog')); const k1 = lookOf(mk('dog', { dTorso: 1.5, dLimb: 0.5, dNeckW: 2, dTailW: 0.4 }));
  assert.equal(k1.body, k0.body * 1.5); assert.equal(k1.leg, k0.leg * 0.5); assert.equal(k1.neck, k0.neck * 2); assert.equal(k1.tail, k0.tail * 0.4); assert.equal(k1.wing, k0.wing);
  assert.equal(lookOf({ ...mk('sauropod') }).body, SPECIES.sauropod.look.body);
});
test('the new controls are for the animals on the dog rig, worded for each, and left out of the snake, spider and crab', () => {
  const ids = ['dLegF', 'dLegH', 'dSnout', 'dPaw', 'dTorso', 'dLimb', 'dNeckW', 'dTailW'];
  for (const f of ['snake', 'spider', 'crab']) for (const id of ids) assert.equal(wordsFor(f).hides(ctl(id)), true, `${f} hides ${id}`);
  for (const f of ['dog', 'horse', 'theropod', 'sauropod', 'lizard', 'bird', 'plesiosaur', 'ceratopsian', 'pterodactyl']) for (const id of ids) assert.equal(wordsFor(f).hides(ctl(id)), false, `${f} shows ${id}`);
  assert.equal(wordsFor('bird')('Front leg length'), 'Wing length'); assert.equal(wordsFor('theropod')('Front leg length'), 'Arm length'); assert.equal(wordsFor('plesiosaur')('Hind leg length'), 'Rear flipper length'); assert.equal(wordsFor('theropod')('Paw size'), 'Foot size');
  for (const f of ['sauropod', 'ceratopsian', 'theropod', 'bird', 'lizard']) assert.equal(wordsFor(f).hides(ctl('dEarW')), true, `${f} has no ear width`); assert.equal(wordsFor('dog').hides(ctl('dEarW')), false);
});
