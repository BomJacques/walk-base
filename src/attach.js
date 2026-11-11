// Attachments: shapes and pictures fixed to a body part, so they take on that part's movement.
// Each part supplies a frame: its bone (a start and an end joint) projected onto the screen. An attachment lives in that frame, in the figure's
// own units, so it follows every channel, curve and automation on the part, and stays put when the camera orbits.
// An anchor is where it is fixed: a point that slides around the edge of the part (a capsule around the bone), or a free point.
// Pure logic plus canvas painting; no DOM.
import { add, mul, sub, len, hoseLimbs } from './rig3.js';
import { STRIP_DEFAULTS } from './stripdefs.js';
import { newShadow, cleanShadow, castShadow } from './shadow.js';

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------------------------------------------------------
// Which parts can carry an attachment, and the bone each one gives
// ---------------------------------------------------------------------------------------------------------------
/** Two-piece limbs have a segment 0 (upper) and 1 (lower); other parts have none. */
const HUMAN = [
  ['pelvis', 'Hips'], ['spine.lower', 'Lower spine'], ['spine.mid', 'Mid spine'], ['spine.upper', 'Chest'], ['neck', 'Neck'], ['head', 'Head'],
  ['arm', 'Upper arm', true], ['forearm', 'Forearm', true], ['hand', 'Hand', true], ['leg', 'Thigh', true, 0], ['leg', 'Shin', true, 1], ['foot', 'Foot', true],
];
const DOG = [
  ['dog.spine1', 'Hips and lower back'], ['dog.spine2', 'Mid back'], ['dog.spine3', 'Chest'], ['dog.neck', 'Neck'], ['dog.head', 'Head'], ['dog.jaw', 'Jaw'], ['dog.ear', 'Ear', true],
  ['dog.tail1', 'Tail base'], ['dog.tail2', 'Tail middle'], ['dog.tail3', 'Tail tip'],
  ['dog.fshoulder', 'Shoulder blade', true], ['dog.fleg', 'Front upper leg', true, 0], ['dog.fleg', 'Front lower leg', true, 1], ['dog.fpaw', 'Front paw', true],
  ['dog.hleg', 'Hind thigh', true, 0], ['dog.hleg', 'Hind shin', true, 1], ['dog.hpaw', 'Hind paw', true],
];
/** Every place an attachment can go, as { key, part, seg, side, label }. Sided parts appear once for each side. */
export function attachTargets(rig) {
  const out = [];
  for (const [part, label, sided, seg] of rig === 'dog' ? DOG : HUMAN) {
    for (const side of sided ? ['R', 'L'] : [null]) {
      out.push({ key: targetKey({ part, seg: seg ?? null, side }), part, seg: seg ?? null, side, label: side ? `${label}, ${side === 'R' ? 'right' : 'left'}` : label });
    }
  }
  return out;
}
export const targetKey = (it) => `${it.part}${it.seg != null ? `:${it.seg}` : ''}${it.side ? `/${it.side}` : ''}`;

