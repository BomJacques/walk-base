import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, foot, sideGait, gaitSummary, supportStats } from '../src/rig.js';
import { pose3 } from '../src/rig3.js';
import { CONTROLS, PRESETS, DEFAULT_OF } from '../src/controls.js';
import { integrate } from '../src/automation.js';

const P = (over = {}) => ({ ...DEFAULTS, proportions: {}, motion: {}, ...over });

test('the new gait controls exist, are human, and start at the rig defaults', () => {
  for (const id of ['heelDown', 'heelUp', 'liftPeak', 'swingReach', 'asymTiming', 'asymDuty', 'asymLift', 'asymArm']) {
    const c = CONTROLS.find((x) => x.id === id && x.scope === 'p');
    assert.ok(c, id); assert.equal(c.tab, 'Gait');
    assert.ok(DEFAULT_OF(c) >= c.min && DEFAULT_OF(c) <= c.max, `${id} default is inside its range`);
  }
});

test('the defaults still make the same walk as before', () => {
  // The old foot path had these numbers built in.
  const p = P(); const d = p.stepLength * p.duty;
  const f = foot(0.7, p, d);
  const old = (() => { // the swing, written out the way it used to be
    const k = (0.7 - p.duty) / (1 - p.duty);
    return Math.pow(Math.sin(Math.PI * Math.pow(k, 0.8)), 1.3) * p.footLift;
  })();
  const flat = foot(0.7, { ...p, footLift: 0 }, d);
  assert.ok(Math.abs((f.y - flat.y) - old) < 5e-4, 'foot height unchanged (the peak is now a round 0.42 instead of an exponent of 0.8)');
});

test('the foot is highest where liftPeak says', () => {
  for (const peak of [0.3, 0.42, 0.6]) {
    const p = P({ liftPeak: peak, footLift: 0.3, duty: 0.6 }); const d = p.stepLength * p.duty;
    let best = 0; let bestK = 0;
    for (let i = 1; i < 200; i++) { const k = i / 200; const f = foot(p.duty + k * (1 - p.duty), { ...p, footLift: 0 }, d); const g = foot(p.duty + k * (1 - p.duty), p, d); const lift = g.y - f.y; if (lift > best) { best = lift; bestK = k; } }
    assert.ok(Math.abs(bestK - peak) < 0.03, `peak ${peak} found at ${bestK}`);
  }
});

test('heelDown and heelUp move the foot roll', () => {
  const d = 0.4;
  const quick = foot(0.6 * 0.1, P({ heelDown: 0.06 }), d).theta; const slow = foot(0.6 * 0.1, P({ heelDown: 0.3 }), d).theta;
  assert.ok(quick < slow, 'a short heel-down is already flat while a long one is still toe up');
  const early = foot(0.6 * 0.6, P({ heelUp: 0.4 }), d).theta; const late = foot(0.6 * 0.6, P({ heelUp: 0.8 }), d).theta;
  assert.ok(early < late - 0.05 || early < 0, 'an early heel lift is further into the toe-off');
});

test('the far foot follows its own timing and time on the ground', () => {
  const a = sideGait(P(), 'L'); assert.equal(a.off, 0.5); assert.equal(a.p.duty, 0.6);
  const b = sideGait(P({ asymTiming: 0.05, asymDuty: -0.1, asymLift: -0.5 }), 'L');
  assert.ok(Math.abs(b.off - 0.55) < 1e-9);
  assert.ok(Math.abs(b.p.duty - 0.5) < 1e-9, 'the far foot can stay down for less time');
  assert.equal(sideGait(P({ asymDuty: -0.5 }), 'L').p.duty, 0.25, 'time on the ground stops at a quarter of the cycle');
  assert.ok(Math.abs(b.p.footLift - DEFAULTS.footLift * 0.5) < 1e-9);
  assert.equal(sideGait(P({ asymDuty: 0.1 }), 'R').off, 0, 'the near foot never changes');
});

test('an uneven walk keeps both feet planted: no sliding', () => {
  const p = P({ asymTiming: 0.06, asymDuty: -0.08, asymLift: 0.3, stepLength: 0.8 });
  const world = (side, u) => { const pz = pose3(p, {}, u); return pz.sides[side].ankle[0] + u * 2 * p.stepLength; };
  for (const side of ['R', 'L']) {
    const g = sideGait(p, side); let drift = 0; let n = 0;
    for (let i = 0; i < 400; i++) {
      const u = i / 400; const w = ((u - g.off) % 1 + 1) % 1;
      if (w > 0.25 * g.p.duty && w < 0.5 * g.p.duty) { const a = world(side, u); const b = world(side, u + 0.002); drift = Math.max(drift, Math.abs(b - a)); n++; }
    }
    assert.ok(n > 5 && drift < 0.002, `${side} drift ${drift}`);
  }
});

test('the far arm swing scales on its own', () => {
  const same = pose3(P(), {}, 0.2); const less = pose3(P({ asymArm: -0.5 }), {}, 0.2);
  assert.equal(same.sides.R.wrist[0], less.sides.R.wrist[0], 'the near arm is untouched');
  assert.notEqual(same.sides.L.wrist[0], less.sides.L.wrist[0]);
});

test('the gait summary reads sensibly', () => {
  const g = gaitSummary(P());
  assert.ok(Math.abs(g.doubleSupport - 0.2) < 0.01, `double support ${g.doubleSupport}`);
  assert.equal(g.flight, 0);
  assert.ok(Math.abs(g.stepsPerMin - 120) < 1e-6 && Math.abs(g.stride - 1.56) < 1e-9);
  assert.ok(Math.abs(g.stepRatio - 1) < 1e-9);
  const limp = gaitSummary(P({ asymTiming: 0.06 })); assert.ok(limp.stepRatio > 1.2);
  const sup = supportStats([{ start: 0, duty: 0.3 }, { start: 0.5, duty: 0.3 }]);
  assert.ok(Math.abs(sup.flight - 0.4) < 0.01 && Math.abs(sup.mean - 0.6) < 0.01);
});

test('integrate plants the far foot at its own time', () => {
  const contact = (p, side) => ({ x: side === 'R' ? 0 : 0.1 });
  const r = integrate(P({ asymTiming: 0.1 }), {}, 48, 24, contact);
  const near = r.plants.filter((q) => q.side === 'R'); const far = r.plants.filter((q) => q.side === 'L');
  assert.ok(near.length >= 2 && far.length >= 2);
  assert.ok(far[0].t > 24 * 0.5 + 1, `the far foot lands after the half cycle (frame ${far[0].t})`);
});

test('every new preset is complete and in range', () => {
  for (const name of ['Limp', 'Shuffle', 'March', 'Stomp', 'Sneak', 'Strut', 'Waddle']) {
    const pr = PRESETS[name]; assert.ok(pr, name);
    for (const [k, v] of Object.entries(pr)) { const c = CONTROLS.find((x) => x.id === k && x.scope === 'p'); assert.ok(c, `${name}.${k} is a control`); assert.ok(v >= c.min - 1e-9 && v <= c.max + 1e-9, `${name}.${k}=${v} within ${c.min}..${c.max}`); }
    // a walk that never loses a foot
    for (let i = 0; i < 96; i++) { const z = pose3(P(pr), {}, i / 96); assert.ok(z.sides.R.reached && z.sides.L.reached, `${name} loses a foot at ${i}/96`); }
  }
});
