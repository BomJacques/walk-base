// Mouth shapes and text to mouth shapes. Pure functions: no canvas, no page. The drawing is in mouth.js.
//
// The set has 15 shapes (the classic animation set, plus a few finer ones). Each is described by numbers, so the
// same description draws on the 3D head, on a flat chart and in tests:
//   open  how far the jaw drops, 0 to 1
//   wide  -1 pursed, 0 neutral, +1 stretched
//   round 0 to 1, how round the opening is (O and OO)
//   teeth 0 none, 1 upper teeth, 2 upper and lower
//   tongue 0 none, 1 low, 2 raised behind the upper teeth, 3 between the teeth
//   tuck  lower lip tucked under the upper teeth (F, V)
//   press lips pressed shut (M, B, P)

export const VISEMES = [
  { id: 'rest', code: 'rest', label: 'Rest', sounds: 'between words', hint: 'Lips together, relaxed.', open: 0.04, wide: 0.15, round: 0, teeth: 0, tongue: 0, tuck: 0, press: 0 },
  { id: 'mbp', code: 'mbp', label: 'M B P', sounds: 'm, b, p', hint: 'Lips pressed together.', open: 0, wide: 0, round: 0, teeth: 0, tongue: 0, tuck: 0, press: 1 },
  { id: 'fv', code: 'fv', label: 'F V', sounds: 'f, v, ph', hint: 'Lower lip tucked under the upper teeth.', open: 0.12, wide: 0.2, round: 0, teeth: 1, tongue: 0, tuck: 1, press: 0 },
  { id: 'th', code: 'th', label: 'TH', sounds: 'th', hint: 'Tongue tip pushed out between the teeth.', open: 0.34, wide: 0.3, round: 0, teeth: 2, tongue: 3, tuck: 0, press: 0 },
  { id: 'l', code: 'l', label: 'L N T D', sounds: 'l, n, t, d', hint: 'Mouth open, tongue tip lifted to the top teeth.', open: 0.42, wide: 0.25, round: 0, teeth: 1, tongue: 2, tuck: 0, press: 0 },
  { id: 'ah', code: 'ah', label: 'AH', sounds: 'a in father, o in hot', hint: 'Wide open, jaw dropped.', open: 1, wide: 0.1, round: 0, teeth: 1, tongue: 1, tuck: 0, press: 0 },
  { id: 'ae', code: 'ae', label: 'AE E', sounds: 'a in cat, e in bed, ay', hint: 'Open and drawn wide.', open: 0.7, wide: 0.7, round: 0, teeth: 2, tongue: 1, tuck: 0, press: 0 },
  { id: 'ee', code: 'ee', label: 'EE', sounds: 'ee, i in sit, y', hint: 'Lips stretched wide, teeth close.', open: 0.22, wide: 1, round: 0, teeth: 2, tongue: 0, tuck: 0, press: 0 },
  { id: 'oh', code: 'oh', label: 'OH', sounds: 'o in go, oa', hint: 'Rounded and open.', open: 0.7, wide: -0.3, round: 0.8, teeth: 0, tongue: 1, tuck: 0, press: 0 },
  { id: 'oo', code: 'oo', label: 'OO W', sounds: 'oo, w, u in blue', hint: 'Small tight circle.', open: 0.2, wide: -0.8, round: 1, teeth: 0, tongue: 0, tuck: 0, press: 0 },
  { id: 'uh', code: 'uh', label: 'UH', sounds: 'u in cup, the schwa', hint: 'Relaxed and half open.', open: 0.45, wide: 0, round: 0, teeth: 1, tongue: 1, tuck: 0, press: 0 },
  { id: 'chsh', code: 'ch', label: 'CH SH J', sounds: 'ch, sh, j', hint: 'Lips pushed forward, teeth close.', open: 0.2, wide: -0.4, round: 0.5, teeth: 2, tongue: 0, tuck: 0, press: 0 },
  { id: 'r', code: 'r', label: 'R', sounds: 'r', hint: 'Lips pursed a little, tongue pulled back.', open: 0.34, wide: -0.3, round: 0.4, teeth: 1, tongue: 2, tuck: 0, press: 0 },
  { id: 'sz', code: 'sz', label: 'S Z', sounds: 's, z, soft c', hint: 'Teeth together, lips drawn back.', open: 0.1, wide: 0.5, round: 0, teeth: 2, tongue: 0, tuck: 0, press: 0 },
  { id: 'kg', code: 'kg', label: 'K G', sounds: 'k, g, ng, hard c', hint: 'Open a little, the back of the tongue lifted.', open: 0.4, wide: 0.1, round: 0, teeth: 1, tongue: 1, tuck: 0, press: 0 },
];
export const VISEME_BY_ID = Object.fromEntries(VISEMES.map((v) => [v.id, v]));

