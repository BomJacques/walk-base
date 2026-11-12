// Walk Base: an adjustable 3D walk to trace over. Original figure, runs entirely on this device.
import { DEFAULTS, cycleFrames, cycleTravel, foot, sideGait, gaitSummary, supportStats } from './rig.js';
import { CADENCE, targetOfParam, targetOfChannel, parseTarget, hasLanes, paramsAt, motionAt, integrate, Recorder, laneValue } from './automation.js';
import { clipsFor, clipsForFigure, applyClip, CLIP_GROUPS, groupOfClip } from './clips.js';
import { LaneEditor, copySpan, pasteSpan, shiftLane, loopSpan, mirrorTarget } from './lanes.js';
import { STYLE_DEFAULTS, drawScene, pickPart } from './draw.js';
import { EXPORT_DEFAULTS, exportPngZip, exportKeyFrames, exportMp4, videoSupport, contactSheet, deliver, summary, renderFrame, exportTimeline, manifest } from './export.js';
import { CONTROLS, TABS, TAB_LABELS, PRESETS, DEFAULT_OF, presetsFor, presetsForFigure, shownFor, HOSE_PROPORTIONS } from './controls.js';
import { SPECIES } from './dogdefaults.js';
import { wordsFor } from './words.js';
import { solveFix, writeFix, fixPoints, clearFix } from './fix.js';
import { dogPlants, pawGait, legsOf } from './dog3.js';
import { PARTS, CHANNEL_BY_ID, partChannels, partLabel, makeEvaluator, sampleFinal, isEdited, allowedFrequencies } from './motion.js';
import { CurveEditor, mirrorPoints } from './curves.js';
import { cleanPhys, STRIP_LIMITS } from './stripdefs.js';
import { arcPoints, arcPoint, arcColor, adoptArcs, moveArcPoint, arcSide, symmetrize, otherSideCurve, SYMMETRY, DEFAULT_ARCS } from './arcs.js';
import { SM, loadPicture, unload, detect, sliceOf, sampledSummary, totalFrames, touch as touchSampler, setCuts } from './sampler.js';
import { openCutWindow } from './cutwindow.js';
import { SLICE_DEFAULTS, numberCuts } from './slicer.js';
import { History } from './history.js';
import { findKeyFrames, laneTable, tableCsv } from './keyposes.js';
import { VISEMES, VISEME_BY_ID, buildSpeech, cleanSpeech, keyOn, speechAt } from './lipsync.js';
import { paintMouth } from './mouth.js';
import { icon } from './icons.js';
import { makeSeamless, loopGap } from './loop.js';
import { PROP_KINDS, PROP_BY_ID, newProp, newActor, cleanScene, EMPTY_SCENE } from './scene.js';
import { PHYS_MODES } from './propphys.js';
import { cleanShadow } from './shadow.js';
import { itemUVFrame } from './attach.js';
import { paintStrokes, floodRegion, simplifyLoop, loopSize } from './ink.js';
import { decodePicture, videoSheet, isVideo, PICTURE_ACCEPT, PICTURE_VIDEO_ACCEPT } from './pictures.js';
import { partKey, newSkin, newPart, isPlain, cleanDesign, cellFor, toUV, fromUV, uvToCell, cellToUV, atlasLayout, atlasSkin, MAX_STROKES, MAX_STROKE_PTS, strokeShows, cleanInk, BLENDS as SKIN_BLENDS } from './design.js';
import { packCharacter, readCharacter } from './character.js';
import { PAD_COUNT, BLENDS, newBank, capturePad, transitionValues, blendFrames, cleanBank, cleanBanks } from './pads.js';
import { newMood, cleanMood, blendMood, moodKeys, moodsFor, moodWeights, CORNERS, CORNER_LABELS } from './mood.js';
import { PROP, setProp, loadProp, FALLOFFS } from './proportional.js';
import { canBend, attachTargets, targetKey, newItem, cloneItem, mirroredItem, itemFrame, toLocal, nearestEdgeT, edgePoint, anchorLocal, hitItem, pickHandle, imageInfo, registerImage, imageUrls, KINDS, freshId } from './attach.js';
import { menuButton, closeMenus, menuOwner, openMenuAt } from './menu.js';

const KEY = 'walkbase.v2';
const clone = (v) => JSON.parse(JSON.stringify(v));
/** The figures. The human has its own rig; the others are species of the dog's legged rig, each with its own attachments, saved performances and presets. */
/** The figures, in the groups the menus show them in. */
const FIG_GROUPS = [['People', ['human', 'hose']], ['Animals', ['dog', 'horse', 'bird', 'lizard', 'snake', 'spider', 'crab']], ['Dinosaurs and reptiles', ['theropod', 'sauropod', 'ceratopsian', 'pterodactyl', 'plesiosaur']], ['Rubber hose animals', ['hosehorse', 'hosebird']]];
const FIGS = FIG_GROUPS.flatMap(([, list]) => list);
const FIG_LABELS = { human: 'Human', hose: 'Rubber hose', dog: 'Dog', theropod: 'Theropod', bird: 'Bird', sauropod: 'Sauropod', ceratopsian: 'Ceratopsian', horse: 'Horse', lizard: 'Lizard', snake: 'Snake', spider: 'Spider', crab: 'Crab', pterodactyl: 'Pterodactyl', plesiosaur: 'Plesiosaur', hosehorse: 'Rubber hose horse', hosebird: 'Rubber hose bird' };
let BANKS = {}; // the pad bank of each figure: eight walks to switch between
let PADRUN = null; // a blend to a pad that is waiting or under way
const MOODREC = new Set(); // the settings the mood pad is writing in the take being recorded
let PADMODE = 'play'; // what a tap on a pad does: play | store | clear
let MOOD = newMood(); // the mood pad: where its dot is, what is in each corner, and the walk in the middle
const rigOfFig = (f) => (f === 'human' || f === 'hose' ? 'human' : 'dog');
const S = {
  draw: { mode: 'part', tool: 'pen', color: '#1b1b1f', size: 6, opacity: 1, guides: true, scope: 'all', target: { kind: 'fig' }, actorKey: null }, // the Draw tab: what the pen does
  design: {}, // each figure's design: { figure: { part key: its own look and skin } }
  p: clone(DEFAULTS), s: clone(STYLE_DEFAULTS), x: clone(EXPORT_DEFAULTS), r: {}, motion: {},
  preset: 'Normal', frame: 0, playing: false, rate: 1, tab: 'Gait', zoom: 1, panX: 0, panY: 0, stageOnly: false,
  source: 'walk', tool: 'select', sel: null, link: true, edit: null, busy: null, message: '', video: null, last: null, map: null,
  // Automation: lanes change a value over a longer performance. perfLen 0 means the performance is just one cycle.
  fixMode: false, fixSpread: 10, lanes: {}, perfLen: 0, bank: { human: null, dog: null }, perfs: { human: {}, dog: {} }, perfName: '', attach: { human: [], dog: [] }, attachSel: null, ver: 0, recMode: 'touch', armed: false, recording: false, laneEdit: null, clip: 'stop', clipStart: 0, clipLen: null, clipK: 1,
  // Speech: the text becomes key mouth shapes on the timeline. speechDraft is what is typed but not built yet.
  speech: null, speechDraft: null, speechStart: 0, speechSpeed: 1, mouthPreview: null,
  // The scene: other figures with walks of their own, and scenery. sceneSel is the one being edited.
  scene: { actors: [], props: [] }, sceneSel: null,
  // The file: its name, the state when it was last saved (to tell what has changed since), and the clipboard for Copy and Paste.
  fileName: 'walk-settings', savedState: null, everSaved: false, clipboard: null,
};
const rec = new Recorder();
// A picture to compare against, shown under the figure. It is a view aid, so it is kept out of undo and the settings file.
const REF_KEY = 'walkbase.ref';
const REF_DEFAULTS = { on: true, opacity: 0.5, size: 1, x: 0, y: 0, ground: 0.9, flip: false, export: false };
const REF = { ...REF_DEFAULTS, img: null, name: '', data: null };
const contact = (p, side = 'R') => { const g = sideGait({ ...DEFAULTS, ...p }, side); return foot(0, g.p, g.d); };
let perfCache = null;
/** The performance the figure follows: phase and position at every frame. Null when there is no automation and one cycle is all there is. */
function perfData() {
  const n = Math.max(2, Math.round(S.p.cycleFrames));
  // On uneven ground the figure has to keep going to climb, so a plain cycle becomes four cycles long.
  const T = S.perfLen > 0 ? Math.round(S.perfLen) : S.p.terrain && S.p.terrain !== 'flat' ? n * 4 : n;
  if (!hasLanes(S.lanes) && T === n) return null;
  const key = `${S.ver}|${T}|${JSON.stringify(S.p)}`;
  if (perfCache?.key !== key) { const dog = S.p.rig === 'dog';
    const s = integrate(S.p, S.lanes, T, n, dog ? null : contact);
    perfCache = { key, T, u: s.u, x: s.x, px: s.px, pz: s.pz, path: s.path, plants: dog ? dogPlants(S.p, S.lanes, T, s) : s.plants }; }
  const live = rec.liveValues();
  return { ...perfCache, lanes: S.lanes, live: Object.keys(live).length ? live : null };
}
/** The parameters every drawing and export reads: gait, proportions and the motion you have changed. */
const P = () => ({ ...S.p, proportions: S.r, motion: S.motion, attach: S.source === 'sampled' ? [] : (S.attach[figKey()] || []), design: S.source === 'sampled' ? null : (S.design[figKey()] || null), speech: S.source === 'sampled' ? null : S.speech, scene: S.source === 'sampled' ? null : S.scene, perf: S.source === 'sampled' ? null : perfData(), sampled: S.source === 'sampled' ? sampledSummary() : null });

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
  perfLen: S.perfLen, bank: S.bank, perfs: S.perfs, attach: S.attach, preset: S.preset, speech: S.speech, scene: S.scene, design: S.design,
});
function refreshHistory() {
  refreshSaveState();
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
    try { localStorage.setItem(KEY, JSON.stringify({ p: S.p, s: S.s, x: S.x, r: S.r, motion: S.motion, lanes: S.lanes, perfLen: S.perfLen, bank: S.bank, perfs: S.perfs, attach: S.attach, preset: S.preset, speech: S.speech, scene: S.scene, mood: MOOD, pads: BANKS, design: S.design, sampler: samplerSettings() })); } catch { setMessage('Settings could not be saved in this browser. Use Save settings to keep a copy.'); }
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
  if (raw.p?.model === 'hose' || raw.p?.model === 'mannequin') S.p.model = raw.p.model;
  if (SPECIES[raw.p?.dogSpecies]) S.p.dogSpecies = raw.p.dogSpecies;
  if (raw.bank && typeof raw.bank === 'object') for (const r of FIGS) { const b = raw.bank[r]; S.bank[r] = b ? { lanes: cleanLanes(b.lanes), perfLen: Math.max(0, Math.round(finite(b.perfLen))) } : null; }
  for (const c of CONTROLS) {
    const src = raw[c.scope];
    if (src && c.id in src) S[c.scope][c.id] = clampTo(c, src[c.id]);
  }
  if (raw.attach && typeof raw.attach === 'object') S.attach = cleanAttach(raw.attach);
  if (raw.perfs && typeof raw.perfs === 'object') for (const r of FIGS) { const o = {}; for (const [name, v] of Object.entries(raw.perfs[r] || {})) { const nm = String(name).slice(0, 40); if (nm && v) o[nm] = { lanes: cleanLanes(v.lanes), perfLen: Math.max(0, Math.round(finite(v.perfLen))) }; } S.perfs[r] = o; }
  S.motion = cleanMotion(raw.motion);
  MOOD = cleanMood(raw.mood); if (raw.pads) BANKS = cleanBanks(raw.pads, FIGS); PADRUN = null; S.design = cleanDesign(raw.design, FIGS);
  S.scene = cleanScene(raw.scene, FIGS, DEFAULTS); if (!S.scene.actors.some((a) => a.id === S.sceneSel) && !S.scene.props.some((q) => q.id === S.sceneSel)) S.sceneSel = null;
  S.speech = cleanSpeech(raw.speech); S.mouthPreview = null; if (S.speech) { S.speechDraft = S.speech.text; S.speechStart = S.speech.start; S.speechSpeed = S.speech.speed; }
  S.lanes = cleanLanes(raw.lanes); S.perfLen = Number.isFinite(Number(raw.perfLen)) ? Math.min(MAX_FRAMES, Math.max(0, Math.round(Number(raw.perfLen)))) : 0; S.ver++;
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
/** The longest a performance can be, in frames: ten minutes at 24 frames a second. */
const MAX_FRAMES = 14400;
const figKey = (p = S.p) => (p.rig === 'dog' ? (SPECIES[p.dogSpecies] ? p.dogSpecies : 'dog') : p.model === 'hose' ? 'hose' : 'human');
const wd = (s) => wordsFor(figKey())(s);
const attachList = () => S.attach[figKey()] || (S.attach[figKey()] = []);
const attachItem = (id = S.attachSel) => (id ? attachList().find((a) => a.id === id) || null : null);
/** Every picture some attachment uses, for saving. */
function usedImages() {
  const urls = imageUrls(); const out = {};
  for (const rig of FIGS) for (const a of S.attach[rig] || []) if (a.img && urls[a.img]) out[a.img] = urls[a.img];
  for (const q of S.scene?.props || []) if (q.img && urls[q.img]) out[q.img] = urls[q.img]; // scenery pictures too
  for (const fig of Object.values(S.design || {})) for (const p of Object.values(fig)) if (p.skin?.img && urls[p.skin.img]) out[p.skin.img] = urls[p.skin.img]; // and the skins of the parts
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
    for (const q of S.scene?.props || []) if (q.img) want.add(q.img);
    for (const fig of Object.values(S.design || {})) for (const p of Object.values(fig)) if (p.skin?.img) want.add(p.skin.img);
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
        fill: col(a.fill, '#f2b84b'), stroke: col(a.stroke, '#26231f'), sw: num(a.sw, 2, 0, 12), opacity: num(a.opacity, 0.92, 0, 1), depth: ['back', 'behind', 'front', 'top'].includes(a.depth) ? a.depth : 'front', flip: Boolean(a.flip), bend: Boolean(a.bend), visible: a.visible !== false,
        img: a.kind === 'image' ? String(a.img || '') : null, shadow: cleanShadow(a.shadow), ...(a.ink && a.kind !== 'strip' ? (() => { const k = cleanInk(a.ink); return k ? { ink: k } : {}; })() : {}),
        ...(a.kind === 'strip' ? { phys: cleanPhys(a.phys) } : {}),
      });
    }
  }
  return out;
}
/** Where a new attachment goes: the selected part if it can carry one, otherwise the chest or the mid back. */
function defaultTarget() {
  const rig = S.p.rig; const targets = attachTargets(rig);
  if (S.sel) { const sp = S.sel.part === 'girdle' ? 'arm' : S.sel.part; const t = targets.find((q) => q.part === sp && q.side === (S.sel.side ?? null) && (q.seg ?? 0) === 0); if (t) return t; }
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
    const img = await decodePicture(file);
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
  const fileIn = h('input', { type: 'file', accept: PICTURE_ACCEPT, class: 'sr', tabindex: '-1', 'aria-label': 'Choose a picture to attach', testid: 'attach-file', onChange: (e) => { pickAttachImage(e.target.files?.[0]); e.target.value = ''; } });
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
      seg('Depth', [['back', 'Back'], ['behind', 'Behind'], ['front', 'In front'], ['top', 'Top']], sel.depth, (v) => patchAttach(sel.id, { depth: v }, { panel: true }), 'attach-depth')),
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
    seg('Depth', [['back', 'Back'], ['behind', 'Behind'], ['front', 'In front'], ['top', 'Top']], sel.depth, (v) => patchAttach(sel.id, { depth: v }, { panel: true }), 'attach-depth'),
    h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Flip')), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: sel.flip, testid: 'attach-flip', onChange: (e) => P_({ flip: e.target.checked }) }), h('span', null, 'Flip across the part'))),
    canBend(sel) ? h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Bend')), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: Boolean(sel.bend), testid: 'attach-bend', onChange: (e) => P_({ bend: e.target.checked }, { panel: true }) }), h('span', null, 'Bend over the joint'))) : null,
    canBend(sel) ? h('p', { class: 'hint' }, 'A long picture on the upper leg or upper arm carries on over the knee or elbow and bends with it, instead of staying straight. Make the picture long enough to cross the joint, and turn it so its long side runs along the limb.') : null));
  if (sel.kind !== 'image') {
    host.append(h('section', { class: 'group' }, h('h3', null, 'Look'),
      sel.kind === 'line' ? null : h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Fill')), h('input', { type: 'color', class: 'color', value: sel.fill, 'aria-label': 'Fill colour', testid: 'attach-fill', onInput: (e) => P_({ fill: e.target.value }) })),
      h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Outline')), h('input', { type: 'color', class: 'color', value: sel.stroke, 'aria-label': 'Outline colour', testid: 'attach-stroke', onInput: (e) => P_({ stroke: e.target.value }) })),
      num('Outline width', () => sel.sw, (v) => P_({ sw: v }), 0, 12, 0.5, 'attach-sw'),
      num('Opacity', () => sel.opacity, (v) => P_({ opacity: v }), 0, 1, 0.01, 'attach-opacity')));
  } else host.append(h('section', { class: 'group' }, h('h3', null, 'Look'), num('Opacity', () => sel.opacity, (v) => P_({ opacity: v }), 0, 1, 0.01, 'attach-opacity')));
  { const sh = sel.shadow || (sel.shadow = cleanShadow(null)); const set = (patch, panel = false) => { sel.shadow = { ...sel.shadow, ...patch }; patchAttach(sel.id, { shadow: sel.shadow }, panel ? { panel: true } : undefined); };
    host.append(h('section', { class: 'group', testid: 'attach-shadow' }, h('h3', null, 'Drop shadow'),
      h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Shadow')), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: Boolean(sh.on), testid: 'attach-shadow-on', onChange: (e) => set({ on: e.target.checked }, true) }), h('span', null, sh.on ? 'On' : 'Off'))),
      sh.on ? num('Across', () => sh.x, (v) => set({ x: v }), -40, 40, 1, 'attach-shadow-x') : null, sh.on ? num('Down', () => sh.y, (v) => set({ y: v }), -40, 40, 1, 'attach-shadow-y') : null,
      sh.on ? num('Soft', () => sh.blur, (v) => set({ blur: v }), 0, 40, 1, 'attach-shadow-blur') : null, sh.on ? num('Strength', () => sh.opacity, (v) => set({ opacity: v }), 0, 1, 0.01, 'attach-shadow-opacity') : null,
      sh.on ? h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Colour')), h('input', { type: 'color', class: 'color', value: sh.color, 'aria-label': 'Shadow colour', testid: 'attach-shadow-color', onInput: (e) => set({ color: e.target.value }) })) : null)); }
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
/** Points that are a left and right pair share a key, so the pair sits side by side. */
const pairKey = (id) => id.replace(/\.(R|L)$/, '').replace(/(\.[FH])[RL]$/, '$1');
function arcSection() {
  const rig = S.p.rig === 'dog' ? 'dog' : 'human'; const key = rig === 'dog' ? 'arcsDog' : 'arcs';
  const on = new Set(S.s[key]);
  const symOpen = LAYOUT.expandAll || S.arcSymOpen; // the symmetry choices fold away until you want them
  const toggle = (id, v) => { const s = new Set(S.s[key]); if (v) s.add(id); else s.delete(id); S.s[key] = arcPoints(rig).map((p) => p.id).filter((i) => s.has(i)); if (v && !S.s.showArcs) S.s.showArcs = true; save(); renderPanel(); render(); };
  const pts = arcPoints(rig); const groups = [...new Set(pts.map((p) => p.group))];
  const edit = !P().perf && !P().sampled;
  return h('section', { class: 'group', testid: 'arc-section' }, h('h3', null, 'Arc points'),
    h('p', { class: 'hint' }, edit ? 'Tap points to trace. With Motion arcs on, drag a dot on a path to bend the movement there.' : 'These arcs follow the whole performance. To reshape a movement, switch the performance off and drag the dots on the plain cycle.'),
    h('div', { class: 'seg arcshow', role: 'group', 'aria-label': 'Which arcs to show' },
      h('button', { type: 'button', class: 'segbtn', testid: 'arc-default', 'aria-pressed': 'false', onClick: () => { S.s[key] = DEFAULT_ARCS[rig].slice(); S.s.showArcs = true; save(); renderPanel(); render(); } }, 'Both sides'),
      ...[['R', 'Right'], ['L', 'Left']].map(([sd, lab]) => h('button', { type: 'button', class: 'segbtn', testid: `arc-side-${sd}`, 'aria-pressed': 'false', onClick: () => { S.s[key] = pts.map((p) => p.id).filter((i) => arcSide(i) === sd || (!arcSide(i) && DEFAULT_ARCS[rig].includes(i))); S.s.showArcs = true; save(); renderPanel(); render(); } }, lab)),
      h('button', { type: 'button', class: 'segbtn', testid: 'arc-all', 'aria-pressed': 'false', onClick: () => { S.s[key] = pts.map((p) => p.id); S.s.showArcs = true; save(); renderPanel(); render(); } }, 'All'),
      h('button', { type: 'button', class: 'segbtn', testid: 'arc-none', 'aria-pressed': 'false', onClick: () => { S.s[key] = []; save(); renderPanel(); render(); } }, 'None')),
    h('button', { type: 'button', class: 'btn arcsym-toggle', testid: 'arc-sym-toggle', 'aria-expanded': String(symOpen), onClick: () => { S.arcSymOpen = !S.arcSymOpen; renderPanel(); } }, `Symmetry: ${(SYMMETRY.find(([v]) => v === LAYOUT.arcSym) || SYMMETRY[1])[1]} ${symOpen ? '▴' : '▾'}`),
    symOpen ? h('div', { class: 'arcsym' },
    h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Symmetry')),
      h('div', { class: 'seg', role: 'group', 'aria-label': 'Symmetry between the two sides' }, SYMMETRY.map(([v, t]) => h('button', { type: 'button', class: 'segbtn', testid: `arc-sym-${v}`, 'aria-pressed': String(LAYOUT.arcSym === v), onClick: () => { LAYOUT.arcSym = v; layoutSave(); renderPanel(); } }, t))),
      h('p', { class: 'help' }, 'What the other side does when you drag a dot. Alternate: the same movement half a cycle later, as a walk has it. Mirror: the same movement at the same moment, mirrored left to right, so both hands lift or spread together. Independent: only the side you drag.')),
    h('div', { class: 'btnrow' },
      ...[['R', 'L', 'Copy right to left'], ['L', 'R', 'Copy left to right']].map(([from, to, lab]) => h('button', { type: 'button', class: 'btn', testid: `arc-copy-${from}${to}`, onClick: () => {
        const defs = (S.s[key] || []).map((i) => arcPoint(rig, i)).filter((d) => d && arcSide(d.id) === from);
        const entries = symmetrize({ params: P(), defs: defs.length ? defs : arcPoints(rig).filter((d) => arcSide(d.id) === from), from, mode: LAYOUT.arcSym === 'none' ? 'alt' : LAYOUT.arcSym });
        if (!Object.keys(entries).length) { setMessage('Nothing to copy: tick a point on that side first.'); return; }
        for (const [id, st] of Object.entries(entries)) S.motion[id] = st;
        markCustom(); renderPanel(); render(); save(); setMessage(`The ${to === 'L' ? 'left' : 'right'} side now matches the ${from === 'L' ? 'left' : 'right'}${LAYOUT.arcSym === 'mirror' ? '' : ', half a cycle later'}.`);
      } }, lab)))) : null,
    groups.map((g) => h('div', { class: 'arcgroup' }, h('h4', null, g),
      h('div', { class: 'arcchips' }, pts.filter((p) => p.group === g).sort((a, b) => pairKey(a.id).localeCompare(pairKey(b.id)) || (arcSide(a.id) === 'L' ? 1 : 0) - (arcSide(b.id) === 'L' ? 1 : 0))
        .map((p) => h('button', { type: 'button', class: `pchip arcchip${arcSide(p.id) ? '' : ' solo'}`, testid: `arc-${p.id}`, 'aria-pressed': String(on.has(p.id)), onClick: () => toggle(p.id, !on.has(p.id)) },
          h('span', { class: 'arcsw', style: `background:${arcColor(rig, p.id)}` }), h('span', null, wd(p.label))))))));
}
/** A figure or a piece of scenery from the scene under the finger, to drag along the ground. The main figure and a picture on it win over the scene. */
function sceneDragStart(e, toFrame) {
  const hits = S.last?.sceneHits; const q = toFrame(e.clientX, e.clientY);
  if (!hits?.length || !q || !S.last.camWorld || S.source === 'sampled') return null;
  if (pickPart(S.last.shapes.filter((s) => !s.attach), q.x, q.y) || pickAttachment(q, 'front')) return null;
  const hit = [...hits].reverse().find((h) => pickPart(h.shapes, q.x, q.y)); if (!hit) return null;
  const it = S.scene.actors.find((a) => a.id === hit.id) || S.scene.props.find((p) => p.id === hit.id); if (!it) return null;
  pause();
  return { scene: true, id: it.id, it, x0: it.x, z0: it.z, q0: q, cam: S.last.camWorld, moved: false };
}
/** Moves it so it stays under the finger on the ground. Along the stage is always possible; depth needs a view from above or an angle, since a side view cannot show it. */
function sceneDragMove(d, e, toFrame) {
  if (d.it.locked) return;
  const q = toFrame(e.clientX, e.clientY); if (!q) return;
  const c = d.cam; const o = c.p([d.x0, 0, d.z0]); const ax = c.p([d.x0 + 1, 0, d.z0]); const az = c.p([d.x0, 0, d.z0 + 1]);
  const a11 = ax.x - o.x; const a21 = ax.y - o.y; const a12 = az.x - o.x; const a22 = az.y - o.y; const dx = q.x - d.q0.x; const dy = q.y - d.q0.y;
  const det = a11 * a22 - a12 * a21; let nx = d.x0; let nz = d.z0;
  if (Math.abs(det) > 1e-4 * c.scale * c.scale) { nx += (dx * a22 - dy * a12) / det; nz += (a11 * dy - a21 * dx) / det; } else if (Math.abs(a11) > 1e-6) nx += dx / a11;
  d.it.x = Math.min(12, Math.max(-12, nx)); d.it.z = Math.min(8, Math.max(-8, nz)); d.moved = true;
  S.ver++; render();
}
function sceneDragEnd(d) {
  S.sceneSel = d.id; S.tab = 'Gait'; selectPart(null, { openTab: false });
  if (d.moved) { save(); setMessage('Moved. Along and Depth in the Scene section of the Body tab give the exact place.'); }
  renderPanel();
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
  const r = moveArcPoint({ params: P(), def: d.def, frame: d.frame, curFrame: d.curFrame, target: [q.x, q.y], project: (w) => d.cam.p(w), prop: PROP });
  if (!r) { setMessage('This point cannot be reshaped while a channel on its path runs free.'); return; }
  for (const [id, s] of Object.entries(r.entries)) {
    S.motion[id] = s;
    // With both sides linked the other side follows, half a cycle later, as it does when you edit a curve in the Parts tab.
    const o = LAYOUT.arcSym !== 'none' && CHANNEL_BY_ID[id]?.sided ? otherSide(id) : null;
    if (o && CHANNEL_BY_ID[o]) S.motion[o] = { ...s, pts: otherSideCurve(s.pts, LAYOUT.arcSym) };
  }
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
    const img = await decodePicture(file);
    const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    REF.data = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85); REF.name = file.name.slice(0, 80);
    const i2 = new Image(); await new Promise((res) => { i2.onload = res; i2.src = REF.data; }); REF.img = i2;
    REF.on = true; refSave(); renderPanel(); render(); setMessage('Picture added under the figure. Set where its ground line is, then match its size.');
  } catch (e) { setMessage(e.message); } finally { URL.revokeObjectURL(url); }
}
// ---------- the scene: other figures and scenery ----------
/** The whole parameter set of a walk for a figure, from its preset: the same keys the main figure uses. */
function actorParams(fig, name) {
  const rig = rigOfFig(fig); const preset = presetsForFigure(fig)[name] || presetsForFigure(fig)[Object.keys(presetsForFigure(fig))[0]] || {};
  const { camYaw, camPitch, ...pp } = preset; void camYaw; void camPitch;
  const p = { ...DEFAULTS, ...pp, rig, model: fig === 'hose' ? 'hose' : 'mannequin' };
  if (rig === 'dog') p.dogSpecies = fig;
  p.fps = S.p.fps; p.cycleFrames = S.p.cycleFrames; p.travel = S.p.travel; p.exposure = pp.exposure ?? 1;
  return p;
}
const sceneItem = () => S.scene.actors.find((a) => a.id === S.sceneSel) || S.scene.props.find((q) => q.id === S.sceneSel) || null;
function sceneChanged(panel = false) { S.ver++; if (panel) renderPanel(); render(); save(); }
function addActor(fig) {
  const name = Object.keys(presetsForFigure(fig))[0]; const n = S.scene.actors.length;
  const a = newActor(fig, FIG_LABELS[fig], actorParams(fig, name), fig === 'hose' ? { ...HOSE_PROPORTIONS } : {}, { preset: name, x: 1.3 + n * 0.9, z: n % 2 ? 0.55 : -0.55, phase: (0.25 + 0.2 * n) % 1 });
  S.scene.actors.push(a); S.sceneSel = a.id; sceneChanged(true); setMessage(`${FIG_LABELS[fig]} added behind and beside the main figure. Pick its walk and place it below.`);
}
/** A JPG, PNG or similar from the device, made into a flat piece of scenery that stands on the ground. */
async function pickScenePicture(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  try {
    const img = await decodePicture(file);
    const k = Math.min(1, 1400 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88); // a PNG keeps its transparency, a photo is kept as a JPEG
    const id = freshId(); await registerImage(id, data);
    const asp = c.height / c.width; const w = Math.min(4, Math.max(1.2, 1.5 / Math.max(0.3, asp)));
    const q = newProp('picture', { img: id, asp, w, h: w * asp, name: file.name.replace(/\.[^.]+$/, '').slice(0, 32) || 'Picture', x: 0.9 + S.scene.props.length * 0.5, z: -1.4 });
    S.scene.props.push(q); S.sceneSel = q.id; saveAttachImages(); sceneChanged(true); setMessage('Picture added to the scene. It stands on the ground: set Along, Depth, Raise, Width and Turn, and Cut out the background if it has a plain one.');
  } catch (e) { setMessage(e.message); } finally { URL.revokeObjectURL(url); }
}
/** Makes the plain background of a scenery picture transparent: whatever is close to the colour in its corners goes, with a soft edge. */
async function cutOutBackground(q, tol) {
  const info = imageInfo(q.img); if (!info) return;
  const im = info.img; const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; const g = c.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height); const px = d.data; const w = c.width; const h = c.height;
  const at = (x, y) => { const i = (y * w + x) * 4; return [px[i], px[i + 1], px[i + 2], px[i + 3]]; };
  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)].filter((p) => p[3] > 200);
  if (!corners.length) { setMessage('This picture already has a transparent background.'); return; }
  const key = [0, 1, 2].map((k) => corners.reduce((t, p) => t + p[k], 0) / corners.length);
  const lim = tol * 4.4; const soft = lim * 0.35; let cleared = 0;
  for (let i = 0; i < px.length; i += 4) {
    const dist = Math.hypot(px[i] - key[0], px[i + 1] - key[1], px[i + 2] - key[2]);
    if (dist <= lim) { const a = dist <= lim - soft ? 0 : (dist - (lim - soft)) / soft; px[i + 3] = Math.min(px[i + 3], Math.round(255 * a)); if (a < 0.99) cleared++; }
  }
  g.putImageData(d, 0, 0);
  const data = c.toDataURL('image/png'); const id = freshId(); await registerImage(id, data);
  q.img = id; saveAttachImages(); sceneChanged(true); setMessage(cleared ? `Took out the background (${Math.round((100 * cleared) / (w * h))}% of the picture). Undo brings it back.` : 'Nothing was close enough to the corner colour. Try a higher tolerance.');
}
function addProp(type) { const q = newProp(type, { x: 0.9 + S.scene.props.length * 0.7, z: -0.9 }); S.scene.props.push(q); S.sceneSel = q.id; sceneChanged(true); }
function removeSceneItem(id) { if (findSceneItem(id)?.locked) { setMessage('That one is locked. Unlock it in the Scene list first.'); return; } S.scene.actors = S.scene.actors.filter((a) => a.id !== id); S.scene.props = S.scene.props.filter((q) => q.id !== id); if (S.sceneSel === id) S.sceneSel = null; sceneChanged(true); }
/** Puts a figure's gait, body or colours back to where they started. what: 'gait' | 'body' | 'colours' | 'all'. target: 'main' or a figure in the scene. */
function resetFigure(target, what) {
  if (what === 'all' && typeof confirm === 'function' && !confirm('Reset this figure\'s walk, body and colours?')) return;
  const hoseColours = ['hoseBody', 'hoseFace', 'hoseGlove', 'hoseShoe', 'hoseShorts', 'hoseEyes', 'hoseEars'];
  const doGait = what === 'gait' || what === 'all'; const doBody = what === 'body' || what === 'all'; const doColours = what === 'colours' || what === 'all';
  if (target === 'main') {
    if (doGait) { const names = presetsForFigure(figKey()); applyPreset(names[S.preset] ? S.preset : Object.keys(names)[0]); }
    if (doBody) S.r = figKey() === 'hose' ? { ...HOSE_PROPORTIONS } : {};
    if (doColours) for (const k of ['fillColor', 'lineColor', 'farTint', 'farOpacity', 'fillOpacity', ...hoseColours]) S.s[k] = STYLE_DEFAULTS[k];
    S.ver++; renderPanel(); render(); save(); setMessage(`Reset the ${what === 'all' ? 'figure' : what}.`);
  } else if (target) {
    if (doGait) target.p = actorParams(target.fig, target.preset || Object.keys(presetsForFigure(target.fig))[0]);
    if (doBody) target.r = target.fig === 'hose' ? { ...HOSE_PROPORTIONS } : {};
    if (doColours) { target.fill = ''; target.line = ''; target.tint = ''; }
    sceneChanged(true); setMessage(`Reset ${target.name}.`);
  }
}
const resetMenu = (target) => menuButton({ label: 'Reset', testid: 'fig-reset', title: 'Put this figure\'s walk, body or colours back to where they started', items: () => [
  { label: 'Reset the walk (gait, weight, variety)', testid: 'reset-gait', onClick: () => resetFigure(target, 'gait') },
  { label: 'Reset the body (proportions)', testid: 'reset-body', onClick: () => resetFigure(target, 'body') },
  { label: 'Reset the colours', testid: 'reset-colours', onClick: () => resetFigure(target, 'colours') },
  { separator: true }, { label: 'Reset everything about this figure…', testid: 'reset-fig-all', onClick: () => resetFigure(target, 'all') }] });
