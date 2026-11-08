import test from 'node:test';
import assert from 'node:assert/strict';
import { CLIPS, clipsFor, applyClip } from '../src/clips.js';
import { laneValue, integrate, paramsAt, motionAt, parseTarget } from '../src/automation.js';
import { pose3, len, sub } from '../src/rig3.js';
import { DEFAULTS, foot } from '../src/rig.js';
import { CHANNEL_BY_ID } from '../src/motion.js';

const base = { ...DEFAULTS };
const clip = (id) => clipsFor('human').find((c) => c.id === id);
const contact = (p) => foot(0, p, p.stepLength * p.duty);
const sim = (lanes, T) => integrate(base, lanes, T, base.cycleFrames, contact);
const at = (lanes, sim_, t) => pose3(paramsAt(base, lanes, t), motionAt({}, lanes, t), sim_.u[t], { worldX: sim_.x[t] });
const dist = (a, b) => len(sub(a, b));

test('every clip targets real parameters and channels, with points in order', () => {
  for (const c of clipsFor('human')) {
    const lanes = c.build(base, c.frames);
    assert.ok(Object.keys(lanes).length >= 2, c.id);
    for (const [target, pts] of Object.entries(lanes)) {
      const k = parseTarget(target);
      assert.ok(k, `${c.id}: ${target}`);
      if (k.kind === 'param') assert.ok(k.id in DEFAULTS, `${c.id}: ${target} is a gait parameter`);
      if (k.kind === 'channel') assert.ok(CHANNEL_BY_ID[k.id], `${c.id}: ${target} is a channel`);
      assert.ok(pts.every((q, i) => i === 0 || q.t >= pts[i - 1].t) && pts.every((q) => Number.isFinite(q.v)), `${c.id}: ${target} ordered and finite`);
      assert.ok(pts[pts.length - 1].t <= c.frames, `${c.id}: ${target} fits the clip`);
    }
  }
});

test('walk to stop: the figure slows, the feet come together, and it stays stopped', () => {
  const lanes = applyClip({}, clip('stop'), base, 24, 48);
  const T = 144; const s = sim(lanes, T);
  assert.ok(s.x[24] > 0.5, 'it walks first');
  assert.ok(Math.abs(s.x[T] - s.x[100]) < 1e-9, 'it stops moving');
  const early = at(lanes, s, 10); const done = at(lanes, s, 120);
  const gap = (z) => Math.abs(z.sides.R.ankle[0] - z.sides.L.ankle[0]);
  assert.ok(gap(early) > 0.2, `feet apart while walking: ${gap(early)}`);
  assert.ok(gap(done) < 0.02, `feet together at the end: ${gap(done)}`);
  assert.ok(Math.abs(done.sides.R.ankle[1] - done.sides.L.ankle[1]) < 0.02, 'both on the ground');
  assert.ok(Math.abs(done.sides.R.wrist[0] - done.sides.R.shoulder[0]) < 0.12, 'arms hang still');
  const stepsBefore = s.plants.filter((q) => q.t <= 24).length; const stepsAfter = s.plants.filter((q) => q.t > 80).length;
  assert.ok(stepsBefore >= 2 && stepsAfter <= 1, `steps stop coming: ${stepsBefore} then ${stepsAfter}`);
  assert.equal(laneValue(lanes['cadence'], 0, 1), 1, 'nothing changes before the clip');
});

test('reach for: the right arm comes forward and up, then returns', () => {
  const lanes = applyClip({}, clip('reach'), { ...base, armSwing: 0 }, 10, 48);
  const T = 80; const s = sim(lanes, T);
  const rest = at(lanes, s, 5); const reach = at(lanes, s, 10 + 22); const back = at(lanes, s, 70);
  assert.ok(reach.sides.R.wrist[0] - reach.sides.R.shoulder[0] > 0.45, `wrist well forward of the shoulder: ${reach.sides.R.wrist[0] - reach.sides.R.shoulder[0]}`);
  assert.ok(reach.sides.R.wrist[1] > reach.sides.R.shoulder[1] - 0.45 && reach.sides.R.wrist[1] > rest.sides.R.wrist[1] + 0.25, 'and raised');
  assert.ok(dist(back.sides.R.wrist, rest.sides.R.wrist) < 0.35, 'it comes back');
  assert.ok(reach.j3[0] > rest.j3[0] + 0.02, 'the chest leans in');
});

