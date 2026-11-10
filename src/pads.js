// The pad bank: eight pads, each holding a whole walk (every gait and body setting, and where the mood pad was). Tapping a pad brings its walk back,
// blending from the walk that is playing over a set number of cycles, at once or from the start of the next cycle. Like the pads of a drum machine,
// but each one is a way of walking. Pure: app.js owns the buttons and the clock.

export const PAD_COUNT = 8;
export const BLENDS = [[0, 'Cut'], [0.5, '½'], [1, '1'], [2, '2'], [4, '4']];
/** Settings that are not part of a walk: which figure it is, and how the timeline is drawn. A pad leaves them alone. */
const NOT_WALK = new Set(['rig', 'model', 'dogSpecies', 'fps', 'exposure', 'travel']);
/** Whole-number settings and choices: they change at the start of a blend, since half a neck bone or half a gait means nothing. */
const SNAP = new Set(['noiseSeed', 'hoseWobbleRate', 'dogNeckSegs']);

export const newBank = () => ({ name: 'Bank', pads: Array.from({ length: PAD_COUNT }, () => null), when: 'now', blend: 1, active: null });

/** What a pad keeps of a walk: the numbers it blends, the choices it switches, and the mood pad as it stood. */
export function capturePad(p, mood, name) {
  const values = {}; const flags = {};
  for (const [k, v] of Object.entries(p)) {
    if (NOT_WALK.has(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v) && !SNAP.has(k)) values[k] = v;
    else if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') flags[k] = v;
  }
  return { name: String(name || 'Pad').slice(0, 24), values, flags, mood: mood ? JSON.parse(JSON.stringify(mood)) : null };
}

const smooth = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
/** The walk part way from one to another: t 0 is `from`, 1 is `to`, eased so it neither starts nor stops with a jerk. Only the settings `to` names. */
export function transitionValues(from, to, t) {
  const k = smooth(t); const out = {};
  for (const [id, target] of Object.entries(to)) {
    const a = typeof from[id] === 'number' ? from[id] : target; const v = a + (target - a) * k;
    out[id] = id === 'cycleFrames' ? Math.max(2, Math.round(v)) : v;
  }
  if (t >= 1) for (const [id, target] of Object.entries(to)) out[id] = id === 'cycleFrames' ? Math.max(2, Math.round(target)) : target;
  return out;
}
/** How many frames a blend takes: so many cycles of the walk that is playing now. */
export const blendFrames = (bank, cycleFrames) => Math.max(0, Math.round((Number(bank?.blend) || 0) * Math.max(2, Math.round(cycleFrames))));

const cleanPad = (q) => {
  if (!q || typeof q !== 'object' || !q.values || typeof q.values !== 'object') return null;
  const values = {}; for (const [k, v] of Object.entries(q.values)) if (Number.isFinite(Number(v)) && !NOT_WALK.has(k)) values[String(k).slice(0, 40)] = Number(v);
  const flags = {}; for (const [k, v] of Object.entries(q.flags || {})) if (!NOT_WALK.has(k) && (typeof v === 'string' || typeof v === 'boolean' || Number.isFinite(v))) flags[String(k).slice(0, 40)] = typeof v === 'string' ? v.slice(0, 40) : v;
  if (!Object.keys(values).length) return null;
  return { name: String(q.name || 'Pad').slice(0, 24), values, flags, mood: q.mood && typeof q.mood === 'object' ? q.mood : null };
};
export function cleanBank(raw) {
  const b = newBank(); if (!raw || typeof raw !== 'object') return b;
  b.name = String(raw.name || 'Bank').slice(0, 40);
  if (Array.isArray(raw.pads)) for (let i = 0; i < PAD_COUNT; i++) b.pads[i] = cleanPad(raw.pads[i]);
  b.when = raw.when === 'cycle' ? 'cycle' : 'now'; b.blend = BLENDS.some(([v]) => v === Number(raw.blend)) ? Number(raw.blend) : 1;
  b.active = Number.isInteger(raw.active) && raw.active >= 0 && raw.active < PAD_COUNT && b.pads[raw.active] ? raw.active : null;
  return b;
}
/** Saved banks, one for each figure. */
export function cleanBanks(raw, figs) {
  const out = {}; if (!raw || typeof raw !== 'object') return out;
  for (const f of figs) if (raw[f]) out[f] = cleanBank(raw[f]);
  return out;
}