// ---------- the pad bank ----------
const padBank = () => (BANKS[figKey()] ||= newBank());
/** Keeps the walk as it is now on a pad. */
function storePad(i, name) {
  const b = padBank(); const w = moodWeights(MOOD.x, MOOD.y); const mix = CORNERS.filter((c) => w[c] > 0.2).map((c) => MOOD.corners[c].name || 'walk').join(' + ');
  b.pads[i] = capturePad(S.p, MOOD, name || (S.preset && S.preset !== 'Custom' ? S.preset : mix || `Walk ${i + 1}`)); b.active = i; PADMODE = 'play';
  save(); renderPanel(); setMessage(`Pad ${i + 1} now holds this walk (${b.pads[i].name}). Tap it to come back to it.`);
}
/** Starts the blend that is waiting: fixes where it begins and switches the choices that cannot be blended. */
function padBegin() {
  const r = PADRUN; if (!r || !r.waiting) return; r.waiting = false; r.done = 0;
  r.from = Object.fromEntries(Object.keys(r.pad.values).map((k) => [k, typeof S.p[k] === 'number' ? S.p[k] : r.pad.values[k]]));
  r.dur = blendFrames(padBank(), S.p.cycleFrames);
  if (r.rec) { for (const k of Object.keys(r.pad.values)) if (k !== 'cycleFrames' && k in DEFAULTS && Math.abs(r.from[k] - r.pad.values[k]) > 1e-9) rec.touch(targetOfParam(k), S.frame, r.from[k], { hold: true }); // a pad is a change of walk: it holds to the end of the performance, in Touch and in Latch
    // Its pace too: a take keeps one cycle length, so a quicker or slower walk is written as the speed lane. Speed 2 is a cycle in half the frames.
    const n0 = Math.max(2, Math.round(S.p.cycleFrames)); const live = rec.liveValues()[CADENCE]; r.cadFrom = live ?? laneValue(S.lanes[CADENCE], S.frame, 1); r.cadTo = Math.min(4, Math.max(0.1, n0 / Math.max(2, r.pad.values.cycleFrames ?? n0)));
    if (Math.abs(r.cadTo - r.cadFrom) > 1e-6) rec.touch(CADENCE, S.frame, r.cadFrom, { hold: true }); else r.cadTo = r.cadFrom; }
  else { for (const [k, v] of Object.entries(r.pad.flags || {})) if (k in S.p && typeof S.p[k] === typeof v) S.p[k] = v; MOOD.x = 0.5; MOOD.y = 0.5; MOOD.base = null; markCustom(); }
  if (r.dur <= 0) padFinish();
}
/** One frame of a blend. While it waits for the end of the cycle it only watches for the cycle to come round. */
function padStep() {
  const r = PADRUN; if (!r) return;
  if (r.waiting) { const n = Math.max(2, Math.round(S.p.cycleFrames)); if (S.frame % n !== 0) return; padBegin(); if (!PADRUN) return; }
  r.done++;
  padApply(transitionValues(r.from, r.pad.values, r.done / Math.max(1, r.dur)));
  if (r.done >= r.dur) padFinish();
}
function padApply(vals, r = PADRUN) {
  if (r?.rec) { for (const [k, v] of Object.entries(vals)) if (k !== 'cycleFrames' && k in DEFAULTS && Math.abs((r.from[k] ?? v) - r.pad.values[k]) > 1e-9) rec.set(targetOfParam(k), S.frame, v);
    if (r.cadTo !== r.cadFrom) rec.set(CADENCE, S.frame, transitionValues({ c: r.cadFrom }, { c: r.cadTo }, r.dur > 0 ? Math.min(1, r.done / r.dur) : 1).c);
    return; } // while recording, the blend is written into the take
  const before = Math.max(2, Math.round(S.p.cycleFrames));
  for (const [k, v] of Object.entries(vals)) if (typeof S.p[k] === 'number') S.p[k] = P_CONTROL[k]?.type === 'number' ? clampTo(P_CONTROL[k], v) : v;
  const now = Math.max(2, Math.round(S.p.cycleFrames)); S.ver++;
  if (now !== before && S.perfLen <= 0) { S.frame = Math.min(now - 1, Math.round((S.frame / before) * now)); buildStrip(); } // the same place in the step, in a cycle of another length
}
function padFinish(quiet = false) {
  const r = PADRUN; if (!r) return; PADRUN = null; stopPadPump();
  if (r.waiting) { if (!quiet) renderPanel(); return; }
  if (r.rec) { padBank().active = r.idx; }
  else { padApply(transitionValues({}, r.pad.values, 1), r); if (r.pad.mood) MOOD = cleanMood(r.pad.mood); padBank().active = r.idx; refreshGaitLine(); }
  if (!quiet) { save(); renderPanel(); render(); }
}
/** A tap on a pad: store the walk on it, clear it, or blend to the walk it holds. */
function triggerPad(i) {
  const b = padBank(); if (i < 0 || i >= PAD_COUNT) return;
  if (PADMODE === 'clear') { b.pads[i] = null; if (b.active === i) b.active = null; PADMODE = 'play'; save(); renderPanel(); return; }
  if (PADMODE === 'store' || !b.pads[i]) { storePad(i); return; }
  if (PADRUN) padFinish(true);
  const recording = recOn();
  PADRUN = { idx: i, pad: b.pads[i], waiting: true, rec: recording, done: 0, dur: 0, from: {} };
  if (b.when === 'cycle' && S.playing && S.frame % Math.max(2, Math.round(S.p.cycleFrames)) !== 0) { renderPanel(); setMessage(`Pad ${i + 1} (${b.pads[i].name}) starts when this cycle ends.`); return; }
  padBegin();
  if (PADRUN && !S.playing) startPadPump(); // paused: the blend still plays out, on its own clock
  renderPanel(); render();
}
let padRaf = 0; let padLast = 0; let padAcc = 0;
function stopPadPump() { if (padRaf) cancelAnimationFrame(padRaf); padRaf = 0; }
function startPadPump() {
  stopPadPump(); padLast = performance.now(); padAcc = 0;
  const loop = (t) => { if (!PADRUN || S.playing) { padRaf = 0; return; } padAcc += t - padLast; padLast = t; const per = 1000 / S.p.fps; let moved = false;
    while (padAcc >= per && PADRUN) { padAcc -= per; if (PADRUN.waiting) padBegin(); else padStep(); moved = true; }
    if (moved) render(); padRaf = PADRUN ? requestAnimationFrame(loop) : 0; };
  padRaf = requestAnimationFrame(loop);
}
function savePadBank() {
  const b = padBank(); const n = typeof prompt === 'function' ? prompt('Name this bank', b.name) : b.name; const name = fileSafe(n); if (!name) return; b.name = name;
  deliver(new Blob([JSON.stringify({ format: 'walk-base-pad-bank', version: 1, figure: figKey(), bank: b }, null, 1)], { type: 'application/json' }), `${name}.padbank.json`).then(() => { save(); renderPanel(); setMessage(`Saved the bank as ${name}.padbank.json.`); });
}
async function loadPadBank(e) {
  const f = e.target.files?.[0]; if (!f) return;
  try {
    const raw = JSON.parse(await f.text()); if (raw.format !== 'walk-base-pad-bank') throw new Error('This is not a Walk Base pad bank.');
    if (rigOfFig(raw.figure) !== rigOfFig(figKey())) throw new Error(`This bank is for the ${FIG_LABELS[raw.figure] || raw.figure}. Choose that figure first.`);
    if (PADRUN) padFinish(true); BANKS[figKey()] = cleanBank(raw.bank); BANKS[figKey()].active = null; save(); renderPanel(); setMessage(`Loaded the bank ${BANKS[figKey()].name}.`);
  } catch (err) { setMessage(`Could not load it: ${err.message}`); }
  e.target.value = '';
}
function padSection() {
  const b = padBank(); const filled = b.pads.filter(Boolean).length;
  const seg = (items, cur, on, tid) => h('div', { class: 'seg', role: 'group' }, items.map(([v, label]) => h('button', { type: 'button', class: 'segbtn', 'aria-pressed': String(cur === v), testid: `${tid}-${v}`, onClick: () => on(v) }, label)));
  const fileIn = h('input', { type: 'file', accept: '.json,application/json', class: 'sr', tabindex: '-1', 'aria-label': 'Load a pad bank', testid: 'pad-load-file', onChange: loadPadBank });
  const grid = h('div', { class: `padgrid${PADMODE === 'store' ? ' storing' : PADMODE === 'clear' ? ' clearing' : ''}`, role: 'group', 'aria-label': 'Pads', testid: 'pad-grid' }, b.pads.map((p, i) => {
    const queued = PADRUN?.idx === i && PADRUN.waiting; const going = PADRUN?.idx === i && !PADRUN.waiting;
    return h('button', { type: 'button', class: `padbtn${p ? '' : ' empty'}${queued ? ' queued' : ''}${going ? ' going' : ''}`, 'aria-pressed': String(b.active === i && !PADRUN), testid: `pad-${i + 1}`,
      'aria-label': p ? `Pad ${i + 1}: ${p.name}${queued ? ', waiting for the end of the cycle' : ''}` : `Pad ${i + 1}, empty. Tap to keep this walk on it`, onClick: () => triggerPad(i) },
      h('small', null, String(i + 1)), h('span', null, p ? p.name : 'empty'));
  }));
  const act = b.active != null && b.pads[b.active] ? b.pads[b.active] : null;
  return h('section', { class: 'group', 'data-area': 'Gait', testid: 'pad-section' }, h('h3', null, filled ? `Pads (${filled})` : 'Pads'), fileIn,
    grid,
    h('p', { class: 'hint', testid: 'pad-hint' }, PADMODE === 'store' ? 'Tap one of the flashing pads to keep the walk as it is now on it. Store again cancels.' : PADMODE === 'clear' ? 'Tap one of the flashing pads to empty it. Clear again cancels.' : filled ? 'Tap a pad to change to its walk. End of cycle waits for the first frame. With Rec on, the change and its pace are written into the take and hold to its end.' : 'Set up a walk (a preset, the sliders, the mood pad), then tap an empty pad to keep it there. Do the same for other walks, and tap between them while it plays.'),
    h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Change')), seg([['now', 'Now'], ['cycle', 'End of cycle']], b.when, (v) => { b.when = v; save(); renderPanel(); }, 'pad-when')),
    h('div', { class: 'row noreset row-enum' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Blend over'), h('span', { class: 'unit' }, 'cycles')), seg(BLENDS, b.blend, (v) => { b.blend = v; save(); renderPanel(); }, 'pad-blend')),
    act ? h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, `Pad ${b.active + 1} name`), h('input', { type: 'text', class: 'txt', value: act.name, maxlength: 24, 'aria-label': 'Name of this pad', testid: 'pad-name', onChange: (e) => { act.name = e.target.value.slice(0, 24) || act.name; save(); renderPanel(); } })) : null,
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn', 'aria-pressed': String(PADMODE === 'store'), testid: 'pad-store', title: 'Then tap a pad: the walk as it is now is kept on it', onClick: () => { PADMODE = PADMODE === 'store' ? 'play' : 'store'; renderPanel(); } }, 'Store'),
      h('button', { type: 'button', class: 'btn', 'aria-pressed': String(PADMODE === 'clear'), testid: 'pad-clear', title: 'Then tap a pad to empty it', onClick: () => { PADMODE = PADMODE === 'clear' ? 'play' : 'clear'; renderPanel(); } }, 'Clear'),
      h('button', { type: 'button', class: 'btn', testid: 'pad-save', disabled: !filled, onClick: savePadBank }, 'Save bank'),
      h('button', { type: 'button', class: 'btn', testid: 'pad-load', onClick: () => fileIn.click() }, 'Load bank')));
}
// ---------- the mood pad ----------
const P_CONTROL = Object.fromEntries(CONTROLS.filter((c) => c.scope === 'p').map((c) => [c.id, c]));
const moodLimit = (k, v) => (P_CONTROL[k]?.type === 'number' ? clampTo(P_CONTROL[k], v) : v);
const moodPresets = () => presetsForFigure(figKey());
/** Puts the dot at x, y (0 to 1 each) and sets the walk to the mix there. The middle is the walk as it was before the pad was touched. */
function setMoodPad(x, y, { commit = true } = {}) {
  const nx = Math.min(1, Math.max(0, x)); const ny = Math.min(1, Math.max(0, y));
  if (recOn()) { // while recording, the dot's path is written into the take as automation; the walk underneath is left as it is
    const base = Object.fromEntries(Object.entries(S.p).filter(([, v]) => typeof v === 'number'));
    MOOD.x = nx; MOOD.y = ny;
    const vals = blendMood(MOOD, base, DEFAULTS, S.p.rig, moodPresets(), moodLimit);
    for (const [k, v] of Object.entries(vals)) { if (k === 'cycleFrames' || !(k in DEFAULTS)) continue; const t = targetOfParam(k); if (!MOODREC.has(k)) { if (Math.abs(v - base[k]) < 1e-9) continue; MOODREC.add(k); rec.touch(t, S.frame, base[k]); } rec.set(t, S.frame, v); }
    if (commit) { for (const k of MOODREC) rec.release(targetOfParam(k), S.frame); MOODREC.clear(); if (S.recMode === 'touch') { MOOD.x = 0.5; MOOD.y = 0.5; } renderPanel(); }
    render(); return;
  }
  if (!MOOD.base) { if (Math.abs(nx - 0.5) < 1e-6 && Math.abs(ny - 0.5) < 1e-6) { MOOD.x = 0.5; MOOD.y = 0.5; return; } MOOD.base = Object.fromEntries(Object.entries(S.p).filter(([, v]) => typeof v === 'number')); }
  MOOD.x = nx; MOOD.y = ny;
  const before = S.p.cycleFrames;
  Object.assign(S.p, blendMood(MOOD, MOOD.base, DEFAULTS, S.p.rig, moodPresets(), moodLimit));
  if (moodWeights(nx, ny).strength <= 1e-9) MOOD.base = null; // back in the middle: the walk is its own again
  markCustom(); S.ver++;
  if (S.p.cycleFrames !== before) { if (S.perfLen <= 0) buildStrip(); if (S.frame >= cycleFrames(P()).frames.length) S.frame = 0; }
  refreshGaitLine(); render(); if (commit) { save(); renderPanel(); }
}
function moodSection() {
  const rig = S.p.rig; const moods = Object.keys(moodsFor(rig)); const presets = Object.keys(moodPresets());
  const nameOf = (c) => (c.kind === 'custom' ? (c.name || 'Captured walk') : c.name);
  const dot = h('span', { class: 'mdot', testid: 'mood-dot', style: `left:${MOOD.x * 100}%;top:${MOOD.y * 100}%` });
  const place = (e, commit) => { const r = pad.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height; setMoodPad(x, y, { commit }); dot.style.left = `${MOOD.x * 100}%`; dot.style.top = `${MOOD.y * 100}%`; };
  let dragging = false;
  const pad = h('div', { class: 'moodpad', testid: 'mood-pad', role: 'application', tabindex: '0', 'aria-label': `Mood pad. Top left ${nameOf(MOOD.corners.tl)}, top right ${nameOf(MOOD.corners.tr)}, bottom left ${nameOf(MOOD.corners.bl)}, bottom right ${nameOf(MOOD.corners.br)}. Arrow keys move the dot.`,
    onPointerdown: (e) => { dragging = true; try { pad.setPointerCapture(e.pointerId); } catch { /* no capture */ } place(e, false); e.preventDefault(); },
    onPointermove: (e) => { if (dragging) place(e, false); },
    onPointerup: (e) => { if (!dragging) return; dragging = false; place(e, true); },
    onPointercancel: () => { if (dragging) { dragging = false; save(); renderPanel(); } },
    onKeydown: (e) => { const d = { ArrowLeft: [-0.05, 0], ArrowRight: [0.05, 0], ArrowUp: [0, -0.05], ArrowDown: [0, 0.05] }[e.key]; if (!d) return; e.preventDefault(); setMoodPad(MOOD.x + d[0], MOOD.y + d[1]); document.querySelector('[data-testid="mood-pad"]')?.focus(); } },
    ...CORNERS.map((c) => h('span', { class: `mlab m-${c}` }, nameOf(MOOD.corners[c]))), h('span', { class: 'mcross' }), dot);
  const setCorner = (c, value) => {
    const [kind, ...rest] = value.split(':'); const name = rest.join(':');
    if (kind === 'custom') return; MOOD.corners[c] = { kind, name };
    if (MOOD.base) setMoodPad(MOOD.x, MOOD.y); else { save(); renderPanel(); }
  };
  const cornerSelect = (c) => { const cur = MOOD.corners[c]; const val = cur.kind === 'custom' ? 'custom' : `${cur.kind}:${cur.name}`;
    return h('label', { class: 'mcorner' }, h('span', null, CORNER_LABELS[c]), h('select', { class: 'select', 'aria-label': `${CORNER_LABELS[c]} corner`, testid: `mood-corner-${c}`, onChange: (e) => setCorner(c, e.target.value) },
      cur.kind === 'custom' ? h('option', { value: 'custom', selected: true }, nameOf(cur)) : null,
      h('optgroup', { label: 'Moods' }, moods.map((m) => h('option', { value: `mood:${m}`, selected: val === `mood:${m}` }, m))),
      h('optgroup', { label: 'This figure\'s walks' }, presets.map((m) => h('option', { value: `preset:${m}`, selected: val === `preset:${m}` }, m))))); };
  const capture = (c) => { // the walk as it is now becomes a corner: every setting that differs from the walk in the middle (or from a plain walk, if the pad is in the middle)
    const ref = MOOD.base || DEFAULTS; const values = {};
    for (const [k, v] of Object.entries(S.p)) if (typeof v === 'number' && typeof ref[k] === 'number' && Math.abs(v - ref[k]) > 1e-9 && !['fps', 'exposure', 'noiseSeed'].includes(k)) values[k] = v;
    if (!Object.keys(values).length) { setMessage('This walk is the same as the one in the middle of the pad, so there is nothing to put in a corner. Change some sliders first.'); return; }
    MOOD.corners[c] = { kind: 'custom', name: S.preset && S.preset !== 'Custom' ? `${S.preset} (captured)` : 'Captured walk', values };
    if (MOOD.base) setMoodPad(0.5, 0.5); else { save(); renderPanel(); }
    setMessage(`The ${CORNER_LABELS[c].toLowerCase()} corner is now this walk (${Object.keys(values).length} settings). The pad is back in the middle.`);
  };
  const base = MOOD.base || Object.fromEntries(Object.entries(S.p).filter(([, v]) => typeof v === 'number'));
  const keys = moodKeys(MOOD, base, DEFAULTS, rig, moodPresets());
  const w = moodWeights(MOOD.x, MOOD.y); const parts = CORNERS.filter((c) => w[c] > 0.005).map((c) => `${Math.round(w[c] * 100)}% ${nameOf(MOOD.corners[c])}`);
  return h('section', { class: 'group', 'data-area': 'Gait', testid: 'mood-section' }, h('h3', null, 'Mood'),
    h('div', { class: 'moodrow' }, pad, h('div', { class: 'moodside' }, CORNERS.map(cornerSelect))),
    h('p', { class: 'hint', testid: 'mood-readout' }, parts.length ? `Now: ${parts.join(', ')}.` : 'In the middle: the walk as it is. Drag the dot toward a corner for that mood, or along an edge to mix two.'),
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn', testid: 'mood-centre', onClick: () => setMoodPad(0.5, 0.5) }, 'Centre'),
      menuButton({ label: 'Use this walk as a corner', testid: 'mood-capture', title: 'Put the walk as it is now into a corner of the pad', items: () => CORNERS.map((c) => ({ label: CORNER_LABELS[c], testid: `mood-capture-${c}`, onClick: () => capture(c) })) })),
    h('details', { class: 'moodkeys', testid: 'mood-keys' }, h('summary', null, `What the pad moves (${keys.filter((k) => !MOOD.skip.includes(k)).length} of ${keys.length} settings)`),
      h('p', { class: 'hint' }, 'Untick a setting to leave it out: the pad will not touch it, whatever the corners say.'),
      h('div', { class: 'moodlist' }, keys.map((k) => h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: !MOOD.skip.includes(k), testid: `mood-key-${k}`, onChange: (e) => { MOOD.skip = e.target.checked ? MOOD.skip.filter((x) => x !== k) : [...MOOD.skip, k]; if (MOOD.base) setMoodPad(MOOD.x, MOOD.y); else { save(); renderPanel(); } } }), h('span', null, wordsFor(figKey())(P_CONTROL[k]?.label || k)))))));
}
function sceneSection() {
  const host = h('div', { testid: 'scene-section' });
  const addFig = menuButton({ label: 'Add figure', testid: 'scene-add-figure', items: () => FIG_GROUPS.flatMap(([, list], i) => [...(i ? [{ separator: true }] : []), ...list.map((f) => ({ label: FIG_LABELS[f], testid: `scene-add-${f}`, onClick: () => addActor(f) }))]) });
  const sceneFile = h('input', { type: 'file', accept: PICTURE_ACCEPT, class: 'sr', tabindex: '-1', 'aria-label': 'Choose a picture for the scene', testid: 'scene-picture-file', onChange: (e) => { pickScenePicture(e.target.files?.[0]); e.target.value = ''; } });
  const addPr = menuButton({ label: 'Add scenery', testid: 'scene-add-prop', items: () => PROP_KINDS.map((k) => ({ label: k.label, testid: `scene-prop-${k.id}`, onClick: () => (k.kind === 'image' ? sceneFile.click() : addProp(k.id)) })) });
  host.append(sceneFile);
  // The list is the layers: the nearest at the top, the furthest at the bottom, so up brings one forward and down sends it back.
  const rows = [{ id: 'main', label: `${FIG_LABELS[figKey()]} (main)`, kind: 'figure', main: true, z: 0, visible: true, locked: false }, ...S.scene.actors.map((a) => ({ id: a.id, label: `${a.name} (${a.preset || 'walk'})`, kind: 'figure', z: a.z, visible: a.visible, locked: a.locked })), ...S.scene.props.map((q) => ({ id: q.id, label: q.name, kind: 'scenery', z: q.z, visible: q.visible, locked: q.locked }))].sort((a, b) => b.z - a.z);
  const layerStep = (id, dz) => { const it = findSceneItem(id); if (!it || it.locked) return; it.z = Math.max(-8, Math.min(8, Math.round((it.z + dz) * 100) / 100)); sceneChanged(true); };
  const layerFlag = (id, k) => { const it = findSceneItem(id); if (!it) return; it[k] = !it[k]; sceneChanged(true); };
  host.append(h('section', { class: 'group', 'data-area': 'Scene' }, h('h3', null, rows.length > 1 ? `Scene (${rows.length - 1})` : 'Scene'),
    h('div', { class: 'btnrow' }, addFig, addPr),
    rows.length === 1 ? h('p', { class: 'hint' }, 'Add more figures, each with its own walk and colours, and scenery to stand them in. Tap a figure on the stage to select it, or press and hold (right-click on a mouse) for a menu.') : null,
    rows.length ? h('div', { class: 'scene-list', role: 'listbox', 'aria-label': 'Scene items' }, rows.map((r) => h('div', { class: 'scene-line' },
      h('button', { type: 'button', class: 'scene-row', role: 'option', 'aria-selected': String(r.id === S.sceneSel), testid: `scene-item-${r.id}`, onClick: () => { S.sceneSel = r.id; renderPanel(); } }, h('span', { class: r.visible ? '' : 'dim' }, r.label), h('small', null, r.kind)),
      r.main ? null : h('button', { type: 'button', class: 'btn icon', 'aria-label': `${r.visible ? 'Hide' : 'Show'} ${r.label}`, 'aria-pressed': String(!r.visible), title: r.visible ? 'Hide' : 'Show', testid: `scene-eye-${r.id}`, onClick: () => layerFlag(r.id, 'visible') }, icon(r.visible ? 'eye' : 'eyeoff', 14)),
      r.main ? null : h('button', { type: 'button', class: 'btn icon', 'aria-label': `${r.locked ? 'Unlock' : 'Lock'} ${r.label}`, 'aria-pressed': String(Boolean(r.locked)), title: r.locked ? 'Unlock' : 'Lock: it cannot be dragged or removed', testid: `scene-lock-${r.id}`, onClick: () => layerFlag(r.id, 'locked') }, icon(r.locked ? 'lock' : 'unlock', 14)),
      r.main ? null : h('button', { type: 'button', class: 'btn icon', 'aria-label': `Bring ${r.label} forward`, title: 'Bring forward', testid: `scene-fwd-${r.id}`, onClick: () => layerStep(r.id, 0.3) }, icon('up', 14)),
      r.main ? null : h('button', { type: 'button', class: 'btn icon', 'aria-label': `Send ${r.label} back`, title: 'Send back', testid: `scene-back-${r.id}`, onClick: () => layerStep(r.id, -0.3) }, icon('down', 14)),
      r.main ? null : h('button', { type: 'button', class: 'btn icon scene-del', 'aria-label': `Remove ${r.label}`, title: 'Remove', testid: `scene-del-${r.id}`, onClick: () => removeSceneItem(r.id) }, icon('close', 14))))) : h('p', { class: 'hint' }, 'Add more figures, each with its own walk, and scenery to stand them in. Tap a figure on the stage to select it.')));
  if (S.sceneSel === 'main') {
    const set1 = (k, v) => { S.s[k] = v; render(); save(); };
    const c1 = (label, k, tid) => h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, label)), h('input', { type: 'color', class: 'color', value: S.s[k], 'aria-label': label, testid: tid, onInput: (e) => set1(k, e.target.value) }));
    host.append(h('section', { class: 'group', 'data-area': 'Scene' }, h('h3', null, 'This figure'), c1('Fill colour', 'fillColor', 'main-fill'), c1('Line colour', 'lineColor', 'main-line'), c1('Far-side tint', 'farTint', 'main-tint'), h('div', { class: 'btnrow' }, resetMenu('main')),
      h('p', { class: 'hint' }, 'The main figure keeps its colours with the stage settings. The other figures in the scene each have their own.')));
    return host;
  }
  const it = sceneItem(); if (!it) return host;
  const actor = S.scene.actors.includes(it);
  const set = (patch, panel = false) => { Object.assign(it, patch); sceneChanged(panel); };
  const row = (label, key, min, max, step, tid) => h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, label),
    h('input', { type: 'range', class: 'rng', min, max, step, value: it[key], testid: tid, 'aria-label': label, onInput: (e) => { set({ [key]: Number(e.target.value) }); const n = e.target.parentElement.querySelector('.num'); if (n) n.value = e.target.value; } }),
    h('input', { type: 'number', class: 'num', min, max, step, value: it[key], 'aria-label': `${label} value`, onChange: (e) => { set({ [key]: Math.min(max, Math.max(min, Number(e.target.value))) }, true); } }));
  const colour = (label, key, tid) => h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, label)), h('input', { type: 'color', class: 'color', value: it[key] || '#d9d4c7', 'aria-label': label, testid: tid, onInput: (e) => set({ [key]: e.target.value }) }));
  const body = [h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Name'), h('input', { type: 'text', class: 'txt', value: it.name, maxlength: 40, 'aria-label': 'Name', testid: 'scene-name', onChange: (e) => { it.name = e.target.value.slice(0, 40) || it.name; sceneChanged(true); } }))];
  if (actor) {
    const presets = Object.keys(presetsForFigure(it.fig));
    body.push(h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Walk'), h('select', { class: 'select', 'aria-label': 'Walk', testid: 'scene-preset', onChange: (e) => { it.preset = e.target.value; it.p = actorParams(it.fig, it.preset); sceneChanged(true); } }, presets.map((n) => h('option', { value: n, selected: n === it.preset }, n)))),
      row('Along', 'x', -6, 6, 0.05, 'scene-x'), row('Depth', 'z', -4, 4, 0.05, 'scene-z'), row('Facing', 'yaw', -180, 180, 1, 'scene-yaw'), row('Size', 'scale', 0.3, 2.5, 0.01, 'scene-scale'), row('Starts at', 'phase', 0, 1, 0.01, 'scene-phase'),
      colour('Fill colour', 'fill', 'scene-fill'), colour('Line colour', 'line', 'scene-line'), colour('Far-side tint', 'tint', 'scene-tint'),
      h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'scene-colour-reset', onClick: () => set({ fill: '', line: '', tint: '' }, true) }, 'Use the colours from the View tab')),
      h('p', { class: 'hint' }, 'Depth: negative is further back, positive is nearer to you in the side view. Facing 180 walks the other way. Starts at moves the figure round its own cycle, so two figures are not in step. Each figure has its own colours; the ones for the main figure are in the View tab.'));
  } else {
    const isPic = it.kind === 'image'; const isLine = it.kind === 'ltree' || it.kind === 'lpine' || it.kind === 'lbush';
    body.push(row('Along', 'x', -8, 8, 0.05, 'scene-x'), row('Depth', 'z', -5, 5, 0.05, 'scene-z'), row('Raise', 'y', -1, 5, 0.05, 'scene-y'), row('Turn', 'rot', -180, 180, 1, 'scene-rot'),
      isPic ? h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Width'), h('input', { type: 'range', class: 'rng', min: 0.2, max: 10, step: 0.05, value: it.w, testid: 'scene-w', 'aria-label': 'Width', onInput: (e) => { it.w = Number(e.target.value); it.h = it.w * it.asp; sceneChanged(false); const n = e.target.parentElement.querySelector('.num'); if (n) n.value = e.target.value; } }), h('input', { type: 'number', class: 'num', min: 0.2, max: 10, step: 0.05, value: it.w, 'aria-label': 'Width value', onChange: (e) => { it.w = Math.min(10, Math.max(0.2, Number(e.target.value))); it.h = it.w * it.asp; sceneChanged(true); } }))
        : row(it.kind === 'ball' || it.kind === 'cylinder' || it.kind === 'lamp' || isLine ? 'Width' : 'Length', 'w', 0.05, 6, 0.01, 'scene-w'),
      it.kind === 'box' ? row('Depth of it', 'd', 0.05, 4, 0.01, 'scene-d') : null, isPic ? null : row('Height', 'h', 0.05, 5, 0.01, 'scene-h'), isPic ? null : colour(isLine ? 'Leaf colour' : 'Colour', 'color', 'scene-color'),
      isPic ? h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Flip')), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: Boolean(it.flip), testid: 'scene-flip', onChange: (e) => { it.flip = e.target.checked; sceneChanged(true); } }), h('span', null, 'Mirror it'))) : null,
      isPic ? h('div', { class: 'btnrow' }, h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Tolerance'), h('input', { type: 'range', class: 'rng', min: 5, max: 80, step: 1, value: S.cutTol ?? 30, testid: 'scene-cut-tol', 'aria-label': 'How close to the corner colour counts as background', onInput: (e) => { S.cutTol = Number(e.target.value); } })), h('button', { type: 'button', class: 'btn', testid: 'scene-cut', onClick: () => cutOutBackground(it, S.cutTol ?? 30) }, 'Cut out the background')) : null);
  }
  if (!actor && (it.kind === 'box' || it.kind === 'ball')) { // scenery that falls, bounces, rolls or is pushed over
    const modes = PHYS_MODES.filter(([id]) => id !== 'tip' || it.kind === 'box'); const mode = modes.some(([id]) => id === it.phys) ? it.phys : 'none';
    const last = Math.max(1, (S.perfLen > 0 ? S.perfLen : Math.round(S.p.cycleFrames)) - 1);
    body.push(h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Physics'), h('select', { class: 'select', 'aria-label': 'Physics', testid: 'scene-phys', onChange: (e) => { it.phys = e.target.value; if (it.phys === 'drop' && it.y < 0.05 && !it.throwX) { it.y = 1.5; setMessage('Raised it to 1.5 so it has somewhere to fall from. Set Raise for the height and Throw to send it along.'); } sceneChanged(true); } }, modes.map(([id, label]) => h('option', { value: id, selected: id === mode }, label)))));
    if (mode !== 'none') body.push(row('Starts at frame', 'physStart', 0, last, 1, 'scene-phys-start'), row('Bounce', 'bounce', 0, 0.95, 0.01, 'scene-bounce'),
      mode === 'drop' ? row('Friction', 'friction', 0, 1, 0.01, 'scene-friction') : null,
      mode === 'drop' ? row('Throw', 'throwX', -8, 8, 0.1, 'scene-throw') : row('Push', 'push', -3, 3, 0.05, 'scene-push'),
      h('p', { class: 'hint' }, mode === 'drop' ? 'It falls from its Raise height at that frame, bounces and comes to rest. Throw is its speed along the ground in metres a second (negative goes the other way); a ball rolls on, a box scrapes to a stop. The same settings always give the same motion. It starts again when the cycle does, so use a performance for a longer take.'
        : 'At that frame it is pushed over about its bottom edge. Push 1 is just enough to bring it to the point of balance: less and it rocks back, more and it goes over and lands on its side. Negative pushes it the other way.'));
  }
  body.push(h('div', { class: 'btnrow' }, ...(actor ? [resetMenu(it)] : []),
    h('button', { type: 'button', class: 'btn', testid: 'scene-shadow', 'aria-pressed': String(!it.noShadow), title: 'Whether this one casts a shadow when shadows are on in the View tab', onClick: () => set({ noShadow: !it.noShadow }, true) }, it.noShadow ? 'No shadow' : 'Casts shadow'),
    h('button', { type: 'button', class: 'btn', testid: 'scene-hide', onClick: () => set({ visible: !it.visible }, true) }, it.visible ? 'Hide' : 'Show'),
    h('button', { type: 'button', class: 'btn', testid: 'scene-copy', onClick: () => { const c = JSON.parse(JSON.stringify(it)); c.id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; c.name = `${it.name} copy`; c.x += 0.8; (actor ? S.scene.actors : S.scene.props).push(c); S.sceneSel = c.id; sceneChanged(true); } }, 'Copy'),
    h('button', { type: 'button', class: 'btn', testid: 'scene-remove', onClick: () => removeSceneItem(it.id) }, 'Remove')));
  host.append(h('section', { class: 'group' }, h('h3', null, actor ? 'This figure' : 'This scenery'), body));
  return host;
}
function refSection() {
  const set = (k, v) => { REF[k] = v; refSave(); render(); };
  const slider = (label, key, min, max, step, tid) => h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, label),
    h('input', { type: 'range', class: 'rng', min, max, step, value: REF[key], testid: tid, 'aria-label': label, onInput: (e) => { set(key, Number(e.target.value)); const n = e.target.parentElement.querySelector('.num'); if (n) n.value = e.target.value; } }),
    h('input', { type: 'number', class: 'num', min, max, step, value: REF[key], 'aria-label': `${label} value`, onChange: (e) => { set(key, Math.min(max, Math.max(min, Number(e.target.value)))); renderPanel(); } }));
  const has = Boolean(REF.img);
  return h('section', { class: 'group', testid: 'ref-section' }, h('h3', null, 'Reference picture'),
    h('p', { class: 'hint' }, 'Put a photo, a frame of footage or one of your drawings under the figure to line it up. Tap where its feet touch the ground with Ground line, then match Size.'),
    h('div', { class: 'btnrow' }, h('label', { class: 'btn file-btn' }, has ? 'Replace picture' : 'Add picture', h('input', { type: 'file', accept: PICTURE_ACCEPT, class: 'file-input', 'aria-label': 'Choose a reference picture', testid: 'ref-file', onChange: (e) => { pickRef(e.target.files?.[0]); e.target.value = ''; } })),
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
  const info = drawScene(frameCanvas.getContext('2d'), P(), S.s, fcw, fch, S.frame, { selection: S.tab === 'Draw' ? null : S.sel, mouth: S.mouthPreview, under: refPaint, handles: S.attachSel, fix: S.fixMode && S.sel ? true : false, wantFrames: S.tab === 'Design' || S.tab === 'Draw' });
  stage.style.cursor = S.tab === 'Draw' ? 'crosshair' : '';
  if (S.tab === 'Draw' && S.draw.guides) paintDrawGuides(frameCanvas.getContext('2d'), info, fcw);
  const x0 = (cw - zw) / 2 + S.panX * d; const y0 = (ch - zh) / 2 + S.panY * d;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; ctx.fillRect(x0, y0, zw, zh);
  ctx.drawImage(frameCanvas, x0, y0, zw, zh);
  paintFaceInset(ctx, cw, ch);
  S.last = info; S.map = { x0, y0, zw, zh, fcw, fch, d, left: r.left, top: r.top };
  if (S.tab === 'Draw') { const sig = `${inkTid()}:${inkPartKeys().length}`; if (sig !== lastInkSig) { lastInkSig = sig; renderPanel(); } } // the list of parts to draw on is known once the stage has drawn them
  updateHud(info);
}
/** The pop-up buttons in the top bar are as wide as the choice they show (a native picker opens when you tap one), so the bar stays on one line. */
let pillCtx = null;
function fitPills() {
  pillCtx = pillCtx || document.createElement('canvas').getContext('2d');
  document.querySelectorAll('.pillfield select').forEach((sel) => {
    const cs = getComputedStyle(sel); pillCtx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const w = Math.max(60, Math.ceil(pillCtx.measureText(sel.options[sel.selectedIndex]?.text ?? '').width) + 24); // the text and the arrow
    if (sel.dataset.fit !== String(w)) { sel.style.width = `${w}px`; sel.dataset.fit = String(w); }
  });
}
function updateHud(info) {
  fitPills();
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
  const cell = document.querySelector(`[data-cell="${S.stripStep > 1 ? Math.floor(S.frame / S.stripStep) * S.stripStep : S.frame}"]`);
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
  S.mouthPreview = null; // a held mouth shape lasts until the playhead moves
  render();
}
function markCustom() { if (S.preset !== 'Custom') { S.preset = 'Custom'; const sel = document.getElementById('preset'); if (sel) sel.value = 'Custom'; } }
function setParam(c, v) {
  const val = clampTo(c, v); const was = S[c.scope][c.id];
  S[c.scope][c.id] = val;
  if (c.scope === 'p' && MOOD.base && typeof val === 'number' && typeof MOOD.base[c.id] === 'number' && typeof was === 'number') MOOD.base[c.id] += val - was; // a slider moved while the pad is off centre moves the walk in the middle too
  if (c.scope === 'p') { markCustom(); refreshGaitLine(); }
  // Choosing the Moebius style for the first time brings its colours too: sand, a pale sky grey and a dark ink, unless the colours have been chosen already.
  if (c.scope === 's' && c.id === 'style' && val === 'moebius' && S.s.fillColor === STYLE_DEFAULTS.fillColor && S.s.lineColor === STYLE_DEFAULTS.lineColor && S.s.farTint === STYLE_DEFAULTS.farTint) { S.s.fillColor = '#efe3c6'; S.s.lineColor = '#1e1b2e'; S.s.farTint = '#8fa9bd'; setMessage('Moebius style: sand, sky grey and dark ink. Change the colours in Figure if you want others.'); if (S.tab === 'View') renderPanel(); }
  if (c.scope === 'x' && (c.id === 'width' || c.id === 'height')) S.x[c.id] = Math.max(c.min, Math.round(val / 2) * 2);
  // With drawings held for two or three frames, a cycle that is not a whole number of drawings cannot loop evenly: the last drawing is held for less time. Keep it a whole number.
  if ((c.id === 'cycleFrames' || c.id === 'exposure') && S.perfLen <= 0) { const ex = Math.max(1, Math.round(S.p.exposure || 1)); if (ex > 1) { const fit = Math.max(ex * 2, Math.round(S.p.cycleFrames / ex) * ex); if (fit !== S.p.cycleFrames) { S.p.cycleFrames = fit; if (c.id === 'exposure') setMessage(`The cycle is ${fit} frames, a whole number of drawings at exposure ${ex}, so it loops evenly.`); renderPanel(); } } }
  if (c.id === 'cycleFrames' || c.id === 'exposure') { buildStrip(); if (S.frame >= cycleFrames(P()).frames.length) S.frame = 0; }
  if (c.scope === 'x') refreshSummary();
  render(); save();
}
/** Keys that belong to one figure, so choosing a preset for the dog leaves the human's settings alone. */
const DOG_KEYS = Object.keys(DEFAULTS).filter((k) => k.startsWith('dog'));
const SHARED_KEYS = ['rig', 'fps', 'cycleFrames', 'exposure', 'travel'];
/** The settings that make up a figure's walk: the dog's own for the animals, everything else for the people, and the timing. */
const walkKeys = (rig) => [...(rig === 'dog' ? [...DOG_KEYS, 'terrain', 'terrainGrade', 'terrainRise', 'terrainRun', 'heading', 'weight', 'noiseAmount', 'noiseSpeed', 'noiseSeed', 'noiseLoop', 'hoseWobble', 'hoseWobbleRate'] : Object.keys(DEFAULTS).filter((k) => !k.startsWith('dog') && k !== 'rig' && k !== 'model')), ...SHARED_KEYS.filter((k) => k !== 'rig')];
function applyPreset(name) {
  MOOD.x = 0.5; MOOD.y = 0.5; MOOD.base = null; // a new walk starts in the middle of the mood pad
  const rig = S.p.rig; const fig = figKey();
  const mine = rig === 'dog' ? [...DOG_KEYS, 'terrain', 'terrainGrade', 'terrainRise', 'terrainRun', 'heading', 'weight', 'noiseAmount', 'noiseSpeed', 'noiseSeed', 'noiseLoop', 'hoseWobble', 'hoseWobbleRate'] : Object.keys(DEFAULTS).filter((k) => !k.startsWith('dog') && k !== 'rig' && k !== 'model');
  const reset = Object.fromEntries(mine.map((k) => [k, DEFAULTS[k]]));
  const { camYaw, camPitch, ...presetP } = presetsForFigure(fig)[name] || {}; // a preset may also turn the camera, to show its movement best
  S.p = { ...S.p, ...reset, ...presetP, rig, model: S.p.model };
  if (camYaw != null) S.s.camYaw = camYaw;
  if (camPitch != null) S.s.camPitch = camPitch;
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
  if (PADRUN) padFinish(true);
  if (MOOD.base) { Object.assign(S.p, Object.fromEntries(Object.entries(MOOD.base).filter(([k]) => typeof S.p[k] === 'number'))); } MOOD.x = 0.5; MOOD.y = 0.5; MOOD.base = null; // the figure leaves with its own walk, not the mood
  { const d = newMood().corners; for (const c of CORNERS) if (MOOD.corners[c].kind !== 'mood') MOOD.corners[c] = d[c]; MOOD.skip = []; } // a corner holding another figure's walk means nothing to this one
  pause(); closeEditor(true); setArmed(false);
  S.bank[figKey()] = { lanes: S.lanes, perfLen: S.perfLen };
  const b = S.bank[fig];
  S.lanes = b?.lanes ?? {}; S.perfLen = b?.perfLen ?? 0; S.ver++;
  const rig = rigOfFig(fig); const wasRig = S.p.rig; const wasSpecies = S.p.dogSpecies; const wasFig = figKey();
  (S.rBank ||= {})[wasFig] = S.r; // each figure keeps its own proportions
  (S.pBank ||= {})[wasFig] = { p: Object.fromEntries([...new Set(walkKeys(wasRig))].map((k) => [k, S.p[k]])), preset: S.preset }; // and its own walk
  S.r = S.rBank[fig] ?? (fig === 'hose' ? { ...HOSE_PROPORTIONS } : {});
  if (rig === 'human') S.p.model = fig === 'hose' ? 'hose' : 'mannequin';
  S.p.rig = rig; S.sel = null; S.attachSel = null; S.frame = 0; S.clipLen = null; S.clipStart = 0;
  S.clip = clipsForFigure(fig)[0]?.id ?? '';
  // Coming back to a figure, it has the walk it had when you left it (before this, a human reached by way of the dog was left with the rubber hose walk under the name Normal).
  const kept = S.pBank[fig];
  if (kept) { if (rig === 'dog') S.p.dogSpecies = fig; for (const [k, v] of Object.entries(kept.p)) if (k in DEFAULTS && typeof v === typeof DEFAULTS[k]) S.p[k] = v; S.preset = kept.preset in presetsForFigure(fig) || kept.preset === 'Custom' ? kept.preset : 'Custom'; build(); render(); save(); return; }
  if (rig === 'dog' && (wasRig === 'dog' || wasSpecies !== fig)) { S.p.dogSpecies = fig; applyPreset(Object.keys(presetsForFigure(fig))[0]); build(); render(); save(); return; }
  if (rig === 'dog') S.p.dogSpecies = fig;
  if (rig === 'human') { applyPreset(Object.keys(presetsForFigure(fig))[0]); build(); render(); save(); return; } // a new walk for the new figure
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
  if (sel && openTab && S.tab !== 'Design') { S.tab = 'Parts'; } // on the Design tab a tap on a part chooses it to design
  if (S.edit) {
    const chans = sel ? partChannels(sel.part, sel.side) : [];
    if (chans.length) openEditor(chans[0].id); else closeEditor();
  }
  renderPanel(); render();
}

// ---------- timeline ----------
/** The small label under a timeline frame: the mouth shape that starts there, or else the pose or cycle name. */
function setKeyLabel(cell, f, fallback) {
  const k = keyOn(S.speech, f); const el = cell.querySelector('.k');
  el.textContent = k ? VISEME_BY_ID[k.v].code : fallback;
  if (k) el.dataset.mouth = '1'; else delete el.dataset.mouth;
}
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
    requestAnimationFrame(() => host.querySelectorAll('.cell').forEach((cell) => { const f = Number(cell.dataset.cell); setKeyLabel(cell, f, f % n === 0 ? `c${f / n + 1}` : ''); }));
  } else delete host.dataset.perf;
  if (!sampled && !perf) import('./rig.js').then(({ keyPhases }) => {
    for (const k of keyPhases(S.p)) {
      for (const off of [0, 0.5]) {
        const u = (k.u + off) % 1;
        const f = frames.reduce((best, fr) => (Math.abs(fr.u - u) < Math.abs(best.u - u) ? fr : best), frames[0]);
        if (!marks.has(f.frame)) marks.set(f.frame, `${k.name[0]}${off ? 'f' : 'n'}`);
      }
    }
    host.querySelectorAll('.cell').forEach((cell) => { const m = marks.get(Number(cell.dataset.cell)); setKeyLabel(cell, Number(cell.dataset.cell), m || ''); });
  });
  // A long performance would need thousands of cells: past 1200 frames one cell stands for several, and the label is the time in seconds.
  const step = Math.max(1, Math.ceil(frames.length / 1200)); S.stripStep = step;
  let lastDrawing = 0;
  (step > 1 ? frames.filter((f) => f.frame % step === 0) : frames).forEach((f) => {
    const first = step > 1 ? true : f.drawing !== lastDrawing;
    lastDrawing = f.drawing;
    host.append(h('button', {
      type: 'button', class: `cell${first ? '' : ' held'}`, 'data-cell': f.frame, testid: `cell-${f.frame}`,
      'aria-label': `Frame ${f.frame + 1}, drawing ${f.drawing}${first ? '' : ', held'}`,
      onClick: () => { pause(); setFrame(f.frame); },
    }, h('span', { class: 'n' }, step > 1 ? (f.frame % Math.max(1, Math.round(S.p.fps)) < step ? `${Math.round(f.frame / S.p.fps)}s` : '·') : first ? String(sampled ? (SM.cuts[f.drawing - 1]?.label ?? f.drawing) : f.drawing) : '·'), h('span', { class: 'k' }, '')));
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
    let n = cycleFrames(P()).frames.length;
    for (let i = 0; i < steps; i++) {
      let nf = S.frame + 1;
      if (nf >= n) {
        if (S.recording) { pause(); paint(); return; } // a take ends at the end of the performance instead of looping
        nf = 0;
      }
      S.frame = nf;
      if (S.recording) rec.tick(nf);
      if (PADRUN) { padStep(); n = cycleFrames(P()).frames.length; if (S.frame >= n) S.frame = 0; } // a blend to a pad moves on one frame; the cycle may have changed length
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
  voiceToken++; try { if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel(); } catch { /* no voice */ } // pausing stops the voice too
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
    control = h('div', { class: `seg${wordsFor(figKey()).options(c).length >= 5 ? ` seg-grid seg-3` : ''}`, role: 'group', 'aria-label': c.label }, wordsFor(figKey()).options(c).map((o) => h('button', { type: 'button', class: 'segbtn', 'aria-pressed': String(String(o) === String(val)), testid: `opt-${c.id}-${o}`, onClick: () => { setParam(c, o); renderPanel(); } }, String(o))));
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
    mk('amount', 'Amount ×', 0, 6, 0.05, id, id),
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

/** How long the playback is: more cycles of the same walk, or a time. The walk keeps its speed (that is Cycle frames, in the Body tab); only the length changes. */
function lengthItems() {
  const n = Math.max(2, Math.round(S.p.cycleFrames));
  return [
  ...[2, 4, 6, 8, 16, 32, 64].map((k) => ({ label: `${k} cycles`, testid: `perf-x${k}`, onClick: () => { S.perfLen = Math.min(MAX_FRAMES, n * k); S.ver++; buildStrip(); renderPanel(); render(); save(); } })),
  { separator: true },
  ...[[30, '30 seconds'], [60, '1 minute'], [120, '2 minutes'], [300, '5 minutes'], [600, '10 minutes']].map(([sec, label]) => ({ label, testid: `perf-s${sec}`, onClick: () => { S.perfLen = Math.min(MAX_FRAMES, Math.max(n, Math.round((S.p.fps * sec) / n) * n)); S.ver++; buildStrip(); renderPanel(); render(); save(); setMessage(`The performance is ${S.perfLen} frames, ${(S.perfLen / S.p.fps).toFixed(1)} seconds, a whole number of cycles.`); } })),
  { separator: true },
  { label: 'One cycle', testid: 'perf-one', onClick: () => { S.perfLen = 0; S.frame = Math.min(S.frame, n - 1); S.ver++; buildStrip(); renderPanel(); render(); save(); } },
  ];
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
      numField('Frames', S.perfLen > 0 ? S.perfLen : n, n, MAX_FRAMES, (v) => { S.perfLen = Math.min(MAX_FRAMES, Math.max(n, Math.round(v) || n)); if (S.perfLen === n && !hasLanes(S.lanes)) S.perfLen = 0; S.ver++; buildStrip(); renderPanel(); render(); save(); }, 'perf-len'),
      menuButton({ label: 'Set length', testid: 'perf-menu', items: lengthItems }))));

  host.append(h('section', { class: 'group' }, h('h3', null, 'Record by hand'),
    h('p', { class: 'hint' }, 'Press Rec, then Play, and move any gait slider or a part\'s Amount or Offset while it plays. Your moves are written as automation, like recording a synth knob. Touch: it records while you hold and glides back when you let go. Latch: it records from your first touch and holds the last value until you stop.'),
    h('div', { class: 'btnrow' }, seg([['touch', 'Touch'], ['latch', 'Latch']], S.recMode, (m) => { S.recMode = m; rec.setMode(S.armed ? m : 'off'); renderPanel(); }, 'rec-mode'),
      h('button', { type: 'button', class: 'btn primary', testid: 'rec-arm', 'aria-pressed': String(S.armed), onClick: () => { setArmed(!S.armed); } }, S.armed ? 'Armed: press Play' : 'Arm recording'))));

  const clips = clipsForFigure(figKey());
  const clip = clips.find((c) => c.id === S.clip) || clips[0];
  const D = S.clipLen ?? clip.frames;
  host.append(h('section', { class: 'group' }, h('h3', null, 'Movements'),
    h('p', { class: 'hint' }, 'A movement is written as ordinary automation, so you can edit or redraw it afterwards. Pick one, say where it starts, and add it.'),
    h('p', { class: 'hint' }, 'Each movement starts from whatever the figure is doing, so they chain: Walk to stop, Sit, Stand up, Start walking.'),
    (() => {
      const groups = [...CLIP_GROUPS.map(([g]) => g), 'Other'].filter((g) => clips.some((c) => groupOfClip(c.id) === g));
      const shown = LAYOUT.expandAll ? null : (groups.includes(S.clipGroup) ? S.clipGroup : groupOfClip(clip.id)); // one group of movements at a time
      return h('div', { class: 'cliprows' }, h('div', { class: 'seg', role: 'group', 'aria-label': 'Kind of movement' }, groups.map((g) => h('button', { type: 'button', class: 'segbtn', testid: `clip-group-${g}`, 'aria-pressed': String(shown === g || (shown == null && g === groupOfClip(clip.id))), onClick: () => { S.clipGroup = g; renderPanel(); } }, g))),
        groups.map((g) => { const list = clips.filter((c) => groupOfClip(c.id) === g); return h('div', { class: 'cliprow', hidden: shown != null && shown !== g }, h('div', { class: 'chips', role: 'group', 'aria-label': g }, list.map((c) => h('button', { type: 'button', class: 'pchip', testid: `clip-${c.id}`, 'aria-pressed': String(c.id === clip.id), onClick: () => { S.clip = c.id; S.clipLen = null; S.clipGroup = g; renderPanel(); } }, wd(c.label))))); }));
    })(),
    h('p', { class: 'hint' }, wd(clip.help)),
    h('div', { class: 'btnrow' },
      numField('Starts at frame', S.clipStart + 1, 1, MAX_FRAMES, (v) => { S.clipStart = Math.max(0, Math.round(v) - 1); }, 'clip-start'),
      h('button', { type: 'button', class: 'btn', testid: 'clip-playhead', onClick: () => { S.clipStart = S.frame; renderPanel(); } }, 'Use playhead'),
      numField('Lasts (frames)', D, 6, 600, (v) => { S.clipLen = Math.max(6, Math.round(v)); }, 'clip-len')),
    h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Strength'), h('input', { type: 'range', class: 'rng', min: 0.3, max: 1.5, step: 0.05, value: S.clipK, testid: 'clip-k', 'aria-label': 'Movement strength', onInput: (e) => { S.clipK = Number(e.target.value); } })),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', testid: 'clip-add', onClick: () => addClip(clip, S.clipStart, S.clipLen ?? clip.frames, S.clipK) }, `Add ${clip.label.toLowerCase()}`))));

  const targets = Object.keys(S.lanes).filter((t) => S.lanes[t].pts?.length);
  // Lanes are sorted into groups: timing, the gait settings, then the moving parts by region of the body.
  const LANE_ORDER = ['Speed and timing', 'Gait settings', 'Body settings', 'Body', 'Core', 'Head', 'Arms', 'Front legs', 'Legs', 'Hind legs', 'Tail', 'Other'];
  const laneGroup = (t) => {
    const k = parseTarget(t);
    if (k?.kind === 'cadence') return 'Speed and timing';
    if (k?.kind === 'param') { const c = CONTROLS.find((q) => q.scope === 'p' && q.id === k.id); return c?.group === 'Timing' ? 'Speed and timing' : c?.tab === 'Gait' ? 'Gait settings' : 'Body settings'; }
    if (k?.kind === 'channel') { const part = CHANNEL_BY_ID[k.id]?.part ?? ''; return PARTS.find((p) => p.id === part || p.id === `dog.${part}`)?.group ?? 'Other'; }
    return 'Other';
  };
  const byGroup = new Map();
  for (const t of targets) { const g = laneGroup(t); if (!byGroup.has(g)) byGroup.set(g, []); byGroup.get(g).push(t); }
  const laneRow = (t) => h('div', { class: 'laneitem', testid: `lane-${t}` },
    h('span', { class: 'lname' }, targetLabel(t), h('small', null, ` ${S.lanes[t].pts.length} points`)),
    h('button', { type: 'button', class: 'btn tiny', testid: `lane-edit-${t}`, onClick: () => openLaneEditor(t) }, 'Edit'),
    h('button', { type: 'button', class: 'btn tiny', 'aria-label': `Clear ${targetLabel(t)}`, testid: `lane-clear-${t}`, onClick: () => { delete S.lanes[t]; S.ver++; if (laneEd?.target === t) closeEditor(); markCustom(); buildStrip(); renderPanel(); render(); save(); } }, 'Clear'));
  if (!targets.length) host.append(h('section', { class: 'group' }, h('h3', null, 'Automation lanes (0)'), h('p', { class: 'hint' }, 'Nothing is automated yet.')));
  for (const g of [...LANE_ORDER, ...[...byGroup.keys()].filter((x) => !LANE_ORDER.includes(x))]) {
    const ts = byGroup.get(g); if (!ts) continue;
    ts.sort((x, y) => targetLabel(x).localeCompare(targetLabel(y)));
    host.append(h('section', { class: 'group', testid: `lanes-${g.toLowerCase().replace(/[^a-z]+/g, '-')}` }, h('h3', null, `Lanes: ${g} (${ts.length})`), ts.map(laneRow)));
  }
  if (targets.length) host.append(h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'lanes-clear-all', onClick: () => { S.lanes = {}; S.ver++; closeEditor(true); renderPanel(); buildStrip(); render(); save(); } }, 'Clear all automation (' + targets.length + ')')));
  return host;
}

