// Walk Base: an adjustable 3D walk to trace over. Original figure, runs entirely on this device.
import { DEFAULTS, cycleFrames, cycleTravel, foot } from './rig.js';
import { CADENCE, targetOfParam, targetOfChannel, parseTarget, hasLanes, paramsAt, motionAt, integrate, Recorder, laneValue } from './automation.js';
import { clipsFor, applyClip, CLIP_GROUPS, groupOfClip } from './clips.js';
import { LaneEditor, copySpan, pasteSpan, shiftLane, loopSpan, mirrorTarget } from './lanes.js';
import { STYLE_DEFAULTS, drawScene, pickPart } from './draw.js';
import { EXPORT_DEFAULTS, exportPngZip, exportKeyFrames, exportMp4, videoSupport, contactSheet, deliver, summary, renderFrame, exportTimeline, manifest } from './export.js';
import { CONTROLS, TABS, PRESETS, DEFAULT_OF, presetsFor, presetsForFigure, shownFor } from './controls.js';
import { SPECIES } from './dogdefaults.js';
import { wordsFor } from './words.js';
import { solveFix, writeFix, fixPoints, clearFix } from './fix.js';
import { dogPlants } from './dog3.js';
import { PARTS, CHANNEL_BY_ID, partChannels, partLabel, makeEvaluator, sampleFinal, isEdited, allowedFrequencies } from './motion.js';
import { CurveEditor, mirrorPoints } from './curves.js';
import { cleanPhys, STRIP_LIMITS } from './stripdefs.js';
import { arcPoints, arcPoint, arcColor, adoptArcs, moveArcPoint, DEFAULT_ARCS } from './arcs.js';
import { SM, loadPicture, unload, detect, sliceOf, sampledSummary, totalFrames, touch as touchSampler, setCuts } from './sampler.js';
import { openCutWindow } from './cutwindow.js';
import { SLICE_DEFAULTS, numberCuts } from './slicer.js';
import { History } from './history.js';
import { findKeyFrames, laneTable, tableCsv } from './keyposes.js';
import { icon } from './icons.js';
import { attachTargets, targetKey, newItem, cloneItem, mirroredItem, itemFrame, toLocal, nearestEdgeT, edgePoint, anchorLocal, hitItem, pickHandle, imageInfo, registerImage, imageUrls, KINDS, freshId } from './attach.js';
import { menuButton, closeMenus, menuOwner } from './menu.js';

const KEY = 'walkbase.v2';
const clone = (v) => JSON.parse(JSON.stringify(v));
/** The figures. The human has its own rig; the others are species of the dog's legged rig, each with its own attachments, saved performances and presets. */
const FIGS = ['human', 'dog', 'theropod', 'bird', 'sauropod', 'ceratopsian'];
const FIG_LABELS = { human: 'Human', dog: 'Dog', theropod: 'Theropod (T. rex, raptor)', bird: 'Bird', sauropod: 'Sauropod', ceratopsian: 'Ceratopsian' };
const rigOfFig = (f) => (f === 'human' ? 'human' : 'dog');
const S = {
  p: clone(DEFAULTS), s: clone(STYLE_DEFAULTS), x: clone(EXPORT_DEFAULTS), r: {}, motion: {},
  preset: 'Normal', frame: 0, playing: false, rate: 1, tab: 'Gait', zoom: 1, panX: 0, panY: 0, stageOnly: false,
  source: 'walk', tool: 'orbit', sel: null, link: true, edit: null, busy: null, message: '', video: null, last: null, map: null,
  // Automation: lanes change a value over a longer performance. perfLen 0 means the performance is just one cycle.
  fixMode: false, fixSpread: 10, lanes: {}, perfLen: 0, bank: { human: null, dog: null }, perfs: { human: {}, dog: {} }, perfName: '', attach: { human: [], dog: [] }, attachSel: null, ver: 0, recMode: 'touch', armed: false, recording: false, laneEdit: null, clip: 'stop', clipStart: 0, clipLen: null, clipK: 1,
};
const rec = new Recorder();
// A picture to compare against, shown under the figure. It is a view aid, so it is kept out of undo and the settings file.
const REF_KEY = 'walkbase.ref';
const REF_DEFAULTS = { on: true, opacity: 0.5, size: 1, x: 0, y: 0, ground: 0.9, flip: false, export: false };
const REF = { ...REF_DEFAULTS, img: null, name: '', data: null };
const contact = (p) => foot(0, p, p.stepLength * p.duty);
let perfCache = null;
/** The performance the figure follows: phase and position at every frame. Null when there is no automation and one cycle is all there is. */
function perfData() {
  const n = Math.max(2, Math.round(S.p.cycleFrames));
  const T = S.perfLen > 0 ? Math.round(S.perfLen) : n;
  if (!hasLanes(S.lanes) && T === n) return null;
  const key = `${S.ver}|${T}|${JSON.stringify(S.p)}`;
  if (perfCache?.key !== key) { const dog = S.p.rig === 'dog';
    const s = integrate(S.p, S.lanes, T, n, dog ? null : contact);
    perfCache = { key, T, u: s.u, x: s.x, plants: dog ? dogPlants(S.p, S.lanes, T, s) : s.plants }; }
  const live = rec.liveValues();
  return { ...perfCache, lanes: S.lanes, live: Object.keys(live).length ? live : null };
}
/** The parameters every drawing and export reads: gait, proportions and the motion you have changed. */
const P = () => ({ ...S.p, proportions: S.r, motion: S.motion, attach: S.source === 'sampled' ? [] : (S.attach[figKey()] || []), perf: S.source === 'sampled' ? null : perfData(), sampled: S.source === 'sampled' ? sampledSummary() : null });

// ---------- small DOM helper ----------
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

// ---------- undo and redo ----------
// A snapshot is everything you can change except the camera and the sampler (the cut window has its own undo).
// Changes less than a quarter of a second apart (a slider being dragged) are one step; separate taps are separate steps.
const hist = new History({ gap: 250 });
let restoring = false;
const snapState = () => JSON.stringify({
  p: S.p, s: Object.fromEntries(Object.entries(S.s).filter(([k]) => !/^cam|^autoOrbit/.test(k))), x: S.x, r: S.r, motion: S.motion, lanes: S.lanes,
  perfLen: S.perfLen, bank: S.bank, perfs: S.perfs, attach: S.attach, preset: S.preset,
});
function refreshHistory() {
  for (const [id, ok] of [['undo', hist.canUndo], ['redo', hist.canRedo]]) { const b = document.querySelector(`[data-testid="${id}"]`); if (b) b.disabled = !ok; }
}
function applySnapshot(json) {
  restoring = true;
  try {
    const raw = JSON.parse(json);
    const rig = S.p.rig;
    closeEditor(true); pause(); setArmed(false);
    // Anything missing from the snapshot goes back to its default, so a removed edit really is removed.
    S.motion = {}; S.lanes = {}; S.perfs = { human: {}, dog: {} }; S.attach = { human: [], dog: [] };
    adopt(raw);
    if (!attachItem()) S.attachSel = null;
    if (S.p.rig !== rig) S.sel = null;
    S.frame = Math.min(S.frame, Math.max(0, cycleFrames(P()).frames.length - 1));
    S.ver++; build(); render();
    hist.settle(snapState());
  } finally { restoring = false; }
  save();
}
function undo() { const s = hist.undo(); if (s != null) { applySnapshot(s); setMessage('Undone.'); refreshHistory(); } }
function redo() { const s = hist.redo(); if (s != null) { applySnapshot(s); setMessage('Redone.'); refreshHistory(); } }

// ---------- persistence ----------
/** Forgets the saved session (settings, picture, pasted images) and reloads the page. Interface choices (density, theme) stay. */
function newSession() {
  if (typeof confirm === 'function' && !confirm('Clear everything and start again? Save settings first if you want to keep this.')) return;
  try { for (const k of [KEY, REF_KEY, ATT_IMG_KEY]) localStorage.removeItem(k); } catch { /* storage unavailable */ }
  location.reload();
}
let saveTimer = null;
function save() {
  if (!restoring) { hist.record(snapState()); refreshHistory(); }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify({ p: S.p, s: S.s, x: S.x, r: S.r, motion: S.motion, lanes: S.lanes, perfLen: S.perfLen, bank: S.bank, perfs: S.perfs, attach: S.attach, preset: S.preset, sampler: samplerSettings() })); } catch { setMessage('Settings could not be saved in this browser. Use Save settings to keep a copy.'); }
  }, 250);
}
const clampTo = (c, v) => {
  if (c.type === 'number') { const n = Number(v); return Number.isFinite(n) ? Math.min(c.max, Math.max(c.min, n)) : DEFAULT_OF(c); }
  if (c.type === 'bool') return Boolean(v);
  if (c.type === 'enum') return c.options.map(String).includes(String(v)) ? (typeof c.options[0] === 'number' ? Number(v) : v) : DEFAULT_OF(c);
  if (c.type === 'color') return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : DEFAULT_OF(c);
  return v;
};
const finite = (n, d = 0) => (Number.isFinite(Number(n)) ? Number(n) : d);
function cleanMotion(raw) {
  const out = {};
  for (const [id, s] of Object.entries(raw || {})) {
    if (!CHANNEL_BY_ID[id] || typeof s !== 'object' || !s) continue;
    const e = { amount: finite(s.amount, 1), offset: finite(s.offset, 0), phase: finite(s.phase, 0), freq: [0.5, 1, 2, 3, 4].includes(Number(s.freq)) ? Number(s.freq) : 1 };
    if (s.free) e.free = true;
    if (Array.isArray(s.pts)) {
      const pts = s.pts.map((q) => ({ u: ((finite(q.u) % 1) + 1) % 1, v: finite(q.v) })).sort((a, b) => a.u - b.u);
      if (pts.length >= 2) e.pts = pts;
    }
    out[id] = e;
  }
  return out;
}
const validTarget = (t) => { const k = parseTarget(t); return k && (k.kind === 'cadence' || (k.kind === 'param' && k.id in DEFAULTS) || (k.kind === 'channel' && CHANNEL_BY_ID[k.id])); };
function cleanLanes(raw) {
  const out = {};
  for (const [t, l] of Object.entries(raw || {})) {
    if (!validTarget(t) || !Array.isArray(l?.pts)) continue;
    const pts = l.pts.filter((q) => Number.isFinite(Number(q.t)) && Number.isFinite(Number(q.v))).map((q) => ({ t: Math.max(0, Math.round(Number(q.t))), v: Number(q.v) })).sort((a, b) => a.t - b.t);
    if (pts.length) out[t] = { pts, interp: l.interp === 'linear' ? 'linear' : 'smooth' };
  }
  return out;
}
function adopt(raw) {
  if (raw.p?.rig === 'dog' || raw.p?.rig === 'human') S.p.rig = raw.p.rig;
  if (SPECIES[raw.p?.dogSpecies]) S.p.dogSpecies = raw.p.dogSpecies;
  if (raw.bank && typeof raw.bank === 'object') for (const r of FIGS) { const b = raw.bank[r]; S.bank[r] = b ? { lanes: cleanLanes(b.lanes), perfLen: Math.max(0, Math.round(finite(b.perfLen))) } : null; }
  for (const c of CONTROLS) {
    const src = raw[c.scope];
    if (src && c.id in src) S[c.scope][c.id] = clampTo(c, src[c.id]);
  }
  if (raw.attach && typeof raw.attach === 'object') S.attach = cleanAttach(raw.attach);
  if (raw.perfs && typeof raw.perfs === 'object') for (const r of FIGS) { const o = {}; for (const [name, v] of Object.entries(raw.perfs[r] || {})) { const nm = String(name).slice(0, 40); if (nm && v) o[nm] = { lanes: cleanLanes(v.lanes), perfLen: Math.max(0, Math.round(finite(v.perfLen))) }; } S.perfs[r] = o; }
  S.motion = cleanMotion(raw.motion);
  S.lanes = cleanLanes(raw.lanes); S.perfLen = Number.isFinite(Number(raw.perfLen)) ? Math.min(2400, Math.max(0, Math.round(Number(raw.perfLen)))) : 0; S.ver++;
  adoptSampler(raw.sampler);
  if (raw.preset) S.preset = raw.preset;
  { const a = adoptArcs('human', raw.s?.arcs); if (a) S.s.arcs = a; const d = adoptArcs('dog', raw.s?.arcsDog); if (d) S.s.arcsDog = d; }
}
/** Sampler settings and cut rectangles, never the picture or your erasing. */
function samplerSettings() {
  return {
    opts: SM.opts, region: SM.region, clean: SM.clean, reg: SM.reg, exposure: SM.exposure,
    picture: SM.loaded ? { name: SM.name, W: SM.W, H: SM.H } : (S.savedSampler?.picture ?? null),
    cuts: SM.loaded ? SM.cuts.map((c) => ({ x: c.x, y: c.y, w: c.w, h: c.h, label: c.label, manual: Boolean(c.manual), exposure: c.exposure, dx: c.dx || 0, dy: c.dy || 0 })) : (S.savedSampler?.cuts ?? []),
  };
}
function adoptSampler(raw) {
  if (!raw || typeof raw !== 'object') return;
  const n = (v, d, a, b) => (Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : d);
  for (const k of Object.keys(SLICE_DEFAULTS)) {
    if (!(raw.opts && k in raw.opts)) continue;
    const d = SLICE_DEFAULTS[k];
    SM.opts[k] = typeof d === 'number' ? n(raw.opts[k], d, 0, 10000) : typeof d === 'boolean' ? Boolean(raw.opts[k]) : (['auto', 'row', 'column', 'grid', 'even', 'count'].includes(raw.opts[k]) ? raw.opts[k] : d);
  }
  if (raw.clean) { SM.clean.paper = Boolean(raw.clean.paper); SM.clean.threshold = n(raw.clean.threshold, 30, 0, 255); SM.clean.softness = n(raw.clean.softness, 24, 1, 255); }
  if (['feet', 'centre', 'layout'].includes(raw.reg)) SM.reg = raw.reg;
  SM.exposure = Math.round(n(raw.exposure, 2, 1, 48));
  const r = raw.region; SM.region = r && [r.x, r.y, r.w, r.h].every(Number.isFinite) ? { x: r.x, y: r.y, w: r.w, h: r.h } : null;
  S.savedSampler = { picture: raw.picture ?? null, cuts: Array.isArray(raw.cuts) ? raw.cuts.filter((c) => [c.x, c.y, c.w, c.h].every(Number.isFinite)) : [] };
}
function load() {
  try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); if (raw) adopt(raw); } catch { /* storage unavailable: start from defaults */ }
}

