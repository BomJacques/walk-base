// The idle phase: what a person does when nothing is happening. Breathing, shifting weight from foot to foot, looking around, small fidgets (a scratch, a shrug, a yawn, a foot tapping)
// and the way the arms are held, built as a layer on the timeline. The layer is ADDED to whatever the lanes already hold (a stop, a sit, a hand-made pose), sample by sample, so it sits on top
// of anything and the rest of the timeline is unharmed. All of it comes from a seed, so the same settings always give the same idle, and a new seed gives a new one.
// Pure logic, no DOM.
import { laneValue, replaceSpan, thinPoints, targetOfChannel } from './automation.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

/** A small repeatable random number generator (mulberry32). */
export function rng(seed) { let a = (Math.round(seed) >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** The fidgets that can be switched on: each is a movement from the Auto tab that is dropped in at a random moment. */
export const FIDGETS = [
  ['scratch', 'Scratch head'], ['shrug', 'Shrug'], ['stretch', 'Stretch'], ['yawn', 'Yawn and stretch'], ['think', 'Think'], ['nod', 'Nod'], ['shake', 'Shake head'], ['look', 'Look around (big)'], ['clap', 'Clap'], ['shiver', 'Shiver'],
];
/** How the arms are held while standing about: offsets of the arm channels. */
export const STANCES = {
  'Arms down': {},
  'Hands clasped': { 'arm.pitch.R': 0.5, 'arm.pitch.L': 0.5, 'elbow.flex.R': 1.15, 'elbow.flex.L': 1.15, 'arm.roll.R': -0.12, 'arm.roll.L': -0.12 },
  'Hands on hips': { 'arm.pitch.R': -0.15, 'arm.pitch.L': -0.15, 'arm.roll.R': 0.9, 'arm.roll.L': 0.9, 'elbow.flex.R': 1.5, 'elbow.flex.L': 1.5 },
  'Arms crossed': { 'arm.pitch.R': 0.45, 'arm.pitch.L': 0.45, 'elbow.flex.R': 2.0, 'elbow.flex.L': 2.0, 'arm.roll.R': -0.5, 'arm.roll.L': -0.5 },
  'Hands behind back': { 'arm.pitch.R': -0.55, 'arm.pitch.L': -0.55, 'elbow.flex.R': 1.0, 'elbow.flex.L': 1.0, 'arm.roll.R': -0.15, 'arm.roll.L': -0.15 },
};

export const IDLE_DEFAULTS = Object.freeze({
  style: 'Relaxed', seconds: 20, pose: 'standing', stopFirst: true, standAtEnd: false,
  breathing: 0.6, breathRate: 14, shift: 0.5, shiftEvery: 7, look: 0.6, lookEvery: 4, lookRange: 0.8, fidgets: ['scratch', 'shrug'], fidgetRate: 3, tap: false, stance: 'Arms down', seed: 1,
});

/** Ready-made idles: each sets many of the controls at once. */
export const IDLE_STYLES = {
  Relaxed: { breathing: 0.6, breathRate: 13, shift: 0.5, shiftEvery: 8, look: 0.5, lookEvery: 5, lookRange: 0.7, fidgets: ['scratch', 'shrug'], fidgetRate: 2, tap: false, stance: 'Arms down' },
  Alert: { breathing: 0.4, breathRate: 16, shift: 0.25, shiftEvery: 10, look: 1, lookEvery: 2.5, lookRange: 1, fidgets: ['look', 'nod'], fidgetRate: 3, tap: false, stance: 'Hands behind back' },
  Bored: { breathing: 0.8, breathRate: 12, shift: 0.9, shiftEvery: 4.5, look: 0.7, lookEvery: 4, lookRange: 0.9, fidgets: ['yawn', 'stretch', 'scratch', 'shake'], fidgetRate: 4, tap: true, stance: 'Arms crossed' },
  Nervous: { breathing: 0.7, breathRate: 22, shift: 0.8, shiftEvery: 3.5, look: 1, lookEvery: 2, lookRange: 0.9, fidgets: ['scratch', 'shrug', 'look'], fidgetRate: 5, tap: true, stance: 'Hands clasped' },
  Tired: { breathing: 1, breathRate: 10, shift: 0.6, shiftEvery: 6, look: 0.3, lookEvery: 7, lookRange: 0.5, fidgets: ['yawn', 'stretch', 'shrug'], fidgetRate: 3, tap: false, stance: 'Hands on hips' },
  Confident: { breathing: 0.5, breathRate: 14, shift: 0.3, shiftEvery: 9, look: 0.6, lookEvery: 5, lookRange: 0.8, fidgets: ['nod'], fidgetRate: 1.5, tap: false, stance: 'Hands on hips' },
};

/** Clean settings from anything (a saved file, a mistake): every number in range, the lists made of known things. */
export function cleanIdle(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}; const D = IDLE_DEFAULTS;
  const n = (v, lo, hi, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? clamp(Number(v), lo, hi) : d);
  const ids = new Set(FIDGETS.map(([id]) => id));
  return {
    style: IDLE_STYLES[r.style] || r.style === 'Custom' ? r.style : D.style, seconds: n(r.seconds, 2, 300, D.seconds), pose: r.pose === 'sitting' ? 'sitting' : 'standing', stopFirst: r.stopFirst !== false, standAtEnd: r.standAtEnd === true,
    breathing: n(r.breathing, 0, 1, D.breathing), breathRate: n(r.breathRate, 4, 40, D.breathRate), shift: n(r.shift, 0, 1, D.shift), shiftEvery: n(r.shiftEvery, 1, 40, D.shiftEvery),
    look: n(r.look, 0, 1, D.look), lookEvery: n(r.lookEvery, 0.5, 40, D.lookEvery), lookRange: n(r.lookRange, 0.1, 1.4, D.lookRange),
    fidgets: (Array.isArray(r.fidgets) ? r.fidgets : D.fidgets).filter((x) => ids.has(x)).slice(0, 12), fidgetRate: n(r.fidgetRate, 0, 12, D.fidgetRate), tap: r.tap === true,
    stance: STANCES[r.stance] ? r.stance : D.stance, seed: Math.round(n(r.seed, 1, 99999, D.seed)),
    base: r.base && typeof r.base === 'object' && Array.isArray(r.span) ? r.base : null, span: Array.isArray(r.span) && r.span.length === 2 ? r.span.map((v) => Math.max(0, Math.round(Number(v) || 0))) : null,
  };
}

/** A level that moves between targets: events is a list of [frame, value]; between them it eases over `ease` frames after each event's frame and holds. */
function stepped(events, ease, from = 0) {
  return (f) => { let v = from; let prev = from; for (const [t, target] of events) { if (f < t) break; v = prev + (target - prev) * smooth((f - t) / ease); if (f >= t + ease) prev = target; else break; } return v; };
}

/** The frames at which each fidget starts: spread through the time with gaps, away from the very start and end. Returns [{ id, start, frames }]. */
export function scheduleFidgets(s, fps, N, lengthOf) {
  const rnd = rng(s.seed * 7 + 3); const out = []; if (!s.fidgets.length || s.fidgetRate <= 0) return out;
  const count = Math.round((s.fidgetRate * N) / (fps * 60)); const margin = Math.round(fps * 2.5); let at = margin;
  const span = Math.max(1, N - 2 * margin); const slot = span / Math.max(1, count);
  for (let k = 0; k < count; k++) {
    const id = s.fidgets[Math.floor(rnd() * s.fidgets.length)]; const len = lengthOf(id); const start = Math.round(margin + k * slot + rnd() * Math.max(0, slot - len - 4));
    if (start < at || start + len > N - margin / 2) continue; out.push({ id, start, frames: len }); at = start + len + Math.round(fps * 1.2);
  }
  return out;
}

/**
 * The idle layer for N frames at fps: { channel: Float64Array } of values to ADD to each channel's offset, and the fidgets chosen.
 * `busy` is how much each frame is taken by a fidget movement (0..1), which the arm stance steps aside for.
 */
export function idleLayer(settings, fps, N, lengthOf = () => 48) {
  const s = cleanIdle(settings); const rnd = rng(s.seed); const out = {}; const add = (id, f, v) => { (out[id] ||= new Float64Array(N))[f] += v; };
  const fid = scheduleFidgets(s, fps, N, lengthOf); const busy = new Float64Array(N);
  for (const q of fid) for (let f = Math.max(0, q.start - 8); f < Math.min(N, q.start + q.frames + 8); f++) busy[f] = Math.max(busy[f], smooth(Math.min((f - (q.start - 8)) / 8, ((q.start + q.frames + 8) - f) / 8, 1)));
  const ramp = Math.min(24, Math.floor(N / 3)); const env = (f) => smooth(f / ramp) * smooth((N - 1 - f) / ramp);
  const seated = s.pose === 'sitting';
  // breathing: the chest rises and falls, the shoulders lift a little, the head follows
  const period = (fps * 60) / s.breathRate; const ph0 = rnd() * TAU;
  // weight shift: the hips slide over one foot, the body leans the other way to balance, and later back or over the other foot
  const shifts = []; { let t = Math.round(fps * 1.5 * (0.5 + rnd())); let side = rnd() < 0.5 ? -1 : 1; while (t < N) { shifts.push([t, side * (0.5 + 0.5 * rnd())]); side = rnd() < 0.25 ? 0 : -side || (rnd() < 0.5 ? 1 : -1); t += Math.round(fps * s.shiftEvery * (0.6 + 0.8 * rnd())); } }
  const shiftAt = stepped(shifts, Math.round(fps * 1.1));
  // looking: the head turns to somewhere, holds, then somewhere else or back to the front
  const looks = []; { let t = Math.round(fps * s.lookEvery * (0.3 + 0.7 * rnd())); let last = 0; while (t < N) { const back = rnd() < 0.3 || Math.abs(last) > 0.7; const yaw = back ? 0 : (rnd() < 0.5 ? -1 : 1) * (0.35 + 0.65 * rnd()) * s.lookRange; looks.push([t, yaw, back ? (rnd() - 0.5) * 0.1 : (rnd() - 0.4) * 0.35]); last = yaw; t += Math.round(fps * s.lookEvery * (0.6 + 0.9 * rnd())); } }
  const yawAt = stepped(looks.map(([t, y]) => [t, y]), Math.round(fps * 0.55)); const pitchAt = stepped(looks.map(([t, , p]) => [t, p]), Math.round(fps * 0.5));
  const phA = rnd() * TAU; const phB = rnd() * TAU; const phC = rnd() * TAU;
  // a foot tapping now and then: a few quick taps, then rest
  const taps = []; if (s.tap) { let t = Math.round(fps * (3 + 5 * rnd())); while (t < N - fps) { taps.push([t, 3 + Math.floor(rnd() * 4)]); t += Math.round(fps * (6 + 9 * rnd())); } }
  const stance = STANCES[s.stance] || {};
  for (let f = 0; f < N; f++) {
    const e = env(f); const b = Math.sin((TAU * f) / period + ph0); const d = s.breathing * e;
    add('spine3.pitch', f, -0.035 * d * b); add('spine2.pitch', f, -0.02 * d * b); add('neck.pitch', f, 0.014 * d * b); add('girdle.y.R', f, 0.012 * d * b); add('girdle.y.L', f, 0.012 * d * b);
    const sh = shiftAt(f) * s.shift * e;
    add('pelvis.z', f, 0.03 * sh); add('pelvis.roll', f, -0.05 * sh); add('spine1.roll', f, 0.035 * sh); add('spine2.roll', f, 0.025 * sh); add('head.roll', f, 0.025 * sh);
    if (!seated) { add('foot.y.R', f, 0.012 * Math.max(0, -sh)); add('foot.y.L', f, 0.012 * Math.max(0, sh)); }
    const yaw = yawAt(f) * s.look * e; const pit = pitchAt(f) * s.look * e;
    add('head.yaw', f, 0.55 * yaw); add('neck.yaw', f, 0.3 * yaw); add('spine3.yaw', f, 0.12 * yaw); add('head.pitch', f, pit * 0.7); add('neck.pitch', f, pit * 0.3);
    const m = 0.5 * e; add('head.roll', f, m * 0.01 * Math.sin((TAU * f) / (fps * 7.3) + phA)); add('pelvis.roll', f, m * 0.008 * Math.sin((TAU * f) / (fps * 9.1) + phB)); add('spine2.roll', f, m * 0.006 * Math.sin((TAU * f) / (fps * 11.7) + phC));
    for (const [t0, n] of taps) { const q = f - t0; if (q >= 0 && q < n * 9) add('foot.pitch.R', f, -0.3 * e * Math.max(0, Math.sin((TAU * q) / 9)) * (1 - q / (n * 9))); }
    const arms = e * (1 - busy[f]); for (const [id, v] of Object.entries(stance)) add(id, f, v * arms);
  }
  return { layer: out, fidgets: fid, busy };
}

/** Adds the layer to the lanes, from frame `start`: each channel is sampled every frame, summed, thinned and written back as a straight-line lane. Returns the new lanes. */
export function applyLayer(lanes, layer, start, rangeOf) {
  const next = { ...lanes };
  for (const [id, vals] of Object.entries(layer)) {
    if (!vals.some((v) => Math.abs(v) > 1e-9)) continue;
    const target = targetOfChannel(id, 'offset'); const old = next[target]; const N = vals.length; const a = Math.max(0, start - 1); const end = start + N - 1; const eps = Math.max(1e-4, rangeOf(target) * 0.0015);
    // a lane that was smooth between sparse points is written out frame by frame so that nothing outside the layer changes shape when the lane becomes a straight-line one
    let pts = old?.pts || [];
    if (pts.length && old.interp !== 'linear') { const dense = []; for (let t = pts[0].t; t <= pts[pts.length - 1].t; t++) dense.push({ t, v: laneValue(old, t, 0) }); pts = thinPoints(dense, eps * 0.4); }
    const base = { ...(old || {}), pts, interp: 'linear' };
    const fresh = Array.from({ length: N }, (_, k) => ({ t: start + k, v: laneValue(base, start + k, 0) + vals[k] }));
    const lead = a < start ? [{ t: a, v: laneValue(base, a, 0) }] : [];
    next[target] = { ...replaceSpan(base, a, end, [...lead, ...thinPoints(fresh, eps)]), interp: 'linear' };
  }
  return next;
}
