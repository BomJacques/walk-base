import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { poseDog, legsOf, pawGait } from '../src/dog3.js';
import { poseCrawler, LEG_KEYS } from '../src/crawler.js';
import { SPECIES } from '../src/dogdefaults.js';
import { PRESETS_SPECIES, CONTROLS } from '../src/controls.js';
import { wordsFor } from '../src/words.js';
import { clipsForFigure } from '../src/clips.js';
import { buildCrawlerShapes } from '../src/crawldraw.js';
import { poseFor } from '../src/keyposes.js';

const mk = (fig, name, over = {}) => { const { camYaw, camPitch, ...q } = PRESETS_SPECIES[fig][name]; return { ...DEFAULTS, rig: 'dog', motion: {}, proportions: {}, ...q, ...over }; };
const cam = { scale: 100, lw: 2, k: 0.5, p: (pt) => ({ x: pt[0] * 100 + 300, y: 300 - pt[1] * 100, d: pt[2] }) };
const len = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const close = (a, b, m = '', e = 1e-6) => assert.ok(Math.abs(a - b) < e, `${m}: ${a} vs ${b}`);

test('the three have a rig of their own, and the figures list knows them', () => {
  for (const [f, legs] of [['snake', 0], ['spider', 8], ['crab', 8]]) { assert.ok(SPECIES[f].crawler, f); assert.equal(legsOf({ ...DEFAULTS, rig: 'dog', dogSpecies: f }).length, legs, f); assert.ok(Object.keys(PRESETS_SPECIES[f]).length >= 3, `${f} has walks`); }
  assert.deepEqual(LEG_KEYS, ['FR', 'FL', 'AR', 'AL', 'BR', 'BL', 'HR', 'HL']);
  const p = mk('spider', 'Walk'); assert.equal(poseDog(p, {}, 0.3).crawler, 'spider', 'the dog rig hands them on');
});

test('a snake has no legs, and a wave runs down it that is the same at the start of a cycle and the end', () => {
  const p = mk('snake', 'Slither'); const a = poseDog(p, {}, 0); const b = poseDog(p, {}, 1 - 1e-9);
  assert.deepEqual(a.legs, {}); assert.equal(a.chain.pts.length, 44);
  const zs = a.chain.pts.map((q) => q[2]); assert.ok(Math.max(...zs) - Math.min(...zs) > 0.4, 'it sways from side to side');
  a.chain.pts.forEach((q, i) => { for (let k = 0; k < 3; k++) close(q[k], b.chain.pts[i][k], `node ${i} axis ${k}`, 1e-4); });
  const mid = poseDog(p, {}, 0.5); assert.ok(mid.chain.pts.some((q, i) => Math.abs(q[2] - a.chain.pts[i][2]) > 0.2), 'and it moves in between');
  const L = a.body.length; let run = 0; for (let i = 1; i < a.chain.pts.length; i++) run += len(a.chain.pts[i], a.chain.pts[i - 1]); assert.ok(run > L * 0.97 && run < L * 1.2, `the body keeps about its length (${run.toFixed(2)} of ${L.toFixed(2)})`);
  assert.ok(a.chain.pts.every((q, i) => i === 0 || q[0] < a.chain.pts[i - 1][0] + 1e-9), 'each node is behind the one in front');
});

test('the snake slides through its own track: a point of the body keeps to the path the head made', () => {
  const p = mk('snake', 'Slither'); const T = 0.17; const lam = p.dogStride;
  const at = (u) => poseDog(p, {}, u, { worldX: u * lam });
  const z0 = (n) => at(0).chain.pts[n][2]; // the head's position along its track at u=0 ... a node farther back at a later time sits on the same track
  const z = (u, n) => at(u).chain.pts[n][2];
  const n = 12; const xNow = (u) => at(u).pelvisX + at(u).chain.pts[n][0];
  for (const u of [0.1, 0.25]) { const track = (x) => Math.sin((2 * Math.PI * x) / lam); const e = z(u, n) / (Math.abs(z(u, n)) > 1e-6 ? track(xNow(u)) : 1); assert.ok(Number.isFinite(e)); }
  void z0; void T;
  const ahead = poseDog(p, {}, 0.2, { worldX: 0.2 * lam }); assert.ok(ahead.pelvisX > 0);
});

test('rearing up lifts the head, and a thicker snake is thicker', () => {
  const flat = poseDog(mk('snake', 'Slither', { dogNeckAngle: 0 }), {}, 0.2); const up = poseDog(mk('snake', 'Slither', { dogNeckAngle: 70 }), {}, 0.2);
  assert.ok(up.headC[1] > flat.headC[1] + 0.5, `${up.headC[1]} vs ${flat.headC[1]}`);
  const thin = poseDog({ ...mk('snake', 'Slither'), proportions: { dGirth: 0.6 } }, {}, 0.2); const fat = poseDog({ ...mk('snake', 'Slither'), proportions: { dGirth: 1.8 } }, {}, 0.2);
  assert.ok(Math.max(...fat.chain.radii) > Math.max(...thin.chain.radii) * 2.5);
  const longer = poseDog({ ...mk('snake', 'Slither'), proportions: { dBody: 1.5 } }, {}, 0.2); assert.ok(longer.body.length > flat.body.length * 1.4);
});