test('pick up: crouch, hand to the ground, then stand with the hand raised; the legs always reach', () => {
  const standing = { ...base, stepLength: 0.0001, bob: 0, armSwing: 0, sway: 0, footLift: 0, pelvisYaw: 0, shoulderCounter: 0, torsoSway: 0, elbowBase: 0, elbowSwing: 0, heelStrike: 0, toeOff: 0, swingToe: 0 };
  const lanes = applyClip({}, clip('pickup'), standing, 0, 72);
  const s = integrate(standing, lanes, 90, base.cycleFrames);
  const pz = (t) => pose3(paramsAt(standing, lanes, t), motionAt({}, lanes, t), s.u[t], { worldX: s.x[t] });
  const top = pz(0); const low = pz(32); const carry = pz(64);
  assert.ok(low.pelvis[1] < top.pelvis[1] - 0.2, `hips drop: ${top.pelvis[1] - low.pelvis[1]}`);
  assert.ok(low.sides.R.wrist[1] < 0.4, `hand near the ground: ${low.sides.R.wrist[1]}`);
  assert.ok(low.headC[1] < top.headC[1] - 0.45, 'head comes down');
  assert.ok(carry.sides.R.wrist[1] > low.sides.R.wrist[1] + 0.5, 'then the hand rises');
  for (let t = 0; t < 90; t++) assert.ok(pz(t).sides.R.reached && pz(t).sides.L.reached, `legs reach at ${t}`);
  assert.ok(Math.abs(low.sides.R.ankle[1] - top.sides.R.ankle[1]) < 0.02, 'feet stay planted');
});

test('trip forward: the body pitches forward, the arms fling up, steps shorten, then it recovers', () => {
  const lanes = applyClip({}, clip('trip'), base, 12, 40);
  const T = 90; const s = sim(lanes, T);
  const before = at(lanes, s, 5); const mid = at(lanes, s, 12 + 20); const after = at(lanes, s, 80);
  const lean = (z) => z.headC[0] - z.pelvis[0];
  assert.ok(lean(mid) > lean(before) + 0.25, `head ahead of the hips: ${lean(before)} to ${lean(mid)}`);
  assert.ok(mid.sides.R.wrist[1] > mid.sides.R.shoulder[1] - 0.1 || mid.sides.L.wrist[1] > mid.sides.L.shoulder[1] - 0.1, 'an arm goes up');
  assert.ok(Math.abs(lean(after) - lean(before)) < 0.12, 'and it recovers');
  const walkBefore = s.x[12] / 12; const walkDuring = (s.x[32] - s.x[20]) / 12;
  assert.ok(walkDuring < walkBefore * 0.95, `it slows: ${walkBefore.toFixed(3)} then ${walkDuring.toFixed(3)} per frame`);
  for (let t = 0; t < T; t++) { const z = at(lanes, s, t); assert.ok([z.sides.R.knee, z.sides.L.knee, z.headC].every((v) => v.every(Number.isFinite)), `finite at ${t}`); }
});

