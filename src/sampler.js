// Animation sampler state: a picture you load, the cuts that slice it into frames, cleanup edits, and drawing of those frames.
// The picture and every edit stay in this page's memory. Nothing is uploaded or stored; saved settings keep only cut rectangles and numbers.
import {
  SLICE_DEFAULTS, minChannel, paperLevel, inkMask, detectCuts, numberCuts, paperAlpha, alphaBounds, registrationOffsets,
  floodSelect, fillPolygon, brushLine, components, clampCut, tightenCut,
} from './slicer.js';

const MAX_SIDE = 5000;

export const SM = {
  loaded: false, name: '', W: 0, H: 0, source: null, rgba: null, chan: null, paper: 235,
  erase: null,                       // 255 keeps a pixel, 0 removes it; shared by every slice, in picture coordinates
  cuts: [], sel: 0,
  opts: { ...SLICE_DEFAULTS },
  region: null,                      // part of the picture to search, or null for all of it
  clean: { paper: false, threshold: 30, softness: 24 },
  reg: 'feet',                       // feet | centre | layout
  exposure: 2,
  undo: [], redo: [], rev: 0,
  cache: new Map(), tint: new Map(),
};

const makeCanvas = (w, h) => {
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};

/** Reads a File into the sampler. Large pictures are reduced so the long side is at most MAX_SIDE. */
export async function loadPicture(file) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const W = Math.round(bmp.width * k); const H = Math.round(bmp.height * k);
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H);      // transparent pictures count as white paper
  ctx.drawImage(bmp, 0, 0, W, H);
  bmp.close?.();
  const rgba = ctx.getImageData(0, 0, W, H).data;
  Object.assign(SM, { loaded: true, name: file.name || 'picture', W, H, source: c, rgba, chan: minChannel(rgba, W, H) });
  SM.paper = paperLevel(SM.chan);
  SM.erase = new Uint8Array(W * H).fill(255);
  SM.undo = []; SM.redo = []; SM.cache.clear(); SM.tint.clear(); SM.rev++;
  detect();
  return { W, H, cuts: SM.cuts.length };
}

export function unload() {
  Object.assign(SM, { loaded: false, source: null, rgba: null, chan: null, erase: null, cuts: [], sel: 0, undo: [], redo: [] });
  SM.cache.clear(); SM.tint.clear(); SM.rev++;
}

export function detect() {
  if (!SM.loaded) return [];
  const found = detectCuts(SM.chan, SM.W, SM.H, { ...SM.opts, region: SM.region });
  SM.cuts = numberCuts(found).map((c) => ({ ...c, exposure: null, dx: 0, dy: 0 }));
  SM.sel = 0; SM.cache.clear(); SM.rev++;
  return SM.cuts;
}

export const touch = () => { SM.rev++; SM.cache.clear(); SM.tint.clear(); };
const expOf = (c) => c.exposure ?? SM.exposure;

// ---- slices ----

function inkOf(cut) {
  const ink = inkMask(SM.chan, SM.paper, SM.opts.sensitivity);
  return { ink };
}