// ---------- attachments ----------
const ATT_IMG_KEY = 'walkbase.attachimgs';
const figKey = (p = S.p) => (p.rig === 'dog' ? (SPECIES[p.dogSpecies] ? p.dogSpecies : 'dog') : 'human');
const wd = (s) => wordsFor(figKey())(s);
const attachList = () => S.attach[figKey()] || (S.attach[figKey()] = []);
const attachItem = (id = S.attachSel) => (id ? attachList().find((a) => a.id === id) || null : null);
/** Every picture some attachment uses, for saving. */
function usedImages() {
  const urls = imageUrls(); const out = {};
  for (const rig of FIGS) for (const a of S.attach[rig] || []) if (a.img && urls[a.img]) out[a.img] = urls[a.img];
  return out;
}
function saveAttachImages() {
  try { localStorage.setItem(ATT_IMG_KEY, JSON.stringify(usedImages())); }
  catch { setMessage('That picture is too big to keep between visits. It stays until you close the page, and Save settings keeps it in the file.'); }
}
function loadAttachImages() {
  try {
    const raw = JSON.parse(localStorage.getItem(ATT_IMG_KEY) || '{}');
    const want = new Set(); for (const rig of FIGS) for (const a of S.attach[rig] || []) if (a.img) want.add(a.img);
    Promise.all(Object.entries(raw).filter(([id, url]) => want.has(id) && typeof url === 'string' && url.startsWith('data:image/')).map(([id, url]) => registerImage(id, url))).then(() => render());
  } catch { /* none kept */ }
}
/** Makes a stored list safe: known shapes, parts the figure has, numbers in range, colours as hex. */
function cleanAttach(raw) {
  const out = Object.fromEntries(FIGS.map((f) => [f, []]));
  for (const fig of FIGS) {
    const ok = new Set(attachTargets(rigOfFig(fig)).map((t) => t.key));
    for (const a of Array.isArray(raw?.[fig]) ? raw[fig] : []) {
      if (!a || !['ellipse', 'rect', 'triangle', 'line', 'image', 'strip'].includes(a.kind)) continue;
      if (!ok.has(targetKey({ part: a.part, seg: a.seg ?? null, side: a.side ?? null }))) continue;
      const num = (v, d, lo, hi) => Math.min(hi, Math.max(lo, finite(v, d)));
      const col = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
      const an = a.anchor || {};
      out[fig].push({
        id: String(a.id || freshId()).slice(0, 40), name: String(a.name || a.kind).slice(0, 40), kind: a.kind, part: a.part, seg: a.seg ?? null, side: a.side ?? null,
        anchor: { mode: an.mode === 'free' ? 'free' : 'boundary', t: num(an.t, 0.12, 0, 1), off: num(an.off, 0, -0.3, 0.3), x: num(an.x, 0, -1.5, 1.5), y: num(an.y, 0, -1.5, 1.5) },
        x: num(a.x, 0, -2, 2), y: num(a.y, 0, -2, 2), rot: num(a.rot, 0, -360, 360), scale: num(a.scale, 1, 0.05, 8), w: num(a.w, 0.26, 0.01, 3), h: num(a.h, 0.18, 0.01, 3),
        fill: col(a.fill, '#f2b84b'), stroke: col(a.stroke, '#26231f'), sw: num(a.sw, 2, 0, 12), opacity: num(a.opacity, 0.92, 0, 1), depth: a.depth === 'behind' ? 'behind' : 'front', flip: Boolean(a.flip), visible: a.visible !== false,
        img: a.kind === 'image' ? String(a.img || '') : null,
        ...(a.kind === 'strip' ? { phys: cleanPhys(a.phys) } : {}),
      });
    }
  }
  return out;
}
/** Where a new attachment goes: the selected part if it can carry one, otherwise the chest or the mid back. */
function defaultTarget() {
  const rig = S.p.rig; const targets = attachTargets(rig);
  if (S.sel) { const t = targets.find((q) => q.part === S.sel.part && q.side === (S.sel.side ?? null) && (q.seg ?? 0) === 0); if (t) return t; }
  return targets.find((t) => t.part === (rig === 'dog' ? 'dog.spine2' : 'spine.upper')) || targets[0];
}
function addAttach(kind, over = {}, target = null) {
  const it = newItem(kind, target || defaultTarget(), over);
  // Start upright on the screen, whatever way the part points; from here it turns with the part.
  if (over.rot == null && S.last?.pz && S.last?.cam) { const f = itemFrame(S.last.pz, S.last.cam, it); if (f) { let r = (-f.ang * 180) / Math.PI; r = ((r + 540) % 360) - 180; it.rot = Math.round(r * 10) / 10; } }
  attachList().push(it); S.attachSel = it.id; S.sel = null;
  if (S.tab !== 'Attach') S.tab = 'Attach';
  renderPanel(); render(); save();
  return it;
}
function selectAttach(id) {
  S.attachSel = id; if (id) { S.sel = null; S.tab = 'Attach'; }
  renderPanel(); render();
}
function patchAttach(id, patch, { panel = false } = {}) {
  const it = attachItem(id); if (!it) return;
  const { anchor, ...rest } = patch;
  Object.assign(it, rest); if (anchor) it.anchor = { ...it.anchor, ...anchor };
  if (it.kind === 'image' && 'w' in rest) { const asp = imageInfo(it.img)?.aspect; if (asp) it.h = it.w * asp; } // a picture keeps its own shape
  render(); save(); if (panel) renderPanel();
}
async function pickAttachImage(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a picture this browser can open.')); i.src = url; });
    const k = Math.min(1, 720 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9); // PNG keeps transparency
    const id = freshId();
    await registerImage(id, data);
    const aspect = c.height / c.width;
    addAttach('image', { img: id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Picture', w: 0.3, h: 0.3 * aspect, sw: 0 });
    saveAttachImages(); setMessage('Picture added. Drag its ring onto the part it belongs to, then size and turn it.');
  } catch (e) { setMessage(e.message); } finally { URL.revokeObjectURL(url); }
}
const partName = (it) => { const t = attachTargets(S.p.rig).find((q) => q.key === targetKey(it)); return t ? wd(t.label) : it.part; };

function attachSection() {
  const rig = S.p.rig; const list = attachList(); const sel = attachItem();
  const host = h('div', { class: 'attach' });
  const fileIn = h('input', { type: 'file', accept: 'image/*', class: 'sr', tabindex: '-1', 'aria-label': 'Choose a picture to attach', testid: 'attach-file', onChange: (e) => { pickAttachImage(e.target.files?.[0]); e.target.value = ''; } });
  const addMenu = menuButton({ label: 'Add', testid: 'attach-add', iconName: null, className: 'btn primary', items: () => [
    ...KINDS.map(([k, l]) => ({ label: l, testid: `attach-add-${k}`, onClick: () => addAttach(k) })),
    { separator: true },
    { label: 'Picture (PNG with transparency, or a photo)…', testid: 'attach-add-image', onClick: () => document.querySelector('[data-testid="attach-file"]')?.click() },
  ] });
  const where = defaultTarget();
  host.append(h('section', { class: 'group' }, h('h3', null, 'Attachments'),
    h('p', { class: 'hint' }, `Build out the character with shapes and pictures. Each one is fixed to a part of the body and moves with it, including every curve and automation on that part. New ones go on: ${S.sel ? partLabel(S.sel.part, S.sel.side) : (where?.label ?? 'the body')}. Select a part first to choose.`),
    h('div', { class: 'btnrow' }, addMenu, fileIn)));

  const rows = h('section', { class: 'group' }, h('h3', null, `On this ${rig === 'dog' ? wd('dog') : 'figure'} (${list.length})`));
  if (!list.length) rows.append(h('p', { class: 'hint' }, 'Nothing attached yet. Tap Add.'));
  for (const it of list) {
    rows.append(h('div', { class: `att-item${it.visible ? '' : ' hidden'}`, testid: `attach-item-${it.id}` },
      h('button', { type: 'button', class: 'att-pick', testid: `attach-pick-${it.id}`, 'aria-pressed': String(it.id === S.attachSel), onClick: () => selectAttach(it.id) }, h('span', { class: 'att-swatch', style: it.kind === 'image' ? 'background: repeating-conic-gradient(#bbb 0 25%, #eee 0 50%) 50% / 8px 8px' : `background: ${it.kind === 'line' ? it.stroke : it.fill}` }), it.name, h('small', null, partName(it))),
      h('button', { type: 'button', class: 'btn tiny', testid: `attach-vis-${it.id}`, 'aria-label': `${it.visible ? 'Hide' : 'Show'} ${it.name}`, onClick: () => { it.visible = !it.visible; renderPanel(); render(); save(); } }, it.visible ? 'Hide' : 'Show')));
  }
  host.append(rows);
  if (!sel) { if (list.length) host.append(h('p', { class: 'hint' }, 'Pick one above, or tap one on the figure, to change it.')); return host; }

  const num = (label, get, set, min, max, step, tid, help = '') => {
    const val = get();
    const n = h('input', { type: 'number', class: 'num', inputmode: 'decimal', min, max, step, value: +Number(val).toFixed(3), 'aria-label': label, testid: `${tid}-num` });
    const r = h('input', { type: 'range', class: 'rng', min, max, step, value: val, 'aria-label': `${label} slider`, testid: tid });
    r.addEventListener('input', () => { set(Number(r.value)); n.value = +Number(r.value).toFixed(3); });
    n.addEventListener('change', () => { const v = Math.min(max, Math.max(min, Number(n.value) || 0)); set(v); r.value = v; n.value = v; });
    return h('div', { class: 'row noreset' }, labBtn(label), h('div', { class: 'ctl' }, r, n), h('p', { class: 'help' }, help));
  };
  const P_ = (patch) => patchAttach(sel.id, patch);
  const seg = (label, items, cur, on, tid) => h('div', { class: 'row noreset' }, labBtn(label), h('div', { class: 'seg', role: 'group', 'aria-label': label }, items.map(([v, t]) => h('button', { type: 'button', class: 'segbtn', testid: `${tid}-${v}`, 'aria-pressed': String(cur === v), onClick: () => on(v) }, t))), h('p', { class: 'help' }));
  const targets = attachTargets(rig);
  const partSel = h('select', { class: 'select', 'aria-label': 'Attached to', testid: 'attach-part', onChange: (e) => {
    const t = targets.find((q) => q.key === e.target.value); if (!t) return;
    patchAttach(sel.id, { part: t.part, seg: t.seg, side: t.side, anchor: { mode: 'boundary', t: sel.anchor.t, off: 0 } }, { panel: true });
  } }, targets.map((t) => h('option', { value: t.key, selected: t.key === targetKey(sel) }, wd(t.label))));
  const nameIn = h('input', { type: 'text', class: 'num', maxlength: 40, value: sel.name, 'aria-label': 'Name', testid: 'attach-name', onChange: (e) => { sel.name = e.target.value.trim().slice(0, 40) || sel.name; renderPanel(); save(); } });

  host.append(h('section', { class: 'group', testid: 'attach-props' }, h('h3', null, `${sel.name}`),
    h('div', { class: 'row att-name' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Name')), nameIn),
    h('div', { class: 'row att-name' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Attached to')), partSel),
    h('p', { class: 'hint' }, 'On the figure: drag the ring to slide it round the edge of the part, or drop it on another part to move the attachment there. The dot moves it, the round handle turns it, the square sizes it.')));
  host.append(h('section', { class: 'group' }, h('h3', null, 'Anchor'),
    seg('Fixed to', [['boundary', 'Edge of part'], ['free', 'A point']], sel.anchor.mode, (v) => {
      if (v === sel.anchor.mode) return;
      const fr = S.last?.attach?.find((p) => p.it.id === sel.id)?.f;
      const a = fr ? anchorLocal(sel, fr.L, fr.r) : { x: 0, y: 0 };
      patchAttach(sel.id, { anchor: v === 'free' ? { mode: 'free', x: a.x, y: a.y } : { mode: 'boundary' } }, { panel: true });
    }, 'attach-mode'),
    sel.anchor.mode === 'boundary'
      ? [num('Round the edge', () => sel.anchor.t, (v) => P_({ anchor: { t: v } }), 0, 1, 0.005, 'attach-t', 'Where on the outline of the part it is fixed. 0 is the top of the start end, and it goes round.'),
        num('Out from the edge', () => sel.anchor.off, (v) => P_({ anchor: { off: v } }), -0.25, 0.25, 0.002, 'attach-off', 'Pull the anchor away from the outline, or push it inside the part.')]
      : [num('Along the part', () => sel.anchor.x, (v) => P_({ anchor: { x: v } }), -1, 1, 0.005, 'attach-ax'), num('Across the part', () => sel.anchor.y, (v) => P_({ anchor: { y: v } }), -0.6, 0.6, 0.005, 'attach-ay')]));
  if (sel.kind === 'strip') {
    const ph = (k, label, tid, help) => { const [lo, hi, st] = STRIP_LIMITS[k]; return num(label, () => sel.phys[k], (v) => { sel.phys = cleanPhys({ ...sel.phys, [k]: v }); render(); save(); }, lo, hi, st, tid, help); };
    host.append(h('section', { class: 'group', testid: 'attach-phys' }, h('h3', null, 'Shape'),
      num('Width at the top', () => sel.w, (v) => P_({ w: v }), 0.02, 1.2, 0.005, 'attach-w'),
      num('Length', () => sel.h, (v) => P_({ h: v }), 0.08, 2.5, 0.005, 'attach-h', 'How long it is when it hangs straight. The square on the stage drags it too.'),
      ph('taper', 'Width at the tip', 'phys-taper', 'As a share of the width at the top.'),
      ph('nodes', 'Joints', 'phys-nodes', 'More joints bend more smoothly and cost more to work out.'),
      seg('Depth', [['front', 'In front'], ['behind', 'Behind']], sel.depth, (v) => patchAttach(sel.id, { depth: v }, { panel: true }), 'attach-depth')),
      h('section', { class: 'group' }, h('h3', null, 'Physics'),
        h('p', { class: 'hint' }, 'The strip is pinned at its ring and swings as the body moves. It is worked out for the whole cycle at once, so scrubbing and exporting always match. Turn on Motion arcs to see where its tip and middle go.'),
        ph('gravity', 'Gravity', 'phys-gravity', 'How hard it is pulled down. 0 floats.'),
        ph('stiff', 'Stiffness', 'phys-stiff', '0 is limp cloth. Higher keeps its shape, like hair held in a band.'),
        ph('damp', 'Air drag', 'phys-damp', 'Slows the swing. Higher settles faster and lags less.'),
        ph('wind', 'Wind', 'phys-wind', 'A push forward (+) or back (-).'),
        ph('gusts', 'Gusts per cycle', 'phys-gusts', 'How many times the wind swells and fades in one cycle. 0 is steady.'),
        ph('follow', 'Follow the part', 'phys-follow', '0 hangs straight down. 1 points the way the part does, like a ponytail.'),
        ph('angle', 'Rest angle', 'phys-angle', 'Degrees to swing the resting direction forward (+) or back (-).')));
  } else host.append(h('section', { class: 'group' }, h('h3', null, 'Place'),
    num('Along', () => sel.x, (v) => P_({ x: v }), -1.5, 1.5, 0.005, 'attach-x', 'Distance from the anchor along the part, in the figure\'s units.'),
    num('Across', () => sel.y, (v) => P_({ y: v }), -1.5, 1.5, 0.005, 'attach-y'),
    num('Turn', () => sel.rot, (v) => P_({ rot: v }), -180, 180, 1, 'attach-rot', 'Degrees, from lying along the part.'),
    num('Size', () => sel.scale, (v) => P_({ scale: v }), 0.1, 5, 0.01, 'attach-scale', 'Makes the whole attachment bigger or smaller.'),
    num('Width', () => sel.w, (v) => P_({ w: v }), 0.02, 1.5, 0.005, 'attach-w'),
    sel.kind === 'image' || sel.kind === 'line' ? null : num('Height', () => sel.h, (v) => P_({ h: v }), 0.02, 1.5, 0.005, 'attach-h'),
    seg('Depth', [['front', 'In front'], ['behind', 'Behind']], sel.depth, (v) => patchAttach(sel.id, { depth: v }, { panel: true }), 'attach-depth'),
    h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Flip')), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: sel.flip, testid: 'attach-flip', onChange: (e) => P_({ flip: e.target.checked }) }), h('span', null, 'Flip across the part')))));
  if (sel.kind !== 'image') {
    host.append(h('section', { class: 'group' }, h('h3', null, 'Look'),
      sel.kind === 'line' ? null : h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Fill')), h('input', { type: 'color', class: 'color', value: sel.fill, 'aria-label': 'Fill colour', testid: 'attach-fill', onInput: (e) => P_({ fill: e.target.value }) })),
      h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Outline')), h('input', { type: 'color', class: 'color', value: sel.stroke, 'aria-label': 'Outline colour', testid: 'attach-stroke', onInput: (e) => P_({ stroke: e.target.value }) })),
      num('Outline width', () => sel.sw, (v) => P_({ sw: v }), 0, 12, 0.5, 'attach-sw'),
      num('Opacity', () => sel.opacity, (v) => P_({ opacity: v }), 0, 1, 0.01, 'attach-opacity')));
  } else host.append(h('section', { class: 'group' }, h('h3', null, 'Look'), num('Opacity', () => sel.opacity, (v) => P_({ opacity: v }), 0, 1, 0.01, 'attach-opacity')));
  const sided = targets.find((t) => t.key === targetKey(sel))?.side;
  host.append(h('section', { class: 'group' }, h('h3', null, 'Actions'),
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn', testid: 'attach-dup', onClick: () => { const c = cloneItem(sel); c.x += 0.04; c.y += 0.04; attachList().push(c); S.attachSel = c.id; renderPanel(); render(); save(); } }, 'Duplicate'),
      sided ? h('button', { type: 'button', class: 'btn', testid: 'attach-mirror', onClick: () => { const fr = S.last?.attach?.find((p) => p.it.id === sel.id)?.f; if (!fr) return; const m = mirroredItem(sel, fr.L, fr.r); attachList().push(m); S.attachSel = m.id; renderPanel(); render(); save(); setMessage('Copied to the other side.'); } }, 'Copy to the other side') : null,
      h('button', { type: 'button', class: 'btn', testid: 'attach-del', onClick: () => { S.attach[rig] = list.filter((a) => a.id !== sel.id); S.attachSel = null; renderPanel(); render(); save(); } }, 'Delete'),
      h('button', { type: 'button', class: 'btn ghost', testid: 'attach-done', onClick: () => selectAttach(null) }, 'Done'))));
  return host;
}

/** Which points get a motion arc. Ticking one draws its path; its dots can be dragged. */
function arcSection() {
  const rig = S.p.rig === 'dog' ? 'dog' : 'human'; const key = rig === 'dog' ? 'arcsDog' : 'arcs';
  const on = new Set(S.s[key]);
  const toggle = (id, v) => { const s = new Set(S.s[key]); if (v) s.add(id); else s.delete(id); S.s[key] = arcPoints(rig).map((p) => p.id).filter((i) => s.has(i)); if (v && !S.s.showArcs) S.s.showArcs = true; save(); renderPanel(); render(); };
  const pts = arcPoints(rig); const groups = [...new Set(pts.map((p) => p.group))];
  const edit = !P().perf && !P().sampled;
  return h('section', { class: 'group', testid: 'arc-section' }, h('h3', null, 'Arc points'),
    h('p', { class: 'hint' }, edit ? 'Tick the points to trace. With Motion arcs on, drag any dot on a path to bend the movement there; only the curves that move that point change.' : 'These arcs follow the whole performance. To reshape a movement, switch the performance off and drag the dots on the plain cycle.'),
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn', testid: 'arc-all', onClick: () => { S.s[key] = pts.map((p) => p.id); S.s.showArcs = true; save(); renderPanel(); render(); } }, 'All'),
      h('button', { type: 'button', class: 'btn', testid: 'arc-none', onClick: () => { S.s[key] = []; save(); renderPanel(); render(); } }, 'None'),
      h('button', { type: 'button', class: 'btn', testid: 'arc-default', onClick: () => { S.s[key] = DEFAULT_ARCS[rig].slice(); save(); renderPanel(); render(); } }, 'Usual four')),
    groups.map((g) => h('div', { class: 'arcgroup' }, h('h4', null, g),
      pts.filter((p) => p.group === g).map((p) => h('label', { class: 'chk' },
        h('input', { type: 'checkbox', checked: on.has(p.id), testid: `arc-${p.id}`, onChange: (e) => toggle(p.id, e.target.checked) }),
        h('span', { class: 'arcsw', style: `background:${arcColor(rig, p.id)}` }), h('span', null, wd(p.label)))))));
}
/** The attachment under a canvas point. Front ones win over the body; behind ones only where no body part is. */
function pickAttachment(q, which) {
  const info = S.last; if (!info?.attach?.length) return null;
  const slack = Math.max(4, 12 * (info.cam?.k ?? 1));
  const cand = info.attach.filter((p) => p.it.depth === which && hitItem(p.it, p.f, info.cam, q.x, q.y, p.it.kind === 'image' ? imageInfo(p.it.img)?.aspect : null, slack));
  cand.sort((a, b) => b.f.depth - a.f.depth);
  return cand[0] || null;
}
/** A dot on a motion arc under the finger. Dragging it bends that curve of the movement; a performance's arcs are for looking at only. */
function arcDragStart(e, toFrame) {
  const dots = S.last?.arcDots; const q = toFrame(e.clientX, e.clientY);
  if (!S.s.showArcs || !dots?.length || !S.map || !q || P().perf || P().sampled) return null;
  const m = S.map; const radius = 16 * m.d * (m.fcw / m.zw);
  let best = null; let bd = radius;
  for (const d of dots) { const dist = Math.hypot(d.x - q.x, d.y - q.y); if (dist < bd || (best && dist === bd && d.frame === S.frame)) { bd = dist; best = d; } }
  const rig = P().rig === 'dog' ? 'dog' : 'human';
  const def = best && arcPoint(rig, best.id);
  if (!def) return null;
  pause();
  return { arc: true, def, frame: best.frame, curFrame: S.frame, cam: S.last.cam };
}
function arcDragMove(d, e, toFrame) {
  const q = toFrame(e.clientX, e.clientY); if (!q) return;
  const r = moveArcPoint({ params: P(), def: d.def, frame: d.frame, curFrame: d.curFrame, target: [q.x, q.y], project: (w) => d.cam.p(w) });
  if (!r) { setMessage('This point cannot be reshaped while a channel on its path runs free.'); return; }
  for (const [id, s] of Object.entries(r.entries)) S.motion[id] = s;
  markCustom(); render();
}
/** The fix handle at the end of the selected part: dragging it adds a smooth correction round this frame and leaves the animation underneath alone. */
function fixDragStart(e, toFrame) {
  const hnd = S.last?.fixHandle; const q = toFrame(e.clientX, e.clientY);
  if (!S.fixMode || !S.sel || !hnd || !q || !S.map || S.source === 'sampled') return null;
  const m = S.map; const radius = 20 * m.d * (m.fcw / m.zw);
  const dEnd = Math.hypot(hnd.x - q.x, hnd.y - q.y); const dBase = hnd.base ? Math.hypot(hnd.base.x - q.x, hnd.base.y - q.y) : Infinity;
  if (Math.min(dEnd, dBase) > radius) return null;
  const which = dBase < dEnd ? 'start' : 'end';
  pause();
  const params0 = P(); const T = params0.perf ? params0.perf.T : cycleFrames(params0).frames.length; const ex = Math.max(1, params0.exposure ?? 1);
  return { fix: true, params0, lanes0: S.lanes, T, frame: Math.min(T - 1, Math.floor(S.frame / ex) * ex), part: S.sel.part, side: S.sel.side ?? null, which, cam: S.last.cam };
}
function fixDragMove(d, e, toFrame) {
  const q = toFrame(e.clientX, e.clientY); if (!q) return;
  const r = solveFix({ params: d.params0, frame: d.frame, part: d.part, side: d.side, which: d.which, target: [q.x, q.y], project: (w) => d.cam.p(w) });
  if (!r) return;
  S.lanes = writeFix(d.lanes0, r.delta, d.frame, S.fixSpread, d.T); S.ver++;
  render();
}
function attachDragStart(e, toFrame) {
  const hs = S.last?.handles; const id = S.attachSel;
  if (!id || !hs || hs.id !== id || !S.map) return null;
  const q = toFrame(e.clientX, e.clientY); if (!q) return null;
  const m = S.map; const radius = 24 * m.d * (m.fcw / m.zw);
  const kind = pickHandle(hs, q.x, q.y, radius);
  if (!kind) return null;
  const entry = S.last.attach.find((p) => p.it.id === id); const it = attachItem(id);
  if (!entry || !it) return null;
  pause();
  return { kind, id, q0: q, it0: clone(it), f: entry.f, c0: { x: hs.center.x, y: hs.center.y }, pz: S.last.pz, cam: S.last.cam, shapes: S.last.shapes };
}
function attachDragMove(d, e, toFrame) {
  const q = toFrame(e.clientX, e.clientY); const it = attachItem(d.id);
  if (!q || !it) return;
  const { f, it0 } = d; const loc = toLocal(f, q.x, q.y);
  if (d.kind === 'anchor') {
    if (it0.anchor.mode === 'free') it.anchor = { ...it0.anchor, x: Math.max(-1.5, Math.min(1.5, loc.x)), y: Math.max(-1.5, Math.min(1.5, loc.y)) };
    else {
      const t = nearestEdgeT(f.L, f.r, loc.x, loc.y); const p = edgePoint(f.L, f.r, t);
      let off = (loc.x - p.x) * p.nx + (loc.y - p.y) * p.ny; off = Math.abs(off) < 0.012 ? 0 : Math.max(-0.25, Math.min(0.25, off));
      it.anchor = { ...it0.anchor, t, off };
    }
  } else if (d.kind === 'center') {
    const a = anchorLocal(it, f.L, f.r); it.x = Math.max(-2, Math.min(2, loc.x - a.x)); it.y = Math.max(-2, Math.min(2, loc.y - a.y));
  } else if (d.kind === 'rotate') {
    const ang = Math.atan2(q.y - d.c0.y, q.x - d.c0.x);
    let rot = ((((ang - f.ang) * 180) / Math.PI + 90 + 540) % 360) - 180;
    const snapped = Math.round(rot / 15) * 15; if (Math.abs(rot - snapped) < 3) rot = snapped;
    it.rot = Math.round(rot * 10) / 10;
  } else if (d.kind === 'scale' && it.kind === 'strip') {
    it.h = Math.round(Math.max(0.08, Math.min(2.5, Math.hypot(q.x - d.c0.x, q.y - d.c0.y) / f.scale)) * 1000) / 1000;
  } else if (d.kind === 'scale') {
    const r0 = Math.max(1e-3, Math.hypot(d.q0.x - d.c0.x, d.q0.y - d.c0.y)); const r1 = Math.hypot(q.x - d.c0.x, q.y - d.c0.y);
    it.scale = Math.max(0.1, Math.min(8, it0.scale * (r1 / r0)));
  }
  render();
}
/** Dropping the anchor on another part moves the attachment there, like pinning a collage piece onto a different spot. */
function reparentAttach(it, d, q) {
  const pick = pickPart(d.shapes.filter((s) => !s.attach), q.x, q.y);
  if (!pick) return false;
  const cands = attachTargets(S.p.rig).filter((t) => t.part === pick.part && t.side === (pick.side ?? null));
  if (!cands.length) return false;
  let best = null; let bd = Infinity;
  for (const t of cands) {
    const f = itemFrame(d.pz, d.cam, { ...it, part: t.part, seg: t.seg, side: t.side }); if (!f) continue;
    const l = toLocal(f, q.x, q.y); const cx = Math.min(f.L, Math.max(0, l.x)); const dist = Math.hypot(l.x - cx, l.y);
    if (dist < bd) { bd = dist; best = { t, f, l }; }
  }
  if (!best || targetKey(best.t) === targetKey(it)) return false;
  it.part = best.t.part; it.seg = best.t.seg; it.side = best.t.side;
  it.anchor = { mode: 'boundary', t: nearestEdgeT(best.f.L, best.f.r, best.l.x, best.l.y), off: 0, x: 0, y: 0 };
  const a = anchorLocal(it, best.f.L, best.f.r); it.x = best.l.x - a.x; it.y = best.l.y - a.y;
  return true;
}
function attachDragEnd(d, e, toFrame) {
  const it = attachItem(d.id); const q = toFrame(e.clientX, e.clientY);
  if (it && q && d.kind === 'anchor') { if (reparentAttach(it, d, q)) setMessage(`Moved to ${partName(it).toLowerCase()}.`); }
  render(); renderPanel(); save();
}

// ---------- reference picture ----------
/** Draws the picture under the figure. Its ground line sits on the figure's ground, then Size, Left/right and Up/down move it from there. */
function refPaint(ctx, w, h, cam) {
  if (!REF.img || !REF.on) return;
  const gy = cam ? cam.p([cam.target?.[0] ?? 0, 0, 0]).y : h * 0.8;
  const ph = h * REF.size; const pw = ph * (REF.img.naturalWidth / REF.img.naturalHeight);
  const cx = w / 2 + REF.x * w; const top = gy + REF.y * h - REF.ground * ph;
  ctx.save(); ctx.globalAlpha = REF.opacity;
  if (REF.flip) { ctx.translate(cx, 0); ctx.scale(-1, 1); ctx.drawImage(REF.img, -pw / 2, top, pw, ph); } else ctx.drawImage(REF.img, cx - pw / 2, top, pw, ph);
  ctx.restore();
}
function refSave() {
  try {
    const { on, opacity, size, x, y, ground, flip, export: exp } = REF;
    localStorage.setItem(REF_KEY, JSON.stringify({ settings: { on, opacity, size, x, y, ground, flip, export: exp }, name: REF.name, data: REF.data }));
  } catch { setMessage('The picture is too big to keep between visits. It stays until you close the page.'); }
}
function refAdopt(raw) {
  if (!raw?.settings) return;
  const n = (v, d, a, b) => (Number.isFinite(Number(v)) ? Math.min(b, Math.max(a, Number(v))) : d);
  const q = raw.settings;
  REF.on = q.on !== false; REF.opacity = n(q.opacity, 0.5, 0, 1); REF.size = n(q.size, 1, 0.1, 4); REF.x = n(q.x, 0, -1, 1); REF.y = n(q.y, 0, -1, 1); REF.ground = n(q.ground, 0.9, 0, 1); REF.flip = Boolean(q.flip); REF.export = Boolean(q.export);
  if (typeof raw.data === 'string' && raw.data.startsWith('data:image/')) { REF.data = raw.data; REF.name = String(raw.name || 'picture').slice(0, 80); const i = new Image(); i.onload = () => { REF.img = i; render(); if (S.tab === 'Guides') renderPanel(); }; i.src = raw.data; }
}
/** Reads a picture, shrinks it to a size that is kept comfortably in the browser, and puts it under the figure. */
async function pickRef(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('That file is not a picture this browser can open.')); i.src = url; });
    const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    REF.data = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85); REF.name = file.name.slice(0, 80);
    const i2 = new Image(); await new Promise((res) => { i2.onload = res; i2.src = REF.data; }); REF.img = i2;
    REF.on = true; refSave(); renderPanel(); render(); setMessage('Picture added under the figure. Set where its ground line is, then match its size.');
  } catch (e) { setMessage(e.message); } finally { URL.revokeObjectURL(url); }
}
function refSection() {
  const set = (k, v) => { REF[k] = v; refSave(); render(); };
  const slider = (label, key, min, max, step, tid) => h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, label),
    h('input', { type: 'range', class: 'rng', min, max, step, value: REF[key], testid: tid, 'aria-label': label, onInput: (e) => { set(key, Number(e.target.value)); const n = e.target.parentElement.querySelector('.num'); if (n) n.value = e.target.value; } }),
    h('input', { type: 'number', class: 'num', min, max, step, value: REF[key], 'aria-label': `${label} value`, onChange: (e) => { set(key, Math.min(max, Math.max(min, Number(e.target.value)))); renderPanel(); } }));
  const has = Boolean(REF.img);
  return h('section', { class: 'group', testid: 'ref-section' }, h('h3', null, 'Reference picture'),
    h('p', { class: 'hint' }, 'Put a photo, a frame of footage or one of your drawings under the figure to line it up. Tap where its feet touch the ground with Ground line, then match Size.'),
    h('div', { class: 'btnrow' }, h('label', { class: 'btn file-btn' }, has ? 'Replace picture' : 'Add picture', h('input', { type: 'file', accept: 'image/*', class: 'file-input', 'aria-label': 'Choose a reference picture', testid: 'ref-file', onChange: (e) => { pickRef(e.target.files?.[0]); e.target.value = ''; } })),
      has ? h('button', { type: 'button', class: 'btn', testid: 'ref-remove', onClick: () => { REF.img = null; REF.data = null; REF.name = ''; refSave(); renderPanel(); render(); } }, 'Remove') : null),
    has ? h('div', null,
      h('p', { class: 'hint', testid: 'ref-name' }, REF.name),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: REF.on, testid: 'ref-on', onChange: (e) => set('on', e.target.checked) }), h('span', null, 'Show it')),
      slider('Opacity', 'opacity', 0, 1, 0.05, 'ref-opacity'),
      slider('Size', 'size', 0.1, 4, 0.01, 'ref-size'),
      slider('Left and right', 'x', -1, 1, 0.005, 'ref-x'),
      slider('Up and down', 'y', -1, 1, 0.005, 'ref-y'),
      slider('Ground line', 'ground', 0, 1, 0.005, 'ref-ground'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: REF.flip, testid: 'ref-flip', onChange: (e) => set('flip', e.target.checked) }), h('span', null, 'Flip left to right')),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: REF.export, testid: 'ref-export', onChange: (e) => set('export', e.target.checked) }), h('span', null, 'Include it in exports'))) : null);
}

