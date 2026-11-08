// Draws the 3D rig with an orbit camera. One function serves the stage, the contact sheet and every export.
// World: x forward, y up, z the figure's right. Camera: yaw orbits about the vertical through the figure, pitch lifts it above (positive) or below.
// Yaw 0 and pitch 0 is the side view, with the figure's right side toward you.
import { cycleFrames, keyPhases } from './rig.js';
import { pose3, footCorners, add, mul, apply } from './rig3.js';
import { paramsAt, motionAt } from './automation.js';
import { drawSampled } from './sampler.js';
import { hull, circlePts } from './geom.js';
import { poseDog } from './dog3.js';
import { speciesOf } from './dogdefaults.js';
import { buildDogShapes, dogSticks, dogPivot, DOG_ARCS, dogPrints } from './dogdraw.js';
import { arcPoint, samplePaths, arcColor, arcOffsetX } from './arcs.js';
import { stripSims } from './physics.js';
import { placeItems, paintItem, itemHandles, paintHandles, imageInfo } from './attach.js';

export const STYLE_DEFAULTS = Object.freeze({
  style: 'mannequin',        // mannequin | stick | silhouette
  lineWidth: 3,
  lineColor: '#26231f',
  fillColor: '#f6f1e7',
  fillOpacity: 0.55,
  farTint: '#8fa3bf',        // the figure's left side is tinted, so the two sides read apart from any angle
  farOpacity: 0.85,
  figureHeight: 0.62,
  groundHeight: 0.80,
  offsetX: 0,
  background: '#ffffff',
  transparent: false,
  camYaw: 0,                 // degrees; 0 is the side view
  camPitch: 0,               // degrees above the ground
  autoOrbit: false,
  orbitSpeed: 24,            // degrees per second while playing
  showGround: true,
  showFootprints: true,
  showArcs: false,
  arcs: ['head', 'hip', 'wrist.R', 'ankle.R'],
  arcsDog: ['head', 'hip', 'paw.FR', 'paw.HR', 'tail'],
  arcDots: true,
  showLabels: true,
  showGizmo: true,
  showOnion: false,
  onionBefore: 2,
  onionAfter: 2,
  onionOpacity: 0.35,
  onionBeforeTint: '#d0342c',
  onionAfterTint: '#1f7a3d',
  guideColor: '#e0662e',
  selectColor: '#e0662e',
});

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

/** Camera and canvas mapping. target is the world point kept at the centre of the figure. */
export function makeCam(st, w, h, target, yawOffset = 0, zoomMul = 1) {
  const yaw = rad(st.camYaw + yawOffset);
  const pitch = rad(st.camPitch);
  const scale = ((h * st.figureHeight) / 2.1) * zoomMul;
  const cx = w / 2 + st.offsetX * w;
  const cy = h * st.groundHeight - target[1] * scale;
  const cyw = Math.cos(yaw); const syw = Math.sin(yaw); const cp = Math.cos(pitch); const sp = Math.sin(pitch);
  return {
    scale, cx, cy, w, h, k: h / 1080, lw: st.lineWidth * (h / 1080), yaw, pitch, target,
    /** world point -> { x, y, d } with d the depth toward the camera. */
    p(pt) {
      const x = pt[0] - target[0]; const y = pt[1] - target[1]; const z = pt[2] - target[2];
      const x1 = cyw * x + syw * z; const z1 = -syw * x + cyw * z;
      const y2 = y * cp - z1 * sp; const z2 = y * sp + z1 * cp;
      return { x: cx + x1 * scale, y: cy - y2 * scale, d: z2 };
    },
  };
}

