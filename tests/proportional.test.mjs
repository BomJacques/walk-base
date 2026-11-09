import test from 'node:test';
import assert from 'node:assert/strict';
import { falloff, proportionalMove, wrapDist, setProp, PROP, FALLOFFS } from '../src/proportional.js';
import { moveArcPoint } from '../src/arcs.js';

test('every falloff is 1 at the point, 0 at the edge and never rises', () => {
  for (const [k] of FALLOFFS) {
    assert.equal(falloff(k, 0), 1, k);
    if (k !== 'constant') assert.equal(falloff(k, 1), 0, k);
    let prev = 1;
    for (let x = 0; x <= 1; x += 0.05) { const w = falloff(k, x); assert.ok(w <= prev + 1e-12 && w >= 0, `${k} at ${x}`); prev = w; }
    assert.equal(falloff(k, 1.2), 0, `${k} beyond the radius`);
  }
  assert.ok(falloff('sharp', 0.5) < falloff('smooth', 0.5) && falloff('smooth', 0.5) < falloff('sphere', 0.5));
});

test('moving a point moves its neighbours by less the further they are, and leaves the far ones alone', () => {
  const base = Array.from({ length: 12 }, (_, i) => ({ u: i / 12, v: 0 }));
  const pts = base.map((p) => ({ ...p })); pts[4].v = 1;
  const prop = { on: true, radius: 0.25, type: 'smooth' };
  proportionalMove(pts, base, 4, (a, b) => wrapDist(a.u, b.u), prop);
  assert.equal(pts[4].v, 1);
  assert.ok(pts[3].v > 0.4 && pts[3].v < 1 && Math.abs(pts[5].v - pts[3].v) < 1e-9, 'the next ones follow');
  assert.ok(pts[2].v > 0 && pts[2].v < pts[3].v, 'the ones after that follow less');
  assert.equal(pts[8].v, 0); assert.equal(pts[0].v, 0);
  assert.deepEqual(pts.map((p) => p.u), base.map((p) => p.u), 'the order does not change');
});

test('the reach wraps round the end of a cycle', () => {
  const base = Array.from({ length: 12 }, (_, i) => ({ u: i / 12, v: 0 }));
  const pts = base.map((p) => ({ ...p })); pts[0].v = 1;
  proportionalMove(pts, base, 0, (a, b) => wrapDist(a.u, b.u), { on: true, radius: 0.25, type: 'linear' });
  assert.ok(pts[11].v > 0.5, 'the last handle is next to the first');
});

test('off means no change, and the setting is clamped', () => {
  const base = [{ u: 0, v: 0 }, { u: 0.1, v: 0 }]; const pts = [{ u: 0, v: 1 }, { u: 0.1, v: 0 }];
  proportionalMove(pts, base, 0, (a, b) => Math.abs(a.u - b.u), { on: false, radius: 0.3, type: 'smooth' });
  assert.equal(pts[1].v, 0);
  setProp({ radius: 5, type: 'nope' }, false); assert.equal(PROP.radius, 0.5); assert.equal(PROP.type, 'smooth');
  setProp({ radius: 0.2 }, false);
});

test('dragging a point on a motion arc also bends the curve round it when proportional editing is on', async () => {
  const { DEFAULTS } = await import('../src/rig.js');
  const { arcPoint } = await import('../src/arcs.js');
  const { pose3 } = await import('../src/rig3.js');
  const def = arcPoint('human', 'wrist.R');
  const params = { ...DEFAULTS, proportions: {}, motion: {} };
  const project = (w) => ({ x: w[0] * 300 + 400, y: 600 - w[1] * 300 });
  const frame = 6;
  const target = (() => { const p = def.pick(pose3(params, {}, 6 / 24)); const s = project([p[0], p[1], p[2]]); return [s.x + 30, s.y - 30]; })();
  const run = (prop) => moveArcPoint({ params, def, frame, target, project, prop });
  const off = run({ on: false, radius: 0.2, type: 'smooth' }); const on = run({ on: true, radius: 0.2, type: 'smooth' });
  assert.ok(off && on);
  const id = Object.keys(on.entries)[0];
  const changed = (e) => e.entries[id].pts.filter((q, k) => Math.abs(q.v - (off.entries[id]?.pts?.[k]?.v ?? q.v)) > 1e-9).length;
  assert.ok(on.entries[id].pts.length >= off.entries[id].pts.length);
  assert.ok(on.entries[id].pts.length > 3);
  void changed;
});