function addClip(clip, start, D, k) {
  S.lanes = applyClip(S.lanes, clip, S.p, start, D, k); S.ver++;
  const n = Math.max(2, Math.round(S.p.cycleFrames));
  const need = start + D + n * 2;
  if (S.perfLen < need) S.perfLen = Math.min(MAX_FRAMES, need);
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
    else if (k.what === 'amount') view = { lo: 0, hi: 6, to: (v) => v, from: (v) => v, unit: '×', base: () => S.motion[k.id]?.amount ?? 1 };
    else { const span = Math.max(Math.abs(c.min), Math.abs(c.max)); view = { lo: -span, hi: span, to: (v) => c.to(v), from: (v) => c.from(v), unit: c.unit, base: () => S.motion[k.id]?.offset ?? 0 }; }
  }
  const mode = (m, label) => h('button', { type: 'button', class: 'segbtn', 'aria-pressed': String(m === 'handles'), testid: `lane-mode-${m}`, onClick: (e) => { laneEd.setMode(m); dock.querySelectorAll('.segmode .segbtn').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); } }, label);
  const host = h('div', { class: 'curve-host', testid: 'lane-host' });
  dock.append(
    h('div', { class: 'pop-head' }, h('h2', null, targetLabel(target)), h('button', { type: 'button', class: 'btn', testid: 'lane-close', onClick: () => closeEditor() }, 'Close')),
    h('div', { class: 'pop-row' }, h('div', { class: 'seg segmode' }, mode('handles', 'Handles'), mode('draw', 'Draw')),
      h('button', { type: 'button', class: 'btn', testid: 'lane-interp', onClick: (e) => { const l = S.lanes[target]; if (!l) return; l.interp = l.interp === 'linear' ? 'smooth' : 'linear'; S.ver++; e.currentTarget.textContent = l.interp === 'linear' ? 'Straight lines' : 'Eased'; laneEd.draw(); render(); save(); } }, S.lanes[target]?.interp === 'linear' ? 'Straight lines' : 'Eased'),
      h('button', { type: 'button', class: 'btn', testid: 'lane-clear', onClick: () => { delete S.lanes[target]; S.ver++; closeEditor(); markCustom(); render(); save(); } }, 'Clear lane')),
    propRow(() => laneEd?.draw()),
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
  let hueIx = 0;
  host.querySelectorAll('section.group').forEach((sec) => {
    const hd = sec.firstElementChild;
    if (!hd || hd.tagName !== 'H3') return;
    // On the joined Gait and Body tab the colour says which part a section belongs to: blue for the walk, amber for the body, sage for proportions. Elsewhere each section gets its own muted colour.
    if (S.tab === 'Gait') sec.dataset.hue = sec.dataset.area === 'Scene' ? '5' : /proportions$/i.test(hd.textContent) ? '4' : sec.dataset.area === 'Body' ? '1' : '0';
    else if (S.tab === 'View') sec.dataset.hue = { View: '0', Look: '1', Guides: '2' }[sec.dataset.area] ?? '2'; // blue for the camera, amber for the look, teal for the guides
    else sec.dataset.hue = String(hueIx++ % 6);
    const title = hd.textContent; const key = `${S.tab}:${title}`;
    // The rarely used groups start folded (proportions, hips and legs, left and right feet, onion skin, colours, names, target app); a choice you make is remembered.
    const folded = LAYOUT.collapsed?.[key] ?? (!LAYOUT.expandAll && (/proportions$|^hips and legs$|^variety$|^ground$|^direction$|^feet$|^eyebrows$|^mouth$|^moebius style$|^pictures$|^pivot around the figure$|^onion skin$|^colours$|^names$|^target app$/i.test(title) || ['Auto:Saved performances', 'Auto:Length', 'Auto:Record by hand'].includes(key)));
    const body = h('div', { class: 'group-body' });
    while (hd.nextSibling) body.append(hd.nextSibling);
    sec.append(body); body.hidden = folded;
    const btn = h('button', { type: 'button', class: 'sec-toggle', 'aria-expanded': String(!folded), onClick: () => {
      const now = !body.hidden; body.hidden = now; btn.setAttribute('aria-expanded', String(!now)); (LAYOUT.collapsed ||= {})[key] = now; layoutSave();
    } }, icon('chevronDown', 12), title);
    hd.textContent = ''; hd.append(btn);
  });
}