/** The two joints (world points) a part's frame runs between, or null. */
export function partBone(pz, part, seg = null, side = null) {
  if (pz.legs) {
    const front = part.startsWith('dog.f'); const leg = side ? pz.legs[`${front ? 'F' : 'H'}${side}`] : null;
    switch (part) {
      case 'dog.pelvis': case 'dog.spine1': return [pz.pelvis, pz.j1];
      case 'dog.spine2': return [pz.j1, pz.j2];
      case 'dog.spine3': return [pz.j2, pz.j3];
      case 'dog.neck': return [pz.neckBase, pz.neckTop];
      case 'dog.head': return [pz.neckTop, pz.noseTip];
      case 'dog.jaw': return [pz.hinge, pz.jawEnd];
      case 'dog.ear': return side ? [pz.ears[side].root, pz.ears[side].tip] : null;
      case 'dog.tail1': return [pz.tail[0], pz.tail[1]];
      case 'dog.tail2': return [pz.tail[1], pz.tail[2]];
      case 'dog.tail3': return [pz.tail[2], pz.tail[3]];
      case 'dog.fshoulder': return leg?.top ? [leg.top, leg.root] : null;
      case 'dog.fleg': case 'dog.hleg': return leg ? (seg === 1 ? [leg.mid, leg.wrist] : [leg.root, leg.mid]) : null;
      case 'dog.fpaw': case 'dog.hpaw': return leg ? [leg.wrist, leg.toe] : null;
      default: return null;
    }
  }
  const sd0 = side ? pz.sides?.[side] : null;
  const sd = sd0 && pz.params?.model === 'hose' ? hoseLimbs(sd0, pz.params) : sd0; // the rubber hose figure's limbs stretch and trail, and a picture goes with them
  switch (part) {
    case 'pelvis': return [pz.pelvis, pz.base0];
    case 'spine.lower': return [pz.base0, pz.j1];
    case 'spine.mid': return [pz.j1, pz.j2];
    case 'spine.upper': return [pz.j2, pz.j3];
    case 'neck': return [pz.neckBase, pz.neckTop];
    case 'head': return [pz.neckTop, add(pz.neckTop, mul(sub(pz.headC, pz.neckTop), 2))];
    case 'arm': return sd ? [sd.shoulder, sd.elbow] : null;
    case 'forearm': return sd ? [sd.elbow, sd.wrist] : null;
    case 'hand': return sd ? [sd.wrist, sd.hand] : null;
    case 'leg': return sd ? (seg === 1 ? [sd.knee, sd.ankle] : [sd.hip, sd.knee]) : null;
    case 'foot': return sd ? [sd.ankle, add(sd.ankle, mul(sd.foot.fx, 0.16))] : null;
    default: return null;
  }
}

/** Half the thickness of a part, in the figure's units, for its edge. */
export function partRadius(pz, part, seg = null) {
  if (pz.legs) {
    const r = { 'dog.pelvis': 0.16, 'dog.spine1': 0.15, 'dog.spine2': 0.12, 'dog.spine3': 0.15, 'dog.neck': 0.08, 'dog.head': 0.1, 'dog.jaw': 0.04, 'dog.ear': 0.04, 'dog.tail1': 0.035, 'dog.tail2': 0.03, 'dog.tail3': 0.025,
      'dog.fshoulder': 0.07, 'dog.fleg': seg === 1 ? 0.05 : 0.07, 'dog.fpaw': 0.035, 'dog.hleg': seg === 1 ? 0.05 : 0.095, 'dog.hpaw': 0.035 };
    return r[part] ?? 0.05;
  }
  const r = { pelvis: 0.2, 'spine.lower': 0.15, 'spine.mid': 0.16, 'spine.upper': 0.17, neck: 0.04, head: pz.headR ?? 0.1, arm: 0.05, forearm: 0.036, hand: 0.045, leg: seg === 1 ? 0.058 : 0.088, foot: 0.045 };
  return r[part] ?? 0.05;
}

// ---------------------------------------------------------------------------------------------------------------
// The edge of a part: a capsule round its bone. Local coordinates: x along the bone from 0 to L, y across it.
// ---------------------------------------------------------------------------------------------------------------
export const edgeLength = (L, r) => 2 * L + TAU / 2 * 2 * r;
/** A point on the edge, t from 0 to 1 around it (0 is the top of the start end), with the outward direction. */
export function edgePoint(L, r, t) {
  const cap = Math.PI * r; const per = 2 * L + 2 * cap;
  let s = (((t % 1) + 1) % 1) * per;
  if (s < L) return { x: s, y: -r, nx: 0, ny: -1 };
  s -= L;
  if (s < cap) { const a = -Math.PI / 2 + (s / cap) * Math.PI; return { x: L + r * Math.cos(a), y: r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) }; }
  s -= cap;
  if (s < L) return { x: L - s, y: r, nx: 0, ny: 1 };
  s -= L;
  const a = Math.PI / 2 + (s / cap) * Math.PI;
  return { x: r * Math.cos(a), y: r * Math.sin(a), nx: Math.cos(a), ny: Math.sin(a) };
}
/** The t of the edge point nearest a local point. */
export function nearestEdgeT(L, r, x, y, n = 360) {
  let best = 0; let bd = Infinity;
  for (let i = 0; i < n; i++) { const p = edgePoint(L, r, i / n); const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < bd) { bd = d; best = i / n; } }
  return best;
}

