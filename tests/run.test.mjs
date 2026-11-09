import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, sideGait, supportStats, gaitSummary } from '../src/rig.js';
import { pose3 } from '../src/rig3.js';
import { PRESETS, PRESETS_HOSE, CONTROLS } from '../src/controls.js';

const params = (o) => ({ ...DEFAULTS, ...o, proportions: {}, motion: {} });
const scan = (p, n = 96) => { const out = { unreached: 0, flight: 0, lowStance: 0, highFlight: 0 }; let ys = []; for (let i = 0; i < n; i++) { const z = pose3(p, {}, i / n); for (const s of ['R', 'L']) if (!z.sides[s].reached) out.unreached++; if (!z.sides.R.stance && !z.sides.L.stance) { out.flight++; } ys.push([z.pelvis[1], !z.sides.R.stance && !z.sides.L.stance]); } out.flight /= n; const fl = ys.filter((q) => q[1]).map((q) => q[0]); const st = ys.filter((q) => !q[1]).map((q) => q[0]); out.highFlight = Math.max(...fl, -9) - Math.min(...st); return out; };

test('time on the ground can go below a half, so a run has a moment with neither foot down', () => {
  assert.equal(sideGait(params({ duty: 0.3 }), 'L').p.duty, 0.3);
  assert.equal(CONTROLS.find((c) => c.id === 'duty').min, 0.25);
  const g = gaitSummary(params(PRESETS.Run)); assert.ok(g.flight > 0.2, `flight ${g.flight}`);
  assert.equal(gaitSummary(params({})).flight, 0);
});

test('Jog, Run and Sprint keep both feet reachable through the whole cycle, with more flight the faster they go', () => {
  const r = ['Jog', 'Run', 'Sprint'].map((n) => ({ n, ...scan(params(PRESETS[n])) }));
  for (const x of r) assert.equal(x.unreached, 0, `${x.n} loses a foot`);
  assert.ok(r[0].flight > 0 && r[0].flight < r[1].flight && r[1].flight < r[2].flight, JSON.stringify(r.map((x) => x.flight)));
});

test('in flight the body is higher than when a foot is down', () => {
  for (const n of ['Run', 'Sprint']) { const x = scan(params(PRESETS[n])); assert.ok(x.highFlight > 0.02, `${n} rises ${x.highFlight}`); }
});

test('the rubber hose figure runs too, drawn on twos', () => {
  const p = params({ ...PRESETS_HOSE.Run, model: 'hose' }); assert.equal(PRESETS_HOSE.Run.exposure, 2);
  const x = scan(p); assert.equal(x.unreached, 0); assert.ok(x.flight > 0.1);
  for (const [k, v] of Object.entries({ ...PRESETS.Run, ...PRESETS.Jog, ...PRESETS.Sprint, ...PRESETS_HOSE.Run })) { const c = CONTROLS.find((q) => q.id === k && q.scope === 'p'); assert.ok(c, k); assert.ok(c.options ? c.options.includes(v) : v >= c.min - 1e-9 && v <= c.max + 1e-9, `${k}=${v} within ${c.min}..${c.max}`); }
  void supportStats;
});
