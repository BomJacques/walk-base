import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { integrate, laneValue, parseTarget, paramsAt } from '../src/automation.js';
import { clipsFor, applyClip, CLIP_GROUPS, groupOfClip } from '../src/clips.js';
import { poseFor } from '../src/keyposes.js';
import { CHANNEL_BY_ID } from '../src/motion.js';
import { clipsForFigure } from '../src/clips.js';
import { PRESETS_SPECIES } from '../src/controls.js';

const bases = { human: { ...DEFAULTS, rig: 'human' }, dog: { ...DEFAULTS, rig: 'dog' } };
const get = (rig, id) => clipsFor(rig).find((c) => c.id === id);
const perf = (base, lanes, T) => { const s = integrate(base, lanes, T, Math.round(base.cycleFrames), null); return { ...base, motion: {}, perf: { T, u: s.u, x: s.x, plants: [], lanes, live: null } }; };
const standing = (rig) => applyClip({}, get(rig, 'stop'), bases[rig], 0, 24);

test('there are many movements, each with a group, a help text and valid targets', () => {
  for (const rig of ['human', 'dog']) {
    const list = clipsFor(rig); assert.ok(list.length >= 18, `${rig} has ${list.length}`);
    assert.equal(new Set(list.map((c) => c.id)).size, list.length, 'unique ids');
    for (const c of list) {
      assert.ok(c.label && c.help && c.frames > 8, c.id); assert.notEqual(groupOfClip(c.id), 'Other', `${rig} ${c.id} is in a group`);
      for (const [target, pts] of Object.entries(c.build(bases[rig], c.frames))) {
        const k = parseTarget(target); assert.ok(k, target); if (k.kind === 'channel') assert.ok(CHANNEL_BY_ID[k.id], `${c.id}: ${target}`);
        assert.ok(pts.every((q, i) => i === 0 || q.t > pts[i - 1].t), `${c.id}: ${target} strictly in order`);
      }
    }
  }
  for (const id of ['sit', 'standup', 'jump', 'wave', 'kneel', 'limp', 'nolimp', 'scratch']) assert.ok(get('human', id), id);
  for (const id of ['sit', 'down', 'beg', 'standup', 'tailchase', 'sniff', 'bark', 'jump', 'scratch', 'rollover']) assert.ok(get('dog', id), id);
  assert.ok(CLIP_GROUPS.length >= 4);
});

test('every movement gives finite poses from standing and ends where it says (back to neutral unless it stays)', () => {
  for (const rig of ['human', 'dog']) for (const c of clipsFor(rig)) {
    if (c.id === 'stop') continue;
    const base = bases[rig]; const lanes = applyClip(standing(rig), c, base, 30, c.frames, 1); const T = 30 + c.frames + 12;
    const p = perf(base, lanes, T);
    for (let f = 0; f < T; f++) { const z = poseFor(p, f); const pts = rig === 'human' ? [z.pelvis, z.headC, z.sides.R.wrist, z.sides.L.ankle] : [z.pelvis, z.headC, z.noseTip, z.tail[3], ...Object.values(z.legs).map((l) => l.paw)]; assert.ok(pts.every((q) => q.every(Number.isFinite)), `${rig} ${c.id} ${f}`); }
    const stays = /stays|keeps|walks on|walks as|walks normally|Gait tab|sits|lies/.test(c.ends);
    if (!stays) for (const [target, lane] of Object.entries(lanes)) {
      const k = parseTarget(target); if (k?.kind !== 'channel' || k.what !== 'offset') continue;
      assert.ok(Math.abs(laneValue(lane, T, 0)) < 1e-9, `${rig} ${c.id}: ${target} is back to 0`);
    }
  }
});

test('movements chain: each begins from the value the one before left, with no jump', () => {
  for (const rig of ['human', 'dog']) {
    const sit = get(rig, 'sit'); const base = bases[rig];
    const a = applyClip(standing(rig), sit, base, 30, sit.frames); const end = 30 + sit.frames;
    const next = get(rig, rig === 'human' ? 'wave' : 'lookaround'); const b = applyClip(a, next, base, end + 4, next.frames);
    for (const [target, lane] of Object.entries(b)) { if (!a[target]) continue; const before = laneValue(a[target], end + 3, 0); const after = laneValue(lane, end + 4, 0); assert.ok(Math.abs(before - after) < 1e-9, `${rig}: ${target} continues from ${before} to ${after}`); }
  }
});

