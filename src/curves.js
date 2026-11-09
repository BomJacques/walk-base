// Curve pop-out: shows one channel's motion over the cycle and lets you reshape it by dragging handles or drawing it freehand.
// Pure editing logic (no DOM) is exported for tests; CurveEditor wires it to a canvas.
import { makeEvaluator, CHANNEL_BY_ID, sampleDefault, sampleFinal } from './motion.js';
import { cycleFrames, keyPhases } from './rig.js';
import { PROP, proportionalMove, wrapDist } from './proportional.js';

const wrap = (u) => u - Math.floor(u);
const sortPts = (pts) => pts.slice().sort((a, b) => a.u - b.u);

/** Editable handles that reproduce the channel's current curve exactly at their own positions. Bakes amount, offset and phase in. */
export function bakePoints(finalFn, count = 12) {
  return Array.from({ length: count }, (_, i) => ({ u: i / count, v: finalFn(i / count) }));
}

/** Replaces the part of the curve a freehand stroke covers. stroke: [{u,v}] in drawing order. */
export function applyStroke(pts, stroke, spacing = 1 / 24) {
  if (stroke.length < 2) return pts;
  const s = sortPts(stroke);
  const lo = s[0].u; const hi = s[s.length - 1].u;
  if (hi - lo < spacing) return pts;
  // Resample along u by linear interpolation of the stroke.
  const fresh = [];
  for (let u = lo; u <= hi + 1e-9; u += spacing) {
    let k = 0;
    while (k < s.length - 2 && s[k + 1].u < u) k++;
    const a = s[k]; const b = s[k + 1];
    const t = b.u === a.u ? 0 : Math.min(1, Math.max(0, (u - a.u) / (b.u - a.u)));
    fresh.push({ u: Math.min(1 - 1e-6, u), v: a.v + (b.v - a.v) * t });
  }
  // Light smoothing so hand wobble does not become motion.
  const sm = fresh.map((q, i) => (i === 0 || i === fresh.length - 1 ? q : { u: q.u, v: (fresh[i - 1].v + 2 * q.v + fresh[i + 1].v) / 4 }));
  const kept = pts.filter((q) => q.u < lo - spacing / 2 || q.u > hi + spacing / 2);
  return sortPts([...kept, ...sm]);
}

/** Moves a handle, keeping the list sorted and handles apart. Returns the new index. */
export function moveHandle(pts, index, u, v, minGap = 0.008) {
  const q = pts[index];
  const prev = pts[(index - 1 + pts.length) % pts.length];
  const next = pts[(index + 1) % pts.length];
  let nu = wrap(u);
  if (pts.length > 2) {
    const lo = index === 0 ? prev.u - 1 + minGap : prev.u + minGap;
    const hi = index === pts.length - 1 ? next.u + 1 - minGap : next.u - minGap;
    let uu = u;
    if (index === 0 && u > 0.5) uu = u - 1;
    nu = Math.min(hi, Math.max(lo, uu));
    nu = wrap(nu);
  }
  q.u = nu; q.v = v;
  return index;
}

export function smoothPoints(pts) {
  const n = pts.length;
  return pts.map((q, i) => ({ u: q.u, v: (pts[(i - 1 + n) % n].v + 2 * q.v + pts[(i + 1) % n].v) / 4 }));
}

export function removeHandle(pts, index) {
  if (pts.length <= 3) return pts;
  return pts.filter((_, i) => i !== index);
}

export function addHandle(pts, u, v) {
  return sortPts([...pts, { u: wrap(u), v }]);
}

/** Copies a channel's drawn curve to its other side: the left is the right half a cycle later. */
export const mirrorPoints = (pts) => sortPts(pts.map((q) => ({ u: wrap(q.u + 0.5), v: q.v })));

export class CurveEditor {
  /**
   * host: element to fill. api: { getParams(), getMotion(), getFrameU(), set(id, settings|null), scrub(frame), frames(), link() }
   */
  constructor(host, id, api) {
    this.host = host; this.id = id; this.api = api; this.mode = 'handles';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'curve-canvas';
    this.canvas.style.touchAction = 'none';
    host.append(this.canvas);
    this.drag = null; this.stroke = null;
    this.bind();
    this.resizeObs = new ResizeObserver(() => this.draw());
    this.resizeObs.observe(host);
    this.draw();
  }

  get c() { return CHANNEL_BY_ID[this.id]; }
  setChannel(id) { this.id = id; this.draw(); }
  setMode(m) { this.mode = m; this.draw(); }
  destroy() { this.resizeObs.disconnect(); this.canvas.remove(); }

  settings() { return this.api.getMotion()[this.id] || {}; }
  finalFn() { const P = this.api.getParams(); const m = this.api.getMotion(); const id = this.id; return (u) => sampleFinalAt(id, P, m, u); }