// ---------------------------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------------------------
export const KINDS = [['ellipse', 'Ellipse'], ['rect', 'Rectangle'], ['triangle', 'Triangle'], ['line', 'Line'], ['strip', 'Cape or hair (swings)']];
let nextId = 1;
export const freshId = () => `a${Date.now().toString(36)}${(nextId++).toString(36)}`;

export function newItem(kind, target, over = {}) {
  return {
    id: freshId(), name: kind === 'image' ? 'Picture' : (KINDS.find((k) => k[0] === kind)?.[1] ?? 'Shape'), kind,
    part: target.part, seg: target.seg ?? null, side: target.side ?? null,
    anchor: { mode: 'boundary', t: 0.12, off: 0, x: 0, y: 0 }, x: 0, y: -0.04, rot: 0, scale: 1, w: 0.26, h: 0.18,
    fill: '#f2b84b', stroke: '#26231f', sw: 2, opacity: 0.92, depth: 'front', flip: false, bend: false, visible: true, img: null, shadow: newShadow(),
    ...(kind === 'strip' ? { w: 0.2, h: 0.55, fill: '#b23a48', depth: 'behind', phys: { ...STRIP_DEFAULTS } } : {}),
    ...over,
  };
}
export const cloneItem = (it) => ({ ...JSON.parse(JSON.stringify(it)), id: freshId(), name: `${it.name} copy` });

/** Where the anchor is, in the part's local coordinates. */
export function anchorLocal(it, L, r) {
  if (it.anchor.mode === 'free') return { x: it.anchor.x, y: it.anchor.y };
  const e = edgePoint(L, r, it.anchor.t);
  return { x: e.x + e.nx * it.anchor.off, y: e.y + e.ny * it.anchor.off };
}

/** The same item on the other side of the figure: the picture flips across the bone. */
export function mirroredItem(it, L, r) {
  const m = cloneItem(it);
  m.name = `${it.name} (other side)`;
  m.side = it.side === 'R' ? 'L' : it.side === 'L' ? 'R' : it.side;
  m.flip = !it.flip; m.y = -it.y; m.rot = -it.rot;
  if (it.anchor.mode === 'free') m.anchor = { ...it.anchor, y: -it.anchor.y };
  else { const e = edgePoint(L, r, it.anchor.t); m.anchor = { ...it.anchor, t: nearestEdgeT(L, r, e.x, -e.y) }; }
  return m;
}

// ---------------------------------------------------------------------------------------------------------------
// Frames: the part's bone on the screen
// ---------------------------------------------------------------------------------------------------------------
/** The screen frame of an item's part, or null if the part is not there (a side the figure does not have). */
export function itemFrame(pz, cam, it) {
  const bone = partBone(pz, it.part, it.seg, it.side);
  if (!bone) return null;
  const W = (p) => cam.p([p[0] + pz.pelvisX, p[1], p[2]]);
  const A = W(bone[0]); const B = W(bone[1]);
  const dx = B.x - A.x; const dy = B.y - A.y;
  const ang = Math.hypot(dx, dy) > 1e-6 * cam.scale ? Math.atan2(dy, dx) : 0;
  const frame = { ox: A.x, oy: A.y, cos: Math.cos(ang), sin: Math.sin(ang), scale: cam.scale, ang, L: Math.max(1e-4, len(sub(bone[1], bone[0]))), r: partRadius(pz, it.part, it.seg), depth: (A.d + B.d) / 2, role: it.side === 'L' ? 'far' : it.side === 'R' ? 'near' : 'body' };
  const next = it.bend && canBend(it) ? bendChain(pz, it) : null;
  if (next) { const C = W(next); frame.chain = { A, B, C, L1: frame.L, L2: Math.max(1e-4, len(sub(next, bone[1]))) }; }
  return frame;
}

