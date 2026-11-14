// The scene: more figures walking beside the main one, each with its own walk, and plain scenery to stand them in.
import { cleanDesign, cleanInk } from './design.js';
// Pure data and geometry. draw.js poses and paints the figures; this file knows how an item is described, cleaned, and how a prop is built from faces.

const rad = (d) => (d * Math.PI) / 180;
const num = (v, d, lo, hi) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const col = (v, d) => (/^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
let counter = 1;
export const sceneId = () => `s${Date.now().toString(36)}${(counter++).toString(36)}`;

/** The scenery that can be added. kind is how it is built; the rest are the starting size and colour. */
export const PROP_KINDS = [
  { id: 'box', label: 'Box', kind: 'box', w: 0.6, d: 0.6, h: 0.5, color: '#b08968' },
  { id: 'step', label: 'Step', kind: 'box', w: 1.2, d: 0.9, h: 0.18, color: '#9aa0a6' },
  { id: 'wall', label: 'Wall', kind: 'box', w: 2.6, d: 0.16, h: 1.8, color: '#cfc8bc' },
  { id: 'fence', label: 'Fence', kind: 'box', w: 2.4, d: 0.06, h: 0.9, color: '#a98467' },
  { id: 'pillar', label: 'Pillar', kind: 'cylinder', w: 0.35, d: 0.35, h: 2, color: '#d6d0c4' },
  { id: 'lamp', label: 'Lamp post', kind: 'lamp', w: 0.12, d: 0.12, h: 2.4, color: '#3d4045' },
  { id: 'ball', label: 'Ball', kind: 'ball', w: 0.5, d: 0.5, h: 0.5, color: '#d0504a' },
  { id: 'tree', label: 'Tree', kind: 'ltree', w: 0.26, d: 0.26, h: 2.6, color: '#8fbf7a' },
  { id: 'pine', label: 'Pine', kind: 'lpine', w: 0.22, d: 0.22, h: 3.2, color: '#7fae8a' },
  { id: 'bush', label: 'Bush', kind: 'lbush', w: 1, d: 1, h: 0.75, color: '#9ccc8a' },
  { id: 'picture', label: 'Picture…', kind: 'image', w: 2.4, d: 0.05, h: 1.4, color: '#ffffff' },
  { id: 'sheet', label: 'Drawing sheet', kind: 'sheet', w: 2.4, d: 0.05, h: 1.4, color: '#ffffff' },
  { id: 'chair', label: 'Chair', kind: 'chair', w: 0.44, d: 0.44, h: 0.38, color: '#a98467' },
  { id: 'rock', label: 'Rock', kind: 'ball', w: 0.9, d: 0.9, h: 0.55, color: '#8a8d91' },
];
/** The chairs that can be made: how a chair is built, with its starting seat height, back, arms and size (front to back is w, side to side is d). */
export const CHAIR_STYLES = {
  Kitchen: { h: 0.38, back: 0.5, arms: false, w: 0.44, d: 0.44 }, Stool: { h: 0.5, back: 0, arms: false, w: 0.34, d: 0.34 }, Armchair: { h: 0.36, back: 0.55, arms: true, w: 0.6, d: 0.62 },
  Bench: { h: 0.38, back: 0, arms: false, w: 0.4, d: 1.1 }, Office: { h: 0.42, back: 0.5, arms: true, w: 0.5, d: 0.5 },
};
export const PROP_BY_ID = Object.fromEntries(PROP_KINDS.map((k) => [k.id, k]));

export function newProp(id, over = {}) {
  const k = PROP_BY_ID[id] || PROP_KINDS[0];
  const chair = k.kind === 'chair' ? { style: 'Kitchen', back: CHAIR_STYLES.Kitchen.back, arms: false, cushion: '#b9503f', cushionOn: true } : {};
  return { ...chair, id: sceneId(), type: k.id, name: k.label, kind: k.kind, x: 0.8, y: 0, z: -0.9, rot: 0, w: k.w, d: k.d, h: k.h, color: k.color, visible: true, locked: false, img: '', asp: 0.6, flip: false, noShadow: false, phys: 'none', physStart: 0, bounce: 0.5, friction: 0.4, throwX: 0, push: 1.3, ...over };
}
/** A figure to put in the scene. params is the whole parameter set of its walk (the same keys as the main figure), r its proportions. */
export function newActor(fig, name, params, proportions, over = {}) {
  return { id: sceneId(), fig, name: name || fig, preset: '', p: params, r: proportions || {}, x: 1.2, z: -0.5, yaw: 0, scale: 1, phase: 0.25, fill: '', line: '', tint: '', visible: true, locked: false, noShadow: false, ...over };
}

export const EMPTY_SCENE = () => ({ actors: [], props: [] });

/** A saved scene, cleaned. keys of the walk parameters are kept only if they are numbers, strings or booleans (the caller fills in the rest from the defaults). */
export function cleanScene(raw, figs, defaults) {
  const out = EMPTY_SCENE();
  if (!raw || typeof raw !== 'object') return out;
  for (const a of Array.isArray(raw.actors) ? raw.actors.slice(0, 12) : []) {
    if (!a || !figs.includes(a.fig)) continue;
    const p = { ...defaults };
    for (const [k, v] of Object.entries(a.p && typeof a.p === 'object' ? a.p : {})) if (k in defaults && (typeof v === typeof defaults[k])) p[k] = typeof v === 'number' ? (Number.isFinite(v) ? v : defaults[k]) : v;
    const r = {}; for (const [k, v] of Object.entries(a.r && typeof a.r === 'object' ? a.r : {})) if (Number.isFinite(Number(v))) r[k] = num(v, 1, 0.1, 4);
    out.actors.push({ id: String(a.id || sceneId()).slice(0, 40), fig: a.fig, name: String(a.name || a.fig).slice(0, 40), preset: String(a.preset || '').slice(0, 40), p, r,
      x: num(a.x, 1.2, -12, 12), z: num(a.z, -0.5, -8, 8), yaw: num(a.yaw, 0, -360, 360), scale: num(a.scale, 1, 0.2, 3), phase: num(a.phase, 0, 0, 1), fill: col(a.fill, ''), line: col(a.line, ''), tint: col(a.tint, ''), visible: a.visible !== false, locked: Boolean(a.locked), noShadow: Boolean(a.noShadow), ...(a.design ? (() => { const dz = cleanDesign({ [a.fig]: a.design }, [a.fig])[a.fig]; return dz ? { design: dz } : {}; })() : {}) });
  }
  for (const q of Array.isArray(raw.props) ? raw.props.slice(0, 40) : []) {
    if (!q || !PROP_BY_ID[q.type]) continue;
    const k = PROP_BY_ID[q.type];
    out.props.push({ id: String(q.id || sceneId()).slice(0, 40), type: k.id, name: String(q.name || k.label).slice(0, 40), kind: k.kind, x: num(q.x, 0, -12, 12), y: num(q.y, 0, -3, 8), z: num(q.z, 0, -8, 8), rot: num(q.rot, 0, -360, 360),
      w: num(q.w, k.w, 0.03, 8), d: num(q.d, k.d, 0.03, 8), h: num(q.h, k.h, 0.03, 8), color: col(q.color, k.color), visible: q.visible !== false, locked: Boolean(q.locked), img: typeof q.img === 'string' ? q.img.slice(0, 40) : '', asp: num(q.asp, 0.6, 0.05, 20), flip: Boolean(q.flip), noShadow: Boolean(q.noShadow),
      phys: ['drop', 'tip'].includes(q.phys) ? q.phys : 'none', physStart: Math.round(num(q.physStart, 0, 0, 14400)), bounce: num(q.bounce, 0.5, 0, 0.95), friction: num(q.friction, 0.4, 0, 1), throwX: num(q.throwX, 0, -12, 12), push: num(q.push, 1.3, -3, 3), ...(k.kind === 'chair' ? { style: CHAIR_STYLES[q.style] ? q.style : 'Kitchen', back: num(q.back, 0.5, 0, 1.6), arms: Boolean(q.arms), cushion: col(q.cushion, '#b9503f'), cushionOn: q.cushionOn !== false } : {}), ...(q.ink ? (() => { const k = cleanInk(q.ink); return k ? { ink: k } : {}; })() : {}) });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Props as faces
// ---------------------------------------------------------------------------------------------------------------
/** The place a point of a prop goes in the world: turned about its own middle, then moved to x, z. */
const place = (q, lx0, y0, lz) => {
  let lx = lx0; let y = y0;
  if (q.tilt) { // pushed over: turned about its bottom edge on the side it falls towards
    const s = q.tilt < 0 ? -1 : 1; const t = rad(Math.abs(q.tilt)); const px = (s * q.w) / 2; const u = (lx0 - px) * s;
    lx = px + s * (u * Math.cos(t) + y0 * Math.sin(t)); y = -u * Math.sin(t) + y0 * Math.cos(t);
  }
  const a = rad(q.rot); const c = Math.cos(a); const s = Math.sin(a); return [q.x + c * lx + s * lz, y + (q.y || 0), q.z - s * lx + c * lz]; };

/** A box or an upright prism as faces, each { pts: world points, normal: world vector }. */
export function prismFaces(q, sides = 4, radiusRatio = 1, y0 = 0, y1 = q.h, w = q.w, d = q.d, cx = 0, cz = 0) {
  const ring = (y) => Array.from({ length: sides }, (_, i) => {
    const a = sides === 4 ? ((i + 0.5) / 4) * Math.PI * 2 : (i / sides) * Math.PI * 2;
    const lx = cx + (sides === 4 ? Math.sign(Math.cos(a)) * (w / 2) : Math.cos(a) * (w / 2) * radiusRatio); const lz = cz + (sides === 4 ? Math.sign(Math.sin(a)) * (d / 2) : Math.sin(a) * (d / 2) * radiusRatio);
    return place(q, lx, y, lz);
  });
  const lo = ring(y0); const hi = ring(y1); const faces = [];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides; const pts = [lo[i], lo[j], hi[j], hi[i]];
    const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]]; const e2 = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1], pts[3][2] - pts[0][2]];
    const n = [e2[1] * e1[2] - e2[2] * e1[1], e2[2] * e1[0] - e2[0] * e1[2], e2[0] * e1[1] - e2[1] * e1[0]]; const l = Math.hypot(...n) || 1;
    faces.push({ pts, normal: [n[0] / l, n[1] / l, n[2] / l] });
  }
  // the top and the bottom: straight up and down unless the prop has been tipped over
  const mid = (r) => [0, 1, 2].map((k) => r.reduce((t, p) => t + p[k], 0) / r.length); const mh = mid(hi); const ml = mid(lo);
  const up = [mh[0] - ml[0], mh[1] - ml[1], mh[2] - ml[2]]; const ul = Math.hypot(...up) || 1; const un = [up[0] / ul, up[1] / ul, up[2] / ul];
  faces.push({ pts: hi.slice(), normal: un }); faces.push({ pts: lo.slice().reverse(), normal: [-un[0], -un[1], -un[2]] });
  return faces;
}

