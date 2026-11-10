import test from 'node:test';
import assert from 'node:assert/strict';
import { CONTROLS, BODY_LAYOUT, rigOf } from '../src/controls.js';

const body = CONTROLS.filter((c) => c.tab === 'Gait' && c.scope === 'p');
const groupOf = (id) => body.find((c) => c.id === id)?.group;

test('everything about one part of the body is in one group', () => {
  for (const id of ['armSwing', 'asymArm', 'armCarry', 'armOut', 'armLag', 'elbowBase', 'elbowSwing', 'shoulderCounter']) assert.equal(groupOf(id), 'Shoulders and arms', id);
  for (const id of ['headBob', 'headKeep', 'headTilt', 'headTurn', 'headNod']) assert.equal(groupOf(id), 'Head', id);
  for (const id of ['stepLength', 'stepWidth', 'toeOut']) assert.equal(groupOf(id), 'Stride', id);
  for (const id of ['bob', 'downPhase', 'weight']) assert.equal(groupOf(id), 'Bounce and weight', id);
  for (const id of ['footLift', 'liftPeak', 'heelDown', 'heelUp', 'toeOff']) assert.equal(groupOf(id), 'Feet', id);
  for (const id of ['hoseFollow', 'hoseStretch', 'hoseWobble', 'hoseWobbleRate']) assert.equal(groupOf(id), 'Rubber hose', id);
});

test('every walk and body setting of the two-legged figures has a place, once, and no group is split in two', () => {
  const placed = BODY_LAYOUT.flatMap(([, , ids]) => ids); assert.equal(new Set(placed).size, placed.length, 'no setting is listed twice');
  for (const c of body.filter((x) => rigOf(x) !== 'dog')) assert.ok(placed.includes(c.id), `${c.id} (${c.label}) has a place in the layout`);
  for (const id of placed) assert.ok(body.some((c) => c.id === id), `${id} is a real setting`);
  const runs = []; for (const c of body.filter((x) => rigOf(x) !== 'dog')) if (runs[runs.length - 1] !== c.group) runs.push(c.group);
  assert.equal(new Set(runs).size, runs.length, `no group is split in two: ${runs.join(' | ')}`);
  assert.deepEqual(body.filter((c) => placed.includes(c.id)).map((c) => c.id), placed, 'in the order of the layout');
  for (const [area, group, ids] of BODY_LAYOUT) for (const id of ids) assert.equal(body.find((c) => c.id === id).area, area, `${group}/${id}`);
});
