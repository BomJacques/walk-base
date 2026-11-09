import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { integrate, targetOfParam, parseTarget } from '../src/automation.js';
import { clipsFor, applyClip, CLIP_GROUPS } from '../src/clips.js';
import { CONTROLS } from '../src/controls.js';

const base = { ...DEFAULTS };

test('heading is a gait setting that can be automated', () => {
  const c = CONTROLS.find((x) => x.id === 'heading'); assert.ok(c); assert.equal(c.min, -180); assert.equal(c.max, 180);
  assert.deepEqual(parseTarget(targetOfParam('heading')), { kind: 'param', id: 'heading' });
  assert.equal(DEFAULTS.heading, 0);
});

test('with no heading the path runs straight along the stage', () => {
  const s = integrate(base, {}, 48, 24);
  assert.equal(s.path, false);
  assert.ok(Math.abs(s.px[48] - s.x[48]) < 1e-9 && Math.abs(s.pz[48]) < 1e-12);
});

test('a heading turns the path, and the distance walked is the same', () => {
  const s = integrate({ ...base, heading: 90 }, {}, 48, 24);
  assert.equal(s.path, true);
  assert.ok(Math.abs(s.px[48]) < 1e-9 && Math.abs(s.pz[48] - s.x[48]) < 1e-9, 'it walks toward the viewer');
  const t = integrate({ ...base, heading: 45 }, {}, 48, 24);
  assert.ok(Math.abs(Math.hypot(t.px[48], t.pz[48]) - t.x[48]) < 1e-9);
});

test('a heading that changes along the way bends the path into a corner', () => {
  const lanes = { 'p:heading': { interp: 'linear', pts: [{ t: 0, v: 0 }, { t: 24, v: 0 }, { t: 36, v: 90 }, { t: 96, v: 90 }] } };
  const s = integrate(base, lanes, 96, 24);
  assert.ok(s.px[24] > 0.5 && Math.abs(s.pz[24]) < 1e-9, 'straight to begin with');
  assert.ok(s.pz[96] > 1.5 && s.px[96] > s.px[24], 'then round the corner and away');
  for (let t = 1; t <= 96; t++) assert.ok(Math.hypot(s.px[t] - s.px[t - 1], s.pz[t] - s.pz[t - 1]) <= s.x[t] - s.x[t - 1] + 1e-9, 'no step is longer than the walking');
});

test('Turn right, Turn left, U-turn, Walk a curve and Face straight on change the heading and keep the pace', () => {
  const find = (id) => clipsFor('human').find((c) => c.id === id);
  for (const [id, deg] of [['turnright', 90], ['turnleft', -90], ['uturn', 180], ['curve', 45]]) {
    const c = find(id); assert.ok(c, id);
    const lane = c.build(base, c.frames)['p:heading']; assert.ok(lane, id);
    assert.equal(lane[0].v, 0); assert.ok(Math.abs(lane[lane.length - 1].v - deg) < 1e-9, `${id} ends at ${deg}`);
    assert.ok(Object.keys(c.build(base, c.frames)).includes('cadence'), `${id} eases the pace`);
  }
  const back = find('straighten').build({ ...base, heading: 270 }, 36)['p:heading'];
  assert.ok(Math.abs(back[back.length - 1].v - 360) < 1e-9, 'from 270 the shorter way to straight is on round to 360');
  const lanes = applyClip({}, find('turnright'), base, 24, 36);
  assert.ok(lanes['p:heading']);
  assert.ok(CLIP_GROUPS[0][1].includes('turnright') && CLIP_GROUPS[0][1].includes('uturn'));
  assert.ok(clipsFor('dog').some((c) => c.id === 'turnright'), 'the dog turns too');
});