/** A chair as boxes: { faces } of [{ pts, normal, color }]. The seat top is at q.h; w is front to back, d side to side; the front is toward +x. */
function chairFaces(q) {
  const out = []; const frame = q.color; const cush = q.cushionOn === false ? q.color : q.cushion || '#b9503f'; const h = q.h; const hw = q.w / 2; const hd = q.d / 2; const back = q.back || 0; const style = q.style || 'Kitchen';
  const bx = (xa, xb, y0, y1, za, zb, color) => { const x0 = Math.min(xa, xb); const x1 = Math.max(xa, xb); const z0 = Math.min(za, zb); const z1 = Math.max(za, zb); for (const f of prismFaces(q, 4, 1, y0, y1, x1 - x0, z1 - z0, (x0 + x1) / 2, (z0 + z1) / 2)) out.push({ ...f, color }); };
  const cyl = (cx, cz, r, y0, y1, color) => { for (const f of prismFaces(q, 12, 1, y0, y1, 2 * r, 2 * r, cx, cz)) out.push({ ...f, color }); };
  const legs = (t, top, inset = 0.02) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const cx = sx * (hw - inset - t / 2); const cz = sz * (hd - inset - t / 2); bx(cx - t / 2, cx + t / 2, 0, top, cz - t / 2, cz + t / 2, frame); } };
  if (style === 'Stool') { legs(0.04, h - 0.05); bx(-hw, hw, h - 0.05, h, -hd, hd, cush); }
  else if (style === 'Bench') { for (const sz of [-1, 1]) bx(-hw * 0.85, hw * 0.85, 0, h - 0.06, sz * (hd - 0.07) - 0.025, sz * (hd - 0.07) + 0.025, frame); bx(-hw, hw, h - 0.06, h, -hd, hd, cush); }
  else if (style === 'Armchair') {
    bx(-hw, hw, 0.05, h - 0.13, -hd, hd, frame); for (const sx of [-1, 1]) for (const sz of [-1, 1]) bx(sx * (hw - 0.05) - 0.03, sx * (hw - 0.05) + 0.03, 0, 0.05, sz * (hd - 0.05) - 0.03, sz * (hd - 0.05) + 0.03, frame);
    bx(-hw + 0.1, hw, h - 0.13, h, -hd + 0.1, hd - 0.1, cush); bx(-hw, -hw + 0.12, h - 0.13, h + Math.max(0.2, back), -hd, hd, frame);
    if (q.arms) for (const sz of [-1, 1]) bx(-hw, hw, h - 0.13, h + 0.2, sz * hd - (sz > 0 ? 0.1 : -0.1) * 1, sz * hd, frame);
  } else if (style === 'Office') {
    bx(-hw * 0.9, hw * 0.9, 0.02, 0.06, -hd * 0.9, hd * 0.9, frame); cyl(0, 0, 0.035, 0.06, h - 0.1, frame); bx(-hw, hw, h - 0.1, h, -hd, hd, cush);
    if (back > 0) bx(-hw, -hw + 0.07, h + 0.08, h + 0.08 + back, -hd * 0.85, hd * 0.85, cush);
    if (q.arms) for (const sz of [-1, 1]) { bx(-0.02, 0.02, h, h + 0.2, sz * hd - 0.02, sz * hd + 0.02, frame); bx(-hw * 0.6, hw * 0.4, h + 0.2, h + 0.23, sz * hd - 0.03, sz * hd + 0.03, frame); }
  } else { // a kitchen chair: four legs, a seat, two back posts and a top rail
    legs(0.045, h - 0.045); bx(-hw, hw, h - 0.045, h, -hd, hd, frame); if (q.cushionOn !== false) bx(-hw + 0.03, hw - 0.03, h, h + 0.03, -hd + 0.03, hd - 0.03, cush);
    if (back > 0) { for (const sz of [-1, 1]) bx(-hw, -hw + 0.045, h, h + back, sz * (hd - 0.025) - 0.0225, sz * (hd - 0.025) + 0.0225, frame); bx(-hw, -hw + 0.04, h + back - 0.12, h + back, -hd, hd, frame); bx(-hw, -hw + 0.03, h + back * 0.45, h + back * 0.45 + 0.05, -hd + 0.04, hd - 0.04, frame); }
    if (q.arms) for (const sz of [-1, 1]) { bx(hw - 0.06, hw - 0.02, h, h + 0.2, sz * (hd - 0.025) - 0.0225, sz * (hd - 0.025) + 0.0225, frame); bx(-hw, hw, h + 0.2, h + 0.235, sz * (hd - 0.025) - 0.03, sz * (hd - 0.025) + 0.03, frame); }
  }
  return out;
}