// ---------- stage ----------
let stage; let frameCanvas; let hud; let wrapEl; let editor = null; let laneEd = null;
const dpr = () => Math.min(2, window.devicePixelRatio || 1);
let pending = false;
function render() {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => { pending = false; paint(); });
}
function paint() {
  if (!stage) return;
  const r = wrapEl.getBoundingClientRect();
  const d = dpr();
  const cw = Math.max(1, Math.round(r.width * d));
  const ch = Math.max(1, Math.round(r.height * d));
  if (stage.width !== cw || stage.height !== ch) { stage.width = cw; stage.height = ch; }
  const ctx = stage.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim() || '#ddd8cc';
  ctx.fillRect(0, 0, cw, ch);
  const aspect = S.x.width / S.x.height;
  let fw = cw * 0.96; let fh = fw / aspect;
  if (fh > ch * 0.96) { fh = ch * 0.96; fw = fh * aspect; }
  const zw = fw * S.zoom; const zh = fh * S.zoom;
  const fcw = Math.min(3200, Math.max(200, Math.round(zw))); const fch = Math.round(fcw / aspect);
  if (frameCanvas.width !== fcw || frameCanvas.height !== fch) { frameCanvas.width = fcw; frameCanvas.height = fch; }
  const info = drawScene(frameCanvas.getContext('2d'), P(), S.s, fcw, fch, S.frame, { selection: S.sel, under: refPaint, handles: S.attachSel, fix: S.fixMode && S.sel ? true : false });
  const x0 = (cw - zw) / 2 + S.panX * d; const y0 = (ch - zh) / 2 + S.panY * d;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; ctx.fillRect(x0, y0, zw, zh);
  ctx.drawImage(frameCanvas, x0, y0, zw, zh);
  S.last = info; S.map = { x0, y0, zw, zh, fcw, fch, d, left: r.left, top: r.top };
  updateHud(info);
}
function updateHud(info) {
  hud.hidden = !LAYOUT.hud; // the frame counter is off by default: the frame number and time are already in the transport bar
  const { frames } = cycleFrames(P());
  const key = info.key ? ` · ${info.key.name} (${info.key.side})` : '';
  const pf = P().perf;
  const speed = pf ? pf.x[pf.T] / (pf.T / S.p.fps) : cycleTravel(S.p) / (frames.length / S.p.fps);
  hud.textContent = info.label != null
    ? `Sampled frame ${info.label} (${info.drawing} of ${info.drawings}) · timeline frame ${S.frame + 1} of ${frames.length}`
    : `Drawing ${info.drawing} of ${info.drawings} · frame ${S.frame + 1} of ${frames.length}${key} · ${speed.toFixed(2)} ${S.p.rig === 'dog' ? 'heights' : 'legs'}/s${S.sel ? ` · ${partLabel(S.sel.part, S.sel.side)}` : ''}`;
  const f = document.getElementById('frameNum');
  if (f && document.activeElement !== f) f.value = S.frame + 1;
  const tc = document.getElementById('tc');
  if (tc) { const fps = Math.max(1, S.p.fps); const t = (n) => `${String(Math.floor(n / fps)).padStart(2, '0')}:${String(n % fps).padStart(2, '0')}`; tc.textContent = `${t(S.frame)} / ${t(frames.length)}`; }
  const cell = document.querySelector(`[data-cell="${S.frame}"]`);
  document.querySelectorAll('.cell.on').forEach((c) => c.classList.remove('on'));
  if (cell) { cell.classList.add('on'); cell.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }
  editor?.draw(); laneEd?.draw();
  refreshSparks(); refreshAutomated();
}

// ---------- state changes ----------
const frameU = () => { const fr = cycleFrames(P()).frames; const u = fr[Math.min(S.frame, fr.length - 1)].u; return u - Math.floor(u); };
/** Gait and channel settings as they are at the playhead, with any automation applied. */
const nowValues = () => { const q = P(); return q.perf ? { p: paramsAt(q, q.perf.lanes, S.frame, q.perf.live), m: motionAt(S.motion, q.perf.lanes, S.frame, q.perf.live) } : { p: q, m: S.motion }; };
function setFrame(i) {
  const n = cycleFrames(P()).frames.length;
  S.frame = ((Math.round(i) % n) + n) % n;
  render();
}
function markCustom() { if (S.preset !== 'Custom') { S.preset = 'Custom'; const sel = document.getElementById('preset'); if (sel) sel.value = 'Custom'; } }
function setParam(c, v) {
  const val = clampTo(c, v);
  S[c.scope][c.id] = val;
  if (c.scope === 'p') markCustom();
  if (c.scope === 'x' && (c.id === 'width' || c.id === 'height')) S.x[c.id] = Math.max(c.min, Math.round(val / 2) * 2);
  if (c.id === 'cycleFrames' || c.id === 'exposure') { buildStrip(); if (S.frame >= cycleFrames(P()).frames.length) S.frame = 0; }
  if (c.scope === 'x') refreshSummary();
  render(); save();
}
/** Keys that belong to one figure, so choosing a preset for the dog leaves the human's settings alone. */
const DOG_KEYS = Object.keys(DEFAULTS).filter((k) => k.startsWith('dog'));
const SHARED_KEYS = ['rig', 'fps', 'cycleFrames', 'exposure', 'travel'];
function applyPreset(name) {
  const rig = S.p.rig; const fig = figKey();
  const mine = rig === 'dog' ? DOG_KEYS : Object.keys(DEFAULTS).filter((k) => !k.startsWith('dog') && k !== 'rig');
  const reset = Object.fromEntries(mine.map((k) => [k, DEFAULTS[k]]));
  const { camYaw, ...presetP } = presetsForFigure(fig)[name] || {}; // a preset may also turn the camera, to show its movement best
  S.p = { ...S.p, ...reset, ...presetP, rig };
  if (camYaw != null) S.s.camYaw = camYaw;
  for (const k of SHARED_KEYS) if (!(k in (presetsForFigure(fig)[name] || {})) && k !== 'rig') S.p[k] = DEFAULTS[k];
  for (const id of Object.keys(S.motion)) if (rig === 'dog' ? id.startsWith('dog.') : !id.startsWith('dog.')) delete S.motion[id];
  S.preset = name; S.frame = 0;
  buildStrip(); renderPanel(); render(); save();
}
/** Switches between the human and the dog. Each keeps its own settings, motion edits and automation. */
function setRig(rig) { setFigure(rig === 'human' ? 'human' : rig === 'dog' ? 'dog' : rig); }
/** Switches figure. Each keeps its own attachments, saved performances and automation; a species also brings its own bones, so it starts from its first preset. */
function setFigure(fig) {
  if (!FIGS.includes(fig) || fig === figKey()) return;
  pause(); closeEditor(true); setArmed(false);
  S.bank[figKey()] = { lanes: S.lanes, perfLen: S.perfLen };
  const b = S.bank[fig];
  S.lanes = b?.lanes ?? {}; S.perfLen = b?.perfLen ?? 0; S.ver++;
  const rig = rigOfFig(fig); const wasRig = S.p.rig; const wasSpecies = S.p.dogSpecies;
  S.p.rig = rig; S.sel = null; S.attachSel = null; S.frame = 0; S.clipLen = null; S.clipStart = 0;
  S.clip = clipsFor(rig)[0]?.id ?? '';
  if (rig === 'dog' && (wasRig === 'dog' || wasSpecies !== fig)) { S.p.dogSpecies = fig; applyPreset(Object.keys(presetsForFigure(fig))[0]); build(); render(); save(); return; }
  if (rig === 'dog') S.p.dogSpecies = fig;
  if (!(S.preset in presetsForFigure(fig))) S.preset = Object.keys(presetsForFigure(fig))[0];
  build(); render(); save();
}
function setMessage(m) { S.message = m; const el = document.getElementById('msg'); if (el) el.textContent = m; }

