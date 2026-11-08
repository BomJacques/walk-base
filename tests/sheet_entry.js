import { drawScene, STYLE_DEFAULTS } from '../src/draw.js';
import { DEFAULTS } from '../src/rig.js';
window.sheet = (over = {}, st = {}, n = 12, cols = 6, w = 400, h = 340, only = null) => {
  const idx = only || Array.from({ length: n }, (_, i) => i);
  const p = { ...DEFAULTS, cycleFrames: n, ...over };
  const s = { ...STYLE_DEFAULTS, ...st };
  const rows = Math.ceil(idx.length / cols);
  const c = document.createElement('canvas'); c.width = cols * w; c.height = rows * h;
  const ctx = c.getContext('2d');
  const t = document.createElement('canvas'); t.width = w; t.height = h;
  idx.forEach((i, j) => {
    drawScene(t.getContext('2d'), p, s, w, h, i);
    ctx.drawImage(t, (j % cols) * w, Math.floor(j / cols) * h);
    ctx.strokeStyle = '#999'; ctx.strokeRect((j % cols) * w + .5, Math.floor(j / cols) * h + .5, w - 1, h - 1);
    ctx.fillStyle = '#c00'; ctx.font = '16px sans-serif'; ctx.fillText(String(i + 1), (j % cols) * w + w - 28, Math.floor(j / cols) * h + 22);
  });
  return c.toDataURL('image/png');
};
