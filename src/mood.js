// The mood pad: a square with a mood in each corner. The middle is the walk as it is; moving toward a corner turns the walk into that mood, and moving along an edge
// mixes the two moods on it. Each corner can be a mood from the list, one of the figure's own walks, or a walk you captured, and any setting can be left out.
// Pure: numbers in, numbers out. app.js owns the pad on the screen.

/**
 * The moods, as the settings a Normal walk would have in that mood. Against another walk they are used as a change (this value less the default), so
 * a happy limp is still a limp. Only numbers that are gait settings.
 */
export const MOODS = Object.freeze({
  Happy: { stepLength: 0.86, bob: 0.12, cycleFrames: 20, armSwing: 40, elbowSwing: 32, footLift: 0.22, lean: 0, headNod: 3.5, torsoSway: 3, pelvisRoll: 6, toeOff: 42, weight: -0.4, chestOut: 7, headTilt: -7, shoulderCounter: 13 },
  Angry: { stepLength: 0.9, bob: 0.07, cycleFrames: 18, armSwing: 30, elbowBase: 52, elbowSwing: 10, lean: 11, headNod: 4, heelStrike: 26, footLift: 0.18, torsoSway: 1, weight: 0.5, stepWidth: 0.1, chestOut: 3, headTilt: 9, shrug: 0.03, armOut: 9 },
  Tired: { stepLength: 0.5, bob: 0.05, footLift: 0.05, lean: 11, armSwing: 8, duty: 0.68, cycleFrames: 32, headNod: 4, headBob: 0, heelStrike: 6, toeOff: 20, legExtend: 0.95, weight: 0.5, chestOut: -11, headTilt: 12, armCarry: 4 },
  Sneaky: { stepLength: 0.5, duty: 0.72, footLift: 0.22, bob: 0.03, lean: 12, armSwing: 6, cycleFrames: 40, heelStrike: 3, headBob: 0.9, legExtend: 0.9, liftPeak: 0.55, heelDown: 0.3, torsoSway: 0.6, chestOut: -8, headTilt: -6, elbowBase: 60, armCarry: 18, shrug: 0.03 },
  Sad: { stepLength: 0.55, bob: 0.04, footLift: 0.07, lean: 8, armSwing: 6, cycleFrames: 34, headNod: 6, duty: 0.66, torsoSway: 0.6, weight: 0.3, chestOut: -13, headTilt: 16, toeOut: 3, armCarry: -3 },
  Proud: { stepLength: 0.8, duty: 0.58, footLift: 0.15, bob: 0.09, lean: -3, armSwing: 30, headBob: 0.7, pelvisRoll: 7, pelvisYaw: 12, torsoSway: 3, shoulderCounter: 14, toeOut: 12, cycleFrames: 28, chestOut: 11, headTilt: -9 },
  Scared: { stepLength: 0.42, cycleFrames: 14, bob: 0.04, lean: -3, armSwing: 6, elbowBase: 72, armOut: 7, footLift: 0.1, duty: 0.62, headNod: 1, chestOut: -6, headTilt: -3, shrug: 0.045, armCarry: 22, noiseAmount: 0.35, stepWidth: 0.05 },
  Dreamy: { stepLength: 0.6, cycleFrames: 34, bob: 0.09, lean: -2, armSwing: 20, elbowSwing: 10, footLift: 0.14, torsoSway: 4, sway: 0.06, headNod: 3, headTilt: -12, chestOut: 3, weight: -0.5, toeOut: 12 },
});
export const MOODS_DOG = Object.freeze({
  Happy: { dogStride: 1.15, dogBob: 0.05, dogLift: 0.18, dogTailAngle: 44, dogWag: 44, dogEar: 14, dogHeadNod: 5, dogNeckAngle: 58, cycleFrames: 18, weight: -0.3 },
  Angry: { dogStride: 1.05, dogBob: 0.02, dogLift: 0.1, dogNeckAngle: 32, dogHeadAngle: 22, dogTailAngle: 14, dogWag: 2, dogEar: 2, dogDuty: 0.7, cycleFrames: 22, weight: 0.4 },
  Tired: { dogStride: 0.6, dogLift: 0.06, dogDuty: 0.74, dogBob: 0.012, dogNeckAngle: 36, dogHeadAngle: 44, dogTailAngle: 0, dogWag: 5, cycleFrames: 36, weight: 0.5 },
  Sneaky: { dogStride: 0.6, dogLift: 0.09, dogBob: 0.008, dogDuty: 0.76, dogNeckAngle: 22, dogHeadAngle: 26, dogTailAngle: 4, dogWag: 2, dogEar: 2, cycleFrames: 36 },
  Sad: { dogStride: 0.65, dogLift: 0.07, dogBob: 0.015, dogNeckAngle: 30, dogHeadAngle: 52, dogTailAngle: -12, dogWag: 2, dogEar: 3, cycleFrames: 34, weight: 0.3 },
  Proud: { dogStride: 1.0, dogLift: 0.22, dogBob: 0.04, dogNeckAngle: 70, dogHeadAngle: 62, dogTailAngle: 52, dogWag: 14, dogArch: 3, cycleFrames: 22 },
  Scared: { dogStride: 0.5, dogLift: 0.07, dogBob: 0.01, dogDuty: 0.72, dogNeckAngle: 34, dogHeadAngle: 40, dogTailAngle: -20, dogWag: 3, dogEar: 2, cycleFrames: 14, noiseAmount: 0.3 },
  Dreamy: { dogStride: 0.8, dogLift: 0.14, dogBob: 0.04, dogFlex: 9, dogNeckAngle: 60, dogHeadAngle: 30, dogTailAngle: 34, dogWag: 30, cycleFrames: 32, weight: -0.4 },
});
export const moodsFor = (rig) => (rig === 'dog' ? MOODS_DOG : MOODS);
export const CORNERS = ['tl', 'tr', 'bl', 'br'];
export const CORNER_LABELS = { tl: 'Top left', tr: 'Top right', bl: 'Bottom left', br: 'Bottom right' };
/** A new pad: the walk as it is in the middle, and the four moods the request named in the corners. */
export const newMood = () => ({ x: 0.5, y: 0.5, corners: { tl: { kind: 'mood', name: 'Happy' }, tr: { kind: 'mood', name: 'Angry' }, bl: { kind: 'mood', name: 'Tired' }, br: { kind: 'mood', name: 'Sneaky' } }, skip: [], base: null });

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(Number(v)) ? Number(v) : 0.5));

