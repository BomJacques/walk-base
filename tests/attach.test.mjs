import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS } from '../src/rig.js';
import { pose3, len, sub } from '../src/rig3.js';
import { poseDog } from '../src/dog3.js';
import { PRESETS_DOG } from '../src/controls.js';
import {
  attachTargets, partBone, partRadius, edgePoint, nearestEdgeT, newItem, anchorLocal, mirroredItem, itemFrame, itemPlace, toScreen, toLocal,
  hitItem, itemHandles, pickHandle, placeItems, cloneItem, targetKey,
} from '../src/attach.js';

// a side-on orthographic camera: world x to the right, y up
const cam = { scale: 500, k: 1, p: (pt) => ({ x: 640 + pt[0] * 500, y: 700 - pt[1] * 500, d: pt[2] }) };
const human = (u, motion = {}) => pose3({ ...DEFAULTS }, motion, u);
const dog = (u, p = {}) => poseDog({ ...DEFAULTS, rig: 'dog', ...p }, {}, u);
const sample = Array.from({ length: 12 }, (_, i) => i / 12);

test('every place an attachment can go has a real bone in every pose, for both figures', () => {
  for (const [rig, pose] of [['human', human], ['dog', dog]]) {
    const targets = attachTargets(rig);
    assert.ok(targets.length >= 14, `${rig} has ${targets.length} places`);
    assert.equal(new Set(targets.map((t) => t.key)).size, targets.length, 'keys are unique');
    for (const t of targets) for (const u of sample) {
      const b = partBone(pose(u), t.part, t.seg, t.side);
      assert.ok(b, `${rig} ${t.key}`);
      assert.ok(b.flat().every(Number.isFinite), `${rig} ${t.key} finite`);
      assert.ok(len(sub(b[1], b[0])) > 1e-4, `${rig} ${t.key} has length`);
      assert.ok(partRadius(pose(u), t.part, t.seg) > 0);
    }
  }
  assert.equal(partBone(human(0), 'arm', null, null), null, 'a sided part needs a side');
  assert.equal(targetKey({ part: 'leg', seg: 1, side: 'L' }), 'leg:1/L');
});

test('the edge of a part is a capsule round its bone, and a point on it can be found again', () => {
  const L = 0.3; const r = 0.05;
  for (let i = 0; i < 40; i++) {
    const t = i / 40; const p = edgePoint(L, r, t);
    const cx = Math.min(L, Math.max(0, p.x));
    assert.ok(Math.abs(Math.hypot(p.x - cx, p.y) - r) < 1e-9, `on the edge at ${t}`);
    assert.ok(Math.abs(Math.hypot(p.nx, p.ny) - 1) < 1e-9, 'unit normal');
    const back = nearestEdgeT(L, r, p.x + p.nx * 0.002, p.y + p.ny * 0.002);
    const d = Math.abs(back - t); assert.ok(Math.min(d, 1 - d) < 0.006, `found ${t} again as ${back}`);
  }
  const a = edgePoint(L, r, 0); const b = edgePoint(L, r, 0.999999);
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) < 1e-3, 'the edge closes');
});

test('screen and part coordinates convert both ways', () => {
  const pz = human(0.3); const it = newItem('ellipse', { part: 'forearm', side: 'R' });
  const f = itemFrame(pz, cam, it);
  for (const [x, y] of [[0, 0], [0.2, -0.1], [-0.05, 0.3]]) { const s = toScreen(f, x, y); const l = toLocal(f, s.x, s.y); assert.ok(Math.abs(l.x - x) < 1e-9 && Math.abs(l.y - y) < 1e-9); }
});