let lastTab = null;
function renderPanel() {
  if (S.tab !== lastTab) { closeMenus(); lastTab = S.tab; } // a menu opened on one tab must not float over the next
  const host = document.getElementById('panel-body');
  watchPanelWidth();
  const top = host.scrollTop;
  host.textContent = '';
  if (S.tab === 'Auto') host.append(autoSection());
  else if (S.tab === 'Parts') host.append(partsSection());
  else if (S.tab === 'Attach') host.append(attachSection());
  else if (S.tab === 'Design') host.append(designSection());
  else if (S.tab === 'Draw') host.append(drawSection());
  else if (S.tab === 'Sampler') host.append(samplerSection());
  else {
    if (S.tab === 'Speech') host.append(speechSection());
    if (S.tab === 'Gait') { host.append(sceneSection()); host.append(moodSection()); host.append(padSection()); host.append(gaitChartSection()); }
    const items = CONTROLS.filter((c) => c.tab === S.tab && shownFor(c, S.p.rig) && !wordsFor(figKey()).hides(c));
    for (const g of [...new Set(items.map((c) => c.group))]) host.append(h('section', { class: 'group', 'data-area': items.find((c) => c.group === g).area }, h('h3', null, wd(g)), items.filter((c) => c.group === g).map(row)));
    if (S.tab === 'View') host.append(viewExtras(), arcSection(), refSection());
    if (S.tab === 'Export') host.append(exportSection());
  }
  collapsible(host);
  host.scrollTop = top;
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === S.tab)));
  document.querySelector('.tab[aria-selected="true"]')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  setTimeout(refreshSparks, 0);
}

// ---------- the design tab: each part's own look, skins, UV maps and sprite sheets ----------
const designOf = () => (S.design[figKey()] ||= {});
/** The parts of this figure as the stage last drew them: { key, part, side }, in a fixed order. */
function partKeys() {
  const seen = new Map();
  for (const sh of S.last?.shapes || []) { if (sh.attach || !sh.part) continue; const key = partKey(sh.part, sh.side); if (!seen.has(key)) seen.set(key, { key, part: sh.part, side: sh.side || null }); }
  return [...seen.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
}
function patchPart(key, patch, { panel = false } = {}) {
  const d = designOf(); const next = { ...(d[key] || newPart()), ...patch };
  if (isPlain(next)) delete d[key]; else d[key] = next;
  S.ver++; render(); save(); refreshUv(); if (panel) renderPanel();
}
const designKeySel = () => (S.sel?.part ? partKey(S.sel.part, S.sel.side) : null);
let uvCanvas = null; let uvGeom = null; let uvDrag = null;
const UV_HANDLES = [[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0], [1, 0.5], [0.5, 1], [0, 0.5]].map(([u, v]) => ({ u, v, edge: u === 0.5 ? 'v' : v === 0.5 ? 'u' : null }));
/** The picture the part's skin shows, with the outline of the part where it falls in it: so it is plain what part of the picture lands on the part. */
function refreshUv() {
  const cv = uvCanvas; if (!cv || !cv.isConnected) return; const g = cv.getContext('2d'); const W = cv.width; g.clearRect(0, 0, W, W);
  g.fillStyle = '#e9e9ee'; g.fillRect(0, 0, W, W);
  const key = designKeySel(); const skin = key ? designOf()[key]?.skin : null; const inf = skin ? imageInfo(skin.img) : null;
  if (!skin || !inf?.img) { g.fillStyle = '#777'; g.font = '14px sans-serif'; g.textAlign = 'center'; g.fillText('No skin on this part', W / 2, W / 2); return; }
  const idx = cellFor(skin, S.frame); const cw = inf.img.naturalWidth / skin.cols; const ch = inf.img.naturalHeight / skin.rows; const k = Math.min((W - 28) / cw, (W - 28) / ch); const ox = (W - cw * k) / 2; const oy = (W - ch * k) / 2; // a margin, so the handles at the edges can be reached
  g.drawImage(inf.img, (idx % skin.cols) * cw, Math.floor(idx / skin.cols) * ch, cw, ch, ox, oy, cw * k, ch * k);
  g.strokeStyle = '#888'; g.lineWidth = 1; g.strokeRect(ox + 0.5, oy + 0.5, cw * k - 1, ch * k - 1);
  uvGeom = { ox, oy, k, cw, ch };
  const at = (u, v) => { const [s, t] = uvToCell(skin, u, v); return [ox + s * cw * k, oy + t * ch * k]; };
  g.save(); g.setLineDash([5, 4]); g.strokeStyle = '#0088dd'; g.lineWidth = 1.5; g.beginPath(); [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => { const [px, py] = at(u, v); if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); g.stroke(); g.restore(); // the part's box: where the picture is placed
  const f = S.last?.frames?.[key]?.[0]; if (!f) { drawUvHandles(g, skin); return; }
  g.beginPath(); f.pts.forEach(([x, y], i) => { const [u, v] = toUV(f.fr, x, y); const [s, t] = uvToCell(skin, u, v); const px = ox + s * cw * k; const py = oy + t * ch * k; if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath();
  g.fillStyle = 'rgba(0,170,255,0.18)'; g.fill(); g.strokeStyle = '#0088dd'; g.lineWidth = 2; g.stroke();
  for (const hd of UV_HANDLES) { const [px, py] = at(hd.u, hd.v); g.beginPath(); g.arc(px, py, 5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#0088dd'; g.lineWidth = 1.5; g.stroke(); }
}
function drawUvHandles(g, skin) {
  const gm = uvGeom; if (!gm) return;
  for (const hd of UV_HANDLES) { const [s, t] = uvToCell(skin, hd.u, hd.v); g.beginPath(); g.arc(gm.ox + s * gm.cw * gm.k, gm.oy + t * gm.ch * gm.k, 5, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.strokeStyle = '#0088dd'; g.lineWidth = 1.5; g.stroke(); }
}
const uvPoint = (e) => { const r = uvCanvas.getBoundingClientRect(); return [((e.clientX - r.left) * uvCanvas.width) / r.width, ((e.clientY - r.top) * uvCanvas.height) / r.height]; };
const uvCell = (e) => { const [px, py] = uvPoint(e); const gm = uvGeom; return [(px - gm.ox) / (gm.cw * gm.k), (py - gm.oy) / (gm.ch * gm.k)]; };
/** What the skin becomes when the handle of the box is dragged to a point (s, t) of the picture: the picture point under the handle stays under the pointer. */
function uvScaleFrom(sk0, hd, s, t) {
  const clampS = (v) => Math.min(10, Math.max(0.05, v));
  if (hd.edge && Math.abs(sk0.rot) < 0.5) {
    if (hd.edge === 'u') { const x = sk0.flip ? 0.5 - s : s - 0.5; const v = (hd.u - 0.5 - sk0.u) / x; return Math.abs(x) > 0.01 && v > 0 ? { su: clampS(v) } : {}; }
    const y = t - 0.5; const v = (hd.v - 0.5 - sk0.v) / y; return Math.abs(y) > 0.01 && v > 0 ? { sv: clampS(v) } : {};
  }
  const [pu, pv] = cellToUV(sk0, s, t); const cu = 0.5 + sk0.u; const cv = 0.5 + sk0.v; const dp = Math.hypot(pu - cu, pv - cv); if (dp < 1e-4) return {};
  const f = Math.hypot(hd.u - cu, hd.v - cv) / dp; return { su: clampS(sk0.su * f), sv: clampS(sk0.sv * f) };
}
function uvDown(e) {
  const key = designKeySel(); const sk = key && designOf()[key]?.skin; if (!sk || !uvGeom) return;
  const [px, py] = uvPoint(e); const gm = uvGeom; let best = null; let bd = 14;
  for (const hd of UV_HANDLES) { const [s, t] = uvToCell(sk, hd.u, hd.v); const d = Math.hypot(gm.ox + s * gm.cw * gm.k - px, gm.oy + t * gm.ch * gm.k - py); if (d < bd) { bd = d; best = hd; } }
  uvCanvas.setPointerCapture?.(e.pointerId); const [s0, t0] = uvCell(e); uvDrag = { id: e.pointerId, key, sk0: { ...sk }, hd: best, s0, t0 };
}
function uvMove(e) {
  const dr = uvDrag; if (!dr || e.pointerId !== dr.id || !designOf()[dr.key]?.skin) return; const [s, t] = uvCell(e); const sk0 = dr.sk0; let patch;
  if (!dr.hd) { // drag inside: slide the box over the picture
    const dx = (sk0.flip ? -(s - dr.s0) : s - dr.s0) * sk0.su; const dy = (t - dr.t0) * sk0.sv; const r = (sk0.rot * Math.PI) / 180;
    patch = { u: sk0.u - (dx * Math.cos(r) - dy * Math.sin(r)), v: sk0.v - (dx * Math.sin(r) + dy * Math.cos(r)) };
  } else patch = uvScaleFrom(sk0, dr.hd, s, t);
  patchPart(dr.key, { skin: { ...designOf()[dr.key].skin, ...patch } });
}
function uvUp(e) { if (uvDrag && e.pointerId === uvDrag.id) { uvDrag = null; renderPanel(); } }
async function loadPictureData(file, maxSide = 1024) {
  const url = URL.createObjectURL(file);
  try {
    const img = await decodePicture(file);
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); const id = freshId(); await registerImage(id, c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.92)); return id;
  } finally { URL.revokeObjectURL(url); }
}
async function pickSkinPicture(file) {
  const key = designKeySel(); if (!file || !key) return;
  try {
    if (isVideo(file)) { setMessage('Taking 16 frames from the video…'); const v = await videoSheet(file); const id = freshId(); await registerImage(id, v.canvas.toDataURL('image/jpeg', 0.88)); patchPart(key, { skin: { ...newSkin(id), cols: v.cols, rows: v.rows, anim: 'loop', cellFrames: 2 } }, { panel: true }); saveAttachImages(); setMessage('The video is a sprite sheet of 16 frames, playing in a loop. Change the columns, rows and frames per cell to retime it.'); return; }
    const id = await loadPictureData(file); patchPart(key, { skin: { ...(designOf()[key]?.skin || newSkin(id)), img: id } }, { panel: true }); saveAttachImages(); setMessage('Skin added. Slide, scale and turn it to fit, or set the columns and rows if it is a sprite sheet.');
  } catch (e) { setMessage(e.message); }
}
/** The UV template: one cell for every part, with its outline drawn where it sits in its UV box, to paint over in another app and bring back with Import painted sheet. */
function exportUvTemplate() {
  const keys = partKeys(); if (!keys.length) { setMessage('Nothing to make a template of: this look draws no parts.'); return null; }
  const lay = atlasLayout(keys.map((e) => e.key)); const cs = 256; const cv = document.createElement('canvas'); cv.width = lay.cols * cs; cv.height = lay.rows * cs; const g = cv.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
  for (const e of keys) {
    const i = lay.cells[e.key]; const x0 = (i % lay.cols) * cs; const y0 = Math.floor(i / lay.cols) * cs; const f = S.last?.frames?.[e.key]?.[0];
    g.fillStyle = '#f6f6f8'; g.fillRect(x0, y0, cs, cs); g.strokeStyle = '#d4d4da'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + cs / 2, y0); g.lineTo(x0 + cs / 2, y0 + cs); g.moveTo(x0, y0 + cs / 2); g.lineTo(x0 + cs, y0 + cs / 2); g.stroke(); g.strokeRect(x0 + 0.5, y0 + 0.5, cs - 1, cs - 1);
    if (f) { g.beginPath(); f.pts.forEach(([x, y], j) => { const [u, v] = toUV(f.fr, x, y); const px = x0 + u * cs; const py = y0 + v * cs; if (j) g.lineTo(px, py); else g.moveTo(px, py); }); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); g.strokeStyle = '#9a9aa6'; g.lineWidth = 1.5; g.stroke(); }
    g.fillStyle = '#6a6a76'; g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillText(`${i + 1}. ${wd(partLabel(e.part, e.side))}`, x0 + 8, y0 + 18); g.fillText('along the part →', x0 + 8, y0 + cs - 8);
  }
  return new Promise((res) => cv.toBlob((blob) => { deliver(blob, `uv-template-${figKey()}.png`).then(() => { setMessage(`Saved the UV template: ${keys.length} cells in a ${lay.cols} by ${lay.rows} sheet. Paint on it, then bring it back with Import painted sheet.`); res({ blob, layout: lay, keys: keys.map((e) => e.key) }); }); }, 'image/png'));
}
/** Gives every part a skin that is its own cell of one painted sheet. */
async function applyAtlas(file) {
  if (!file) return;
  try {
    const keys = partKeys().map((e) => e.key); if (!keys.length) { setMessage('Nothing to put a sheet on yet.'); return; }
    const id = await loadPictureData(file, 2048); const lay = atlasLayout(keys); const d = designOf();
    for (const k of keys) d[k] = { ...(d[k] || newPart()), skin: atlasSkin(id, lay, k) };
    S.ver++; render(); save(); renderPanel(); saveAttachImages(); setMessage(`The sheet is on ${keys.length} parts, one cell each. Pick a part to slide or scale its cell.`);
  } catch (e) { setMessage(e.message); }
}
/** The small controls the Design and Draw tabs share: a slider with a number, a row of choices, and a switch. */
function designWidgets() {
  const slider = (label, get, set, min, max, step, tid) => {
    const val = get(); const n = h('input', { type: 'number', class: 'num', inputmode: 'decimal', min, max, step, value: +Number(val).toFixed(3), 'aria-label': label, testid: `${tid}-num` }); const r = h('input', { type: 'range', class: 'rng', min, max, step, value: val, 'aria-label': `${label} slider`, testid: tid });
    r.addEventListener('input', () => { set(Number(r.value)); n.value = +Number(r.value).toFixed(3); }); n.addEventListener('change', () => { const v = Math.min(max, Math.max(min, Number(n.value) || 0)); set(v); r.value = v; n.value = v; });
    return h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, label)), h('div', { class: 'ctl' }, r, n));
  };
  const seg = (label, items, curV, on, tid) => h('div', { class: 'row noreset row-enum' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, label)), h('div', { class: 'seg', role: 'group', 'aria-label': label }, items.map(([v, t]) => h('button', { type: 'button', class: 'segbtn', testid: `${tid}-${v}`, 'aria-pressed': String(curV === v), onClick: () => on(v) }, t))));
  const check = (label, on, set, tid) => h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, label)), h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: on, testid: tid, onChange: (e) => set(e.target.checked) }), h('span', null, on ? 'On' : 'Off')));
  return { slider, seg, check };
}

