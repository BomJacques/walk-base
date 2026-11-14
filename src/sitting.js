// Sitting down, with controls: how high the seat is (a chair, a stool, a low seat, the floor, or the top of a box in the scene), how the body is held (upright, relaxed, slouched, leaning forward
// or back), where the feet go and what the hands do. From these it works out the pose for the figure's own leg lengths, so the thighs and shins meet the seat whatever the figure's proportions, and
// makes the movement that gets there (a lean forward first, then the hips going back and down). Pure logic, no DOM.
import { poseBuild, BASE_ARMS } from './moves.js';
import { CHAIR_STYLES } from './scene.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/** The seats: a chair that is drawn (and can be made to your own taste), an invisible chair (the pose only, as if miming), or the floor. Heights are in leg lengths; a chair seat is a little under half a leg length up. */
export const SEATS = { Chair: 0.38, 'Invisible chair': 0.38, Floor: 0.03 };
/** How the body is held: offsets of the spine and head. */
export const POSTURES = {
  Upright: { 'spine1.pitch': 0.03, 'spine2.pitch': 0.03, 'spine3.pitch': 0.02, 'neck.pitch': 0, 'head.pitch': 0 },
  Relaxed: { 'spine1.pitch': -0.04, 'spine2.pitch': -0.06, 'spine3.pitch': -0.04, 'neck.pitch': 0.05, 'head.pitch': 0.02 },
  Slouched: { 'spine1.pitch': 0.2, 'spine2.pitch': 0.28, 'spine3.pitch': 0.2, 'neck.pitch': -0.22, 'head.pitch': -0.08 },
  'Leaning forward': { 'spine1.pitch': 0.32, 'spine2.pitch': 0.26, 'spine3.pitch': 0.18, 'neck.pitch': -0.2, 'head.pitch': -0.04 },
  'Leaning back': { 'spine1.pitch': -0.14, 'spine2.pitch': -0.14, 'spine3.pitch': -0.08, 'neck.pitch': 0.08, 'head.pitch': 0.04 },
};
/** Where the feet go: how far each foot is moved forward (+) or back (-) from under the knees, in leg lengths. */
export const FEET = { Flat: [0, 0], 'Tucked back': [-0.2, -0.2], 'Out in front': [0.28, 0.28], Crossed: [0.12, 0.34] };
/** What the hands do. */
export const HANDS = {
  'On thighs': { 'arm.pitch.R': 0.5, 'arm.pitch.L': 0.5, 'elbow.flex.R': 0.9, 'elbow.flex.L': 0.9 },
  'On knees': { 'arm.pitch.R': 0.8, 'arm.pitch.L': 0.8, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 },
  'In lap': { 'arm.pitch.R': 0.55, 'arm.pitch.L': 0.55, 'elbow.flex.R': 1.2, 'elbow.flex.L': 1.2, 'arm.roll.R': -0.15, 'arm.roll.L': -0.15 },
  'Arms folded': { 'arm.pitch.R': 0.45, 'arm.pitch.L': 0.45, 'elbow.flex.R': 2.0, 'elbow.flex.L': 2.0, 'arm.roll.R': -0.5, 'arm.roll.L': -0.5 },
  'Hands behind head': { 'arm.pitch.R': 2.2, 'arm.pitch.L': 2.2, 'elbow.flex.R': 2.5, 'elbow.flex.L': 2.5, 'arm.roll.R': 0.6, 'arm.roll.L': 0.6 },
};

/** The chair that is drawn when the seat is Chair: its style, size, back, arms, colours, and which prop in the scene it is once it has been put there. */
export const CHAIR_DEFAULTS = Object.freeze({ style: 'Kitchen', back: CHAIR_STYLES.Kitchen.back, arms: false, w: CHAIR_STYLES.Kitchen.w, d: CHAIR_STYLES.Kitchen.d, color: '#a98467', cushion: '#b9503f', cushionOn: true, id: null });
export const SIT_DEFAULTS = Object.freeze({ seat: 'Chair', seatHeight: SEATS.Chair, posture: 'Upright', feet: 'Flat', hands: 'On thighs', frames: 64, chair: CHAIR_DEFAULTS });
const LEGACY = { Stool: 0.5, 'Low seat': 0.26 }; // seats of earlier versions: invisible seats of those heights
const hex = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);