/** Everything a prop is made of, back to front is left to the caller: { faces: [{pts, normal, color}], balls: [{c, r, color}] }. */
export function propParts(q) {
  if (q.kind === 'sheet') { // a blank sheet of paper standing on the ground, to draw on
    const w = q.w; const hh = q.h; return { faces: [], balls: [], shade: (c) => c, image: { img: '', sheet: true, color: q.color, corners: [place(q, -w / 2, 0, 0), place(q, w / 2, 0, 0), place(q, w / 2, hh, 0), place(q, -w / 2, hh, 0)] } };
  }
  if (q.kind === 'image') { // a flat picture standing on the ground, turned about its middle
    const w = q.w; const hh = q.w * (q.asp || 0.6); const L = q.flip ? w / 2 : -w / 2; const R = q.flip ? -w / 2 : w / 2;
    return { faces: [], balls: [], shade: (c) => c, image: { img: q.img, corners: [place(q, L, 0, 0), place(q, R, 0, 0), place(q, R, hh, 0), place(q, L, hh, 0)] } };
  }
  if (q.kind === 'ltree' || q.kind === 'lpine' || q.kind === 'lbush') return { faces: [], balls: [], shade: (c) => c, line: { kind: q.kind, base: place(q, 0, 0, 0), h: q.h, w: q.w, color: q.color, id: q.id } };
  const shade = (c, k) => { const n = parseInt(c.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const faces = []; const balls = [];
  const add = (fs, color) => fs.forEach((f) => faces.push({ ...f, color }));
  switch (q.kind) {
    case 'box': add(prismFaces(q, 4), q.color); break;
    case 'cylinder': add(prismFaces(q, 20), q.color); break;
    case 'chair': for (const f of chairFaces(q)) faces.push(f); break;
    case 'lamp': { const t = { ...q }; add(prismFaces(t, 10), q.color); balls.push({ c: place(q, 0, q.h + q.w * 1.4, 0), r: q.w * 1.8, color: '#f4e7a8' }); break; }
    case 'ball': balls.push({ c: place(q, 0, q.h / 2, 0), r: q.w / 2, ry: q.h / 2, color: q.color }); break;
    case 'tree': { const trunkH = q.h * 0.45; add(prismFaces({ ...q }, 10, 1, 0, trunkH, q.w, q.d), '#7a5a3a'); balls.push({ c: place(q, 0, trunkH + q.h * 0.28, 0), r: q.h * 0.3, color: q.color }); break; }
    default: add(prismFaces(q, 4), q.color);
  }
  return { faces, balls, shade };
}
/** How lit a face is: the top brightest, one side lighter than the other. */
export const faceLight = (normal) => 0.55 + 0.45 * Math.max(0, normal[0] * -0.35 + normal[1] * 0.8 + normal[2] * 0.4);

/**
 * The flat sheet a drawing on a prop is made on, as four world points [bottom left, bottom right, top right, top left]: the picture of a picture or a drawing sheet, otherwise the front face
 * (the one toward you in the side view). A tree, pine or bush is drawn facing the camera, so it has none here (the painter gives it one on the screen).
 */
export function propSheet(q) {
  if (q.kind === 'ltree' || q.kind === 'lpine' || q.kind === 'lbush') return null;
  if (q.kind === 'image' || q.kind === 'sheet') return propParts(q).image.corners;
  const z = q.d / 2; return [place(q, -q.w / 2, 0, z), place(q, q.w / 2, 0, z), place(q, q.w / 2, q.h, z), place(q, -q.w / 2, q.h, z)];
}
/** The UV frame of a sheet given as four screen points [bottom left, bottom right, top right, top left]: u runs along the top edge, v down the left, both 0 to 1. */
export function sheetFrame(c) {
  const TL = c[3]; const ux = { x: c[2].x - TL.x, y: c[2].y - TL.y }; const vy = { x: c[0].x - TL.x, y: c[0].y - TL.y }; const det = ux.x * vy.y - ux.y * vy.x || 1e-9;
  return { item: true, L: Math.hypot(ux.x, ux.y), W: Math.hypot(vy.x, vy.y), to: (x, y) => { const dx = x - TL.x; const dy = y - TL.y; return [(dx * vy.y - dy * vy.x) / det, (ux.x * dy - ux.y * dx) / det]; }, from: (u, v) => [TL.x + u * ux.x + v * vy.x, TL.y + u * ux.y + v * vy.y] };
}
