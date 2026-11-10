// Paints a mouth shape (from lipsync.js) onto a canvas. `map` turns a point of the flat mouth plane [z, y] into a canvas point { x, y },
// so the same painter draws on the curved 3D head and on a flat chart.
//
// From the outside in: the lips (a band of colour with an outline), the opening, and inside it the teeth (only the middle of the row,
// never out to the corners), the tongue and the dark of the mouth.
import { mouthShape } from './lipsync.js';

export const MOUTH_COLORS = Object.freeze({ cavity: '#5b2c2c', teeth: '#ffffff', tongue: '#d9786f', lip: '#d98c8c' });

const ellipse = (cz, cy, rz, ry, n = 14) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [cz + rz * Math.cos(t), cy + ry * Math.sin(t)]; });
const TEETH_SPAN = 0.72; // the teeth cover the middle of the opening, a little under three quarters of its width

/**
 * id: a shape id. o: { line, lw, cavity, teeth, tongue, lip } and, for a mouth of another style, { style, width, lipK, smile }:
 * style 'full' is lips, teeth and tongue; 'line' has no lips; 'curve' is a plain line and a plain dark opening; 'cartoon' is a bold opening with a row of teeth and a tongue.
 * width stretches the mouth sideways, lipK is how thick the lips are (0 none), smile lifts (or, negative, drops) the corners.
 */
export function paintMouth(ctx, id, map, o) {
  const c = { ...MOUTH_COLORS, ...o };
  const sh0 = mouthShape(id); const style = c.style || 'full'; const wK = c.width ?? 1; const sm = c.smile ?? 0; const lipK = c.lipK ?? 1;
  const bend = (p) => [p[0] * wK, p[1] + sm * 0.1 * (p[0] / sh0.W) ** 2 - sm * 0.03]; // a smile lifts the corners and drops the middle a little
  const sh = { ...sh0, top: sh0.top.map(bend), bot: sh0.bot.map(bend), W: sh0.W * wK,
    teeth: style === 'curve' ? 0 : style === 'cartoon' ? Math.max(1, sh0.teeth) : sh0.teeth, tongue: style === 'curve' ? 0 : style === 'cartoon' ? (sh0.tongue || 1) : sh0.tongue, tuck: lipK > 0 ? sh0.tuck : false };
  const poly = (pts) => { ctx.beginPath(); pts.map(map).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };
  const line = (pts, w) => { ctx.beginPath(); pts.map(map).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.lineWidth = w; ctx.stroke(); };
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = c.line;
  const open = sh.H > 0.05;
  const N = sh.top.length; const mid = N >> 1;
  const yTopC = sh.top[mid][1]; const yBotC = sh.bot[mid][1];
  // the lips: the opening grown outward, thickest in the middle and meeting at the corners
  const tU = 0.04 * lipK; const tL = 0.055 * lipK;
  const grow = (k, up) => sh.top.map((p, i) => { const f = Math.sqrt(Math.max(0, 1 - (p[0] / sh.W) ** 2)); return up ? [p[0], p[1] + tU * f * k] : [p[0], sh.bot[i][1] - tL * f * k]; });
  const outerTop = grow(1, true); const outerBot = grow(1, false);
  const lips = [...outerTop, ...[...outerBot].reverse()];
  if (lipK > 0) { poly(lips); ctx.fillStyle = c.lip; ctx.fill(); }
  if (open) {
    const gap = [...sh.top, ...[...sh.bot].reverse()];
    poly(gap); ctx.fillStyle = c.cavity; ctx.fill();
    ctx.save(); poly(gap); ctx.clip();
    const td = Math.min(sh.H * 0.5, 0.09);
    const inner = (arr, i) => Math.abs(arr[i][0]) <= TEETH_SPAN * sh.W;
    const idx = [...Array(N).keys()].filter((i) => inner(sh.top, i));
    const taper = (i) => Math.pow(Math.max(0, 1 - (sh.top[i][0] / (TEETH_SPAN * sh.W)) ** 2), 0.35); // the row rounds off toward its ends
    if (sh.teeth >= 1) { poly([...idx.map((i) => sh.top[i]), ...[...idx].reverse().map((i) => [sh.top[i][0], sh.top[i][1] - td * taper(i)])]); ctx.fillStyle = c.teeth; ctx.fill(); }
    if (sh.teeth >= 2) { poly([...idx.map((i) => [sh.bot[i][0], sh.bot[i][1] + td * 0.85 * taper(i)]), ...[...idx].reverse().map((i) => sh.bot[i])]); ctx.fillStyle = c.teeth; ctx.fill(); }
    const tongue = (cz, cy, rz, ry) => { poly(ellipse(cz, cy, rz, ry)); ctx.fillStyle = c.tongue; ctx.fill(); ctx.strokeStyle = c.line; ctx.lineWidth = c.lw * 0.6; ctx.stroke(); };
    if (sh.tongue === 1) tongue(0, yBotC + sh.H * 0.3, sh.W * 0.62, sh.H * 0.38); // resting low in the mouth
    if (sh.tongue === 2) { tongue(0, yTopC - td - sh.H * 0.18, sh.W * 0.5, sh.H * 0.3); ctx.strokeStyle = c.line; ctx.lineWidth = c.lw * 0.5; line([[-sh.W * 0.3, yTopC - td - sh.H * 0.3], [sh.W * 0.3, yTopC - td - sh.H * 0.3]], c.lw * 0.5); } // the tip lifted to the top teeth
    if (sh.tuck) { // the lower lip rides up over the lower teeth
      poly([...sh.top.map((p) => [p[0], yTopC - td * 1.05]), ...[...sh.bot].reverse()]); ctx.fillStyle = c.lip; ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = c.line; line(sh.top, c.lw * 0.8); line(sh.bot, c.lw * 0.8);
    if (sh.tongue === 3) { // the tip of the tongue between the teeth, reaching over the lower lip
      const tip = ellipse(0, yBotC + sh.H * 0.18, sh.W * 0.5, sh.H * 0.42, 20);
      poly(tip); ctx.fillStyle = c.tongue; ctx.fill(); ctx.strokeStyle = c.line; ctx.lineWidth = c.lw * 0.8; ctx.stroke();
      line([[0, yBotC + sh.H * 0.4], [0, yBotC - sh.H * 0.08]], c.lw * 0.5);
    }
  } else {
    // shut or nearly shut: the seam between the lips; pressed lips have it heavier, with small ticks at the corners
    const seam = sh.top.map((p, i) => [p[0], (p[1] + sh.bot[i][1]) / 2]);
    line(seam, c.lw * (sh.press ? 1.3 : 1));
    if (sh.press) { const l = seam[0]; const r = seam[seam.length - 1]; line([[l[0] - 0.02, l[1] + 0.035], l], c.lw * 0.8); line([[r[0] + 0.02, r[1] + 0.035], r], c.lw * 0.8); }
  }
  // the outer edge of the lips
  if (lipK > 0) { ctx.strokeStyle = c.line; poly(lips); ctx.lineWidth = c.lw; ctx.stroke(); }
  ctx.restore();
}