/** Clean settings from anything: known names, numbers in range. `seat` may also be 'prop:<id>' (the top of a box in the scene) or 'Custom'. */
export function cleanSit(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}; const D = SIT_DEFAULTS;
  const n = (v, lo, hi, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? clamp(Number(v), lo, hi) : d);
  const legacy = LEGACY[r.seat] != null; const seat = legacy ? 'Invisible chair' : SEATS[r.seat] != null || r.seat === 'Custom' || (typeof r.seat === 'string' && /^prop:[\w-]{1,40}$/.test(r.seat)) ? r.seat : D.seat;
  const c = r.chair && typeof r.chair === 'object' ? r.chair : {}; const C = CHAIR_DEFAULTS; const style = CHAIR_STYLES[c.style] ? c.style : C.style;
  const chair = { style, back: n(c.back, 0, 1.6, CHAIR_STYLES[style].back), arms: c.arms === undefined ? CHAIR_STYLES[style].arms : c.arms === true, w: n(c.w, 0.2, 1.5, CHAIR_STYLES[style].w), d: n(c.d, 0.2, 2, CHAIR_STYLES[style].d), color: hex(c.color, C.color), cushion: hex(c.cushion, C.cushion), cushionOn: c.cushionOn !== false, id: typeof c.id === 'string' && /^[\w-]{1,40}$/.test(c.id) ? c.id : null };
  return { seat, seatHeight: n(legacy ? LEGACY[r.seat] : r.seatHeight, 0, 1.2, SEATS[seat] ?? D.seatHeight), posture: POSTURES[r.posture] ? r.posture : D.posture, feet: FEET[r.feet] ? r.feet : D.feet, hands: HANDS[r.hands] ? r.hands : D.hands, frames: Math.round(n(r.frames, 24, 200, D.frames)), chair };
}

/** The seat height (leg lengths above the ground) for the settings; a box in the scene gives the height of its top. */
export const seatHeightOf = (s, boxTop = () => null) => (typeof s.seat === 'string' && s.seat.startsWith('prop:') ? boxTop(s.seat.slice(5)) ?? s.seatHeight : s.seat === 'Floor' ? SEATS.Floor : s.seatHeight);

/**
 * The pose of a figure seated: { channel: offset }. stand = { hip (standing hip height), l1 (thigh), l2 (shin) } in leg lengths, from the figure itself.
 * The hips go to the seat, back far enough that the knees are over the feet; the feet and hands as chosen; the body as held.
 */
export function sitPose(settings, stand, seat = null) {
  const s = cleanSit(settings); const h = seat ?? seatHeightOf(s); const floor = h < 0.12;
  const hipY = h + 0.07; const y = hipY - stand.hip; const [fr, fl] = FEET[s.feet];
  const kneeY = stand.l2 + 0.075; const dy = clamp(hipY - kneeY, -stand.l1 * 0.95, stand.l1 * 0.95); const dx = Math.sqrt(Math.max(0, stand.l1 * stand.l1 - dy * dy));
  const out = { 'pelvis.y': y, 'pelvis.x': -dx + 0.02, ...POSTURES[s.posture], ...HANDS[s.hands] };
  if (floor) { const reach = (stand.l1 + stand.l2) * 0.9; out['pelvis.x'] = -0.05; out['foot.x.R'] = reach * 0.55 + fr; out['foot.x.L'] = reach * 0.55 + fl; out['foot.y.R'] = 0; out['foot.y.L'] = 0; } // on the floor the legs stretch out in front
  else { out['foot.x.R'] = fr; out['foot.x.L'] = fl; }
  return out;
}

/** The movement of sitting down for these settings and this figure: a lean forward, the hips back and down, the body settling into the pose. It stays seated; Stand up undoes it. */
export function sitClip(settings, stand, seat = null) {
  const s = cleanSit(settings); const pose = sitPose(s, stand, seat);
  const approach = { 'pelvis.x': pose['pelvis.x'] * 0.45, 'pelvis.y': pose['pelvis.y'] * 0.38, 'spine1.pitch': 0.32, 'spine2.pitch': 0.24, 'spine3.pitch': 0.16, 'neck.pitch': -0.2, 'arm.pitch.R': 0.8, 'arm.pitch.L': 0.8, 'elbow.flex.R': 0.3, 'elbow.flex.L': 0.3 };
  const settle = { ...pose, 'spine1.pitch': (pose['spine1.pitch'] ?? 0) + 0.1, 'spine2.pitch': (pose['spine2.pitch'] ?? 0) + 0.08, 'pelvis.y': pose['pelvis.y'] + 0.015 };
  return {
    id: 'sit', label: 'Sit down', frames: s.frames, ends: 'stays seated',
    help: 'From standing: leans forward, the hips go back and down onto the seat you chose, the feet and hands as set in the Sitting section of the Body tab. Stand up to rise.',
    build: poseBuild([[0.3, approach], [0.7, settle], [0.85, pose]], { kill: BASE_ARMS, stay: true }),
  };
}
