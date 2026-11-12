// Painting the strokes of a drawing. A stroke's points are in UV (0 to 1 across the thing drawn on); `map` takes a UV point to the canvas.
import { strokeShows } from './design.js';

/**
 * Paints strokes that show on `frame`. `size` is the size of the thing drawn on, in the canvas's units: a stroke's width is a share of it.
 * `minW` is the thinnest line to draw. Strokes are smoothed through the midpoints of their points; a fill stroke is a closed, filled shape.
 */
export function paintStrokes(ctx, strokes, map, size, frame = 0, minW = 0.6) {
  if (!strokes?.length) return;
  const base = ctx.globalAlpha; ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const s of strokes) {
    if (!strokeShows(s, frame)) continue;
    const P = s.pts.map(([u, v]) => map(u, v)); ctx.globalAlpha = base * s.a; ctx.beginPath();
    if (P.length === 1) { ctx.arc(P[0][0], P[0][1], Math.max(minW, (s.w * size) / 2), 0, Math.PI * 2); ctx.fillStyle = s.c; ctx.fill(); continue; }
    ctx.moveTo(P[0][0], P[0][1]);
    for (let i = 1; i < P.length - 1; i++) ctx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i + 1][0]) / 2, (P[i][1] + P[i + 1][1]) / 2);
    ctx.lineTo(P[P.length - 1][0], P[P.length - 1][1]);
    if (s.fill) { ctx.closePath(); ctx.fillStyle = s.c; ctx.fill(); } else { ctx.strokeStyle = s.c; ctx.lineWidth = Math.max(minW, s.w * size); ctx.stroke(); }
  }
  ctx.restore();
}
