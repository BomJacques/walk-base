import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, cycleFrames } from '../src/rig.js';
import { integrate, motionAt } from '../src/automation.js';
import { poseFor } from '../src/keyposes.js';
import { solveFix, writeFix, clearFix, fixPoints, fixChain, fixEnd } from '../src/fix.js';

const proj = (w) => ({ x: 400 + w[0] * 500, y: 600 - w[1] * 500 });
const withLanes = (p, lanes, T) => { const s = integrate(p, lanes, T, Math.round(p.cycleFrames), null); return { ...p, perf: { T, u: s.u, x: s.x, plants: [], lanes, live: null } }; };
const base = { ...DEFAULTS, rig: 'human', motion: {} };

test('a correction lane is added to the channel and leaves the rest alone', () => {
  const lanes = { 'c:neck.pitch:fix': { pts: [{ t: 0, v: 0 }, { t: 10, v: 0.3 }, { t: 20, v: 0 }] }, 'c:neck.pitch:offset': { pts: [{ t: 0, v: 0.1 }] } };
  assert.ok(Math.abs(motionAt({}, lanes, 10)['neck.pitch'].offset - 0.4) < 1e-9, 'offset lane and correction add');
  assert.equal(motionAt({ 'neck.pitch': { amount: 2 } }, lanes, 0)['neck.pitch'].amount, 2);
});

test('dragging the end of a part at one frame lands on the target, changes only a stretch of frames, and the animation underneath is untouched', () => {
  const T = cycleFrames(base).frames.length; const frame = 8; const spread = 5;
  const lanes0 = {}; const p0 = withLanes(base, { 'p:bob': { pts: [{ t: 0, v: base.bob }] } }, T); // some automation present
  const lanesA = { 'p:bob': { pts: [{ t: 0, v: base.bob }] } };
  const pz0 = poseFor(p0, frame); const end0 = fixEnd(pz0, 'neck', null, null); const s0 = proj(end0);
  // a neck turns about its base, so the end can only go round an arc: pick a point on it (the neck tipped a little further)
  const t0 = proj(fixEnd(poseFor(p0, frame, { 'neck.pitch': 0.18 }), 'neck', null, null)); const target = [t0.x, t0.y]; void s0;
  const r = solveFix({ params: p0, frame, part: 'neck', target, project: proj });
  assert.ok(r.err < 1, `err ${r.err}`);
  const lanes = writeFix(lanesA, r.delta, frame, spread, T);
  const p1 = withLanes(base, lanes, T);
  const e1 = proj(fixEnd(poseFor(p1, frame), 'neck', null, null));
  assert.ok(Math.hypot(e1.x - target[0], e1.y - target[1]) < 1.5, 'the end of the neck is where it was dropped');
  for (let f = 0; f < T; f++) {
    const a = poseFor(p0, f); const b = poseFor(p1, f);
    const d = Math.hypot(...a.neckTop.map((v, i) => v - b.neckTop[i]));
    if (Math.abs(f - frame) >= spread) assert.ok(d < 1e-9, `frame ${f} is untouched`); else if (f !== frame) assert.ok(d > 0, `frame ${f} eases`);
    assert.ok(Math.hypot(...a.pelvis.map((v, i) => v - b.pelvis[i])) < 1e-9 && Math.hypot(...a.sides.R.ankle.map((v, i) => v - b.sides.R.ankle[i])) < 1e-9, `hips and feet unchanged at ${f}`);
  }
  // take the corrections away and it is exactly the animation again
  const cleared = clearFix(lanes, 'neck', null);
  assert.deepEqual(cleared, lanesA);
  const p2 = withLanes(base, cleared, T);
  for (let f = 0; f < T; f++) assert.deepEqual(poseFor(p2, f).neckTop, poseFor(p0, f).neckTop);
  assert.ok(fixPoints(lanes, 'neck', null) >= 2 && fixPoints(cleared, 'neck', null) === 0);
});

test('a second try from the same lanes replaces the first rather than stacking', () => {
  const T = cycleFrames(base).frames.length;
  const a = writeFix({}, { 'neck.pitch': 0.2 }, 6, 4, T); const b = writeFix({}, { 'neck.pitch': 0.5 }, 6, 4, T);
  assert.equal(a['c:neck.pitch:fix'].pts.find((q) => q.t === 6).v, 0.2); assert.equal(b['c:neck.pitch:fix'].pts.find((q) => q.t === 6).v, 0.5);
  const c = writeFix(a, { 'neck.pitch': 0.1 }, 6, 4, T); assert.ok(Math.abs(c['c:neck.pitch:fix'].pts.find((q) => q.t === 6).v - 0.3) < 1e-9, 'a new drag adds to the old correction');
});

test('it works for the dog and for a limb', () => {
  const d = { ...DEFAULTS, rig: 'dog', motion: {} }; const T = cycleFrames(d).frames.length;
  for (const [part, side] of [['dog.neck', null], ['dog.tail1', null], ['dog.fpaw', 'R']]) {
    const end = proj(fixEnd(poseFor(d, 3), part, null, side));
    const r = solveFix({ params: d, frame: 3, part, side, target: [end.x + 6, end.y - 6], project: proj });
    assert.ok(r && Object.keys(r.delta).length >= 1, part);
  }
  assert.ok(fixChain('arm', 'R').every((id) => !id.includes('roll')));
});
