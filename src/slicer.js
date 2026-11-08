// Autoslice sampler logic: find the drawings in a picture of a movement sequence and cut them into frames.
// Pure typed-array code, no DOM, so it can be tested. Works on any picture you load; nothing is stored or sent anywhere.
// Pixel data is read as the darkest colour channel, so coloured pencil counts as ink just like graphite.

export const SLICE_DEFAULTS = Object.freeze({
  mode: 'auto',        // auto | row | column | grid | even | count
  sensitivity: 40,     // 0..100: how faint a mark still counts as ink
  minGap: 1.5,         // percent of the picture: space that separates two drawings
  minSize: 25,         // percent of a typical drawing's area: smaller finds (captions, smudges, specks) are ignored
  padding: 6,          // pixels added around each cut
  cols: 4,             // grid mode
  rows: 1,
  count: 8,            // even mode: frames across; count mode: drawings in each row
  splitWide: true,     // split a cut that holds two touching drawings
  ruleLen: 10,         // percent of the picture width: longer straight lines (ground lines, borders) are ignored; 0 keeps them
  maxAspect: 6,        // finds longer or taller than this, edge to edge, are treated as text lines or rules and dropped
  region: null,        // { x, y, w, h } in picture pixels: only look in here. null looks everywhere.
});

/** The darkest of red, green and blue for every pixel. */
export function minChannel(rgba, w, h) {
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) out[i] = Math.min(rgba[j], rgba[j + 1], rgba[j + 2]);
  return out;
}

export function percentile(chan, p) {
  const hist = new Uint32Array(256);
  for (let i = 0; i < chan.length; i++) hist[chan[i]]++;
  const target = chan.length * p;
  let acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) return v; }
  return 255;
}

/** Paper brightness: a high percentile, so ink and shadows do not drag it down. */
export const paperLevel = (chan) => percentile(chan, 0.8);

/** Marks darker than paper by at least a margin the sensitivity sets (higher sensitivity, smaller margin). */
export function inkMask(chan, paper, sensitivity = 40) {
  const margin = Math.max(6, 70 - sensitivity * 0.62);
  const out = new Uint8Array(chan.length);
  const limit = paper - margin;
  for (let i = 0; i < chan.length; i++) out[i] = chan[i] < limit ? 1 : 0;
  return out;
}

/** Shrinks a channel so its long side is at most maxSide, keeping the darkest pixel of each block so thin lines survive. */
export function downscaleMin(chan, w, h, maxSide = 1400) {
  const s = Math.max(1, Math.ceil(Math.max(w, h) / maxSide));
  if (s === 1) return { data: chan, w, h, scale: 1 };
  const nw = Math.ceil(w / s); const nh = Math.ceil(h / s);
  const out = new Uint8Array(nw * nh).fill(255);
  for (let y = 0; y < h; y++) {
    const oy = Math.floor(y / s) * nw;
    for (let x = 0; x < w; x++) { const o = oy + Math.floor(x / s); const v = chan[y * w + x]; if (v < out[o]) out[o] = v; }
  }
  return { data: out, w: nw, h: nh, scale: s };
}

/** Connected components (8 neighbours). Returns labels (0 = none) and each component's pixel count and bounds. */
export function components(mask, w, h) {
  const labels = new Int32Array(w * h);
  const info = [null];
  const stack = [];
  let next = 1;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i]) continue;
    let area = 0; let x0 = w; let y0 = h; let x1 = 0; let y1 = 0;
    labels[i] = next; stack.push(i);
    while (stack.length) {
      const p = stack.pop();
      const x = p % w; const y = (p - x) / w;
      area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy; if (yy < 0 || yy >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx; if (xx < 0 || xx >= w) continue;
          const q = yy * w + xx;
          if (mask[q] && !labels[q]) { labels[q] = next; stack.push(q); }
        }
      }
    }
    info.push({ area, x0, y0, x1, y1 });
    next++;
  }
  return { labels, info };
}