// ---------- motion channels ----------
const otherSide = (id) => (id.endsWith('.R') ? `${id.slice(0, -1)}L` : id.endsWith('.L') ? `${id.slice(0, -1)}R` : null);
const isDefaultSetting = (s) => !s || ((s.amount ?? 1) === 1 && !s.offset && !s.phase && (s.freq ?? 1) === 1 && !s.free && !(s.pts?.length));
/** Sets a channel's settings. With left and right linked, the other side follows, half a cycle later. */
function setMotion(id, s) {
  const apply = (cid, val) => { if (isDefaultSetting(val)) delete S.motion[cid]; else S.motion[cid] = val; };
  apply(id, s);
  const o = CHANNEL_BY_ID[id]?.sided && S.link ? otherSide(id) : null;
  if (o) apply(o, s ? { amount: s.amount ?? 1, offset: s.offset ?? 0, phase: s.phase ?? 0, freq: s.freq ?? 1, ...(s.free ? { free: true } : {}), ...(s.pts?.length ? { pts: mirrorPoints(s.pts) } : {}) } : null);
  markCustom(); render(); save();
}
const patchMotion = (id, patch) => setMotion(id, { ...(S.motion[id] || {}), ...patch });
const liveValue = (id) => { const v = nowValues(); return makeEvaluator(v.p, v.m).value(id, frameU()); };

function selectPart(sel, { openTab = true } = {}) {
  if (sel) S.attachSel = null;
  S.sel = sel;
  if (sel && openTab) { S.tab = 'Parts'; }
  if (S.edit) {
    const chans = sel ? partChannels(sel.part, sel.side) : [];
    if (chans.length) openEditor(chans[0].id); else closeEditor();
  }
  renderPanel(); render();
}

// ---------- timeline ----------
function buildStrip() {
  const host = document.getElementById('strip');
  if (!host) return;
  host.textContent = '';
  const { frames } = cycleFrames(P());
  const marks = new Map();
  const sampled = Boolean(P().sampled);
  const perf = !sampled && P().perf;
  if (perf) {
    // A performance has many cycles: label where each one starts instead of the pose names.
    const n = Math.max(2, Math.round(S.p.cycleFrames));
    host.dataset.perf = '1';
    requestAnimationFrame(() => host.querySelectorAll('.cell').forEach((cell) => { const f = Number(cell.dataset.cell); cell.querySelector('.k').textContent = f % n === 0 ? `c${f / n + 1}` : ''; }));
  } else delete host.dataset.perf;
  if (!sampled && !perf) import('./rig.js').then(({ keyPhases }) => {
    for (const k of keyPhases(S.p)) {
      for (const off of [0, 0.5]) {
        const u = (k.u + off) % 1;
        const f = frames.reduce((best, fr) => (Math.abs(fr.u - u) < Math.abs(best.u - u) ? fr : best), frames[0]);
        if (!marks.has(f.frame)) marks.set(f.frame, `${k.name[0]}${off ? 'f' : 'n'}`);
      }
    }
    host.querySelectorAll('.cell').forEach((cell) => { const m = marks.get(Number(cell.dataset.cell)); cell.querySelector('.k').textContent = m || ''; });
  });
  let lastDrawing = 0;
  frames.forEach((f) => {
    const first = f.drawing !== lastDrawing;
    lastDrawing = f.drawing;
    host.append(h('button', {
      type: 'button', class: `cell${first ? '' : ' held'}`, 'data-cell': f.frame, testid: `cell-${f.frame}`,
      'aria-label': `Frame ${f.frame + 1}, drawing ${f.drawing}${first ? '' : ', held'}`,
      onClick: () => { pause(); setFrame(f.frame); },
    }, h('span', { class: 'n' }, first ? String(sampled ? (SM.cuts[f.drawing - 1]?.label ?? f.drawing) : f.drawing) : '·'), h('span', { class: 'k' }, '')));
  });
}

// ---------- playback ----------
let raf = 0; let last = 0; let acc = 0;
function tick(t) {
  if (!S.playing) return;
  const dt = t - last; last = t;
  acc += dt * S.rate;
  if (S.s.autoOrbit) { S.s.camYaw = ((S.s.camYaw + (S.s.orbitSpeed * dt) / 1000 + 540) % 360) - 180; }
  const per = 1000 / S.p.fps;
  if (acc >= per) {
    const steps = Math.floor(acc / per); acc -= steps * per;
    const n = cycleFrames(P()).frames.length;
    for (let i = 0; i < steps; i++) {
      let nf = S.frame + 1;
      if (nf >= n) {
        if (S.recording) { pause(); paint(); return; } // a take ends at the end of the performance instead of looping
        nf = 0;
      }
      S.frame = nf;
      if (S.recording) rec.tick(nf);
    }
  }
  paint();
  raf = requestAnimationFrame(tick);
}
function play() {
  if (S.playing) return;
  if (S.armed) {
    // A take starts here. It needs room: a single cycle is too short to record into, so give it six.
    const n = Math.max(2, Math.round(S.p.cycleFrames));
    if (S.perfLen <= 0) { S.perfLen = n * 6; S.ver++; buildStrip(); save(); }
    if (S.frame >= cycleFrames(P()).frames.length - 1) S.frame = 0;
    rec.setMode(S.recMode); S.recording = true;
  }
  S.playing = true; last = performance.now(); acc = 0; setPlayButton(); raf = requestAnimationFrame(tick);
}
function pause() {
  if (!S.playing) return;
  S.playing = false; cancelAnimationFrame(raf);
  if (S.recording) endTake();
  setPlayButton();
}
/** Ends a take: what you moved becomes automation lanes. */
function endTake() {
  S.recording = false;
  const before = JSON.stringify(S.lanes);
  S.lanes = rec.commit(S.lanes, S.frame, rangeOfTarget);
  rec.setMode(S.armed ? S.recMode : 'off');
  if (JSON.stringify(S.lanes) !== before) { S.ver++; markCustom(); setMessage('Recorded. Your moves are now automation: see them in the Auto tab.'); }
  buildStrip(); renderPanel(); render(); save();
}
function setPlayButton() {
  const b = document.getElementById('play');
  if (b) { b.replaceChildren(icon(S.playing ? 'pause' : 'play'), h('span', { class: 'sr' }, S.playing ? 'Pause' : 'Play')); b.setAttribute('aria-pressed', String(S.playing)); b.setAttribute('aria-label', S.playing ? 'Pause' : 'Play'); }
  const r = document.getElementById('rec');
  if (r) { r.setAttribute('aria-pressed', String(S.armed)); r.classList.toggle('live', S.recording); r.replaceChildren(icon('rec'), h('span', { class: 'sr' }, S.recording ? 'Recording' : 'Rec')); }
}
function setArmed(on) {
  if (S.playing && S.recording !== on) pause();
  S.armed = on; rec.setMode(on ? S.recMode : 'off'); setPlayButton();
  if (S.tab === 'Auto') renderPanel();
}

// ---------- automation ----------
const recOn = () => S.recording && rec.armed;
/** How far a target can move, for thinning recorded points. */
function rangeOfTarget(target) {
  const k = parseTarget(target);
  if (k?.kind === 'cadence') return 2;
  if (k?.kind === 'param') { const c = CONTROLS.find((q) => q.scope === 'p' && q.id === k.id); return c ? c.max - c.min : 1; }
  if (k?.kind === 'channel') { const c = CHANNEL_BY_ID[k.id]; return k.what === 'amount' ? 3 : Math.abs(c.from(c.max) - c.from(c.min)); }
  return 1;
}
const targetLabel = (target) => {
  const k = parseTarget(target);
  if (k?.kind === 'cadence') return 'Speed of the cycle';
  if (k?.kind === 'param') return CONTROLS.find((q) => q.scope === 'p' && q.id === k.id)?.label ?? k.id;
  if (k?.kind === 'channel') return `${CHANNEL_BY_ID[k.id]?.label ?? k.id}, ${k.what === 'amount' ? 'amount' : k.what === 'fix' ? 'correction' : 'offset'}`;
  return target;
};
/** Controls that a lane drives follow it during playback and show a dot. Controls you are holding are left alone. */
function refreshAutomated() {
  document.querySelectorAll('[data-target]').forEach((el) => {
    const lane = S.lanes[el.dataset.target];
    const box = el.closest('.row, .mini');
    box?.classList.toggle('auto', Boolean(lane?.pts?.length));
    if (!lane?.pts?.length || el === document.activeElement || !el._show) return;
    const v = el._show(laneValue(lane, S.frame, el._base()));
    if (el.type === 'range' || el.type === 'number') el.value = +Number(v).toFixed(4);
  });
}
/** Wire a slider/number pair so that, while a take is running, it records instead of changing the base value. */
function recordable(rng, num, targets, readStored, writeStored, apply) {
  const stored = () => writeStored(Number(rng.value));
  rng.addEventListener('pointerdown', () => { if (recOn()) for (const t of targets()) rec.touch(t, S.frame, stored()); });
  rng.addEventListener('input', () => {
    const v = stored();
    if (recOn()) { for (const t of targets()) rec.set(t, S.frame, v); num.value = +Number(rng.value).toFixed(4); render(); return; }
    apply(v); num.value = +Number(rng.value).toFixed(4);
  });
  const up = () => { if (recOn()) for (const t of targets()) rec.release(t, S.frame); };
  rng.addEventListener('pointerup', up); rng.addEventListener('pointercancel', up); rng.addEventListener('blur', up);
  num.addEventListener('change', () => {
    const v = writeStored(Number(num.value));
    if (recOn()) { for (const t of targets()) { rec.touch(t, S.frame, v); rec.release(t, S.frame); } render(); return; }
    apply(v); renderPanel();
  });
}

// ---------- panel ----------
/** A row's label is a button: tapping it shows or hides the help text under the row. */
function labBtn(name, unit) {
  const b = h('button', { type: 'button', class: 'lab', 'aria-expanded': 'false', title: 'Tap for help. Drag sideways to change the value.', onClick: (e) => {
    // a drag that changed the value is not a tap
    if (b.dataset.scrubbed) { delete b.dataset.scrubbed; return; }
    const r = e.currentTarget.closest('.row'); const open = r.classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', String(open));
  } }, h('span', { class: 'name' }, name, unit ? h('small', null, ` ${unit}`) : null));
  scrubLabel(b);
  return b;
}
/**
 * Dragging a row's label sideways changes its value, like scrubbing a number in a graphics tool. The whole slider range is about 320 px of travel.
 * It drives the row's slider, so recording, undo and automation see it as an ordinary slider move.
 */
function scrubLabel(b) {
  let st = null;
  b.addEventListener('pointerdown', (e) => {
    const rng = b.closest('.row')?.querySelector('input[type="range"]');
    if (!rng) return;
    st = { x: e.clientX, v: Number(rng.value), rng, moved: false, id: e.pointerId };
  });
  b.addEventListener('pointermove', (e) => {
    if (!st || e.pointerId !== st.id) return;
    const dx = e.clientX - st.x;
    if (!st.moved) {
      if (Math.abs(dx) < 6) return;
      st.moved = true; b.setPointerCapture?.(e.pointerId); b.dataset.scrubbed = '1';
      st.rng.dispatchEvent(new Event('pointerdown'));
    }
    const min = Number(st.rng.min); const max = Number(st.rng.max); const step = Number(st.rng.step) || (max - min) / 100;
    let v = st.v + (dx / 320) * (max - min) * (e.shiftKey ? 0.1 : 1);
    v = Math.min(max, Math.max(min, Math.round(v / step) * step));
    if (String(v) !== st.rng.value) { st.rng.value = String(+v.toFixed(6)); st.rng.dispatchEvent(new Event('input', { bubbles: true })); }
    e.preventDefault();
  });
  const end = (e) => { if (!st || e.pointerId !== st.id) return; const s = st; st = null; if (s.moved) { s.rng.dispatchEvent(new Event('pointerup')); s.rng.dispatchEvent(new Event('change', { bubbles: true })); setTimeout(() => delete b.dataset.scrubbed, 0); } };
  b.addEventListener('pointerup', end); b.addEventListener('pointercancel', end);
}
function row(c) {
  const val = S[c.scope][c.id] ?? DEFAULT_OF(c);
  const reset = h('button', { type: 'button', class: 'btn tiny', 'aria-label': `Reset ${c.label}`, title: 'Reset', testid: `reset-${c.id}`, onClick: () => { if (c.scope === 'r') delete S.r[c.id]; else setParam(c, DEFAULT_OF(c)); renderPanel(); render(); save(); } }, icon('reset'), h('span', { class: 'sr' }, 'Reset'));
  const label = labBtn(wd(c.label), c.unit);
  let control;
  if (c.type === 'number') {
    const target = c.scope === 'p' && c.id in DEFAULTS && !['cycleFrames', 'exposure', 'fps'].includes(c.id) ? targetOfParam(c.id) : null;
    const num = h('input', { type: 'number', class: 'num', inputmode: 'decimal', min: c.min, max: c.max, step: c.step, value: val, 'aria-label': c.label, testid: `num-${c.id}`, 'data-target': target });
    const rng = h('input', { type: 'range', class: 'rng', min: c.min, max: c.max, step: c.step, value: val, 'aria-label': `${c.label} slider`, testid: `rng-${c.id}`, 'data-target': target });
    if (target) {
      for (const el of [rng, num]) { el._show = (v) => v; el._base = () => S.p[c.id]; }
      recordable(rng, num, () => [target], null, (v) => clampTo(c, v), (v) => setParam(c, v));
    } else {
      num.addEventListener('change', (e) => { setParam(c, e.target.value); renderPanel(); });
      rng.addEventListener('input', (e) => { setParam(c, e.target.value); num.value = S[c.scope][c.id]; });
    }
    control = h('div', { class: 'ctl' }, rng, num);
  } else if (c.type === 'enum') {
    control = h('div', { class: 'seg', role: 'group', 'aria-label': c.label }, wordsFor(figKey()).options(c).map((o) => h('button', { type: 'button', class: 'segbtn', 'aria-pressed': String(String(o) === String(val)), testid: `opt-${c.id}-${o}`, onClick: () => { setParam(c, o); renderPanel(); } }, String(o))));
  } else if (c.type === 'bool') {
    control = h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: val, testid: `chk-${c.id}`, onChange: (e) => { setParam(c, e.target.checked); e.target.nextSibling.textContent = e.target.checked ? 'On' : 'Off'; } }), h('span', null, val ? 'On' : 'Off'));
  } else {
    control = h('input', { type: 'color', class: 'color', value: val, 'aria-label': c.label, testid: `clr-${c.id}`, onInput: (e) => setParam(c, e.target.value) });
  }
  return h('div', { class: `row row-${c.type}` }, label, control, reset, h('p', { class: 'help' }, wd(c.help)));
}

const fmtUnit = (c, v) => `${c.to(v).toFixed(c.unit === '°' ? 1 : 3)}${c.unit === '°' ? '°' : ''}`;
function sparkline(id) {
  const cv = h('canvas', { class: 'spark', 'data-id': id, width: 300, height: 52, 'aria-hidden': 'true' });
  return cv;
}
function drawSpark(cv) {
  const id = cv.dataset.id; const c = CHANNEL_BY_ID[id];
  const w = cv.clientWidth || 300; const hh = 52; const d = Math.min(2, window.devicePixelRatio || 1);
  if (cv.width !== Math.round(w * d)) { cv.width = Math.round(w * d); cv.height = hh * d; }
  const ctx = cv.getContext('2d'); ctx.setTransform(d, 0, 0, d, 0, 0);
  const cs = getComputedStyle(document.documentElement);
  ctx.clearRect(0, 0, w, hh);
  const nv = nowValues();
  const vals = sampleFinal(id, nv.p, nv.m, 72).map((v) => c.to(v));
  const lo = Math.min(...vals, c.min * 0.3); const hi = Math.max(...vals, c.max * 0.3);
  const X = (i) => (i / 72) * (w - 8) + 4; const Y = (v) => hh - 6 - ((v - lo) / Math.max(1e-9, hi - lo)) * (hh - 12);
  ctx.strokeStyle = cs.getPropertyValue('--line').trim() || '#ccc'; ctx.beginPath(); ctx.moveTo(4, Y(0)); ctx.lineTo(w - 4, Y(0)); ctx.stroke();
  ctx.strokeStyle = cs.getPropertyValue('--accent').trim() || '#1f6f78'; ctx.lineWidth = 2;
  ctx.beginPath(); vals.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v)))); ctx.lineTo(X(72), Y(vals[0])); ctx.stroke();
  const u = frameU(); const cur = c.to(liveValue(id));
  ctx.strokeStyle = '#d0342c'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4 + u * (w - 8), 2); ctx.lineTo(4 + u * (w - 8), hh - 2); ctx.stroke();
  ctx.fillStyle = '#d0342c'; ctx.beginPath(); ctx.arc(4 + u * (w - 8), Y(cur), 4, 0, Math.PI * 2); ctx.fill();
}
function refreshSparks() {
  if (S.tab !== 'Parts') return;
  document.querySelectorAll('canvas.spark').forEach(drawSpark);
  document.querySelectorAll('[data-readout]').forEach((el) => { const c = CHANNEL_BY_ID[el.dataset.readout]; el.textContent = fmtUnit(c, liveValue(el.dataset.readout)); });
}