test('sit then stand up returns every channel to neutral, and a sit is held until then', () => {
  for (const rig of ['human', 'dog']) {
    const base = bases[rig]; const sit = get(rig, 'sit'); const up = get(rig, 'standup');
    let lanes = applyClip(standing(rig), sit, base, 30, sit.frames); const seatedAt = 30 + sit.frames + 20;
    const q = perf(base, lanes, seatedAt + 80); const hip = (f) => poseFor(q, f).pelvis[1];
    assert.ok(hip(seatedAt) < hip(28) - 0.3, `${rig} is lower when sitting (${hip(seatedAt).toFixed(2)} vs ${hip(28).toFixed(2)})`);
    assert.ok(Math.abs(hip(seatedAt) - hip(seatedAt + 60)) < 1e-6, 'it stays seated');
    lanes = applyClip(lanes, up, base, seatedAt, up.frames); const end = seatedAt + up.frames + 20;
    const r = perf(base, lanes, end + 5);
    assert.ok(Math.abs(hip(28) - poseFor(r, end).pelvis[1]) < 1e-6, `${rig}: back to standing height`);
    for (const [target, lane] of Object.entries(lanes)) { const k = parseTarget(target); if (k?.kind !== 'channel') continue; const neutral = k.what === 'amount' ? 1 : 0; assert.ok(Math.abs(laneValue(lane, end, neutral) - neutral) < 1e-9, `${rig}: ${target} neutral after standing`); }
  }
});

test('stop, sit, stand up, start walking: the walk comes back as the Gait tab says', () => {
  for (const rig of ['human', 'dog']) {
    const base = bases[rig]; let lanes = standing(rig);
    const seq = [['sit', 30], ['standup', 110], ['begin', 175]]; for (const [id, at] of seq) lanes = applyClip(lanes, get(rig, id), base, at, get(rig, id).frames);
    const t = 175 + 48 + 10; const pr = paramsAt(base, lanes, t); const name = rig === 'human' ? 'stepLength' : 'dogStride';
    assert.ok(Math.abs(pr[name] - base[name]) < 1e-9, `${name} is back to ${base[name]} (is ${pr[name]})`);
    assert.ok(Math.abs(laneValue(lanes.cadence, t, 1) - 1) < 1e-9, 'cadence is 1');
  }
});

test('Break into a run changes the pace and Slow to a walk undoes it', () => {
  const base = bases.human; const run = get('human', 'run'); const slow = get('human', 'slow');
  let lanes = applyClip({}, run, base, 10, run.frames); lanes = applyClip(lanes, slow, base, 60, slow.frames);
  assert.ok(paramsAt(base, lanes, 55).stepLength > base.stepLength * 1.3 && paramsAt(base, lanes, 55).duty < base.duty);
  assert.ok(Math.abs(paramsAt(base, lanes, 110).stepLength - base.stepLength) < 1e-9 && Math.abs(laneValue(lanes.cadence, 110, 1) - 1) < 1e-9);
});

test('the body goes where the movement says: a jump leaves the ground, a dog sits and lies lower', () => {
  const c = get('human', 'jump'); const p = perf(bases.human, applyClip(standing('human'), c, bases.human, 30, c.frames), 100);
  const frames = Array.from({ length: 100 }, (_, f) => poseFor(p, f));
  const top = Math.max(...frames.map((z) => Math.min(z.sides.R.ankle[1], z.sides.L.ankle[1])));
  assert.ok(top > frames[10].sides.R.ankle[1] + 0.2, 'both feet leave the ground in the jump');
  const dogLow = (id) => { const d = get('dog', id); const q = perf(bases.dog, applyClip(standing('dog'), d, bases.dog, 30, d.frames), 30 + d.frames + 20); return poseFor(q, 30 + d.frames + 15).pelvis[1]; };
  const stand = poseFor(perf(bases.dog, standing('dog'), 40), 35).pelvis[1];
  assert.ok(dogLow('sit') < stand - 0.3 && dogLow('down') < dogLow('sit') - 0.05, 'sit lower than standing, lying lower than sitting');
});