const VOWELS = new Set(['ae', 'ee', 'ah', 'oh', 'oo', 'uh']);

// ---------- letters to shapes ----------
// A small set of spelling rules, English only, and a short list of words the rules get wrong.
// It is an approximation: good enough to read as speech and easy to trace, not a pronunciation dictionary.
const EXC = {
  a: 'uh', the: 'th uh', of: 'uh fv', to: 'l oo', too: 'l oo', two: 'l oo', do: 'l oo', who: 'oo', you: 'ee oo', your: 'ee oh r', are: 'ah r',
  was: 'oo uh sz', is: 'ee sz', his: 'ee sz', has: 'ae sz', as: 'ae sz', yes: 'ee ae sz', my: 'mbp ah', i: 'ah', me: 'mbp ee', we: 'oo ee', he: 'ee',
  she: 'chsh ee', be: 'mbp ee', by: 'mbp ah', buy: 'mbp ah', eye: 'ah', hi: 'ah', hey: 'ae', ok: 'oh kg ae', okay: 'oh kg ae', one: 'oo uh l', once: 'oo uh l sz',
  said: 'sz ae l', says: 'sz ae sz', have: 'ae fv', give: 'kg ee fv', live: 'l ee fv', love: 'l uh fv', some: 'sz uh mbp', come: 'kg uh mbp', done: 'l uh l',
  gone: 'kg ah l', been: 'mbp ee l', does: 'l uh sz', what: 'oo uh l', where: 'oo ae r', there: 'th ae r', here: 'ee r', were: 'oo r', their: 'th ae r',
  they: 'th ae', people: 'mbp ee mbp l', because: 'mbp ee kg uh sz', hello: 'ae l oh', world: 'oo r l l', word: 'oo r l', would: 'oo uh l', could: 'kg uh l',
  should: 'chsh uh l', through: 'th r oo', though: 'th oh', thought: 'th ah l', walk: 'oo ah kg', talk: 'l ah kg', know: 'l oh', no: 'l oh', go: 'kg oh',
  so: 'sz oh', show: 'chsh oh', low: 'l oh', how: 'ah oo', now: 'l ah oo', new: 'l oo', mouth: 'mbp ah th', walking: 'oo ah kg ee kg', talking: 'l ah kg ee kg',
  and: 'ae l l', in: 'ee l', it: 'ee l', at: 'ae l', on: 'ah l', or: 'oh r', for: 'fv oh r', from: 'fv r uh mbp', with: 'oo ee th', this: 'th ee sz', that: 'th ae l',
  zero: 'sz ee r oh', three: 'th r ee', four: 'fv oh r', five: 'fv ah fv', six: 'sz ee kg sz', seven: 'sz ae fv uh l', eight: 'ae l', nine: 'l ah l',
};
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const RULES = [
  ['tion', ['chsh', 'uh']], ['sion', ['chsh', 'uh']], ['ough', ['oh']], ['augh', ['ah']], ['igh', ['ah']], ['tch', ['chsh']], ['dge', ['chsh']],
  ['sh', ['chsh']], ['ch', ['chsh']], ['th', ['th']], ['ph', ['fv']], ['wh', ['oo']], ['ck', ['kg']], ['ng', ['kg']], ['qu', ['kg', 'oo']], ['kn', ['l']], ['wr', ['r']], ['gh', []],
  ['ee', ['ee']], ['ea', ['ee']], ['oo', ['oo']], ['ou', ['ah', 'oo']], ['ow', ['oh']], ['oi', ['oh', 'ee']], ['oy', ['oh', 'ee']], ['ai', ['ae']], ['ay', ['ae']],
  ['au', ['ah']], ['aw', ['ah']], ['ie', ['ee']], ['ei', ['ee']], ['ey', ['ee']], ['oa', ['oh']], ['ue', ['oo']], ['ui', ['oo']], ['ew', ['oo']], ['eu', ['oo']],
];
const SHORT = { a: 'ae', e: 'ae', i: 'ee', o: 'ah', u: 'uh' };
const LONG = { a: 'ae', e: 'ee', i: 'ah', o: 'oh', u: 'oo' };
const CONS = { b: 'mbp', p: 'mbp', m: 'mbp', f: 'fv', v: 'fv', l: 'l', n: 'l', t: 'l', d: 'l', s: 'sz', z: 'sz', j: 'chsh', k: 'kg', q: 'kg', g: 'kg', r: 'r', w: 'oo' };
const isVowelLetter = (c) => c != null && 'aeiou'.includes(c);