// ---------- the draw tab: draw a part on its own, the whole figure, another figure in the scene, or an attachment ----------
/** The plain pose the little figure stands in: the people with their arms straight out (a T), the animals as they are. */
const TPOSE = { armOut: 85, armSwing: 0, elbowBase: 0, elbowSwing: 0, shoulderCounter: 0, asymArm: 0, lean: 0, headNod: 0, bob: 0, torsoSway: 0, pelvisRoll: 0, sway: 0, stepLength: 0.22, armCarry: 0 };
let pickerCv = null; let pickerInfo = null;
const parseKey = (k) => { const m = /^(.*)\.(R|L)$/.exec(k || ''); return k ? (m ? { part: m[1], side: m[2] } : { part: k, side: null }) : null; };
/** Draws the little figure (with what has been drawn on it) and shades the part being drawn on. */
function paintPicker() {
  const cv = pickerCv; if (!cv || !cv.isConnected || inkItem()) return; const actor = inkActor(); const fig = actor ? actor.fig : figKey(); const people = fig === 'human' || fig === 'hose';
  const g = cv.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv.width, cv.height);
  const base = actor ? { ...actor.p, proportions: actor.r } : { ...P() };
  const params = { ...base, motion: {}, attach: [], scene: null, speech: null, perf: null, sampled: null, design: actor ? actor.design || null : S.design[figKey()] || null, ...(people ? TPOSE : {}) };
  const st = { ...S.s, style: 'mannequin', shadowMode: 'off', camYaw: people ? -90 : 0, camPitch: fig === 'snake' ? 72 : 0, showArcs: false, onionBefore: 0, onionAfter: 0, lineBoil: 0, lineOffset: 0, showScene: false };
  const sel = S.draw.mode === 'part' ? (actor ? parseKey(S.draw.actorKey) : S.sel) : null;
  try { pickerInfo = drawScene(g, params, st, cv.width, cv.height, 0, { selection: sel }); } catch { pickerInfo = null; }
}
function pickerTap(e) {
  const cv = pickerCv; if (!cv || !pickerInfo) return; const r = cv.getBoundingClientRect(); const x = ((e.clientX - r.left) * cv.width) / r.width; const y = ((e.clientY - r.top) * cv.height) / r.height;
  const hit = pickPart((pickerInfo.shapes || []).filter((s) => !s.attach && s.part), x, y); if (hit) inkPickPart(hit);
}
const INK_COLOURS = ['#1b1b1f', '#ffffff', '#d93a3a', '#f08a24', '#f2cf3a', '#3fae5b', '#3a7bd9', '#8a4fd0', '#8a5a3a', '#f1c9a5'];
let inkGesture = null; let inkUndo = []; let lastInkSig = '';
/** What the pen draws on: { kind: 'fig' } the main figure, { kind: 'actor', id } another figure in the scene, { kind: 'attach', id } one attachment. One that is gone falls back to the figure. */
const inkTarget = () => {
  const t = S.draw.target || { kind: 'fig' };
  if (t.kind === 'actor' && !S.scene.actors.some((a) => a.id === t.id)) return { kind: 'fig' };
  if (t.kind === 'attach' && !(S.attach[figKey()] || []).some((a) => a.id === t.id && a.kind !== 'strip')) return { kind: 'fig' };
  return t;
};
const inkTid = () => { const t = inkTarget(); return `${figKey()}|${t.kind}|${t.id || ''}`; };
const inkActor = () => { const t = inkTarget(); return t.kind === 'actor' ? S.scene.actors.find((a) => a.id === t.id) : null; };
const inkItem = () => { const t = inkTarget(); return t.kind === 'attach' ? (S.attach[figKey()] || []).find((a) => a.id === t.id) : null; };
const inkWhole = () => S.draw.mode === 'whole' && !inkItem();
/** The drawings of the target, { part key: { ink } }. An attachment has one, called "item". */
function inkMap() {
  const it = inkItem(); if (it) return { get item() { return { get ink() { return it.ink || null; }, set ink(v) { if (v) it.ink = v; else delete it.ink; } }; } };
  const a = inkActor(); if (a) return (a.design ||= {});
  return designOf();
}
const inkSceneHit = () => { const a = inkActor(); return a ? (S.last?.sceneHits || []).find((h2) => h2.id === a.id) || null : null; };
/** The shapes the pen can land on, as the stage last drew them. */
const inkShapes = () => (inkItem() ? [] : inkActor() ? inkSceneHit()?.shapes || [] : S.last?.shapes || []).filter((s) => !s.attach && s.part);
function inkPartKeys() { const seen = new Map(); for (const sh of inkShapes()) { const key = partKey(sh.part, sh.side); if (!seen.has(key)) seen.set(key, { key, part: sh.part, side: sh.side || null }); } return [...seen.values()].sort((a, b) => (a.key < b.key ? -1 : 1)); }
/** The UV frame of a part (or of the attachment), as the stage last drew it. */
function inkFrame(key) {
  const it = inkItem(); if (it) { const p = (S.last?.attach || []).find((q) => q.it.id === it.id); return p ? itemUVFrame(it, p.f, S.last.cam) : null; }
  const fs = inkActor() ? inkSceneHit()?.frames : S.last?.frames; return fs?.[key]?.[0]?.fr || null;
}
/** The key of the part under a point of the picture, or null. */
function inkPartAt(q) { if (inkItem()) return 'item'; const hit = pickPart(inkShapes(), q.x, q.y); return hit ? partKey(hit.part, hit.side) : null; }
function inkSelKey() { if (inkItem()) return 'item'; if (inkActor()) return S.draw.actorKey || null; return S.sel ? partKey(S.sel.part, S.sel.side) : null; }
/** The drawing of a part, made if there is none. The first line on a part commits it: its own shape turns off and only the drawing shows (unless drawing frame by frame, when the other frames would be left empty). Uncommit brings it back. */
const inkOf = (key) => { const p = (inkMap()[key] ||= newPart()); return (p.ink ||= { replace: S.draw.scope !== 'frame', strokes: [] }); };
function inkTidy(key) { const d = inkMap(); const p = d[key]; if (!p) return; if (p.ink && !p.ink.strokes.length && !(p.ink.blank && p.ink.replace)) p.ink = null; if (!inkItem() && isPlain(p)) delete d[key]; }
const inkRel = (fr) => (S.draw.size * (S.map.fcw / S.map.zw)) / Math.max(1, (fr.L + fr.W) / 2);
let inkPress = null;
/** The pointer is down on the stage in the Draw tab. Nothing is drawn yet: moving starts a line, lifting is a tap (a dot, a bucket fill), and holding still picks the part under the finger. */
function inkDown(e, toFrame) {
  const q = toFrame(e.clientX, e.clientY); if (!q || !S.last?.frames) return false;
  pause();
  if (S.draw.tool === 'pick') { if (inkItem()) return true; const hit = pickPart(inkShapes(), q.x, q.y); if (hit) inkPickPart(hit); return true; }
  inkPress = { id: e.pointerId, x: e.clientX, y: e.clientY, e0: { clientX: e.clientX, clientY: e.clientY }, q, fired: false, timer: setTimeout(inkHoldPick, 480) };
  return true;
}
/** Chooses a part to draw on: from the stage, the list or the little figure. */
function inkPickPart(hit) {
  S.draw.mode = 'part';
  if (inkActor()) { S.draw.actorKey = partKey(hit.part, hit.side); renderPanel(); render(); } else selectPart(hit, { openTab: false });
}
function inkHoldPick() {
  const p = inkPress; if (!p || inkGesture) return; p.fired = true; if (inkItem()) return;
  const hit = pickPart(inkShapes(), p.q.x, p.q.y); if (!hit) { setMessage('Nothing there to pick.'); return; }
  inkPickPart(hit); setMessage(`Picked the ${wd(partLabel(hit.part, hit.side))}. Draw on it alone; choose Whole figure to draw across.`); try { navigator.vibrate?.(15); } catch { /* no vibration here */ }
}
function inkBegin(e0, toFrame) {
  if (!inkWhole() && !inkSelKey()) { setMessage('Choose a part first: tap one on the little figure or in the list, or hold a finger on it on the stage.'); return false; }
  inkGesture = { id: inkPress?.id ?? 0, tid: inkTid(), tool: S.draw.tool, adds: [], dels: [], cur: null, key: null, last: null }; inkMove(e0, toFrame); return true;
}
/** The pointer moved while down: past a few pixels it is a line (or an eraser stroke). */
function inkMoveEvent(e, toFrame) {
  if (inkGesture) { inkMove(e, toFrame); return; }
  const p = inkPress; if (!p || p.fired || Math.hypot(e.clientX - p.x, e.clientY - p.y) < 6) return;
  clearTimeout(p.timer); if (S.draw.tool === 'bucket') return; // a bucket is a tap
  if (inkBegin(p.e0, toFrame)) inkMove(e, toFrame);
}
function inkRelease(e, toFrame) {
  const p = inkPress; inkPress = null; if (p) clearTimeout(p.timer);
  if (inkGesture) { inkEnd(); return; }
  if (!p || p.fired) return; // held: it picked a part, and drew nothing
  if (S.draw.tool === 'bucket') { inkBucket(toFrame(p.x, p.y)); return; }
  if (inkBegin(p.e0, toFrame)) inkEnd(); // a tap: a dot, or the eraser at that point
}
/** The bucket: fills the region of the part the tap is in, bounded by the lines already drawn and by the edge of the part. Holes (a closed ring of lines inside) stay empty. */
function inkBucket(q) {
  if (!q) return;
  const key = inkWhole() ? inkPartAt(q) : inkSelKey(); if (!key) { setMessage(inkWhole() ? 'Tap on a part of the figure to fill it.' : 'Choose a part first.'); return; }
  const fr = inkFrame(key); if (!fr) return; const D = S.draw;
  const polys = inkItem() ? [[[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => fromUV(fr, u, v))] : ((inkActor() ? inkSceneHit()?.frames : S.last?.frames)?.[key] || []).map((f) => f.pts);
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; for (const p of polys) for (const [x, y] of p) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (!(x1 > x0 && y1 > y0)) return;
  const sc = 320 / Math.max(x1 - x0, y1 - y0); const w = Math.ceil((x1 - x0) * sc) + 2; const h = Math.ceil((y1 - y0) * sc) + 2;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d', { willReadFrequently: true });
  g.setTransform(sc, 0, 0, sc, -x0 * sc + 1, -y0 * sc + 1); g.fillStyle = '#fff'; for (const p of polys) { g.beginPath(); p.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); }
  const ink0 = inkMap()[key]?.ink; const bars = (ink0?.strokes || []).filter((s) => !s.fill).map((s) => ({ ...s, c: '#000000', a: 1 }));
  paintStrokes(g, bars, (u, v) => fromUV(fr, u, v), (fr.L + fr.W) / 2, S.frame, 2 / sc); // the lines drawn so far are walls, at least two pixels thick
  const px = g.getImageData(0, 0, w, h).data; const allowed = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) allowed[i] = px[i * 4 + 3] > 128 && px[i * 4] > 170 ? 1 : 0;
  const sx = Math.round((q.x - x0) * sc + 1); const sy = Math.round((q.y - y0) * sc + 1); let reg = null;
  for (let r = 0; r <= 4 && !reg; r++) for (let dy = -r; dy <= r && !reg; dy++) for (let dx = -r; dx <= r && !reg; dx++) if (Math.max(Math.abs(dx), Math.abs(dy)) === r) reg = floodRegion(allowed, w, h, sx + dx, sy + dy);
  if (!reg) { setMessage('Tap inside the part, away from a line.'); return; }
  const loops = reg.loops.filter((l) => loopSize(l) >= 4).sort((a, b) => loopSize(b) - loopSize(a)).slice(0, 8).map((l) => simplifyLoop(l, 0.8).map(([x, y]) => { const [u, v] = toUV(fr, x0 + (x - 1) / sc, y0 + (y - 1) / sc); return [Math.round(u * 1000) / 1000, Math.round(v * 1000) / 1000]; })).filter((l) => l.length >= 3);
  if (!loops.length) { setMessage('Nothing to fill there.'); return; }
  const ink = inkOf(key); if (ink.strokes.length >= MAX_STROKES) { setMessage('That part has as many strokes as it can hold. Clear some or use the eraser.'); return; }
  const stroke = { c: D.color, w: 0.01, a: D.opacity, fill: true, loops, ...(D.scope === 'frame' ? { f: S.frame } : {}), pts: loops[0].map((p) => [...p]) };
  let at = ink.strokes.findIndex((s) => !s.fill); if (at < 0) at = ink.strokes.length; ink.strokes.splice(at, 0, stroke); // under the lines, over the fills before it
  inkUndo.push({ tid: inkTid(), adds: [{ key, stroke }], dels: [] }); if (inkUndo.length > 60) inkUndo.shift();
  S.ver++; render(); save(); renderPanel();
}
function inkMove(e, toFrame) {
  const g = inkGesture; const q = g && toFrame(e.clientX, e.clientY); if (!q) return;
  const D = S.draw; const under = inkWhole() ? inkPartAt(q) : inkSelKey();
  if (g.tool === 'eraser') { inkErase(g, q, under); S.ver++; render(); return; }
  const key = g.tool === 'fill' ? (g.key ||= under) : under; if (!key) return;
  const fr = inkFrame(key); if (!fr) return;
  if (!g.cur || g.cur.key !== key || g.cur.stroke.pts.length >= MAX_STROKE_PTS - 1) { // a new stroke: at the start, on moving into another part, or when one has got too long
    if (inkOf(key).strokes.length >= MAX_STROKES) { setMessage('That part has as many strokes as it can hold. Clear some or use the eraser.'); return; }
    const stroke = { c: D.color, w: Math.round(inkRel(fr) * 1000) / 1000, a: D.opacity, fill: g.tool === 'fill', ...(D.scope === 'frame' ? { f: S.frame } : {}), pts: [] };
    if (g.cur && g.last && g.tool === 'pen') stroke.pts.push(toUV(fr, g.last.x, g.last.y)); // carry the line across, so there is no gap where it crosses from one part to the next
    inkOf(key).strokes.push(stroke); g.adds.push({ key, stroke }); g.cur = { key, stroke };
  }
  const [u, v] = toUV(fr, q.x, q.y); const pts = g.cur.stroke.pts; const l = pts[pts.length - 1];
  if (!l || Math.hypot((u - l[0]) * fr.L, (v - l[1]) * fr.W) >= 1.5) pts.push([u, v]);
  g.last = q; S.ver++; render();
}
/** The eraser takes whole strokes that its circle touches. */
function inkErase(g, q, under) {
  const D = S.draw; const r = D.size * (S.map.fcw / S.map.zw); const keys = inkWhole() ? Object.keys(inkMap()) : (under ? [under] : []);
  for (const key of keys) {
    const ink = inkMap()[key]?.ink; const fr = inkFrame(key); if (!ink || !fr) continue; const size = (fr.L + fr.W) / 2;
    for (let i = ink.strokes.length - 1; i >= 0; i--) {
      const s = ink.strokes[i]; if (!strokeShows(s, S.frame)) continue; const P = s.pts.map(([u, v]) => fromUV(fr, u, v)); let hit = false;
      for (let j = 0; j < P.length && !hit; j++) {
        const a = P[j]; const b = P[j + 1] || a; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l2 = dx * dx + dy * dy; const tt = l2 ? Math.max(0, Math.min(1, ((q.x - a[0]) * dx + (q.y - a[1]) * dy) / l2)) : 0;
        hit = Math.hypot(q.x - (a[0] + dx * tt), q.y - (a[1] + dy * tt)) <= r + (s.fill ? 0 : (s.w * size) / 2);
      }
      if (hit) { ink.strokes.splice(i, 1); g.dels.push({ key, stroke: s, i }); }
    }
    inkTidy(key);
  }
}
function inkEnd() {
  const g = inkGesture; inkGesture = null; if (!g) return;
  for (const a of [...g.adds]) if (a.stroke.fill && a.stroke.pts.length < 3) { const ink = inkMap()[a.key]?.ink; const i = ink ? ink.strokes.indexOf(a.stroke) : -1; if (i >= 0) ink.strokes.splice(i, 1); g.adds.splice(g.adds.indexOf(a), 1); inkTidy(a.key); } // a fill needs a shape to fill
  if (g.adds.length || g.dels.length) { inkUndo.push(g); if (inkUndo.length > 60) inkUndo.shift(); }
  S.ver++; render(); save(); renderPanel();
}
/** Takes a gesture's changes back: its strokes out, the ones it erased in. */
function inkRevert(g) {
  for (const { key, stroke } of g.adds) { const ink = inkMap()[key]?.ink; const i = ink ? ink.strokes.indexOf(stroke) : -1; if (i >= 0) ink.strokes.splice(i, 1); inkTidy(key); }
  for (const { key, stroke, i } of [...g.dels].reverse()) { const s = inkOf(key).strokes; s.splice(Math.min(i, s.length), 0, stroke); }
}
function inkCancel() { if (inkPress) { clearTimeout(inkPress.timer); inkPress = null; } const g = inkGesture; inkGesture = null; if (!g) return; inkRevert(g); S.ver++; render(); }
function inkUndoStep() {
  let g = inkUndo.pop(); while (g && g.tid !== inkTid()) g = inkUndo.pop(); // a gesture on something else cannot be undone from here
  if (!g) return; inkRevert(g); S.ver++; render(); save(); renderPanel();
}
/** Copies what shows on this frame onto the next frame of the cycle. */
function inkCopyNext() {
  const T = cycleFrames(P()).frames.length; const to = (S.frame + 1) % T; const g = { tid: inkTid(), adds: [], dels: [] }; let n = 0;
  for (const [key, p] of Object.entries(inkMap())) {
    if (!p.ink) continue;
    for (const s of [...p.ink.strokes]) { if (s.f !== S.frame || p.ink.strokes.length >= MAX_STROKES) continue; const c = { ...s, f: to, pts: s.pts.map((q) => [...q]) }; p.ink.strokes.push(c); g.adds.push({ key, stroke: c }); n++; }
  }
  if (g.adds.length) inkUndo.push(g);
  S.ver++; render(); save(); renderPanel(); setMessage(n ? `Copied ${n} stroke${n === 1 ? '' : 's'} to frame ${to + 1}.` : 'Nothing is drawn on this frame only. Switch to This frame only and draw, then copy.');
}
/** Hides the stock shape of every part, so the figure is drawn from nothing, over its skeleton. */
function inkBlank() {
  const keys = inkItem() ? ['item'] : inkPartKeys().map((e) => e.key); if (!keys.length) return;
  for (const k of keys) { const ink = inkOf(k); ink.replace = true; ink.blank = true; }
  S.draw.guides = true; inkUndo = []; S.ver++; render(); save(); renderPanel(); setMessage('A blank figure: its own shapes are off, and the outlines show where its parts are. Draw each part (or the whole figure) and it walks as you drew it.');
}
/** Zooms and pans the stage so a part fills it, to draw on it large. */
function zoomToPart(key) {
  const m = S.map; if (!m || !key) return; let pts = [];
  if (inkItem()) { const fr = inkFrame('item'); if (fr) pts = [[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => fromUV(fr, u, v)); } else { const fs = (inkActor() ? inkSceneHit()?.frames : S.last?.frames)?.[key]; for (const f of fs || []) pts.push(...f.pts); }
  if (!pts.length) return;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const cw = stage.width; const ch = stage.height; const bw = Math.max(8, ((x1 - x0) / m.fcw) * m.zw); const bh = Math.max(8, ((y1 - y0) / m.fch) * m.zh);
  const old = S.zoom; const nz = Math.min(8, Math.max(0.25, old * Math.min((0.7 * cw) / bw, (0.7 * ch) / bh))); const zw2 = (m.zw * nz) / old; const zh2 = (m.zh * nz) / old;
  S.zoom = nz; S.panX = (cw / 2 - (((x0 + x1) / 2) / m.fcw) * zw2 - (cw - zw2) / 2) / m.d; S.panY = (ch / 2 - (((y0 + y1) / 2) / m.fch) * zh2 - (ch - zh2) / 2) / m.d; render();
}
function inkClear(keys) {
  const d = inkMap(); let n = 0; for (const k of keys) if (d[k]?.ink) { n += d[k].ink.strokes.length; d[k].ink = null; inkTidy(k); }
  inkUndo = []; S.ver++; render(); save(); renderPanel(); if (n) setMessage(`Cleared ${n} stroke${n === 1 ? '' : 's'}.`);
}
/** The outlines of the parts, faint, over the picture, so the sections show while drawing. The part being drawn on is shaded. */
function paintDrawGuides(g, info, fcw) {
  const actor = inkActor(); const item = inkItem(); const selKey = !inkWhole() ? inkSelKey() : null; g.save(); g.lineJoin = 'round'; g.setLineDash([Math.max(3, fcw / 300), Math.max(3, fcw / 300)]);
  const trace = (pts, on) => { g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]))); g.closePath(); if (on) { g.fillStyle = 'rgba(0,140,255,0.10)'; g.fill(); } g.strokeStyle = on ? 'rgba(0,120,230,0.85)' : 'rgba(0,120,230,0.35)'; g.lineWidth = Math.max(1, fcw / (on ? 600 : 900)); g.stroke(); };
  if (item) { const p = (info.attach || []).find((q) => q.it.id === item.id); if (p) { const fr = itemUVFrame(item, p.f, info.cam); trace([[0, 0], [1, 0], [1, 1], [0, 1]].map(([u, v]) => fromUV(fr, u, v)), true); } }
  else for (const sh of (actor ? (info.sceneHits || []).find((h2) => h2.id === actor.id)?.shapes : info.shapes) || []) { if (sh.attach || !sh.part || sh.hidden || sh.pts.length < 3) continue; trace(sh.pts, selKey && partKey(sh.part, sh.side) === selKey); }
  g.restore();
}
function drawSection() {
  const host = h('div', { class: 'design', testid: 'draw-section' }); const { slider, seg, check } = designWidgets(); const D = S.draw; const item = inkItem(); const actor = inkActor(); const d = inkMap();
  const list = inkPartKeys(); const sel = inkSelKey(); const partMode = D.mode === 'part' || Boolean(item);
  const total = Object.values(d).reduce((n, p) => n + (p.ink?.strokes.length || 0), 0); const cur = sel ? d[sel] : null; const redraw = () => { renderPanel(); render(); };
  const acts = S.scene.actors.filter((a) => a.visible !== false); const items = (S.attach[figKey()] || []).filter((a) => a.kind !== 'strip');
  const tBtn = (label, target, tid, on) => h('button', { type: 'button', class: 'pchip', 'aria-pressed': String(on), testid: tid, onClick: () => { D.target = target; D.actorKey = null; redraw(); } }, label);
  host.append(h('section', { class: 'group', testid: 'draw-target' }, h('h3', null, 'Draw on'),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'What to draw on' }, tBtn('This figure', { kind: 'fig' }, 'draw-target-fig', !actor && !item),
      acts.map((a) => tBtn(a.name, { kind: 'actor', id: a.id }, `draw-target-actor-${a.id}`, actor?.id === a.id)), items.map((a) => tBtn(`Attachment: ${a.name}`, { kind: 'attach', id: a.id }, `draw-target-attach-${a.id}`, item?.id === a.id))),
    !acts.length && !items.length ? h('p', { class: 'hint' }, 'Figures added in the Scene section of the Body tab, and pictures and shapes added in the Attach tab, can be drawn on too.') : null));
  const pFig = actor ? actor.fig : figKey(); const pPeople = pFig === 'human' || pFig === 'hose'; // the people are tall and the animals long
  pickerCv = h('canvas', { class: 'tpose', style: pPeople ? '' : 'aspect-ratio: 16 / 9; max-width: 340px', width: pPeople ? 440 : 640, height: pPeople ? 520 : 360, role: 'img', 'aria-label': 'The figure standing in a plain pose: tap a part to draw on it', testid: 'draw-tpose', onPointerdown: pickerTap });
  if (!item) { host.append(h('section', { class: 'group', testid: 'draw-picker' }, h('h3', null, 'Pick a part'), pickerCv, h('p', { class: 'hint' }, 'The figure in a plain pose (arms out for the people): tap a part to draw on it. You can also hold a finger on a part on the stage.'))); setTimeout(paintPicker, 0); }
  host.append(h('section', { class: 'group', testid: 'draw-main' }, h('h3', null, 'Draw'),
    h('p', { class: 'hint' }, item ? 'Draw on the attachment: what you draw stays on it and moves with it, and bends with it over a joint.' : 'Draw a part on its own, or the whole figure at once: a line that crosses from the head to the neck is split between them. What you draw sticks to its part and moves with it (a rubber hose limb bends it). Two fingers still pan and zoom.'),
    item ? null : seg('Draw', [['part', 'One part'], ['whole', 'Whole figure']], D.mode, (v) => { D.mode = v; redraw(); }, 'draw-mode'),
    !item && partMode ? h('div', { class: 'chips', role: 'group', 'aria-label': 'Choose the part to draw on' }, list.map((e) => h('button', { type: 'button', class: 'pchip', 'aria-pressed': String(e.key === sel), testid: `draw-part-${e.key}`, onClick: () => { if (actor) { D.actorKey = e.key; redraw(); } else selectPart({ part: e.part, side: e.side }, { openTab: false }); } }, `${wd(partLabel(e.part, e.side))}${d[e.key]?.ink ? (d[e.key].ink.replace ? ' ●' : ' •') : ''}`))) : null,
    !item && partMode && !sel ? h('p', { class: 'hint', testid: 'draw-choose' }, 'Tap a part on the little figure, or in the list, or hold a finger on it on the stage.') : null));
  host.append(h('section', { class: 'group', testid: 'draw-pen' }, h('h3', null, 'Pen'),
    seg('Tool', [['pen', 'Pen'], ['bucket', 'Bucket fill'], ['fill', 'Filled shape'], ['eraser', 'Eraser'], ['pick', 'Pick part']], D.tool, (v) => { D.tool = v; redraw(); }, 'draw-tool'),
    h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Colour')), h('div', { class: 'swatches' }, INK_COLOURS.map((c) => h('button', { type: 'button', class: 'swatch', style: `background:${c}`, 'aria-label': `Colour ${c}`, 'aria-pressed': String(D.color === c), testid: `draw-swatch-${c.slice(1)}`, onClick: () => { D.color = c; renderPanel(); } })), h('input', { type: 'color', class: 'color', value: D.color, 'aria-label': 'Pen colour', testid: 'draw-color', onInput: (e) => { D.color = e.target.value; } }))),
    slider('Size', () => D.size, (v) => { D.size = v; }, 1, 60, 1, 'draw-size'), slider('Opacity', () => D.opacity, (v) => { D.opacity = v; }, 0.05, 1, 0.01, 'draw-opacity'),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'draw-undo', disabled: !inkUndo.length, onClick: inkUndoStep }, 'Undo'),
      partMode ? h('button', { type: 'button', class: 'btn', testid: 'draw-clear-part', disabled: !cur?.ink?.strokes.length, onClick: () => inkClear([sel]) }, 'Clear this part') : null,
      h('button', { type: 'button', class: 'btn', testid: 'draw-clear-all', disabled: !total, onClick: () => inkClear(Object.keys(d)) }, 'Clear all drawing'))));
  const drawn = Object.values(d).filter((p) => p.ink); const some = drawn.length > 0; const allOn = some && drawn.every((p) => p.ink.replace);
  const T = cycleFrames(P()).frames.length;
  host.append(h('section', { class: 'group', testid: 'draw-frames' }, h('h3', null, 'Frames'),
    seg('Draw on', [['all', 'Every frame'], ['frame', 'This frame only']], D.scope, (v) => { D.scope = v; renderPanel(); }, 'draw-scope'),
    h('p', { class: 'hint' }, D.scope === 'frame' ? `Frame ${S.frame + 1} of ${T}: what you draw shows on this frame only, so a part can be redrawn frame by frame. Step along the timeline to draw the next one. The eraser only takes what shows on this frame.` : 'What you draw shows on every frame of the walk. Switch to This frame only to draw frame by frame.'),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'draw-copy-next', disabled: !some, title: 'Copy what is drawn on this frame onto the next one, to change it from there', onClick: inkCopyNext }, 'Copy to the next frame'))));
  host.append(h('section', { class: 'group', testid: 'draw-commit-sec' }, h('h3', null, 'Commit'),
    h('p', { class: 'hint' }, 'The first line you draw on a part commits it: the original line work of that part turns off and only your drawing shows. The dashed guide lines show where the parts are; hide them below. Uncommit brings the original back, and the drawing is kept, so you can commit again.'),
    partMode ? (cur?.ink ? h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', testid: 'draw-commit', 'aria-pressed': String(cur.ink.replace), onClick: () => { d[sel].ink.replace = !d[sel].ink.replace; inkTidy(sel); S.ver++; render(); save(); renderPanel(); } }, cur.ink.replace ? 'Uncommit this part' : 'Commit this part'), h('span', { class: 'hint', testid: 'draw-commit-state' }, cur.ink.replace ? 'Committed: its own shape is off.' : 'Not committed: its own shape still shows.')) : h('p', { class: 'hint' }, 'Draw on it, then commit it.'))
      : h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', testid: 'draw-commit-all', disabled: !some, onClick: () => { for (const p of drawn) p.ink.replace = !allOn; for (const k of Object.keys(d)) inkTidy(k); S.ver++; render(); save(); renderPanel(); } }, allOn ? 'Uncommit all' : 'Commit all drawn parts')),
    item ? null : h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'draw-blank', title: 'Turn off every part\'s own shape, to draw the figure from nothing', onClick: inkBlank }, 'Start from a blank figure')),
    item ? null : h('p', { class: 'hint' }, 'A blank figure has none of its own shapes: the outlines show where its parts are, and you draw each one. It still walks, so what you draw walks.'),
    h('p', { class: 'hint' }, `${total} stroke${total === 1 ? '' : 's'} here; ${drawn.filter((p) => p.ink.replace).length} of ${drawn.length} drawn parts committed.`)));
  host.append(h('section', { class: 'group', testid: 'draw-show' }, h('h3', null, 'View'),
    check('Hide guide lines', !D.guides, (v) => { D.guides = !v; render(); renderPanel(); }, 'draw-hide-guides'),
    h('div', { class: 'btnrow' }, partMode ? h('button', { type: 'button', class: 'btn', testid: 'draw-zoom-part', disabled: !sel, onClick: () => zoomToPart(sel) }, 'Zoom to this part') : null, h('button', { type: 'button', class: 'btn', testid: 'draw-zoom-reset', onClick: () => { S.zoom = 1; S.panX = S.panY = 0; render(); } }, 'Reset the view'))));
  return host;
}

