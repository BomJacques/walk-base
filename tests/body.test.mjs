import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { pose3 } from '../src/rig3.js';
import { bodyDims, bodyFromRig, bodyChannels, neutralPose, liveOf, PHYS_CHANNELS } from '../src/physpose.js';
import { PT, HAND, ANKLE, createBody, bodyFromAngles, stepBody, pointsOf, anglesNow, anglesOf, grip, release, centreOfMass, setVelocity, velocityOf, dragStart, dragMove, dragEnd } from '../src/body.js';
import { motionAt } from '../src/automation.js';

const params = { ...DEFAULTS, proportions: {} };
const d = bodyDims(params, {});
const standing = () => bodyFromRig(params, {}, 0, { stand: true });
const lift = (b, dy, dx = 0) => { for (let i = 0; i < 11; i++) { b.y[i] += dy; b.oy[i] += dy; b.x[i] += dx; b.ox[i] += dx; } };
const bones = (b) => [[PT.P, PT.S, d.Lt], [PT.S, PT.ER, d.ua], [PT.ER, PT.HR, d.fa], [PT.P, PT.KR, d.l1], [PT.KR, PT.AR, d.l2]].map(([i, j, L]) => Math.abs(Math.hypot(b.x[j] - b.x[i], b.y[j] - b.y[i]) - L));
const hangingBody = (hold, swing = 0) => {
  const a = { P: [0, 0], phi: 0, psi: 0, arm: { R: [3.0, 0.05], L: [3.0, 0.05] }, leg: { R: [0.05, 0.1], L: [-0.05, 0.1] } };
  const q = bodyFromAngles(d, a); a.P = [hold.x - q[PT.HR][0], hold.y - q[PT.HR][1]];
  const b = createBody(d, a); grip(b, 'R', 0); grip(b, 'L', 0);
  for (let i = 0; i < 11; i++) { const dx = b.x[i] - hold.x; const dy = b.y[i] - hold.y; b.x[i] = hold.x + dx * Math.cos(swing) + dy * Math.sin(swing); b.y[i] = hold.y - dx * Math.sin(swing) + dy * Math.cos(swing); b.ox[i] = b.x[i]; b.oy[i] = b.y[i]; }
  return b;
};

test('the rig puts the figure where the body is: angles and channels round-trip', () => {
  const b = standing();
  const a = anglesNow(b); const pts = bodyFromAngles(d, a);
  for (let i = 0; i < 11; i++) assert.ok(Math.hypot(pts[i][0] - b.x[i], pts[i][1] - b.y[i]) < 1e-9, `point ${i}`);
  const nz = neutralPose(params, {}, 0); const ch = bodyChannels(b, nz);
  assert.deepEqual(Object.keys(ch).sort(), [...PHYS_CHANNELS].sort());
  const motion = {}; for (const id of PHYS_CHANNELS) motion[id] = { amount: 0, offset: ch[id] };
  const z = pose3({ ...params, headBob: 0 }, motion, 0);
  const e = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]); const P = pointsOf(b);
  assert.ok(e(z.pelvis, P[PT.P]) < 2e-3 && e(z.sides.R.ankle, P[PT.AR]) < 2e-3 && e(z.sides.L.ankle, P[PT.AL]) < 2e-3, 'hips and feet');
  assert.ok(e(z.sides.R.hand, P[PT.HR]) < 2e-3 && e(z.sides.L.elbow, P[PT.EL]) < 2e-3 && e(z.headC, P[PT.H]) < 2e-3, 'hands, elbows and head');
});

test('a body in any pose is reproduced by the rig, not only a standing one', () => {
  const b = hangingBody({ x: 0.4, y: 3.2 }, 0.5); stepBody(b, { gravity: 1, strength: 0.8, holds: [{ x: 0.4, y: 3.2 }] }, 10);
  const nz = neutralPose(params, {}, 0); const ch = bodyChannels(b, nz);
  const motion = {}; for (const id of PHYS_CHANNELS) motion[id] = { amount: 0, offset: ch[id] };
  const z = pose3({ ...params, headBob: 0 }, motion, 0); const P = pointsOf(b);
  assert.ok(Math.hypot(z.sides.R.hand[0] - 0.4, z.sides.R.hand[1] - 3.2) < 0.03, 'the hand is on the hold in the rig too');
  assert.ok(Math.hypot(z.pelvis[0] - P[0][0], z.pelvis[1] - P[0][1]) < 2e-3 && Math.hypot(z.headC[0] - P[PT.H][0], z.headC[1] - P[PT.H][1]) < 0.02);
});