  /** Turns the channel into editable handles, baking in amount, offset and phase. */
  ensurePoints() {
    const s = this.settings();
    if (s.pts?.length >= 2 && (s.freq ?? 1) === 1) return s.pts.map((q) => ({ ...q }));
    return bakePoints(this.finalFn(), 12);
  }
  commit(pts) { this.api.set(this.id, { pts: sortPts(pts), amount: 1, offset: 0, phase: 0 }); this.draw(); }

  layout() {
    const w = this.canvas.clientWidth; const h = this.canvas.clientHeight;
    return { w, h, l: 46, r: 10, t: 40, b: 24 };
  }
  range() {
    // Channel min and max are in display units (degrees or legs), so only the sampled values are converted.
    const c = this.c; const P = this.api.getParams(); const m = this.api.getMotion();
    const f = sampleFinal(this.id, P, m, 96).map((v) => c.to(v));
    const lo = Math.min(c.min, ...f); const hi = Math.max(c.max, ...f);
    const pad = (hi - lo) * 0.06;
    return { lo: lo - pad, hi: hi + pad };
  }
  toXY(u, v, L, R) { return { x: L.l + u * (L.w - L.l - L.r), y: L.t + (1 - (this.c.to(v) - R.lo) / (R.hi - R.lo)) * (L.h - L.t - L.b) }; }
  fromXY(x, y, L, R) {
    const u = Math.min(1, Math.max(0, (x - L.l) / (L.w - L.l - L.r)));
    const disp = R.lo + (1 - (y - L.t) / (L.h - L.t - L.b)) * (R.hi - R.lo);
    return { u, v: this.c.from(disp) };
  }