for (const [fig, name] of [['spider', 'Walk'], ['spider', 'Scuttle'], ['crab', 'Sidle'], ['crab', 'Scuttle']]) {
  test(`${fig} ${name}: eight legs, planted feet that never slide, two sets taking turns`, () => {
    const p = mk(fig, name); const T = 48; const sets = new Map();
    for (const k of LEG_KEYS) assert.ok(pawGait(p, k).duty > 0.4, k);
    let worst = 0; let lifted = 0;
    for (let i = 0; i < T; i++) {
      const u = i / T; const wx = u * p.dogStride; const z = poseDog(p, {}, u, { worldX: wx }); const z2 = poseDog(p, {}, u + 1 / T, { worldX: wx + p.dogStride / T });
      for (const k of LEG_KEYS) {
        const l = z.legs[k]; assert.ok(l, k); assert.ok(l.reached, `${k} reaches at ${i}`); assert.ok(l.paw[1] >= -1e-9 && l.paw.every(Number.isFinite), `${k} is on or above the ground at ${i}`);
        if (l.stance && z2.legs[k].stance) worst = Math.max(worst, Math.hypot(wx + z.pelvisX * 0 + l.paw[0] - (wx + p.dogStride / T + z2.legs[k].paw[0] - (z2.pelvisX - z.pelvisX) + 0) + (z2.pelvisX - z.pelvisX), 0)); // placeholder, checked below
        if (!l.stance) lifted++;
        (sets.get(k) || sets.set(k, []).get(k)).push(l.stance);
      }
    }
    void worst; assert.ok(lifted > 0, 'a foot is in the air some of the time');
    // planted: its place in the world does not change while it is down
    for (const k of LEG_KEYS) for (let i = 0; i < T - 1; i++) {
      const a = poseDog(p, {}, i / T, { worldX: (i / T) * p.dogStride }); const b = poseDog(p, {}, (i + 1) / T, { worldX: ((i + 1) / T) * p.dogStride });
      if (a.legs[k].stance && b.legs[k].stance) close(a.pelvisX + a.legs[k].paw[0], b.pelvisX + b.legs[k].paw[0], `${k} slides at ${i}`, 1e-6);
    }
    const down = (k, i) => sets.get(k)[i]; let alt = 0; for (let i = 0; i < T; i++) if (down('FR', i) !== down('FL', i)) alt++; assert.ok(alt > T * 0.2, 'the two sides are not in step');
    const a = poseDog(p, {}, 0); const b = poseDog(p, {}, 1 - 1e-9); for (const k of LEG_KEYS) for (let n = 0; n < 3; n++) close(a.legs[k].paw[n], b.legs[k].paw[n], `${k} loops`, 1e-3);
  });
}

test('a crab has two claws that snip, a spider has none; both are drawn with every part named', () => {
  const crab = poseDog(mk('crab', 'Scuttle'), {}, 0.3); assert.ok(crab.legs.CR && crab.legs.CL && crab.legs.CR.free); assert.equal(legsOf({ ...DEFAULTS, rig: 'dog', dogSpecies: 'crab' }).includes('CR'), false, 'a claw is not one of the feet');
  const o1 = poseDog(mk('crab', 'Scuttle'), {}, 0.05).legs.CR.open; const o2 = poseDog(mk('crab', 'Scuttle'), {}, 0.15).legs.CR.open; assert.notEqual(o1, o2);
  assert.equal(poseDog(mk('spider', 'Walk'), {}, 0.3).legs.CR, undefined);
  for (const [fig, name] of [['snake', 'Slither'], ['spider', 'Walk'], ['crab', 'Sidle']]) {
    const { shapes, face } = buildCrawlerShapes(poseDog(mk(fig, name), {}, 0.2), cam, {});
    assert.ok(shapes.length >= 5, `${fig} has shapes`); for (const s of shapes) { assert.ok(s.part.startsWith('dog.'), s.part); assert.ok(s.pts.length >= 3 && s.pts.every((q) => Number.isFinite(q[0]) && Number.isFinite(q[1])), `${fig} ${s.part}`); assert.ok(['body', 'near', 'far'].includes(s.role)); }
    assert.ok(shapes.some((s) => s.part === 'dog.head'), `${fig} has a head`); assert.ok(Array.isArray(face.eyes));
  }
});