/** A picture can bend over the joint at the end of its part: the upper leg over the knee, the upper arm over the elbow. */
export const canBend = (it) => it.kind === 'image' && !it.part?.startsWith('dog.') && ((it.part === 'leg' && (it.seg ?? 0) === 0) || it.part === 'arm');
function bendChain(pz, it) { const sd = it.side ? pz.sides?.[it.side] : null; return sd ? (it.part === 'leg' ? sd.ankle : sd.wrist) : null; }

/**
 * Where a point of a bending picture goes on the screen. s runs along the limb from the start of the part, n across it, both in the part's own units.
 * The limb is two straight bones; round the joint the path is a smooth curve, so a picture over the knee or elbow bends instead of folding.
 */
export function bendPoint(f, s, n) {
  const { A, B, C, L1, L2 } = f.chain; const k = f.scale;
  const d1 = unit2(B.x - A.x, B.y - A.y); const d2 = unit2(C.x - B.x, C.y - B.y);
  const P1 = { x: A.x + d1.x * L1 * k, y: A.y + d1.y * L1 * k }; const P2 = { x: P1.x + d2.x * L2 * k, y: P1.y + d2.y * L2 * k };
  const w = Math.min(L1, L2) * 0.4;
  let p; let t;
  if (s <= L1 - w) { p = { x: A.x + d1.x * s * k, y: A.y + d1.y * s * k }; t = d1; }
  else if (s >= L1 + w) { const q = s - L1; p = { x: P1.x + d2.x * q * k, y: P1.y + d2.y * q * k }; t = d2; }
  else { // a quadratic curve through the corner
    const u = (s - (L1 - w)) / (2 * w); const a = { x: P1.x - d1.x * w * k, y: P1.y - d1.y * w * k }; const c = { x: P1.x + d2.x * w * k, y: P1.y + d2.y * w * k };
    const m = 1 - u; p = { x: m * m * a.x + 2 * m * u * P1.x + u * u * c.x, y: m * m * a.y + 2 * m * u * P1.y + u * u * c.y };
    t = unit2(2 * m * (P1.x - a.x) + 2 * u * (c.x - P1.x), 2 * m * (P1.y - a.y) + 2 * u * (c.y - P1.y));
  }
  void P2;
  return { x: p.x - t.y * n * k, y: p.y + t.x * n * k };
}
const unit2 = (x, y) => { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };

