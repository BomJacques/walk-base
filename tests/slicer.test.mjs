import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectCuts, dragCut, splitCut, mergeCuts, clampCut, tightenCut, numberCuts, floodSelect, fillPolygon, brushLine, paperAlpha, alphaBounds,
  registrationOffsets, components, removeSpecks, runs, paperLevel, inkMask, minChannel,
} from '../src/slicer.js';

// A deterministic scan: off-white paper with grain, drawings as thick stroked figures.
let seed = 7;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
function sheet(W, H, draw, { paper = 238, grain = 6 } = {}) {
  const c = new Uint8Array(W * H);
  for (let i = 0; i < c.length; i++) c[i] = paper - Math.floor(rnd() * grain);
  const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < W && y < H) c[y * W + x] = Math.min(c[y * W + x], v); };
  const api = {
    rect: (x, y, w, h, v = 40) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, v); },
    line: (x0, y0, x1, y1, t = 3, v = 40) => { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let s = 0; s <= n; s++) { const x = x0 + ((x1 - x0) * s) / n; const y = y0 + ((y1 - y0) * s) / n; for (let a = -t; a <= t; a++) for (let b = -t; b <= t; b++) if (a * a + b * b <= t * t) put(Math.round(x + a), Math.round(y + b), v); } },
    dot: (x, y, r, v = 40) => { for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) if (a * a + b * b <= r * r) put(x + a, y + b, v); },
    /** A simple walking figure: head, body, two legs and an arm, spread by phase. */
    figure: (cx, base, ph, v = 40) => {
      api.dot(cx, base - 150, 14, v); api.line(cx, base - 135, cx, base - 70, 3, v);
      api.line(cx, base - 70, cx + ph, base, 3, v); api.line(cx, base - 70, cx - ph, base, 3, v);
      api.line(cx, base - 120, cx - ph * 0.6, base - 80, 3, v);
    },
  };
  draw(api);
  return { c, W, H };
}
const overlap = (cut, x, y, w, h) => { const ix = Math.max(0, Math.min(cut.x + cut.w, x + w) - Math.max(cut.x, x)); const iy = Math.max(0, Math.min(cut.y + cut.h, y + h) - Math.max(cut.y, y)); return (ix * iy) / (w * h); };

test('a row of eight drawings is found in order', () => {
  const { c, W, H } = sheet(1600, 300, (a) => { for (let i = 0; i < 8; i++) a.figure(100 + i * 190, 260, 10 + i * 6); });
  const cuts = detectCuts(c, W, H);
  assert.equal(cuts.length, 8);
  cuts.forEach((k, i) => { const cx = k.x + k.w / 2; assert.ok(Math.abs(cx - (100 + i * 190)) < 40, `cut ${i} centre ${cx}`); assert.ok(k.y < 120 && k.y + k.h > 255, `cut ${i} spans the figure`); if (i) assert.ok(k.x > cuts[i - 1].x); });
});

test('two rows read left to right, top to bottom', () => {
  const { c, W, H } = sheet(1400, 640, (a) => { for (let i = 0; i < 4; i++) a.figure(150 + i * 300, 260, 24); for (let i = 0; i < 3; i++) a.figure(300 + i * 300, 580, 24); });
  const cuts = detectCuts(c, W, H);
  assert.equal(cuts.length, 7);
  assert.ok(cuts.slice(0, 4).every((k) => k.y < 200) && cuts.slice(4).every((k) => k.y > 330));
  assert.ok(Math.abs(cuts[4].x + cuts[4].w / 2 - 300) < 40 && cuts[4].x < cuts[5].x && cuts[5].x < cuts[6].x, 'second row restarts at the left');
  assert.ok(cuts[0].x < cuts[1].x && cuts[2].x < cuts[3].x);
});

