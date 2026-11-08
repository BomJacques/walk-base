import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, cycleFrames } from '../src/rig.js';
import { arcPoints, arcPoint, samplePaths, moveArcPoint, solveMove, adoptArcs } from '../src/arcs.js';
import { poseFor } from '../src/keyposes.js';

const human = () => ({ ...DEFAULTS, rig: 'human', motion: {} });
const dog = () => ({ ...DEFAULTS, rig: 'dog', motion: {} });
const proj = (w) => ({ x: 400 + w[0] * 500, y: 600 - w[1] * 500 });

test('with no edits an arc matches the pose function', () => {
  for (const mk of [human, dog]) {
    const p = mk(); const rig = p.rig; const cur = poseFor(p, 0);
    const defs = arcPoints(rig); const paths = samplePaths(p, defs, cur);
    const T = cycleFrames(p).frames.length;
    for (const d of defs) {
      assert.equal(paths.get(d.id).length, T, d.id);
      for (const f of [0, 3, T - 1]) {
        const pt = d.pick(poseFor(p, f)); const got = paths.get(d.id)[f].p;
        assert.ok(Math.abs(got[1] - pt[1]) < 1e-9 && Math.abs(got[2] - pt[2]) < 1e-9, `${rig} ${d.id} ${f}`);
      }
    }
  }
});

test('a looping walk gives a closed arc', () => {
  const p = human(); const T = cycleFrames(p).frames.length;
  const a = poseFor(p, 0); const b = poseFor(p, T);
  for (const d of arcPoints('human')) {
    const x = d.pick(a); const y = d.pick(b);
    assert.ok(Math.hypot(x[1] - y[1], x[2] - y[2]) < 1e-9, d.id);
  }
});

test('the solver lands on a reachable target', () => {
  const f = (v) => [Math.cos(v[0]) * 100 + v[1] * 40, Math.sin(v[0]) * 100];
  const r = solveMove(f, [0.3, 0], [70, 60], [1, 1]);
  assert.ok(r.err < 0.3, `err ${r.err}`);
});

test('dragging an ankle dot moves that ankle there and leaves the other points', () => {
  const p = human(); const def = arcPoint('human', 'ankle.R'); const frame = 5; const T = cycleFrames(p).frames.length;
  const cur = poseFor(p, frame);
  const before = poseFor(p, frame); const at = def.pick(before);
  const s0 = proj([at[0] + cur.pelvisX, at[1], at[2]]);
  const target = [s0.x + 18, s0.y - 22];
  const r = moveArcPoint({ params: p, def, frame, target, project: proj });
  assert.ok(r && r.err < 1, `err ${r?.err}`);
  const p2 = { ...p, motion: r.entries };
  const after = poseFor(p2, frame); const pt = def.pick(after);
  const s1 = proj([pt[0] + cur.pelvisX, pt[1], pt[2]]);
  assert.ok(Math.hypot(s1.x - target[0], s1.y - target[1]) < 1.5, 'lands on the target');
  for (const id of ['head', 'hip', 'wrist.R', 'wrist.L', 'ankle.L']) {
    const d = arcPoint('human', id); const a = d.pick(poseFor(p, frame)); const b = d.pick(after);
    assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6, id);
  }
  // far from the dragged frame the path is still the old one
  const far = (frame + Math.round(T / 2)) % T;
  const a = def.pick(poseFor(p, far)); const b = def.pick(poseFor(p2, far));
  assert.ok(Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.05, 'other end of the cycle barely changes');
});

test('dragging works for the dog paw and the hand', () => {
  for (const [p, id] of [[dog(), 'paw.FR'], [human(), 'wrist.L'], [dog(), 'tail']]) {
    const def = arcPoint(p.rig, id); const frame = 2; const cur = poseFor(p, frame);
    const at = def.pick(cur); const s0 = proj([at[0] + cur.pelvisX, at[1], at[2]]);
    const r = moveArcPoint({ params: p, def, frame, target: [s0.x + 8, s0.y - 10], project: proj });
    assert.ok(r && r.err < 2, `${id} err ${r?.err}`);
  }
});

test('not editable in a performance or with a free channel', () => {
  const def = arcPoint('human', 'ankle.R');
  assert.equal(moveArcPoint({ params: { ...human(), perf: { T: 10 } }, def, frame: 0, target: [0, 0], project: proj }), null);
  assert.equal(moveArcPoint({ params: { ...human(), motion: { 'foot.x.R': { free: true } } }, def, frame: 0, target: [0, 0], project: proj }), null);
});

test('old arc names are carried over and unknown ones dropped', () => {
  assert.deepEqual(adoptArcs('human', ['head', 'wrist', 'ankle', 'bogus']), ['head', 'wrist.R', 'ankle.R']);
  assert.deepEqual(adoptArcs('dog', ['wrist', 'tail']), ['paw.FR', 'tail']);
});

test('arcs start on both sides, and there are more points to follow: chest, toes, jaw, the middle of the tail', async () => {
  const { DEFAULT_ARCS, arcSide } = await import('../src/arcs.js');
  for (const rig of ['human', 'dog']) {
    const ids = new Set(arcPoints(rig).map((d) => d.id));
    for (const id of DEFAULT_ARCS[rig]) assert.ok(ids.has(id), `${rig} default ${id} exists`);
    assert.ok(DEFAULT_ARCS[rig].filter((i) => arcSide(i) === 'R').length === DEFAULT_ARCS[rig].filter((i) => arcSide(i) === 'L').length, `${rig}: as many left as right`);
  }
  for (const id of ['chest', 'toe.R', 'toe.L']) assert.ok(arcPoint('human', id), id);
  for (const id of ['chest', 'jaw', 'tailmid', 'toe.FR', 'toe.HL']) assert.ok(arcPoint('dog', id), id);
  assert.equal(arcSide('paw.FL'), 'L'); assert.equal(arcSide('ankle.R'), 'R'); assert.equal(arcSide('head'), null);
  for (const [rig, id] of [['human', 'toe.L'], ['human', 'chest'], ['dog', 'toe.HR'], ['dog', 'tailmid'], ['dog', 'jaw'], ['dog', 'chest']]) {
    const p = rig === 'dog' ? dog() : human(); const def = arcPoint(rig, id); const frame = 4; const cur = poseFor(p, frame);
    const at = def.pick(cur); const s0 = proj([at[0] + cur.pelvisX, at[1], at[2]]);
    const probe = Object.fromEntries(def.chain.map((c, i) => [c, i === 0 ? 0.12 : 0]));
    const pz = poseFor(p, frame, probe); const pt = def.pick(pz); const t0 = proj([pt[0] + cur.pelvisX, pt[1], pt[2]]);
    const r = moveArcPoint({ params: p, def, frame, target: [t0.x, t0.y], project: proj });
    assert.ok(r && r.err < 2.5, `${rig} ${id} err ${r?.err}`); void s0;
  }
});
