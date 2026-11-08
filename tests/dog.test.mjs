import test from 'node:test';
import assert from 'node:assert/strict';
import { poseDog, DOGB, pawPath, pawPhase } from '../src/dog3.js';
import { DEFAULTS } from '../src/rig.js';
import { len, sub } from '../src/rig3.js';
import { CHANNELS, PARTS, partChannels, makeEvaluator } from '../src/motion.js';
import { PRESETS_DOG } from '../src/controls.js';

const base = { ...DEFAULTS, rig: 'dog' };
const dist = (a, b) => len(sub(a, b));

test('every dog part has channels and every dog channel belongs to a listed part', () => {
  const dogParts = PARTS.filter((q) => q.rig === 'dog');
  assert.ok(dogParts.length >= 14);
  for (const part of dogParts) for (const sd of part.sided ? ['R', 'L'] : [null]) assert.ok(partChannels(part.id, sd).length >= 1, `${part.id} ${sd}`);
  for (const ch of CHANNELS.filter((q) => q.id.startsWith('dog.'))) assert.ok(dogParts.some((q) => q.id === ch.part), ch.id);
  assert.ok(CHANNELS.filter((q) => q.id.startsWith('dog.')).length > 45);
});

test('bone lengths never change over the cycle, and every paw reaches, in every gait', () => {
  for (const gait of ['walk', 'trot', 'pace']) {
    const p = { ...base, dogGait: gait };
    for (let i = 0; i < 48; i++) {
      const z = poseDog(p, {}, i / 48);
      assert.ok(Math.abs(dist(z.pelvis, z.j1) - DOGB.spine[0]) < 1e-9 && Math.abs(dist(z.j1, z.j2) - DOGB.spine[1]) < 1e-9, `spine ${gait} ${i}`);
      for (const [k, l] of Object.entries(z.legs)) {
        const a = l.front ? DOGB.upper : DOGB.thigh; const b = l.front ? DOGB.fore : DOGB.shin;
        assert.ok(Math.abs(dist(l.root, l.mid) - a) < 1e-6 && Math.abs(dist(l.mid, l.wrist) - b) < 1e-6, `leg ${gait} ${i} ${k}`);
        assert.ok(l.reached, `every paw reaches: ${gait} ${i} ${k}`);
      }
    }
  }
});

test('planted paws hold one world position, on the ground', () => {
  for (const gait of ['walk', 'trot', 'pace']) {
    const p = { ...base, dogGait: gait };
    for (const k of ['HR', 'HL', 'FR', 'FL']) {
      const xs = []; let off = 0;
      for (let i = 0; i < 96; i++) {
        const u = i / 96; const z = poseDog(p, {}, u); const l = z.legs[k];
        if (l.stance) { xs.push(l.paw[0] + u * p.dogStride); off = Math.max(off, Math.abs(l.paw[1] - DOGB.paw)); }
      }
      // inside one stance the world position is constant; a later stance repeats it one stride on
      const m = xs.map((x) => (((x - xs[0]) % p.dogStride) + p.dogStride) % p.dogStride);
      assert.ok(m.every((v) => Math.min(v, p.dogStride - v) < 1e-6), `${gait} ${k} slides`);
      assert.ok(off < 1e-9, `${gait} ${k} is on the ground`);
    }
  }
});

test('footfall order: walk is hind right, front right, hind left, front left; trot pairs diagonals; pace pairs sides', () => {
  const order = (gait) => {
    const p = { ...base, dogGait: gait };
    const t = {};
    for (const k of ['HR', 'HL', 'FR', 'FL']) {
      for (let i = 0; i < 480; i++) {
        const a = poseDog(p, {}, i / 480).legs[k].stance; const b = poseDog(p, {}, ((i + 479) % 480) / 480).legs[k].stance;
        if (a && !b) t[k] = i / 480;
      }
    }
    return t;
  };
  const w = order('walk');
  assert.ok(w.HR < w.FR && w.FR < w.HL && w.HL < w.FL, JSON.stringify(w));
  const t = order('trot');
  assert.ok(Math.abs(t.HR - t.FL) < 0.005 && Math.abs(t.HL - t.FR) < 0.005 && Math.abs(t.HR - t.HL) > 0.4, JSON.stringify(t));
  const pc = order('pace');
  assert.ok(Math.abs(pc.HR - pc.FR) < 0.005 && Math.abs(pc.HL - pc.FL) < 0.005, JSON.stringify(pc));
});

test('the loop closes: the pose at the end of the cycle is the pose at the start, with the body one stride on', () => {
  for (const gait of ['walk', 'trot']) {
    const p = { ...base, dogGait: gait };
    const a = poseDog(p, {}, 0); const b = poseDog(p, {}, 0.9999999);
    for (const key of ['pelvis', 'j3', 'headC', 'noseTip']) assert.ok(dist(a[key], b[key]) < 1e-4, `${gait} ${key}`);
    assert.ok(dist(a.tail[3], b.tail[3]) < 1e-4, `${gait} tail`);
    assert.ok(Math.abs(b.pelvisX - p.dogStride) < 1e-4);
  }
});

