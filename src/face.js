// The eyes and eyebrows of the two-legged figures, drawn on the front of the head. `map` turns a point of the flat face [z, y] (in head radii from the middle of the head,
// z across, y up) into a canvas point { x, y }, so the same painter bends the face onto the 3D head from any angle.

export const EYE_STYLES = ['default', 'dots', 'round', 'pie', 'almond', 'closed'];
export const BROW_STYLES = ['none', 'line', 'thick', 'arched'];
export const MOUTH_STYLES = ['full', 'line', 'curve', 'cartoon'];

/** Where each figure's eyes sit and how big they are, before the sliders. */
export const EYE_BASE = Object.freeze({ hose: { z: 0.3, y: 0.3, rx: 0.21, ry: 0.3 }, mannequin: { z: 0.36, y: 0.16, rx: 0.15, ry: 0.19 } });

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : lo));
const frac = (x) => x - Math.floor(x);

/** How far the lids are shut at this point of the cycle, 0 open to 1 shut: the resting lid, or a blink. rate is blinks in a cycle (a whole number, so a cycle loops). */
export function lidAt(st, u) {
  const rest = clamp(st.eyeLid ?? 0, 0, 1); const n = Math.round(clamp(st.blinkRate ?? 0, 0, 4));
  if (!n) return rest;
  const ph = frac((u || 0) * n + 0.37); // not on the first frame, so a still of frame 1 has open eyes
  const blink = ph < 0.05 ? 1 : ph < 0.1 ? 0.55 : 0;
  return Math.max(rest, blink);
}

/** The outline of one eye about [cz, cy]: an ellipse, or a lens with pointed corners. */
export function eyeOutline(style, cz, cy, rx, ry, n = 24) {
  return Array.from({ length: n }, (_, i) => {
    const t = (i / n) * Math.PI * 2; const s = Math.sin(t);
    return style === 'almond' ? [cz + rx * 1.15 * Math.cos(t), cy + ry * 0.62 * Math.sign(s) * Math.pow(Math.abs(s), 1.5)] : [cz + rx * Math.cos(t), cy + ry * s];
  });
}

/**
 * Paints both eyes in the chosen style. Returns false (and paints nothing) when the style is 'default', so the caller draws the figure's own eyes.
 * o: { base: EYE_BASE entry, lw, line, skin, u }.
 */
