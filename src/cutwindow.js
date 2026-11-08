// The cut window: see where the cuts fall, drag them, number the frames, and clean up each slice.
// Sheet view shows the whole picture with its cuts. Slice view shows one frame large, with transparency, for cleanup.
import { SM, sliceOf, detect, touch, beginEdit, endEdit, undo, redo, brush, polygon, rectErase, wand, removeSpeckMarks, resetSliceEdits, setCuts, tighten, layout } from './sampler.js';
import { dragCut, splitCut, mergeCuts, clampCut, numberCuts } from './slicer.js';

function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'testid') el.dataset.testid = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}

const HANDLES = [['tl', 0, 0], ['t', 0.5, 0], ['tr', 1, 0], ['r', 1, 0.5], ['br', 1, 1], ['b', 0.5, 1], ['bl', 0, 1], ['l', 0, 0.5]];

export function openCutWindow({ onChange, onDone, toast = () => {} }) {
  const st = {
    view: 'sheet', tool: 'edit', value: 0, brush: 18, tol: 28, speck: 40, splitAxis: 'x',
    zoom: { sheet: 1, slice: 1 }, pan: { sheet: { x: 0, y: 0 }, slice: { x: 0, y: 0 } },
    drag: null, cursor: null, lasso: null, band: null, pointers: new Map(), gesture: null,
  };
  const root = h('div', { class: 'cutwin', role: 'dialog', 'aria-label': 'Cut window', testid: 'cutwin' });
  const canvas = h('canvas', { class: 'cw-canvas', testid: 'cw-canvas', 'aria-label': 'Picture with cuts' });
  canvas.style.touchAction = 'none';
  const area = h('div', { class: 'cw-area' }, canvas);
  const tools = h('div', { class: 'cw-tools', role: 'toolbar', 'aria-label': 'Tools' });
  const foot = h('div', { class: 'cw-foot' });
  const msg = h('p', { class: 'hint cw-msg', role: 'status', testid: 'cw-msg' });
  const title = h('h2', null, 'Cut window');
  const viewSeg = h('div', { class: 'seg' },
    h('button', { type: 'button', class: 'segbtn', testid: 'cw-view-sheet', onClick: () => setView('sheet') }, 'Sheet'),
    h('button', { type: 'button', class: 'segbtn', testid: 'cw-view-slice', onClick: () => setView('slice') }, 'Slice'));
  const head = h('header', { class: 'cw-head' }, title, viewSeg,
    h('button', { type: 'button', class: 'btn', testid: 'cw-detect', onClick: () => { if (!SM.cuts.length || confirm('Detect again? This replaces the current cuts and their frame numbers.')) { detect(); st.zoom.sheet = 1; changed(); toast(`${SM.cuts.length} cuts found.`); } } }, 'Detect again'),
    h('button', { type: 'button', class: 'btn primary', testid: 'cw-done', onClick: () => close() }, 'Done'));
  root.append(head, tools, area, msg, foot);
  document.body.append(root);
  document.body.classList.add('cutting');

  const dprv = () => Math.min(2, window.devicePixelRatio || 1);
  const sel = () => SM.cuts[SM.sel];
  const changed = () => { touch(); build(); draw(); onChange?.(); };

  // ---- geometry ----
  function frame() {
    const cw = canvas.clientWidth; const ch = canvas.clientHeight;
    const c = sel();
    const a = st.view === 'sheet' || !c ? { w: SM.W, h: SM.H } : { w: c.w, h: c.h };
    const s = Math.min(cw / a.w, ch / a.h) * 0.94 * st.zoom[st.view];
    const p = st.pan[st.view];
    return { s, ox: (cw - a.w * s) / 2 + p.x, oy: (ch - a.h * s) / 2 + p.y, cw, ch };
  }
  const origin = () => (st.view === 'slice' && sel() ? { x: sel().x, y: sel().y } : { x: 0, y: 0 });
  const toImg = (px, py) => { const f = frame(); const o = origin(); return { x: o.x + (px - f.ox) / f.s, y: o.y + (py - f.oy) / f.s }; };
  const toScr = (x, y) => { const f = frame(); const o = origin(); return { x: f.ox + (x - o.x) * f.s, y: f.oy + (y - o.y) * f.s }; };
  const local = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  // ---- drawing ----
  let pending = false;
  const draw = () => { if (pending) return; pending = true; requestAnimationFrame(() => { pending = false; paint(); }); };
  let overlay = null; let overlayRev = -1;
  function eraseOverlay() {
    if (overlayRev === SM.rev && overlay) return overlay;
    const k = Math.min(1, 1200 / Math.max(SM.W, SM.H));
    const w = Math.max(1, Math.round(SM.W * k)); const hh = Math.max(1, Math.round(SM.H * k));
    const c = document.createElement('canvas'); c.width = w; c.height = hh;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(w, hh);
    let any = false;
    for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
      if (SM.erase[Math.floor(y / k) * SM.W + Math.floor(x / k)] < 128) { const o = (y * w + x) * 4; img.data[o] = 214; img.data[o + 1] = 52; img.data[o + 2] = 44; img.data[o + 3] = 120; any = true; }
    }
    ctx.putImageData(img, 0, 0);
    overlay = any ? c : null; overlayRev = SM.rev;
    return overlay;
  }
  function paint() {
    const d = dprv();
    const w = canvas.clientWidth; const hh = canvas.clientHeight;
    if (!w || !hh) return;
    if (canvas.width !== Math.round(w * d) || canvas.height !== Math.round(hh * d)) { canvas.width = Math.round(w * d); canvas.height = Math.round(hh * d); }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(d, 0, 0, d, 0, 0);
    const cs = getComputedStyle(document.documentElement);
    const accent = cs.getPropertyValue('--accent').trim() || '#1f6f78';
    ctx.fillStyle = cs.getPropertyValue('--stage').trim() || '#ddd8cc'; ctx.fillRect(0, 0, w, hh);
    if (!SM.loaded) return;
    const f = frame();
    ctx.imageSmoothingQuality = 'high';
    if (st.view === 'sheet') {
      ctx.fillStyle = '#fff'; ctx.fillRect(f.ox, f.oy, SM.W * f.s, SM.H * f.s);
      ctx.drawImage(SM.source, f.ox, f.oy, SM.W * f.s, SM.H * f.s);
      const ov = eraseOverlay(); if (ov) ctx.drawImage(ov, f.ox, f.oy, SM.W * f.s, SM.H * f.s);
      if (SM.region) {
        const r = toScr(SM.region.x, SM.region.y);
        ctx.fillStyle = 'rgba(0,0,0,0.28)';
        ctx.beginPath(); ctx.rect(f.ox, f.oy, SM.W * f.s, SM.H * f.s); ctx.rect(r.x, r.y, SM.region.w * f.s, SM.region.h * f.s); ctx.fill('evenodd');
        ctx.strokeStyle = '#e0662e'; ctx.setLineDash([8, 5]); ctx.lineWidth = 2.5; ctx.strokeRect(r.x, r.y, SM.region.w * f.s, SM.region.h * f.s); ctx.setLineDash([]);
      }
      SM.cuts.forEach((c, i) => {
        const a = toScr(c.x, c.y); const bw = c.w * f.s; const bh = c.h * f.s;
        const on = i === SM.sel;
        ctx.fillStyle = on ? 'rgba(31,111,120,0.10)' : 'rgba(0,0,0,0.03)'; ctx.fillRect(a.x, a.y, bw, bh);
        ctx.strokeStyle = on ? accent : 'rgba(60,56,50,0.75)'; ctx.lineWidth = on ? 3 : 1.5; ctx.strokeRect(a.x, a.y, bw, bh);
        const label = String(c.label);
        ctx.font = '600 14px system-ui, sans-serif';
        const tw = Math.max(26, ctx.measureText(label).width + 14);
        ctx.fillStyle = on ? accent : 'rgba(40,36,30,0.85)';
        ctx.beginPath(); ctx.roundRect(a.x, Math.max(0, a.y - 26), tw, 24, 6); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(label, a.x + 7, Math.max(0, a.y - 26) + 12);
        const hold = c.exposure ?? SM.exposure;
        if (hold > 1) { ctx.fillStyle = 'rgba(40,36,30,0.7)'; ctx.font = '12px system-ui'; ctx.fillText(`×${hold}`, a.x + tw + 6, Math.max(0, a.y - 26) + 12); }
      });
      const c = sel();
      if (c) {
        const a = toScr(c.x, c.y);
        for (const [, fx, fy] of HANDLES) {
          ctx.fillStyle = '#fff'; ctx.strokeStyle = accent; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(a.x + fx * c.w * f.s, a.y + fy * c.h * f.s, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      }
      if (st.band) { ctx.strokeStyle = accent; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; const b = st.band; ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); ctx.setLineDash([]); }
    } else if (sel()) {
      const c = sel();
      const s = sliceOf(SM.sel);
      const sw = c.w * f.s; const shh = c.h * f.s;
      // Checkerboard, so transparency shows.
      ctx.save(); ctx.beginPath(); ctx.rect(f.ox, f.oy, sw, shh); ctx.clip();
      const q = 14; for (let y = 0; y < shh; y += q) for (let x = 0; x < sw; x += q) { ctx.fillStyle = ((x / q + y / q) & 1) ? '#e9e6df' : '#fbfaf7'; ctx.fillRect(f.ox + x, f.oy + y, q, q); }
      // What you erased shows faintly, so you can see what to restore.
      ctx.globalAlpha = 0.22; ctx.drawImage(SM.source, c.x, c.y, c.w, c.h, f.ox, f.oy, sw, shh); ctx.globalAlpha = 1;
      ctx.drawImage(s.canvas, f.ox, f.oy, sw, shh);
      ctx.restore();
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(f.ox, f.oy, sw, shh);
      // Registration: where the anchor will sit
      const L = layout(); const reg = L.place[SM.sel];
      void reg;
      if (st.lasso && st.lasso.length > 1) { ctx.strokeStyle = '#e0662e'; ctx.lineWidth = 2.5; ctx.beginPath(); st.lasso.forEach((p, i) => { const q2 = toScr(p.x, p.y); if (i) ctx.lineTo(q2.x, q2.y); else ctx.moveTo(q2.x, q2.y); }); ctx.stroke(); }
      if (st.band) { ctx.strokeStyle = '#e0662e'; ctx.setLineDash([6, 4]); ctx.lineWidth = 2; const b = st.band; ctx.strokeRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0)); ctx.setLineDash([]); }
      if (st.cursor && st.tool === 'brush') { ctx.strokeStyle = st.value === 0 ? '#d0342c' : '#2f9a4a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(st.cursor.x, st.cursor.y, st.brush * f.s, 0, Math.PI * 2); ctx.stroke(); }
    }
    if (!SM.cuts.length) { ctx.fillStyle = '#fff'; ctx.font = '600 16px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#333'; ctx.fillText('No drawings found. Try another mode or higher sensitivity, or add cuts by hand.', w / 2, hh / 2); ctx.textAlign = 'left'; }
  }

  // ---- interaction ----
  const hitHandle = (p) => {
    const c = sel(); if (!c) return null;
    const a = toScr(c.x, c.y); const f = frame();
    let best = null; let bd = 26;
    for (const [name, fx, fy] of HANDLES) { const d = Math.hypot(a.x + fx * c.w * f.s - p.x, a.y + fy * c.h * f.s - p.y); if (d < bd) { bd = d; best = name; } }
    return best;
  };
  const hitCut = (p) => {
    const i0 = toImg(p.x, p.y);
    for (let i = SM.cuts.length - 1; i >= 0; i--) { const c = SM.cuts[i]; if (i0.x >= c.x && i0.x <= c.x + c.w && i0.y >= c.y && i0.y <= c.y + c.h) return i; }
    return -1;
  };
  const pinchStart = () => {
    const pts = [...st.pointers.values()];
    return { zoom: st.zoom[st.view], pan: { ...st.pan[st.view] }, cx: (pts[0].x + pts[1].x) / 2, cy: (pts[0].y + pts[1].y) / 2, dist: Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) };
  };
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = local(e); st.pointers.set(e.pointerId, p);
    if (st.pointers.size >= 2) { cancelDrag(); st.gesture = pinchStart(); return; }
    if (!SM.loaded) return;
    const img = toImg(p.x, p.y);
    if (st.view === 'sheet') {
      if (st.tool === 'edit') {
        const hn = hitHandle(p);
        if (hn) { st.drag = { kind: 'cut', handle: hn, start: p, cut: { ...sel() } }; return; }
        const hit = hitCut(p);
        if (hit >= 0) { SM.sel = hit; build(); st.drag = { kind: 'cut', handle: 'move', start: p, cut: { ...sel() } }; draw(); return; }
        st.drag = { kind: 'pan', start: p, pan: { ...st.pan.sheet } };
      } else if (st.tool === 'add' || st.tool === 'region') { st.band = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; st.drag = { kind: 'band' }; }
      else if (st.tool === 'stamp') {
        // A box the size of the selected one, centred on the tap, numbered after the selected one.
        const sz = sel() ? { w: sel().w, h: sel().h } : { w: Math.round(SM.W * 0.14), h: Math.round(SM.H * 0.3) };
        const box = clampCut({ x: img.x - sz.w / 2, y: img.y - sz.h / 2, w: sz.w, h: sz.h }, SM.W, SM.H);
        const fresh = { ...box, label: '', exposure: null, dx: 0, dy: 0 };
        const next = SM.cuts.slice(); const at = SM.cuts.length ? SM.sel + 1 : 0;
        next.splice(at, 0, fresh); setCuts(numberCuts(next)); SM.sel = at; changed();
      }
      else if (st.tool === 'split') {
        const hit = hitCut(p);
        if (hit >= 0) { const c = SM.cuts[hit]; const parts = splitCut(c, st.splitAxis, st.splitAxis === 'x' ? img.x : img.y); if (parts) { const next = SM.cuts.slice(); next.splice(hit, 1, parts[0], { ...parts[1], label: '' }); setCuts(numberCuts(next)); SM.sel = hit + 1; changed(); toast('Split in two.'); } else toast('Tap further from the edge to split.'); }
      }
    } else if (sel()) {
      if (st.tool === 'brush') { beginEdit(SM.sel); st.drag = { kind: 'brush', last: img }; brush(SM.sel, img.x, img.y, img.x, img.y, st.brush, st.value); st.cursor = p; draw(); }
      else if (st.tool === 'lasso') { beginEdit(SM.sel); st.lasso = [img]; st.drag = { kind: 'lasso' }; }
      else if (st.tool === 'rect') { st.band = { x0: p.x, y0: p.y, x1: p.x, y1: p.y }; st.drag = { kind: 'band' }; beginEdit(SM.sel); }
      else if (st.tool === 'wand') { beginEdit(SM.sel); const n = wand(SM.sel, img.x, img.y, st.tol, st.value); endEdit(); toast(n ? `${st.value === 0 ? 'Erased' : 'Restored'} ${n} pixels.` : 'Nothing there.'); changed(); }
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    if (st.pointers.has(e.pointerId)) st.pointers.set(e.pointerId, p);
    if (st.gesture && st.pointers.size >= 2) {
      const pts = [...st.pointers.values()]; const g = st.gesture;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      st.zoom[st.view] = Math.min(12, Math.max(0.3, g.zoom * (dist / g.dist)));
      st.pan[st.view] = { x: g.pan.x + ((pts[0].x + pts[1].x) / 2 - g.cx), y: g.pan.y + ((pts[0].y + pts[1].y) / 2 - g.cy) };
      draw(); return;
    }
    if (st.view === 'slice' && st.tool === 'brush') { st.cursor = p; if (!st.drag) draw(); }
    const dr = st.drag; if (!dr) return;
    const img = toImg(p.x, p.y);
    if (dr.kind === 'cut') {
      const f = frame();
      const next = dragCut(dr.cut, dr.handle, (p.x - dr.start.x) / f.s, (p.y - dr.start.y) / f.s, SM.W, SM.H);
      SM.cuts[SM.sel] = { ...SM.cuts[SM.sel], x: next.x, y: next.y, w: next.w, h: next.h };
      touch(); draw();
    } else if (dr.kind === 'pan') { st.pan.sheet = { x: dr.pan.x + p.x - dr.start.x, y: dr.pan.y + p.y - dr.start.y }; draw(); }
    else if (dr.kind === 'band') { st.band.x1 = p.x; st.band.y1 = p.y; draw(); }
    else if (dr.kind === 'brush') { brush(SM.sel, dr.last.x, dr.last.y, img.x, img.y, st.brush, st.value); dr.last = img; draw(); }
    else if (dr.kind === 'lasso') { st.lasso.push(img); draw(); }
  });
  const cancelDrag = () => { st.drag = null; st.band = null; st.lasso = null; };
  const up = (e) => {
    const had = st.pointers.has(e.pointerId);
    st.pointers.delete(e.pointerId);
    try { if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); } catch { /* released */ }
    if (st.gesture) { if (st.pointers.size < 2) st.gesture = null; return; }
    const dr = st.drag; if (!dr || !had) return;
    const p = local(e);
    if (dr.kind === 'cut') { SM.cuts[SM.sel] = { ...SM.cuts[SM.sel], ...clampCut(SM.cuts[SM.sel], SM.W, SM.H) }; changed(); }
    else if (dr.kind === 'band') {
      const b = st.band; st.band = null;
      const a = toImg(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1)); const z = toImg(Math.max(b.x0, b.x1), Math.max(b.y0, b.y1));
      if (st.view === 'sheet' && st.tool === 'region') {
        if (z.x - a.x >= 24 && z.y - a.y >= 24) { SM.region = { x: Math.max(0, Math.round(a.x)), y: Math.max(0, Math.round(a.y)), w: Math.round(z.x - a.x), h: Math.round(z.y - a.y) }; st.tool = 'edit'; build(); draw(); onChange?.(); toast('Region set. Tap Detect again to cut inside it.'); }
      } else if (st.view === 'sheet') {
        if (z.x - a.x >= 12 && z.y - a.y >= 12) {
          const fresh = { ...clampCut({ x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y }, SM.W, SM.H), label: '', exposure: null, dx: 0, dy: 0 };
          const next = SM.cuts.slice(); next.splice(SM.sel + 1, 0, fresh); setCuts(numberCuts(next)); SM.sel += 1; st.tool = 'edit'; changed(); toast('Cut added. Drag its edges to fit.');
        }
      } else { rectErase(SM.sel, a.x, a.y, z.x, z.y, st.value); endEdit(); changed(); }
    } else if (dr.kind === 'brush') { endEdit(); changed(); }
    else if (dr.kind === 'lasso') { const pts = st.lasso; st.lasso = null; if (pts.length > 3) polygon(SM.sel, pts.flatMap((q) => [q.x, q.y]), st.value); endEdit(); changed(); }
    void p;
    st.drag = null;
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', (e) => { st.pointers.delete(e.pointerId); cancelDrag(); st.gesture = null; endEdit(); draw(); });
  canvas.addEventListener('pointerleave', () => { st.cursor = null; if (!st.drag) draw(); });
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.zoom[st.view] = Math.min(12, Math.max(0.3, st.zoom[st.view] * (e.deltaY < 0 ? 1.12 : 1 / 1.12))); draw(); }, { passive: false });

  // ---- tool and footer UI ----
  const seg = (items, cur, set, label) => h('div', { class: 'seg', role: 'group', 'aria-label': label }, items.map(([id, text, tid]) => h('button', { type: 'button', class: 'segbtn', testid: tid, 'aria-pressed': String(cur() === id), onClick: () => { set(id); build(); draw(); } }, text)));
  const slider = (label, id, min, max, step, get, set) => {
    const num = h('input', { type: 'number', class: 'num', min, max, step, value: get(), 'aria-label': label, testid: `${id}-num`, onChange: (e) => { set(Number(e.target.value)); build(); draw(); } });
    const rng = h('input', { type: 'range', class: 'rng', min, max, step, value: get(), 'aria-label': `${label} slider`, testid: id, onInput: (e) => { set(Number(e.target.value)); num.value = e.target.value; draw(); } });
    return h('label', { class: 'cw-slider' }, h('span', null, label), rng, num);
  };
  // Empty slots (null) must not become the text "null".
  const put = (host, ...nodes) => host.append(...nodes.filter(Boolean));
  const act = (text, tid, fn, extra = {}) => h('button', { type: 'button', class: 'btn', testid: tid, onClick: fn, ...extra }, text);

  // Removing a focused field makes the browser fire its change event mid-rebuild, which would re-enter build and append everything twice.
  let building = false; let again = false;
  function build() {
    if (building) { again = true; return; }
    building = true;
    try { buildNow(); } finally { building = false; if (again) { again = false; build(); } }
  }
  function buildNow() {
    viewSeg.querySelectorAll('.segbtn').forEach((b, i) => b.setAttribute('aria-pressed', String((i === 0) === (st.view === 'sheet'))));
    title.textContent = `Cut window · ${SM.cuts.length} frame${SM.cuts.length === 1 ? '' : 's'}`;
    tools.textContent = ''; foot.textContent = '';
    if (st.view === 'sheet') {
      put(tools, 
        seg([['edit', 'Edit cuts', 'cw-tool-edit'], ['stamp', 'Stamp', 'cw-tool-stamp'], ['add', 'Add cut', 'cw-tool-add'], ['split', 'Split', 'cw-tool-split'], ['region', 'Region', 'cw-tool-region']], () => st.tool, (t) => { st.tool = t; }, 'Cut tool'),
        st.tool === 'split' ? seg([['x', 'Vertical |', 'cw-split-x'], ['y', 'Horizontal —', 'cw-split-y']], () => st.splitAxis, (a) => { st.splitAxis = a; }, 'Split direction') : null,
        act('Fit', 'cw-fit', () => { st.zoom.sheet = 1; st.pan.sheet = { x: 0, y: 0 }; draw(); }),
        SM.region ? act('Clear region', 'cw-region-clear', () => { SM.region = null; build(); draw(); }) : null,
        act('Clear cuts', 'cw-clear-cuts', () => { if (!SM.cuts.length || confirm('Remove every cut?')) { setCuts([]); st.tool = 'stamp'; changed(); } }));
      msg.textContent = st.tool === 'stamp' ? 'Tap each drawing in order. Every tap drops a box the size of the selected one, numbered in turn. Boxes can overlap. Then drag the edges to fit.' : st.tool === 'region' ? 'Drag a box around just the drawings, leaving out text. Then tap Detect again.' : st.tool === 'edit' ? 'Drag a cut\'s round handles to resize it, or drag inside it to move it. Tap a cut to select it. Pinch to zoom, drag empty space to pan.' : st.tool === 'add' ? 'Drag a box on the picture to add a cut.' : 'Tap inside a cut to split it in two.';
    } else {
      const isBrush = st.tool === 'brush';
      put(tools, 
        seg([['brush', 'Brush', 'cw-tool-brush'], ['lasso', 'Lasso', 'cw-tool-lasso'], ['rect', 'Box', 'cw-tool-rect'], ['wand', 'Wand', 'cw-tool-wand']], () => st.tool, (t) => { st.tool = t; }, 'Cleanup tool'),
        seg([[0, 'Erase', 'cw-erase'], [255, 'Restore', 'cw-restore']], () => st.value, (v) => { st.value = v; }, 'Erase or restore'),
        isBrush ? slider('Brush', 'cw-brush', 2, 120, 1, () => st.brush, (v) => { st.brush = v; }) : null,
        st.tool === 'wand' ? slider('Wand', 'cw-tol', 0, 120, 1, () => st.tol, (v) => { st.tol = v; }) : null,
        act('Undo', 'cw-undo', () => { if (undo()) changed(); }, { disabled: !SM.undo.length }),
        act('Redo', 'cw-redo', () => { if (redo()) changed(); }, { disabled: !SM.redo.length }),
        act('Fit', 'cw-fit', () => { st.zoom.slice = 1; st.pan.slice = { x: 0, y: 0 }; draw(); }));
      put(tools, 
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: SM.clean.paper, testid: 'cw-paper', onChange: (e) => { SM.clean.paper = e.target.checked; changed(); } }), h('span', null, 'Remove paper')),
        SM.clean.paper ? slider('Paper cut-off', 'cw-paper-t', 0, 120, 1, () => SM.clean.threshold, (v) => { SM.clean.threshold = v; touch(); }) : null,
        slider('Speck size', 'cw-speck', 2, 400, 1, () => st.speck, (v) => { st.speck = v; }),
        act('Remove specks', 'cw-specks', () => { beginEdit(SM.sel); const n = removeSpeckMarks(SM.sel, st.speck); endEdit(); toast(`${n} speck${n === 1 ? '' : 's'} removed.`); changed(); }),
        act('All slices', 'cw-specks-all', () => { let n = 0; for (let i = 0; i < SM.cuts.length; i++) { beginEdit(i); n += removeSpeckMarks(i, st.speck); endEdit(); } toast(`${n} specks removed from every slice.`); changed(); }),
        act('Reset slice', 'cw-reset-slice', () => { resetSliceEdits(SM.sel); changed(); }));
      msg.textContent = st.tool === 'brush' ? 'Paint to erase, or switch to Restore to bring things back. The faint ghost shows what has been erased.' : st.tool === 'lasso' ? 'Draw a loop around what you want gone.' : st.tool === 'rect' ? 'Drag a box over what you want gone.' : 'Tap a blob to erase everything connected to it that is close in brightness.';
    }
    footer();
  }
  function footer() {
    const c = sel();
    if (!c) { put(foot, act('Add a cut', 'cw-add-first', () => { st.view = 'sheet'; st.tool = 'add'; build(); draw(); })); return; }
    const i = SM.sel;
    const nav = (d) => { SM.sel = (SM.sel + d + SM.cuts.length) % SM.cuts.length; st.pan.slice = { x: 0, y: 0 }; build(); draw(); onChange?.(); };
    const label = h('input', { type: 'text', class: 'num cw-label', value: c.label, 'aria-label': 'Frame number', testid: 'cw-label', inputmode: 'text', onChange: (e) => { const v = e.target.value.trim(); SM.cuts[i].label = v; SM.cuts[i].manual = v !== ''; setCuts(numberCuts(SM.cuts)); changed(); } });
    const hold = h('input', { type: 'number', class: 'num', min: 1, max: 48, step: 1, value: c.exposure ?? '', placeholder: `${SM.exposure}`, 'aria-label': 'Frames held', testid: 'cw-hold', onChange: (e) => { const v = e.target.value === '' ? null : Math.max(1, Math.round(Number(e.target.value))); SM.cuts[i].exposure = v; changed(); } });
    put(foot, 
      act('◀', 'cw-prev', () => nav(-1), { 'aria-label': 'Previous frame' }), h('span', { class: 'cw-pos' }, `${i + 1} / ${SM.cuts.length}`), act('▶', 'cw-next', () => nav(1), { 'aria-label': 'Next frame' }),
      h('label', { class: 'field' }, h('span', null, 'Frame'), label), h('label', { class: 'field' }, h('span', null, 'Hold'), hold),
      act('Earlier', 'cw-earlier', () => { if (i > 0) { const n = SM.cuts.slice(); [n[i - 1], n[i]] = [n[i], n[i - 1]]; setCuts(n); SM.sel = i - 1; changed(); } }),
      act('Later', 'cw-later', () => { if (i < SM.cuts.length - 1) { const n = SM.cuts.slice(); [n[i + 1], n[i]] = [n[i], n[i + 1]]; setCuts(n); SM.sel = i + 1; changed(); } }),
      act('Tighten', 'cw-tighten', () => { tighten(i); changed(); }),
      act('Merge next', 'cw-merge', () => { if (i < SM.cuts.length - 1) { const n = SM.cuts.slice(); n.splice(i, 2, { ...mergeCuts(n[i], n[i + 1]), label: n[i].label, manual: n[i].manual }); setCuts(numberCuts(n)); changed(); } }),
      act('Delete', 'cw-delete', () => { if (SM.cuts.length) { const n = SM.cuts.slice(); n.splice(i, 1); setCuts(numberCuts(n)); SM.sel = Math.max(0, Math.min(i - 1, n.length - 1)); changed(); } }),
      act('Renumber 1…', 'cw-renumber', () => { setCuts(numberCuts(SM.cuts.map((q) => ({ ...q, manual: false })))); changed(); }));
    if (st.view === 'slice') {
      const nudge = (dx, dy) => () => { SM.cuts[i].dx = (SM.cuts[i].dx || 0) + dx; SM.cuts[i].dy = (SM.cuts[i].dy || 0) + dy; touch(); onChange?.(); build(); draw(); };
      put(foot, h('span', { class: 'cw-pos' }, `Nudge ${c.dx || 0}, ${c.dy || 0}`), act('◀', 'cw-nl', nudge(-2, 0)), act('▲', 'cw-nu', nudge(0, -2)), act('▼', 'cw-nd', nudge(0, 2)), act('▶', 'cw-nr', nudge(2, 0)));
    }
  }
  function setView(v) { st.view = v; if (v === 'slice') st.tool = 'brush'; else st.tool = 'edit'; build(); draw(); }
  function close() { endEdit(); root.remove(); document.body.classList.remove('cutting'); ro.disconnect(); window.removeEventListener('keydown', key); onDone?.(); }
  const key = (e) => { if (e.key === 'Escape') close(); };
  window.addEventListener('keydown', key);
  const ro = new ResizeObserver(draw); ro.observe(area);
  build(); draw();
  return { close, state: st, root, redraw: draw };
}