/** Builds every body shape for a pose as screen polygons with a depth, a part and a side. */
function buildShapes(pz, cam) {
  const shapes = [];
  const S = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]);
  const sc = cam.scale;
  const capsule = (a, b, ra, rb, part, side, role) => {
    const A = S(a); const B = S(b);
    shapes.push({ pts: hull([...circlePts(A, ra * sc), ...circlePts(B, rb * sc)]), depth: (A.d + B.d) / 2, part, side, role });
  };
  const section = (C, M, rf, rl, n = 12) => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    return S(add(C, apply(M, [rf * Math.cos(t), 0, rl * Math.sin(t)])));
  });
  const tube = (C0, C1, M0, M1, r0, r1, part) => {
    const a = section(C0, M0, r0[0], r0[1]); const b = section(C1, M1, r1[0], r1[1]);
    shapes.push({ pts: hull([...a, ...b].map((q) => [q.x, q.y])), depth: (S(C0).d + S(C1).d) / 2, part, side: null, role: 'body' });
  };
  const hw = pz.hw;

  const pelvisLow = add(pz.pelvis, apply(pz.Rp, [0, -0.06, 0]));
  tube(pelvisLow, pz.base0, pz.Rp, pz.Rp, [0.085, hw + 0.055], [0.08, hw + 0.04], 'pelvis');
  tube(pz.base0, pz.j1, pz.R1, pz.R1, [0.085, 0.135], [0.095, 0.15], 'spine.lower');
  tube(pz.j1, pz.j2, pz.R2, pz.R2, [0.095, 0.15], [0.1, 0.165], 'spine.mid');
  tube(pz.j2, pz.j3, pz.R3, pz.R3, [0.1, 0.17], [0.075, 0.165], 'spine.upper');
  capsule(pz.neckBase, pz.neckTop, 0.04, 0.034, 'neck', null, 'body');

  // Head: an ellipsoid sampled on three great circles.
  const hr = pz.headR;
  const headPts = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * TAU;
    for (const q of [[Math.cos(t) * 0.95, Math.sin(t) * 1.08, 0], [Math.cos(t) * 0.95, 0, Math.sin(t) * 0.85], [0, Math.cos(t) * 1.08, Math.sin(t) * 0.85]]) {
      const P = S(add(pz.headC, apply(pz.Rh, mul(q, hr))));
      headPts.push([P.x, P.y]);
    }
  }
  const hc = S(pz.headC);
  shapes.push({ pts: hull(headPts), depth: hc.d, part: 'head', side: null, role: 'body' });
  // Facing marks: a nose and eyes, drawn only when turned toward the camera.
  const nose = S(add(pz.headC, apply(pz.Rh, [hr * 1.12, -hr * 0.05, 0])));
  const noseBase = S(add(pz.headC, apply(pz.Rh, [hr * 0.9, -hr * 0.05, 0])));
  const eyes = [1, -1].map((s) => S(add(pz.headC, apply(pz.Rh, [hr * 0.82, hr * 0.12, s * hr * 0.42]))));
  const front = (p) => p.d > hc.d - 0.0001;
  const face = { nose: front(nose) ? nose : null, noseBase, eyes: eyes.filter(front), c: hc };

  for (const side of ['R', 'L']) {
    const sd = pz.sides[side];
    const role = side === 'R' ? 'near' : 'far';
    capsule(sd.hip, sd.knee, 0.088, 0.062, 'leg', side, role);
    capsule(sd.knee, sd.ankle, 0.058, 0.038, 'leg', side, role);
    const fc = footCorners(pz, side).map(S);
    shapes.push({ pts: hull(fc.map((q) => [q.x, q.y])), depth: S(sd.ankle).d, part: 'foot', side, role });
    capsule(sd.shoulder, sd.elbow, 0.05, 0.038, 'arm', side, role);
    capsule(sd.elbow, sd.wrist, 0.036, 0.028, 'forearm', side, role);
    const hc2 = add(sd.wrist, mul([sd.hand[0] - sd.wrist[0], sd.hand[1] - sd.wrist[1], sd.hand[2] - sd.wrist[2]], 0.6));
    const H = S(hc2);
    shapes.push({ pts: circlePts(H, 0.045 * sc, 14), depth: H.d, part: 'hand', side, role });
    const SH = S(sd.shoulder);
    shapes.push({ pts: circlePts(SH, 0.052 * sc, 14), depth: SH.d + 0.0005, part: 'girdle', side, role });
  }
  shapes.sort((a, b) => a.depth - b.depth);
  return { shapes, face };
}