test('applying a clip leaves earlier frames and other lanes alone, and applying twice replaces rather than stacks', () => {
  const first = applyClip({}, clip('stop'), base, 30, 48);
  assert.equal(laneValue(first['p:stepLength'], 10, base.stepLength), base.stepLength, 'before the clip: the walk as it was');
  const other = { 'p:lean': { pts: [{ t: 0, v: 4 }], interp: 'smooth' } };
  const withOther = applyClip(other, clip('stop'), base, 30, 48);
  assert.deepEqual(withOther['p:lean'], other['p:lean'], 'a lane the clip does not touch is unchanged');
  const again = applyClip(first, clip('stop'), base, 30, 48);
  assert.deepEqual(again['p:stepLength'].pts, first['p:stepLength'].pts, 'applying it again changes nothing');
  const scaled = applyClip({}, clip('reach'), base, 0, 48, 0.5);
  const full = applyClip({}, clip('reach'), base, 0, 48, 1);
  assert.ok(Math.abs(laneValue(scaled['c:arm.pitch.R:offset'], 14, 0)) < Math.abs(laneValue(full['c:arm.pitch.R:offset'], 14, 0)), 'strength scales it');
});

test('a clip can be stretched to any length and stays in order', () => {
  for (const D of [12, 24, 96]) {
    const lanes = applyClip({}, clip('trip'), base, 6, D);
    for (const l of Object.values(lanes)) assert.ok(l.pts.every((q, i) => i === 0 || q.t >= l.pts[i - 1].t), `D=${D}`);
  }
});

// ---------------- the dog ----------------
import { poseDog } from '../src/dog3.js';
const dogBase = { ...DEFAULTS, rig: 'dog' };
const dogStand = { ...dogBase, dogStride: 0.0001, dogBob: 0, dogFlex: 0, dogArch: 0, dogTwist: 0, dogShoulder: 0, dogLift: 0, dogHeadNod: 0, dogWag: 0, dogEar: 0 };
const dclip = (id) => clipsFor('dog').find((c) => c.id === id);
const dsim = (b, lanes, T) => integrate(b, lanes, T, b.cycleFrames);
const dat = (b, lanes, s, t) => poseDog(paramsAt(b, lanes, t), motionAt({}, lanes, t), s.u[t], { worldX: s.x[t] });

test('dog: every clip targets real parameters and channels', () => {
  assert.ok(clipsFor('dog').length >= 4);
  for (const c of clipsFor('dog')) {
    const lanes = c.build(dogBase, c.frames);
    assert.ok(Object.keys(lanes).length >= 2, c.id);
    for (const [target, pts] of Object.entries(lanes)) {
      const k = parseTarget(target);
      assert.ok(k, `${c.id}: ${target}`);
      if (k.kind === 'param') assert.ok(k.id in DEFAULTS, `${c.id}: ${target}`);
      if (k.kind === 'channel') assert.ok(CHANNEL_BY_ID[k.id], `${c.id}: ${target}`);
      assert.ok(pts.every((q, i) => i === 0 || q.t >= pts[i - 1].t) && pts.every((q) => Number.isFinite(q.v)), `${c.id}: ${target} ordered`);
    }
  }
});

test('dog walk to stop: the dog stops moving and the paws come together', () => {
  const lanes = applyClip({}, dclip('stop'), dogBase, 24, 48);
  const T = 144; const s = dsim(dogBase, lanes, T);
  assert.ok(s.x[24] > 0.5, 'it walks first');
  assert.ok(Math.abs(s.x[T] - s.x[110]) < 1e-9, 'it stops moving');
  const early = dat(dogBase, lanes, s, 10); const done = dat(dogBase, lanes, s, 130);
  const spread = (z) => Math.abs(z.legs.HR.paw[0] - z.legs.HL.paw[0]) + Math.abs(z.legs.FR.paw[0] - z.legs.FL.paw[0]);
  assert.ok(spread(early) > 0.25, `paws apart while walking: ${spread(early)}`);
  assert.ok(spread(done) < 0.05, `paws together at the end: ${spread(done)}`);
  for (const l of Object.values(done.legs)) assert.ok(Math.abs(l.paw[1] - 0.05) < 1e-6, 'all four paws on the ground');
});

