import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, cycleFrames } from '../src/rig.js';
import { poseFor } from '../src/keyposes.js';
import { CONTROLS, PRESETS_SPECIES, presetsForFigure } from '../src/controls.js';
import { SPECIES } from '../src/dogdefaults.js';
import { legsOf } from '../src/dog3.js';

const mk = (pr, extra = {}) => ({ ...DEFAULTS, rig: 'dog', motion: {}, ...pr, ...extra });
const presets = Object.entries(PRESETS_SPECIES).flatMap(([sp, set]) => Object.entries(set).map(([name, pr]) => [`${sp} ${name}`, pr]));

test('every species has complete bones and the presets name their species', () => {
  for (const [id, s] of Object.entries(SPECIES)) {
    assert.ok([2, 4].includes(s.legs), id);
    assert.ok(['leg', 'arm', 'wing'].includes(s.front), id);
    for (const k of Object.keys(s.bones)) assert.ok(Array.isArray(s.bones[k]) ? s.bones[k].every((v) => v > 0) : s.bones[k] >= 0, `${id}.${k}`);
    assert.ok(s.view.zoom > 0 && s.look.body > 0);
  }
  for (const [sp, set] of Object.entries(PRESETS_SPECIES)) for (const [n, pr] of Object.entries(set)) assert.equal(pr.dogSpecies, sp, `${sp} ${n}`);
  assert.equal(presetsForFigure('bird'), PRESETS_SPECIES.bird);
});

test('every preset value is inside its control range', () => {
  const by = Object.fromEntries(CONTROLS.filter((c) => c.scope === 'p').map((c) => [c.id, c]));
  for (const [name, pr] of presets) for (const [k, v] of Object.entries(pr)) {
    if (k === 'dogSpecies') continue;
    const c = by[k]; assert.ok(c, `${name}: ${k} has no control`);
    if (c.type === 'number') assert.ok(v >= c.min && v <= c.max, `${name}: ${k}=${v} outside ${c.min}..${c.max}`);
    if (c.type === 'enum') assert.ok(c.options.includes(v), `${name}: ${k}=${v}`);
  }
});

test('every preset gives finite poses with the feet on the ground and the limbs reaching', () => {
  for (const [name, pr] of presets) {
    if (/Flapping/.test(name)) continue;
    const p = mk(pr); const T = cycleFrames(p).frames.length;
    for (let f = 0; f < T; f++) {
      const z = poseFor(p, f);
      for (const q of [z.pelvis, z.headC, z.noseTip, z.tail[3], ...Object.values(z.legs).flatMap((l) => [l.root, l.mid, l.wrist, l.paw, l.toe])]) assert.ok(q.every(Number.isFinite), `${name} ${f}`);
      for (const k of legsOf(p)) { const l = z.legs[k]; assert.ok(l.reached, `${name} ${k} reaches at ${f}`); if (l.stance) assert.ok(l.paw[1] < 0.09, `${name} ${k} planted at ${f}: ${l.paw[1]}`); }
      assert.ok(Object.values(z.legs).every((l) => l.toe[1] > -0.02), `${name} nothing below ground at ${f}`);
    }
  }
});

test('two-legged figures plant two feet and leave the arms free', () => {
  for (const sp of ['theropod', 'bird']) {
    const p = mk(PRESETS_SPECIES[sp].Walk); const T = cycleFrames(p).frames.length; let both = 0;
    assert.deepEqual(legsOf(p), ['HR', 'HL']);
    for (let f = 0; f < T; f++) { const z = poseFor(p, f); assert.ok(!z.legs.FR.stance && !z.legs.FL.stance && z.legs.FR.free, sp); if (z.legs.HR.stance && z.legs.HL.stance) both++; assert.ok(z.legs.HR.stance || z.legs.HL.stance, `${sp} always has a foot down`); }
    assert.ok(both > 0, `${sp} has a double support`);
  }
  assert.deepEqual(legsOf(mk(PRESETS_SPECIES.sauropod.Walk)), ['HR', 'HL', 'FR', 'FL']);
});

test('a running theropod has a flight phase; a walking one does not', () => {
  const air = (pr) => { const p = mk(pr); const T = cycleFrames(p).frames.length; let n = 0; for (let f = 0; f < T; f++) { const z = poseFor(p, f); if (!z.legs.HR.stance && !z.legs.HL.stance) n++; } return n; };
  assert.ok(air(PRESETS_SPECIES.theropod.Run) > 0); assert.equal(air(PRESETS_SPECIES.theropod.Walk), 0);
});

test('a bird holds its head still in space while the body moves under it', () => {
  const run = (hold) => { const p = mk(PRESETS_SPECIES.bird.Walk, { dogHeadHold: hold }); const T = cycleFrames(p).frames.length; const hx = []; for (let f = 0; f <= T; f++) { const z = poseFor(p, f % T); hx.push(z.headC[0] + z.pelvisX + (f === T ? p.dogStride : 0)); } return hx; };
  const still = (hx) => hx.slice(1).filter((x, i) => Math.abs(x - hx[i]) < 0.02).length;
  assert.ok(still(run(1)) > still(run(0)) + 5, `${still(run(1))} vs ${still(run(0))}`);
});

test('wings fold, spread and beat', () => {
  const wrist = (o) => poseFor(mk(PRESETS_SPECIES.bird.Walk, o), 4).legs.FR.wrist;
  assert.ok(Math.abs(wrist({ dogWingOpen: 1 })[2]) > Math.abs(wrist({ dogWingOpen: 0 })[2]) + 0.2, 'spread wing is out to the side');
  const up = (f) => poseFor(mk(PRESETS_SPECIES.bird.Flapping), f).legs.FR.wrist[1]; const ys = Array.from({ length: 12 }, (_, f) => up(f));
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.2, 'the wing beats');
});

test('the dog is unchanged', () => {
  const p = mk({}); const z = poseFor(p, 0);
  assert.equal(Object.values(z.legs).filter((l) => l.free).length, 0); assert.equal(legsOf(p).length, 4);
});