test('specks and a thin caption are ignored', () => {
  const { c, W, H } = sheet(1400, 360, (a) => {
    for (let i = 0; i < 6; i++) a.figure(120 + i * 220, 260, 20);
    for (let i = 0; i < 12; i++) a.dot(30 + Math.floor(rnd() * 1300), 20 + Math.floor(rnd() * 320), 2);
    a.rect(100, 330, 70, 5);                              // a caption underline
  });
  assert.equal(detectCuts(c, W, H).length, 6);
});

test('two touching drawings are split at the valley between them', () => {
  const { c, W, H } = sheet(1200, 300, (a) => {
    for (let i = 0; i < 3; i++) a.figure(120 + i * 220, 260, 22);
    a.figure(820, 260, 22); a.figure(900, 260, 22);       // these two overlap on the page
  });
  const cuts = detectCuts(c, W, H);
  assert.equal(cuts.length, 5, `${cuts.length} cuts`);
});

test('sensitivity changes whether faint pencil is found', () => {
  const { c, W, H } = sheet(1200, 300, (a) => { for (let i = 0; i < 5; i++) a.figure(120 + i * 220, 260, 20, 185); });
  assert.equal(detectCuts(c, W, H, { sensitivity: 90 }).length, 5);
  assert.equal(detectCuts(c, W, H, { sensitivity: 1 }).length, 0);
});

test('coloured pencil counts as ink', () => {
  const W = 800; const H = 300; const rgba = new Uint8ClampedArray(W * H * 4).fill(240);
  for (let y = 100; y < 220; y++) for (const x0 of [120, 420]) for (let x = x0; x < x0 + 60; x++) { const k = (y * W + x) * 4; rgba[k] = 220; rgba[k + 1] = 40; rgba[k + 2] = 40; }
  assert.equal(detectCuts(minChannel(rgba, W, H), W, H).length, 2);
});

test('grid and even modes divide the ink area evenly', () => {
  const { c, W, H } = sheet(1200, 600, (a) => { a.rect(100, 100, 1000, 400); });
  const g = detectCuts(c, W, H, { mode: 'grid', cols: 4, rows: 2, padding: 0 });
  assert.equal(g.length, 8);
  assert.ok(Math.abs(g[0].w - 250) <= 8 && Math.abs(g[0].h - 200) <= 8);
  const e = detectCuts(c, W, H, { mode: 'even', count: 5, padding: 0 });
  assert.equal(e.length, 5);
});

test('a blank picture finds nothing', () => {
  const { c, W, H } = sheet(500, 300, () => {});
  assert.deepEqual(detectCuts(c, W, H), []);
});

test('a large picture is analysed at reduced size and cuts map back to full size', () => {
  const { c, W, H } = sheet(3600, 700, (a) => { for (let i = 0; i < 4; i++) a.figure(300 + i * 800, 600, 40); });
  const cuts = detectCuts(c, W, H);
  assert.equal(cuts.length, 4);
  assert.ok(overlap(cuts[2], 300 + 1600 - 100, 400, 200, 220) > 0.4);
});

test('dragging an edge, a corner and the whole cut; clamping keeps cuts inside', () => {
  const k = { x: 100, y: 100, w: 200, h: 200 };
  assert.deepEqual(dragCut(k, 'r', 30, 0, 1000, 1000), { ...k, w: 230 });
  const corner = dragCut(k, 'tl', 20, 10, 1000, 1000);
  assert.deepEqual([corner.x, corner.y, corner.w, corner.h], [120, 110, 180, 190]);
  const mv = dragCut(k, 'move', 5000, 5000, 1000, 1000);
  assert.ok(mv.x + mv.w <= 1000 && mv.y + mv.h <= 1000);
  const inverted = dragCut(k, 'r', -500, 0, 1000, 1000);
  assert.ok(inverted.w >= 8, 'cannot pass the opposite edge');
  assert.ok(clampCut({ x: -50, y: -50, w: 100, h: 100 }, 500, 500).x === 0);
});