/** The pivot point (screen) of a part, for the selection marker. */
function pivotOf(pz, cam, part, side) {
  if (pz.legs) { const pt = dogPivot(pz, part, side); return pt ? cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]) : null; }
  const sd = side ? pz.sides[side] : null;
  const map = {
    pelvis: pz.pelvis, 'spine.lower': pz.base0, 'spine.mid': pz.j1, 'spine.upper': pz.j2, neck: pz.neckBase, head: pz.neckTop,
    girdle: sd?.shoulder, arm: sd?.shoulder, forearm: sd?.elbow, hand: sd?.wrist, leg: sd?.hip, foot: sd?.ankle,
  };
  const pt = map[part];
  return pt ? cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]) : null;
}

function paintShape(ctx, sh, cam, st, ghost) {
  if (sh.pts.length < 3) return;
  const far = sh.role === 'far';
  ctx.beginPath();
  sh.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  if (st.style === 'silhouette' && !ghost) { ctx.fillStyle = st.lineColor; ctx.fill(); return; }
  if (st.style === 'mannequin') {
    ctx.fillStyle = ghost ? hexA(ghost, 0.1) : far ? hexA(st.farTint, st.farOpacity * 0.55) : hexA(st.fillColor, st.fillOpacity);
    ctx.fill();
  }
  ctx.strokeStyle = ghost || (far ? st.farTint : st.lineColor);
  ctx.lineWidth = cam.lw;
  ctx.stroke();
}

/** Draws the attachments of a figure that is drawn as lines: behind ones first, then in front. Returns the placed items. */
function paintAttachLines(ctx, pz, cam, opts, parts) {
  if (!opts.attach?.length || opts.tint) return [];
  const placed = placeItems(opts.attach, pz, cam).filter(({ f }) => (f.role === 'far' ? parts.far : f.role === 'near' ? parts.near : parts.body));
  for (const kind of ['behind', 'front']) for (const { it, f } of placed) if (it.depth === kind) paintItem(ctx, it, f, cam);
  return placed;
}

function drawFigureShapes(ctx, pz, cam, st, opts = {}) {
  const parts = opts.parts || { far: true, body: true, near: true };
  const ghost = opts.tint || null;
  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const W = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]);
  if (st.style === 'stick' && pz.legs) {
    for (const [pts, far] of dogSticks(pz)) {
      if ((far && !parts.far) || (!far && !parts.near && !parts.body)) continue;
      ctx.strokeStyle = ghost || (far ? st.farTint : st.lineColor); ctx.lineWidth = cam.lw * 1.2;
      ctx.beginPath(); pts.map((q) => cam.p([q[0] + pz.pelvisX, q[1], q[2]])).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    }
    const placedDogLines = paintAttachLines(ctx, pz, cam, opts, parts);
    ctx.restore();
    return { shapes: [], placed: placedDogLines };
  }
  if (st.style === 'stick') {
    const line = (pts, color) => {
      ctx.strokeStyle = color; ctx.lineWidth = cam.lw * 1.2;
      ctx.beginPath(); pts.map(W).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.stroke();
    };
    const col = (far) => ghost || (far ? st.farTint : st.lineColor);
    for (const side of ['L', 'R']) {
      const far = side === 'L';
      if ((far && !parts.far) || (!far && !parts.near)) continue;
      const sd = pz.sides[side];
      const f = footCorners(pz, side);
      line([sd.hip, sd.knee, sd.ankle], col(far));
      line([f[0], f[4]], col(far));
      line([sd.shoulder, sd.elbow, sd.wrist, sd.hand], col(far));
    }
    if (parts.body) {
      line([pz.pelvis, pz.base0, pz.j1, pz.j2, pz.j3, pz.neckBase, pz.neckTop], ghost || st.lineColor);
      const hc = W(pz.headC);
      ctx.strokeStyle = ghost || st.lineColor; ctx.lineWidth = cam.lw * 1.2;
      ctx.beginPath(); ctx.arc(hc.x, hc.y, pz.headR * cam.scale, 0, TAU); ctx.stroke();
    }
    const placedLines = paintAttachLines(ctx, pz, cam, opts, parts);
    ctx.restore();
    return { shapes: [], placed: placedLines };
  }
  const built = pz.legs ? buildDogShapes(pz, cam) : buildShapes(pz, cam);
  const { face } = built; let shapes = built.shapes;
  // Attachments take their part's depth, a hair in front of it or behind it, so they sort with the body and with each other.
  const placed = opts.attach?.length && !ghost ? placeItems(opts.attach, pz, cam) : [];
  if (placed.length) shapes = [...shapes, ...placed.map(({ it, f }) => ({ attach: it, frame: f, depth: f.depth + (it.depth === 'behind' ? -0.0006 : 0.0006), part: null, side: it.side, role: f.role, pts: [] }))].sort((a, b) => a.depth - b.depth);
  for (const sh of shapes) {
    if ((sh.role === 'far' && !parts.far) || (sh.role === 'near' && !parts.near) || (sh.role === 'body' && !parts.body)) continue;
    if (sh.attach) { paintItem(ctx, sh.attach, sh.frame, cam); continue; }
    paintShape(ctx, sh, cam, st, ghost);
    if ((sh.part === 'head' || sh.part === 'dog.head') && st.style === 'mannequin' && !ghost) {
      ctx.strokeStyle = st.lineColor; ctx.fillStyle = st.lineColor; ctx.lineWidth = cam.lw * 0.9;
      for (const e of face.eyes) { ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1.5, cam.lw * 0.9), 0, TAU); ctx.fill(); }
      if (face.dot) { ctx.beginPath(); ctx.arc(face.dot.x, face.dot.y, Math.max(2, cam.lw * 1.4), 0, TAU); ctx.fill(); }
      if (face.nose) { ctx.beginPath(); ctx.moveTo(face.noseBase.x, face.noseBase.y); ctx.lineTo(face.nose.x, face.nose.y); ctx.stroke(); }
    }
  }
  ctx.restore();
  return { shapes, placed };
}

