// Automation lane editor: one parameter over the whole performance. Tap to add a point, drag to move, double-tap to remove, or draw freehand.
// Unlike the cycle curve editor this one does not wrap: time runs from the first frame to the last.
import { laneValue, thinPoints, replaceSpan } from './automation.js';

/** Pure editing helpers, exported for tests. */
export function moveLanePoint(pts, index, t, v, T) {
  const lo = index > 0 ? pts[index - 1].t + 1 : 0;
  const hi = index < pts.length - 1 ? pts[index + 1].t - 1 : T - 1;
  pts[index] = { t: Math.round(Math.min(hi, Math.max(lo, t))), v };
  return pts;
}
export function insertLanePoint(pts, t, v) {
  const tt = Math.round(t);
  if (pts.some((q) => q.t === tt)) return pts.map((q) => (q.t === tt ? { t: tt, v } : q));
  return [...pts, { t: tt, v }].sort((a, b) => a.t - b.t);
}
export const removeLanePoint = (pts, index) => pts.filter((_, i) => i !== index);
/** Freehand stroke: samples [{t,v}] replace the lane between the stroke's first and last frame. */
export function strokeLane(lane, stroke, eps) {
  if (stroke.length < 2) return lane;
  const s = stroke.slice().sort((a, b) => a.t - b.t);
  const byFrame = new Map();
  for (const q of s) { const k = Math.round(q.t); byFrame.set(k, q.v); }
  const pts = [...byFrame.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t, v }));
  if (pts.length < 2) return lane;
  return replaceSpan(lane, pts[0].t, pts[pts.length - 1].t, thinPoints(pts, eps));
}

// ---- lane tools: pure helpers on whole lanes {pts:[{t,v}], interp} ----
const clampT = (t, T) => Math.max(0, Math.min(T - 1, Math.round(t)));

/** A copy of the lane between frames t0 and t1 (inclusive), as points relative to t0. Edge values are included so the shape is exact. */
export function copySpan(lane, t0, t1, base = 0) {
  const a = Math.round(Math.min(t0, t1)); const b = Math.round(Math.max(t0, t1));
  if (!lane?.pts?.length || b <= a) return null;
  const inside = lane.pts.filter((q) => q.t > a && q.t < b).map((q) => ({ dt: q.t - a, v: q.v }));
  const pts = [{ dt: 0, v: laneValue(lane, a, base) }, ...inside, { dt: b - a, v: laneValue(lane, b, base) }];
  return { len: b - a, pts, interp: lane.interp === 'linear' ? 'linear' : 'smooth' };
}
/** Puts a copied span down starting at frame `at`, replacing whatever the lane had there. Stops at the end of the performance (T frames). */
export function pasteSpan(lane, clip, at, T) {
  if (!clip) return lane;
  const start = Math.max(0, Math.round(at)); const end = Math.min(T - 1, start + clip.len);
  if (end <= start) return lane;
  const fresh = clip.pts.map((q) => ({ t: start + q.dt, v: q.v })).filter((q) => q.t <= end);
  // If the span was cut short, close it with the value the shape had there so the end is not left hanging.
  if (fresh[fresh.length - 1].t < end) { const last = fresh[fresh.length - 1]; const next = clip.pts.find((q) => start + q.dt > end); if (next) { const f = (end - last.t) / (start + next.dt - last.t); fresh.push({ t: end, v: last.v + (next.v - last.v) * f }); } }
  return { interp: clip.interp, ...(lane || {}), pts: replaceSpan(lane, start, end, fresh).pts };
}
/** Moves every point later (or earlier, if dt is negative) by dt frames. Points pushed past either end are dropped, and the lane holds its end values. */
export function shiftLane(lane, dt, T) {
  if (!lane?.pts?.length) return lane;
  const moved = lane.pts.map((q) => ({ t: Math.round(q.t + dt), v: q.v })).filter((q) => q.t >= 0 && q.t <= T - 1);
  return { ...lane, pts: moved.length ? moved : lane.pts.slice(-1).map((q) => ({ t: clampT(q.t + dt, T), v: q.v })) };
}
/** Repeats the span t0..t1 end to end after itself, until frame `until`. */
export function loopSpan(lane, t0, t1, until, T, base = 0) {
  const clip = copySpan(lane, t0, t1, base);
  if (!clip) return lane;
  let out = lane;
  for (let at = Math.round(Math.max(t0, t1)); at < Math.min(until, T - 1); at += clip.len) out = pasteSpan(out, clip, at, Math.min(until, T - 1) + 1);
  return out;
}
/** The target for the other side of a left and right channel, or null. */
export const mirrorTarget = (target) => { const m = target.match(/^(c:.+)\.(R|L)(:(?:amount|offset))$/); return m ? `${m[1]}.${m[2] === 'R' ? 'L' : 'R'}${m[3]}` : null; };