function designSection() {
  const host = h('div', { class: 'design', testid: 'design-section' });
  const list = partKeys(); const d = designOf(); const sel = designKeySel(); const cur = sel ? (d[sel] || newPart()) : null;
  const { slider, seg, check } = designWidgets();
  host.append(h('section', { class: 'group', testid: 'design-parts' }, h('h3', null, 'Parts'),
    h('p', { class: 'hint' }, 'Tap a part on the stage, or choose one here. Give it its own colour, line, drop shadow and a skin: a picture laid over it through its UV map. A sprite sheet gives it cells that play as it moves.'),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Parts of this figure' }, list.map((e) => h('button', { type: 'button', class: 'pchip', 'aria-pressed': String(e.key === sel), testid: `design-part-${e.key}`, onClick: () => selectPart({ part: e.part, side: e.side }, { openTab: false }) }, `${wd(partLabel(e.part, e.side))}${d[e.key] ? ' •' : ''}`)))));
  if (cur) {
    const set = (patch, panel = false) => patchPart(sel, patch, { panel });
    const colour = (label, k, tid, fallback) => h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, label)), h('input', { type: 'color', class: 'color', value: cur[k] || fallback, 'aria-label': label, testid: tid, onInput: (e) => set({ [k]: e.target.value }) }), h('button', { type: 'button', class: 'btn ghost', testid: `${tid}-clear`, title: 'Use the colour of the whole stage', onClick: () => set({ [k]: '' }, true) }, 'Stage colour'));
    const sided = Boolean(S.sel.side);
    host.append(h('section', { class: 'group', testid: 'design-look' }, h('h3', null, wd(partLabel(S.sel.part, S.sel.side))),
      check('Shown', cur.visible, (v) => set({ visible: v }, true), 'design-visible'),
      colour('Fill colour', 'fill', 'design-fill', S.s.fillColor), colour('Line colour', 'line', 'design-line', S.s.lineColor),
      slider('Line weight', () => cur.lineW, (v) => set({ lineW: v }), 0, 5, 0.05, 'design-linew'), slider('Opacity', () => cur.opacity, (v) => set({ opacity: v }), 0, 1, 0.01, 'design-opacity'),
      h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'design-reset', onClick: () => { delete designOf()[sel]; S.ver++; render(); save(); renderPanel(); } }, 'Reset this part'),
        sided ? h('button', { type: 'button', class: 'btn', testid: 'design-copy-side', onClick: () => { const other = partKey(S.sel.part, S.sel.side === 'R' ? 'L' : 'R'); designOf()[other] = JSON.parse(JSON.stringify(d[sel] || newPart())); S.ver++; render(); save(); renderPanel(); setMessage('Copied to the other side.'); } }, 'Copy to the other side') : null)));
    const sh = cur.shadow;
    host.append(h('section', { class: 'group', testid: 'design-shadow' }, h('h3', null, 'Drop shadow'),
      check('Shadow', sh.on, (v) => set({ shadow: { ...sh, on: v } }, true), 'design-shadow-on'),
      sh.on ? slider('Across', () => sh.x, (v) => set({ shadow: { ...(designOf()[sel] || newPart()).shadow, x: v } }), -40, 40, 1, 'design-shadow-x') : null, sh.on ? slider('Down', () => sh.y, (v) => set({ shadow: { ...(designOf()[sel] || newPart()).shadow, y: v } }), -40, 40, 1, 'design-shadow-y') : null,
      sh.on ? slider('Soft', () => sh.blur, (v) => set({ shadow: { ...(designOf()[sel] || newPart()).shadow, blur: v } }), 0, 40, 1, 'design-shadow-blur') : null, sh.on ? slider('Strength', () => sh.opacity, (v) => set({ shadow: { ...(designOf()[sel] || newPart()).shadow, opacity: v } }), 0, 1, 0.01, 'design-shadow-opacity') : null,
      sh.on ? h('div', { class: 'row noreset' }, h('span', { class: 'lab' }, h('span', { class: 'name' }, 'Colour')), h('input', { type: 'color', class: 'color', value: sh.color, 'aria-label': 'Shadow colour', testid: 'design-shadow-color', onInput: (e) => set({ shadow: { ...(designOf()[sel] || newPart()).shadow, color: e.target.value } }) })) : null));
    const sk = cur.skin; const fileIn = h('input', { type: 'file', accept: PICTURE_VIDEO_ACCEPT, class: 'sr', tabindex: '-1', 'aria-label': 'Choose a skin picture', testid: 'design-skin-file', onChange: (e) => { pickSkinPicture(e.target.files?.[0]); e.target.value = ''; } });
    const live = () => designOf()[sel] || newPart();
    const sset = (patch, panel = false) => set({ skin: { ...live().skin, ...patch } }, panel);
    const sheetCells = sk ? sk.cols * sk.rows : 1;
    uvCanvas = h('canvas', { class: 'uvprev', width: 240, height: 240, role: 'img', 'aria-label': 'The skin picture, with the part outlined where it falls in it', testid: 'design-uv', onPointerdown: uvDown, onPointermove: uvMove, onPointerup: uvUp, onPointercancel: uvUp });
    uvCanvas.style.touchAction = 'none'; uvCanvas.style.cursor = 'move';
    host.append(h('section', { class: 'group', testid: 'design-skin' }, h('h3', null, 'Skin'), fileIn,
      h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn primary', testid: 'design-skin-add', onClick: () => fileIn.click() }, sk ? 'Replace the picture…' : 'Choose a picture…'), sk ? h('button', { type: 'button', class: 'btn', testid: 'design-skin-remove', onClick: () => set({ skin: null }, true) }, 'Remove the skin') : null),
      sk ? h('div', null, uvCanvas,
        h('p', { class: 'hint' }, 'The dashed box is the part\'s UV box, the blue outline is the part, where they fall on the picture. Drag inside to slide the picture under the part; drag a corner to scale it (both ways), or an edge to scale along or across. "Along" runs from the joint the part swings from toward its far end; "across" is the other way.'),
        h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'design-fit', onClick: () => { sset({ u: 0, v: 0, su: 1, sv: 1, rot: 0, flip: false, fit: 'stretch' }, true); } }, 'Fit to the part')),
        slider('Scale (both ways)', () => +((sk.su + sk.sv) / 2).toFixed(3), (v) => { const l = live().skin; const m = (l.su + l.sv) / 2; const f = v / Math.max(1e-6, m); sset({ su: Math.min(10, Math.max(0.05, l.su * f)), sv: Math.min(10, Math.max(0.05, l.sv * f)) }); }, 0.1, 6, 0.01, 'design-scale'),
        seg('Fit', [['stretch', 'Stretch'], ['tile', 'Tile']], sk.fit, (v) => sset({ fit: v }, true), 'design-fit'),
        slider('Sheet columns', () => sk.cols, (v) => sset({ cols: Math.round(v), cell: Math.min(sk.cell, Math.round(v) * sk.rows - 1) }, true), 1, 16, 1, 'design-cols'), slider('Sheet rows', () => sk.rows, (v) => sset({ rows: Math.round(v), cell: Math.min(sk.cell, sk.cols * Math.round(v) - 1) }, true), 1, 16, 1, 'design-rows'),
        sheetCells > 1 ? slider('Cell', () => sk.cell, (v) => sset({ cell: Math.round(v) }), 0, sheetCells - 1, 1, 'design-cell') : null,
        sheetCells > 1 ? seg('Play the cells', [['none', 'Hold'], ['loop', 'Loop'], ['pingpong', 'Ping-pong']], sk.anim, (v) => sset({ anim: v }, true), 'design-anim') : null,
        sheetCells > 1 && sk.anim !== 'none' ? slider('Frames per cell', () => sk.cellFrames, (v) => sset({ cellFrames: Math.round(v) }), 1, 24, 1, 'design-cellframes') : null,
        slider('Slide along', () => sk.u, (v) => sset({ u: v }), -1, 1, 0.01, 'design-u'), slider('Slide across', () => sk.v, (v) => sset({ v }), -1, 1, 0.01, 'design-v'),
        slider('Scale along', () => sk.su, (v) => sset({ su: v }), 0.05, 10, 0.01, 'design-su'), slider('Scale across', () => sk.sv, (v) => sset({ sv: v }), 0.05, 10, 0.01, 'design-sv'),
        slider('Turn', () => sk.rot, (v) => sset({ rot: v }), -180, 180, 1, 'design-rot'), check('Flip', sk.flip, (v) => sset({ flip: v }, true), 'design-flip'),
        slider('Skin opacity', () => sk.opacity, (v) => sset({ opacity: v }), 0, 1, 0.01, 'design-skin-opacity'), seg('Blend', SKIN_BLENDS, sk.blend, (v) => sset({ blend: v }, true), 'design-blend')) : h('p', { class: 'hint' }, 'A picture, or a sheet of pictures in a grid. A plain picture is stretched over the part; set the columns and rows for a sprite sheet, and choose which cell shows or have them play.')));
    setTimeout(refreshUv, 0);
  } else host.append(h('p', { class: 'hint', testid: 'design-none' }, 'Nothing chosen. Tap a part on the stage, or choose one above.'));
  const sheetIn = h('input', { type: 'file', accept: PICTURE_ACCEPT, class: 'sr', tabindex: '-1', 'aria-label': 'Choose a painted sheet', testid: 'design-sheet-file', onChange: (e) => { applyAtlas(e.target.files?.[0]); e.target.value = ''; } });
  const any = Object.values(d).some((p) => p.skin);
  host.append(h('section', { class: 'group', testid: 'design-sheet' }, h('h3', null, 'Whole figure'), sheetIn,
    h('p', { class: 'hint' }, 'Colour the whole figure on one flat sheet: save a UV template (one cell for each part, with its outline in it), paint over it in any app, and bring it back. Every part takes its own cell and wears it as it moves.'),
    h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'design-uv-export', onClick: exportUvTemplate }, 'Save a UV template'), h('button', { type: 'button', class: 'btn', testid: 'design-uv-import', onClick: () => sheetIn.click() }, 'Import painted sheet…'),
      h('button', { type: 'button', class: 'btn', testid: 'design-skins-clear', disabled: !any, onClick: () => { for (const p of Object.values(designOf())) p.skin = null; for (const k of Object.keys(designOf())) if (isPlain(designOf()[k])) delete designOf()[k]; S.ver++; render(); save(); renderPanel(); } }, 'Remove all skins'))),
    h('section', { class: 'group', testid: 'design-character' }, h('h3', null, 'Character file'),
      h('p', { class: 'hint' }, 'The figure, its walk, proportions, look, attachments, design and pads, in one file, with the pictures they use. Import puts a saved character on the stage.'),
      h('div', { class: 'btnrow' }, h('button', { type: 'button', class: 'btn', testid: 'design-char-export', onClick: exportCharacter }, 'Export this character…'), h('button', { type: 'button', class: 'btn', testid: 'design-char-import', onClick: () => document.querySelector('[data-testid="character-load"]')?.click() }, 'Import a character…'))));
  return host;
}
/** The figure as a character file's content. */
function packCurrentCharacter(name) {
  const fig = figKey(); const urls = imageUrls(); const images = {};
  for (const a of S.attach[fig] || []) if (a.img && urls[a.img]) images[a.img] = urls[a.img];
  for (const p of Object.values(S.design[fig] || {})) if (p.skin?.img && urls[p.skin.img]) images[p.skin.img] = urls[p.skin.img];
  return packCharacter({ name, figure: fig, p: S.p, r: S.r, s: S.s, motion: S.motion, attach: S.attach[fig] || [], design: S.design[fig] || {}, pads: BANKS[fig] || null, images });
}
function exportCharacter() {
  const n = typeof prompt === 'function' ? prompt('Name this character', `${FIG_LABELS[figKey()]} character`) : `${FIG_LABELS[figKey()]} character`; const name = fileSafe(n); if (!name) return;
  return deliver(new Blob([JSON.stringify(packCurrentCharacter(name), null, 1)], { type: 'application/json' }), `${name}.character.json`).then(() => setMessage(`Saved ${name}.character.json: the figure, its walk, look, attachments, design and pads.`));
}
/** Puts a character file's content on the stage as the main figure. */
async function importCharacterObject(raw) {
  const c = readCharacter(raw, FIGS, DEFAULTS, STYLE_DEFAULTS); if (!c.ok) { setMessage(c.error); return false; }
  if (PADRUN) padFinish(true);
  if (c.figure !== figKey()) setFigure(c.figure);
  for (const [id, url] of Object.entries(c.images)) await registerImage(id, url);
  Object.assign(S.p, c.p); Object.assign(S.s, c.s); S.r = c.r; S.motion = cleanMotion(c.motion);
  S.attach[c.figure] = cleanAttach({ [c.figure]: c.attach })[c.figure]; const dz = cleanDesign({ [c.figure]: c.design }, FIGS); if (dz[c.figure]) S.design[c.figure] = dz[c.figure]; else delete S.design[c.figure];
  if (c.pads) BANKS[c.figure] = cleanBank(c.pads); MOOD.x = 0.5; MOOD.y = 0.5; MOOD.base = null;
  S.preset = 'Custom'; S.sel = null; S.attachSel = null; S.frame = 0; S.ver++; saveAttachImages(); buildStrip(); renderPanel(); render(); save();
  setMessage(`Imported ${c.name}.`); return true;
}
async function importCharacterFile(e) {
  const f = e.target.files?.[0]; e.target.value = ''; if (!f) return;
  try { await importCharacterObject(JSON.parse(await f.text())); } catch (err) { setMessage(`Could not read it: ${err.message}`); }
}

// ---------- the gait chart: which feet are down when ----------
function drawGaitChart(cv, rows) {
  const cs = getComputedStyle(document.documentElement); const tok = (n, d) => cs.getPropertyValue(n).trim() || d;
  const acc = tok('--accent', '#2b67e8'); const line = tok('--line', '#d7d7dd'); const ink = tok('--ink-2', '#5b5c66'); const soft = tok('--accent-soft', '#e2eaff');
  const W = 560; const rowH = 28; const H = rows.length * rowH + 24; const dpr = 2;
  cv.width = W * dpr; cv.height = H * dpr;
  const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H);
  const x0 = 100; const wBar = W - x0 - 10;
  ctx.font = '11px system-ui, sans-serif'; ctx.textBaseline = 'middle';
  ctx.fillStyle = ink; ctx.textAlign = 'center';
  for (const [u, l] of [[0, '0'], [0.25, '¼'], [0.5, '½'], [0.75, '¾'], [1, '1']]) { ctx.fillText(l, x0 + u * wBar, 8); ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(x0 + u * wBar, 15); ctx.lineTo(x0 + u * wBar, H - 4); ctx.stroke(); }
  rows.forEach((r, i) => {
    const y = 20 + i * rowH;
    ctx.fillStyle = ink; ctx.textAlign = 'left'; ctx.fillText(r.name, 4, y + 9);
    ctx.fillStyle = soft; ctx.fillRect(x0, y, wBar, 18);
    const span = (a, b) => { ctx.fillStyle = acc; ctx.fillRect(x0 + a * wBar, y, (b - a) * wBar, 18); };
    const s = ((r.start % 1) + 1) % 1; const e = s + r.duty;
    if (e <= 1) span(s, e); else { span(s, 1); span(0, e - 1); }
    ctx.fillStyle = tok('--ink', '#1c1c20'); ctx.beginPath(); ctx.moveTo(x0 + s * wBar - 4, y - 3); ctx.lineTo(x0 + s * wBar + 4, y - 3); ctx.lineTo(x0 + s * wBar, y + 3); ctx.closePath(); ctx.fill(); // the contact
  });
}
/** The walk in one line: how long both feet are down, the pace and the stride (the chart that used to sit here took the top of the panel). */
function gaitFactsText() {
  const dog = S.p.rig === 'dog';
  let rows; const facts = [];
  if (dog) {
    const names = { HR: 'Hind right', HL: 'Hind left', FR: 'Front right', FL: 'Front left' };
    rows = legsOf(S.p).map((l) => ({ name: names[l] || l, start: pawGait(S.p, l).ph, duty: pawGait(S.p, l).duty }));
    const st = supportStats(rows); const cps = S.p.fps / Math.max(1, S.p.cycleFrames);
    facts.push(`${st.mean.toFixed(1)} feet down on average`, st.flight > 0.01 ? `in the air ${Math.round(st.flight * 100)}% of the cycle` : 'never in the air', `${cps.toFixed(1)} cycles a second`, `stride ${S.p.dogStride.toFixed(2)}`);
  } else {
    const g = gaitSummary(S.p); rows = g.rows;
    facts.push(`both feet down ${Math.round(g.doubleSupport * 100)}% of the time`, g.flight > 0.01 ? `in the air ${Math.round(g.flight * 100)}%` : null, `${Math.round(g.stepsPerMin)} steps a minute`, `${g.speed.toFixed(2)} legs a second`, `stride ${g.stride.toFixed(2)} legs`, Math.abs(g.stepRatio - 1) > 0.03 ? `uneven steps (${g.stepRatio.toFixed(2)} to 1)` : null);
  }
  return facts.filter(Boolean).join('  ·  ');
}
const gaitChartSection = () => h('p', { class: 'hint gait-line', testid: 'gait-facts' }, gaitFactsText());
function refreshGaitLine() { const el = document.querySelector('[data-testid="gait-facts"]'); if (el) el.textContent = gaitFactsText(); }

// ---------- speech: text to mouth shapes ----------
function buildSpeechNow() {
  const text = String(S.speechDraft ?? S.speech?.text ?? '').trim();
  if (!text) { setMessage('Type something for the head to say first.'); return; }
  S.speech = buildSpeech(text, { fps: S.p.fps, start: S.speechStart, speed: S.speechSpeed });
  const n = Math.max(2, Math.round(S.p.cycleFrames)); const need = S.speech.end + 6;
  if (need > n && S.perfLen < need) { S.perfLen = Math.min(MAX_FRAMES, need); } // the timeline grows to hold the speech
  S.ver++; S.mouthPreview = null; S.frame = Math.min(S.speech.start, Math.max(0, (S.perfLen > 0 ? S.perfLen : n) - 1));
  buildStrip(); renderPanel(); render(); save();
  setMessage(`${S.speech.keys.length} mouth shapes from frame ${S.speech.start + 1} to ${S.speech.end + 1}.`);
}
function clearSpeech() { S.speech = null; S.mouthPreview = null; S.ver++; buildStrip(); renderPanel(); render(); save(); setMessage('Speech cleared.'); }
let voiceToken = 0;
/** Jumps the playhead without stopping playback, for keeping the mouth in step with a voice. */
function seekLive(f) { const n = cycleFrames(P()).frames.length; S.frame = Math.max(0, Math.min(n - 1, Math.round(f))); acc = 0; S.mouthPreview = null; render(); }
/**
 * The device's voice reads the text while the mouth plays. The voice sets the pace: its speed is chosen to fit the length of the speech,
 * the mouth starts when the voice does, and each time the voice reaches a new word the mouth jumps to where that word begins.
 */
/**
 * While there is speech, or a mouth shape is held, a close-up of the face from the front sits in the corner of the stage. In the side view (the one it opens in) the face is edge on and the
 * mouth cannot be seen on the body, and the body is small in any view, so without this the mouth seems not to be working.
 */
