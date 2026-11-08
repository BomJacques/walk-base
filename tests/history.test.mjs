import test from 'node:test';
import assert from 'node:assert/strict';
import { History } from '../src/history.js';

test('undo and redo walk back and forward through changes', () => {
  const h = new History({ gap: 0 });
  h.reset('a');
  h.record('b', 1000); h.record('c', 2000); h.record('d', 3000);
  assert.equal(h.current, 'd'); assert.ok(h.canUndo && !h.canRedo);
  assert.equal(h.undo(), 'c'); assert.equal(h.undo(), 'b'); assert.equal(h.undo(), 'a'); assert.equal(h.undo(), null);
  assert.ok(!h.canUndo && h.canRedo);
  assert.equal(h.redo(), 'b'); assert.equal(h.redo(), 'c');
});

test('a change made after undoing discards the redo steps', () => {
  const h = new History({ gap: 0 });
  h.reset('a'); h.record('b', 1); h.record('c', 2);
  h.undo();
  h.record('x', 3);
  assert.ok(!h.canRedo); assert.equal(h.current, 'x');
  assert.equal(h.undo(), 'b');
});

test('changes in quick succession fold into one step, so a slider drag is one undo', () => {
  const h = new History({ gap: 500 });
  h.reset('start');
  for (let i = 1; i <= 30; i++) h.record(`v${i}`, 1000 + i * 10);
  assert.equal(h.current, 'v30');
  assert.equal(h.undo(), 'start', 'one undo returns to before the drag');
  h.redo();
  h.record('later', 5000);
  assert.equal(h.undo(), 'v30', 'a change after a pause is a new step');
});

test('the same state is not recorded twice, and the history is capped', () => {
  const h = new History({ limit: 5, gap: 0 });
  h.reset('s0');
  assert.equal(h.record('s0', 1), false);
  for (let i = 1; i <= 20; i++) h.record(`s${i}`, i * 10);
  assert.ok(h.stack.length <= 5);
  assert.equal(h.current, 's20');
  let n = 0; while (h.undo() != null) n++;
  assert.equal(n, 4);
});

test('settle updates the current step without adding one', () => {
  const h = new History({ gap: 0 });
  h.reset('a'); h.record('b', 1);
  h.undo();
  h.settle('a2');
  assert.equal(h.current, 'a2'); assert.ok(h.canRedo && !h.canUndo);
});