export class LaneEditor {
  /** api: { getLane(), setLane(lane), length(), frame(), scrub(f), view(): { lo, hi, to(v), from(v), unit, base } } */
  constructor(host, target, api) {
    this.host = host; this.target = target; this.api = api; this.mode = 'handles';
    this.canvas = document.createElement('canvas'); this.canvas.className = 'curve-canvas'; this.canvas.style.touchAction = 'none';
    host.append(this.canvas);
    this.drag = null; this.stroke = null; this.lastTap = null;
    this.bind();
    this.ro = new ResizeObserver(() => this.draw()); this.ro.observe(host);
    this.draw();
  }

  destroy() { this.ro.disconnect(); this.canvas.remove(); }
  setMode(m) { this.mode = m; this.draw(); }
  lane() { return this.api.getLane() || { pts: [], interp: 'smooth' }; }
  layout() { return { w: this.canvas.clientWidth, h: this.canvas.clientHeight, l: 50, r: 10, t: 34, b: 24 }; }
  view() { return this.api.view(); }
  tx(t, L) { return L.l + (t / Math.max(1, this.api.length() - 1)) * (L.w - L.l - L.r); }
  vy(v, L) { const V = this.view(); return L.t + (1 - (V.to(v) - V.lo) / (V.hi - V.lo)) * (L.h - L.t - L.b); }
  fromXY(x, y, L) {
    const V = this.view();
    const t = Math.min(this.api.length() - 1, Math.max(0, ((x - L.l) / (L.w - L.l - L.r)) * (this.api.length() - 1)));
    const disp = V.lo + (1 - (y - L.t) / (L.h - L.t - L.b)) * (V.hi - V.lo);
    return { t, v: V.from(disp) };
  }