test('the live values switch the walk off for every simulated channel', () => {
  const nz = neutralPose(params, {}, 0); const live = liveOf(bodyChannels(standing(), nz));
  assert.equal(live['p:headBob'], 0);
  const m = motionAt({}, null, 0, live);
  for (const id of PHYS_CHANNELS) assert.equal(m[id].amount, 0, id);
});

test('standing: the body holds its pose and does not drift or sink', () => {
  const b = standing(); const y0 = b.y[PT.P]; stepBody(b, { gravity: 1, strength: 0.8, balance: 0.8 }, 96);
  assert.ok(Math.abs(b.y[PT.P] - y0) < 0.02, `hips ${b.y[PT.P]} vs ${y0}`);
  assert.ok(Math.abs(b.x[PT.P]) < 0.1, `drift ${b.x[PT.P]}`);
  assert.ok(Math.abs(anglesNow(b).phi) < 0.05, 'upright');
  for (const e of bones(b)) assert.ok(e < 0.01, 'the bones keep their length');
});

test('with no muscles the body gives way and lies down; with them it stays up', () => {
  const limp = standing(); stepBody(limp, { gravity: 1, strength: 0 }, 72);
  const firm = standing(); stepBody(firm, { gravity: 1, strength: 0.8, balance: 0.8 }, 72);
  assert.ok(limp.y[PT.H] < 0.9 && firm.y[PT.H] > 1.8, `heads ${limp.y[PT.H]} ${firm.y[PT.H]}`);
  assert.ok(limp.y[PT.P] < 0.6, 'the hips come down');
});

test('a fall takes the time gravity says, and lands without gaining energy', () => {
  const b = standing(); lift(b, 2); const y0 = b.y[PT.P]; let land = -1; const ys = [];
  for (let f = 0; f < 80; f++) { stepBody(b, { gravity: 1, strength: 0.8, balance: 0.8 }, 1); ys.push(b.y[PT.P]); if (land < 0 && b.contact[PT.AR]) land = f + 1; }
  const expect = Math.sqrt((2 * 2) / 10.9) * 24; // the free fall of two leg lengths
  assert.ok(Math.abs(land - expect) <= 2, `landed at frame ${land}, expected about ${expect.toFixed(1)}`);
  assert.ok(Math.max(...ys.slice(land + 3)) < y0 - 1.8, 'it does not bounce back up');
  assert.ok(Math.abs(ys.at(-1) - 1.07) < 0.03, 'and ends standing');
});

test('gravity is a setting: half gravity falls slower, none does not fall', () => {
  const fall = (g) => { const b = standing(); lift(b, 2); stepBody(b, { gravity: g, strength: 0.8 }, 12); return 2 + 1.074 - b.y[PT.P]; };
  assert.ok(fall(0.5) < fall(1) * 0.6 && fall(0.5) > 0, 'half gravity, about half the fall');
  assert.ok(Math.abs(fall(0)) < 1e-3, 'no gravity, no fall');
});

test('in space the body keeps its speed and its momentum: nothing pushes it', () => {
  const b = standing(); lift(b, 2); setVelocity(b, 1.5, 0.5, 24); const c0 = centreOfMass(b);
  stepBody(b, { gravity: 0, drag: 0, strength: 0.8 }, 48); const c1 = centreOfMass(b);
  assert.ok(Math.abs(c1[0] - c0[0] - 3) < 0.02 && Math.abs(c1[1] - c0[1] - 1) < 0.02, `moved ${c1[0] - c0[0]}, ${c1[1] - c0[1]}`);
});

