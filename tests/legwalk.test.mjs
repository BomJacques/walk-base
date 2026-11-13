import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { legSchedule, legFoot, stepsFor, hash01 } from '../src/legwalk.js';
import { poseCrawler } from '../src/crawler.js';

const base = { seed: 4, n: 2, phase: 0.1, duty: 0.7, D: 0.8, jT: 0.5, jS: 0.5, jP: 0.4, jL: 0.5, reach: 0.4, lift: 0.2 };

test('a leg\'s steps add up to the cycle and the foot is continuous and loops', () => {
  const st = legSchedule(base);
  assert.ok(Math.abs(st.reduce((t, s) => t + s.T, 0) - 1) < 1e-9);
  let worst = 0; let prev = legFoot(0, base, st);
  for (let k = 1; k <= 1200; k++) { const f = legFoot(k / 1200, base, st); worst = Math.max(worst, Math.abs(f.x - prev.x), Math.abs(f.y - prev.y)); prev = f; }
  assert.ok(worst < 0.06, `worst jump ${worst}`);
  const a = legFoot(0.37, base); const b = legFoot(1.37, base);
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9);
});

test('a planted foot does not slide on the ground', () => {
  const st = legSchedule(base); let checked = 0;
  for (let k = 0; k < 800; k++) { const u = k / 800; const a = legFoot(u, base, st); const b = legFoot(u + 0.0005, base, st); if (a.stance && b.stance && a.i === b.i) { const world = (f, uu) => f.x + base.D * uu; assert.ok(Math.abs(world(a, u) - world(b, u + 0.0005)) < 1e-6); checked++; } }
  assert.ok(checked > 400);
});

test('each leg of a spider takes its own steps, not one shared pattern', () => {
  const legs = ['FR', 'FL', 'AR', 'AL', 'BR', 'BL', 'HR', 'HL'];
  const p = { ...DEFAULTS, dogSpecies: 'spider', dogStride: 0.7, dogDuty: 0.72, dogLift: 0.22 };
  const liftoffs = Object.fromEntries(legs.map((l) => [l, []]));
  let prev = poseCrawler(p, {}, 0).legs;
  for (let k = 1; k <= 480; k++) { const z = poseCrawler(p, {}, k / 480).legs; for (const l of legs) if (prev[l].stance && !z[l].stance) liftoffs[l].push(k / 480); prev = z; }
  const times = legs.map((l) => liftoffs[l][0]);
  assert.ok(new Set(times.map((x) => x.toFixed(2))).size >= 6, `lift-off times ${times}`);
  const gaps = legs.flatMap((l) => liftoffs[l].slice(1).map((t, i) => t - liftoffs[l][i]));
  assert.ok(Math.max(...gaps) - Math.min(...gaps) > 0.03, 'the steps of a leg are of different lengths of time');
});

test('a spider is never left on fewer than three feet, and the same frame gives the same pose', () => {
  for (const dogLegVariety of [0, 0.6, 1]) {
    const p = { ...DEFAULTS, dogSpecies: 'spider', dogStride: 0.7, dogDuty: 0.72, dogLift: 0.22, dogLegVariety };
    let fewest = 8;
    for (let k = 0; k < 600; k++) { const z = poseCrawler(p, {}, k / 600).legs; fewest = Math.min(fewest, Object.values(z).filter((l) => l.stance).length); }
    assert.ok(fewest >= 3, `variety ${dogLegVariety}: only ${fewest} feet down`);
  }
  const p = { ...DEFAULTS, dogSpecies: 'spider' };
  assert.deepEqual(poseCrawler(p, {}, 0.31).legs.FR.paw, poseCrawler(p, {}, 0.31).legs.FR.paw);
});

test('the Leg independence setting makes the legs more alike at 0 and looser at 1', () => {
  const spread = (v) => { const p = { ...DEFAULTS, dogSpecies: 'spider', dogLegVariety: v, dogStride: 0.7, dogDuty: 0.72, dogLift: 0.22 }; const t = []; for (let k = 0; k < 400; k++) { const z = poseCrawler(p, {}, k / 400).legs; t.push(z.FR.paw[1] - z.AR.paw[1]); } return Math.max(...t) - Math.min(...t); };
  assert.ok(spread(1) > spread(0) + 0.01);
});

test('stepsFor gives more steps to a longer stride, but always at least one', () => {
  assert.ok(stepsFor(0.3, 0.7, 0.75) >= 1);
  assert.ok(stepsFor(2, 0.7, 0.75) > stepsFor(0.4, 0.7, 0.75));
  assert.ok(hash01(1, 2, 3) >= 0 && hash01(1, 2, 3) < 1);
});
