import test from 'node:test';
import assert from 'node:assert/strict';
import { laneValue } from '../src/automation.js';
import { copySpan, pasteSpan, shiftLane, loopSpan, mirrorTarget } from '../src/lanes.js';

const L = (pts, interp = 'linear') => ({ interp, pts: pts.map(([t, v]) => ({ t, v })) });

test('copy and paste a span puts the same shape somewhere else, replacing what was there', () => {
  const lane = L([[0, 0], [10, 1], [20, 0], [40, 5], [50, 5]]);
  const clip = copySpan(lane, 0, 20);
  assert.equal(clip.len, 20);
  const out = pasteSpan(lane, clip, 30, 100);
  assert.equal(laneValue(out, 40, 0), 1, 'the peak lands 10 frames after the paste point');
  assert.equal(laneValue(out, 30, 0), 0); assert.equal(laneValue(out, 50, 0), 0);
  assert.equal(laneValue(lane, 40, 0), 5, 'the original is not changed');
  const edge = pasteSpan(L([[0, 0]]), copySpan(lane, 5, 15), 0, 100);
  assert.ok(Math.abs(laneValue(edge, 0, 9) - 0.5) < 1e-9, 'the value at the start edge is kept exactly');
  assert.ok(Math.abs(laneValue(edge, 5, 9) - 1) < 1e-9, 'and the peak inside');
});

test('a span pasted near the end is cut at the end, not past it', () => {
  const lane = L([[0, 0], [10, 1], [20, 0]]);
  const out = pasteSpan(lane, copySpan(lane, 0, 20), 90, 100);
  assert.ok(out.pts.every((q) => q.t <= 99));
});

test('copying a span with no automation, or a zero-length span, gives nothing', () => {
  assert.equal(copySpan(null, 0, 10), null);
  assert.equal(copySpan(L([[0, 0], [5, 1]]), 3, 3), null);
});

test('shift moves every point and drops those pushed off the ends', () => {
  const lane = L([[0, 1], [10, 2], [20, 3]]);
  assert.deepEqual(shiftLane(lane, 5, 100).pts.map((q) => q.t), [5, 15, 25]);
  assert.deepEqual(shiftLane(lane, -5, 100).pts.map((q) => q.t), [5, 15]);
  assert.ok(shiftLane(lane, 500, 100).pts.length >= 1, 'a lane is never emptied by a shift');
});

test('loop repeats a span end to end until the end of the performance', () => {
  const lane = L([[0, 0], [5, 1], [10, 0]]);
  const out = loopSpan(lane, 0, 10, 49, 60);
  for (const t of [5, 15, 25, 35, 45]) assert.ok(Math.abs(laneValue(out, t, 0) - 1) < 1e-9, `peak at ${t}`);
  for (const t of [10, 20, 30, 40]) assert.ok(Math.abs(laneValue(out, t, 0)) < 1e-9, `trough at ${t}`);
});

test('mirror target swaps the side of a left and right channel only', () => {
  assert.equal(mirrorTarget('c:arm.pitch.R:offset'), 'c:arm.pitch.L:offset');
  assert.equal(mirrorTarget('c:dog.ear.flop.L:amount'), 'c:dog.ear.flop.R:amount');
  assert.equal(mirrorTarget('c:pelvis.y:offset'), null);
  assert.equal(mirrorTarget('p:stepLength'), null);
});