/** One word as a list of mouth shape ids. */
export function wordToShapes(raw) {
  const w = raw.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return [];
  if (EXC[w] != null) return EXC[w].split(' ').filter(Boolean);
  const out = []; let i = 0; let prev = '';
  while (i < w.length) {
    const c = w[i];
    const rule = RULES.find(([pat]) => w.startsWith(pat, i));
    if (rule) { out.push(...rule[1]); i += rule[0].length; prev = ''; continue; }
    if (isVowelLetter(c)) {
      // silent final e (make, time), or the e of -es and -ed after a consonant
      if (c === 'e' && i === w.length - 1 && w.length > 2 && !isVowelLetter(w[i - 1])) { i++; continue; }
      const magic = !isVowelLetter(w[i + 1]) && w[i + 1] != null && w[i + 2] === 'e' && (i + 3 === w.length || (i + 4 === w.length && 'sd'.includes(w[i + 3])));
      out.push((magic ? LONG : SHORT)[c]); i++; prev = ''; continue;
    }
    if (c === 'y') { out.push('ee'); i++; prev = ''; continue; }
    if (c === 'h') { i++; continue; }
    if (c === 'x') { out.push('kg', 'sz'); i++; prev = ''; continue; }
    let v = CONS[c];
    if (c === 'c') v = 'eiy'.includes(w[i + 1] || '') ? 'sz' : 'kg';
    if (v && c !== prev) out.push(v);
    prev = c; i++;
  }
  return out;
}

