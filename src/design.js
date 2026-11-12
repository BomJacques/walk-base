// Character design: what each part of a figure looks like, on top of the look of the whole stage.
// Every part (a head, a forearm, a tail) can have its own colour, line, opacity, drop shadow and a skin: a picture stretched or tiled over the part through a UV map,
// optionally a sprite sheet whose cells play in turn, so a part can be coloured by painting a flat sheet and the colour follows the part as it moves.
// Pure geometry and numbers here; draw.js paints the skins.
import { newShadow, cleanShadow } from './shadow.js';

export const FITS = ['stretch', 'tile'];
export const ANIMS = ['none', 'loop', 'pingpong'];
export const BLENDS = [['source-over', 'Normal'], ['multiply', 'Multiply'], ['screen', 'Screen'], ['overlay', 'Overlay']];
const clamp = (v, lo, hi, d) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const hex6 = (v, d = '') => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);

/** The key a part is stored under: its name, and which side it is on. */
export const partKey = (part, side) => (side ? `${part}.${side}` : String(part));

export const newSkin = (img = '') => ({ img, cols: 1, rows: 1, cell: 0, fit: 'stretch', u: 0, v: 0, su: 1, sv: 1, rot: 0, flip: false, opacity: 1, blend: 'source-over', anim: 'none', cellFrames: 2 });
export const newPart = () => ({ fill: '', line: '', lineW: 1, opacity: 1, visible: true, shadow: newShadow(), skin: null, ink: null });

/**
 * Drawing on a part: pen strokes kept in the part's UV box (u along the part, v across it), so the drawing turns and moves with the part.
 * ink: { replace, strokes: [{ c: colour, w: width as a fraction of the part's size, a: opacity, fill: a closed filled shape, pts: [[u, v], ...] }] }
 * A point may carry a third number, [u, v, p]: the width factor there (0 to 1, 0.5 is the width asked for), from the pencil's pressure or the pen's speed; a stroke that has them is painted as a smooth tapered ribbon (stroke.js).
 * tp (1 or 2 or 3, rare) says the start (1) or end (2) of a stroke goes on into another stroke, so it is not tapered there.
 * With replace, the drawing stands in for the part's own shape.
 */
/** The brushes: [id, name]. A stroke that names none is round. */
export const BRUSHES = [['round', 'Round'], ['marker', 'Marker'], ['calligraphy', 'Calligraphy'], ['taper', 'Brush pen'], ['pencil', 'Pencil'], ['chalk', 'Chalk'], ['soft', 'Soft'], ['dotted', 'Dotted'], ['dashed', 'Dashed']];
export const MAX_STROKES = 300; export const MAX_STROKE_PTS = 500;
const r3 = (v) => Math.round(v * 1000) / 1000;
export function cleanStroke(raw) {
  if (!raw || typeof raw !== 'object' || !(Array.isArray(raw.pts) || Array.isArray(raw.loops))) return null;
  const pts = []; for (const q of (Array.isArray(raw.pts) ? raw.pts : []).slice(0, MAX_STROKE_PTS)) { if (Array.isArray(q) && Number.isFinite(+q[0]) && Number.isFinite(+q[1])) pts.push(q.length > 2 && Number.isFinite(+q[2]) && q[2] !== null && q[2] !== '' ? [r3(clamp(q[0], -3, 4, 0.5)), r3(clamp(q[1], -3, 4, 0.5)), Math.round(clamp(q[2], 0, 1, 0.5) * 100) / 100] : [r3(clamp(q[0], -3, 4, 0.5)), r3(clamp(q[1], -3, 4, 0.5))]); }
  let loops = null;
  if (Array.isArray(raw.loops)) loops = raw.loops.slice(0, 8).map((l) => (Array.isArray(l) ? l.slice(0, 400).filter((q) => Array.isArray(q) && Number.isFinite(+q[0]) && Number.isFinite(+q[1])).map((q) => [r3(clamp(q[0], -3, 4, 0.5)), r3(clamp(q[1], -3, 4, 0.5))]) : [])).filter((l) => l.length >= 3);
  if (loops && !loops.length) loops = null;
  if (!pts.length && loops) pts.push(...loops[0].slice(0, MAX_STROKE_PTS));
  if (!pts.length) return null;
  const f = Number.isFinite(+raw.f) && raw.f !== null && raw.f !== '' ? Math.round(clamp(raw.f, 0, 99999, 0)) : null; // a stroke may belong to one frame only
  const seg = Number.isFinite(+raw.g) && raw.g !== null && raw.g !== '' ? Math.round(clamp(raw.g, 0, 7, 0)) : 0; // and to one piece of a part that is drawn in pieces (the thigh and the shin of a leg)
  return { c: hex6(raw.c, '#000000'), w: r3(clamp(raw.w, 0.002, 0.6, 0.03)), a: clamp(raw.a, 0.02, 1, 1), fill: Boolean(raw.fill || loops), ...(BRUSHES.some(([b]) => b === raw.b) && raw.b !== 'round' ? { b: raw.b } : {}), ...(loops ? { loops } : {}), ...(f === null ? {} : { f }), ...(seg ? { g: seg } : {}), ...(pts.length > 1 && pts[0].length > 2 && (raw.tp | 0) & 3 ? { tp: (raw.tp | 0) & 3 } : {}), pts };
}
export function cleanInk(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.strokes)) return null;
  const strokes = raw.strokes.slice(0, MAX_STROKES).map(cleanStroke).filter(Boolean); const blank = Boolean(raw.blank && raw.replace); if (!strokes.length && !blank) return null; // a part started blank is kept with nothing drawn on it yet
  return { replace: Boolean(raw.replace), ...(blank ? { blank: true } : {}), strokes };
}
/** Whether a stroke shows on a frame: one with no frame of its own shows on every frame. */
export const strokeShows = (s, frame) => s.f == null || s.f === frame;
/** Thins a stroke that was just drawn: points closer together than `gap` (in the same units as the points) are dropped, the last one is always kept. */
export function thinStroke(pts, gap) {
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]]; for (let i = 1; i < pts.length - 1; i++) { const l = out[out.length - 1]; if (Math.hypot(pts[i][0] - l[0], pts[i][1] - l[1]) >= gap) out.push(pts[i]); } out.push(pts[pts.length - 1]); return out;
}