/** Paints a picture bent along its limb: cut into thin slices across its long direction, each placed on the curve. */
function paintBent(ctx, it, f, inf) {
  const a = anchorLocal(it, f.L, f.r); const cx = a.x + it.x; const cy = a.y + it.y;
  const { w, h } = itemSize(it, inf.aspect); const sw = w * it.scale; const sh = h * it.scale; const rot = (it.rot * Math.PI) / 180;
  const cr = Math.cos(rot); const sr = Math.sin(rot); const fl = it.flip ? -1 : 1;
  const toPart = (u, v) => { const px = u * sw; const py = v * sh * fl; return { x: cx + cr * px - sr * py, y: cy + sr * px + cr * py }; };
  const warp = (u, v) => { const q = toPart(u, v); return bendPoint(f, q.x, q.y); };
  const alongX = Math.abs(cr) >= Math.abs(sr); const N = 28; const iw = inf.img.naturalWidth; const ih = inf.img.naturalHeight;
  for (let i = 0; i < N; i++) {
    const t0 = i / N; const t1 = (i + 1) / N;
    const [u0, u1, v0, v1] = alongX ? [t0 - 0.5, t1 - 0.5, -0.5, 0.5] : [-0.5, 0.5, t0 - 0.5, t1 - 0.5];
    const T0 = warp(u0, v0); const T1 = warp(u1, v0); const T3 = warp(u0, v1);
    const sx0 = (u0 + 0.5) * iw; const sy0 = (v0 + 0.5) * ih; const sw0 = (u1 - u0) * iw; const sh0 = (v1 - v0) * ih;
    if (sw0 <= 0 || sh0 <= 0) continue;
    const m11 = (T1.x - T0.x) / sw0; const m12 = (T1.y - T0.y) / sw0; const m21 = (T3.x - T0.x) / sh0; const m22 = (T3.y - T0.y) / sh0;
    ctx.save(); ctx.setTransform(...mulM(ctx.getTransform(), [m11, m12, m21, m22, T0.x - m11 * sx0 - m21 * sy0, T0.y - m12 * sx0 - m22 * sy0]));
    const ex = alongX ? Math.min(1, iw - sx0 - sw0) : 0; const ey = alongX ? 0 : Math.min(1, ih - sy0 - sh0); // a pixel more, so the slices overlap and leave no seam
    ctx.drawImage(inf.img, sx0, sy0, sw0 + ex, sh0 + ey, sx0, sy0, sw0 + ex, sh0 + ey); ctx.restore();
  }
}
/** The matrix m (a DOMMatrix, already on the canvas) followed by the plain matrix q [a, b, c, d, e, f], as the six numbers setTransform wants. */
function mulM(m, q) { return [m.a * q[0] + m.c * q[1], m.b * q[0] + m.d * q[1], m.a * q[2] + m.c * q[3], m.b * q[2] + m.d * q[3], m.a * q[4] + m.c * q[5] + m.e, m.b * q[4] + m.d * q[5] + m.f]; }
export const toScreen = (f, lx, ly) => ({ x: f.ox + (f.cos * lx - f.sin * ly) * f.scale, y: f.oy + (f.sin * lx + f.cos * ly) * f.scale });
export const toLocal = (f, x, y) => { const dx = (x - f.ox) / f.scale; const dy = (y - f.oy) / f.scale; return { x: f.cos * dx + f.sin * dy, y: -f.sin * dx + f.cos * dy }; };

/** Everything needed to paint, hit-test and handle one item: its centre, its turn, and its size in screen pixels. */
export function itemPlace(it, f, cam) {
  const a = anchorLocal(it, f.L, f.r);
  const cLocal = { x: a.x + it.x, y: a.y + it.y };
  const c = toScreen(f, cLocal.x, cLocal.y);
  const aS = toScreen(f, a.x, a.y);
  const ang = f.ang + rad(it.rot);
  const k = f.scale * it.scale; // screen pixels per local unit
  return { c, aS, ang, cos: Math.cos(ang), sin: Math.sin(ang), k, cLocal, aLocal: a };
}
/** A screen point in an item's own coordinates (centre at 0, unflipped), in units. */
export function toItem(pl, it, x, y) {
  const dx = (x - pl.c.x) / pl.k; const dy = (y - pl.c.y) / pl.k;
  const lx = pl.cos * dx + pl.sin * dy; const ly = -pl.sin * dx + pl.cos * dy;
  return { x: lx, y: it.flip ? -ly : ly };
}
export const fromItem = (pl, it, x, y) => { const ly = it.flip ? -y : y; return { x: pl.c.x + (pl.cos * x - pl.sin * ly) * pl.k, y: pl.c.y + (pl.sin * x + pl.cos * ly) * pl.k }; };

/** Size of an item in local units; a picture keeps its own shape. */
export function itemSize(it, imageAspect = null) {
  if (it.kind === 'image' && imageAspect) return { w: it.w, h: it.w * imageAspect };
  return { w: it.w, h: it.kind === 'line' ? 0 : it.h };
}