  draw() {
    const cv = this.canvas; const d = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth; const h = cv.clientHeight; if (!w || !h) return;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
    const cs = getComputedStyle(document.documentElement); const col = (n, f) => cs.getPropertyValue(n).trim() || f;
    const ink2 = col('--ink-2', '#666'); const line = col('--line', '#ccc'); const accent = col('--accent', '#1f6f78'); const surface = col('--surface', '#fff');
    const L = this.layout(); const V = this.view(); const T = this.api.length();
    ctx.fillStyle = surface; ctx.fillRect(0, 0, w, h);
    ctx.font = '11px system-ui'; ctx.textBaseline = 'middle';
    // time grid: a line every cycle, labelled
    const cyc = this.api.cycle();
    for (let t = 0; t < T; t += cyc) { const x = this.tx(t, L); ctx.strokeStyle = `${line}`; ctx.beginPath(); ctx.moveTo(x, L.t); ctx.lineTo(x, h - L.b); ctx.stroke(); ctx.fillStyle = ink2; ctx.textAlign = 'left'; ctx.fillText(String(t), x + 3, h - L.b + 12); }
    ctx.textAlign = 'right';
    for (let i = 0; i <= 4; i++) { const dv = V.lo + ((V.hi - V.lo) * i) / 4; const y = L.t + (1 - i / 4) * (h - L.t - L.b); ctx.fillStyle = ink2; ctx.fillText(Math.abs(dv) < 10 ? dv.toFixed(Math.abs(dv) < 1 ? 2 : 1) : dv.toFixed(0), L.l - 6, y); ctx.strokeStyle = `${line}66`; ctx.beginPath(); ctx.moveTo(L.l, y); ctx.lineTo(w - L.r, y); ctx.stroke(); }
    ctx.textAlign = 'left'; ctx.fillStyle = ink2; ctx.fillText(V.unit || '', 4, h - L.b + 12);
    // the value with no automation
    const by = this.vy(V.base, L);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = ink2; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(L.l, by); ctx.lineTo(w - L.r, by); ctx.stroke(); ctx.setLineDash([]);
    const lane = this.lane();
    if (lane.pts.length) {
      ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.beginPath();
      for (let x = L.l; x <= w - L.r; x += 2) { const t = ((x - L.l) / (L.w - L.l - L.r)) * (T - 1); const y = this.vy(laneValue(lane, t, V.base), L); if (x === L.l) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
      ctx.stroke();
      lane.pts.forEach((q, i) => { ctx.fillStyle = surface; ctx.strokeStyle = accent; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(this.tx(q.t, L), this.vy(q.v, L), this.drag?.index === i ? 11 : 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
    } else { ctx.fillStyle = ink2; ctx.textAlign = 'center'; ctx.fillText('No automation yet. Tap to add a point, or record it while playing.', (L.l + w - L.r) / 2, (L.t + h - L.b) / 2); }
    if (this.stroke) { ctx.strokeStyle = '#e0662e'; ctx.lineWidth = 3; ctx.beginPath(); this.stroke.forEach((q, i) => { const x = this.tx(q.t, L); const y = this.vy(q.v, L); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); }
    const f = this.api.frame(); const px = this.tx(f, L);
    ctx.strokeStyle = '#d0342c'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(px, L.t - 4); ctx.lineTo(px, h - L.b); ctx.stroke();
    ctx.fillStyle = `${line}55`; ctx.fillRect(L.l, 0, w - L.l - L.r, 17); ctx.fillStyle = ink2; ctx.textAlign = 'left'; ctx.fillText('drag here to scrub', L.l + 6, 9);
  }

  bind() {
    const cv = this.canvas;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const q = pos(e); const L = this.layout();
      if (q.y < 18) { this.scrubbing = true; this.scrub(q.x, L); return; }
      const lane = this.lane();
      let best = -1; let bd = 26;
      lane.pts.forEach((p, i) => { const dd = Math.hypot(this.tx(p.t, L) - q.x, this.vy(p.v, L) - q.y); if (dd < bd) { bd = dd; best = i; } });
      if (best >= 0 && this.mode === 'handles') {
        const now = performance.now();
        if (this.lastTap?.index === best && now - this.lastTap.t < 350) { this.api.setLane({ ...lane, pts: removeLanePoint(lane.pts, best) }); this.lastTap = null; this.draw(); return; }
        this.lastTap = { index: best, t: now };
        this.drag = { index: best, pts: lane.pts.map((p) => ({ ...p })) }; this.draw(); return;
      }
      const at = this.fromXY(q.x, q.y, L);
      if (this.mode === 'draw') { this.stroke = [at]; this.draw(); return; }
      this.api.setLane({ ...lane, pts: insertLanePoint(lane.pts, at.t, at.v) }); this.draw();
    });
    cv.addEventListener('pointermove', (e) => {
      const q = pos(e); const L = this.layout();
      if (this.scrubbing) { this.scrub(q.x, L); return; }
      if (this.drag) { const at = this.fromXY(q.x, q.y, L); const pts = this.drag.pts.map((p) => ({ ...p })); moveLanePoint(pts, this.drag.index, at.t, at.v, this.api.length()); this.api.setLane({ ...this.lane(), pts }); this.draw(); }
      else if (this.stroke) { this.stroke.push(this.fromXY(q.x, q.y, L)); this.draw(); }
    });
    const end = (e) => {
      try { if (e && cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId); } catch { /* released */ }
      if (this.stroke) { const V = this.view(); const next = strokeLane(this.lane(), this.stroke, (V.from(V.hi) - V.from(V.lo)) * 0.004); this.stroke = null; this.api.setLane(next); }
      this.drag = null; this.scrubbing = false; this.draw();
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  scrub(x, L) { const t = Math.round(Math.min(1, Math.max(0, (x - L.l) / (L.w - L.l - L.r))) * (this.api.length() - 1)); this.api.scrub(t); }
}