/** Splits text into spoken items: words become shape lists, punctuation becomes a pause. */
function tokens(text) {
  const items = [];
  for (const m of String(text).toLowerCase().matchAll(/[a-z']+|\d|[.,!?;:—–-]+/g)) {
    const t = m[0];
    if (/^\d$/.test(t)) items.push({ c: m.index, shapes: wordToShapes(DIGITS[Number(t)]) });
    else if (/^[a-z']/.test(t)) items.push({ c: m.index, shapes: wordToShapes(t) });
    else items.push({ pause: /[.!?;:]/.test(t) ? 1.8 : 1 });
  }
  return items;
}

const WEIGHT = { ae: 1.7, ee: 1.5, ah: 1.8, oh: 1.7, oo: 1.5, uh: 1.4, mbp: 1.0, fv: 0.9, th: 0.9, l: 0.8, chsh: 0.9, r: 0.8, sz: 0.8, kg: 0.8, rest: 1 };
const PRIORITY = (v) => (v === 'mbp' || v === 'fv' ? 3 : VOWELS.has(v) ? 2 : 1);

/**
 * Turns text into key shapes on the timeline. keys are { f, v }: from frame f the mouth holds shape v until the next key.
 * speed 1 is about 14 sounds a second; fps and start place it on the timeline.
 */
export function buildSpeech(text, { fps = 24, start = 0, speed = 1 } = {}) {
  const upf = Math.max(0.2, fps / (14 * Math.max(0.25, speed))); // frames per unit of weight
  const raw = []; let t = 0; const words = []; // words: where each word starts in the text and on the timeline, so a voice can be kept in step
  raw.push({ t: 0, v: 'rest' }); t = 0.5 * upf;
  for (const it of tokens(text)) {
    if (it.pause) { raw.push({ t, v: 'rest' }); t += it.pause * upf; continue; }
    words.push({ c: it.c, f: start + Math.round(t) });
    for (const v of it.shapes) { raw.push({ t, v }); t += (WEIGHT[v] ?? 1) * upf; }
  }
  const endT = t + 0.5 * upf;
  // one key per frame (the more telling shape wins), and no repeats
  const keys = [];
  for (const k of raw) {
    const f = start + Math.round(k.t);
    const last = keys[keys.length - 1];
    if (last && last.f === f) { if (PRIORITY(k.v) >= PRIORITY(last.v)) last.v = k.v; continue; }
    if (last && last.v === k.v) continue;
    keys.push({ f, v: k.v });
  }
  const endF = Math.max((keys[keys.length - 1]?.f ?? start) + 1, start + Math.round(endT));
  if (keys[keys.length - 1]?.v !== 'rest') keys.push({ f: endF, v: 'rest' });
  return { text: String(text), start, speed, fps, keys, words, end: keys[keys.length - 1].f };
}

/** The shape id on frame `frame`, or null when there is no speech there (before it starts). */
export function speechAt(sp, frame) {
  const ks = sp?.keys;
  if (!ks?.length || frame < ks[0].f) return null;
  let lo = 0; let hi = ks.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (ks[mid].f <= frame) lo = mid; else hi = mid - 1; }
  return ks[lo].v;
}
/** The key that starts exactly on this frame, if any. */
export const keyOn = (sp, frame) => sp?.keys?.find((k) => k.f === frame) ?? null;

/** A speech object read back from a saved file, or null. */
export function cleanSpeech(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.keys)) return null;
  const keys = raw.keys.map((k) => ({ f: Math.max(0, Math.round(Number(k?.f))), v: k?.v })).filter((k) => Number.isFinite(k.f) && VISEME_BY_ID[k.v]).sort((a, b) => a.f - b.f);
  if (!keys.length) return null;
  const words = Array.isArray(raw.words) ? raw.words.map((w) => ({ c: Math.max(0, Math.round(Number(w?.c))), f: Math.max(0, Math.round(Number(w?.f))) })).filter((w) => Number.isFinite(w.c) && Number.isFinite(w.f)).sort((a, b) => a.c - b.c) : [];
  return { words, text: String(raw.text ?? '').slice(0, 600), start: Math.max(0, Math.round(Number(raw.start) || 0)), speed: Math.min(2.5, Math.max(0.25, Number(raw.speed) || 1)), fps: Number(raw.fps) || 24, keys, end: keys[keys.length - 1].f };
}

// ---------- the shape of the mouth ----------
/**
 * The outline of a mouth shape in a flat plane, in head radii: z across, y up, centred on the mouth.
 * top and bot are the upper and lower lip lines, from the left corner to the right corner.
 */
export function mouthShape(id) {
  const m = VISEME_BY_ID[id] || VISEME_BY_ID.rest;
  const W = 0.33 * (1 + 0.5 * Math.max(0, m.wide) + 0.45 * Math.min(0, m.wide)) * (1 - 0.3 * m.round);
  const H = m.press ? 0 : 0.03 + 0.5 * m.open;
  const k = 0.6 - 0.1 * m.round + 0.35 * Math.max(0, m.wide); // how pointed the corners are: low is a round O, high a flat lens
  const lift = 0.05 * Math.max(0, m.wide);
  const N = 15; const top = []; const bot = [];
  for (let i = 0; i < N; i++) {
    const u = (i / (N - 1)) * 2 - 1;
    const prof = Math.pow(Math.max(0, 1 - u * u), k);
    top.push([W * u, lift * u * u + 0.3 * H * prof]);
    bot.push([W * u, lift * u * u - 0.7 * H * prof]);
  }
  return { id: m.id, W, H, top, bot, teeth: m.teeth, tongue: m.tongue, tuck: m.tuck, press: m.press, round: m.round };
}