  draw() {
    const cv = this.canvas;
    const d = Math.min(2, window.devicePixelRatio || 1);
    const w = cv.clientWidth; const h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * d) || cv.height !== Math.round(h * d)) { cv.width = Math.round(w * d); cv.height = Math.round(h * d); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const cs = getComputedStyle(document.documentElement);
    const col = (n, f) => cs.getPropertyValue(n).trim() || f;
    const ink = col('--ink', '#222'); const line = col('--line', '#ccc'); const accent = col('--accent', '#1f6f78'); const surface = col('--surface', '#fff'); const ink2 = col('--ink-2', '#666');
    const L = this.layout(); const R = this.range();
    ctx.fillStyle = surface; ctx.fillRect(0, 0, w, h);
    const P = this.api.getParams(); const m = this.api.getMotion();
    const n = cycleFrames(P).frames.length;
    // Frame grid and key poses
    ctx.font = '11px system-ui'; ctx.textBaseline = 'middle';
    for (let i = 0; i <= n; i++) {
      const x = this.toXY(i / n, 0, L, R).x;
      ctx.strokeStyle = i % 4 === 0 ? line : `${line}88`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, L.t); ctx.lineTo(x, h - L.b); ctx.stroke();
    }
    for (const k of keyPhases(P)) {
      for (const off of [0, 0.5]) {
        const x = this.toXY((k.u + off) % 1, 0, L, R).x;
        ctx.strokeStyle = '#c4551f88'; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x, L.t); ctx.lineTo(x, h - L.b); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#c4551f'; ctx.textAlign = 'center';
        ctx.fillText(`${k.name[0]}${off ? 'f' : 'n'}`, x, L.t - 9);
      }
    }
    // Value axis
    ctx.fillStyle = ink2; ctx.textAlign = 'right';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const dv = R.lo + ((R.hi - R.lo) * i) / ticks;
      const y = L.t + (1 - i / ticks) * (h - L.t - L.b);
      ctx.fillText(Math.abs(dv) < 10 ? dv.toFixed(Math.abs(dv) < 1 ? 2 : 1) : dv.toFixed(0), L.l - 6, y);
      ctx.strokeStyle = `${line}66`; ctx.beginPath(); ctx.moveTo(L.l, y); ctx.lineTo(w - L.r, y); ctx.stroke();
    }
    const zy = this.toXY(0, 0, L, R).y;
    ctx.strokeStyle = ink2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(L.l, zy); ctx.lineTo(w - L.r, zy); ctx.stroke();
    ctx.textAlign = 'left'; ctx.fillStyle = ink2; ctx.fillText(this.c.unit, 4, h - L.b + 12);
    // Built-in curve (dashed), then the current curve
    const path = (vals) => { ctx.beginPath(); vals.forEach((v, i) => { const q = this.toXY(i / (vals.length - 1), v, L, R); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); }); ctx.stroke(); };
    const def = sampleDefault(this.id, P, 96, m); def.push(def[0]);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = ink2; ctx.lineWidth = 1.5; path(def); ctx.setLineDash([]);
    const fin = sampleFinal(this.id, P, m, 96); fin.push(fin[0]);
    ctx.strokeStyle = accent; ctx.lineWidth = 3; path(fin);
    // the reach of proportional editing, round the handle being dragged
    if (this.drag && PROP.on) {
      const c0 = this.drag.pts[this.drag.index].u; const a = this.toXY(c0 - PROP.radius, 0, L, R).x; const b = this.toXY(c0 + PROP.radius, 0, L, R).x;
      ctx.fillStyle = `${accent}1f`; ctx.fillRect(Math.max(L.l, a), L.t, Math.min(w - L.r, b) - Math.max(L.l, a), h - L.t - L.b);
    }
    // Handles
    const sett = this.settings();
    const pts = (sett.freq ?? 1) === 1 ? sett.pts : null;
    if (pts?.length) {
      pts.forEach((q, i) => {
        const p = this.toXY(q.u, q.v, L, R);
        ctx.fillStyle = surface; ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, this.drag?.index === i ? 11 : 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
    }
    if (this.stroke) {
      ctx.strokeStyle = '#e0662e'; ctx.lineWidth = 3;
      ctx.beginPath(); this.stroke.forEach((q, i) => { const p = this.toXY(q.u, q.v, L, R); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
    }
    // Playhead
    const u = this.api.getFrameU();
    const ph = this.toXY(u, sampleFinalAt(this.id, P, m, u), L, R);
    ctx.strokeStyle = '#d0342c'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ph.x, L.t - 4); ctx.lineTo(ph.x, h - L.b); ctx.stroke();
    ctx.fillStyle = '#d0342c'; ctx.beginPath(); ctx.arc(ph.x, ph.y, 5, 0, Math.PI * 2); ctx.fill();
    // Ruler strip: drag to scrub
    ctx.fillStyle = `${line}55`; ctx.fillRect(L.l, 0, w - L.l - L.r, 17);
    ctx.fillStyle = ink2; ctx.textAlign = 'left'; ctx.fillText('drag here to scrub', L.l + 6, 9);
  }

  bind() {
    const cv = this.canvas;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      const q = pos(e); const L = this.layout(); const R = this.range();
      if (q.y < 18) { this.scrubbing = true; this.scrubTo(q.x, L); return; }
      const sett = this.settings();
      const pts = (sett.freq ?? 1) === 1 ? sett.pts : null;
      // A near handle is grabbed first, in either mode.
      if (pts?.length) {
        let best = -1; let bd = 26;
        pts.forEach((p, i) => { const s = this.toXY(p.u, p.v, L, R); const dd = Math.hypot(s.x - q.x, s.y - q.y); if (dd < bd) { bd = dd; best = i; } });
        if (best >= 0 && this.mode === 'handles') {
          const now = performance.now();
          if (this.lastTap && this.lastTap.index === best && now - this.lastTap.t < 350) { this.commit(removeHandle(pts, best)); this.lastTap = null; return; }
          this.lastTap = { index: best, t: now };
          this.drag = { index: best, pts: pts.map((p) => ({ ...p })) }; this.draw(); return;
        }
      }
      if (this.mode === 'draw') { this.stroke = [{ ...this.fromXY(q.x, q.y, L, R) }]; this.draw(); return; }
      // Handles mode, empty space: first tap creates handles from the current curve; later taps add one.
      const base = this.ensurePoints();
      const at = this.fromXY(q.x, q.y, L, R);
      const had = this.settings().pts?.length >= 2 && (this.settings().freq ?? 1) === 1;
      this.commit(had ? addHandle(base, at.u, at.v) : base);
    });
    cv.addEventListener('pointermove', (e) => {
      const q = pos(e); const L = this.layout(); const R = this.range();
      if (this.scrubbing) { this.scrubTo(q.x, L); return; }
      if (this.drag) {
        const at = this.fromXY(q.x, q.y, L, R);
        const pts = this.drag.pts.map((p) => ({ ...p }));
        moveHandle(pts, this.drag.index, at.u, at.v);
        proportionalMove(pts, this.drag.pts, this.drag.index, (a, b) => wrapDist(a.u, b.u));
        this.api.set(this.id, { pts: sortPts(pts), amount: 1, offset: 0, phase: 0 });
        this.draw();
      } else if (this.stroke) {
        this.stroke.push(this.fromXY(q.x, q.y, L, R)); this.draw();
      }
    });
    const end = (e) => {
      try { if (e && cv.hasPointerCapture(e.pointerId)) cv.releasePointerCapture(e.pointerId); } catch { /* already released */ }
      if (this.stroke) {
        // A tap is not a stroke: only commit when the stroke actually changed the curve.
        const base = this.ensurePoints();
        const next = applyStroke(base, this.stroke);
        this.stroke = null;
        if (next !== base) this.commit(next);
      }
      this.drag = null; this.scrubbing = false; this.draw();
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }

  scrubTo(x, L) {
    const u = Math.min(0.9999, Math.max(0, (x - L.l) / (L.w - L.l - L.r)));
    const n = this.api.frames();
    this.api.scrub(Math.min(n - 1, Math.round(u * n - 0.0001)));
  }

  smooth() { const pts = this.settings().pts; if (pts?.length >= 3) this.commit(smoothPoints(pts)); }
}

const sampleFinalAt = (id, P, motion, u) => makeEvaluator(P, motion).value(id, wrap(u));
