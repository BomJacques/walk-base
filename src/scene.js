// The scene: more figures walking beside the main one, each with its own walk, and plain scenery to stand them in.
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
  { id: 'tree', label: 'Tree', kind: 'tree', w: 0.22, d: 0.22, h: 2.6, color: '#5c9a5a' },
  { id: 'rock', label: 'Rock', kind: 'ball', w: 0.9, d: 0.9, h: 0.55, color: '#8a8d91' },
];
export const PROP_BY_ID = Object.fromEntries(PROP_KINDS.map((k) => [k.id, k]));

export function newProp(id, over = {}) {
  const k = PROP_BY_ID[id] || PROP_KINDS[0];
  return { id: sceneId(), type: k.id, name: k.label, kind: k.kind, x: 0.8, y: 0, z: -0.9, rot: 0, w: k.w, d: k.d, h: k.h, color: k.color, visible: true, ...over };
}
/** A figure to put in the scene. params is the whole parameter set of its walk (the same keys as the main figure), r its proportions. */
export function newActor(fig, name, params, proportions, over = {}) {
  return { id: sceneId(), fig, name: name || fig, preset: '', p: params, r: proportions || {}, x: 1.2, z: -0.5, yaw: 0, scale: 1, phase: 0.25, fill: '', line: '', tint: '', visible: true, ...over };
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
      x: num(a.x, 1.2, -12, 12), z: num(a.z, -0.5, -8, 8), yaw: num(a.yaw, 0, -360, 360), scale: num(a.scale, 1, 0.2, 3), phase: num(a.phase, 0, 0, 1), fill: col(a.fill, ''), line: col(a.line, ''), tint: col(a.tint, ''), visible: a.visible !== false });
  }
  for (const q of Array.isArray(raw.props) ? raw.props.slice(0, 40) : []) {
    if (!q || !PROP_BY_ID[q.type]) continue;
    const k = PROP_BY_ID[q.type];
    out.props.push({ id: String(q.id || sceneId()).slice(0, 40), type: k.id, name: String(q.name || k.label).slice(0, 40), kind: k.kind, x: num(q.x, 0, -12, 12), y: num(q.y, 0, -3, 8), z: num(q.z, 0, -8, 8), rot: num(q.rot, 0, -360, 360),
      w: num(q.w, k.w, 0.03, 8), d: num(q.d, k.d, 0.03, 8), h: num(q.h, k.h, 0.03, 8), color: col(q.color, k.color), visible: q.visible !== false });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------
// Props as faces
// ---------------------------------------------------------------------------------------------------------------
/** The place a point of a prop goes in the world: turned about its own middle, then moved to x, z. */
const place = (q, lx, y, lz) => { const a = rad(q.rot); const c = Math.cos(a); const s = Math.sin(a); return [q.x + c * lx + s * lz, y + (q.y || 0), q.z - s * lx + c * lz]; };

/** A box or an upright prism as faces, each { pts: world points, normal: world vector }. */
export function prismFaces(q, sides = 4, radiusRatio = 1, y0 = 0, y1 = q.h, w = q.w, d = q.d) {
  const ring = (y) => Array.from({ length: sides }, (_, i) => {
    const a = sides === 4 ? ((i + 0.5) / 4) * Math.PI * 2 : (i / sides) * Math.PI * 2;
    const lx = sides === 4 ? Math.sign(Math.cos(a)) * (w / 2) : Math.cos(a) * (w / 2) * radiusRatio; const lz = sides === 4 ? Math.sign(Math.sin(a)) * (d / 2) : Math.sin(a) * (d / 2) * radiusRatio;
    return place(q, lx, y, lz);
  });
  const lo = ring(y0); const hi = ring(y1); const faces = [];
  for (let i = 0; i < sides; i++) {
    const j = (i + 1) % sides; const pts = [lo[i], lo[j], hi[j], hi[i]];
    const e1 = [pts[1][0] - pts[0][0], pts[1][1] - pts[0][1], pts[1][2] - pts[0][2]]; const e2 = [pts[3][0] - pts[0][0], pts[3][1] - pts[0][1], pts[3][2] - pts[0][2]];
    const n = [e2[1] * e1[2] - e2[2] * e1[1], e2[2] * e1[0] - e2[0] * e1[2], e2[0] * e1[1] - e2[1] * e1[0]]; const l = Math.hypot(...n) || 1;
    faces.push({ pts, normal: [n[0] / l, n[1] / l, n[2] / l] });
  }
  faces.push({ pts: hi.slice(), normal: [0, 1, 0] }); faces.push({ pts: lo.slice().reverse(), normal: [0, -1, 0] });
  return faces;
}

/** Everything a prop is made of, back to front is left to the caller: { faces: [{pts, normal, color}], balls: [{c, r, color}] }. */
export function propParts(q) {
  const shade = (c, k) => { const n = parseInt(c.slice(1), 16); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const faces = []; const balls = [];
  const add = (fs, color) => fs.forEach((f) => faces.push({ ...f, color }));
  switch (q.kind) {
    case 'box': add(prismFaces(q, 4), q.color); break;
    case 'cylinder': add(prismFaces(q, 20), q.color); break;
    case 'lamp': { const t = { ...q }; add(prismFaces(t, 10), q.color); balls.push({ c: place(q, 0, q.h + q.w * 1.4, 0), r: q.w * 1.8, color: '#f4e7a8' }); break; }
    case 'ball': balls.push({ c: place(q, 0, q.h / 2, 0), r: q.w / 2, ry: q.h / 2, color: q.color }); break;
    case 'tree': { const trunkH = q.h * 0.45; add(prismFaces({ ...q }, 10, 1, 0, trunkH, q.w, q.d), '#7a5a3a'); balls.push({ c: place(q, 0, trunkH + q.h * 0.28, 0), r: q.h * 0.3, color: q.color }); break; }
    default: add(prismFaces(q, 4), q.color);
  }
  return { faces, balls, shade };
}
/** How lit a face is: the top brightest, one side lighter than the other. */
export const faceLight = (normal) => 0.55 + 0.45 * Math.max(0, normal[0] * -0.35 + normal[1] * 0.8 + normal[2] * 0.4);