/** Which part is under a canvas point, front to back. Returns { part, side } or null. */
export function pickPart(shapes, x, y) {
  const inside = (poly) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]; const [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  for (let i = shapes.length - 1; i >= 0; i--) if (inside(shapes[i].pts)) return { part: shapes[i].part, side: shapes[i].side };
  return null;
}

/** The cycle phase shown by timeline frame `frame`. */
export function phaseFor(params, frame) {
  const { frames, drawings } = cycleFrames(params);
  const f = frames[((frame % frames.length) + frames.length) % frames.length];
  return { u: f.u, drawing: f.drawing, drawings, step: 1 / drawings, frames: frames.length };
}

/** The key pose this phase falls on, if any. */
export function keyAt(params, u, step) {
  for (const k of keyPhases(params)) {
    for (const off of [0, 0.5]) {
      const target = (k.u + off) % 1;
      const d = Math.abs(((u - target + 1.5) % 1) - 0.5);
      if (d <= step * 0.5 + 1e-9) return { name: k.name, side: off ? 'far' : 'near' };
    }
  }
  return null;
}

const ARC = {
  head: (z) => z.headC, hip: (z) => z.pelvis, wrist: (z) => z.sides.R.wrist, ankle: (z) => z.sides.R.ankle,
};

/**
 * Draws a whole frame on ctx (canvas w by h). opts: layers { guides, figure }, parts, transparent, onion, yawOffset, selection.
 * Returns { key, drawing, drawings, u, shapes, cam, pz } so callers can pick parts and label frames.
 */
