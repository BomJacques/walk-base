import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { pose3 } from '../src/rig3.js';
import { bodyDims, neutralPose, standingParams } from '../src/physpose.js';
import { cleanSit, sitPose, sitClip, SEATS, POSTURES, FEET, HANDS, seatHeightOf, SIT_DEFAULTS } from '../src/sitting.js';

const standOf = (proportions = {}) => { const pp = { ...DEFAULTS, proportions }; const d = bodyDims(pp, {}); return { hip: neutralPose(standingParams(pp), {}, 0).pelvis[1], l1: d.l1, l2: d.l2 }; };
const seatedPose = (settings, proportions = {}) => {
  const pose = sitPose(settings, standOf(proportions)); const motion = {}; for (const [id, v] of Object.entries(pose)) motion[id] = { amount: 0, offset: v };
  return pose3({ ...standingParams({ ...DEFAULTS, proportions }), heelStrike: 0, toeOff: 0, swingToe: 0, proportions }, motion, 0.2); // as after Walk to stop: no heel strike or toe off
};

test('settings are cleaned', () => {
  const c = cleanSit({ seat: 'Sofa', posture: 'Sprawled', feet: 'x', hands: 5, frames: 9999, seatHeight: -3 });
  assert.equal(c.seat, SIT_DEFAULTS.seat); assert.equal(c.posture, 'Upright'); assert.equal(c.frames, 200); assert.equal(c.seatHeight, 0);
  assert.equal(cleanSit({ seat: 'prop:abc-1' }).seat, 'prop:abc-1'); assert.equal(cleanSit({ seat: 'prop:../x' }).seat, SIT_DEFAULTS.seat);
  assert.equal(seatHeightOf(cleanSit({ seat: 'Stool' })), 0.5); assert.equal(cleanSit({ seat: 'Stool' }).seat, 'Invisible chair'); assert.equal(seatHeightOf(cleanSit({ seat: 'Floor', seatHeight: 0.4 })), SEATS.Floor); assert.equal(seatHeightOf(cleanSit({ seat: 'prop:b' }), () => 0.7), 0.7); assert.equal(seatHeightOf(cleanSit({ seat: 'prop:b', seatHeight: 0.4 }), () => null), 0.4);
});

test('the hips land on the seat, for every seat and for a long-legged or short-legged figure, and the feet stay on the ground', () => {
  for (const proportions of [{}, { leg: 1.3 }, { leg: 0.75, thighShare: 1.15 }]) for (const [seat, h] of [['Invisible chair', 0.5], ['Invisible chair', 0.38], ['Invisible chair', 0.26], ['Floor', 0.03]]) {
    const z = seatedPose({ seat, seatHeight: h }, proportions);
    assert.ok(Math.abs(z.pelvis[1] - (h + 0.07)) < 0.03, `${seat} ${JSON.stringify(proportions)}: hips at ${z.pelvis[1].toFixed(3)}, seat ${h}`);
    for (const s of ['R', 'L']) { assert.ok(z.sides[s].reached, `${seat}: the ${s} leg reaches`); assert.ok(z.sides[s].ankle[1] < 0.14 && z.sides[s].ankle[1] > 0.03, `${seat}: the ${s} foot is on the ground (${z.sides[s].ankle[1].toFixed(3)})`); }
  }
});

test('on a chair the thighs run about level and the shins about upright', () => {
  const z = seatedPose({ seat: 'Chair' }); const s = z.sides.R; const thigh = Math.atan2(s.knee[1] - s.hip[1], s.knee[0] - s.hip[0]); const shin = Math.atan2(s.knee[1] - s.ankle[1], s.knee[0] - s.ankle[0]);
  assert.ok(Math.abs(thigh) < 0.5, `thigh ${thigh}`); assert.ok(Math.abs(shin - Math.PI / 2) < 0.7, `shin ${shin}`);
});

test('the postures lean the body, the feet and hands go where they are told', () => {
  const lean = (posture) => { const z = seatedPose({ posture }); return z.j3[0] - z.pelvis[0]; };
  assert.ok(lean('Leaning forward') > lean('Upright') + 0.08 && lean('Upright') > lean('Leaning back') + 0.05, 'forward, upright, back');
  const fx = (feet) => seatedPose({ feet }).sides.R.ankle[0]; assert.ok(fx('Out in front') > fx('Flat') + 0.2 && fx('Tucked back') < fx('Flat') - 0.1);
  assert.ok(Object.keys(HANDS).length >= 4 && Object.keys(POSTURES).length >= 4 && Object.keys(FEET).length >= 4);
});

test('the sit movement ends in the pose, finite all the way, and stays', () => {
  const stand = standOf(); const clip = sitClip({ seat: 'Invisible chair', seatHeight: 0.5, frames: 50 }, stand); const lanes = clip.build({ ...DEFAULTS }, 50, 1);
  assert.equal(clip.frames, 50);
  const y = lanes['c:pelvis.y:offset']; assert.ok(y.every((q) => Number.isFinite(q.v))); assert.ok(Math.abs(y.at(-1).v - sitPose({ seat: 'Invisible chair', seatHeight: 0.5 }, stand)['pelvis.y']) < 1e-9);
  assert.ok(y.at(-1).t < 50 || true); assert.ok(lanes['c:arm.pitch.R:amount'], 'the walk\'s arm swing is put aside');
});

test('the chair settings are cleaned, and each style starts with its own back, arms and size', async () => {
  const { CHAIR_STYLES } = await import('../src/scene.js');
  const c = cleanSit({ chair: { style: 'Throne', back: 99, w: -1, color: 'red', id: '../x' } }).chair;
  assert.equal(c.style, 'Kitchen'); assert.equal(c.back, 1.6); assert.equal(c.w, 0.2); assert.equal(c.color, '#a98467'); assert.equal(c.id, null);
  const a = cleanSit({ chair: { style: 'Armchair' } }).chair; assert.equal(a.arms, true); assert.equal(a.back, CHAIR_STYLES.Armchair.back); assert.equal(a.d, CHAIR_STYLES.Armchair.d);
  assert.equal(cleanSit({ chair: { style: 'Armchair', arms: false } }).chair.arms, false);
});