/** Clears components smaller than minArea. Returns a new mask. */
export function removeSpecks(mask, w, h, minArea) {
  const { labels, info } = components(mask, w, h);
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) { const l = labels[i]; if (l && info[l].area >= minArea) out[i] = 1; }
  return out;
}

/**
 * Clears long thin straight lines (ground lines, borders), so one cannot join every drawing on it.
 * A run only goes if it is thin: paper lies a few pixels above and below it (or beside it, for vertical lines).
 */
export function removeRules(ink, w, h, minLenH, minLenV = 0, thick = 4) {
  const out = ink.slice();
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : ink[y * w + x]);
  if (minLenH > 0) {
    for (let y = 0; y < h; y++) {
      let x = 0;
      while (x < w) {
        if (!ink[y * w + x]) { x++; continue; }
        let x1 = x; while (x1 < w && ink[y * w + x1]) x1++;
        if (x1 - x >= minLenH) {
          let thin = 0; for (let k = x; k < x1; k++) if (!at(k, y - thick) && !at(k, y + thick)) thin++;
          if (thin >= 0.8 * (x1 - x)) for (let k = x; k < x1; k++) out[y * w + k] = 0;
        }
        x = x1;
      }
    }
  }
  if (minLenV > 0) {
    for (let x = 0; x < w; x++) {
      let y = 0;
      while (y < h) {
        if (!ink[y * w + x]) { y++; continue; }
        let y1 = y; while (y1 < h && ink[y1 * w + x]) y1++;
        if (y1 - y >= minLenV) {
          let thin = 0; for (let k = y; k < y1; k++) if (!at(x - thick, k) && !at(x + thick, k)) thin++;
          if (thin >= 0.8 * (y1 - y)) for (let k = y; k < y1; k++) out[k * w + x] = 0;
        }
        y = y1;
      }
    }
  }
  return out;
}

/**
 * Cuts a stretch of columns into n pieces at the quietest places: the lowest points of the ink profile,
 * kept apart so no piece is tiny. For rows where drawings overlap and no gap exists.
 */
export function splitByCount(profile, x0, x1, n, edgeMargin = 0.04) {
  const len = x1 - x0 + 1;
  if (n <= 1 || len < 2 * n) return [[x0, x1]];
  const win = Math.max(1, Math.round(len * 0.006));
  const sm = new Float64Array(len);
  for (let i = 0; i < len; i++) { let s = 0; let c = 0; for (let k = -win; k <= win; k++) { const j = i + k; if (j >= 0 && j < len) { s += profile[x0 + j]; c++; } } sm[i] = s / c; }
  const lo = Math.ceil(len * edgeMargin); const hi = len - 1 - lo;
  const cand = [];
  for (let i = Math.max(1, lo); i <= Math.min(len - 2, hi); i++) if (sm[i] <= sm[i - 1] && sm[i] <= sm[i + 1]) cand.push(i);
  cand.sort((a, b) => sm[a] - sm[b]);
  const minSep = (len / n) * 0.45;
  const picked = [];
  for (const c of cand) { if (picked.length >= n - 1) break; if (picked.every((p) => Math.abs(p - c) >= minSep)) picked.push(c); }
  // Not enough quiet places: fall back to even spacing for the rest.
  for (let k = 1; picked.length < n - 1 && k < n; k++) { const c = Math.round((len * k) / n); if (picked.every((p) => Math.abs(p - c) >= minSep * 0.5)) picked.push(c); }
  picked.sort((a, b) => a - b);
  const out = []; let start = 0;
  for (const c of picked) { out.push([x0 + start, x0 + c - 1]); start = c + 1; }
  out.push([x0 + start, x1]);
  return out;
}