test('split, merge and tighten', () => {
  const k = { x: 100, y: 100, w: 200, h: 100, label: '3' };
  const [a, b] = splitCut(k, 'x', 180);
  assert.equal(a.w + b.w, k.w); assert.equal(b.x, 180);
  assert.equal(splitCut(k, 'x', 102), null);
  assert.deepEqual([mergeCuts(a, b).x, mergeCuts(a, b).w], [100, 200]);
  const { c, W, H } = sheet(600, 300, (s) => s.rect(250, 120, 80, 100));
  const t = tightenCut(c, W, H, { x: 100, y: 50, w: 400, h: 220 }, paperLevel(c), 40, 4);
  assert.ok(Math.abs(t.x - 246) <= 2 && Math.abs(t.w - 88) <= 3, JSON.stringify(t));
});

test('frame numbers keep your labels and count on from them', () => {
  const out = numberCuts([{ x: 0 }, { x: 1 }, { x: 2, label: '10', manual: true }, { x: 3 }, { x: 4, label: 'hold', manual: true }, { x: 5 }]);
  assert.deepEqual(out.map((c) => c.label), ['1', '2', '10', '11', 'hold', '13']);
  // Labels that were only assigned are not kept: inserting a cut renumbers everything after it.
  const auto = numberCuts([{ x: 0, label: '1' }, { x: 1, label: '2' }, { x: 2, label: '3' }]);
  const inserted = numberCuts([auto[0], { x: 9, label: '' }, auto[1], auto[2]]);
  assert.deepEqual(inserted.map((c) => c.label), ['1', '2', '3', '4']);
});

test('wand selects a connected region within tolerance and stays inside the rect', () => {
  const W = 40; const H = 20; const c = new Uint8Array(W * H).fill(200);
  for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) c[y * W + x] = 30;
  const m = floodSelect(c, W, H, 8, 8, 20);
  assert.equal(m.reduce((a, v) => a + v, 0), 100);
  assert.equal(floodSelect(c, W, H, 8, 8, 20, { x: 0, y: 0, w: 10, h: 10 }).reduce((a, v) => a + v, 0), 25);
  assert.equal(floodSelect(c, W, H, 30, 3, 20).reduce((a, v) => a + v, 0), W * H - 100, 'the paper around it');
});

test('lasso fill and brush strokes write the mask', () => {
  const m = fillPolygon([2, 2, 12, 2, 12, 12, 2, 12], 20, 20);
  assert.equal(m.reduce((a, v) => a + v, 0), 100);
  const mask = new Uint8Array(30 * 30).fill(255);
  const r = brushLine(mask, 30, 30, 5, 5, 20, 5, 3, 0);
  assert.ok(mask[5 * 30 + 12] === 0 && mask[25 * 30 + 12] === 255);
  assert.ok(r.w >= 16 && r.h >= 6);
  brushLine(mask, 30, 30, 5, 5, 20, 5, 3, 255);
  assert.equal(mask.reduce((a, v) => a + v, 0), 255 * 900, 'the restore brush undoes it');
});

test('specks are removed by size and components are counted', () => {
  const W = 30; const H = 30; const ink = new Uint8Array(W * H);
  for (let y = 5; y < 15; y++) for (let x = 5; x < 15; x++) ink[y * W + x] = 1;
  ink[25 * W + 25] = 1; ink[26 * W + 26] = 1;
  assert.equal(components(ink, W, H).info.length - 1, 2);
  const out = removeSpecks(ink, W, H, 10);
  assert.equal(out[25 * W + 25], 0); assert.equal(out[8 * W + 8], 1);
});

test('paper removal keeps ink and clears paper; bounds find the drawing', () => {
  const W = 50; const H = 50; const c = new Uint8Array(W * H).fill(235);
  for (let y = 10; y < 30; y++) for (let x = 20; x < 40; x++) c[y * W + x] = 60;
  const a = paperAlpha(c, 235, 30);
  assert.equal(a[0], 0); assert.equal(a[15 * W + 25], 255);
  assert.deepEqual(alphaBounds(a, W, H), { x: 20, y: 10, w: 20, h: 20 });
  assert.equal(alphaBounds(new Uint8ClampedArray(100), 10, 10), null);
});