let insetCanvas = null;
function paintFaceInset(ctx, cw, ch) {
  const id = S.speech || S.mouthPreview ? (S.mouthPreview || speechAt(S.speech, S.frame)) : null;
  if (!id || S.p.rig !== 'human' || S.source === 'sampled' || S.stageOnly) return;
  const side = Math.round(Math.max(96, Math.min(200, cw * 0.28, ch * 0.4))); const px = side * 2;
  insetCanvas ||= document.createElement('canvas'); if (insetCanvas.width !== px) { insetCanvas.width = px; insetCanvas.height = px; }
  const ic = insetCanvas.getContext('2d');
  const st = { ...S.s, focus: 'head', camYaw: -90, camPitch: 0, headZoom: 5.2, showGround: false, showArcs: false, showFootprints: false, showOnion: false, showScene: false, showMouthLabel: false, showFootLabels: false, background: '#ffffff', style: S.s.style === 'stick' || S.s.style === 'silhouette' ? 'mannequin' : S.s.style };
  try { drawScene(ic, { ...P(), scene: null }, st, px, px, S.frame, { mouth: S.mouthPreview, layers: { figure: true, guides: false } }); } catch { return; }
  const x = 12; const y = ch - side - 12;
  ctx.save(); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, side, side, 10) : ctx.rect(x, y, side, side); ctx.clip(); ctx.fillStyle = '#fff'; ctx.fillRect(x, y, side, side); ctx.drawImage(insetCanvas, x, y, side, side); ctx.restore();
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y, side, side, 10) : ctx.rect(x, y, side, side); ctx.stroke(); ctx.restore();
}
function playWithVoice() {
  const sp = S.speech; if (!sp) return;
  pause(); setFrame(sp.start);
  if (typeof speechSynthesis === 'undefined' || !sp.text) { play(); setMessage('There is no voice on this device. The mouth plays without sound.'); return; }
  try {
    const mark = ++voiceToken; let heard = false;
    const u = new SpeechSynthesisUtterance(sp.text);
    const secs = Math.max(0.3, (sp.end - sp.start) / S.p.fps);
    u.rate = Math.min(2.5, Math.max(0.5, sp.text.length / 14 / secs)); // about 14 letters a second at a voice's normal speed
    u.onstart = () => { if (mark === voiceToken) { seekLive(sp.start); play(); } };
    u.onboundary = (e) => {
      if (mark !== voiceToken || !S.playing || (e.name && e.name !== 'word')) return;
      heard = true;
      const w = [...(sp.words || [])].reverse().find((x) => x.c <= e.charIndex);
      if (w) seekLive(w.f);
    };
    u.onend = () => { if (mark === voiceToken && !heard) setMessage('This voice does not say where each word is, so the mouth keeps its own pace. Change Speed to match it.'); };
    speechSynthesis.speak(u);
    setTimeout(() => { if (mark === voiceToken && !S.playing) play(); }, 1500); // a voice that is slow to start does not hold the mouth up
  } catch { play(); }
}
function drawChart(canvas, id) {
  const ctx = canvas.getContext('2d'); const w = 96; const h = 64;
  canvas.width = w * 2; canvas.height = h * 2; ctx.scale(2, 2);
  ctx.fillStyle = '#f6f1e7'; ctx.fillRect(0, 0, w, h);
  paintMouth(ctx, id, ([z, y]) => ({ x: w / 2 + z * 70, y: h * 0.5 - y * 70 }), { line: '#26231f', lw: 2 });
}
function speechSection() {
  const wrap = h('div', { class: 'speech' });
  const sp = S.speech;
  const num = (label, value, min, max, on, tid) => h('label', { class: 'field' }, h('span', null, label), h('input', { type: 'number', class: 'num', inputmode: 'numeric', min, max, value, testid: tid, onChange: (e) => on(Number(e.target.value)) }));
  const say = h('section', { class: 'group', testid: 'speech-say' }, h('h3', null, 'Say'),
    S.p.rig === 'human' ? null : h('p', { class: 'hint' }, 'Mouth shapes are drawn on the human and rubber hose heads for now. Choose one of them in the Figure menu to see them.'),
    h('textarea', { class: 'speechtext', rows: 3, testid: 'speech-text', 'aria-label': 'What the head says', placeholder: 'Type what the head should say', onInput: (e) => { S.speechDraft = e.target.value; } }, S.speechDraft ?? sp?.text ?? ''),
    h('div', { class: 'btnrow' },
      num('Starts at frame', S.speechStart + 1, 1, MAX_FRAMES, (v) => { S.speechStart = Math.max(0, Math.round(v) - 1); }, 'speech-start'),
      h('button', { type: 'button', class: 'btn', testid: 'speech-playhead', onClick: () => { S.speechStart = S.frame; renderPanel(); } }, 'Use playhead')),
    h('label', { class: 'mini' }, h('span', { class: 'mini-l' }, 'Speed'), h('input', { type: 'range', class: 'rng', min: 0.5, max: 2, step: 0.05, value: S.speechSpeed, testid: 'speech-speed', 'aria-label': 'Speech speed', onInput: (e) => { S.speechSpeed = Number(e.target.value); } })),
    h('div', { class: 'btnrow' },
      h('button', { type: 'button', class: 'btn primary', testid: 'speech-build', onClick: buildSpeechNow }, sp ? 'Rebuild mouth shapes' : 'Build mouth shapes'),
      h('button', { type: 'button', class: 'btn', testid: 'speech-voice', disabled: !sp, onClick: playWithVoice }, 'Play with voice'),
      h('button', { type: 'button', class: 'btn', testid: 'speech-clear', disabled: !sp, onClick: clearSpeech }, 'Clear')),
    h('p', { class: 'hint' }, 'The words are turned into mouth shapes with simple English spelling rules, so odd spellings can come out a little wrong. Each shape sits on a frame in the timeline, labelled by its sounds.'));
  const chart = h('section', { class: 'group', testid: 'speech-chart' }, h('h3', null, 'Mouth shapes'),
    h('p', { class: 'hint' }, 'Tap a shape to hold it on the head and trace it. The head keeps it until the playhead moves.'),
    h('div', { class: 'mouthchart' }, VISEMES.map((v) => {
      const cv = document.createElement('canvas'); cv.className = 'mouththumb'; drawChart(cv, v.id);
      return h('button', { type: 'button', class: 'mouthbtn', testid: `mouth-${v.id}`, 'aria-pressed': String(S.mouthPreview === v.id), title: `${v.hint} (${v.sounds})`, onClick: () => { S.mouthPreview = S.mouthPreview === v.id ? null : v.id; renderPanel(); render(); } },
        cv, h('span', { class: 'mn' }, v.label), h('span', { class: 'ms' }, v.sounds));
    })));
  const keys = sp ? h('section', { class: 'group', testid: 'speech-keys' }, h('h3', null, `Shapes on the timeline (${sp.keys.length})`),
    h('div', { class: 'chips', role: 'group', 'aria-label': 'Mouth shapes in order' }, sp.keys.map((k) => h('button', { type: 'button', class: 'pchip', testid: `speech-key-${k.f}`, onClick: () => { pause(); setFrame(k.f); } }, `${k.f + 1} ${VISEME_BY_ID[k.v].code}`)))) : null;
  wrap.append(say, chart); if (keys) wrap.append(keys);
  return wrap;
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
    propRow(() => editor?.draw()),
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
  const keysBtn = h('button', { type: 'button', class: 'btn', id: 'keys', testid: 'export-keys', title: 'Only the frames that mark a change of direction or a contact, as PNGs with a note of why each was chosen', onClick: runKeyPoses }, 'Key frames only');
  const more = menuButton({ label: 'More exports', testid: 'export-more', items: () => [
    { label: 'Contact sheet', testid: 'export-sheet', onClick: runSheet },
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
  return h('section', { class: 'group' }, h('h3', null, 'Export'), sum, video, h('div', { class: 'row' }, share), h('div', { class: 'btnrow' }, go, keysBtn, cancel, more), prog, msg, h('div', { class: 'btnrow' }, settingsMenu));
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
    setMessage(`Saved ${r.count} key frames out of ${cycleFrames(P()).frames.length}. key_poses.json says why each was chosen.`);
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
const isDirty = () => S.savedState != null && S.savedState !== snapState();
function refreshSaveState() {
  const el = document.getElementById('savestate'); if (!el) return;
  const dirty = isDirty(); el.textContent = dirty ? 'Unsaved changes' : S.everSaved ? 'Saved' : ''; el.dataset.state = dirty ? 'dirty' : S.everSaved ? 'saved' : 'none';
  document.title = `${dirty ? '• ' : ''}${S.fileName} · Walk Base`;
}
const fileSafe = (n) => String(n || '').replace(/\.json$/i, '').replace(/[^\w \-]/g, '').trim().slice(0, 60);
/** Save under a new name: asks for the name, then saves. */
function saveAs() {
  const n = typeof prompt === 'function' ? prompt('Name this file', S.fileName) : S.fileName;
  const name = fileSafe(n); if (!name) return;
  S.fileName = name; saveSettings();
}
function saveSettings() {
  const blob = new Blob([JSON.stringify({ format: 'walk-base-settings', version: 2, name: S.fileName, preset: S.preset, p: S.p, s: S.s, x: S.x, r: S.r, motion: S.motion, lanes: S.lanes, perfLen: S.perfLen, attach: S.attach, speech: S.speech, scene: S.scene, mood: MOOD, pads: BANKS, design: S.design, images: usedImages() }, null, 1)], { type: 'application/json' });
  deliver(blob, `${S.fileName}.json`).then(() => { S.savedState = snapState(); S.everSaved = true; refreshSaveState(); setMessage(`Saved ${S.fileName}.json.`); });
}
async function loadSettings(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const raw = JSON.parse(await f.text());
    if (raw.format !== 'walk-base-settings') throw new Error('This is not a Walk Base settings file.');
    adopt(raw); if (raw.images && typeof raw.images === 'object') for (const [id, url] of Object.entries(raw.images)) if (typeof url === 'string' && url.startsWith('data:image/')) await registerImage(id, url);
    saveAttachImages(); if (!attachItem()) S.attachSel = null; buildStrip(); renderPanel(); render(); save();
    S.fileName = fileSafe(raw.name || f.name) || 'walk-settings'; S.savedState = snapState(); S.everSaved = true; refreshSaveState(); setMessage(`Loaded ${S.fileName}.`);
  } catch (err) { setMessage(`Could not load it: ${err.message}`); }
  e.target.value = '';
}

// ---------- layout ----------
function refreshViewbar() {
  document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === S.tool)));
  const t = document.querySelector('[data-testid="turntable"]');
  if (t) t.setAttribute('aria-pressed', String(S.s.autoOrbit));
  document.querySelector('[data-testid="head-view"]')?.setAttribute('aria-pressed', String(S.s.focus === 'head'));
  document.querySelectorAll('.viewbar .qv').forEach((b) => b.setAttribute('aria-pressed', String(S.s.camYaw === Number(b.dataset.yaw) && S.s.camPitch === Number(b.dataset.pitch))));
}
function resetAll() {
  if (!confirm('Reset every setting to its default?')) return;
  closeEditor(true); S.p = clone(DEFAULTS); S.s = clone(STYLE_DEFAULTS); S.x = clone(EXPORT_DEFAULTS); S.r = {}; S.motion = {}; S.lanes = {}; S.perfLen = 0; S.bank = { human: null, dog: null }; S.scene = EMPTY_SCENE(); S.sceneSel = null; S.speech = null; S.speechDraft = null; S.mouthPreview = null;
  S.ver++; pause(); setArmed(false); S.sel = null; S.preset = 'Normal'; S.zoom = 1; S.panX = S.panY = 0; S.frame = 0; build(); render(); save();
}
const goTab = (t) => { S.tab = t; renderPanel(); };

// ---------- seamless loop ----------
/** Adjusts the frame count, the length of a performance, its lanes and its pace so the last frame leads straight back into the first. */
function makeLoop() {
  pause();
  if (S.source === 'sampled') { setMessage('The loop button works on the 3D walk, not on sampled drawings.'); return null; }
  const was = { n: S.p.cycleFrames, len: S.perfLen, lanes: JSON.stringify(S.lanes) };
  const before = loopGap(P());
  const r = makeSeamless({ base: S.p, lanes: S.lanes, perfLen: S.perfLen, cycleFrames: S.p.cycleFrames, exposure: S.p.exposure });
  S.p.cycleFrames = r.cycleFrames; S.lanes = r.lanes; S.perfLen = r.perfLen; S.ver++; S.frame = 0;
  if (S.p.noiseAmount > 0 && S.p.noiseLoop === false) { S.p.noiseLoop = true; r.notes.push('The wobble is set to repeat every cycle.'); }
  if (S.p.travel === 'across') { S.p.travel = 'follow'; r.notes.push('The camera now follows the figure: crossing the screen cannot join up with its own start.'); }
  const changed = was.n !== S.p.cycleFrames || was.len !== S.perfLen || was.lanes !== JSON.stringify(S.lanes);
  if (changed) markCustom();
  buildStrip(); renderPanel(); render(); save();
  const after = loopGap(P());
  const bent = S.p.terrain && S.p.terrain !== 'flat' ? ' The ground does not repeat; the figure does.' : (S.p.heading || hasLanes(S.lanes) && S.lanes['p:heading']) ? ' The path turns, so the figure does not return to where it started; its movement repeats.' : '';
  setMessage(`Seamless loop of ${cycleFrames(P()).frames.length} frames. ${r.notes.join(' ')} The join is ${after.ratio <= 1.1 ? 'no bigger than any other step' : `still ${after.ratio.toFixed(1)} times the biggest step`}${changed || before.ratio > 1.1 ? ` (it was ${before.ratio.toFixed(1)} times).` : '.'}${bent}`);
  return { before, after, notes: r.notes, changed };
}

// ---------- copy and paste ----------
const CLIP_KEY = 'walkbase.clip';
const findSceneItem = (id) => S.scene.actors.find((a) => a.id === id) || S.scene.props.find((p) => p.id === id) || null;
const jclone = (v) => JSON.parse(JSON.stringify(v));
function loadClip() {
  if (S.clipboard) return S.clipboard;
  try { const c = JSON.parse(localStorage.getItem(CLIP_KEY) || 'null'); if (c?.kind) { S.clipboard = c; return c; } } catch { /* none */ }
  return null;
}
function setClip(clip, what) {
  S.clipboard = clip; try { localStorage.setItem(CLIP_KEY, JSON.stringify(clip)); } catch { /* kept for this visit only */ }
  setMessage(`Copied ${what}. Paste with Ctrl+V or Edit > Paste.`);
}
const clipOfAttach = (it) => ({ kind: 'attach', item: jclone(it) });
const clipOfScene = (it) => ({ kind: S.scene.actors.includes(it) ? 'actor' : 'prop', item: jclone(it) });
const clipOfMain = () => ({ kind: 'figure', fig: figKey(), preset: S.preset, p: jclone(S.p), r: jclone(S.r), colours: { fill: S.s.fillColor, line: S.s.lineColor, tint: S.s.farTint } });
/** Copies what is selected: a picture or shape, a figure or scenery in the scene, otherwise the main figure. */
function copySelection() {
  const a = attachItem(); const sc = S.sceneSel && S.sceneSel !== 'main' ? findSceneItem(S.sceneSel) : null;
  if (a) setClip(clipOfAttach(a), `"${a.name}"`);
  else if (sc) setClip(clipOfScene(sc), `"${sc.name}"`);
  else setClip(clipOfMain(), 'the main figure');
}
/** Puts the clipboard into the scene, or on the figure for a picture or shape. Pictures go on the selected part, or the part they came from. */
function pasteClipboard() {
  const clip = loadClip(); if (!clip) { setMessage('Nothing has been copied yet.'); return; }
  if (clip.kind === 'attach') {
    const it = cloneItem(clip.item); const targets = attachTargets(S.p.rig);
    if (S.sel || !targets.some((t) => t.key === targetKey(it))) { const t = defaultTarget(); it.part = t.part; it.seg = t.seg ?? null; it.side = t.side ?? null; }
    it.x += 0.04; it.y += 0.04; attachList().push(it); selectAttach(it.id); save(); setMessage(`Pasted "${it.name}".`); return;
  }
  const stamp = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  if (clip.kind === 'actor' || clip.kind === 'prop') {
    const c = jclone(clip.item); c.id = stamp(); c.name = `${c.name} copy`; c.x = Math.min(12, c.x + 0.8);
    (clip.kind === 'actor' ? S.scene.actors : S.scene.props).push(c); S.sceneSel = c.id; S.tab = 'Gait'; sceneChanged(true); setMessage(`Pasted "${c.name}".`); return;
  }
  if (clip.kind === 'figure') {
    const n = S.scene.actors.length;
    const a = newActor(clip.fig, FIG_LABELS[clip.fig] || clip.fig, jclone(clip.p), jclone(clip.r), { preset: clip.preset, x: 1.3 + n * 0.9, z: n % 2 ? 0.55 : -0.55, phase: (0.25 + 0.2 * n) % 1, fill: clip.colours?.fill || '', line: clip.colours?.line || '', tint: clip.colours?.tint || '' });
    S.scene.actors.push(a); S.sceneSel = a.id; S.tab = 'Gait'; sceneChanged(true); setMessage('Pasted the figure into the scene.');
  }
}
function duplicateSelection() { copySelection(); pasteClipboard(); }
const deletableSelection = () => Boolean(attachItem() || (S.sceneSel && S.sceneSel !== 'main' && findSceneItem(S.sceneSel)));
function deleteSelection() {
  const a = attachItem();
  if (a) { S.attach[figKey()] = attachList().filter((x) => x.id !== a.id); S.attachSel = null; renderPanel(); render(); save(); return; }
  if (S.sceneSel && S.sceneSel !== 'main' && findSceneItem(S.sceneSel)) removeSceneItem(S.sceneSel);
}

