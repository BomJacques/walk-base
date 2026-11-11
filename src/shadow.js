// Shadows. Two kinds: a ground shadow (a soft oval on the floor under a figure or a piece of scenery) and a drop shadow (the whole drawing cast a little way down and to the side,
// like a sticker lifted off the page). Each attachment can have a drop shadow of its own. The numbers here are pure; the painters need a canvas.

export const SHADOW_MODES = ['off', 'ground', 'drop', 'both'];
export const hasGround = (st) => st?.shadowMode === 'ground' || st?.shadowMode === 'both';
export const hasDrop = (st) => st?.shadowMode === 'drop' || st?.shadowMode === 'both';

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : lo));
const hex6 = (v, d = '#000000') => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
export const rgbaOf = (hex, a) => { const n = parseInt(hex6(hex).slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${clamp(a, 0, 1)})`; };

/** The drop shadow of one attachment, as stored: on or off, how far it falls, how soft, what colour. */
export const newShadow = () => ({ on: false, x: 6, y: 8, blur: 8, color: '#000000', opacity: 0.4 });
export function cleanShadow(raw) {
  const d = newShadow(); if (!raw || typeof raw !== 'object') return d;
  return { on: Boolean(raw.on), x: clamp(raw.x ?? d.x, -60, 60), y: clamp(raw.y ?? d.y, -60, 60), blur: clamp(raw.blur ?? d.blur, 0, 60), color: hex6(raw.color), opacity: clamp(raw.opacity ?? d.opacity, 0, 1) };
}
/** The stage's drop shadow, from the style settings. */
export const stageDrop = (st) => ({ on: hasDrop(st), x: st.shadowX ?? 14, y: st.shadowY ?? 18, blur: st.shadowBlur ?? 14, color: st.shadowColor ?? '#000000', opacity: st.shadowOpacity ?? 0.35 });

/** The oval a ground shadow covers, as world points on the ground at height y: centre [x, y, z], half sizes rx along the way it walks and rz across. */
export function groundOval(centre, rx, rz, n = 28) {
  return Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [centre[0] + rx * Math.cos(t), centre[1], centre[2] + rz * Math.sin(t)]; });
}
/** How strong a ground shadow is when the feet are `lift` above the ground: full on the ground, fading to nothing as the figure leaves it. */
export const groundStrength = (lift) => 1 / (1 + 3.5 * Math.max(0, lift));

let scratch = null;
/**
 * Paints something and casts a drop shadow of the whole of it. draw(c) paints onto the canvas context it is given, which has the same size and transform as ctx.
 * Returns whatever draw returns. o: { x, y, blur, color, opacity } in pixels at the 1080 line frame; k is the scale of the drawing.
 */
export function castShadow(ctx, o, k, draw) {
  if (!o?.on || typeof document === 'undefined' || !ctx.canvas) return draw(ctx);
  const cv = ctx.canvas; scratch ||= document.createElement('canvas');
  if (scratch.width !== cv.width || scratch.height !== cv.height) { scratch.width = cv.width; scratch.height = cv.height; }
  const sc = scratch.getContext('2d'); sc.setTransform(1, 0, 0, 1, 0, 0); sc.clearRect(0, 0, scratch.width, scratch.height); sc.setTransform(ctx.getTransform());
  const out = draw(sc);
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.shadowColor = rgbaOf(o.color, o.opacity); ctx.shadowBlur = Math.max(0, o.blur * k); ctx.shadowOffsetX = o.x * k; ctx.shadowOffsetY = o.y * k;
  ctx.drawImage(scratch, 0, 0); ctx.restore();
  return out;
}

/** A soft oval on the ground. project(worldPoint) gives { x, y }. Only the blurred shadow is drawn: the oval itself is painted far off the canvas and its shadow brought back. */
export function paintGroundShadow(ctx, project, st, k, centre, rx, rz, strength = 1) {
  const a = (st.shadowOpacity ?? 0.35) * clamp(strength, 0, 1); if (a <= 0.004) return;
  const size = clamp(st.shadowSize ?? 1, 0.2, 4); const pts = groundOval(centre, rx * size, rz * size).map(project);
  // seen from the level of the ground the oval is edge on and has no height: give it enough to be seen as a shadow
  const ys = pts.map((q) => q.y); const xs = pts.map((q) => q.x); const spanY = Math.max(...ys) - Math.min(...ys); const spanX = Math.max(...xs) - Math.min(...xs); const want = Math.max(spanX * 0.16, 4 * k);
  if (spanY < want) { const cy = (Math.max(...ys) + Math.min(...ys)) / 2; pts.forEach((q, i) => { q.y = cy + (want / 2) * Math.sin((i / pts.length) * Math.PI * 2); }); } // the points go round the oval once, so this is a flat oval of the height asked
  const off = (ctx.canvas?.width || 2000) + 400;
  ctx.save(); ctx.shadowColor = rgbaOf(st.shadowColor, a); ctx.shadowBlur = Math.max(1, (st.shadowBlur ?? 14) * k); ctx.shadowOffsetX = off; ctx.shadowOffsetY = 0; ctx.fillStyle = '#000';
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x - off, q.y) : ctx.moveTo(q.x - off, q.y))); ctx.closePath(); ctx.fill(); ctx.restore();
}