test('dog reach for: the nose goes forward and the right front paw lifts and reaches', () => {
  const lanes = applyClip({}, dclip('reach'), dogStand, 10, 48);
  const T = 80; const s = dsim(dogStand, lanes, T);
  const rest = dat(dogStand, lanes, s, 5); const reach = dat(dogStand, lanes, s, 10 + 22); const back = dat(dogStand, lanes, s, 75);
  assert.ok(reach.noseTip[0] > rest.noseTip[0] + 0.12, `nose forward: ${reach.noseTip[0] - rest.noseTip[0]}`);
  assert.ok(reach.legs.FR.paw[1] > rest.legs.FR.paw[1] + 0.12, 'paw lifts');
  assert.ok(reach.legs.FR.paw[0] > rest.legs.FR.paw[0] + 0.2, 'and reaches forward');
  assert.ok(Math.abs(reach.legs.FL.paw[1] - rest.legs.FL.paw[1]) < 1e-6, 'the other front paw stays down');
  assert.ok(dist(back.noseTip, rest.noseTip) < 0.1, 'it comes back');
});

test('dog pick up: the head goes to the ground, the mouth opens and closes, then the head rises', () => {
  const lanes = applyClip({}, dclip('pickup'), dogStand, 0, 72);
  const T = 90; const s = dsim(dogStand, lanes, T);
  const top = dat(dogStand, lanes, s, 0); const low = dat(dogStand, lanes, s, 30); const carry = dat(dogStand, lanes, s, 62); const open = dat(dogStand, lanes, s, 24);
  assert.ok(low.noseTip[1] < 0.3 && low.noseTip[1] > 0.02, `nose near the ground but not through it: ${low.noseTip[1]}`);
  assert.ok(low.noseTip[1] < top.noseTip[1] - 0.5, 'the head comes well down');
  assert.ok(open.jawEnd[1] < open.hinge[1] - 0.15, 'the mouth is open at the ground');
  assert.ok(carry.noseTip[1] > low.noseTip[1] + 0.3, 'then the head rises');
  assert.ok(dist(dat(dogStand, lanes, s, 88).noseTip, top.noseTip) < 0.12, 'and settles back');
  for (let t = 0; t < T; t++) for (const l of Object.values(dat(dogStand, lanes, s, t).legs)) assert.ok(l.reached, `legs reach at ${t}`);
});

test('dog trip forward: the nose dives, the stride shortens, then it recovers', () => {
  const lanes = applyClip({}, dclip('trip'), dogBase, 12, 40);
  const T = 90; const s = dsim(dogBase, lanes, T);
  const before = dat(dogBase, lanes, s, 5); const mid = dat(dogBase, lanes, s, 12 + 14); const after = dat(dogBase, lanes, s, 85);
  assert.ok(mid.noseTip[1] < before.noseTip[1] - 0.2, `nose drops: ${before.noseTip[1]} to ${mid.noseTip[1]}`);
  assert.ok(mid.j3[1] < before.j3[1] - 0.05, 'chest drops');
  assert.ok(dist(after.noseTip, before.noseTip) < 0.25, 'recovers');
  const walkBefore = s.x[12] / 12; const walkDuring = (s.x[32] - s.x[20]) / 12;
  assert.ok(walkDuring < walkBefore * 0.95, 'it slows');
  for (let t = 0; t < T; t++) { const z = dat(dogBase, lanes, s, t); assert.ok([z.noseTip, z.tail[3], z.legs.FR.mid].every((v) => v.every(Number.isFinite)), `finite at ${t}`); }
});

test('the dog walk to stop frees the tail and ears, and every id it frees is a real channel', async () => {
  const { CHANNEL_BY_ID } = await import('../src/motion.js');
  const stop = clipsFor('dog').find((c) => c.id === 'stop');
  assert.ok(stop.free.length >= 6);
  for (const id of stop.free) assert.ok(CHANNEL_BY_ID[id], id);
});