test('an attachment keeps its place on the part through the whole cycle, and follows the part\'s motion', () => {
  for (const [rig, pose, part, side] of [['human', human, 'forearm', 'R'], ['dog', dog, 'dog.hleg', 'R'], ['dog', dog, 'dog.tail2', null]]) {
    const it = newItem('rect', { part, side, seg: 0 }, { anchor: { mode: 'boundary', t: 0.3, off: 0, x: 0, y: 0 }, x: 0.04, y: -0.03 });
    const rels = []; const starts = [];
    for (const u of sample) {
      const pz = pose(u); const f = itemFrame(pz, cam, it); const pl = itemPlace(it, f, cam);
      const l = toLocal(f, pl.c.x, pl.c.y);
      rels.push([l.x, l.y]); starts.push([f.ox, f.oy]);
      // the centre is the anchor plus the offset, always
      const a = anchorLocal(it, f.L, f.r);
      assert.ok(Math.abs(l.x - (a.x + it.x)) < 1e-9 && Math.abs(l.y - (a.y + it.y)) < 1e-9, `${rig} ${part} in its frame`);
    }
    const xs = starts.map((s) => s[0]); assert.ok(Math.max(...xs) - Math.min(...xs) > 1, `${part} moves on the screen, so its attachment does`);
  }
  // the part's own channels carry the attachment: doubling the elbow bend moves a forearm attachment
  const it = newItem('ellipse', { part: 'forearm', side: 'R' });
  const centre = (motion) => { const pz = human(0.1, motion); const f = itemFrame(pz, cam, it); return itemPlace(it, f, cam).c; };
  const a = centre({}); const b = centre({ 'elbow.flex.R': { amount: 3 } });
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 3, 'a bigger elbow bend moves the forearm attachment');
  const c = centre({ 'arm.pitch.R': { offset: 0.5 } });
  assert.ok(Math.hypot(a.x - c.x, a.y - c.y) > 3, 'and so does swinging the upper arm');
});

test('the attachment is in the figure\'s units, so a larger camera scale makes it larger on screen and nothing else changes', () => {
  const it = newItem('rect', { part: 'neck', side: null });
  const pz = human(0.2);
  const big = { ...cam, scale: 1000, p: (pt) => ({ x: 640 + pt[0] * 1000, y: 700 - pt[1] * 1000, d: pt[2] }) };
  const f1 = itemFrame(pz, cam, it); const f2 = itemFrame(pz, big, it);
  assert.ok(Math.abs(itemPlace(it, f2, big).k / itemPlace(it, f1, cam).k - 2) < 1e-9);
  assert.ok(Math.abs(f1.ang - f2.ang) < 1e-9);
});

test('hit testing finds shapes, respects turning and scaling, and gives thin lines some room', () => {
  const pz = human(0.2);
  const it = newItem('rect', { part: 'spine.upper', side: null }, { w: 0.2, h: 0.1, rot: 0 });
  const f = itemFrame(pz, cam, it); const pl = itemPlace(it, f, cam);
  assert.ok(hitItem(it, f, cam, pl.c.x, pl.c.y));
  assert.ok(!hitItem(it, f, cam, pl.c.x + 400, pl.c.y));
  const turned = { ...it, rot: 90 }; const pl2 = itemPlace(turned, f, cam);
  // a point 0.08 along the bone: inside the long side of the unturned box, beyond the short side once it is turned a quarter
  assert.ok(hitItem(it, f, cam, pl.c.x + f.cos * 0.08 * pl.k, pl.c.y + f.sin * 0.08 * pl.k), 'inside the long side');
  assert.ok(!hitItem(turned, f, cam, pl2.c.x + f.cos * 0.08 * pl2.k, pl2.c.y + f.sin * 0.08 * pl2.k), 'beyond the short side once turned');
  // 0.25 figure units along the item's length: outside the box at scale 1, inside once the box is three times the size
  const wide = { ...it, scale: 3 }; const pw = itemPlace(wide, f, cam); const p1 = itemPlace(it, f, cam);
  assert.ok(!hitItem(it, f, cam, p1.c.x + p1.cos * 0.25 * cam.scale, p1.c.y + p1.sin * 0.25 * cam.scale), 'outside at scale 1');
  assert.ok(hitItem(wide, f, cam, pw.c.x + pw.cos * 0.25 * cam.scale, pw.c.y + pw.sin * 0.25 * cam.scale), 'inside once scaled up');
  const ell = newItem('ellipse', { part: 'spine.upper', side: null }, { w: 0.2, h: 0.2 });
  const e = itemPlace(ell, f, cam);
  assert.ok(!hitItem(ell, f, cam, e.c.x + 0.095 * e.k * Math.cos(Math.PI / 4) * 1.2 + e.cos * 0, e.c.y - 0.095 * e.k * 1.2, null, 0), 'the corner of an ellipse is outside it');
  const line = newItem('line', { part: 'spine.upper', side: null }, { w: 0.3 });
  const lp = itemPlace(line, f, cam);
  assert.ok(hitItem(line, f, cam, lp.c.x + lp.sin * 0, lp.c.y + 4), 'a few pixels from a line still hits');
  assert.ok(!hitItem(line, f, cam, lp.c.x - lp.sin * 40, lp.c.y + lp.cos * 40), 'forty pixels away does not');
});