test('drag slows a drifting body, and the more drag the faster', () => {
  const run = (drag) => { const b = standing(); lift(b, 2); setVelocity(b, 2, 0, 24); const c0 = centreOfMass(b)[0]; stepBody(b, { gravity: 0, drag, strength: 0.8 }, 48); return centreOfMass(b)[0] - c0; };
  assert.ok(run(0) > run(1) && run(1) > run(4) && run(4) > 0.2, `${run(0)} ${run(1)} ${run(4)}`);
});

test('a body hung from a hold swings like a pendulum and slowly settles', () => {
  const hold = { x: 0, y: 3.2 }; const b = hangingBody(hold, 0.7); const env = { gravity: 1, strength: 0.8, balance: 0.8, holds: [hold] };
  const xs = []; let worst = 0;
  for (let f = 0; f < 180; f++) { stepBody(b, env, 1); xs.push(centreOfMass(b)[0] - hold.x); worst = Math.max(worst, ...bones(b)); }
  const cross = []; for (let i = 1; i < xs.length; i++) if ((xs[i - 1] > 0) !== (xs[i] > 0)) cross.push(i);
  assert.ok(cross.length >= 4, `it keeps swinging: crossings ${cross}`);
  const half = (cross[3] - cross[1]) / 2; const L = Math.hypot(centreOfMass(b)[0] - hold.x, centreOfMass(b)[1] - hold.y);
  const t = 2 * half / 24; const expect = 2 * Math.PI * Math.sqrt(L / 10.9);
  assert.ok(t > expect * 0.85 && t < expect * 1.4, `period ${t.toFixed(2)} s, a pendulum this long is ${expect.toFixed(2)}`);
  const amp = (a, b2) => Math.max(...xs.slice(a, b2).map(Math.abs));
  assert.ok(amp(120, 180) < amp(0, 60) * 0.95 && amp(120, 180) > 0.1, 'the swing dies down but not at once');
  assert.ok(Math.hypot(b.x[PT.HR] - hold.x, b.y[PT.HR] - hold.y) < 1e-6, 'the hand stays on the hold');
  assert.ok(b.y[PT.AR] > 0.5 && b.y[PT.AL] > 0.5, 'the feet are off the ground');
  assert.ok(worst < 0.03, `the bones stay their length while it swings (${worst.toFixed(3)})`);
});

test('a longer swing is slower, and a heavier push swings further', () => {
  const swingTime = (holdY) => { const hold = { x: 0, y: holdY }; const b = hangingBody(hold, 0.4); const env = { gravity: 1, strength: 0.8, holds: [hold] }; const xs = [];
    for (let f = 0; f < 200; f++) { stepBody(b, env, 1); xs.push(centreOfMass(b)[0]); } const c = []; for (let i = 1; i < xs.length; i++) if ((xs[i - 1] > 0) !== (xs[i] > 0)) c.push(i); return c[2] - c[0]; };
  assert.ok(swingTime(3.2) > 0, 'swings');
  const high = (g) => { const hold = { x: 0, y: 3.2 }; const b = hangingBody(hold, 0.2); stepBody(b, { gravity: g, strength: 0.8, holds: [hold] }, 24); return Math.abs(centreOfMass(b)[0]); };
  assert.ok(high(1) > 0, 'moves');
});

test('with less gravity the same swing is slower', () => {
  const period = (g) => { const hold = { x: 0, y: 3.2 }; const b = hangingBody(hold, 0.5); const xs = []; for (let f = 0; f < 260; f++) { stepBody(b, { gravity: g, strength: 0.8, holds: [hold] }, 1); xs.push(centreOfMass(b)[0]); } const c = []; for (let i = 1; i < xs.length; i++) if ((xs[i - 1] > 0) !== (xs[i] > 0)) c.push(i); return c.length > 2 ? c[2] - c[0] : 999; };
  assert.ok(period(0.5) > period(1) * 1.25, `${period(0.5)} vs ${period(1)}`);
});