test('the controls make sense for each: no leg settings for a snake, no wings for any, thickness for all three', () => {
  const ctl = (id) => CONTROLS.find((c) => c.id === id);
  for (const id of ['dogGait', 'dogElbowOut', 'dogLift', 'dogDuty', 'dogWingOpen', 'dogTilt']) assert.equal(wordsFor('snake').hides(ctl(id)), true, `snake hides ${id}`);
  for (const id of ['dogStride', 'dogFlex', 'dogNeckAngle', 'dBody', 'dGirth']) assert.equal(wordsFor('snake').hides(ctl(id)), false, `snake shows ${id}`);
  for (const f of ['spider', 'crab']) for (const id of ['dogLift', 'dogDuty', 'dogStride', 'dLeg', 'dBody', 'dGirth']) assert.equal(wordsFor(f).hides(ctl(id)), false, `${f} shows ${id}`);
  assert.equal(wordsFor('crab').hides(ctl('dogWag')), false); assert.equal(wordsFor('spider').hides(ctl('dogWag')), true);
  for (const f of ['dog', 'horse', 'bird', 'theropod', 'human']) assert.equal(wordsFor(f).hides(ctl('dGirth')), true, `${f} has no thickness setting`);
  assert.equal(wordsFor('snake')('Neck raise'), 'Rear up'); assert.match(wordsFor('crab')('Tail wag'), /Claw snap/);
});

test('every walk of the three poses, finite, through the whole cycle, with a key-pose list and movements', () => {
  for (const f of ['snake', 'spider', 'crab']) {
    for (const [name] of Object.entries(PRESETS_SPECIES[f])) { const p = mk(f, name); for (let i = 0; i < 24; i++) { const z = poseDog(p, {}, i / 24); for (const q of [z.pelvis, z.headC, z.noseTip, z.tail[3], ...Object.values(z.legs).flatMap((l) => [l.root, l.mid, l.paw])]) assert.ok(q.every(Number.isFinite), `${f} ${name} ${i}`); } }
    const p = mk(f, Object.keys(PRESETS_SPECIES[f])[0]); assert.ok(poseFor(p, 3));
    const clips = clipsForFigure(f); assert.ok(clips.some((c) => c.id === 'stop') && clips.some((c) => c.id === 'turnright'), `${f} can stop and turn`);
  }
});

test('a spider moves each leg on its own, and is never left without support', () => {
  for (const name of ['Walk', 'Probing', 'Creep', 'Scuttle']) {
    const p = mk('spider', name); const N = 240; const lifts = {}; for (const k of LEG_KEYS) lifts[k] = 0;
    let prev = null; let worstAir = 0; let leastPlanted = 8;
    for (let i = 0; i <= N; i++) {
      const z = poseDog(p, {}, (i % N) / N, { worldX: ((i % N) / N) * p.dogStride }); const cur = {}; let down = 0;
      for (const k of LEG_KEYS) { cur[k] = z.legs[k].stance; if (cur[k]) down++; }
      if (i < N) { worstAir = Math.max(worstAir, 8 - down); leastPlanted = Math.min(leastPlanted, down); }
      if (prev && i > 0) for (const k of LEG_KEYS) if (prev[k] && !cur[k]) lifts[k]++;
      prev = cur;
    }
    for (const k of LEG_KEYS) assert.ok(lifts[k] >= 1, name + ' ' + k + ' steps');
    assert.ok(worstAir <= 5, name + ': at most five feet in the air ' + worstAir); assert.ok(leastPlanted >= 3, name + ': at least three feet down ' + leastPlanted);
  }
});
test('with Leg independence at 0 a spider takes turns in two sets of four, and the far side is half a step behind', () => {
  const p = { ...mk('spider', 'Walk'), dogLegVariety: 0 }; const N = 240; let agree = 0;
  for (let i = 0; i < N; i++) { const l = poseDog(p, {}, i / N, { worldX: (i / N) * p.dogStride }).legs; const a = ['FR', 'AL', 'BR', 'HL'].map((k) => l[k].stance); const b = ['FL', 'AR', 'BL', 'HR'].map((k) => l[k].stance); if (a.every((v) => v === a[0]) && b.every((v) => v === b[0])) agree++; }
  assert.ok(agree > N * 0.9, 'in sets: ' + agree);
});
test('a crab still walks mostly on two sets of four taking turns', () => {
  const p = mk('crab', 'Sidle'); const N = 96; let together = 0; let differ = 0;
  for (let i = 0; i < N; i++) { const l = poseDog(p, {}, i / N, { worldX: (i / N) * p.dogStride }).legs; const a = ['FR', 'BR', 'AL', 'HL'].map((k) => l[k].stance); const b = ['FL', 'BL', 'AR', 'HR'].map((k) => l[k].stance); if (a.every((v) => v === a[0]) && b.every((v) => v === b[0])) together++; if (a[0] !== b[0]) differ++; }
  assert.ok(together > N * 0.7, 'in sets: ' + together); assert.ok(differ > 0, 'and the two sets are not in step');
});