test('handles: the anchor, centre, rotate and scale handles are found, and the anchor wins an overlap', () => {
  const pz = human(0.2);
  const it = newItem('rect', { part: 'forearm', side: 'R' }, { x: 0, y: 0, w: 0.15, h: 0.1 });
  const f = itemFrame(pz, cam, it); const hs = itemHandles(it, f, cam);
  for (const k of ['anchor', 'center', 'rotate', 'scale']) assert.ok(Number.isFinite(hs[k].x) && Number.isFinite(hs[k].y), k);
  assert.equal(pickHandle(hs, hs.rotate.x + 3, hs.rotate.y - 3), 'rotate');
  assert.equal(pickHandle(hs, hs.scale.x, hs.scale.y), 'scale');
  assert.equal(pickHandle(hs, hs.anchor.x, hs.anchor.y), 'anchor', 'the anchor sits on the centre when the offset is zero, and is chosen');
  assert.equal(pickHandle(hs, -500, -500), null);
  const off = { ...it, x: 0.1, y: 0.05 }; const h2 = itemHandles(off, f, cam);
  assert.equal(pickHandle(h2, h2.center.x, h2.center.y), 'center');
});

test('mirroring puts a copy on the other side, flipped across the bone', () => {
  const it = newItem('triangle', { part: 'forearm', side: 'R' }, { anchor: { mode: 'boundary', t: 0.2, off: 0.01, x: 0, y: 0 }, x: 0.03, y: -0.04, rot: 20 });
  const pz = human(0.2); const f = itemFrame(pz, cam, it);
  const m = mirroredItem(it, f.L, f.r);
  assert.equal(m.side, 'L'); assert.equal(m.flip, true); assert.equal(m.rot, -20); assert.equal(m.y, 0.04); assert.notEqual(m.id, it.id);
  const a = anchorLocal(it, f.L, f.r); const b = anchorLocal(m, f.L, f.r);
  assert.ok(Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y + b.y) < 0.01, `anchor mirrored across the bone: ${JSON.stringify([a, b])}`);
  const back = mirroredItem(m, f.L, f.r);
  assert.equal(back.side, 'R'); assert.equal(back.flip, false); assert.equal(back.rot, 20);
  const free = newItem('ellipse', { part: 'head', side: null }, { anchor: { mode: 'free', t: 0, off: 0, x: 0.05, y: 0.02 } });
  assert.equal(mirroredItem(free, f.L, f.r).anchor.y, -0.02);
});

test('placing items skips hidden ones and parts the figure does not have, and a copy gets its own id', () => {
  const pz = dog(0.2, PRESETS_DOG.Walk);
  const items = [newItem('rect', { part: 'dog.head' }), newItem('rect', { part: 'dog.ear', side: null }), { ...newItem('rect', { part: 'dog.neck' }), visible: false }, newItem('rect', { part: 'dog.hleg', seg: 1, side: 'L' })];
  const placed = placeItems(items, pz, cam);
  assert.equal(placed.length, 2);
  assert.ok(placed.every((p) => p.f.role === 'body' || p.f.role === 'far' || p.f.role === 'near'));
  assert.notEqual(cloneItem(items[0]).id, items[0].id);
  assert.equal(placed.find((p) => p.it.part === 'dog.hleg').f.role, 'far');
});