export function cleanSkin(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.img !== 'string' || !raw.img) return null;
  const cols = Math.round(clamp(raw.cols, 1, 16, 1)); const rows = Math.round(clamp(raw.rows, 1, 16, 1));
  return {
    img: raw.img.slice(0, 40), cols, rows, cell: Math.round(clamp(raw.cell, 0, cols * rows - 1, 0)), fit: FITS.includes(raw.fit) ? raw.fit : 'stretch',
    u: clamp(raw.u, -2, 2, 0), v: clamp(raw.v, -2, 2, 0), su: clamp(raw.su, 0.05, 10, 1), sv: clamp(raw.sv, 0.05, 10, 1), rot: clamp(raw.rot, -360, 360, 0), flip: Boolean(raw.flip),
    opacity: clamp(raw.opacity, 0, 1, 1), blend: BLENDS.some(([b]) => b === raw.blend) ? raw.blend : 'source-over', anim: ANIMS.includes(raw.anim) ? raw.anim : 'none', cellFrames: Math.round(clamp(raw.cellFrames, 1, 48, 2)),
  };
}
export function cleanPart(raw) {
  const p = newPart(); if (!raw || typeof raw !== 'object') return p;
  return { fill: hex6(raw.fill), line: hex6(raw.line), lineW: clamp(raw.lineW, 0, 5, 1), opacity: clamp(raw.opacity, 0, 1, 1), visible: raw.visible !== false, shadow: cleanShadow(raw.shadow), skin: cleanSkin(raw.skin), ink: cleanInk(raw.ink) };
}
/** A part that says nothing: the stage's own look applies, so there is no need to keep it. */
export const isPlain = (p) => !p || (!p.fill && !p.line && p.lineW === 1 && p.opacity === 1 && p.visible && !p.shadow?.on && !p.skin && !p.ink);
/** { figure: { key: part } }, cleaned and with the plain parts left out. */
export function cleanDesign(raw, figs) {
  const out = {}; if (!raw || typeof raw !== 'object') return out;
  for (const f of figs) {
    const src = raw[f]; if (!src || typeof src !== 'object') continue; const one = {};
    for (const [k, v] of Object.entries(src).slice(0, 80)) { const p = cleanPart(v); if (!isPlain(p)) one[String(k).slice(0, 40)] = p; }
    if (Object.keys(one).length) out[f] = one;
  }
  return out;
}