/** The slice as a canvas with transparency from paper removal and your erasing, plus the bounds of its ink. Cached until something changes. */
export function sliceOf(i) {
  const cut = SM.cuts[i];
  if (!cut) return null;
  const key = `${SM.rev}:${cut.x},${cut.y},${cut.w},${cut.h}:${SM.clean.paper}:${SM.clean.threshold}:${SM.clean.softness}`;
  const hit = SM.cache.get(i);
  if (hit && hit.key === key) return hit;
  const { x, y, w, h } = cut;
  const c = makeCanvas(w, h);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const sub = new Uint8Array(w * h);
  for (let j = 0; j < h; j++) {
    const row = (y + j) * SM.W + x;
    for (let k = 0; k < w; k++) sub[j * w + k] = SM.chan[row + k];
  }
  const pa = SM.clean.paper ? paperAlpha(sub, SM.paper, SM.clean.threshold, SM.clean.softness) : null;
  const margin = Math.max(6, 70 - SM.opts.sensitivity * 0.62);
  const bounds = { x0: w, y0: h, x1: -1, y1: -1 };
  for (let j = 0; j < h; j++) {
    for (let k = 0; k < w; k++) {
      const src = ((y + j) * SM.W + x + k);
      const o = (j * w + k) * 4;
      const keep = SM.erase[src] / 255;
      const a = (pa ? pa[j * w + k] : 255) * keep;
      d[o] = SM.rgba[src * 4]; d[o + 1] = SM.rgba[src * 4 + 1]; d[o + 2] = SM.rgba[src * 4 + 2]; d[o + 3] = a;
      if (keep > 0.5 && sub[j * w + k] < SM.paper - margin) {
        if (k < bounds.x0) bounds.x0 = k; if (k > bounds.x1) bounds.x1 = k; if (j < bounds.y0) bounds.y0 = j; if (j > bounds.y1) bounds.y1 = j;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  const b = bounds.x1 < 0 ? { x: 0, y: 0, w, h } : { x: bounds.x0, y: bounds.y0, w: bounds.x1 - bounds.x0 + 1, h: bounds.y1 - bounds.y0 + 1 };
  const out = { key, canvas: c, bounds: b };
  SM.cache.set(i, out);
  return out;
}

/** Where each slice is drawn, in slice-picture pixels around a common anchor, and the box that holds them all. */
export function layout() {
  const cuts = SM.cuts;
  const bounds = cuts.map((_, i) => sliceOf(i).bounds);
  const reg = registrationOffsets(SM.reg, cuts, bounds);
  const place = cuts.map((c, i) => ({ ox: -reg[i].ax + reg[i].sx + (c.dx || 0), oy: -reg[i].ay + reg[i].sy + (c.dy || 0) }));
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  cuts.forEach((c, i) => {
    const b = bounds[i];
    x0 = Math.min(x0, place[i].ox + b.x); y0 = Math.min(y0, place[i].oy + b.y);
    x1 = Math.max(x1, place[i].ox + b.x + b.w); y1 = Math.max(y1, place[i].oy + b.y + b.h);
  });
  return { place, bounds, box: { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) } };
}

/** What the timeline needs: one entry per slice, with its frame number and exposure. */
export function sampledSummary() {
  if (!SM.loaded || !SM.cuts.length) return null;
  return { active: true, slices: SM.cuts.map((c) => ({ label: c.label, exposure: expOf(c) })), reg: SM.reg, name: SM.name };
}

export function manifestInfo() {
  if (!SM.loaded) return null;
  return {
    note: 'Frames are slices of a picture you loaded. Their content is yours; this app only cuts and places them.',
    picture: { name: SM.name, width: SM.W, height: SM.H }, registration: SM.reg,
    cleanup: { paperRemoved: SM.clean.paper, threshold: SM.clean.threshold, softness: SM.clean.softness },
    slices: SM.cuts.map((c) => ({ label: c.label, exposure: expOf(c), cut: { x: c.x, y: c.y, w: c.w, h: c.h }, nudge: { dx: c.dx || 0, dy: c.dy || 0 } })),
  };
}

// ---- drawing a sampled frame ----

function tinted(i, color) {
  const s = sliceOf(i);
  const key = `${i}:${color}:${s.key}`;
  const hit = SM.tint.get(key);
  if (hit) return hit;
  const c = makeCanvas(s.canvas.width, s.canvas.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(s.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color; ctx.fillRect(0, 0, c.width, c.height);
  // Paper that has not been removed would paint a solid block, so ghosts always use ink only.
  SM.tint.set(key, c);
  return c;
}

const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

/** Frame index (in timeline order) to slice index, from the schedule of exposures. */
export function sliceAtFrame(frame) {
  let f = ((frame % totalFrames()) + totalFrames()) % totalFrames();
  for (let i = 0; i < SM.cuts.length; i++) { const e = expOf(SM.cuts[i]); if (f < e) return i; f -= e; }
  return SM.cuts.length - 1;
}
export const totalFrames = () => Math.max(1, SM.cuts.reduce((a, c) => a + expOf(c), 0));

/** Draws a sampled frame on ctx (w by h), the same way the walk figure is drawn: background, ground, onion skin, then the drawing. */
export function drawSampled(ctx, st, w, h, frame, opts = {}) {
  const i = sliceAtFrame(frame);
  const { place, box } = layout();
  const transparent = opts.transparent ?? st.transparent;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!transparent) { ctx.fillStyle = st.background; ctx.fillRect(0, 0, w, h); }
  const scale = Math.min((w * 0.9) / box.w, (h * (st.figureHeight + 0.16)) / box.h);
  const groundY = h * st.groundHeight;
  const X0 = w / 2 + st.offsetX * w - (box.x + box.w / 2) * scale;
  const Y0 = SM.reg === 'centre' ? h / 2 - (box.y + box.h / 2) * scale : groundY - (box.y + box.h) * scale;
  const layers = opts.layers || { guides: true, figure: true };
  const k = h / 1080;
  if (layers.guides && st.showGround && SM.reg !== 'centre') {
    ctx.strokeStyle = hexA(st.guideColor, 0.75); ctx.lineWidth = 2.4 * k;
    ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();
  }
  const put = (idx, canvas, alpha) => {
    const s = SM.cuts[idx];
    ctx.globalAlpha = alpha;
    ctx.drawImage(canvas, X0 + place[idx].ox * scale, Y0 + place[idx].oy * scale, s.w * scale, s.h * scale);
    ctx.globalAlpha = 1;
  };
  if (layers.figure) {
    ctx.imageSmoothingQuality = 'high';
    if (st.showOnion && opts.onion !== false) {
      const n = SM.cuts.length;
      for (let d = st.onionBefore; d >= 1; d--) { const j = (i - d + n * 8) % n; if (n > 1) put(j, tinted(j, st.onionBeforeTint), st.onionOpacity * Math.pow(0.7, d - 1)); }
      for (let d = st.onionAfter; d >= 1; d--) { const j = (i + d) % n; if (n > 1) put(j, tinted(j, st.onionAfterTint), st.onionOpacity * Math.pow(0.7, d - 1)); }
    }
    put(i, sliceOf(i).canvas, st.style === 'silhouette' ? 0 : 1);
    if (st.style === 'silhouette') { const t = tinted(i, st.lineColor); put(i, t, 1); }
  }
  ctx.restore();
  if (layers.guides && st.showLabels) {
    ctx.save();
    ctx.font = `600 ${Math.round(24 * k)}px system-ui, sans-serif`;
    ctx.fillStyle = hexA(st.guideColor, 0.95);
    ctx.fillText(`Frame ${SM.cuts[i].label}`, 28 * k, 48 * k);
    ctx.restore();
  }
  return { key: null, drawing: i + 1, drawings: SM.cuts.length, u: i / SM.cuts.length, shapes: [], label: SM.cuts[i].label };
}

// ---- cleanup edits, with undo ----

function slab(i, pad = 24) {
  const c = SM.cuts[i];
  return clampCut({ x: c.x - pad, y: c.y - pad, w: c.w + 2 * pad, h: c.h + 2 * pad }, SM.W, SM.H, 1);
}

/** Starts an edit on slice i: saves the part of the erase mask it can touch so it can be undone. */
export function beginEdit(i) {
  const r = slab(i);
  const before = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) before.set(SM.erase.subarray((r.y + y) * SM.W + r.x, (r.y + y) * SM.W + r.x + r.w), y * r.w);
  SM.pending = { i, rect: r, before };
}
export function endEdit() {
  const p = SM.pending; SM.pending = null;
  if (!p) return;
  // Drop it if nothing changed.
  let changed = false;
  for (let y = 0; y < p.rect.h && !changed; y++) for (let x = 0; x < p.rect.w; x++) if (SM.erase[(p.rect.y + y) * SM.W + p.rect.x + x] !== p.before[y * p.rect.w + x]) { changed = true; break; }
  if (!changed) return;
  SM.undo.push(p); if (SM.undo.length > 30) SM.undo.shift();
  SM.redo = [];
}
function swapRegion(p) {
  const now = new Uint8Array(p.rect.w * p.rect.h);
  for (let y = 0; y < p.rect.h; y++) {
    const o = (p.rect.y + y) * SM.W + p.rect.x;
    now.set(SM.erase.subarray(o, o + p.rect.w), y * p.rect.w);
    SM.erase.set(p.before.subarray(y * p.rect.w, (y + 1) * p.rect.w), o);
  }
  return { ...p, before: now };
}
export function undo() { const p = SM.undo.pop(); if (!p) return false; SM.redo.push(swapRegion(p)); touch(); return true; }
export function redo() { const p = SM.redo.pop(); if (!p) return false; SM.undo.push(swapRegion(p)); touch(); return true; }

const within = (i) => SM.cuts[i];
/** Paints value (0 erases, 255 restores) with a round brush at picture coordinates, kept inside slice i. */
export function brush(i, x0, y0, x1, y1, radius, value) {
  const c = within(i); if (!c) return;
  const sub = new Uint8Array(c.w * c.h);
  for (let y = 0; y < c.h; y++) sub.set(SM.erase.subarray((c.y + y) * SM.W + c.x, (c.y + y) * SM.W + c.x + c.w), y * c.w);
  brushLine(sub, c.w, c.h, x0 - c.x, y0 - c.y, x1 - c.x, y1 - c.y, radius, value);
  for (let y = 0; y < c.h; y++) SM.erase.set(sub.subarray(y * c.w, (y + 1) * c.w), (c.y + y) * SM.W + c.x);
  SM.rev++; SM.cache.delete(i);
}
export function polygon(i, flat, value) {
  const c = within(i); if (!c) return;
  const local = flat.map((v, k) => (k % 2 ? v - c.y : v - c.x));
  const m = fillPolygon(local, c.w, c.h);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) if (m[y * c.w + x]) SM.erase[(c.y + y) * SM.W + c.x + x] = value;
  SM.rev++; SM.cache.delete(i);
}
export function rectErase(i, x0, y0, x1, y1, value) {
  polygon(i, [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1), Math.min(x0, x1), Math.max(y0, y1)], value);
}
/** Erases the connected area of similar brightness under a picture point. */
export function wand(i, x, y, tolerance, value = 0) {
  const c = within(i); if (!c) return 0;
  const m = floodSelect(SM.chan, SM.W, SM.H, Math.round(x), Math.round(y), tolerance, c);
  let n = 0;
  for (let k = 0; k < m.length; k++) if (m[k]) { SM.erase[k] = value; n++; }
  SM.rev++; SM.cache.delete(i);
  return n;
}
/** Erases ink marks smaller than minArea pixels inside slice i; returns how many marks went. */
export function removeSpeckMarks(i, minArea) {
  const c = within(i); if (!c) return 0;
  const w = c.w; const h = c.h;
  const margin = Math.max(6, 70 - SM.opts.sensitivity * 0.62);
  const ink = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const src = (c.y + y) * SM.W + c.x + x; ink[y * w + x] = SM.erase[src] > 127 && SM.chan[src] < SM.paper - margin ? 1 : 0; }
  const { labels, info } = components(ink, w, h);
  let removed = 0;
  const gone = new Set();
  info.forEach((q, l) => { if (q && q.area < minArea) { gone.add(l); removed++; } });
  if (!removed) return 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const l = labels[y * w + x];
    if (l && gone.has(l)) {
      // Clear the mark and a one pixel halo, so its soft edge goes with it.
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx; const yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h) SM.erase[(c.y + yy) * SM.W + c.x + xx] = 0; }
    }
  }
  SM.rev++; SM.cache.delete(i);
  return removed;
}
export function resetSliceEdits(i) {
  const c = within(i); if (!c) return;
  beginEdit(i);
  for (let y = 0; y < c.h; y++) SM.erase.fill(255, (c.y + y) * SM.W + c.x, (c.y + y) * SM.W + c.x + c.w);
  SM.rev++; SM.cache.delete(i); endEdit();
}

// ---- cut list editing ----
// Every cut is whole pixels inside the picture, so the erase mask indexing stays exact.
export function setCuts(cuts) { SM.cuts = cuts.map((c) => ({ ...c, ...clampCut(c, SM.W, SM.H) })); SM.sel = Math.min(SM.sel, Math.max(0, cuts.length - 1)); touch(); }
export function tighten(i) {
  const c = SM.cuts[i]; if (!c) return;
  SM.cuts[i] = { ...tightenCut(SM.chan, SM.W, SM.H, c, SM.paper, SM.opts.sensitivity, SM.opts.padding), label: c.label, exposure: c.exposure, dx: c.dx, dy: c.dy };
  touch();
}
export { inkOf };