function channelCard(c) {
  const s = S.motion[c.id] || {};
  const edited = isEdited(S.motion, c.id);
  // show: value in display units; write: back to the stored value. Offset is shown in degrees or legs.
  const mk = (key, label, min, max, step, show, write) => {
    const val = show(s[key] ?? (key === 'amount' ? 1 : 0));
    const target = key === 'amount' || key === 'offset' ? targetOfChannel(c.id, key) : null;
    const num = h('input', { type: 'number', class: 'num', inputmode: 'decimal', min, max, step, value: +val.toFixed(4), 'aria-label': `${c.label} ${label}`, testid: `ch-${c.id}-${key}-num`, 'data-target': target });
    const rng = h('input', { type: 'range', class: 'rng', min, max, step, value: val, 'aria-label': `${c.label} ${label} slider`, testid: `ch-${c.id}-${key}`, 'data-target': target });
    if (target) {
      for (const el of [rng, num]) { el._show = show; el._base = () => S.motion[c.id]?.[key] ?? (key === 'amount' ? 1 : 0); }
      // With left and right linked, recording one side records the other too.
      const targets = () => { const o = c.sided && S.link ? otherSide(c.id) : null; return o ? [target, targetOfChannel(o, key)] : [target]; };
      recordable(rng, num, targets, null, write, (v) => patchMotion(c.id, { [key]: v }));
    } else {
      num.addEventListener('change', (e) => { patchMotion(c.id, { [key]: write(Number(e.target.value)) }); renderPanel(); });
      rng.addEventListener('input', (e) => { patchMotion(c.id, { [key]: write(Number(e.target.value)) }); num.value = e.target.value; });
    }
    return h('div', { class: 'mini' }, h('span', { class: 'mini-l' }, label), rng, num);
  };
  const id = (v) => v;
  const span = Math.max(Math.abs(c.min), Math.abs(c.max));
  return h('div', { class: `chan${edited ? ' edited' : ''}`, testid: `chan-${c.id}` },
    h('div', { class: 'chan-head' }, h('span', { class: 'name' }, wd(c.label)), h('span', { class: 'read', 'data-readout': c.id }, fmtUnit(c, liveValue(c.id))), edited ? h('span', { class: 'badge' }, 'changed') : null),
    sparkline(c.id),
    mk('amount', 'Amount ×', 0, 3, 0.05, id, id),
    h('div', { class: 'chan-more', id: `more-${c.id}`, hidden: !(s.offset || s.phase || s.free || (s.freq ?? 1) !== 1) },
      h('div', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Repeats ×'),
        h('div', { class: 'seg', role: 'group', 'aria-label': `${c.label} repeats per cycle` }, allowedFrequencies(c.id, S.motion).map((f) => h('button', {
          type: 'button', class: 'segbtn', testid: `ch-${c.id}-freq-${f}`, 'aria-pressed': String((s.freq ?? 1) === f), title: f === 0.5 ? 'Half as often' : `${f} times as often`,
          onClick: () => { patchMotion(c.id, { freq: f }); renderPanel(); },
        }, f === 0.5 ? '½' : String(f))))),
      mk('offset', `Offset ${c.unit}`, -span, span, c.step, (v) => c.to(v), (v) => c.from(v)),
      mk('phase', 'Timing shift', -0.5, 0.5, 0.005, id, id),
      h('label', { class: 'chk', title: 'Runs on its own clock, so it carries on when the walk slows or stops. Use it for tail, ears and breathing.' }, h('input', { type: 'checkbox', checked: Boolean(s.free), testid: `ch-${c.id}-free`, onChange: (e) => { patchMotion(c.id, { free: e.target.checked }); renderPanel(); render(); } }), h('span', null, 'Free running (keeps going when the walk stops)'))),
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn', testid: `draw-${c.id}`, onClick: () => openEditor(c.id) }, 'Draw curve'),
      h('button', { type: 'button', class: 'btn ghost', testid: `more-ch-${c.id}`, 'aria-expanded': String(Boolean(s.offset || s.phase || s.free || (s.freq ?? 1) !== 1)), onClick: (e) => { const m = document.getElementById(`more-${c.id}`); m.hidden = !m.hidden; e.currentTarget.setAttribute('aria-expanded', String(!m.hidden)); } }, 'Options'),
      h('button', { type: 'button', class: 'btn ghost icon', 'aria-label': `Reset ${c.label}`, title: 'Reset this channel', testid: `reset-ch-${c.id}`, onClick: () => { setMotion(c.id, null); renderPanel(); } }, icon('reset'), h('span', { class: 'sr' }, 'Reset'))));
}

function partsSection() {
  const host = h('div', { class: 'parts' });
  host.append(h('p', { class: 'hint' }, 'Tap a part on the figure, or pick one here.'));
  const mine = PARTS.filter((p) => (p.rig || 'human') === S.p.rig && !wordsFor(figKey()).hidesPart(p.id));
  const groups = [...new Set(mine.map((p) => p.group))];
  for (const g of groups) {
    const box = h('section', { class: 'group' }, h('h3', null, wd(g)));
    const chips = h('div', { class: 'chips', role: 'group', 'aria-label': wd(g) });
    const short = (l) => l.replace('Hips and pelvis', 'Hips').replace(' and elbow', '').replace(' and wrist', '').replace(' and knee', '');
    for (const part of mine.filter((p) => p.group === g)) {
      for (const sd of part.sided ? ['R', 'L'] : [null]) {
        chips.append(h('button', {
          type: 'button', class: 'pchip', testid: `part-${part.id}${sd ? `-${sd}` : ''}`, 'aria-pressed': String(S.sel?.part === part.id && (S.sel.side ?? null) === sd),
          'aria-label': wd(partLabel(part.id, sd)), onClick: () => selectPart({ part: part.id, side: sd }, { openTab: false }),
        }, sd ? `${short(wd(part.label))} ${sd}` : short(wd(part.label))));
      }
    }
    box.append(chips);
    host.append(box);
  }
  if (S.sel) {
    const chans = partChannels(S.sel.part, S.sel.side);
    const sided = PARTS.find((p) => p.id === S.sel.part)?.sided;
    const head = h('div', { class: 'selhead' }, h('h2', null, wd(partLabel(S.sel.part, S.sel.side))),
      h('button', { type: 'button', class: 'btn tiny', testid: 'clear-sel', onClick: () => { closeEditor(); selectPart(null); } }, 'Clear'));
    const link = sided ? h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.link, testid: 'chk-link', onChange: (e) => { S.link = e.target.checked; } }), h('span', null, 'Left and right move together (left runs half a cycle later)')) : null;
    const nfix = fixPoints(S.lanes, S.sel.part, S.sel.side ?? null);
    host.append(h('section', { class: 'group', testid: 'fix-section' }, h('h3', null, 'Fix alignment'),
      h('p', { class: 'hint' }, 'If this part drifts out of line at some frame, turn this on, go to that frame, and drag the orange ring at the end of the part, or the square at its base, back where it belongs. The base moves the part before it, since that is where this one starts. It adds a smooth correction on top of the animation; the animation underneath is not changed.'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.fixMode, testid: 'fix-on', onChange: (e) => { S.fixMode = e.target.checked; render(); } }), h('span', null, 'Show the fix handle on the stage')),
      h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Spread'), h('small', null, ' frames')),
        h('div', { class: 'ctl' }, h('input', { type: 'range', class: 'rng', min: 0, max: 60, step: 1, value: S.fixSpread, 'aria-label': 'Spread slider', testid: 'fix-spread', onInput: (e) => { S.fixSpread = Number(e.target.value); const n = e.target.parentElement.querySelector('.num'); if (n) n.value = e.target.value; } }),
          h('input', { type: 'number', class: 'num', min: 0, max: 60, step: 1, value: S.fixSpread, 'aria-label': 'Spread', testid: 'fix-spread-num', onChange: (e) => { S.fixSpread = Math.min(60, Math.max(0, Math.round(Number(e.target.value) || 0))); renderPanel(); } })),
        h('p', { class: 'help' }, 'How many frames either side the correction eases back out over. 0 changes one frame only; a large number moves the whole stretch.')),
      h('div', { class: 'btnrow' }, h('span', { class: 'hint', testid: 'fix-count' }, nfix ? `${nfix} correction point${nfix === 1 ? '' : 's'} on this part` : 'No corrections on this part'),
        h('button', { type: 'button', class: 'btn', testid: 'fix-clear', disabled: !nfix, onClick: () => { S.lanes = clearFix(S.lanes, S.sel.part, S.sel.side ?? null); S.ver++; renderPanel(); render(); save(); setMessage('Corrections removed. The animation is as it was.'); } }, 'Clear corrections'))));
    host.append(h('section', { class: 'group selected' }, head, link, S.sel.part === 'pelvis' ? h('p', { class: 'hint' }, 'The legs are planted by IK, so hip height and turn are set here. Foot placement is under Foot. Pose labels follow the built-in timing.') : null, chans.map(channelCard)));
  }
  return host;
}

// ---------- Auto tab: performance length, recording, movements, lanes ----------
/** Several automation sets for one figure, kept by name: a walk to stop, a trip, a pick up. */
function perfNamesSection() {
  const rig = figKey(); const saved = S.perfs[rig] || (S.perfs[rig] = {});
  const names = Object.keys(saved);
  const nameIn = h('input', { type: 'text', class: 'num wide', placeholder: 'Name, for example Trip at frame 40', maxlength: 40, value: S.perfName, testid: 'perf-name', 'aria-label': 'Performance name', onInput: (e) => { S.perfName = e.target.value; } });
  const sec = h('section', { class: 'group', testid: 'perfs' }, h('h3', null, 'Saved performances'),
    h('p', { class: 'hint' }, `Keep the automation you have built under a name, and switch between versions. These are for the ${rig === 'dog' ? 'dog' : 'human'}; the other figure has its own.`),
    h('div', { class: 'btnrow' }, nameIn,
      h('button', { type: 'button', class: 'btn primary', testid: 'perf-save', onClick: () => {
        const nm = S.perfName.trim().slice(0, 40);
        if (!nm) { setMessage('Give it a name first.'); return; }
        if (saved[nm] && !confirm(`Replace the saved performance "${nm}"?`)) return;
        saved[nm] = { lanes: clone(S.lanes), perfLen: S.perfLen }; save(); renderPanel(); setMessage(`Saved "${nm}".`);
      } }, 'Save current')));
  if (!names.length) sec.append(h('p', { class: 'hint' }, 'Nothing saved yet.'));
  for (const nm of names) {
    sec.append(h('div', { class: 'laneitem', testid: `perf-item-${nm}` },
      h('span', { class: 'lname' }, nm, h('small', null, ` ${Object.keys(saved[nm].lanes).length} lanes, ${saved[nm].perfLen || 'one cycle'}${saved[nm].perfLen ? ' frames' : ''}`)),
      h('button', { type: 'button', class: 'btn tiny', testid: `perf-load-${nm}`, onClick: () => {
        closeEditor(true); S.lanes = cleanLanes(clone(saved[nm].lanes)); S.perfLen = saved[nm].perfLen; S.perfName = nm; S.frame = 0; S.ver++; markCustom(); buildStrip(); renderPanel(); render(); save(); setMessage(`Loaded "${nm}".`);
      } }, 'Load'),
      h('button', { type: 'button', class: 'btn tiny', 'aria-label': `Delete ${nm}`, testid: `perf-del-${nm}`, onClick: () => { delete saved[nm]; save(); renderPanel(); setMessage(`Deleted "${nm}".`); } }, 'Delete')));
  }
  return sec;
}

function autoSection() {
  const host = h('div', { class: 'auto' });
  const n = Math.max(2, Math.round(S.p.cycleFrames));
  const T = cycleFrames(P()).frames.length;
  const seg = (items, cur, on, testPrefix) => h('div', { class: 'seg', role: 'group' }, items.map(([v, label]) => h('button', { type: 'button', class: 'segbtn', 'aria-pressed': String(cur === v), testid: `${testPrefix}-${v}`, onClick: () => on(v) }, label)));
  const numField = (label, value, min, max, on, tid) => h('label', { class: 'field' }, h('span', null, label), h('input', { type: 'number', class: 'num', inputmode: 'numeric', min, max, value, testid: tid, onChange: (e) => on(Number(e.target.value)) }));

  host.append(perfNamesSection());
  host.append(h('section', { class: 'group' }, h('h3', null, 'Length'),
    h('p', { class: 'hint' }, `The performance is ${T} frames (${(T / S.p.fps).toFixed(1)} s). One walk cycle is ${n} frames. Make it longer to give movements room.`),
    h('div', { class: 'btnrow' },
      numField('Frames', S.perfLen > 0 ? S.perfLen : n, n, 2400, (v) => { S.perfLen = Math.min(2400, Math.max(n, Math.round(v) || n)); if (S.perfLen === n && !hasLanes(S.lanes)) S.perfLen = 0; S.ver++; buildStrip(); renderPanel(); render(); save(); }, 'perf-len'),
      menuButton({ label: 'Set length', testid: 'perf-menu', items: () => [
        ...[2, 4, 6, 8].map((k) => ({ label: `${k} cycles`, testid: `perf-x${k}`, onClick: () => { S.perfLen = n * k; S.ver++; buildStrip(); renderPanel(); render(); save(); } })),
        { separator: true },
        { label: 'One cycle', testid: 'perf-one', onClick: () => { S.perfLen = 0; S.frame = Math.min(S.frame, n - 1); S.ver++; buildStrip(); renderPanel(); render(); save(); } },
      ] }))));

  host.append(h('section', { class: 'group' }, h('h3', null, 'Record by hand'),
    h('p', { class: 'hint' }, 'Press Rec, then Play, and move any gait slider or a part\'s Amount or Offset while it plays. Your moves are written as automation, like recording a synth knob. Touch: it records while you hold and glides back when you let go. Latch: it records from your first touch and holds the last value until you stop.'),
    h('div', { class: 'btnrow' }, seg([['touch', 'Touch'], ['latch', 'Latch']], S.recMode, (m) => { S.recMode = m; rec.setMode(S.armed ? m : 'off'); renderPanel(); }, 'rec-mode'),
      h('button', { type: 'button', class: 'btn primary', testid: 'rec-arm', 'aria-pressed': String(S.armed), onClick: () => { setArmed(!S.armed); } }, S.armed ? 'Armed: press Play' : 'Arm recording'))));

  const clips = clipsFor(S.p.rig);
  const clip = clips.find((c) => c.id === S.clip) || clips[0];
  const D = S.clipLen ?? clip.frames;
  host.append(h('section', { class: 'group' }, h('h3', null, 'Movements'),
    h('p', { class: 'hint' }, 'A movement is written as ordinary automation, so you can edit or redraw it afterwards. Pick one, say where it starts, and add it.'),
    h('p', { class: 'hint' }, 'Each movement starts from whatever the figure is doing, so they chain: Walk to stop, Sit, Stand up, Start walking.'),
    [...CLIP_GROUPS.map(([g]) => g), 'Other'].map((g) => { const list = clips.filter((c) => groupOfClip(c.id) === g); return list.length ? h('div', { class: 'cliprow' }, h('h4', null, g), h('div', { class: 'chips', role: 'group', 'aria-label': g }, list.map((c) => h('button', { type: 'button', class: 'pchip', testid: `clip-${c.id}`, 'aria-pressed': String(c.id === clip.id), onClick: () => { S.clip = c.id; S.clipLen = null; renderPanel(); } }, wd(c.label))))) : null; }),
    h('p', { class: 'hint' }, wd(clip.help)),
    h('div', { class: 'btnrow' },
      numField('Starts at frame', S.clipStart + 1, 1, 2400, (v) => { S.clipStart = Math.max(0, Math.round(v) - 1); }, 'clip-start'),
      h('button', { type: 'button', class: 'btn', testid: 'clip-playhead', onClick: () => { S.clipStart = S.frame; renderPanel(); } }, 'Use playhead'),
      numField('Lasts (frames)', D, 6, 600, (v) => { S.clipLen = Math.max(6, Math.round(v)); }, 'clip-len')),
    h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Strength'), h('input', { type: 'range', class: 'rng', min: 0.3, max: 1.5, step: 0.05, value: S.clipK, testid: 'clip-k', 'aria-label': 'Movement strength', onInput: (e) => { S.clipK = Number(e.target.value); } })),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', testid: 'clip-add', onClick: () => addClip(clip, S.clipStart, S.clipLen ?? clip.frames, S.clipK) }, `Add ${clip.label.toLowerCase()}`))));

  const targets = Object.keys(S.lanes).filter((t) => S.lanes[t].pts?.length);
  const list = h('section', { class: 'group' }, h('h3', null, `Automation lanes (${targets.length})`));
  if (!targets.length) list.append(h('p', { class: 'hint' }, 'Nothing is automated yet.'));
  for (const t of targets) {
    list.append(h('div', { class: 'laneitem', testid: `lane-${t}` },
      h('span', { class: 'lname' }, targetLabel(t), h('small', null, ` ${S.lanes[t].pts.length} points`)),
      h('button', { type: 'button', class: 'btn tiny', testid: `lane-edit-${t}`, onClick: () => openLaneEditor(t) }, 'Edit'),
      h('button', { type: 'button', class: 'btn tiny', 'aria-label': `Clear ${targetLabel(t)}`, testid: `lane-clear-${t}`, onClick: () => { delete S.lanes[t]; S.ver++; if (laneEd?.target === t) closeEditor(); markCustom(); buildStrip(); renderPanel(); render(); save(); } }, 'Clear')));
  }
  if (targets.length) list.append(h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'lanes-clear-all', onClick: () => { S.lanes = {}; S.ver++; closeEditor(true); renderPanel(); buildStrip(); render(); save(); } }, 'Clear all automation')));
  host.append(list);
  return host;
}

function addClip(clip, start, D, k) {
  S.lanes = applyClip(S.lanes, clip, S.p, start, D, k); S.ver++;
  const n = Math.max(2, Math.round(S.p.cycleFrames));
  const need = start + D + n * 2;
  if (S.perfLen < need) S.perfLen = Math.min(2400, need);
  for (const id of clip.free || []) if (CHANNEL_BY_ID[id] && !S.motion[id]?.free) setMotion(id, { ...(S.motion[id] || {}), free: true });
  markCustom(); S.frame = Math.min(start, S.perfLen - 1);
  setMessage(`Added ${clip.label.toLowerCase()} at frame ${start + 1}.`);
  buildStrip(); renderPanel(); render(); save();
}

// ---------- lane tools ----------
let laneClip = null;
/** Freezes how a channel looks at the playhead into a drawn curve for one cycle, and removes its lanes. */
function bakeLaneToCurve(target) {
  const k = parseTarget(target);
  if (k?.kind !== 'channel') return false;
  const q = P(); const t = Math.min(S.frame, (q.perf?.T ?? 1) - 1);
  const v = q.perf ? { p: paramsAt(q, q.perf.lanes, t), m: motionAt(S.motion, q.perf.lanes, t) } : { p: q, m: S.motion };
  const ev = makeEvaluator(v.p, v.m); const n = Math.max(4, Math.round(S.p.cycleFrames));
  const pts = Array.from({ length: n }, (_, i) => ({ u: i / n, v: ev.value(k.id, i / n) }));
  S.motion[k.id] = { amount: 1, offset: 0, phase: 0, freq: 1, ...(S.motion[k.id]?.free ? { free: true } : {}), pts };
  delete S.lanes[targetOfChannel(k.id, 'amount')]; delete S.lanes[targetOfChannel(k.id, 'offset')];
  S.ver++; markCustom(); return true;
}

