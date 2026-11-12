import test from 'node:test';
import assert from 'node:assert/strict';
import { turned, snapTurn, spin, holdPoint } from '../src/viewrot.js';

const deg = (d) => (d * Math.PI) / 180;
test('a twist is the shortest turn between two angles, across the half turn too', () => {
  assert.ok(Math.abs(turned(deg(10), deg(40)) - deg(30)) < 1e-12);
  assert.ok(Math.abs(turned(deg(170), deg(-170)) - deg(20)) < 1e-12, 'the short way round');
  assert.ok(Math.abs(turned(deg(-170), deg(170)) + deg(20)) < 1e-12);
  assert.equal(turned(1, 1), 0);
});
test('a turn that is nearly square snaps to square, and any other is left alone', () => {
  assert.equal(snapTurn(deg(1.5)), 0); assert.ok(Math.abs(snapTurn(deg(88.5)) - deg(90)) < 1e-12); assert.ok(Math.abs(snapTurn(deg(-91)) + deg(90)) < 1e-12);
  assert.ok(Math.abs(snapTurn(deg(45)) - deg(45)) < 1e-12); assert.ok(Math.abs(snapTurn(deg(10)) - deg(10)) < 1e-12);
  assert.ok(Math.abs(snapTurn(deg(370)) - deg(10)) < 1e-9, 'kept between a half turn either way');
});
test('turning points about a centre, and back again', () => {
  const [x, y] = spin(3, 1, 1, 1, deg(90)); assert.ok(Math.abs(x - 1) < 1e-12 && Math.abs(y - 3) < 1e-12);
  const [a, b] = spin(...spin(5, -2, 1, 4, 0.7), 1, 4, -0.7); assert.ok(Math.abs(a - 5) < 1e-12 && Math.abs(b + 2) < 1e-12);
});
test('the point between the fingers stays put while the page turns: the page is moved to make up for it', () => {
  const C = [200, 150]; const M = [300, 120]; const d = deg(35);
  // a spot of the picture under the fingers at the start
  const rel = [M[0] - C[0], M[1] - C[1]];
  const [kx, ky] = holdPoint(M[0], M[1], C[0], C[1], d);
  const c2 = [C[0] + kx, C[1] + ky]; // the page's middle, after the move
  const where = spin(c2[0] + rel[0], c2[1] + rel[1], c2[0], c2[1], d); // that spot, with the page turned about its new middle
  assert.ok(Math.abs(where[0] - M[0]) < 1e-9 && Math.abs(where[1] - M[1]) < 1e-9, where);
  assert.deepEqual(holdPoint(C[0], C[1], C[0], C[1], d).map((v) => Math.abs(v) < 1e-12), [true, true], 'turning about the middle itself moves nothing');
});