/** Runs of occupied entries separated by at least minGap empty ones. Returns [start, end] inclusive pairs. */
export function runs(profile, minGap) {
  const out = [];
  let start = -1; let last = -1;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] > 0) {
      if (start < 0) start = i;
      else if (i - last - 1 >= minGap) { out.push([start, last]); start = i; }
      last = i;
    }
  }
  if (start >= 0) out.push([start, last]);
  return out;
}

const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

function tightBounds(ink, w, x0, y0, x1, y1) {
  let bx0 = x1 + 1; let by0 = y1 + 1; let bx1 = x0 - 1; let by1 = y0 - 1; let count = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (ink[y * w + x]) { count++; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; }
    }
  }
  return count ? { x0: bx0, y0: by0, x1: bx1, y1: by1, count } : null;
}

/** Splits a box where the column profile has a deep valley near its middle (two touching drawings). */
function splitAtValley(ink, w, b) {
  const prof = [];
  for (let x = b.x0; x <= b.x1; x++) { let c = 0; for (let y = b.y0; y <= b.y1; y++) c += ink[y * w + x]; prof.push(c); }
  const max = Math.max(...prof);
  const lo = Math.floor(prof.length * 0.3); const hi = Math.ceil(prof.length * 0.7);
  // Smooth a little so a single thin gap does not read as a valley.
  const sm = prof.map((_, i) => { let s = 0; let n = 0; for (let k = -2; k <= 2; k++) { const v = prof[i + k]; if (v != null) { s += v; n++; } } return s / n; });
  let best = -1; let bv = Infinity;
  for (let i = lo; i < hi; i++) if (sm[i] < bv) { bv = sm[i]; best = i; }
  if (best < 0 || bv > max * 0.18) return null;
  const cut = b.x0 + best;
  return [{ ...b, x1: cut - 1 }, { ...b, x0: cut + 1 }];
}

/**
 * Finds the drawings. chan is the min-channel of the picture at w by h.
 * Returns cuts [{ x, y, w, h }] in picture pixels, in reading order (rows top to bottom, then left to right).
 */
