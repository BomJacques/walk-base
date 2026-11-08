// Paints a mouth shape (from lipsync.js) onto a canvas. `map` turns a point of the flat mouth plane [z, y] into a canvas point { x, y },
// so the same painter draws on the curved 3D head and on a flat chart.
import { mouthShape } from './lipsync.js';

export const MOUTH_COLORS = Object.freeze({ cavity: '#5b2c2c', teeth: '#ffffff', tongue: '#d9786f', lip: '#d98c8c' });

const ellipse = (cz, cy, rz, ry, n = 14) => Array.from({ length: n }, (_, i) => { const t = (i / n) * Math.PI * 2; return [cz + rz * Math.cos(t), cy + ry * Math.sin(t)]; });

/** id: a shape id. o: { line, lw, cavity, teeth, tongue, lip }. */
export function paintMouth(ctx, id, map, o) {
  const c = { ...MOUTH_COLORS, ...o };
  const sh = mouthShape(id);
  const poly = (pts) => { ctx.beginPath(); pts.map(map).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };
  const line = (pts, w) => { ctx.beginPath(); pts.map(map).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.lineWidth = w; ctx.stroke(); };
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = c.line;
  const open = sh.H > 0.05;
  const mid = sh.top.map((p, i) => [p[0], (p[1] + sh.bot[i][1]) / 2]);
  if (open) {
    const gap = [...sh.top, ...[...sh.bot].reverse()];
    poly(gap); ctx.fillStyle = c.cavity; ctx.fill();
    ctx.save(); poly(gap); ctx.clip();
    const midI = sh.top.length >> 1; const yTopC = sh.top[midI][1]; const yBotC = sh.bot[midI][1];
    const td = Math.min(sh.H * 0.5, 0.1);
    if (sh.tongue === 1) { poly(ellipse(0, yBotC + sh.H * 0.3, sh.W * 0.62, sh.H * 0.34)); ctx.fillStyle = c.tongue; ctx.fill(); }
    if (sh.tongue === 2) { poly(ellipse(0, yTopC - sh.H * 0.5, sh.W * 0.5, sh.H * 0.3)); ctx.fillStyle = c.tongue; ctx.fill(); }
    if (sh.teeth >= 1) { poly([...sh.top, ...sh.top.map((p) => [p[0], p[1] - td]).reverse()]); ctx.fillStyle = c.teeth; ctx.fill(); }
    if (sh.teeth >= 2) { poly([...sh.bot.map((p) => [p[0], p[1] + td * 0.9]), ...[...sh.bot].reverse()]); ctx.fillStyle = c.teeth; ctx.fill(); }
    if (sh.tongue === 3) { poly(ellipse(0, (yTopC + yBotC) / 2, sh.W * 0.7, sh.H * 0.2)); ctx.fillStyle = c.tongue; ctx.fill(); }
    if (sh.tuck) { // the lower lip rides up over the lower teeth
      poly([...sh.top.map((p) => [p[0], yTopC - td * 1.05 - (1 - Math.abs(p[0]) / sh.W) * 0.0]), ...[...sh.bot].reverse()]);
      ctx.fillStyle = c.lip; ctx.fill();
      line(sh.top.map((p) => [p[0], yTopC - td * 1.05]), c.lw * 0.8);
    }
    ctx.restore();
    ctx.strokeStyle = c.line; line(sh.top, c.lw); line(sh.bot, c.lw);
    ctx.beginPath(); // the two corners join the lines up
  } else {
    // shut or nearly shut: one lip line; pressed lips are heavier and have small corner ticks
    line(mid, c.lw * (sh.press ? 1.7 : 1.25));
    if (sh.press) { const l = mid[0]; const r = mid[mid.length - 1]; line([[l[0] - 0.02, l[1] + 0.03], l], c.lw * 0.9); line([[r[0] + 0.02, r[1] + 0.03], r], c.lw * 0.9); }
  }
  ctx.restore();
}