/**
 * How much of each corner at a place on the pad (x across from the left, y down from the top, both 0 to 1). Nothing at the middle; all of one mood at its corner;
 * half and half of two moods half way along the edge between them. The four always add up to how far the dot is from the middle (0 to 1).
 */
export function moodWeights(x0, y0) {
  const x = clamp01(x0); const y = clamp01(y0);
  const strength = Math.min(1, 2 * Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)));
  if (strength <= 1e-9) return { tl: 0, tr: 0, bl: 0, br: 0, strength: 0 };
  // where the line from the middle through the dot meets the edge of the pad: the mix there, scaled by how far out the dot is
  const k = 0.5 / Math.max(Math.abs(x - 0.5), Math.abs(y - 0.5)); const ex = clamp01(0.5 + (x - 0.5) * k); const ey = clamp01(0.5 + (y - 0.5) * k);
  return { tl: (1 - ex) * (1 - ey) * strength, tr: ex * (1 - ey) * strength, bl: (1 - ex) * ey * strength, br: ex * ey * strength, strength };
}

/** The settings a corner asks for, given the walk in the middle. corner: { kind: 'mood' | 'preset' | 'custom', name, values }. */
export function cornerTarget(corner, base, defaults, rig, presets = {}) {
  if (!corner) return {};
  const out = {};
  if (corner.kind === 'mood') { const m = moodsFor(rig)[corner.name] || {}; for (const [k, v] of Object.entries(m)) if (typeof base[k] === 'number') out[k] = base[k] + (v - defaults[k]); }
  else if (corner.kind === 'preset') { for (const [k, v] of Object.entries(presets[corner.name] || {})) if (typeof v === 'number' && typeof base[k] === 'number') out[k] = v; }
  else if (corner.kind === 'custom') { for (const [k, v] of Object.entries(corner.values || {})) if (typeof v === 'number' && typeof base[k] === 'number') out[k] = v; }
  return out;
}

/** Every setting the four corners move, in the order they first appear. */
export function moodKeys(mood, base, defaults, rig, presets) {
  const seen = []; for (const c of CORNERS) for (const k of Object.keys(cornerTarget(mood.corners[c], base, defaults, rig, presets))) if (!seen.includes(k)) seen.push(k);
  return seen;
}

/**
 * The walk at the dot: { setting: value } for every setting the corners move and that is not left out. limit(k, v) keeps a value inside its slider.
 * A corner that says nothing about a setting leaves it as the middle has it.
 */
export function blendMood(mood, base, defaults, rig, presets = {}, limit = (k, v) => v) {
  const w = moodWeights(mood.x, mood.y); const targets = Object.fromEntries(CORNERS.map((c) => [c, cornerTarget(mood.corners[c], base, defaults, rig, presets)]));
  const out = {}; const skip = new Set(mood.skip || []);
  for (const k of moodKeys(mood, base, defaults, rig, presets)) {
    if (skip.has(k)) { out[k] = base[k]; continue; }
    let v = base[k]; for (const c of CORNERS) v += w[c] * ((targets[c][k] ?? base[k]) - base[k]);
    out[k] = limit(k, k === 'cycleFrames' ? Math.round(v) : v);
  }
  return out;
}

/** A saved pad, cleaned. */
export function cleanMood(raw) {
  const m = newMood(); if (!raw || typeof raw !== 'object') return m;
  m.x = clamp01(raw.x); m.y = clamp01(raw.y);
  for (const c of CORNERS) {
    const q = raw.corners?.[c]; if (!q || !['mood', 'preset', 'custom'].includes(q.kind)) continue;
    const values = {}; if (q.kind === 'custom') for (const [k, v] of Object.entries(q.values || {})) if (Number.isFinite(Number(v))) values[String(k).slice(0, 40)] = Number(v);
    m.corners[c] = { kind: q.kind, name: String(q.name || '').slice(0, 40), ...(q.kind === 'custom' ? { values } : {}) };
  }
  m.skip = Array.isArray(raw.skip) ? raw.skip.filter((k) => typeof k === 'string').slice(0, 80) : [];
  if (raw.base && typeof raw.base === 'object') { m.base = {}; for (const [k, v] of Object.entries(raw.base)) if (Number.isFinite(Number(v))) m.base[String(k).slice(0, 40)] = Number(v); }
  return m;
}