export function drawScene(ctx, params, st, w, h, frame, opts = {}) {
  if (params.sampled?.active) {
    const info = drawSampled(ctx, st, w, h, frame, opts);
    return { ...info, cam: null, pz: null };
  }
  // A performance evaluates the gait, the channel settings and the position at its own frame; a plain cycle uses one set of values.
  const dog = params.rig === 'dog';
  const poser = dog ? poseDog : pose3;
  const perf = params.perf || null;
  const ex = Math.max(1, params.exposure ?? 1);
  const t0 = perf ? Math.min(perf.T - 1, Math.floor(frame / ex) * ex) : 0;
  const valuesAt = (t) => perf ? { p: paramsAt(params, perf.lanes, t, perf.live), m: motionAt(params.motion || {}, perf.lanes, t, perf.live) } : { p: params, m: params.motion || {} };
  const poseAt = (t) => { const v = valuesAt(t); return poser(v.p, v.m, perf ? perf.u[t] : phaseFor(params, frame).u, perf ? { worldX: perf.x[t], freeU: t / Math.max(2, Math.round(params.cycleFrames)) } : null); };
  const ph = perf ? { u: perf.u[t0], drawing: Math.floor(t0 / ex) + 1, drawings: Math.ceil(perf.T / ex), step: ex / params.cycleFrames } : phaseFor(params, frame);
  const motion = perf ? valuesAt(t0).m : (params.motion || {});
  const pz = poseAt(t0);
  const sp = perf ? valuesAt(t0).p : params;
  const step = dog ? sp.dogStride / 2 : sp.stepLength;
  const target = [perf ? (params.travel === 'across' ? (perf.x[0] + perf.x[perf.T]) / 2 : pz.pelvisX + (dog ? 0.45 : 0)) : (params.travel === 'across' ? step : pz.pelvisX + (dog ? 0.45 : 0)), dog ? speciesOf(params).view.y : 0.9, 0];
  const cam = makeCam(st, w, h, target, opts.yawOffset || 0, dog ? speciesOf(params).view.zoom : 1);
  const transparent = opts.transparent ?? st.transparent;
  const layers = opts.layers || { guides: true, figure: true };
  // Swinging strips are simulated over the whole cycle ahead of time; this frame's shape is passed on with the item.
  const sims = stripSims(params, params.attach);
  let attachNow = params.attach;
  if (sims.size) {
    const fi = perf ? t0 : cycleFrames(params).frames.reduce((best, f, i, a) => (Math.abs(f.u - ph.u) < Math.abs(a[best].u - ph.u) ? i : best), 0);
    attachNow = params.attach.map((it) => { const s = sims.get(it.id)?.frames[fi]; return s ? { ...it, sim: { rootW: [s.root[0] + pz.pelvisX, s.root[1], s.root[2]], nodes: s.nodes } } : it; });
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  if (!transparent) { ctx.fillStyle = st.background; ctx.fillRect(0, 0, w, h); }
  // A picture to line the figure up with goes under everything else: the stage passes it in, and an export can too.
  opts.under?.(ctx, w, h, cam);

  const arcDots = [];
  if (layers.guides) {
    const line = (a, b) => { const A = cam.p(a); const B = cam.p(b); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); };
    if (st.showGround) {
      const x0 = target[0] - 5; const x1 = target[0] + 5;
      ctx.strokeStyle = hexA(st.guideColor, 0.75); ctx.lineWidth = cam.lw * 0.8;
      ctx.beginPath(); line([x0, 0, 0], [x1, 0, 0]); ctx.stroke();
      ctx.strokeStyle = hexA(st.guideColor, 0.28);
      ctx.beginPath();
      for (const z of [-0.6, -0.3, 0.3, 0.6]) line([x0, 0, z], [x1, 0, z]);
      const half = step / 2;
      const first = Math.floor(x0 / half) * half;
      for (let x = first; x < x1; x += half) line([x, 0, -0.6], [x, 0, 0.6]);
      ctx.stroke();
      ctx.strokeStyle = hexA(st.guideColor, 0.75);
      ctx.beginPath();
      for (let x = first; x < x1; x += half) { const A = cam.p([x, 0, 0]); ctx.moveTo(A.x, A.y); ctx.lineTo(A.x, A.y + 11 * cam.k); }
      ctx.stroke();
    }
    if (st.showFootprints && dog) {
      ctx.fillStyle = hexA(st.guideColor, 0.38);
      for (const pl of perf ? perf.plants : dogPrints(params, target[0] - 4, target[0] + 4)) {
        if (Math.abs(pl.x - target[0]) > 4) continue;
        const q = [[pl.x - 0.05, pl.z - 0.035], [pl.x + 0.12, pl.z - 0.035], [pl.x + 0.12, pl.z + 0.035], [pl.x - 0.05, pl.z + 0.035]].map(([x, zz]) => cam.p([x, 0, zz]));
        ctx.beginPath(); q.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y))); ctx.closePath(); ctx.fill();
      }
    } else if (st.showFootprints && perf) {
      ctx.fillStyle = hexA(st.guideColor, 0.38);
      const z0 = params.stepWidth ?? 0.075;
      for (const pl of perf.plants) {
        if (Math.abs(pl.x - target[0]) > 4) continue;
        const z = pl.side === 'R' ? z0 : -z0;
        const q = [[pl.x - 0.07, z - 0.045], [pl.x + 0.26, z - 0.045], [pl.x + 0.26, z + 0.045], [pl.x - 0.07, z + 0.045]].map(([x, zz]) => cam.p([x, 0, zz]));
        ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
      }
    } else if (st.showFootprints) {
      // Where each foot plants. They stay fixed on the ground while the body passes over them.
      const d = step * params.duty;
      ctx.fillStyle = hexA(st.guideColor, 0.38);
      const c0 = Math.floor((target[0] - 4) / (2 * step)); const c1 = Math.ceil((target[0] + 4) / (2 * step));
      for (let c = c0; c <= c1; c++) {
        for (const [phase, zs] of [[0, 1], [0.5, -1]]) {
          const ax = (c + phase) * 2 * step + d;
          const z = zs * (params.stepWidth ?? 0.075);
          const q = [[ax - 0.07, z - 0.045], [ax + 0.26, z - 0.045], [ax + 0.26, z + 0.045], [ax - 0.07, z + 0.045]].map(([x, zz]) => cam.p([x, 0, zz]));
          ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
        }
      }
    }
    if (st.showArcs) {
      // Where the tip and the middle of each swinging strip go: a guide for the loose things on the body.
      for (const it of params.attach || []) {
        const sim = sims.get(it.id); if (!sim) continue;
        for (const [which, alpha] of [['tip', 0.95], ['mid', 0.5]]) {
          const pts = sim.frames.map((s) => { const nd = s.nodes[which === 'tip' ? s.nodes.length - 1 : Math.floor(s.nodes.length / 2)]; return cam.p([s.root[0] + nd[0] + arcOffsetX(params, { pelvisX: s.pelvisX }, pz), s.root[1] + nd[1], s.root[2]]); });
          ctx.setLineDash([8 * cam.k, 6 * cam.k]); ctx.lineWidth = cam.lw * (which === 'tip' ? 0.9 : 0.6); ctx.strokeStyle = hexA(it.fill, alpha);
          ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); if (!perf && pts.length > 2) ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
          if (which === 'tip' && st.arcDots) for (const q of pts) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(q.x, q.y, 2.6 * cam.k, 0, TAU); ctx.fill(); ctx.stroke(); }
        }
      }
      // One path per ticked point, a dot on every frame (the spacing shows the speed), the current frame larger.
      const defs = (dog ? st.arcsDog : st.arcs).map((id) => arcPoint(dog ? 'dog' : 'human', id)).filter(Boolean);
      const paths = samplePaths(params, defs, pz);
      const curFrame = perf ? Math.min(perf.T - 1, Math.max(0, t0)) : cycleFrames(params).frames.reduce((best, f, i, a) => (Math.abs(f.u - ph.u) < Math.abs(a[best].u - ph.u) ? i : best), 0);
      for (const d of defs) {
        const col = arcColor(dog ? 'dog' : 'human', d.id); const pts = paths.get(d.id).map((s) => ({ frame: s.frame, ...cam.p(s.p) }));
        ctx.setLineDash([8 * cam.k, 6 * cam.k]); ctx.lineWidth = cam.lw * 0.9; ctx.strokeStyle = hexA(col, 0.85);
        ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        if (!perf && pts.length > 2) ctx.closePath();
        ctx.stroke(); ctx.setLineDash([]);
        if (st.arcDots) {
          for (const q of pts) {
            const now = q.frame === curFrame;
            ctx.fillStyle = now ? col : '#fff'; ctx.strokeStyle = col; ctx.lineWidth = cam.lw * (now ? 1.4 : 1);
            ctx.beginPath(); ctx.arc(q.x, q.y, (now ? 5.5 : 3.2) * cam.k, 0, TAU); ctx.fill(); ctx.stroke();
            arcDots.push({ id: d.id, frame: q.frame, x: q.x, y: q.y });
          }
        }
      }
    }
  }

  let shapes = []; let placedAttach = []; let handles = null;
  if (layers.figure) {
    if (st.showOnion && opts.onion !== false) {
      const ghostStyle = { ...st, style: st.style === 'silhouette' ? 'stick' : st.style };
      const ghost = (k) => (perf ? poseAt(Math.min(perf.T - 1, Math.max(0, t0 + k * ex))) : poser(params, motion, ph.u + k * ph.step));
      for (let k = st.onionBefore; k >= 1; k--) drawFigureShapes(ctx, ghost(-k), cam, ghostStyle, { tint: st.onionBeforeTint, alpha: st.onionOpacity * Math.pow(0.7, k - 1) });
      for (let k = st.onionAfter; k >= 1; k--) drawFigureShapes(ctx, ghost(k), cam, ghostStyle, { tint: st.onionAfterTint, alpha: st.onionOpacity * Math.pow(0.7, k - 1) });
    }
    const fig = drawFigureShapes(ctx, pz, cam, st, { parts: opts.parts, attach: attachNow });
    shapes = fig.shapes; placedAttach = fig.placed || [];
    const sel = opts.selection;
    if (sel && st.style !== 'stick') {
      ctx.save();
      ctx.strokeStyle = st.selectColor; ctx.lineWidth = cam.lw * 2.2; ctx.lineJoin = 'round';
      ctx.fillStyle = hexA(st.selectColor, 0.18);
      for (const sh of shapes) {
        if (sh.part !== sel.part || (sel.side && sh.side !== sel.side)) continue;
        ctx.beginPath(); sh.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
    // The selected attachment: its box, its anchor on the part's edge, and the handles to move, turn and size it.
    if (opts.handles) {
      const hit = placedAttach.find((p) => p.it.id === opts.handles);
      if (hit) { const hs = itemHandles(hit.it, hit.f, cam, hit.it.kind === 'image' ? imageInfo(hit.it.img)?.aspect : null); paintHandles(ctx, hs, cam, st.selectColor); handles = { id: hit.it.id, ...hs }; }
    }
    if (sel) {
      const pv = pivotOf(pz, cam, sel.part, sel.side);
      if (pv) {
        ctx.save();
        ctx.strokeStyle = st.selectColor; ctx.fillStyle = '#fff'; ctx.lineWidth = cam.lw * 1.6;
        const r = 9 * cam.k;
        ctx.beginPath(); ctx.arc(pv.x, pv.y, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pv.x - r * 1.8, pv.y); ctx.lineTo(pv.x + r * 1.8, pv.y); ctx.moveTo(pv.x, pv.y - r * 1.8); ctx.lineTo(pv.x, pv.y + r * 1.8); ctx.stroke();
        ctx.restore();
      }
    }
  }
  ctx.restore();

  const key = dog ? null : keyAt(params, ph.u, ph.step);
  if (layers.guides && st.showLabels && key) {
    ctx.save();
    ctx.font = `600 ${Math.round(24 * cam.k)}px system-ui, sans-serif`;
    ctx.fillStyle = hexA(st.guideColor, 0.95);
    // Top right: the camera bar floats at the top left of the stage, so the label stays clear of it on a small stage.
    ctx.textAlign = 'right';
    ctx.fillText(`${key.name} (${key.side})`, w - 28 * cam.k, 48 * cam.k);
    ctx.restore();
  }
  if (layers.guides && st.showGizmo) {
    // Orientation gizmo: x (forward) red, y (up) green, z (the figure's right) blue.
    const o = { x: w - 70 * cam.k, y: h - 70 * cam.k };
    const base = cam.p(target);
    ctx.save();
    ctx.lineWidth = 2.5 * cam.k; ctx.font = `${Math.round(14 * cam.k)}px system-ui`;
    for (const [n, v, col] of [['x', [1, 0, 0], '#d0342c'], ['y', [0, 1, 0], '#2f9a4a'], ['z', [0, 0, 1], '#2f6fd0']]) {
      const q = cam.p([target[0] + v[0], target[1] + v[1], target[2] + v[2]]);
      const dx = (q.x - base.x) / cam.scale; const dy = (q.y - base.y) / cam.scale;
      ctx.strokeStyle = col; ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(o.x, o.y); ctx.lineTo(o.x + dx * 34 * cam.k, o.y + dy * 34 * cam.k); ctx.stroke();
      ctx.fillText(n, o.x + dx * 42 * cam.k - 4 * cam.k, o.y + dy * 42 * cam.k + 5 * cam.k);
    }
    ctx.restore();
  }
  return { key, drawing: ph.drawing, drawings: ph.drawings, u: ph.u, shapes, cam, pz, attach: placedAttach, handles, arcDots };
}