export function detectCuts(chan, w, h, options = {}) {
  const o = { ...SLICE_DEFAULTS, ...options };
  const small = downscaleMin(chan, w, h, 1400);
  const sw = small.w; const sh = small.h; const s = small.scale;
  const paper = paperLevel(small.data);
  let ink = inkMask(small.data, paper, o.sensitivity);
  ink = removeSpecks(ink, sw, sh, Math.max(12, Math.round(sw * sh * 0.00003)));
  // Only horizontal rules (ground lines) and very tall ones (page borders) go: a figure's own upright strokes must stay.
  if (o.ruleLen > 0) ink = removeRules(ink, sw, sh, Math.round((o.ruleLen / 100) * sw), Math.round(0.6 * sh));
  if (o.region) {
    // Only look inside the region you marked.
    const rx0 = Math.max(0, Math.floor(o.region.x / s)); const ry0 = Math.max(0, Math.floor(o.region.y / s));
    const rx1 = Math.min(sw - 1, Math.ceil((o.region.x + o.region.w) / s)); const ry1 = Math.min(sh - 1, Math.ceil((o.region.y + o.region.h) / s));
    for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) if (x < rx0 || x > rx1 || y < ry0 || y > ry1) ink[y * sw + x] = 0;
  }
  const gapX = Math.max(2, Math.round((o.minGap / 100) * sw));
  const gapY = Math.max(2, Math.round((o.minGap / 100) * sh));
  const whole = tightBounds(ink, sw, 0, 0, sw - 1, sh - 1);
  if (!whole) return [];

  let boxes = [];
  if (o.mode === 'grid' || o.mode === 'even') {
    const cols = o.mode === 'even' ? Math.max(1, o.count) : Math.max(1, o.cols);
    const rows = o.mode === 'even' ? 1 : Math.max(1, o.rows);
    const cw = (whole.x1 - whole.x0 + 1) / cols; const rh = (whole.y1 - whole.y0 + 1) / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      boxes.push({ x0: Math.round(whole.x0 + c * cw), y0: Math.round(whole.y0 + r * rh), x1: Math.round(whole.x0 + (c + 1) * cw) - 1, y1: Math.round(whole.y0 + (r + 1) * rh) - 1, count: 1 });
    }
  } else {
    const rowProfile = new Uint32Array(sh);
    for (let y = 0; y < sh; y++) { let c = 0; for (let x = 0; x < sw; x++) c += ink[y * sw + x]; rowProfile[y] = c; }
    const bands = o.mode === 'row' || (o.mode === 'count' && o.region) ? [[whole.y0, whole.y1]] : runs(rowProfile, gapY);
    for (const [y0, y1] of bands) {
      if (o.mode === 'column') {
        const t = tightBounds(ink, sw, 0, y0, sw - 1, y1);
        if (t) boxes.push(t);
        continue;
      }
      const colProfile = new Uint32Array(sw);
      for (let x = 0; x < sw; x++) { let c = 0; for (let y = y0; y <= y1; y++) c += ink[y * sw + x]; colProfile[x] = c; }
      let spans = runs(colProfile, gapX);
      if (o.mode === 'count' && spans.length) spans = splitByCount(colProfile, spans[0][0], spans[spans.length - 1][1], Math.max(1, o.count));
      for (const [x0, x1] of spans) {
        const t = tightBounds(ink, sw, x0, y0, x1, y1);
        if (t) boxes.push(t);
      }
    }
    if (o.mode === 'column') {
      // Column mode cuts only between rows, so rebuild as one box per band across the full width of its ink.
      boxes = boxes.map((b) => ({ ...b }));
    }
  }

  // Ignore specks and stray marks: much smaller than the typical drawing.
  if (boxes.length > 2) {
    // The reference is the median of the larger half, so a scatter of specks cannot pull it down.
    const areas = boxes.map((b) => (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1)).sort((a, b) => b - a);
    const ref = areas[Math.floor((Math.ceil(areas.length / 2) - 1) / 2)];
    boxes = boxes.filter((b) => (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1) >= Math.max((o.minSize / 100) * ref, sw * sh * 0.0003));
  }
  // Text lines and rules are very wide or very tall for their size, unlike drawings.
  if (o.maxAspect > 0 && o.mode !== 'grid' && o.mode !== 'even' && o.mode !== 'column' && o.mode !== 'row') {
    boxes = boxes.filter((b) => { const bw = b.x1 - b.x0 + 1; const bh = b.y1 - b.y0 + 1; return Math.max(bw / bh, bh / bw) <= o.maxAspect; });
  }
  if (o.splitWide && o.mode === 'auto' && boxes.length >= 3) {
    const med = median(boxes.map((b) => b.x1 - b.x0 + 1));
    const out = [];
    for (const b of boxes) {
      const parts = (b.x1 - b.x0 + 1) > med * 1.7 ? splitAtValley(ink, sw, b) : null;
      if (parts) for (const p of parts) out.push(tightBounds(ink, sw, p.x0, p.y0, p.x1, p.y1) || p); else out.push(b);
    }
    boxes = out;
  }

  const pad = o.padding;
  return boxes.map((b) => clampCut({
    x: b.x0 * s - pad, y: b.y0 * s - pad, w: (b.x1 - b.x0 + 1) * s + 2 * pad, h: (b.y1 - b.y0 + 1) * s + 2 * pad,
  }, w, h));
}

// ---- cut editing ----

export function clampCut(c, W, H, minSize = 8) {
  let x = Math.max(0, Math.min(W - minSize, Math.round(c.x)));
  let y = Math.max(0, Math.min(H - minSize, Math.round(c.y)));
  const w = Math.max(minSize, Math.min(W - x, Math.round(c.w)));
  const h = Math.max(minSize, Math.min(H - y, Math.round(c.h)));
  if (x + w > W) x = W - w;
  if (y + h > H) y = H - h;
  return { ...c, x, y, w, h };
}