test('each animal has movements that suit it, all valid, and they ease and chain like the others', () => {
  const want = { bird: ['takeoff', 'land', 'peck'], theropod: ['roar', 'lunge'], sauropod: ['rearup', 'neckswing'], ceratopsian: ['headdown', 'toss'] };
  for (const [fig, ids] of Object.entries(want)) {
    const list = clipsForFigure(fig); const have = list.map((c) => c.id);
    for (const id of ids) assert.ok(have.includes(id), `${fig} has ${id}`);
    assert.ok(have.includes('stop') && have.includes('begin'), `${fig} can stop and start`);
    assert.ok(!have.includes('beg') && !have.includes('pickup') && !have.includes('trip'), `${fig} has none of the dog-only movements`);
    const base = { ...DEFAULTS, rig: 'dog', motion: {}, ...(({ camYaw, ...p }) => p)(PRESETS_SPECIES[fig].Walk) };
    const standStill = applyClip({}, list.find((c) => c.id === 'stop'), base, 0, 24);
    for (const c of list) {
      if (c.id === 'stop') continue;
      for (const [target, pts] of Object.entries(c.build(base, c.frames))) { const k = parseTarget(target); assert.ok(k, target); if (k.kind === 'param') assert.ok(k.id in DEFAULTS, `${fig} ${c.id}: ${target}`); if (k.kind === 'channel') assert.ok(CHANNEL_BY_ID[k.id], `${fig} ${c.id}: ${target}`); assert.ok(pts.every((q, i) => i === 0 || q.t > pts[i - 1].t), `${fig} ${c.id}: ${target} in order`); }
      const lanes = applyClip(standStill, c, base, 30, c.frames); const T = 30 + c.frames + 10; const p = perf(base, lanes, T);
      for (let f = 0; f < T; f++) { const z = poseFor(p, f); assert.ok([z.pelvis, z.headC, z.noseTip, z.tail[3], ...Object.values(z.legs).map((l) => l.paw)].every((q) => q.every(Number.isFinite)), `${fig} ${c.id} ${f}`); }
    }
  }
});

test('a bird takes off and lands: it leaves the ground and comes back to the walk as the Gait tab says', () => {
  const base = { ...DEFAULTS, rig: 'dog', motion: {}, ...(({ camYaw, ...p }) => p)(PRESETS_SPECIES.bird.Walk) };
  const list = clipsForFigure('bird'); const take = list.find((c) => c.id === 'takeoff'); const land = list.find((c) => c.id === 'land');
  let lanes = applyClip({}, take, base, 10, take.frames); lanes = applyClip(lanes, land, base, 10 + take.frames + 30, land.frames);
  const flyAt = 10 + take.frames + 10; const end = 10 + take.frames + 30 + land.frames + 4;
  assert.equal(paramsAt(base, lanes, flyAt).dogFlight, 1); assert.equal(paramsAt(base, lanes, flyAt).dogWingOpen, 1);
  const p = perf(base, lanes, end + 4);
  assert.ok(poseFor(p, flyAt).pelvis[1] > poseFor(p, 2).pelvis[1] + 0.6, 'the body is well above the ground in flight');
  const back = paramsAt(base, lanes, end); for (const k of ['dogFlight', 'dogWingOpen', 'dogStride', 'dogTilt', 'dogFlap']) assert.ok(Math.abs(back[k] - base[k]) < 1e-9, `${k} is back to ${base[k]} (is ${back[k]})`);
});

test('a limp slows and tilts the walk and Walk normally undoes it; a human kneels and stands up again', () => {
  const base = bases.human; const limp = get('human', 'limp'); const nol = get('human', 'nolimp');
  let lanes = applyClip({}, limp, base, 5, limp.frames); lanes = applyClip(lanes, nol, base, 70, nol.frames);
  assert.ok(laneValue(lanes.cadence, 60, 1) < 0.9 && laneValue(lanes['c:pelvis.roll:amount'], 60, 1) > 2);
  for (const t of ['cadence', 'c:pelvis.roll:amount', 'c:arm.pitch.R:amount', 'c:pelvis.y:offset']) assert.ok(Math.abs(laneValue(lanes[t], 140, t.endsWith('amount') || t === 'cadence' ? 1 : 0) - (t.endsWith('amount') || t === 'cadence' ? 1 : 0)) < 1e-9, t);
  const kn = get('human', 'kneel'); const up = get('human', 'standup'); let l2 = applyClip(standing('human'), kn, base, 30, kn.frames); const at = 30 + kn.frames + 10;
  const q = perf(base, l2, at + 5); assert.ok(poseFor(q, at).pelvis[1] < poseFor(q, 28).pelvis[1] - 0.3, 'lower when kneeling');
  l2 = applyClip(l2, up, base, at, up.frames); const e2 = perf(base, l2, at + up.frames + 20);
  assert.ok(Math.abs(poseFor(e2, at + up.frames + 15).pelvis[1] - poseFor(e2, 28).pelvis[1]) < 1e-6, 'standing again');
  for (const t of ['c:foot.x.R:offset', 'c:foot.y.R:offset', 'c:foot.x.L:offset']) assert.ok(Math.abs(laneValue(l2[t], at + up.frames + 15, 0)) < 1e-9, t);
});