export function paintEyes(ctx, map, st, o) {
  const style = EYE_STYLES.includes(st.eyeStyle) ? st.eyeStyle : 'default';
  if (style === 'default') return false;
  const b = o.base; const k = clamp(st.eyeSize ?? 1, 0.3, 3); const rx = b.rx * k; const ry = b.ry * k;
  const cy = b.y + clamp(st.eyeHeight ?? 0, -0.6, 0.6); const gap = b.z * clamp(st.eyeSpacing ?? 1, 0.3, 2);
  const lx = clamp(st.eyeLookX ?? 0, -1, 1); const ly = clamp(st.eyeLookY ?? 0, -1, 1); const lid = lidAt(st, o.u); const ink = st.eyeColor || '#111111';
  const poly = (pts) => { ctx.beginPath(); pts.map(map).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };
  const line = (pts, w) => { ctx.beginPath(); pts.map(map).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.lineWidth = w; ctx.strokeStyle = o.line; ctx.stroke(); };
  const arc = (cz, c2, r1, r2, up) => Array.from({ length: 11 }, (_, i) => { const t = Math.PI * (i / 10); return [cz - r1 * Math.cos(t), c2 + (up ? 1 : -1) * r2 * Math.sin(t)]; });
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const sg of [1, -1]) {
    const cz = sg * gap;
    if (style === 'closed' || lid >= 0.95) { line(arc(cz, cy, rx * 0.9, ry * 0.35, style === 'closed'), o.lw * 1.2); continue; } // a happy closed eye curves up, a blink curves down
    if (style === 'dots') { poly(eyeOutline('round', cz + lx * rx * 0.3, cy + ly * ry * 0.3, rx * 0.36, ry * 0.36 * (1 - 0.7 * lid), 16)); ctx.fillStyle = ink; ctx.fill(); continue; }
    const shape = eyeOutline(style, cz, cy, rx, ry);
    poly(shape); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.save(); poly(shape); ctx.clip();
    const pz = cz + lx * rx * 0.45; const py = cy + ly * ry * 0.4 - (style === 'almond' ? 0 : ry * 0.12);
    if (style === 'almond') { poly(eyeOutline('round', pz, py, ry * 0.6, ry * 0.6, 18)); ctx.fillStyle = ink; ctx.fill(); poly(eyeOutline('round', pz, py, ry * 0.27, ry * 0.27, 12)); ctx.fillStyle = '#111111'; ctx.fill(); }
    else {
      const pr = [rx * 0.54, ry * 0.64]; poly(eyeOutline('round', pz, py, pr[0], pr[1], 18)); ctx.fillStyle = ink; ctx.fill();
      if (style === 'pie') { const R = Math.max(pr[0], pr[1]) * 1.5; ctx.save(); poly(eyeOutline('round', pz, py, pr[0], pr[1], 18)); ctx.clip(); poly([[pz, py], [pz + R * Math.cos(0.45), py + R * Math.sin(0.45)], [pz + R * Math.cos(1.15), py + R * Math.sin(1.15)]]); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore(); }
    }
    if (lid > 0.01) { // the lid comes down over the eye, the colour of the face
      const yl = cy + ry - 2 * ry * lid; const w = rx * 1.4;
      poly([[cz - w, cy + ry * 1.2], [cz + w, cy + ry * 1.2], [cz + w, yl], [cz - w, yl]]); ctx.fillStyle = o.skin; ctx.fill();
      line([[cz - w, yl], [cz + w, yl]], o.lw);
    }
    ctx.restore();
    poly(shape); ctx.strokeStyle = o.line; ctx.lineWidth = o.lw; ctx.stroke();
  }
  ctx.restore();
  return true;
}

/** Paints the eyebrows, if a style is chosen. They sit above the eyes wherever those are, raise and lower, and tilt in (a frown) or out (worry). */
export function paintBrows(ctx, map, st, o) {
  const style = BROW_STYLES.includes(st.browStyle) ? st.browStyle : 'none';
  if (style === 'none') return false;
  const b = o.base; const k = clamp(st.eyeSize ?? 1, 0.3, 3); const rx = b.rx * k; const ry = b.ry * k;
  const cy = b.y + clamp(st.eyeHeight ?? 0, -0.6, 0.6); const gap = b.z * clamp(st.eyeSpacing ?? 1, 0.3, 2);
  const by = cy + ry + 0.1 + clamp(st.browRaise ?? 0, -1, 1) * 0.14; const tilt = clamp(st.browFurrow ?? 0, -1, 1) * 0.11;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = o.browLine || o.line; ctx.lineWidth = o.lw * (style === 'thick' ? 2.6 : 1.2);
  for (const sg of [1, -1]) {
    const cz = sg * gap; const inner = [cz - sg * rx * 0.95, by - tilt]; const outer = [cz + sg * rx * 1.05, by + tilt * 0.6];
    const pts = style === 'arched' ? [inner, [cz, by + 0.07 + ry * 0.1], outer] : [inner, outer];
    ctx.beginPath(); pts.map(map).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
  }
  ctx.restore();
  return true;
}

/** The mouth settings of a style, as the options the mouth painter takes. */
export function mouthOptions(st, lw) {
  const style = MOUTH_STYLES.includes(st.mouthStyle) ? st.mouthStyle : 'full';
  return {
    line: st.lineColor, lw: lw * (style === 'cartoon' ? 1.5 : 1), style, width: clamp(st.mouthWidth ?? 1, 0.4, 2), lipK: style === 'full' ? clamp(st.lipThickness ?? 1, 0, 3) : 0, smile: clamp(st.mouthSmile ?? 0, -1, 1),
    lip: st.lipColor || '#d98c8c', teeth: st.teethColor || '#ffffff', tongue: st.tongueColor || '#d9786f', cavity: st.cavityColor || '#5b2c2c',
  };
}