/** Moves one edge or corner. handle is a combination of 'l', 'r', 't', 'b'. */
export function dragCut(cut, handle, dx, dy, W, H, minSize = 8) {
  let { x, y, w, h } = cut;
  if (handle === 'move') return clampCut({ ...cut, x: x + dx, y: y + dy }, W, H, minSize);
  let x1 = x + w; let y1 = y + h;
  if (handle.includes('l')) x = Math.min(x + dx, x1 - minSize);
  if (handle.includes('r')) x1 = Math.max(x1 + dx, x + minSize);
  if (handle.includes('t')) y = Math.min(y + dy, y1 - minSize);
  if (handle.includes('b')) y1 = Math.max(y1 + dy, y + minSize);
  return clampCut({ ...cut, x, y, w: x1 - x, h: y1 - y }, W, H, minSize);
}

/** Splits a cut in two at picture x (vertical line) or y (horizontal line). Returns null if the line is outside it. */
export function splitCut(cut, axis, at, minSize = 8) {
  if (axis === 'x') {
    if (at <= cut.x + minSize || at >= cut.x + cut.w - minSize) return null;
    return [{ ...cut, w: at - cut.x }, { ...cut, x: at, w: cut.x + cut.w - at }];
  }
  if (at <= cut.y + minSize || at >= cut.y + cut.h - minSize) return null;
  return [{ ...cut, h: at - cut.y }, { ...cut, y: at, h: cut.y + cut.h - at }];
}

export function mergeCuts(a, b) {
  const x = Math.min(a.x, b.x); const y = Math.min(a.y, b.y);
  return { ...a, x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
}

/** Shrinks a cut to the ink inside it plus padding. */
export function tightenCut(chan, W, H, cut, paper, sensitivity = 40, pad = 6) {
  const ink = inkMask(chan, paper, sensitivity);
  const b = tightBounds(ink, W, Math.max(0, cut.x), Math.max(0, cut.y), Math.min(W - 1, cut.x + cut.w - 1), Math.min(H - 1, cut.y + cut.h - 1));
  if (!b) return cut;
  return clampCut({ ...cut, x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + 1 + 2 * pad, h: b.y1 - b.y0 + 1 + 2 * pad }, W, H);
}

/** Frame numbers: a label you type (manual) is kept, and every other cut counts on from the one before it. */
export function numberCuts(cuts, start = 1) {
  let n = start;
  return cuts.map((c) => {
    // Only a number you typed (manual) is kept; the rest count on from the one before, so inserting a cut renumbers cleanly.
    const keep = c.manual && c.label != null && c.label !== '';
    const label = keep ? String(c.label) : String(n);
    const num = Number(label);
    n = Number.isFinite(num) ? num + 1 : n + 1;
    return { ...c, label };
  });
}

// ---- cleanup ----

/** Flood-select pixels near the seed's brightness, 4-connected, within rect. Returns a mask the size of the picture. */
export function floodSelect(chan, W, H, sx, sy, tolerance, rect = { x: 0, y: 0, w: W, h: H }) {
  const out = new Uint8Array(W * H);
  const x0 = Math.max(0, rect.x); const y0 = Math.max(0, rect.y); const x1 = Math.min(W - 1, rect.x + rect.w - 1); const y1 = Math.min(H - 1, rect.y + rect.h - 1);
  if (sx < x0 || sx > x1 || sy < y0 || sy > y1) return out;
  const seed = chan[sy * W + sx];
  const stack = [sy * W + sx];
  out[sy * W + sx] = 1;
  while (stack.length) {
    const p = stack.pop();
    const x = p % W; const y = (p - x) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx; const yy = y + dy;
      if (xx < x0 || xx > x1 || yy < y0 || yy > y1) continue;
      const q = yy * W + xx;
      if (!out[q] && Math.abs(chan[q] - seed) <= tolerance) { out[q] = 1; stack.push(q); }
    }
  }
  return out;
}