/** Which cell of a sprite sheet is showing at a frame: the one chosen, or each in turn, `cellFrames` frames to a cell. */
export function cellFor(skin, frame) {
  const n = Math.max(1, skin.cols * skin.rows); if (n === 1) return 0;
  if (!skin.anim || skin.anim === 'none') return Math.min(n - 1, Math.max(0, skin.cell));
  const i = Math.floor(Math.max(0, frame) / Math.max(1, skin.cellFrames));
  if (skin.anim === 'loop') return i % n;
  const m = i % (2 * n - 2 || 1); return m < n ? m : 2 * n - 2 - m; // pingpong: 0 1 2 3 2 1 0 1 ...
}

/**
 * The frame of a part on the screen, which its UV map lies on: a box whose long way (u) runs from the joint it swings from toward the middle of the part, and whose short way (v) is across it.
 * pts: the outline [[x, y], ...]; pivot: { x, y } the joint, or null. Returns { cx, cy, ax, ay, L, W }: the centre, the unit direction of u, and the sizes.
 */
export function shapeFrame(pts, pivot = null) {
  let cx = 0; let cy = 0; for (const [x, y] of pts) { cx += x; cy += y; } cx /= pts.length; cy /= pts.length;
  let ax; let ay;
  if (pivot && Math.hypot(cx - pivot.x, cy - pivot.y) > 1.5) { ax = cx - pivot.x; ay = cy - pivot.y; }
  else { let fd = -1; for (const [x, y] of pts) { const d = (x - cx) ** 2 + (y - cy) ** 2; if (d > fd) { fd = d; ax = x - cx; ay = y - cy; } } if (ax < 0 || (ax === 0 && ay < 0)) { ax = -ax; ay = -ay; } }
  const l = Math.hypot(ax, ay) || 1; ax /= l; ay /= l;
  let u0 = Infinity; let u1 = -Infinity; let v0 = Infinity; let v1 = -Infinity;
  for (const [x, y] of pts) { const u = (x - cx) * ax + (y - cy) * ay; const v = -(x - cx) * ay + (y - cy) * ax; if (u < u0) u0 = u; if (u > u1) u1 = u; if (v < v0) v0 = v; if (v > v1) v1 = v; }
  // centre the box on the extents, not the average of the points
  const mu = (u0 + u1) / 2; const mv = (v0 + v1) / 2;
  return { cx: cx + ax * mu - ay * mv, cy: cy + ay * mu + ax * mv, ax, ay, L: Math.max(1e-6, u1 - u0), W: Math.max(1e-6, v1 - v0) };
}
/** A point of the screen as a point of the part's UV box (0 to 1 each way across it). */
export function toUV(fr, x, y) {
  if (fr.to) return fr.to(x, y); if (fr.spine) return spineToUV(fr, x, y);
  return [((x - fr.cx) * fr.ax + (y - fr.cy) * fr.ay) / fr.L + 0.5, (-(x - fr.cx) * fr.ay + (y - fr.cy) * fr.ax) / fr.W + 0.5];
}
/** A point of the UV box as a point of the screen. */
export function fromUV(fr, u, v) {
  if (fr.from) return fr.from(u, v); if (fr.spine) return spineFromUV(fr, u, v);
  return [fr.cx + fr.ax * (u - 0.5) * fr.L - fr.ay * (v - 0.5) * fr.W, fr.cy + fr.ay * (u - 0.5) * fr.L + fr.ax * (v - 0.5) * fr.W];
}

/**
 * The frame of a bent part (a rubber hose limb, a tail, a neck): its UV runs along the curve it is drawn on, so a drawing or a skin on it bends as it bends.
 * pts: the points down the middle, from the joint it swings from, [{x, y}, ...]; radii: its half width at each. u is the share of the way along the curve, v is across it (0.5 on the line, a half width is 0.25).
 */