test('the dog looks like a dog: back near level, head above the back, tail behind, paws under the body', () => {
  const z = poseDog(base, {}, 0.1);
  assert.ok(z.j3[0] - z.pelvis[0] > 0.7 && z.j3[0] - z.pelvis[0] < 1.0, 'body length');
  assert.ok(Math.abs(z.j3[1] - z.pelvis[1]) < 0.35, 'back roughly level');
  assert.ok(z.headC[1] > z.j3[1] + 0.1 && z.noseTip[0] > z.j3[0] + 0.3, 'head up and forward');
  assert.ok(z.tail[3][0] < z.pelvis[0] - 0.3 && z.tail[3][1] > z.pelvis[1] - 0.1, 'tail behind the hips');
  assert.ok(z.pelvis[1] > 0.7 && z.pelvis[1] < 1.15, `hip height ${z.pelvis[1]}`);
  for (const l of Object.values(z.legs)) assert.ok(l.root[1] > l.paw[1] + 0.4, 'legs under the body');
  for (const k of ['FR', 'FL']) assert.ok(z.legs[k].mid[0] < (z.legs[k].root[0] + z.legs[k].wrist[0]) / 2 + 1e-6, 'elbow behind');
  for (const k of ['HR', 'HL']) assert.ok(z.legs[k].mid[0] > (z.legs[k].root[0] + z.legs[k].wrist[0]) / 2 - 1e-6, 'knee forward');
});

test('dog channels edit like the human ones: amount, offset and repeats', () => {
  const wag = 'dog.tail3.yaw';
  const at = (m, u) => makeEvaluator(base, m).value(wag, u);
  const peak = (m) => Math.max(...Array.from({ length: 48 }, (_, i) => Math.abs(at(m, i / 48))));
  assert.ok(Math.abs(peak({ [wag]: { amount: 2 } }) - 2 * peak({})) < 1e-6);
  assert.ok(Math.abs(at({ [wag]: { offset: 0.3 } }, 0.2) - (at({}, 0.2) + 0.3)) < 1e-9);
  const fast = { [wag]: { freq: 2 } };
  assert.ok(Math.abs(at(fast, 0) - at(fast, 1)) < 1e-9, 'twice as fast still closes the loop');
  const closed = poseDog(base, {}, 0.2); const open = poseDog(base, { 'dog.jaw.open': { offset: 0.6 } }, 0.2);
  assert.ok(open.jawEnd[1] < closed.jawEnd[1] - 0.1, 'the jaw opens');
});

test('changing the stride and the proportions keeps every paw reachable', () => {
  for (const stride of [0.3, 0.95, 1.6]) {
    for (const legScale of [0.8, 1, 1.3]) {
      const p = { ...base, dogStride: stride, proportions: { dLeg: legScale } };
      for (let i = 0; i < 24; i++) for (const l of Object.values(poseDog(p, {}, i / 24).legs)) assert.ok(l.reached, `${stride} ${legScale} ${i}`);
    }
  }
});

test('the paw path lifts only in the swing and lands where the next stance starts', () => {
  const D = 0.6;
  assert.ok(Math.abs(pawPath(0, 0.7, D, 0.1).x - D / 2) < 1e-9);
  assert.equal(pawPath(0.5, 0.7, D, 0.1).y, 0);
  assert.ok(pawPath(0.85, 0.7, D, 0.1).y > 0.05);
  assert.ok(Math.abs(pawPath(0.99999, 0.7, D, 0.1).x - D / 2) < 1e-3);
});

// ---- the book's dog walk chart: hips and chest in opposition, shoulders that move, torso that twists ----
const cycle = (p, fn, n = 100) => Array.from({ length: n }, (_, i) => fn(poseDog(p, {}, i / n), i / n));
const span = (a) => Math.max(...a) - Math.min(...a);
const arg = (a, f) => a.indexOf(f(...a)) / a.length;

test('hips and chest bob in opposition, two times a cycle in a walk', () => {
  const hip = cycle(base, (z) => z.pelvis[1]); const chest = cycle(base, (z) => z.j3[1]);
  const m = (a) => a.reduce((s, v) => s + v, 0) / a.length; const mh = m(hip); const mc = m(chest);
  const corr = m(hip.map((v, i) => (v - mh) * (chest[i] - mc))) / Math.sqrt(m(hip.map((v) => (v - mh) ** 2)) * m(chest.map((v) => (v - mc) ** 2)));
  assert.ok(corr < -0.5, `hips and chest should move against each other: ${corr}`);
  assert.ok(span(chest) > 0.012, `the chest should visibly rise and fall: ${span(chest)}`);
  // two peaks a cycle: the height at u and u + 0.5 match
  for (const u of [0.07, 0.19, 0.33]) assert.ok(Math.abs(poseDog(base, {}, u).pelvis[1] - poseDog(base, {}, u + 0.5).pelvis[1]) < 1e-9);
});