/** The points of a strip on the screen: pinned at its ring, hanging the way the simulation says (or straight down before there is one). */
export function stripScreen(it, f, cam) {
  const a = anchorLocal(it, f.L, f.r); const root = toScreen(f, a.x, a.y);
  const n0 = it.phys?.nodes ?? 8;
  const nodes = it.sim?.nodes || Array.from({ length: n0 }, (_, i) => [0, -(it.h * i) / (n0 - 1)]);
  const rw = it.sim?.rootW || [0, 0, 0]; const base = cam.p(rw);
  return nodes.map(([dx, dy]) => { const p = cam.p([rw[0] + dx, rw[1] + dy, rw[2]]); return { x: root.x + (p.x - base.x), y: root.y + (p.y - base.y) }; });
}
const stripEdges = (pts, it, f) => {
  const n = pts.length; const left = []; const right = [];
  pts.forEach((p, i) => {
    const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(n - 1, i + 1)]; const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const hw = (it.w / 2) * f.scale * (1 + ((it.phys?.taper ?? 0.6) - 1) * (i / (n - 1)));
    left.push({ x: p.x - ((b.y - a.y) / l) * hw, y: p.y + ((b.x - a.x) / l) * hw }); right.push({ x: p.x + ((b.y - a.y) / l) * hw, y: p.y - ((b.x - a.x) / l) * hw });
  });
  return { left, right };
};

/** True when a screen point is on the item. A little slack makes thin shapes and lines easy to hit. */
export function hitItem(it, f, cam, x, y, imageAspect = null, slackPx = 6) {
  if (it.kind === 'strip') {
    const pts = stripScreen(it, f, cam); const { left, right } = stripEdges(pts, it, f);
    for (let i = 0; i < pts.length - 1; i++) { // inside the ribbon between two nodes, or close to its middle line
      const q = [left[i], left[i + 1], right[i + 1], right[i]]; let inside = false;
      for (let a = 0, b = 3; a < 4; b = a++) if ((q[a].y > y) !== (q[b].y > y) && x < ((q[b].x - q[a].x) * (y - q[a].y)) / (q[b].y - q[a].y) + q[a].x) inside = !inside;
      if (inside) return true;
      const px = pts[i]; const py = pts[i + 1]; const dx = py.x - px.x; const dy = py.y - px.y; const t = Math.max(0, Math.min(1, ((x - px.x) * dx + (y - px.y) * dy) / (dx * dx + dy * dy || 1)));
      if (Math.hypot(px.x + dx * t - x, px.y + dy * t - y) <= slackPx) return true;
    }
    return false;
  }
  const pl = itemPlace(it, f, cam); const p = toItem(pl, it, x, y); const { w, h } = itemSize(it, imageAspect);
  const slack = slackPx / pl.k;
  if (it.kind === 'line') return Math.abs(p.x) <= w / 2 + slack && Math.abs(p.y) <= Math.max(slack, it.sw / 2 / pl.k * (cam.k ?? 1)) + slack;
  if (it.kind === 'ellipse') return (p.x / (w / 2 + slack)) ** 2 + (p.y / (h / 2 + slack)) ** 2 <= 1;
  if (it.kind === 'triangle') { const u = (p.y + h / 2) / Math.max(1e-6, h); return u >= -slack / h && u <= 1 + slack / h && Math.abs(p.x) <= (w / 2) * clamp(u, 0, 1) + slack; }
  return Math.abs(p.x) <= w / 2 + slack && Math.abs(p.y) <= h / 2 + slack;
}