// ---------- automation lane pop-out ----------
function openLaneEditor(target) {
  closeEditor(true);
  const dock = document.getElementById('popout');
  dock.hidden = false; dock.textContent = '';
  S.laneEdit = target;
  const k = parseTarget(target);
  let view;
  if (k.kind === 'param') { const c = CONTROLS.find((q) => q.scope === 'p' && q.id === k.id); view = { lo: c.min, hi: c.max, to: (v) => v, from: (v) => v, unit: c.unit || '', base: () => S.p[k.id] }; }
  else if (k.kind === 'cadence') view = { lo: 0, hi: 2, to: (v) => v, from: (v) => v, unit: '×', base: () => 1 };
  else {
    const c = CHANNEL_BY_ID[k.id];
    if (k.what === 'fix') { const span = Math.max(Math.abs(c.min), Math.abs(c.max)); view = { lo: -span, hi: span, to: (v) => c.to(v), from: (v) => c.from(v), unit: c.unit, base: () => 0 }; }
    else if (k.what === 'amount') view = { lo: 0, hi: 3, to: (v) => v, from: (v) => v, unit: '×', base: () => S.motion[k.id]?.amount ?? 1 };
    else { const span = Math.max(Math.abs(c.min), Math.abs(c.max)); view = { lo: -span, hi: span, to: (v) => c.to(v), from: (v) => c.from(v), unit: c.unit, base: () => S.motion[k.id]?.offset ?? 0 }; }
  }
  const mode = (m, label) => h('button', { type: 'button', class: 'segbtn', 'aria-pressed': String(m === 'handles'), testid: `lane-mode-${m}`, onClick: (e) => { laneEd.setMode(m); dock.querySelectorAll('.segmode .segbtn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, label);
  const host = h('div', { class: 'curve-host', testid: 'lane-host' });
  dock.append(
    h('div', { class: 'pop-head' }, h('h2', null, targetLabel(target)), h('button', { type: 'button', class: 'btn', testid: 'lane-close', onClick: () => closeEditor() }, 'Close')),
    h('div', { class: 'pop-row' }, h('div', { class: 'seg segmode' }, mode('handles', 'Handles'), mode('draw', 'Draw')),
      h('button', { type: 'button', class: 'btn', testid: 'lane-interp', onClick: (e) => { const l = S.lanes[target]; if (!l) return; l.interp = l.interp === 'linear' ? 'smooth' : 'linear'; S.ver++; e.currentTarget.textContent = l.interp === 'linear' ? 'Straight lines' : 'Eased'; laneEd.draw(); render(); save(); } }, S.lanes[target]?.interp === 'linear' ? 'Straight lines' : 'Eased'),
      h('button', { type: 'button', class: 'btn', testid: 'lane-clear', onClick: () => { delete S.lanes[target]; S.ver++; closeEditor(); markCustom(); render(); save(); } }, 'Clear lane')),
    h('p', { class: 'hint' }, 'Time runs left to right across the whole performance. The dashed line is the value with no automation. Tap to add a point, drag to move it, double-tap to remove it. Draw sketches the movement. Drag the strip at the top to scrub.'),
    laneTools(target, () => view.base()),
    host);
  document.body.classList.add('editing');
  laneEd = new LaneEditor(host, target, {
    getLane: () => S.lanes[target],
    setLane: (l) => { if (l.pts.length) S.lanes[target] = { interp: 'smooth', ...l }; else delete S.lanes[target]; S.ver++; markCustom(); render(); save(); },
    length: () => cycleFrames(P()).frames.length, cycle: () => Math.max(2, Math.round(S.p.cycleFrames)), frame: () => S.frame,
    scrub: (f) => { pause(); setFrame(f); },
    view: () => { const b = view.base(); const l = S.lanes[target]; const vals = (l?.pts || []).map((q) => view.to(q.v)); const lo = Math.min(view.lo, ...vals, view.to(b)); const hi = Math.max(view.hi, ...vals, view.to(b)); return { lo, hi, to: view.to, from: view.from, unit: view.unit, base: b }; },
  });
}

function laneTools(target, getBase) {
  const T = () => cycleFrames(P()).frames.length;
  const num = (label, value, min, tid) => h('label', { class: 'field' }, h('span', null, label), h('input', { type: 'number', class: 'num', inputmode: 'numeric', min, value, testid: tid }));
  const from = num('From', 1, 1, 'lane-from'); const to = num('To', T(), 1, 'lane-to'); const by = num('Shift', 6, 1, 'lane-by');
  const val = (el) => Math.max(1, Math.round(Number(el.querySelector('input').value) || 1));
  const done = (msg) => { S.ver++; markCustom(); buildStrip(); renderPanel(); render(); laneEd?.draw(); save(); setMessage(msg); };
  const btn = (label, tid, fn, attrs = {}) => h('button', { type: 'button', class: 'btn', testid: tid, onClick: fn, ...attrs }, label);
  const mt = mirrorTarget(target); const isChan = parseTarget(target)?.kind === 'channel';
  const mi = (label, testid, fn, disabled = false) => ({ label, testid, onClick: fn, disabled });
  const copy = () => { laneClip = copySpan(S.lanes[target], val(from) - 1, val(to) - 1, getBase()); setMessage(laneClip ? `Copied frames ${val(from)} to ${val(to)}.` : 'Nothing to copy: pick a span that has automation.'); };
  const paste = () => { if (!laneClip) { setMessage('Copy a span first.'); return; } S.lanes[target] = pasteSpan(S.lanes[target], laneClip, S.frame, T()); done(`Pasted at frame ${S.frame + 1}.`); };
  const loop = () => { if (!S.lanes[target]) return; S.lanes[target] = loopSpan(S.lanes[target], val(from) - 1, val(to) - 1, T() - 1, T(), getBase()); done('Repeated the span to the end.'); };
  const shift = (dir) => () => { if (!S.lanes[target]) return; S.lanes[target] = shiftLane(S.lanes[target], dir * val(by), T()); done(`Moved ${val(by)} frames ${dir < 0 ? 'earlier' : 'later'}.`); };
  return h('div', { class: 'lane-tools', testid: 'lane-tools' },
    h('div', { class: 'btnrow' }, from, to, by),
    h('div', { class: 'btnrow' },
      menuButton({ label: 'Span', testid: 'lane-span-menu', title: 'Copy, paste or repeat the span between From and To', items: [mi('Copy span', 'lane-copy', copy), mi('Paste at playhead', 'lane-paste', paste), mi('Repeat span to the end', 'lane-loop', loop)] }),
      menuButton({ label: 'Move', testid: 'lane-move-menu', title: 'Move the whole lane in time', items: [mi('Earlier by the Shift amount', 'lane-earlier', shift(-1)), mi('Later by the Shift amount', 'lane-later', shift(1))] }),
      menuButton({ label: 'More', testid: 'lane-more-menu', items: [
        ...(mt ? [mi('Copy to the other side', 'lane-mirror', () => { if (!S.lanes[target]) return; S.lanes[mt] = clone(S.lanes[target]); done('Copied to the other side.'); })] : []),
        ...(isChan ? [mi('Bake playhead into a curve', 'lane-bake', () => { if (bakeLaneToCurve(target)) { closeEditor(); buildStrip(); renderPanel(); render(); save(); setMessage('Baked into a drawn curve and removed the lanes.'); } })] : []),
        ...(!mt && !isChan ? [{ label: 'No other tools for this lane', disabled: true }] : []),
      ] })));
}

/** Every group with a heading becomes a section you can fold away; which ones are folded is remembered. */
function collapsible(host) {
  host.querySelectorAll('section.group').forEach((sec) => {
    const hd = sec.firstElementChild;
    if (!hd || hd.tagName !== 'H3') return;
    const title = hd.textContent; const key = `${S.tab}:${title}`;
    const folded = LAYOUT.collapsed?.[key] === true;
    const body = h('div', { class: 'group-body' });
    while (hd.nextSibling) body.append(hd.nextSibling);
    sec.append(body); body.hidden = folded;
    const btn = h('button', { type: 'button', class: 'sec-toggle', 'aria-expanded': String(!folded), onClick: () => {
      const now = !body.hidden; body.hidden = now; btn.setAttribute('aria-expanded', String(!now)); (LAYOUT.collapsed ||= {})[key] = now; layoutSave();
    } }, icon('chevronDown', 12), title);
    hd.textContent = ''; hd.append(btn);
  });
}

function renderPanel() {
  const host = document.getElementById('panel-body');
  const top = host.scrollTop;
  host.textContent = '';
  if (S.tab === 'Auto') host.append(autoSection());
  else if (S.tab === 'Parts') host.append(partsSection());
  else if (S.tab === 'Attach') host.append(attachSection());
  else if (S.tab === 'Sampler') host.append(samplerSection());
  else {
    const items = CONTROLS.filter((c) => c.tab === S.tab && shownFor(c, S.p.rig) && !wordsFor(figKey()).hides(c));
    for (const g of [...new Set(items.map((c) => c.group))]) host.append(h('section', { class: 'group' }, h('h3', null, wd(g)), items.filter((c) => c.group === g).map(row)));
    if (S.tab === 'View') host.append(viewExtras());
    if (S.tab === 'Guides') host.append(arcSection(), refSection());
    if (S.tab === 'Export') host.append(exportSection());
  }
  collapsible(host);
  host.scrollTop = top;
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === S.tab)));
  document.querySelector('.tab[aria-selected="true"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  setTimeout(refreshSparks, 0);
}

function viewExtras() {
  const set = (yaw, pitch) => { S.s.camYaw = yaw; S.s.camPitch = pitch; renderPanel(); render(); save(); };
  return h('section', { class: 'group' }, h('h3', null, 'Views'),
    h('div', { class: 'chips' }, [['Side', 0, 0], ['¾ front', -40, 12], ['Front', -90, 0], ['¾ back', 40, 12], ['Back', 90, 0], ['Top', 0, 80], ['Reset', 0, 0]].map(([n, y, p]) => h('button', { type: 'button', class: 'pchip', testid: `view-${n}`, onClick: () => set(y, p) }, n))));
}

// ---------- curve pop-out ----------
function openEditor(id) {
  const c = CHANNEL_BY_ID[id];
  closeEditor(true);
  S.edit = { id };
  const dock = document.getElementById('popout');
  dock.hidden = false; dock.textContent = '';
  const chans = S.sel ? partChannels(S.sel.part, S.sel.side) : [c];
  const sel = h('select', { class: 'select', 'aria-label': 'Channel', testid: 'edit-channel', onChange: (e) => { S.edit.id = e.target.value; editor.setChannel(e.target.value); title.textContent = CHANNEL_BY_ID[e.target.value].label; } },
    chans.map((q) => h('option', { value: q.id, selected: q.id === id }, q.label)));
  const title = h('h2', null, c.label);
  const mode = (m, label) => h('button', { type: 'button', class: 'segbtn', 'aria-pressed': String(m === 'handles'), testid: `edit-${m}`, onClick: (e) => { editor.setMode(m); dock.querySelectorAll('.segmode .segbtn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, label);
  const host = h('div', { class: 'curve-host', testid: 'curve-host' });
  dock.append(
    h('div', { class: 'pop-head' }, title, h('button', { type: 'button', class: 'btn', testid: 'edit-close', onClick: () => closeEditor() }, 'Close')),
    h('div', { class: 'pop-row' }, sel),
    h('div', { class: 'pop-row' }, h('div', { class: 'seg segmode' }, mode('handles', 'Handles'), mode('draw', 'Draw')),
      h('button', { type: 'button', class: 'btn', testid: 'edit-smooth', onClick: () => editor.smooth() }, 'Smooth'),
      h('button', { type: 'button', class: 'btn', testid: 'edit-reset', onClick: () => { setMotion(S.edit.id, null); editor.draw(); renderPanel(); } }, 'Back to built-in')),
    h('p', { class: 'hint' }, 'Handles: tap to start, drag a handle, tap empty space to add, double-tap a handle to remove. Draw: sketch the motion with your finger or Pencil. The dashed line is the built-in motion; the red line is the playhead. Drag along the strip at the top to scrub.'),
    host);
  document.body.classList.add('editing');
  editor = new CurveEditor(host, id, {
    getParams: P, getMotion: () => S.motion, getFrameU: frameU, frames: () => cycleFrames(P()).frames.length,
    set: (cid, val) => { setMotion(cid, val); }, scrub: (f) => { pause(); setFrame(f); },
  });
}
function closeEditor(keepDock = false) {
  editor?.destroy(); editor = null; S.edit = null;
  laneEd?.destroy(); laneEd = null; S.laneEdit = null;
  document.body.classList.remove('editing');
  const dock = document.getElementById('popout');
  if (dock && !keepDock) { dock.hidden = true; dock.textContent = ''; }
  if (!keepDock) renderPanel();
}

// ---------- export ----------
let abort = null;
function refreshSummary() {
  const el = document.getElementById('summary');
  if (!el) return;
  const s = summary(P(), S.x);
  el.textContent = `${s.frames} frames · ${s.seconds.toFixed(2)} s at ${S.p.fps} fps · ${s.width}×${s.height} · ${S.x.format === 'mp4' ? 'one video' : `${s.files} PNG file${s.files === 1 ? '' : 's'}`}${s.alpha && S.x.format === 'png-zip' ? ' · transparent' : ''}${S.x.orbit ? ` · camera turns ${S.x.orbit}°` : ''}`;
}
function exportSection() {
  const sum = h('p', { class: 'summary', id: 'summary', testid: 'summary' });
  const video = h('p', { class: 'hint', id: 'videoNote' }, S.video ? (S.video.supported ? `H.264 encoder found (${S.video.codec}). Video is opaque.` : `MP4 is not available here: ${S.video.reason} Use PNG frames.`) : 'Checking video support…');
  const prog = h('progress', { id: 'prog', max: 1, value: 0, hidden: true, 'aria-label': 'Export progress' });
  const msg = h('p', { class: 'hint', id: 'msg', role: 'status', testid: 'msg' }, S.message);
  const share = h('label', { class: 'chk' }, h('input', { type: 'checkbox', id: 'share', testid: 'chk-share' }), h('span', null, 'Use the share sheet when available'));
  const go = h('button', { type: 'button', class: 'btn primary', id: 'go', testid: 'export-go', onClick: runExport }, 'Export');
  const cancel = h('button', { type: 'button', class: 'btn', id: 'cancel', hidden: true, testid: 'export-cancel', onClick: () => abort?.abort() }, 'Cancel');
  const more = menuButton({ label: 'More exports', testid: 'export-more', items: () => [
    { label: 'Contact sheet', testid: 'export-sheet', onClick: runSheet },
    { label: 'Key poses only', testid: 'export-keys', onClick: runKeyPoses },
    { separator: true },
    { heading: 'Lane data' },
    { label: 'Lane data as CSV', testid: 'export-lanes-csv', onClick: () => runLaneData('csv') },
    { label: 'Lane data as JSON', testid: 'export-lanes-json', onClick: () => runLaneData('json') },
  ] });
  const settingsMenu = menuButton({ label: 'Settings file', testid: 'settings-menu', items: () => [
    { label: 'Save settings', testid: 'settings-save', onClick: saveSettings },
    { label: 'Load settings…', testid: 'settings-load-item', onClick: () => document.querySelector('[data-testid="settings-load"]')?.click() },
  ] });
  setTimeout(refreshSummary, 0);
  if (!S.video) videoSupport(P(), S.x).then((v) => { S.video = v; const n = document.getElementById('videoNote'); if (n) n.textContent = v.supported ? `H.264 encoder found (${v.codec}). Video is opaque.` : `MP4 is not available here: ${v.reason} Use PNG frames.`; });
  return h('section', { class: 'group' }, h('h3', null, 'Export'), sum, video, h('div', { class: 'row' }, share), h('div', { class: 'btnrow' }, go, cancel, more), prog, msg, h('div', { class: 'btnrow' }, settingsMenu));
}
async function runExport() {
  if (S.busy) return;
  pause();
  const go = document.getElementById('go'); const cancel = document.getElementById('cancel'); const prog = document.getElementById('prog');
  abort = new AbortController();
  S.busy = 'export'; go.disabled = true; cancel.hidden = false; prog.hidden = false; prog.value = 0;
  setMessage('Working…');
  const onProgress = ({ done, total }) => { prog.value = done / total; setMessage(`Frame ${done} of ${total}`); };
  try {
    let r;
    if (S.x.format === 'mp4') {
      const v = await videoSupport(P(), S.x);
      if (!v.supported) throw new Error(`MP4 is not available: ${v.reason} Switch Format to PNG frames.`);
      r = await exportMp4(P(), S.s, S.x, { onProgress, signal: abort.signal });
    } else {
      r = await exportPngZip(P(), S.s, REF.export && REF.img && REF.on ? { ...S.x, under: refPaint } : S.x, { onProgress, signal: abort.signal });
    }
    const how = await deliver(r.blob, r.name, { share: document.getElementById('share')?.checked });
    setMessage(`${how === 'shared' ? 'Shared' : how === 'cancelled' ? 'Share cancelled' : 'Saved'} ${r.name} (${(r.blob.size / 1048576).toFixed(1)} MB).`);
  } catch (e) {
    setMessage(e.name === 'AbortError' ? 'Export cancelled. Your settings are unchanged.' : `Export failed: ${e.message}`);
  } finally {
    S.busy = null; abort = null; go.disabled = false; cancel.hidden = true; prog.hidden = true;
  }
}
async function runKeyPoses() {
  if (S.busy) return;
  pause(); S.busy = 'keys'; setMessage('Finding the key poses…');
  try {
    const r = await exportKeyFrames(P(), S.s, S.x, { onProgress: ({ done, total }) => setMessage(`Key pose ${done} of ${total}`) });
    await deliver(r.blob, r.name, { share: document.getElementById('share')?.checked });
    setMessage(`Saved ${r.count} key poses out of ${cycleFrames(P()).frames.length} frames. key_poses.json says why each was chosen.`);
  } catch (e) { setMessage(`Key poses failed: ${e.message}`); } finally { S.busy = null; }
}
async function runLaneData(kind) {
  try {
    const tb = laneTable(P());
    const blob = kind === 'csv'
      ? new Blob([tableCsv(tb)], { type: 'text/csv' })
      : new Blob([JSON.stringify({ format: 'walk-base-lanes', fps: S.p.fps, frames: tb.rows.length, figure: S.p.rig, lanes: P().perf?.lanes ?? {}, columns: tb.columns, rows: tb.rows }, null, 1)], { type: 'application/json' });
    await deliver(blob, kind === 'csv' ? 'walk-lanes.csv' : 'walk-lanes.json');
    setMessage(`Saved the lane data: ${tb.rows.length} frames, ${tb.targets.length} lanes.`);
  } catch (e) { setMessage(`Lane data failed: ${e.message}`); }
}
async function runSheet() {
  try { const r = await contactSheet(P(), S.s); await deliver(r.blob, r.name); setMessage('Saved the contact sheet.'); } catch (e) { setMessage(`Contact sheet failed: ${e.message}`); }
}
function saveSettings() {
  const blob = new Blob([JSON.stringify({ format: 'walk-base-settings', version: 2, preset: S.preset, p: S.p, s: S.s, x: S.x, r: S.r, motion: S.motion, lanes: S.lanes, perfLen: S.perfLen, attach: S.attach, images: usedImages() }, null, 1)], { type: 'application/json' });
  deliver(blob, 'walk-settings.json').then(() => setMessage('Saved walk-settings.json.'));
}
async function loadSettings(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const raw = JSON.parse(await f.text());
    if (raw.format !== 'walk-base-settings') throw new Error('This is not a Walk Base settings file.');
    adopt(raw); if (raw.images && typeof raw.images === 'object') for (const [id, url] of Object.entries(raw.images)) if (typeof url === 'string' && url.startsWith('data:image/')) await registerImage(id, url);
    saveAttachImages(); if (!attachItem()) S.attachSel = null; buildStrip(); renderPanel(); render(); save(); setMessage('Settings loaded.');
  } catch (err) { setMessage(`Could not load it: ${err.message}`); }
  e.target.value = '';
}

// ---------- layout ----------
function refreshViewbar() {
  document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === S.tool)));
  const t = document.querySelector('[data-testid="turntable"]');
  if (t) t.setAttribute('aria-pressed', String(S.s.autoOrbit));
}
function resetAll() {
  if (!confirm('Reset every setting to its default?')) return;
  closeEditor(true); S.p = clone(DEFAULTS); S.s = clone(STYLE_DEFAULTS); S.x = clone(EXPORT_DEFAULTS); S.r = {}; S.motion = {}; S.lanes = {}; S.perfLen = 0; S.bank = { human: null, dog: null };
  S.ver++; pause(); setArmed(false); S.sel = null; S.preset = 'Normal'; S.zoom = 1; S.panX = S.panY = 0; S.frame = 0; build(); render(); save();
}
const goTab = (t) => { S.tab = t; renderPanel(); };
function menuBar() {
  const mb = (label, testid, items) => menuButton({ label, testid, items, bar: 'main', className: 'btn mb', caret: false });
  return h('nav', { class: 'menubar', role: 'menubar', 'aria-label': 'Menus' },
    mb('File', 'menu-file', () => [
      { label: 'New: clear everything', testid: 'file-new', onClick: newSession },
      { label: 'Reopen with last session', testid: 'file-resume', radio: true, checked: LAYOUT.resume, onClick: () => { LAYOUT.resume = !LAYOUT.resume; layoutSave(); render(); setMessage(LAYOUT.resume ? 'The next visit reopens where you left off.' : 'The next visit starts clean.'); } },
      { separator: true },
      { label: 'Save settings…', testid: 'file-save', onClick: saveSettings },
      { label: 'Load settings…', testid: 'file-load', onClick: () => document.querySelector('[data-testid="settings-load"]')?.click() },
      { separator: true },
      { label: 'Export frames…', testid: 'file-export', onClick: () => goTab('Export') },
      { label: 'Contact sheet', testid: 'file-sheet', onClick: runSheet },
      { label: 'Key poses only', testid: 'file-keys', onClick: runKeyPoses },
      { label: 'Lane data as CSV', testid: 'file-csv', onClick: () => runLaneData('csv') },
      { label: 'Lane data as JSON', testid: 'file-json', onClick: () => runLaneData('json') },
    ]),
    mb('Edit', 'menu-edit', () => [
      { label: 'Undo', testid: 'menu-undo', shortcut: 'Ctrl+Z', disabled: !hist.canUndo, onClick: undo },
      { label: 'Redo', testid: 'menu-redo', shortcut: 'Shift+Ctrl+Z', disabled: !hist.canRedo, onClick: redo },
      { separator: true },
      { label: 'Reset all settings…', testid: 'reset-all', onClick: resetAll },
    ]),
    mb('View', 'menu-view', () => [
      { label: 'Stage only', testid: 'stage-only', checked: S.stageOnly, onClick: () => { S.stageOnly = !S.stageOnly; document.body.classList.toggle('stage-only', S.stageOnly); render(); } },
      { label: 'Frame information on the stage', testid: 'view-hud', checked: LAYOUT.hud, onClick: () => { LAYOUT.hud = !LAYOUT.hud; layoutSave(); render(); } },
      { label: 'Fit figure to window', testid: 'menu-fit', onClick: () => { S.zoom = 1; S.panX = S.panY = 0; render(); } },
      { separator: true },
      { heading: 'Theme' },
      ...[['auto', 'Follow the device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => ({ label: l, testid: `theme-${v}`, radio: true, checked: LAYOUT.theme === v, onClick: () => setTheme(v) })),
      { separator: true },
      { heading: 'Interface size' },
      ...[['auto', 'Automatic'], ['compact', 'Compact'], ['comfortable', 'Comfortable']].map(([v, l]) => ({ label: l, testid: `density-${v}`, radio: true, checked: LAYOUT.density === v, onClick: () => setDensity(v) })),
    ]),
    mb('Performance', 'menu-perf', () => [
      { label: S.playing ? 'Pause' : 'Play', testid: 'pm-play', onClick: () => (S.playing ? pause() : play()) },
      { label: 'Go to start', testid: 'pm-first', onClick: () => { pause(); setFrame(0); } },
      { label: 'Go to end', testid: 'pm-last', onClick: () => { pause(); setFrame(cycleFrames(P()).frames.length - 1); } },
      { separator: true },
      { label: 'Arm recording', testid: 'pm-arm', checked: S.armed, onClick: () => setArmed(!S.armed) },
      { heading: 'Recording style' },
      { label: 'Touch: record while held', testid: 'pm-touch', radio: true, checked: S.recMode === 'touch', onClick: () => { S.recMode = 'touch'; rec.setMode(S.armed ? 'touch' : 'off'); renderPanel(); } },
      { label: 'Latch: hold the last value', testid: 'pm-latch', radio: true, checked: S.recMode === 'latch', onClick: () => { S.recMode = 'latch'; rec.setMode(S.armed ? 'latch' : 'off'); renderPanel(); } },
      { separator: true },
      { label: 'Movements…', testid: 'pm-movements', onClick: () => goTab('Auto') },
      { label: 'Saved performances…', testid: 'pm-saved', onClick: () => goTab('Auto') },
    ]));
}
const iconBtn = (name, label, testid, onClick, extra = {}) => h('button', { type: 'button', class: 'btn ghost icon', testid, 'aria-label': label, title: label, onClick, ...extra }, icon(name), h('span', { class: 'sr' }, label));

function build() {
  const app = document.getElementById('app');
  app.textContent = '';
  const presetSel = h('select', { id: 'preset', class: 'select', 'aria-label': 'Walk preset', testid: 'preset', onChange: (e) => { if (e.target.value !== 'Custom') applyPreset(e.target.value); } },
    [...Object.keys(presetsForFigure(figKey())), 'Custom'].map((n) => h('option', { value: n, selected: n === S.preset }, n)));
  const speedSel = h('select', { class: 'select', 'aria-label': 'Preview speed', testid: 'speed', onChange: (e) => { S.rate = Number(e.target.value); } }, [0.25, 0.5, 1, 2].map((r) => h('option', { value: r, selected: r === 1 }, `${r}×`)));
  const settingsFile = h('input', { type: 'file', accept: '.json,application/json', class: 'sr', tabindex: '-1', 'aria-label': 'Load settings file', testid: 'settings-load', onChange: loadSettings });
  const header = h('header', { class: 'bar' },
    h('div', { class: 'brand' }, 'Walk Base'),
    menuBar(),
    h('span', { class: 'bar-sep', role: 'presentation' }),
    iconBtn('undo', 'Undo', 'undo', undo, { disabled: !hist.canUndo, title: 'Undo (Ctrl or Cmd + Z)' }),
    iconBtn('redo', 'Redo', 'redo', redo, { disabled: !hist.canRedo, title: 'Redo (Shift + Ctrl or Cmd + Z)' }),
    h('div', { class: 'bar-fields' },
      h('label', { class: 'field' }, h('span', null, 'Figure'), h('select', { id: 'rig', class: 'select', 'aria-label': 'Which figure', testid: 'rig', onChange: (e) => setFigure(e.target.value) },
        FIGS.map((f) => h('option', { value: f, selected: f === figKey() }, FIG_LABELS[f])))),
      h('label', { class: 'field' }, h('span', null, 'Walk'), presetSel),
      h('label', { class: 'field' }, h('span', null, 'Speed'), speedSel),
      h('label', { class: 'field' }, h('span', null, 'Source'), h('select', { id: 'source', class: 'select', 'aria-label': 'What is on the stage', testid: 'source', onChange: (e) => setSource(e.target.value) },
        h('option', { value: 'walk', selected: S.source === 'walk' }, '3D walk'), h('option', { value: 'sampled', selected: S.source === 'sampled' }, 'Sampled drawings')))),
    settingsFile);
  stage = h('canvas', { class: 'stage', testid: 'stage', 'aria-label': 'Walk preview. Tap a body part to select it. Drag to orbit.', role: 'img' });
  hud = h('div', { class: 'hud', testid: 'hud', 'aria-live': 'off' });
  const setView = (yaw, pitch) => { S.s.camYaw = yaw; S.s.camPitch = pitch; if (S.tab === 'View') renderPanel(); render(); save(); };
  const vb = (name, label, id, fn, attrs = {}) => h('button', { type: 'button', class: `btn vb icon${id === 'fit' ? '' : ' cam'}`, testid: id, 'aria-label': label, title: label, onClick: fn, ...attrs }, icon(name), h('span', { class: 'sr' }, label));
  const views = [['Side', 0, 0, 'view-side'], ['¾ front', -40, 12, 'view-34'], ['Front', -90, 0, 'view-front'], ['Back', 90, 0, 'view-back'], ['Top', 0, 80, 'view-top']];
  const viewMenu = menuButton({ label: 'View', testid: 'view-menu', className: 'btn vb cam', title: 'Camera view', items: () => views.map(([l, y, p, id]) => ({ label: l, testid: id, radio: true, checked: S.s.camYaw === y && S.s.camPitch === p, onClick: () => setView(y, p) })) });
  const viewbar = h('div', { class: 'viewbar', role: 'toolbar', 'aria-label': 'Camera' },
    vb('orbit', 'Orbit', 'tool-orbit', () => { S.tool = 'orbit'; refreshViewbar(); }, { 'data-tool': 'orbit' }),
    vb('pan', 'Pan', 'tool-pan', () => { S.tool = 'pan'; refreshViewbar(); }, { 'data-tool': 'pan' }),
    h('span', { class: 'vsep cam', role: 'presentation' }), viewMenu, h('span', { class: 'vsep cam', role: 'presentation' }),
    vb('spin', 'Spin', 'turntable', () => { S.s.autoOrbit = !S.s.autoOrbit; refreshViewbar(); save(); }, { 'aria-pressed': 'false' }),
    vb('fit', 'Fit', 'fit', () => { S.zoom = 1; S.panX = S.panY = 0; render(); }));
  const back = h('button', { type: 'button', class: 'btn back', testid: 'stage-back', onClick: () => { S.stageOnly = false; document.body.classList.remove('stage-only'); render(); } }, 'Show controls');
  wrapEl = h('section', { class: 'stage-wrap' }, stage, hud, viewbar, back);
  frameCanvas = document.createElement('canvas');
  const tabs = h('nav', { class: 'tabs', role: 'tablist' }, TABS.map((t) => h('button', { type: 'button', class: 'tab', role: 'tab', 'data-tab': t, testid: `tab-${t}`, onClick: () => { S.tab = t; renderPanel(); } }, t)));
  const panel = h('section', { class: 'panel' }, tabs, h('div', { id: 'panel-body', class: 'panel-body' }));
  const popout = h('aside', { id: 'popout', class: 'popout', hidden: true, 'aria-label': 'Curve editor', testid: 'popout' });
  const tl = h('footer', { class: 'timeline' },
    h('div', { class: 'transport', role: 'toolbar', 'aria-label': 'Playback' },
      h('span', { class: 'grp' },
        iconBtn('first', 'First frame', 'first', () => { pause(); setFrame(0); }),
        iconBtn('prev', 'Back one frame', 'prev', () => { pause(); setFrame(S.frame - 1); }),
        h('button', { type: 'button', class: 'btn primary icon', id: 'play', testid: 'play', 'aria-pressed': 'false', 'aria-label': 'Play', title: 'Play or pause', onClick: () => (S.playing ? pause() : play()) }, icon('play'), h('span', { class: 'sr' }, 'Play')),
        iconBtn('next', 'Forward one frame', 'next', () => { pause(); setFrame(S.frame + 1); }),
        iconBtn('last', 'Last frame', 'last', () => { pause(); setFrame(cycleFrames(P()).frames.length - 1); })),
      h('button', { type: 'button', class: 'btn ghost rec icon', id: 'rec', testid: 'rec', 'aria-pressed': 'false', 'aria-label': 'Record', title: 'Arm recording: moves you make while playing become automation', onClick: () => setArmed(!S.armed) }, icon('rec'), h('span', { class: 'sr' }, 'Rec')),
      h('label', { class: 'field' }, h('span', null, 'Frame'), h('input', { id: 'frameNum', type: 'number', class: 'num', inputmode: 'numeric', min: 1, value: 1, testid: 'frame-input', onChange: (e) => { pause(); setFrame(Number(e.target.value) - 1); } })),
      h('span', { class: 'tc', id: 'tc', 'aria-hidden': 'true' })),
    h('div', { id: 'strip', class: 'strip', role: 'group', 'aria-label': 'Frames in the cycle' }));
  const splitter = h('div', { class: 'splitter', role: 'separator', tabindex: '0', 'aria-label': 'Resize the animation window. Drag, or use the arrow keys.', testid: 'splitter' }, h('span', { class: 'grip' }));
  app.append(header, h('main', { class: 'main', id: 'main' }, wrapEl, panel, popout, splitter), tl);
  layoutInit(splitter);
  buildStrip(); renderPanel(); setPlayButton(); refreshViewbar();
  new ResizeObserver(render).observe(wrapEl);
  gestures();
}

// ---------- resizable animation window ----------
const LAYOUT_KEY = 'walkbase.layout';
const LAYOUT = { panelW: 390, stageH: null, density: 'auto', theme: 'auto', resume: false, hud: false, collapsed: {} };
/** Light or dark: follows the device unless you choose. */
function applyTheme() { if (LAYOUT.theme === 'light' || LAYOUT.theme === 'dark') document.documentElement.dataset.theme = LAYOUT.theme; else delete document.documentElement.dataset.theme; }
function setTheme(v) { LAYOUT.theme = v; applyTheme(); layoutSave(); render(); }
const touchy = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
/** Compact for a pointer, comfortable for a finger, unless you choose. Comfortable keeps every control at 44 px. */
function applyDensity() {
  const d = LAYOUT.density === 'compact' || LAYOUT.density === 'comfortable' ? LAYOUT.density : (touchy() ? 'comfortable' : 'compact');
  document.documentElement.dataset.density = d;
}
function setDensity(v) { LAYOUT.density = v; applyDensity(); layoutSave(); layoutApply(); renderPanel(); }
const isPortraitLayout = () => matchMedia('(max-width: 900px), (orientation: portrait)').matches;
function layoutApply() {
  const m = document.getElementById('main'); if (!m) return;
  const r = m.getBoundingClientRect();
  if (isPortraitLayout()) {
    const max = Math.max(180, r.height - 200);
    const h = LAYOUT.stageH == null ? Math.round(r.height * 0.44) : Math.min(max, Math.max(140, LAYOUT.stageH));
    LAYOUT.stageH = h;
    m.style.setProperty('--stage-h', `${h}px`);
    m.style.setProperty('--panel-w', '390px');
    m.dataset.split = 'h';
  } else {
    const w = Math.min(Math.max(300, r.width - 260), Math.max(260, LAYOUT.panelW));
    LAYOUT.panelW = w;
    m.style.setProperty('--panel-w', `${w}px`);
    m.dataset.split = 'v';
  }
  render();
}
function layoutSave() { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(LAYOUT)); } catch { /* storage unavailable */ } }
function layoutInit(el) {
  try { Object.assign(LAYOUT, JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}')); } catch { /* keep defaults */ }
  layoutApply();
  window.addEventListener('resize', layoutApply);
  let start = null;
  el.addEventListener('pointerdown', (e) => {
    // No text selection or native drag may start from the divider; either would cancel the drag.
    e.preventDefault();
    window.getSelection?.()?.removeAllRanges();
    el.setPointerCapture(e.pointerId);
    const panel = document.querySelector('.panel').getBoundingClientRect(); const stageBox = document.querySelector('.stage-wrap').getBoundingClientRect();
    start = { x: e.clientX, y: e.clientY, panelW: Math.round(panel.width), stageH: Math.round(stageBox.height), vertical: !isPortraitLayout() };
  });
  el.addEventListener('pointermove', (e) => {
    if (!start) return;
    if (start.vertical) LAYOUT.panelW = Math.round(start.panelW - (e.clientX - start.x)); else LAYOUT.stageH = Math.round(start.stageH + (e.clientY - start.y));
    layoutApply();
  });
  const end = (e) => { if (!start) return; start = null; try { el.releasePointerCapture(e.pointerId); } catch { /* released */ } layoutSave(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('selectstart', (e) => e.preventDefault());
  el.addEventListener('dragstart', (e) => e.preventDefault());
  el.addEventListener('dblclick', () => { window.getSelection?.()?.removeAllRanges(); LAYOUT.panelW = 390; LAYOUT.stageH = null; layoutApply(); layoutSave(); });
  el.addEventListener('keydown', (e) => {
    const step = e.shiftKey ? 60 : 20;
    const vertical = !isPortraitLayout();
    const grow = vertical ? e.key === 'ArrowLeft' : e.key === 'ArrowDown';
    const shrink = vertical ? e.key === 'ArrowRight' : e.key === 'ArrowUp';
    if (!grow && !shrink) return;
    e.preventDefault();
    if (vertical) LAYOUT.panelW = Math.round(document.querySelector('.panel').getBoundingClientRect().width) + (grow ? step : -step); else LAYOUT.stageH = Math.round(document.querySelector('.stage-wrap').getBoundingClientRect().height) + (grow ? step : -step);
    layoutApply(); layoutSave();
  });
}

// ---------- stage gestures: tap selects a part, drag orbits or pans, pinch zooms ----------
function gestures() {
  const ptrs = new Map();
  let start = null; let down = null; let drag = null;
  stage.style.touchAction = 'none';
  const toFrame = (clientX, clientY) => {
    const m = S.map; if (!m) return null;
    const cx = (clientX - m.left) * m.d; const cy = (clientY - m.top) * m.d;
    return { x: ((cx - m.x0) / m.zw) * m.fcw, y: ((cy - m.y0) / m.zh) * m.fch };
  };
  stage.addEventListener('pointerdown', (e) => {
    stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { drag = attachDragStart(e, toFrame) || fixDragStart(e, toFrame) || arcDragStart(e, toFrame); if (drag) { down = null; start = null; return; } }
    start = snap();
    down = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, yaw: S.s.camYaw, pitch: S.s.camPitch } : null;
  });
  stage.addEventListener('pointermove', (e) => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (drag) { (drag.arc ? arcDragMove : drag.fix ? fixDragMove : attachDragMove)(drag, e, toFrame); return; }
    const pts = [...ptrs.values()];
    if (!start) return;
    if (pts.length >= 2) {
      down = null;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      S.zoom = Math.min(8, Math.max(0.5, start.zoom * (d / start.dist)));
      S.panX = start.panX + ((pts[0].x + pts[1].x) / 2 - start.cx); S.panY = start.panY + ((pts[0].y + pts[1].y) / 2 - start.cy);
    } else if (down) {
      const dx = pts[0].x - down.x; const dy = pts[0].y - down.y;
      if (!down.moved && Math.hypot(dx, dy) < 8) return;
      down.moved = true;
      if (S.tool === 'orbit') {
        S.s.camYaw = ((down.yaw - dx * 0.45 + 540) % 360) - 180;
        S.s.camPitch = Math.max(-85, Math.min(85, down.pitch + dy * 0.35));
      } else { S.panX = start.panX + dx; S.panY = start.panY + dy; }
    }
    render();
  });
  const up = (e) => {
    if (drag) { if (drag.arc || drag.fix) { renderPanel(); save(); } else attachDragEnd(drag, e, toFrame); drag = null; ptrs.delete(e.pointerId); down = null; start = ptrs.size ? snap() : null; return; }
    const was = down; const had = ptrs.has(e.pointerId);
    ptrs.delete(e.pointerId);
    if (had && was && !was.moved && performance.now() - was.t < 500) {
      const q = toFrame(e.clientX, e.clientY);
      const front = q && S.last ? pickAttachment(q, 'front') : null;
      const hit = !front && q && S.last ? pickPart(S.last.shapes, q.x, q.y) : null;
      const back = !front && !hit && q && S.last ? pickAttachment(q, 'behind') : null;
      if (front || back) selectAttach((front || back).it.id);
      else { S.attachSel = null; selectPart(hit, { openTab: Boolean(hit) }); }
    } else if (had && was?.moved && S.tool === 'orbit') { if (S.tab === 'View') renderPanel(); save(); }
    down = null; start = ptrs.size ? snap() : null;
  };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); down = null; start = null; drag = null; });
  stage.addEventListener('wheel', (e) => { e.preventDefault(); S.zoom = Math.min(8, Math.max(0.5, S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); render(); }, { passive: false });
  stage.addEventListener('dblclick', () => { S.zoom = 1; S.panX = S.panY = 0; render(); });
  function snap() {
    const pts = [...ptrs.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length; const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    return { zoom: S.zoom, panX: S.panX, panY: S.panY, cx, cy, dist: pts.length > 1 ? Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) : 1 };
  }
}

window.addEventListener('keydown', (e) => {
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.key === ' ') { e.preventDefault(); S.playing ? pause() : play(); }
  else if (e.key === 'ArrowRight') { pause(); setFrame(S.frame + 1); }
  else if (e.key === 'ArrowLeft') { pause(); setFrame(S.frame - 1); }
  else if (e.key === 'Escape') { if (S.edit) closeEditor(); else if (S.attachSel) selectAttach(null); else if (S.sel) selectPart(null); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });


// ---------- animation sampler ----------
function setSource(src) {
  if (src === 'sampled' && !(SM.loaded && SM.cuts.length)) {
    setMessage('Load a picture in the Sampler tab first.');
    const sel = document.getElementById('source'); if (sel) sel.value = 'walk';
    S.tab = 'Sampler'; renderPanel(); return;
  }
  S.source = src; S.frame = 0; closeEditor(true); S.sel = null;
  document.body.classList.toggle('sampled', src === 'sampled');
  const sel = document.getElementById('source'); if (sel) sel.value = src;
  buildStrip(); renderPanel(); render();
}
function samplerChanged() { touchSampler(); if (S.source === 'sampled') { S.frame = Math.min(S.frame, totalFrames() - 1); buildStrip(); } renderPanel(); render(); save(); }
function applySavedCuts() {
  const sv = S.savedSampler;
  if (!sv?.picture || sv.picture.name !== SM.name || sv.picture.W !== SM.W || sv.picture.H !== SM.H || !sv.cuts.length) return false;
  setCuts(numberCuts(sv.cuts.map((c) => ({ ...c, label: c.label ?? '', manual: Boolean(c.manual) }))));
  return true;
}
function openCuts() {
  pause();
  openCutWindow({ onChange: () => { if (S.source === 'sampled') buildStrip(); render(); save(); }, onDone: () => { samplerChanged(); }, toast: (m) => setMessage(m) });
}
async function pickPicture(file) {
  if (!file) return;
  try {
    setMessage('Reading the picture…');
    await loadPicture(file);
    const restored = applySavedCuts();
    setMessage(restored ? `Picture loaded, with your earlier cuts restored (${SM.cuts.length}). Erasing is not saved.` : `Picture loaded. ${SM.cuts.length} drawing${SM.cuts.length === 1 ? '' : 's'} found.`);
    setSource('sampled');
    S.tab = 'Sampler'; renderPanel();
    if (!restored) openCuts();
  } catch (e) { setMessage(`Could not read that picture: ${e.message}`); }
}
function samplerSection() {
  const host = h('div', { class: 'sampler' });
  const slider = (label, id, min, max, step, get, set, help) => {
    const num = h('input', { type: 'number', class: 'num', min, max, step, value: get(), 'aria-label': label, testid: `${id}-num`, onChange: (e) => { set(Number(e.target.value)); renderPanel(); save(); } });
    const rng = h('input', { type: 'range', class: 'rng', min, max, step, value: get(), 'aria-label': `${label} slider`, testid: id, onInput: (e) => { set(Number(e.target.value)); num.value = e.target.value; save(); } });
    return h('div', { class: 'row noreset' }, labBtn(label), h('div', { class: 'ctl' }, rng, num), h('p', { class: 'help' }, help));
  };
  const segRow = (label, help, items, get, set) => h('div', { class: 'row noreset' }, labBtn(label),
    h('div', { class: 'seg', role: 'group', 'aria-label': label }, items.map(([v, t, tid]) => h('button', { type: 'button', class: 'segbtn', testid: tid, 'aria-pressed': String(get() === v), onClick: () => { set(v); renderPanel(); save(); } }, t))), h('p', { class: 'help' }, help));

  host.append(h('p', { class: 'hint' }, 'Load a picture of a movement sequence: a photo, a scan, a sheet of your own drawings. The app finds the drawings, cuts them into frames, and plays them on the timeline. The picture stays on this device.'));
  const input = h('input', { type: 'file', accept: 'image/*', class: 'file-input', 'aria-label': 'Choose a picture', testid: 'sampler-file', onChange: (e) => { pickPicture(e.target.files?.[0]); e.target.value = ''; } });
  host.append(h('section', { class: 'group' }, h('h3', null, '1. Picture'),
    h('div', { class: 'btnrow' }, h('label', { class: 'btn primary file-btn' }, SM.loaded ? 'Choose another picture' : 'Choose a picture', input),
      SM.loaded ? h('button', { type: 'button', class: 'btn', testid: 'sampler-remove', onClick: () => { unload(); setSource('walk'); S.savedSampler = null; renderPanel(); save(); } }, 'Remove picture') : null),
    SM.loaded ? h('p', { class: 'hint' }, `${SM.name} · ${SM.W}×${SM.H}`) : null));
  if (!SM.loaded) return host;

  const o = SM.opts;
  host.append(h('section', { class: 'group' }, h('h3', null, '2. Cuts'),
    segRow('How to cut', 'Auto finds gaps between drawings. Cut into N is for drawings that overlap: it cuts each row at its quietest places. Grid and Even divide the inked area equally.', [['auto', 'Auto', 'sm-mode-auto'], ['count', 'Cut into N', 'sm-mode-count'], ['row', 'One row', 'sm-mode-row'], ['column', 'One column', 'sm-mode-column'], ['grid', 'Grid', 'sm-mode-grid'], ['even', 'Even', 'sm-mode-even']], () => o.mode, (v) => { o.mode = v; }),
    slider('Sensitivity', 'sm-sens', 0, 100, 1, () => o.sensitivity, (v) => { o.sensitivity = v; }, 'Higher finds fainter pencil.'),
    slider('Space between drawings', 'sm-gap', 0.3, 10, 0.1, () => o.minGap, (v) => { o.minGap = v; }, 'Percent of the picture. Raise it if one drawing is split in two.'),
    slider('Ignore small marks', 'sm-min', 0, 60, 1, () => o.minSize, (v) => { o.minSize = v; }, 'Percent of a typical drawing. Raise it to drop captions and specks.'),
    slider('Padding', 'sm-pad', 0, 60, 1, () => o.padding, (v) => { o.padding = v; }, 'Pixels of margin around each cut.'),
    o.mode === 'grid' ? slider('Columns', 'sm-cols', 1, 24, 1, () => o.cols, (v) => { o.cols = v; }, 'Grid mode.') : null,
    o.mode === 'grid' ? slider('Rows', 'sm-rows', 1, 12, 1, () => o.rows, (v) => { o.rows = v; }, 'Grid mode.') : null,
    o.mode === 'even' || o.mode === 'count' ? slider(o.mode === 'count' ? 'Drawings per row' : 'Frames', 'sm-count', 1, 64, 1, () => o.count, (v) => { o.count = v; }, o.mode === 'count' ? 'How many drawings are in each row (or in your region).' : 'Even mode: equal slices across the picture.') : null,
    slider('Ignore long lines', 'sm-rule', 0, 40, 1, () => o.ruleLen, (v) => { o.ruleLen = v; }, 'Percent of the picture width. Ground lines and borders longer than this are not counted, so they cannot join the drawings. 0 keeps them.'),
    slider('Ignore text lines', 'sm-aspect', 0, 20, 0.5, () => o.maxAspect, (v) => { o.maxAspect = v; }, 'Finds much wider than tall (or the reverse) are dropped as text or rules. 0 keeps everything.'),
    h('div', { class: 'row noreset' }, labBtn('Region'),
      SM.region ? h('button', { type: 'button', class: 'btn', testid: 'sm-region-clear', onClick: () => { SM.region = null; renderPanel(); save(); } }, 'Clear region') : h('span', { class: 'hint' }, 'Whole picture'), h('p', { class: 'help' }, SM.region ? 'Only this part of the picture is searched.' : 'The whole picture is searched. In the cut window, use Region to mark just the drawings and leave out text.')),
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn', testid: 'sampler-detect', onClick: () => { if (!SM.cuts.length || confirm('Detect again? This replaces your cuts and frame numbers.')) { detect(); samplerChanged(); setMessage(`${SM.cuts.length} drawings found.`); } } }, 'Detect again'),
      h('button', { type: 'button', class: 'btn primary', testid: 'sampler-open', onClick: openCuts }, 'Open cut window'))));

  const list = h('div', { class: 'slices' });
  SM.cuts.forEach((c, i) => {
    const s = sliceOf(i);
    const thumb = h('canvas', { class: 'thumb', width: 72, height: 72, 'aria-hidden': 'true' });
    const k = Math.min(72 / s.canvas.width, 72 / s.canvas.height);
    const tctx = thumb.getContext('2d'); tctx.fillStyle = '#fff'; tctx.fillRect(0, 0, 72, 72); tctx.drawImage(s.canvas, (72 - s.canvas.width * k) / 2, (72 - s.canvas.height * k) / 2, s.canvas.width * k, s.canvas.height * k);
    list.append(h('div', { class: `slice${i === SM.sel ? ' on' : ''}`, testid: `slice-${i}` }, thumb,
      h('label', { class: 'field' }, h('span', null, 'Frame'), h('input', { type: 'text', class: 'num', value: c.label, 'aria-label': `Frame number of drawing ${i + 1}`, testid: `slice-label-${i}`, onChange: (e) => { const v = e.target.value.trim(); SM.cuts[i].label = v; SM.cuts[i].manual = v !== ''; setCuts(numberCuts(SM.cuts)); samplerChanged(); } })),
      h('label', { class: 'field' }, h('span', null, 'Hold'), h('input', { type: 'number', class: 'num', min: 1, max: 48, value: c.exposure ?? '', placeholder: String(SM.exposure), 'aria-label': `Frames held for drawing ${i + 1}`, testid: `slice-hold-${i}`, onChange: (e) => { SM.cuts[i].exposure = e.target.value === '' ? null : Math.max(1, Math.round(Number(e.target.value))); samplerChanged(); } })),
      h('button', { type: 'button', class: 'btn tiny', testid: `slice-edit-${i}`, onClick: () => { SM.sel = i; openCuts(); } }, 'Edit')));
  });
  host.append(h('section', { class: 'group' }, h('h3', null, `3. Frames (${SM.cuts.length})`), SM.cuts.length ? list : h('p', { class: 'hint' }, 'No drawings found yet. Open the cut window to add cuts by hand.')));

  const total = SM.cuts.length ? totalFrames() : 0;
  host.append(h('section', { class: 'group' }, h('h3', null, '4. Timeline'),
    slider('Default hold', 'sm-hold', 1, 12, 1, () => SM.exposure, (v) => { SM.exposure = v; touchSampler(); if (S.source === 'sampled') { buildStrip(); render(); } }, 'Frames each drawing stays on screen, unless you set its own. 2 is "on twos".'),
    segRow('Line up the drawings', 'Feet pins each drawing\'s bottom and centre to one spot, so the figure stays in place. Centre pins the middle. As laid out keeps their positions on the sheet, so travel across the page stays.', [['feet', 'Feet', 'sm-reg-feet'], ['centre', 'Centre', 'sm-reg-centre'], ['layout', 'As laid out', 'sm-reg-layout']], () => SM.reg, (v) => { SM.reg = v; touchSampler(); if (S.source === 'sampled') render(); }),
    h('div', { class: 'row noreset' }, labBtn('Remove paper'),
      h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: SM.clean.paper, testid: 'sm-paper', onChange: (e) => { SM.clean.paper = e.target.checked; samplerChanged(); } }), h('span', null, SM.clean.paper ? 'On' : 'Off')), h('p', { class: 'help' }, 'Makes the paper tone transparent, so the lines can be traced over. Faint pencil can drop out, so raise the cut-off carefully.')),
    SM.clean.paper ? slider('Paper cut-off', 'sm-paper-t', 0, 120, 1, () => SM.clean.threshold, (v) => { SM.clean.threshold = v; touchSampler(); render(); }, 'Higher removes more.') : null,
    h('p', { class: 'summary', testid: 'sm-summary' }, `${SM.cuts.length} frames, ${total} timeline frames, ${(total / S.p.fps).toFixed(2)} s at ${S.p.fps} fps.`),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', testid: 'sampler-use', onClick: () => setSource('sampled') }, S.source === 'sampled' ? 'On the stage now' : 'Put on the stage'),
      h('button', { type: 'button', class: 'btn', testid: 'sampler-walk', onClick: () => setSource('walk') }, 'Back to the 3D walk')),
    h('p', { class: 'hint', id: 'msg', role: 'status' }, S.message)));
  return host;
}