test('the shoulder blades move, and each drops as its own paw lands', () => {
  const root = cycle(base, (z) => z.legs.FR.root.map((v, i) => v - z.j3[i]));
  assert.ok(span(root.map((v) => v[0])) > 0.02 && span(root.map((v) => v[1])) > 0.03, 'the shoulder root slides on the chest');
  const ry = cycle(base, (z) => z.legs.FR.root[1]); const ly = cycle(base, (z) => z.legs.FL.root[1]);
  const land = (pawPhase('walk', 'FR'));
  assert.ok(Math.abs(arg(ry, Math.min) - land) < 0.08, `right shoulder lowest near its landing: ${arg(ry, Math.min)}`);
  assert.ok(Math.abs(arg(ly, Math.min) - (land + 0.5)) < 0.08, `left shoulder lowest near its landing: ${arg(ly, Math.min)}`);
  const off = cycle({ ...base, dogShoulder: 0 }, (z) => z.legs.FR.root.map((v, i) => v - z.j3[i]));
  assert.ok(span(off.map((v) => v[1])) < 0.5 * span(root.map((v) => v[1])), 'Shoulder blade 0 leaves only the tilt of the chest itself');
});

test('the shoulders and hips counter-rotate along the spine', () => {
  const a = (z, p, q) => Math.atan2(z.legs[p].root[0] - z.legs[q].root[0], z.legs[p].root[2] - z.legs[q].root[2]);
  const sh = cycle(base, (z) => a(z, 'FR', 'FL')); const hp = cycle(base, (z) => a(z, 'HR', 'HL'));
  assert.ok(span(sh) * 57.3 > 8 && span(hp) * 57.3 > 4, 'both girdles turn');
  const shRoll = cycle(base, (z) => z.legs.FR.root[1] - z.legs.FL.root[1]); const hpRoll = cycle(base, (z) => z.legs.HR.root[1] - z.legs.HL.root[1]);
  assert.ok(span(hpRoll) > 0.008, 'the hips tilt');
  assert.ok(span(shRoll) > span(hpRoll), 'the shoulders tilt more than the hips');
  const noTwist = cycle({ ...base, dogTwist: 0, dogShoulder: 0 }, (z) => z.legs.FR.root[1] - z.legs.FL.root[1]);
  assert.ok(span(noTwist) < 0.1 * span(shRoll), 'with Torso twist and Shoulder blade at 0 the shoulder line stays nearly level');
});

test('with the new shoulder and twist motion every paw still reaches, in every gait and at a long stride', () => {
  for (const gait of ['walk', 'trot', 'pace']) for (const dogStride of [0.6, 0.95, 1.4]) {
    for (const z of cycle({ ...base, dogGait: gait, dogStride, dogShoulder: 0.1, dogTwist: 15 }, (q) => q, 48)) for (const l of Object.values(z.legs)) assert.ok(l.reached, `${gait} ${dogStride}`);
  }
});

test('the shoulder blade is a bone of its own: a fixed length, riding on the top of the chest, with the shoulder joint at its lower end', () => {
  for (const p of [base, { ...base, dogShoulder: 0.12, dogTwist: 12 }]) for (const z of cycle(p, (q) => q, 48)) for (const k of ['FR', 'FL']) {
    const l = z.legs[k];
    assert.ok(Math.abs(dist(l.top, l.root) - Math.hypot(DOGB.scapula, 0.02)) < 1e-9, `blade length ${k}`);
    assert.ok(l.top[1] > l.root[1] + 0.1, 'the top of the blade is above the shoulder joint');
    assert.ok(l.top[1] > z.j3[1] - 0.02, 'the top of the blade is at or above the chest');
    assert.ok(l.top[0] < l.root[0], 'and behind it');
    assert.ok(!z.legs[k === 'FR' ? 'HR' : 'HL'].top, 'hind legs have no blade');
  }
  const swing = cycle(base, (z) => z.legs.FR.root[0] - z.legs.FR.top[0]);
  assert.ok(span(swing) > 0.03, 'the blade swings about its top');
  const flat = cycle({ ...base, dogShoulder: 0 }, (z) => z.legs.FR.root[0] - z.legs.FR.top[0]);
  assert.ok(span(flat) < 0.02, 'at Shoulder blade 0 it only moves with the chest');
});

// ---- gallop: the sheet shows a flight with the legs gathered under the body and one with them stretched out ----
const gallop = { ...base, ...PRESETS_DOG.Gallop };
const planted = (z) => ['HL', 'HR', 'FL', 'FR'].filter((k) => z.legs[k].stance);