/** The four handles of the selected item, in screen pixels. */
export function itemHandles(it, f, cam, imageAspect = null) {
  if (it.kind === 'strip') { // a ring to move it round the part, and a square at the tip to set its length
    const pts = stripScreen(it, f, cam); const a = pts[0]; const tip = pts[pts.length - 1];
    return { anchor: a, center: a, rotate: a, scale: tip, box: [], strip: pts, place: null };
  }
  const pl = itemPlace(it, f, cam); const { w, h } = itemSize(it, imageAspect);
  const rotateOut = (h / 2) + 28 / pl.k;
  return {
    anchor: pl.aS, center: pl.c,
    rotate: fromItem(pl, it, 0, -rotateOut), scale: fromItem(pl, it, w / 2, Math.max(h / 2, 0.01)),
    box: [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]].map(([x, y]) => fromItem(pl, it, x, y)),
    place: pl,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Painting
// ---------------------------------------------------------------------------------------------------------------
const IMAGES = new Map(); // id -> { img, aspect }
export const imageInfo = (id) => IMAGES.get(id) ?? null;
/** Remembers a picture by id. Resolves once it can be drawn. */
export function registerImage(id, dataUrl) {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(false); return; }
    const img = new Image();
    img.onload = () => { IMAGES.set(id, { img, aspect: img.naturalHeight / Math.max(1, img.naturalWidth), url: dataUrl }); resolve(true); };
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}
export const imageUrls = () => Object.fromEntries([...IMAGES.entries()].map(([id, v]) => [id, v.url]));

const hexA = (hex, a) => { const n = parseInt(String(hex).slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

/** Paints an item. `ghost` is a tint for onion skin ghosts. */
export function paintItem(ctx, it, f, cam, ghost = null) {
  if (it.shadow?.on && !ghost) { castShadow(ctx, it.shadow, cam.k ?? 1, (c) => paintItemBody(c, it, f, cam, ghost)); return; } // a drop shadow of its own
  paintItemBody(ctx, it, f, cam, ghost);
}
function paintItemBody(ctx, it, f, cam, ghost = null) {
  if (it.kind === 'strip') { paintStrip(ctx, it, f, cam, ghost); return; }
  const pl = itemPlace(it, f, cam);
  const inf = it.kind === 'image' ? imageInfo(it.img) : null;
  if (inf && f.chain) { ctx.save(); ctx.globalAlpha *= clamp(it.opacity, 0, 1); paintBent(ctx, it, f, inf); ctx.restore(); return; }
  const { w, h } = itemSize(it, inf?.aspect);
  ctx.save();
  ctx.translate(pl.c.x, pl.c.y); ctx.rotate(pl.ang); ctx.scale(pl.k, it.flip ? -pl.k : pl.k);
  ctx.globalAlpha *= clamp(it.opacity, 0, 1);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const px = (cam.k ?? 1) / pl.k; // one unit of line width, in local units
  if (it.kind === 'image') {
    if (inf) ctx.drawImage(inf.img, -w / 2, -h / 2, w, h);
    else { ctx.strokeStyle = '#999'; ctx.lineWidth = 2 * px; ctx.strokeRect(-w / 2, -h / 2, w, h); ctx.beginPath(); ctx.moveTo(-w / 2, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.moveTo(w / 2, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.stroke(); }
  } else {
    ctx.beginPath();
    if (it.kind === 'ellipse') ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU);
    else if (it.kind === 'triangle') { ctx.moveTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.lineTo(0, -h / 2); ctx.closePath(); }
    else if (it.kind === 'line') { ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); }
    else { const rr = Math.min(w, h) * 0.12; ctx.moveTo(-w / 2 + rr, -h / 2); ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, rr); ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, rr); ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, rr); ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, rr); ctx.closePath(); }
    if (it.kind !== 'line') { ctx.fillStyle = ghost ? hexA(ghost, 0.15) : it.fill; ctx.fill(); }
    if (it.sw > 0 || it.kind === 'line') { ctx.strokeStyle = ghost || it.stroke; ctx.lineWidth = Math.max(it.sw, it.kind === 'line' ? 1 : 0) * px; ctx.stroke(); }
  }
  ctx.restore();
}

function paintStrip(ctx, it, f, cam, ghost) {
  const pts = stripScreen(it, f, cam); const { left, right } = stripEdges(pts, it, f);
  ctx.save(); ctx.globalAlpha *= clamp(it.opacity, 0, 1); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath(); left.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y); ctx.closePath();
  ctx.fillStyle = ghost ? hexA(ghost, 0.15) : it.fill; ctx.fill();
  if (it.sw > 0) { ctx.strokeStyle = ghost || it.stroke; ctx.lineWidth = it.sw * (cam.k ?? 1); ctx.stroke(); }
  ctx.restore();
}