try { Object.assign(LAYOUT, JSON.parse(localStorage.getItem(LAYOUT_KEY) || '{}')); } catch { /* keep defaults */ }
applyDensity(); applyTheme();
// Each visit starts clean unless File > Reopen with last session is on.
if (LAYOUT.resume) {
  load();
  try { refAdopt(JSON.parse(localStorage.getItem(REF_KEY) || 'null')); } catch { /* none kept */ }
  loadAttachImages();
} else { try { for (const k of [KEY, REF_KEY, ATT_IMG_KEY]) localStorage.removeItem(k); } catch { /* storage unavailable */ } }
hist.reset(snapState());
build();
render();
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.altKey) return;
  const t = e.target; const typing = t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && ['text', 'number', 'search'].includes(t.type)));
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
});
window.__walkBase = {
  setFigure, figKey, clipsFor, applyClip, undo, redo, hist, snapState, menuOwner, closeMenus, setDensity, setTheme, addAttach, patchAttach, selectAttach, attachItem, attachList, pickAttachImage, cleanAttach, REF, refPaint, pickRef, findKeyFrames: () => findKeyFrames(P()), laneTable: () => laneTable(P()), exportKeys: (over = {}) => exportKeyFrames(P(), S.s, { ...S.x, ...over }),
  setRig, rec, addClip, openLaneEditor, setArmed, nowValues, perfData, S, P, LAYOUT, layoutApply, render: paint, setFrame, play, pause, applyPreset, selectPart, openEditor, closeEditor, setMotion, patchMotion, liveValue, setTab: (t) => { S.tab = t; renderPanel(); },
  setParam: (id, v) => { const c = CONTROLS.find((x) => x.id === id); setParam(c, v); renderPanel(); },
  exportZip: (over = {}) => exportPngZip(P(), S.s, { ...S.x, ...over }),
  exportMp4: (over = {}) => exportMp4(P(), S.s, { ...S.x, ...over }),
  frame: (i, part = null, over = {}) => renderFrame(P(), S.s, { ...S.x, ...over }, i, part),
  manifest: (over = {}) => manifest(P(), S.s, { ...S.x, ...over }),
  timeline: (over = {}) => exportTimeline(P(), { ...S.x, ...over }),
  editor: () => editor, SM, setSource, pickPicture, openCuts, sampledSummary,
};