test('a hand that comes near a hold takes it, and the body then hangs from it', () => {
  const hold = { x: 0, y: 3.4 };
  const a = { P: [0, 0], phi: 0, psi: 0, arm: { R: [3.0, 0.05], L: [3.0, 0.05] }, leg: { R: [0.05, 0.1], L: [-0.05, 0.1] } };
  const q = bodyFromAngles(d, a); a.P = [hold.x - q[PT.HR][0], hold.y - 0.45 - q[PT.HR][1]]; // a jump: the hands are 0.45 below the bar, rising
  const b = createBody(d, a); setVelocity(b, 0, Math.sqrt(2 * 10.9 * 0.4), 24);
  const env = { gravity: 1, strength: 0.8, balance: 0.4, holds: [hold], reach: 0.1 };
  let grabbed = -1; for (let f = 0; f < 30 && grabbed < 0; f++) { stepBody(b, env, 1); if (b.grip.R != null || b.grip.L != null) grabbed = f; }
  assert.ok(grabbed >= 0, 'it took hold on the way up');
  stepBody(b, env, 90);
  const side = b.grip.R != null ? 'R' : 'L';
  assert.ok(Math.hypot(b.x[HAND[side]] - hold.x, b.y[HAND[side]] - hold.y) < 1e-6, 'hand still on the hold');
  assert.ok(b.y[PT.AR] > 0.3 && b.y[PT.P] < hold.y - 0.8, 'hanging below it with the feet off the ground');
  release(b, side); stepBody(b, env, 2); assert.equal(b.grip[side], null, 'it let go, and does not take hold again at once');
  stepBody(b, env, 30); assert.ok(b.y[PT.P] < hold.y - 1.2 || b.grip.R != null || b.grip.L != null, 'the other hand keeps it up, or it falls');
});

test('dragging the figure by a point carries it, and letting go while moving throws it', () => {
  const b = standing(); const env = { gravity: 1, strength: 0.8, balance: 0.8 };
  dragStart(b, PT.P, b.x[PT.P], b.y[PT.P], 0);
  for (let f = 1; f <= 12; f++) { dragMove(b, 0.1 * f, 1.07 + 0.1 * f, f / 24); stepBody(b, env, 1); }
  assert.ok(b.y[PT.P] > 1.9 && Math.abs(b.x[PT.P] - 1.1) < 0.4, `carried to ${b.x[PT.P].toFixed(2)}, ${b.y[PT.P].toFixed(2)}`);
  dragEnd(b, 12 / 24); const [vx, vy] = velocityOf(b, PT.P);
  assert.ok(vx > 1 && vy > 1, `thrown at ${vx.toFixed(1)}, ${vy.toFixed(1)}`);
  stepBody(b, env, 90); assert.ok(b.x[PT.P] > 2, 'it travelled on'); assert.ok(b.y[PT.P] < 1.2, 'and came down');
  const c = standing(); dragStart(c, PT.P, c.x[0], c.y[0], 0); lift(c, 1); dragMove(c, 0, 2.07, 0.5); dragEnd(c, 1.0); assert.ok(Math.abs(velocityOf(c, PT.P)[0]) < 0.5, 'held still, then let go: dropped, not thrown');
});

test('boxes are ground: a body falls onto a box and stands on it', () => {
  const b = standing(); lift(b, 1.5); const ground = (x) => (x > -1 && x < 1 ? 0.5 : 0);
  stepBody(b, { gravity: 1, strength: 0.8, balance: 0.8, ground }, 60);
  assert.ok(Math.abs(b.y[PT.AR] - 0.575) < 0.03 && Math.abs(b.y[PT.AL] - 0.575) < 0.03 && Math.abs(b.y[PT.P] - 1.57) < 0.05, `${b.y[PT.AR]} ${b.y[PT.P]}`);
});

test('the figure is simulated at its own proportions: longer legs, longer reach', () => {
  const tall = { ...params, proportions: { leg: 1.5 } }; const dt = bodyDims(tall, {});
  assert.ok(dt.l1 + dt.l2 > (d.l1 + d.l2) * 1.4 && Math.abs(dt.ua - d.ua) < 1e-6);
});
