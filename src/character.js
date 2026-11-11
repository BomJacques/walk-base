// A character as a file: the figure, its walk, its proportions, its look, its attachments and design (skins, colours, shadows), its pads and the pictures they use.
// Everything about the person that is not the stage, the timeline or the camera. Pure: objects in, objects out; app.js reads and writes the real state.

export const CHARACTER_FORMAT = 'walk-base-character';
export const CHARACTER_VERSION = 1;
/** Settings of the stage rather than the character. */
const STAGE = /^cam|^autoOrbit|^orbit|^focus$|^headZoom$|^showGround$|^showFootprints$|^showArcs$|^arcDots$|^showOnion|^onion|^arcs|^background$|^figureHeight$|^groundHeight$|^offsetX$/;
/** Walk settings that say which figure it is, which the figure itself decides. */
const WHICH = new Set(['rig', 'model', 'dogSpecies']);
const clone = (v) => JSON.parse(JSON.stringify(v ?? null));

/** The look settings that belong to a character. */
export const lookOf = (s) => Object.fromEntries(Object.entries(s || {}).filter(([k, v]) => !STAGE.test(k) && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')));

export function packCharacter({ name, figure, p, r, s, motion, attach, design, pads, images }) {
  const walk = Object.fromEntries(Object.entries(p || {}).filter(([k, v]) => !WHICH.has(k) && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean')));
  return { format: CHARACTER_FORMAT, version: CHARACTER_VERSION, name: String(name || 'Character').slice(0, 60), figure, p: walk, r: clone(r) || {}, s: lookOf(s), motion: clone(motion) || {}, attach: clone(attach) || [], design: clone(design) || {}, pads: clone(pads), images: { ...(images || {}) } };
}

/** A character read back: what it holds that this version can use, or why it cannot be read. */
export function readCharacter(raw, figs, defaults, styleDefaults) {
  if (!raw || typeof raw !== 'object' || raw.format !== CHARACTER_FORMAT) return { ok: false, error: 'This is not a Walk Base character file.' };
  if (!figs.includes(raw.figure)) return { ok: false, error: `This character is a ${String(raw.figure).slice(0, 30)}, which this version does not have.` };
  const p = {}; for (const [k, v] of Object.entries(raw.p && typeof raw.p === 'object' ? raw.p : {})) if (k in defaults && !WHICH.has(k) && typeof v === typeof defaults[k] && (typeof v !== 'number' || Number.isFinite(v))) p[k] = v;
  const s = {}; for (const [k, v] of Object.entries(raw.s && typeof raw.s === 'object' ? raw.s : {})) if (k in styleDefaults && !STAGE.test(k) && typeof v === typeof styleDefaults[k] && (typeof v !== 'number' || Number.isFinite(v))) s[k] = v;
  const r = {}; for (const [k, v] of Object.entries(raw.r && typeof raw.r === 'object' ? raw.r : {})) if (Number.isFinite(Number(v))) r[String(k).slice(0, 30)] = Math.min(6, Math.max(0.05, Number(v)));
  const images = {}; for (const [k, v] of Object.entries(raw.images && typeof raw.images === 'object' ? raw.images : {})) if (typeof v === 'string' && v.startsWith('data:image/') && v.length < 12e6) images[String(k).slice(0, 40)] = v;
  return { ok: true, figure: raw.figure, name: String(raw.name || 'Character').slice(0, 60), p, s, r, motion: raw.motion && typeof raw.motion === 'object' ? raw.motion : {}, attach: Array.isArray(raw.attach) ? raw.attach : [], design: raw.design && typeof raw.design === 'object' ? raw.design : {}, pads: raw.pads && typeof raw.pads === 'object' ? raw.pads : null, images };
}