/** Even-odd polygon fill into a W by H mask (1 inside). poly is a flat [x, y, ...] list. */
export function fillPolygon(poly, W, H, out = new Uint8Array(W * H), value = 1) {
  const n = poly.length / 2;
  if (n < 3) return out;
  let minY = Infinity; let maxY = -Infinity;
  for (let i = 1; i < poly.length; i += 2) { minY = Math.min(minY, poly[i]); maxY = Math.max(maxY, poly[i]); }
  for (let y = Math.max(0, Math.floor(minY)); y <= Math.min(H - 1, Math.ceil(maxY)); y++) {
    const xs = [];
    const sy = y + 0.5;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const y1 = poly[2 * i + 1]; const y2 = poly[2 * j + 1];
      if ((y1 <= sy && y2 > sy) || (y2 <= sy && y1 > sy)) xs.push(poly[2 * i] + ((sy - y1) / (y2 - y1)) * (poly[2 * j] - poly[2 * i]));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) out[y * W + x] = value;
    }
  }
  return out;
}

/** A soft round brush stamp along a line, writing value (0 erases, 255 restores) into a W by H mask. Returns the touched rect. */
export function brushLine(mask, W, H, x0, y0, x1, y1, radius, value) {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / Math.max(1, radius * 0.4)));
  let rx0 = W; let ry0 = H; let rx1 = 0; let ry1 = 0;
  const r2 = radius * radius;
  for (let s = 0; s <= steps; s++) {
    const cx = x0 + ((x1 - x0) * s) / steps; const cy = y0 + ((y1 - y0) * s) / steps;
    const ya = Math.max(0, Math.floor(cy - radius)); const yb = Math.min(H - 1, Math.ceil(cy + radius));
    const xa = Math.max(0, Math.floor(cx - radius)); const xb = Math.min(W - 1, Math.ceil(cx + radius));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const dx = x - cx; const dy = y - cy;
      if (dx * dx + dy * dy <= r2) mask[y * W + x] = value;
    }
    rx0 = Math.min(rx0, xa); ry0 = Math.min(ry0, ya); rx1 = Math.max(rx1, xb); ry1 = Math.max(ry1, yb);
  }
  return { x: rx0, y: ry0, w: Math.max(0, rx1 - rx0 + 1), h: Math.max(0, ry1 - ry0 + 1) };
}

/** Alpha from paper: pixels near paper become transparent, ink stays. threshold 0..255 below paper, softness is the ramp width. */
export function paperAlpha(chan, paper, threshold, softness = 24) {
  const out = new Uint8ClampedArray(chan.length);
  const soft = Math.max(1, softness);
  for (let i = 0; i < chan.length; i++) out[i] = Math.max(0, Math.min(255, ((paper - threshold - chan[i]) / soft + 0.5) * 255));
  return out;
}

/** Bounds of pixels with alpha above a level, or null when empty. */
export function alphaBounds(alpha, w, h, level = 40) {
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (alpha[y * w + x] > level) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Where each slice's anchor sits, so the drawings line up on the canvas.
 * mode: 'feet' (bottom centre of the ink), 'centre', 'layout' (positions as on the sheet).
 * bounds[i] is the ink bounds inside slice i, in slice pixels; cuts[i] is its place on the sheet.
 */
export function registrationOffsets(mode, cuts, bounds) {
  return cuts.map((c, i) => {
    const b = bounds[i] || { x: 0, y: 0, w: c.w, h: c.h };
    if (mode === 'feet') return { ax: b.x + b.w / 2, ay: b.y + b.h, sx: 0, sy: 0 };
    if (mode === 'centre') return { ax: b.x + b.w / 2, ay: b.y + b.h / 2, sx: 0, sy: 0 };
    // layout: anchor the slice's own origin, and shift by where it sat on the sheet relative to the first
    return { ax: 0, ay: 0, sx: c.x - cuts[0].x, sy: c.y - cuts[0].y };
  });
}