test('gallop: hind paws land first, then the front paws, and the body is in the air a third of the time', () => {
  assert.deepEqual(['HL', 'HR', 'FL', 'FR'].map((k) => pawPhase('gallop', k)), [0, 0.1, 0.38, 0.5]);
  const zs = cycle(gallop, (z) => z, 120);
  const flight = zs.filter((z) => planted(z).length === 0).length / zs.length;
  assert.ok(flight > 0.2 && flight < 0.45, `flight fraction ${flight}`);
  assert.ok(zs.some((z) => planted(z).length === 2), 'two paws down together at times');
  for (const z of zs) for (const l of Object.values(z.legs)) assert.ok(l.reached, 'every paw reaches');
});

test('gallop: the legs gather inward under the body, then stretch out', () => {
  const zs = cycle(gallop, (z) => z, 120);
  const air = zs.filter((z) => planted(z).length === 0);
  const rel = (z, k) => z.legs[k].paw[0] - z.pelvis[0];
  const gathered = air.reduce((best, z) => ((rel(z, 'HL') - (rel(z, 'FL') - 0.9)) > (rel(best, 'HL') - (rel(best, 'FL') - 0.9)) ? z : best));
  const spread = zs.reduce((best, z) => ((rel(z, 'FL') - rel(z, 'HL')) > (rel(best, 'FL') - rel(best, 'HL')) ? z : best));
  const ext = rel(spread, 'FL') - rel(spread, 'HL'); const gat = rel(gathered, 'FL') - rel(gathered, 'HL');
  assert.ok(ext > 1.4, `stretched: front paw to hind paw ${ext}`);
  assert.ok(gat < 0.5, `gathered: front and hind paws close together under the body ${gat}`);
  for (const k of ['HL', 'HR']) assert.ok(rel(gathered, k) > 0.2, 'the hind paws come forward of the hips');
  assert.ok(gathered.legs.HL.paw[1] > 0.2 && gathered.legs.FL.paw[1] > 0.2, 'and are tucked up off the ground');
});

test('gallop: the back curls up when the legs gather and the body rises in the air', () => {
  const zs = cycle(gallop, (z) => z, 120);
  const curl = zs.map((z) => z.j3[1] - z.pelvis[1]);
  const hump = zs.map((z) => (z.j1[1] + z.j2[1]) / 2 - (z.pelvis[1] + z.j3[1]) / 2); assert.ok(span(hump) > 0.12, `the back humps and stretches ${span(hump)}`);
  const hip = zs.map((z) => z.pelvis[1]);
  assert.ok(span(hip) > 0.12, `the hips rise and fall ${span(hip)}`);
  const low = zs.filter((z) => planted(z).length >= 2); const high = zs.filter((z) => planted(z).length === 0);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(high.map((z) => z.pelvis[1])) > mean(low.map((z) => z.pelvis[1])) + 0.05, 'higher in the air than on the ground');
});

test('gallop: bone lengths hold and the walk is unchanged', () => {
  for (const z of cycle(gallop, (q) => q, 48)) assert.ok(Math.abs(dist(z.pelvis, z.j1) - DOGB.spine[0]) < 1e-9);
  const w = poseDog(base, {}, 0.3); assert.equal(w.params.dogGait, 'walk');
});

// ---- free-running channels keep their own clock ----
test('a free-running channel follows the free clock, not the walk phase', () => {
  const ch = 'dog.tail3.yaw';
  const plain = makeEvaluator(base, {});
  const free = makeEvaluator(base, { [ch]: { free: true } }, 0.3);
  assert.ok(Math.abs(free.value(ch, 0) - plain.value(ch, 0.3)) < 1e-12, 'free at u = 0 reads the free clock');
  assert.ok(Math.abs(free.value(ch, 0.7) - plain.value(ch, 0.3)) < 1e-12, 'and ignores the walk phase');
  const notFree = makeEvaluator(base, { [ch]: { free: false } }, 0.3);
  assert.ok(Math.abs(notFree.value(ch, 0.2) - plain.value(ch, 0.2)) < 1e-12, 'channels that are not free are unchanged');
  const a = poseDog(base, { [ch]: { free: true } }, 0, { freeU: 0.1 }); const b = poseDog(base, { [ch]: { free: true } }, 0, { freeU: 0.35 });
  assert.ok(Math.abs(a.tail[3][2] - b.tail[3][2]) > 0.01, 'the tail moves while the walk phase is fixed');
  assert.ok(Math.abs(poseDog(base, {}, 0, { freeU: 0.1 }).tail[3][2] - poseDog(base, {}, 0, { freeU: 0.35 }).tail[3][2]) < 1e-12, 'with no free channels the clock changes nothing');
});