/** The marks around the selected item: its box, the anchor, and the handles. */
export function paintHandles(ctx, hs, cam, color = '#e0662e') {
  const r = 8 * (cam.k ?? 1);
  if (hs.strip) {
    ctx.save(); ctx.lineWidth = 1.6 * (cam.k ?? 1); ctx.strokeStyle = color; ctx.fillStyle = '#fff'; ctx.setLineDash([6 * cam.k, 4 * cam.k]);
    ctx.beginPath(); hs.strip.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.arc(hs.anchor.x, hs.anchor.y, r * 1.1, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(hs.anchor.x - r * 1.9, hs.anchor.y); ctx.lineTo(hs.anchor.x + r * 1.9, hs.anchor.y); ctx.moveTo(hs.anchor.x, hs.anchor.y - r * 1.9); ctx.lineTo(hs.anchor.x, hs.anchor.y + r * 1.9); ctx.stroke();
    ctx.fillRect(hs.scale.x - r * 0.8, hs.scale.y - r * 0.8, r * 1.6, r * 1.6); ctx.strokeRect(hs.scale.x - r * 0.8, hs.scale.y - r * 0.8, r * 1.6, r * 1.6);
    ctx.restore(); return;
  }
  ctx.save();
  ctx.lineWidth = 1.6 * (cam.k ?? 1); ctx.strokeStyle = color; ctx.fillStyle = '#fff';
  ctx.setLineDash([6 * cam.k, 4 * cam.k]);
  ctx.beginPath(); hs.box.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hs.anchor.x, hs.anchor.y); ctx.lineTo(hs.center.x, hs.center.y); ctx.stroke();
  const top = hs.box[0]; const topR = hs.box[1]; ctx.beginPath(); ctx.moveTo((top.x + topR.x) / 2, (top.y + topR.y) / 2); ctx.lineTo(hs.rotate.x, hs.rotate.y); ctx.stroke();
  ctx.setLineDash([]);
  // anchor: a ring with a cross, the thing you drag around the part's edge
  ctx.beginPath(); ctx.arc(hs.anchor.x, hs.anchor.y, r * 1.1, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(hs.anchor.x - r * 1.9, hs.anchor.y); ctx.lineTo(hs.anchor.x + r * 1.9, hs.anchor.y); ctx.moveTo(hs.anchor.x, hs.anchor.y - r * 1.9); ctx.lineTo(hs.anchor.x, hs.anchor.y + r * 1.9); ctx.stroke();
  // centre (move), rotate, scale
  ctx.beginPath(); ctx.arc(hs.center.x, hs.center.y, r * 0.55, 0, TAU); ctx.fillStyle = color; ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(hs.rotate.x, hs.rotate.y, r * 0.9, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.fillRect(hs.scale.x - r * 0.8, hs.scale.y - r * 0.8, r * 1.6, r * 1.6); ctx.strokeRect(hs.scale.x - r * 0.8, hs.scale.y - r * 0.8, r * 1.6, r * 1.6);
  ctx.restore();
}

/** Which handle is under a screen point (within radius px), or null. The anchor wins when handles overlap, since it is the one you move to reattach. */
export function pickHandle(hs, x, y, radius = 22) {
  const order = ['anchor', 'rotate', 'scale', 'center'];
  let best = null; let bd = radius * radius;
  for (const k of order) { const d = (hs[k].x - x) ** 2 + (hs[k].y - y) ** 2; if (d < bd) { bd = d; best = k; } }
  return best;
}

/** Items of a figure with their frames, back to front, ready to be drawn with the body shapes. */
export function placeItems(items, pz, cam) {
  const out = [];
  for (const it of items || []) {
    if (!it.visible) continue;
    const f = itemFrame(pz, cam, it);
    if (f) out.push({ it, f });
  }
  return out;
}