test('registration: feet puts every bottom on one line; layout keeps the sheet positions', () => {
  const cuts = [{ x: 100, y: 100, w: 100, h: 200 }, { x: 400, y: 120, w: 100, h: 180 }];
  const bounds = [{ x: 10, y: 20, w: 60, h: 160 }, { x: 20, y: 0, w: 50, h: 150 }];
  const f = registrationOffsets('feet', cuts, bounds);
  assert.deepEqual([f[0].ax, f[0].ay, f[1].ax, f[1].ay], [40, 180, 45, 150]);
  const l = registrationOffsets('layout', cuts, bounds);
  assert.deepEqual([l[1].sx, l[1].sy], [300, 20]);
  assert.deepEqual(registrationOffsets('centre', cuts, bounds)[0], { ax: 40, ay: 100, sx: 0, sy: 0 });
});

test('runs and the paper level behave on simple input', () => {
  assert.deepEqual(runs([0, 1, 1, 0, 0, 0, 2, 0, 3], 2), [[1, 2], [6, 8]]);
  assert.deepEqual(runs([0, 1, 0, 1], 2), [[1, 3]]);
  const c = new Uint8Array(1000).fill(230); for (let i = 0; i < 100; i++) c[i] = 20;
  assert.equal(paperLevel(c), 230);
  assert.equal(inkMask(c, 230, 40)[0], 1); assert.equal(inkMask(c, 230, 40)[500], 0);
});

test('a long thin ground line is ignored, but a solid block and a figure stay', () => {
  const W = 1000; const H = 300;
  const { c } = sheet(W, H, (a) => { for (let i = 0; i < 5; i++) a.figure(120 + i * 180, 250, 20); a.line(10, 252, 990, 252, 1); });
  assert.equal(detectCuts(c, W, H, { ruleLen: 10 }).length, 5, 'the line joined them without this');
  assert.ok(detectCuts(c, W, H, { ruleLen: 0 }).length < 5, 'with the line kept they merge');
});

test('cut into N picks the quietest places in a row that has no gaps', () => {
  const W = 1200; const H = 300;
  // Five overlapping figures with no empty column between them.
  const { c } = sheet(W, H, (a) => { for (let i = 0; i < 5; i++) a.figure(150 + i * 120, 260, 70); });
  assert.ok(detectCuts(c, W, H, { mode: 'auto' }).length < 5, 'plain detection cannot separate them');
  const cuts = detectCuts(c, W, H, { mode: 'count', count: 5 });
  assert.equal(cuts.length, 5);
  cuts.forEach((k, i) => { assert.ok(Math.abs(k.x + k.w / 2 - (150 + i * 120)) < 60, `cut ${i} centre ${k.x + k.w / 2}`); });
});

test('a region limits where it looks', () => {
  const W = 1200; const H = 600;
  const { c } = sheet(W, H, (a) => { for (let i = 0; i < 4; i++) a.figure(150 + i * 250, 250, 20); for (let i = 0; i < 4; i++) a.figure(150 + i * 250, 560, 20); });
  assert.equal(detectCuts(c, W, H).length, 8);
  const top = detectCuts(c, W, H, { region: { x: 0, y: 0, w: W, h: 300 } });
  assert.equal(top.length, 4);
  assert.ok(top.every((k) => k.y + k.h <= 320));
});

test('text lines and very wide finds are dropped as not drawings', () => {
  const W = 1400; const H = 400;
  const { c } = sheet(W, H, (a) => { for (let i = 0; i < 4; i++) a.figure(150 + i * 300, 360, 25); a.rect(100, 20, 1200, 16); });
  assert.equal(detectCuts(c, W, H).length, 4);
  assert.equal(detectCuts(c, W, H, { maxAspect: 0 }).length, 5, 'with the filter off the text line counts');
});