export function spineFrame(pts, radii) {
  const P = pts.map((p) => [p.x, p.y]); const cum = [0]; for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const total = Math.max(1e-6, cum[cum.length - 1]); const W = Math.max(1e-6, 2 * Math.max(...radii));
  return { spine: true, P, cum, total, L: total, W, cx: P.reduce((t, q) => t + q[0], 0) / P.length, cy: P.reduce((t, q) => t + q[1], 0) / P.length };
}
function spineToUV(fr, x, y) {
  const { P, cum, total, W } = fr; let best = Infinity; let arc = 0; let off = 0;
  for (let i = 0; i < P.length - 1; i++) {
    const ax = P[i][0]; const ay = P[i][1]; const dx = P[i + 1][0] - ax; const dy = P[i + 1][1] - ay; const l = Math.hypot(dx, dy); if (l < 1e-9) continue;
    const tx = dx / l; const ty = dy / l; let t = ((x - ax) * tx + (y - ay) * ty); if (i > 0) t = Math.max(0, t); if (i < P.length - 2) t = Math.min(l, t); // beyond the ends the end segments carry straight on
    const d = Math.hypot(x - (ax + tx * t), y - (ay + ty * t)); if (d < best - 1e-9) { best = d; arc = cum[i] + t; off = (x - ax) * -ty + (y - ay) * tx; }
  }
  return [arc / total, 0.5 + off / W];
}
function spineFromUV(fr, u, v) {
  const { P, cum, total, W } = fr; const arc = u * total; let i = 0; while (i < P.length - 2 && arc > cum[i + 1]) i++;
  let k = i; while (k < P.length - 2 && Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]) < 1e-9) k++;
  const dx = P[k + 1][0] - P[k][0]; const dy = P[k + 1][1] - P[k][1]; const l = Math.hypot(dx, dy) || 1; const tx = dx / l; const ty = dy / l; const t = arc - cum[k];
  const o = (v - 0.5) * W; return [P[k][0] + tx * t - ty * o, P[k][1] + ty * t + tx * o];
}
/** The UV frame of a drawn shape: along its curve when it has one (a hose limb), else the box round it. */
export const partFrame = (sh, pivot) => (sh.spine ? spineFrame(sh.spine, sh.spineR) : shapeFrame(sh.pts, pivot));

/** Where a point of a cell of the picture (0 to 1 each way) falls in the UV box, with the skin's offset, scale, turn and flip. */
export function cellToUV(skin, s, t) {
  const r = (skin.rot * Math.PI) / 180; const c = Math.cos(r); const si = Math.sin(r);
  const x = (skin.flip ? 0.5 - s : s - 0.5) * skin.su; const y = (t - 0.5) * skin.sv;
  return [0.5 + skin.u + x * c - y * si, 0.5 + skin.v + x * si + y * c];
}
/** The other way: where in the cell a point of the UV box looks. */
export function uvToCell(skin, u, v) {
  const r = (skin.rot * Math.PI) / 180; const c = Math.cos(r); const si = Math.sin(r);
  const dx = u - 0.5 - skin.u; const dy = v - 0.5 - skin.v; const x = (dx * c + dy * si) / skin.su; const y = (-dx * si + dy * c) / skin.sv;
  return [skin.flip ? 0.5 - x : 0.5 + x, 0.5 + y];
}
/**
 * The transform [a, b, c, d, e, f] that takes pixels of a cell (cw by ch) to the screen, so the cell lies over the part as the skin says.
 * It is the composition of cellToUV and fromUV, written out as a matrix.
 */
export function skinMatrix(fr, skin, cw, ch) {
  const p0 = (() => { const [u, v] = cellToUV(skin, 0, 0); return fromUV(fr, u, v); })();
  const px = (() => { const [u, v] = cellToUV(skin, 1, 0); return fromUV(fr, u, v); })();
  const py = (() => { const [u, v] = cellToUV(skin, 0, 1); return fromUV(fr, u, v); })();
  return [(px[0] - p0[0]) / cw, (px[1] - p0[1]) / cw, (py[0] - p0[0]) / ch, (py[1] - p0[1]) / ch, p0[0], p0[1]];
}

/** The cells of a UV sheet for a list of parts: a grid, one cell for each. */
export function atlasLayout(keys) {
  const n = Math.max(1, keys.length); const cols = Math.ceil(Math.sqrt(n)); const rows = Math.ceil(n / cols);
  return { cols, rows, cells: Object.fromEntries(keys.map((k, i) => [k, i])) };
}
/** A skin that uses one cell of a sheet, for a part. */
export const atlasSkin = (img, layout, key) => ({ ...newSkin(img), cols: layout.cols, rows: layout.rows, cell: layout.cells[key] ?? 0, fit: 'stretch' });