// ---------- the help overlay ----------
const HELP_STOPS = [
  ['.menubar', 'Menus', 'File saves, opens and exports. Edit has undo, copy, paste and delete. View sets the theme and layout. Performance plays and records.'],
  ['.bar-fields', 'The figure and its walk', 'Choose the figure, its walk (the preset), the preview speed, and whether the stage shows the 3D walk or your own drawings.'],
  ['.viewbar', 'Stage tools', 'Select is for tapping and moving things. Orbit and Pan move the camera with one finger. View and the angle buttons jump to a view; the face button looks at the head.'],
  ['[data-testid="stage"]', 'The stage', 'Tap a part, a picture or a figure to select it. Press and hold (right-click on a mouse) for a menu for what is under your finger. Two fingers pan and zoom. Mouse: middle button pivots, Shift with it pans, the wheel zooms.'],
  ['.tabs', 'Tabs', 'Body: the scene, the walk, the body and the proportions. Parts: every joint and its curve. Attach: shapes and pictures. Design: a look, a skin and a shadow for each part. Auto: moves, recording and lanes. Speech, View, Sampler and Export.'],
  ['.timeline', 'The timeline', 'Play, step and scrub the frames. Letters under a frame mark the key poses. Tap a frame to go there. Loop makes the join seamless; Length makes the playback longer without changing the speed of the walk.'],
  ['[data-testid="mood-pad"]', 'Mood pad', 'The middle is the walk as it is. Drag the dot toward a corner for that mood, or along an edge to mix two. Each corner can be a mood, one of the walks, or a walk you captured.'],
  ['[data-testid="pad-grid"]', 'Pads', 'Eight walks to switch between. Tap an empty pad to keep the walk on it; tap a full one to change to it, at once or at the end of the cycle, blending over the cycles you choose.'],
];
const HELP_HOW = [
  ['Record the mood pad and the pads', 'Press the red Rec button by Play, then Play. Drag the mood dot, tap pads or move any slider while it plays; pause to end the take. What you did is now automation on the timeline: it plays back, loops and exports. A pad is a change of walk, so it holds to the end of the performance. The mood dot and the sliders follow the recording mode (Performance menu): Touch records while you hold and glides back when you let go; Latch holds the last value until you pause.'],
  ['Make it longer', 'Length, beside Loop, sets how many cycles or seconds the playback runs. A take starts six cycles long if there is no performance yet.'],
  ['Change or undo a take', 'The Auto tab lists every lane that was recorded: open one to redraw it, or remove it. Ctrl+Z undoes the whole take.'],
  ['Help for one control', 'Rest the mouse on any slider or choice for a line about it. On a touch screen, tap its name.'],
];
// ---------- help on hover, with a mouse ----------
// Every slider and choice has a line of help that opens when its name is tapped. With a mouse, resting the pointer on the row shows the same line beside it.
let tipEl = null; let tipTimer = 0; let tipRow = null;
function hideTip() { clearTimeout(tipTimer); tipTimer = 0; tipRow = null; if (tipEl) { tipEl.remove(); tipEl = null; } }
function showTip(row) {
  const text = row.querySelector(':scope > .help')?.textContent?.trim(); if (!text || row.classList.contains('open') || !row.isConnected) return;
  hideTip(); tipRow = row;
  tipEl = h('div', { class: 'hovertip', role: 'tooltip', testid: 'hover-help' }, text); document.body.append(tipEl);
  const r = row.getBoundingClientRect(); const w = tipEl.offsetWidth; const hh = tipEl.offsetHeight; const vw = window.innerWidth; const vh = window.innerHeight;
  let left = r.left - w - 10; let top = r.top; // beside the row, on the stage side, so it never covers the control it explains
  if (left < 8) { left = Math.min(vw - w - 8, Math.max(8, r.left)); top = r.bottom + 6; if (top + hh > vh - 8) top = Math.max(8, r.top - hh - 6); }
  tipEl.style.left = `${Math.round(left)}px`; tipEl.style.top = `${Math.round(Math.min(vh - hh - 8, Math.max(8, top)))}px`;
}
function initHoverHelp() {
  document.addEventListener('pointermove', (e) => { // only a mouse that is moving: a panel that redraws under a still pointer shows nothing
    if (e.pointerType !== 'mouse' || e.buttons) return;
    const row = e.target.closest?.('.row'); if (row === tipRow) return;
    hideTip(); if (!row || !row.querySelector(':scope > .help')) return;
    tipRow = row; tipTimer = setTimeout(() => showTip(row), 450);
  });
  for (const ev of ['pointerdown', 'wheel', 'keydown']) document.addEventListener(ev, hideTip, { capture: true, passive: true });
  document.addEventListener('scroll', hideTip, { capture: true, passive: true });
  document.addEventListener('pointerleave', hideTip);
}
initHoverHelp();
let helpEl = null;
function closeHelp() { if (!helpEl) return; helpEl.remove(); helpEl = null; window.removeEventListener('resize', openHelpAgain); document.removeEventListener('keydown', helpKey, true); try { localStorage.setItem('walkbase.helpSeen', '1'); } catch { /* not kept */ } }
const helpKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeHelp(); } };
const openHelpAgain = () => { if (helpEl) openHelp(); };
function openHelp() {
  const was = Boolean(helpEl); if (helpEl) { helpEl.remove(); helpEl = null; }
  closeMenus();
  const root = h('div', { class: 'help-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'A quick guide to the screen', testid: 'help-overlay' });
  const list = [];
  HELP_STOPS.forEach(([sel, title, text], i) => {
    const t = document.querySelector(sel); const r = t?.getBoundingClientRect(); if (!r || !r.width || !r.height) return;
    root.append(h('div', { class: 'help-box', style: `left:${r.left - 3}px;top:${r.top - 3}px;width:${r.width + 6}px;height:${r.height + 6}px` }, h('span', { class: 'help-badge' }, String(i + 1))));
    list.push(h('li', null, h('span', { class: 'help-badge' }, String(i + 1)), h('div', null, h('strong', null, title), h('p', null, text))));
  });
  const keys = [['Space', 'play or pause'], ['Left and right arrows', 'one frame'], ['Ctrl+Z, Shift+Ctrl+Z', 'undo, redo'], ['Ctrl+C, Ctrl+V, Ctrl+D', 'copy, paste, duplicate'], ['Delete', 'delete the selection'], ['Ctrl+S', 'save'], ['Esc', 'deselect, or close this'], ['F1 or ?', 'this guide']];
  root.append(h('div', { class: 'help-card', testid: 'help-card' }, h('h2', null, 'A quick guide'), h('ol', null, list),
    h('div', { class: 'help-keys' }, h('h3', null, 'Keys'), h('dl', null, keys.flatMap(([k, d]) => [h('dt', null, k), h('dd', null, d)])),
      h('h3', null, 'How to'), h('div', { class: 'help-how', testid: 'help-how' }, HELP_HOW.map(([t, d]) => h('p', null, h('strong', null, `${t}. `), d)))),
    h('button', { type: 'button', class: 'btn primary', testid: 'help-close', onClick: closeHelp }, 'Got it')));
  root.addEventListener('pointerdown', (e) => { if (e.target === root) closeHelp(); });
  document.body.append(root); helpEl = root;
  if (!was) { window.addEventListener('resize', openHelpAgain); document.addEventListener('keydown', helpKey, true); }
  root.querySelector('[data-testid="help-close"]')?.focus();
}
function menuBar() {
  const mb = (label, testid, items) => menuButton({ label, testid, items, bar: 'main', className: 'btn mb', caret: false });
  return h('nav', { class: 'menubar', role: 'menubar', 'aria-label': 'Menus' },
    mb('File', 'menu-file', () => [
      { label: 'New: clear everything', testid: 'file-new', onClick: newSession },
      { label: 'Reopen with last session', testid: 'file-resume', radio: true, checked: LAYOUT.resume, onClick: () => { LAYOUT.resume = !LAYOUT.resume; layoutSave(); render(); setMessage(LAYOUT.resume ? 'The next visit reopens where you left off.' : 'The next visit starts clean.'); } },
      { separator: true },
      { label: 'Save', testid: 'file-save', shortcut: 'Ctrl+S', onClick: saveSettings },
      { label: 'Save as…', testid: 'file-save-as', onClick: saveAs },
      { label: 'Open…', testid: 'file-load', onClick: () => document.querySelector('[data-testid="settings-load"]')?.click() },
      { separator: true },
      { label: 'Export this character…', testid: 'file-char-export', onClick: exportCharacter },
      { label: 'Import a character…', testid: 'file-char-import', onClick: () => document.querySelector('[data-testid="character-load"]')?.click() },
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
      { label: 'Copy', testid: 'menu-copy', shortcut: 'Ctrl+C', onClick: copySelection },
      { label: 'Paste', testid: 'menu-paste', shortcut: 'Ctrl+V', disabled: !loadClip(), onClick: pasteClipboard },
      { label: 'Duplicate', testid: 'menu-dup', shortcut: 'Ctrl+D', onClick: duplicateSelection },
      { label: 'Delete', testid: 'menu-delete', shortcut: 'Del', disabled: !deletableSelection(), onClick: deleteSelection },
      { separator: true },
      { label: 'Reset all settings…', testid: 'reset-all', onClick: resetAll },
    ]),
    mb('View', 'menu-view', () => [
      { label: 'Stage only', testid: 'stage-only', checked: S.stageOnly, onClick: () => { S.stageOnly = !S.stageOnly; document.body.classList.toggle('stage-only', S.stageOnly); render(); } },
      { label: 'Frame information on the stage', testid: 'view-hud', checked: LAYOUT.hud, onClick: () => { LAYOUT.hud = !LAYOUT.hud; layoutSave(); render(); } },
      { label: 'Pose labels on the stage', testid: 'view-pose-labels', checked: Boolean(S.s.showLabels), onClick: () => { S.s.showLabels = !S.s.showLabels; render(); save(); } },
      { label: 'Fit figure to window', testid: 'menu-fit', onClick: () => { S.zoom = 1; S.panX = S.panY = 0; render(); } },
      { separator: true },
      { heading: 'Theme' },
      ...[['auto', 'Follow the device'], ['light', 'Light'], ['dark', 'Dark']].map(([v, l]) => ({ label: l, testid: `theme-${v}`, radio: true, checked: LAYOUT.theme === v, onClick: () => setTheme(v) })),
      { separator: true },
      { heading: 'Slider rows' },
      ...[['auto', 'Automatic'], ['compact', 'Compact'], ['roomy', 'Roomy: label above the slider']].map(([v, l]) => ({ label: l, testid: `rows-${v}`, radio: true, checked: (LAYOUT.rows || 'auto') === v, onClick: () => setRows(v) })),
      { separator: true },
      { heading: 'Interface size' },
      ...[['auto', 'Automatic'], ['compact', 'Compact'], ['comfortable', 'Comfortable']].map(([v, l]) => ({ label: l, testid: `density-${v}`, radio: true, checked: LAYOUT.density === v, onClick: () => setDensity(v) })),
    ]),
    mb('Performance', 'menu-perf', () => [
      { label: S.playing ? 'Pause' : 'Play', testid: 'pm-play', onClick: () => (S.playing ? pause() : play()) },
      { label: 'Make a seamless loop', testid: 'pm-loop', onClick: makeLoop },
      { separator: true },
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
/** Proportional editing: the controls shared by the curve editors (and the arc dots). */
function propRow(redraw) {
  const radiusLabel = h('span', { class: 'num-out' }, `${Math.round(PROP.radius * 100)}%`);
  const btn = h('button', { type: 'button', class: 'btn', testid: 'prop-toggle', 'aria-pressed': String(PROP.on), title: 'Proportional editing: moving a point also moves the points near it, by less the further they are, so the curve bends in a smooth arc.', onClick: (e) => { setProp({ on: !PROP.on }); e.currentTarget.setAttribute('aria-pressed', String(PROP.on)); redraw?.(); } }, 'Proportional');
  const rad = h('input', { type: 'range', class: 'rng', min: 2, max: 50, step: 1, value: Math.round(PROP.radius * 100), 'aria-label': 'Proportional reach', testid: 'prop-radius', onInput: (e) => { setProp({ radius: Number(e.target.value) / 100 }); radiusLabel.textContent = `${e.target.value}%`; redraw?.(); } });
  const fall = h('select', { class: 'select', 'aria-label': 'Falloff', testid: 'prop-falloff', onChange: (e) => { setProp({ type: e.target.value }); redraw?.(); } }, FALLOFFS.map(([k, l]) => h('option', { value: k, selected: k === PROP.type }, l)));
  return h('div', { class: 'pop-row prop-row' }, btn, h('label', { class: 'prop-reach' }, h('small', null, 'Reach'), rad, radiusLabel), fall);
}
const iconBtn = (name, label, testid, onClick, extra = {}) => h('button', { type: 'button', class: 'btn ghost icon', testid, 'aria-label': label, title: label, onClick, ...extra }, icon(name), h('span', { class: 'sr' }, label));

function build() {
  const app = document.getElementById('app');
  app.textContent = '';
  const presetSel = h('select', { id: 'preset', class: 'select', 'aria-label': 'Movement preset', testid: 'preset', onChange: (e) => { if (e.target.value !== 'Custom') applyPreset(e.target.value); } },
    [...Object.keys(presetsForFigure(figKey())), 'Custom'].map((n) => h('option', { value: n, selected: n === S.preset }, n)));
  const speedSel = h('select', { class: 'select', 'aria-label': 'Preview speed', testid: 'speed', onChange: (e) => { S.rate = Number(e.target.value); } }, [0.25, 0.5, 1, 2].map((r) => h('option', { value: r, selected: r === 1 }, `${r}×`)));
  const settingsFile = h('input', { type: 'file', accept: '.json,application/json', class: 'sr', tabindex: '-1', 'aria-label': 'Load settings file', testid: 'settings-load', onChange: loadSettings });
  const header = h('header', { class: 'bar' },
    h('div', { class: 'brand' }, 'Walk Base'),
    h('span', { class: 'savestate', id: 'savestate', testid: 'savestate', role: 'status', 'aria-live': 'polite' }),
    menuBar(),
    h('span', { class: 'bar-sep', role: 'presentation' }),
    iconBtn('undo', 'Undo', 'undo', undo, { disabled: !hist.canUndo, title: 'Undo (Ctrl or Cmd + Z)' }),
    iconBtn('redo', 'Redo', 'redo', redo, { disabled: !hist.canRedo, title: 'Redo (Shift + Ctrl or Cmd + Z)' }),
    iconBtn('help', 'Help: a quick guide to the screen', 'help', openHelp, { title: 'Help (F1 or ?)' }),
    h('div', { class: 'bar-fields' },
      h('label', { class: 'pillfield' }, h('small', null, 'Figure'), h('select', { id: 'rig', class: 'select', 'aria-label': 'Which figure', testid: 'rig', onChange: (e) => setFigure(e.target.value) },
        FIG_GROUPS.map(([g, list]) => h('optgroup', { label: g }, list.map((f) => h('option', { value: f, selected: f === figKey() }, FIG_LABELS[f])))))),
      h('label', { class: 'pillfield' }, h('small', null, 'Preset'), presetSel),
      h('label', { class: 'pillfield' }, h('small', null, 'Speed'), speedSel),
      h('label', { class: 'pillfield' }, h('small', null, 'Source'), h('select', { id: 'source', class: 'select', 'aria-label': 'What is on the stage', testid: 'source', onChange: (e) => setSource(e.target.value) },
        h('option', { value: 'walk', selected: S.source === 'walk' }, '3D walk'), h('option', { value: 'sampled', selected: S.source === 'sampled' }, 'Sampled drawings')))),
    settingsFile, h('input', { type: 'file', accept: '.json,application/json', class: 'sr', tabindex: '-1', 'aria-label': 'Load a character file', testid: 'character-load', onChange: importCharacterFile }));
  stage = h('canvas', { class: 'stage', testid: 'stage', 'aria-label': 'Walk preview. Tap a body part to select it. Drag to orbit.', role: 'img' });
  hud = h('div', { class: 'hud', testid: 'hud', 'aria-live': 'off' });
  const setView = (yaw, pitch) => { S.s.camYaw = yaw; S.s.camPitch = pitch; if (S.tab === 'View') renderPanel(); render(); save(); };
  const vb = (name, label, id, fn, attrs = {}) => h('button', { type: 'button', class: `btn vb icon${id === 'fit' ? '' : ' cam'}`, testid: id, 'aria-label': label, title: label, onClick: fn, ...attrs }, icon(name), h('span', { class: 'sr' }, label));
  const views = [['Side', 0, 0, 'view-side'], ['¾ front', -40, 12, 'view-34'], ['Front', -90, 0, 'view-front'], ['Back', 90, 0, 'view-back'], ['Top', 0, 80, 'view-top']];
  const viewMenu = menuButton({ label: 'View', testid: 'view-menu', className: 'btn vb cam', title: 'Camera view', items: () => views.map(([l, y, p, id]) => ({ label: l, testid: id, radio: true, checked: S.s.camYaw === y && S.s.camPitch === p, onClick: () => setView(y, p) })) });
  const viewbar = h('div', { class: 'viewbar', role: 'toolbar', 'aria-label': 'Camera' },
    vb('select', 'Select: tap to select, drag to move what you touch. Two fingers pan and zoom.', 'tool-select', () => { S.tool = 'select'; refreshViewbar(); }, { 'data-tool': 'select' }),
    vb('orbit', 'Orbit', 'tool-orbit', () => { S.tool = 'orbit'; refreshViewbar(); }, { 'data-tool': 'orbit' }),
    vb('pan', 'Pan', 'tool-pan', () => { S.tool = 'pan'; refreshViewbar(); }, { 'data-tool': 'pan' }),
    h('span', { class: 'vsep cam', role: 'presentation' }), viewMenu,
    ...views.map(([l, y, p, id]) => h('button', { type: 'button', class: 'btn vb cam qv', testid: `qv-${id.slice(5)}`, 'data-yaw': y, 'data-pitch': p, 'aria-label': `${l} view`, title: `${l} view`, 'aria-pressed': 'false', onClick: () => setView(y, p) }, { 'Side': 'Side', '¾ front': '¾', Front: 'Front', Back: 'Back', Top: 'Top' }[l])),
    h('span', { class: 'vsep cam', role: 'presentation' }),
    vb('spin', 'Spin', 'turntable', () => { S.s.autoOrbit = !S.s.autoOrbit; refreshViewbar(); save(); }, { 'aria-pressed': 'false' }),
    vb('face', 'Head view', 'head-view', () => { S.s.focus = S.s.focus === 'head' ? 'body' : 'head'; S.zoom = 1; S.panX = S.panY = 0; refreshViewbar(); if (S.tab === 'Speech') renderPanel(); render(); save(); }, { 'aria-pressed': 'false' }),
    vb('fit', 'Fit', 'fit', () => { S.zoom = 1; S.panX = S.panY = 0; render(); }));
  const back = h('button', { type: 'button', class: 'btn back', testid: 'stage-back', onClick: () => { S.stageOnly = false; document.body.classList.remove('stage-only'); render(); } }, 'Show controls');
  wrapEl = h('section', { class: 'stage-wrap' }, stage, hud, viewbar, back);
  frameCanvas = document.createElement('canvas');
  const tabs = h('nav', { class: 'tabs', role: 'tablist' }, TABS.map((t) => h('button', { type: 'button', class: 'tab', role: 'tab', 'data-tab': t, testid: `tab-${t}`, onClick: () => { S.tab = t; renderPanel(); } }, TAB_LABELS[t] ?? t)));
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
      h('button', { type: 'button', class: 'btn ghost', testid: 'make-loop', title: 'Make a seamless loop: adjust the frames so the last frame leads straight back into the first', onClick: makeLoop }, icon('loop'), h('span', { class: 'lbl' }, 'Loop')),
      menuButton({ label: 'Length', testid: 'length-menu', title: 'How long the playback runs: more cycles or a time. The walk keeps its speed', items: lengthItems }),
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
const LAYOUT = { panelW: 390, stageH: null, density: 'auto', theme: 'auto', resume: false, hud: false, arcSym: 'alt', expandAll: false, rows: 'auto', collapsed: {} };
/** Slider rows: compact (label, track and number on one line), roomy (the label above a full-width track, easier to drag), or automatic (compact, roomy on a phone). */
// A wide panel (an iPad in portrait) sets the slider rows out in two columns.
function watchPanelWidth() { const el = document.getElementById('panel-body'); if (!el || el.dataset.watched || typeof ResizeObserver === 'undefined') return; el.dataset.watched = '1'; const set = () => { el.dataset.wide = el.clientWidth >= 700 ? '1' : '0'; }; set(); new ResizeObserver(set).observe(el); }
function applyRows() { document.documentElement.dataset.rows = ['compact', 'roomy'].includes(LAYOUT.rows) ? LAYOUT.rows : 'auto'; }
function setRows(v) { LAYOUT.rows = v; applyRows(); layoutSave(); render(); }
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
  // A menu for whatever is under the pointer: a right-click, or holding a finger still. Every item acts on that object.
  const sceneRow = (id) => S.scene.actors.find((a) => a.id === id) || S.scene.props.find((p) => p.id === id) || null;
  const contextMenuFor = (cx, cy) => {
    const q = toFrame(cx, cy); if (!q || !S.last) return false;
    const front = pickAttachment(q, 'front'); const part = !front ? pickPart(S.last.shapes.filter((s) => !s.attach), q.x, q.y) : null;
    const back = !front && !part ? pickAttachment(q, 'behind') : null;
    const sceneHit = !front && !part && !back ? [...(S.last.sceneHits || [])].reverse().find((h) => pickPart(h.shapes, q.x, q.y)) : null;
    let items; let label;
    if (front || back) {
      const it = (front || back).it; label = it.name; const sidedTarget = attachTargets(S.p.rig).find((t) => t.key === targetKey(it))?.side;
      items = [{ heading: it.name }, { label: 'Edit', testid: 'ctx-edit', onClick: () => selectAttach(it.id) },
        { label: 'Copy', testid: 'ctx-copy', onClick: () => setClip(clipOfAttach(it), `"${it.name}"`) },
        { label: 'Duplicate', testid: 'ctx-dup', onClick: () => { const c = cloneItem(it); c.x += 0.04; c.y += 0.04; attachList().push(c); selectAttach(c.id); save(); } },
        ...(sidedTarget ? [{ label: 'Copy to the other side', testid: 'ctx-mirror', onClick: () => { const fr = (front || back).f; const m = mirroredItem(it, fr.L, fr.r); attachList().push(m); selectAttach(m.id); save(); } }] : []),
        { separator: true }, { heading: 'Layer' },
        ...[['back', 'Send to the back'], ['behind', 'Behind its part'], ['front', 'In front of its part'], ['top', 'Bring to the top']].map(([v, l]) => ({ label: l, testid: `ctx-layer-${v}`, radio: true, checked: it.depth === v, onClick: () => patchAttach(it.id, { depth: v }, { panel: true }) })),
        { separator: true }, { label: it.visible ? 'Hide' : 'Show', testid: 'ctx-hide', onClick: () => patchAttach(it.id, { visible: !it.visible }, { panel: true }) },
        { label: 'Delete', testid: 'ctx-del', onClick: () => { S.attach[figKey()] = attachList().filter((a) => a.id !== it.id); S.attachSel = null; renderPanel(); render(); save(); } }];
    } else if (part) {
      label = wd(partLabel(part.part, part.side));
      items = [{ heading: label }, { label: 'Select and open its settings', testid: 'ctx-part', onClick: () => selectPart({ part: part.part, side: part.side }, { openTab: true }) },
        { label: 'Attach a shape here', testid: 'ctx-attach-shape', onClick: () => { selectPart({ part: part.part, side: part.side }, { openTab: false }); addAttach('rect'); } },
        { label: 'Attach a picture here…', testid: 'ctx-attach-pic', onClick: () => { selectPart({ part: part.part, side: part.side }, { openTab: false }); S.tab = 'Attach'; renderPanel(); setMessage('Choose Add > Picture in the Attach tab. The picture goes on the selected part.'); } }];
    } else if (sceneHit) {
      const it = sceneRow(sceneHit.id); if (!it) return false; label = it.name; const isActor = S.scene.actors.includes(it);
      items = [{ heading: it.name }, { label: 'Select', testid: 'ctx-scene-select', onClick: () => { S.sceneSel = it.id; S.tab = 'Gait'; selectPart(null, { openTab: false }); renderPanel(); } },
        { label: 'Copy', testid: 'ctx-scene-copy', onClick: () => setClip(clipOfScene(it), `"${it.name}"`) },
        { label: 'Duplicate', testid: 'ctx-scene-dup', onClick: () => { const c = JSON.parse(JSON.stringify(it)); c.id = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`; c.name = `${it.name} copy`; c.x += 0.8; (isActor ? S.scene.actors : S.scene.props).push(c); S.sceneSel = c.id; sceneChanged(true); } },
        ...(isActor ? [] : [{ label: 'Raise', testid: 'ctx-scene-up', onClick: () => { it.y = Math.min(8, (it.y || 0) + 0.25); sceneChanged(true); } }, { label: 'Lower', testid: 'ctx-scene-down', onClick: () => { it.y = Math.max(-3, (it.y || 0) - 0.25); sceneChanged(true); } }]),
        { label: it.visible ? 'Hide' : 'Show', testid: 'ctx-scene-hide', onClick: () => { it.visible = !it.visible; sceneChanged(true); } },
        { label: it.locked ? 'Unlock' : 'Lock', testid: 'ctx-scene-lock', onClick: () => { it.locked = !it.locked; sceneChanged(true); } },
        { separator: true }, { label: 'Remove', testid: 'ctx-scene-del', onClick: () => removeSceneItem(it.id) }];
    } else {
      label = 'Stage';
      items = [{ heading: 'Stage' }, { label: 'Paste', testid: 'ctx-paste', disabled: !loadClip(), onClick: pasteClipboard }, { label: 'Fit to the window', testid: 'ctx-fit', onClick: () => { S.zoom = 1; S.panX = S.panY = 0; render(); } },
        { label: S.s.focus === 'head' ? 'Back to the whole figure' : 'Look at the head', testid: 'ctx-head', onClick: () => { S.s.focus = S.s.focus === 'head' ? 'body' : 'head'; S.zoom = 1; S.panX = S.panY = 0; refreshViewbar(); render(); save(); } },
        { label: S.s.showScene === false ? 'Show the scene' : 'Hide the scene', testid: 'ctx-scene-toggle', onClick: () => { S.s.showScene = S.s.showScene === false; render(); save(); } }];
    }
    openMenuAt(cx, cy, items, label, 'context-menu'); return true;
  };
  let press = null;
  const cancelPress = () => { if (press) { clearTimeout(press.t); press = null; } };
  let ctxAt = 0;
  stage.addEventListener('contextmenu', (e) => { e.preventDefault(); if (performance.now() - ctxAt < 600) return; ctxAt = performance.now(); contextMenuFor(e.clientX, e.clientY); });

  // On a computer the middle button pivots the camera about the figure (Ctrl or not), and Shift with it pans, as in Blender; the wheel zooms.
  let mid = null;
  stage.addEventListener('mousedown', (e) => { if (e.button === 1) e.preventDefault(); });
  stage.addEventListener('auxclick', (e) => { if (e.button === 1) e.preventDefault(); });
  stage.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' && e.button === 1) { e.preventDefault(); stage.setPointerCapture(e.pointerId); mid = { id: e.pointerId, x: e.clientX, y: e.clientY, yaw: S.s.camYaw, pitch: S.s.camPitch, panX: S.panX, panY: S.panY, pan: e.shiftKey }; return; }
    stage.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    cancelPress();
    if ((inkGesture || inkPress) && ptrs.size > 1) inkCancel(); // a second finger: it was a pan or a zoom, not a line
    else if (S.tab === 'Draw' && ptrs.size === 1 && (e.pointerType !== 'mouse' || e.button === 0) && inkDown(e, toFrame)) return;
    if (ptrs.size === 1 && e.pointerType !== 'mouse') press = { x: e.clientX, y: e.clientY, t: setTimeout(() => { press = null; ctxAt = performance.now(); drag = null; down = null; start = null; contextMenuFor(e.clientX, e.clientY); }, 550) };
    if (ptrs.size === 1) { drag = attachDragStart(e, toFrame) || fixDragStart(e, toFrame) || arcDragStart(e, toFrame) || sceneDragStart(e, toFrame); if (drag) { down = null; start = null; return; } }
    start = snap();
    down = ptrs.size === 1 ? { x: e.clientX, y: e.clientY, t: performance.now(), moved: false, yaw: S.s.camYaw, pitch: S.s.camPitch } : null;
  });
  stage.addEventListener('pointermove', (e) => {
    if (mid && e.pointerId === mid.id) {
      const dx = e.clientX - mid.x; const dy = e.clientY - mid.y;
      if (mid.pan) { S.panX = mid.panX + dx; S.panY = mid.panY + dy; } else { S.s.camYaw = ((mid.yaw - dx * 0.45 + 540) % 360) - 180; S.s.camPitch = Math.max(-85, Math.min(85, mid.pitch + dy * 0.35)); }
      render(); return;
    }
    if (!ptrs.has(e.pointerId)) return;
    if (press && Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelPress();
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (inkPress && e.pointerId === inkPress.id) { inkMoveEvent(e, toFrame); return; }
    if (drag) { (drag.arc ? arcDragMove : drag.fix ? fixDragMove : drag.scene ? sceneDragMove : attachDragMove)(drag, e, toFrame); return; }
    const pts = [...ptrs.values()];
    if (!start) return;
    if (pts.length >= 2) {
      down = null;
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      S.zoom = Math.min(8, Math.max(0.25, start.zoom * (d / start.dist)));
      S.panX = start.panX + ((pts[0].x + pts[1].x) / 2 - start.cx); S.panY = start.panY + ((pts[0].y + pts[1].y) / 2 - start.cy);
    } else if (down) {
      const dx = pts[0].x - down.x; const dy = pts[0].y - down.y;
      if (!down.moved && Math.hypot(dx, dy) < 8) return;
      down.moved = true;
      if (S.tool === 'orbit') {
        S.s.camYaw = ((down.yaw - dx * 0.45 + 540) % 360) - 180;
        S.s.camPitch = Math.max(-85, Math.min(85, down.pitch + dy * 0.35));
      } else if (S.tool === 'pan') { S.panX = start.panX + dx; S.panY = start.panY + dy; }
      // with the Select tool one finger never moves the camera: two fingers pan and zoom
    }
    render();
  });
  const up = (e) => {
    if (mid && e.pointerId === mid.id) { mid = null; if (S.tab === 'View') renderPanel(); save(); return; }
    cancelPress();
    if (inkPress && e.pointerId === inkPress.id) { inkRelease(e, toFrame); ptrs.delete(e.pointerId); down = null; start = ptrs.size ? snap() : null; return; }
    if (drag) { if (drag.arc || drag.fix) { renderPanel(); save(); } else if (drag.scene) sceneDragEnd(drag); else attachDragEnd(drag, e, toFrame); drag = null; ptrs.delete(e.pointerId); down = null; start = ptrs.size ? snap() : null; return; }
    const was = down; const had = ptrs.has(e.pointerId);
    ptrs.delete(e.pointerId);
    if (had && was && !was.moved && performance.now() - was.t < 500) {
      const q = toFrame(e.clientX, e.clientY);
      const front = q && S.last ? pickAttachment(q, 'front') : null;
      const hit = !front && q && S.last ? pickPart(S.last.shapes, q.x, q.y) : null;
      const back = !front && !hit && q && S.last ? pickAttachment(q, 'behind') : null;
      const sceneHit = !front && !hit && !back && q && S.last?.sceneHits ? [...S.last.sceneHits].reverse().find((sh) => pickPart(sh.shapes, q.x, q.y)) : null;
      if (sceneHit) { S.sceneSel = sceneHit.id; S.tab = 'Gait'; selectPart(null, { openTab: false }); renderPanel(); setMessage('Figure selected. Its walk, place and size are in the Scene section of the Body tab.'); }
      else if (front || back) selectAttach((front || back).it.id);
      else { S.attachSel = null; selectPart(hit, { openTab: Boolean(hit) }); }
    } else if (had && was?.moved && S.tool === 'orbit') { if (S.tab === 'View') renderPanel(); save(); }
    down = null; start = ptrs.size ? snap() : null;
  };
  stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', (e) => { if (inkPress && e.pointerId === inkPress.id) { inkPress = null; if (inkGesture) inkEnd(); } if (mid && e.pointerId === mid.id) mid = null; ptrs.delete(e.pointerId); down = null; start = null; drag = null; });
  stage.addEventListener('wheel', (e) => { e.preventDefault(); S.zoom = Math.min(8, Math.max(0.25, S.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1))); render(); }, { passive: false });
  stage.addEventListener('dblclick', () => { S.zoom = 1; S.panX = S.panY = 0; render(); });
  function snap() {
    const pts = [...ptrs.values()];
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length; const cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    return { zoom: S.zoom, panX: S.panX, panY: S.panY, cx, cy, dist: pts.length > 1 ? Math.max(1, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)) : 1 };
  }
}

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); saveSettings(); return; }
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClipboard(); return; }
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSelection(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && deletableSelection()) { e.preventDefault(); deleteSelection(); return; }
  if (e.key === 'F1' || e.key === '?') { e.preventDefault(); openHelp(); return; }
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
  const input = h('input', { type: 'file', accept: PICTURE_ACCEPT, class: 'file-input', 'aria-label': 'Choose a picture', testid: 'sampler-file', onChange: (e) => { pickPicture(e.target.files?.[0]); e.target.value = ''; } });
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
applyDensity(); applyTheme(); applyRows();
// Each visit starts clean unless File > Reopen with last session is on.
if (LAYOUT.resume) {
  load();
  try { refAdopt(JSON.parse(localStorage.getItem(REF_KEY) || 'null')); } catch { /* none kept */ }
  loadAttachImages();
} else { try { for (const k of [KEY, REF_KEY, ATT_IMG_KEY]) localStorage.removeItem(k); } catch { /* storage unavailable */ } }
loadProp();
hist.reset(snapState());
S.savedState = snapState();
build();
render();
refreshSaveState();
window.addEventListener('beforeunload', (e) => { if (isDirty() && !LAYOUT.resume) { e.preventDefault(); e.returnValue = ''; } });
// The guide shows once, on a first visit: nothing kept yet for this browser (an earlier visit leaves its layout, and the automated tests set one).
try { if (!navigator.webdriver && !localStorage.getItem('walkbase.helpSeen') && !localStorage.getItem(LAYOUT_KEY)) setTimeout(openHelp, 600); } catch { /* not shown */ }
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.altKey) return;
  const t = e.target; const typing = t && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && ['text', 'number', 'search'].includes(t.type)));
  if (typing) return;
  const k = e.key.toLowerCase();
  if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); } else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
});
window.__walkBase = {
  setFigure, figKey, clipsFor, clipsForFigure, applyClip, undo, redo, hist, snapState, menuOwner, closeMenus, setDensity, setTheme, setRows, addAttach, patchAttach, selectAttach, attachItem, attachList, pickAttachImage, cleanAttach, REF, refPaint, pickRef, findKeyFrames: () => findKeyFrames(P()), laneTable: () => laneTable(P()), exportKeys: (over = {}) => exportKeyFrames(P(), S.s, { ...S.x, ...over }),
  buildSpeechNow, clearSpeech, setSpeechText: (t) => { S.speechDraft = t; }, setRig, rec, addClip, makeLoop, loopGapNow: () => loopGap(P()), openLaneEditor, setArmed, nowValues, perfData, S, P, LAYOUT, layoutApply, render: paint, setFrame, play, pause, applyPreset, selectPart, openEditor, closeEditor, setMotion, patchMotion, liveValue, setTab: (t) => { S.tab = t === 'Body' || t === 'Scene' ? 'Gait' : t === 'Look' || t === 'Guides' ? 'View' : t; renderPanel(); },
  setParam: (id, v) => { const c = CONTROLS.find((x) => x.id === id); setParam(c, v); renderPanel(); },
  addActor, inkFrame, inkTarget, toUV, fromUV, setMoodPad, mood: () => MOOD, designOf: () => designOf(), patchPart, partKeys, packCurrentCharacter, importCharacterObject, exportUvTemplate, applyAtlas, triggerPad, storePad, padBank, padRun: () => PADRUN, padMode: (m) => { PADMODE = m; },
  exportZip: (over = {}) => exportPngZip(P(), S.s, { ...S.x, ...over }),
  exportMp4: (over = {}) => exportMp4(P(), S.s, { ...S.x, ...over }),
  frame: (i, part = null, over = {}) => renderFrame(P(), S.s, { ...S.x, ...over }, i, part),
  manifest: (over = {}) => manifest(P(), S.s, { ...S.x, ...over }),
  timeline: (over = {}) => exportTimeline(P(), { ...S.x, ...over }),
  editor: () => editor, SM, setSource, pickPicture, openCuts, sampledSummary,
};
