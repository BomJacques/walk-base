// Draws the 3D rig with an orbit camera. One function serves the stage, the contact sheet and every export.
// World: x forward, y up, z the figure's right. Camera: yaw orbits about the vertical through the figure, pitch lifts it above (positive) or below.
// Yaw 0 and pitch 0 is the side view, with the figure's right side toward you.
import { cycleFrames, keyPhases, sideGait, groundAt } from './rig.js';
import { pose3, footCorners, footShape, footMarks, add, mul, apply } from './rig3.js';
import { paramsAt, motionAt } from './automation.js';
import { drawSampled } from './sampler.js';
import { hull, circlePts } from './geom.js';
import { poseDog } from './dog3.js';
import { speciesOf } from './dogdefaults.js';
import { buildDogShapes, dogSticks, dogPivot, DOG_ARCS, dogPrints } from './dogdraw.js';
import { arcPoint, samplePaths, arcColor, arcOffsetX } from './arcs.js';
import { stripSims } from './physics.js';
import { paintMouth } from './mouth.js';
import { speechAt, VISEME_BY_ID } from './lipsync.js';
import { partBone } from './attach.js';
import { placeItems, paintItem, itemHandles, paintHandles, imageInfo } from './attach.js';
import { propParts, faceLight } from './scene.js';

export const STYLE_DEFAULTS = Object.freeze({
  style: 'mannequin',        // mannequin | outline | stick | silhouette
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
  arcs: ['head', 'hip', 'wrist.R', 'wrist.L', 'ankle.R', 'ankle.L'],
  arcsDog: ['head', 'hip', 'paw.FR', 'paw.FL', 'paw.HR', 'paw.HL', 'tail'],
  arcDots: true,
  showLabels: true,
  pictureModel: 'hide covered parts', // what the body does when pictures are attached
  showScene: true,           // the other figures and the scenery
  showFootLabels: false,
  showGizmo: true,
  showMouthLabel: true,
  focus: 'body',             // body | head: the camera looks at the whole figure or at the face
  headZoom: 4.6,               // how large the head is in the head view
  showOnion: false,
  onionBefore: 2,
  onionAfter: 2,
  onionOpacity: 0.35,
  onionBeforeTint: '#d0342c',
  onionAfterTint: '#1f7a3d',
  guideColor: '#e0662e',
  selectColor: '#e0662e',
  // the rubber hose figure
  hoseLimb: 1, hoseBend: 1, hoseSquash: 1, hoseEars: 'none', hoseEyes: 'pie',
  hoseBody: '#2d2a2e', hoseFace: '#fff8e8', hoseGlove: '#ffffff', hoseShoe: '#ffffff', hoseShorts: '#2d2a2e',
});

const TAU = Math.PI * 2;
const rad = (d) => (d * Math.PI) / 180;
const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; };

/** Camera and canvas mapping. target is the world point kept at the centre of the figure. */
export function makeCam(st, w, h, target, yawOffset = 0, zoomMul = 1, centered = false) {
  const yaw = rad(st.camYaw + yawOffset);
  const pitch = rad(st.camPitch);
  const scale = ((h * st.figureHeight) / 2.1) * zoomMul;
  const cx = w / 2 + st.offsetX * w;
  const cy = centered ? h * 0.5 : h * st.groundHeight - target[1] * scale; // the head view puts the target mid-stage
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
  const pr = pz.params?.proportions || {}; const gk = pr.limbGirth ?? 1; const tk = pr.torsoGirth ?? 1; // drawn thickness of the limbs and of the body
  const capsule = (a, b, ra, rb, part, side, role, k = 1) => {
    const A = S(a); const B = S(b);
    shapes.push({ pts: hull([...circlePts(A, ra * k * sc), ...circlePts(B, rb * k * sc)]), depth: (A.d + B.d) / 2, part, side, role });
  };
  const section = (C, M, rf, rl, n = 12) => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    return S(add(C, apply(M, [rf * Math.cos(t), 0, rl * Math.sin(t)])));
  });
  const tube = (C0, C1, M0, M1, r0, r1, part) => {
    const a = section(C0, M0, r0[0] * tk, r0[1] * tk); const b = section(C1, M1, r1[0] * tk, r1[1] * tk);
    shapes.push({ pts: hull([...a, ...b].map((q) => [q.x, q.y])), depth: (S(C0).d + S(C1).d) / 2, part, side: null, role: 'body' });
  };
  const hw = pz.hw;

  const pelvisLow = add(pz.pelvis, apply(pz.Rp, [0, -0.06, 0]));
  tube(pelvisLow, pz.base0, pz.Rp, pz.Rp, [0.085, hw + 0.055], [0.08, hw + 0.04], 'pelvis');
  tube(pz.base0, pz.j1, pz.R1, pz.R1, [0.085, 0.135], [0.095, 0.15], 'spine.lower');
  tube(pz.j1, pz.j2, pz.R2, pz.R2, [0.095, 0.15], [0.1, 0.165], 'spine.mid');
  tube(pz.j2, pz.j3, pz.R3, pz.R3, [0.1, 0.17], [0.075, 0.165], 'spine.upper');
  capsule(pz.neckBase, pz.neckTop, 0.04, 0.034, 'neck', null, 'body', tk);

  // Head: an ellipsoid sampled on three great circles.
  const hr = pz.headR;
  const headPts = [];
  // The whole ellipsoid sampled on latitudes and longitudes, so its outline is a true ellipse from any angle (the close-up shows every facet).
  for (let lat = 0; lat <= 12; lat++) {
    const ph = (lat / 12) * Math.PI;
    for (let lon = 0; lon < (lat === 0 || lat === 12 ? 1 : 32); lon++) {
      const th = (lon / 32) * TAU;
      const q = [0.95 * Math.sin(ph) * Math.cos(th), 1.08 * Math.cos(ph), 0.85 * Math.sin(ph) * Math.sin(th)];
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
    capsule(sd.hip, sd.knee, 0.088, 0.062, 'leg', side, role, gk);
    capsule(sd.knee, sd.ankle, 0.058, 0.038, 'leg', side, role, gk);
    const fs3 = footShape(pz, side, pr.footSize ?? 1); const fa = fs3.a.map(S).map((q) => [q.x, q.y]); const fb = fs3.b.map(S).map((q) => [q.x, q.y]);
    const area = (poly) => Math.abs(poly.reduce((t, q, i) => { const r = poly[(i + 1) % poly.length]; return t + q[0] * r[1] - r[0] * q[1]; }, 0)) / 2;
    const fh = hull([...fa, ...fb]); const big = area(fa) >= area(fb) ? fa : fb;
    // Side on, one face is the shoe (with its dip at the instep). Turned toward the camera the faces spread apart, so the outline is their hull.
    const shoePts = area(big) >= 0.9 * area(fh) ? big : fh;
    shapes.push({ pts: shoePts, depth: S(sd.ankle).d, part: 'foot', side, role });
    capsule(sd.shoulder, sd.elbow, 0.05, 0.038, 'arm', side, role, gk);
    capsule(sd.elbow, sd.wrist, 0.036, 0.028, 'forearm', side, role, gk);
    const hc2 = add(sd.wrist, mul([sd.hand[0] - sd.wrist[0], sd.hand[1] - sd.wrist[1], sd.hand[2] - sd.wrist[2]], 0.6));
    const H = S(hc2);
    shapes.push({ pts: circlePts(H, 0.045 * (pr.handSize ?? 1) * sc, 14), depth: H.d, part: 'hand', side, role });
    const SH = S(sd.shoulder);
    shapes.push({ pts: circlePts(SH, 0.052 * sc, 14), depth: SH.d + 0.0005, part: 'girdle', side, role });
  }
  shapes.sort((a, b) => a.depth - b.depth);
  return { shapes, face };
}

// ---------- the rubber hose figure ----------
const mixHex = (a, b, t) => { const pa = parseInt(a.slice(1), 16); const pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join(''); };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** A limb as one curve through three joints. bend 1 is a single smooth curve that passes through the middle joint; 0 is the joint's sharp corner. */
function hoseCurve(a, m, b, bend, n = 14) {
  const c = [2 * m[0] - (a[0] + b[0]) / 2, 2 * m[1] - (a[1] + b[1]) / 2, 2 * m[2] - (a[2] + b[2]) / 2];
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const smooth = [0, 1, 2].map((k) => (1 - t) ** 2 * a[k] + 2 * (1 - t) * t * c[k] + t * t * b[k]);
    const joint = t < 0.5 ? lerp3(a, m, t * 2) : lerp3(m, b, t * 2 - 1);
    return lerp3(joint, smooth, bend);
  });
}
/** The outline of a tube (a thick line with round ends and a radius that can change along it) from screen points and radii. */
function tubePoly(pts, radii) {
  const n = pts.length; const L = []; const R = [];
  const nrm = (i) => { const a = pts[Math.max(0, i - 1)]; const b = pts[Math.min(n - 1, i + 1)]; let tx = b.x - a.x; let ty = b.y - a.y; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l; return [-ty, tx]; };
  for (let i = 0; i < n; i++) { const [nx, ny] = nrm(i); L.push([pts[i].x + nx * radii[i], pts[i].y + ny * radii[i]]); R.push([pts[i].x - nx * radii[i], pts[i].y - ny * radii[i]]); }
  const cap = (c, r, a0, a1, steps = 9) => Array.from({ length: steps - 1 }, (_, k) => { const a = a0 + (a1 - a0) * ((k + 1) / steps); return [c.x + r * Math.cos(a), c.y + r * Math.sin(a)]; });
  const e = nrm(n - 1); const a1 = Math.atan2(e[1], e[0]); const s0 = nrm(0); const a0 = Math.atan2(s0[1], s0[0]);
  return [...L, ...cap(pts[n - 1], radii[n - 1], a1, a1 - Math.PI), ...R.reverse(), ...cap(pts[0], radii[0], a0 + Math.PI, a0)];
}
/** Where a point of the face [z, y] (in head radii from the head's centre) lands on the front of the head. */
function headMap(pz, cam) {
  const hr = pz.headR; const W = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]);
  return ([z, y]) => {
    const yy = y * hr; const zz = z * hr; const r2 = (yy / (1.08 * hr)) ** 2 + (zz / (0.85 * hr)) ** 2;
    return W(add(pz.headC, apply(pz.Rh, [0.95 * hr * Math.sqrt(Math.max(0.02, 1 - r2)) + 0.004 * hr, yy, zz])));
  };
}
function buildHoseShapes(pz, cam, st) {
  const shapes = [];
  const S = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]);
  const sc = cam.scale;
  const pr = pz.params?.proportions || {}; const limbK = (st.hoseLimb ?? 1) * (pr.limbGirth ?? 1); const bodyK = pr.torsoGirth ?? 1;
  const sq = Math.max(-1, Math.min(1, -(pz.bobDev || 0) / (Math.max(0.02, pz.params?.bob ?? 0.075) / 2)));
  const wMul = 1 + 0.3 * (st.hoseSquash ?? 1) * sq; // fuller at the bottom of the bounce, thinner at the top (the height changes the other way, in squashCam)
  const bend = Math.max(0, Math.min(1, st.hoseBend ?? 1));
  const col = (c, role) => (role === 'far' ? mixHex(c, st.farTint, 0.3) : c);
  const add1 = (pts, depth, part, side, role, color, lw = 1.6) => shapes.push({ pts, depth, part, side, role, fill: col(color, role), lw });
  const tubeOf = (pts3, radii, part, side, role, color, bias = 0) => {
    const P = pts3.map(S); const poly = tubePoly(P, radii.map((r) => r * sc));
    add1(poly, P.reduce((t, q) => t + q.d, 0) / P.length + bias, part, side, role, color);
  };
  const blob = (center, R, rad, n = 10, m = 24) => { // an ellipsoid's outline
    const out = [];
    for (let lat = 0; lat <= n; lat++) { const ph = (lat / n) * Math.PI; for (let lon = 0; lon < (lat === 0 || lat === n ? 1 : m); lon++) { const th = (lon / m) * TAU; const q = [rad[0] * Math.sin(ph) * Math.cos(th), rad[1] * Math.cos(ph), rad[2] * Math.sin(ph) * Math.sin(th)]; const P = S(add(center, apply(R, q))); out.push([P.x, P.y]); } }
    return hull(out);
  };

  // body: a pear of overlapping round sections from the hips to the shoulders, then shorts over the hips and a short neck
  const T = [pz.pelvis, pz.base0, pz.j1, pz.j2, pz.j3];
  tubeOf(T, [0.125, 0.13, 0.14, 0.13, 0.105].map((r) => r * bodyK * wMul), 'spine.mid', null, 'body', st.hoseBody);
  tubeOf([add(pz.pelvis, apply(pz.Rp, [0, -0.06, 0])), pz.pelvis, pz.base0].map((p) => p), [0.12, 0.125, 0.13].map((r) => r * bodyK * wMul * 1.04), 'pelvis', null, 'body', st.hoseShorts, 0.0004);
  tubeOf([pz.neckBase, pz.neckTop], [0.05 * bodyK, 0.045 * bodyK], 'neck', null, 'body', st.hoseBody);

  // head and ears
  const hr = pz.headR; const hc = S(pz.headC);
  shapes.push({ pts: blob(pz.headC, pz.Rh, [0.95 * hr, 1.08 * hr, 0.85 * hr], 12, 32), depth: hc.d, part: 'head', side: null, role: 'body', fill: st.hoseBody, lw: 1.6, face: true });
  if (st.hoseEars === 'round') {
    for (const sg of [1, -1]) {
      const C = S(add(pz.headC, apply(pz.Rh, [-0.05 * hr, 1.0 * hr, sg * 0.7 * hr])));
      shapes.push({ pts: circlePts(C, 0.46 * hr * sc, 22), depth: hc.d - 0.0008, part: 'head', side: null, role: 'body', fill: st.hoseBody, lw: 1.6 });
    }
  }

  for (const side of ['R', 'L']) {
    const sd = pz.sides[side]; const role = side === 'R' ? 'near' : 'far';
    // legs and arms are single tubes with no knee or elbow: one curve through the three joints
    tubeOf(hoseCurve(sd.hip, sd.knee, sd.ankle, bend), Array(14).fill(0.052 * limbK * wMul), 'leg', side, role, st.hoseBody);
    tubeOf(hoseCurve(sd.shoulder, sd.elbow, sd.wrist, bend), Array(14).fill(0.04 * limbK * wMul), 'arm', side, role, st.hoseBody);
    // the foot: a short, round tube along the sole, the same colour as the leg so the two read as one hose
    const k = pr.footSize ?? 1; const f = sd.foot; const r = 0.055 * k; const cy = -0.075 + r; // its underside rests on the ground
    const along = (x) => add(sd.ankle, add(mul(f.fx, x * k), mul(f.fy, cy)));
    tubeOf([along(-0.02), along(0.12), along(0.27)], [r, r * 1.02, r * 0.9], 'foot', side, role, st.hoseShoe);
    // a round glove with a thumb
    const hs = pr.handSize ?? 1; const hc2 = add(sd.wrist, mul([sd.hand[0] - sd.wrist[0], sd.hand[1] - sd.wrist[1], sd.hand[2] - sd.wrist[2]], 0.6));
    const H = S(hc2); const Wr = S(sd.wrist); const dx = H.x - Wr.x; const dy = H.y - Wr.y; const dl = Math.hypot(dx, dy) || 1;
    const th = { x: H.x + (-dy / dl) * 0.05 * hs * sc + (dx / dl) * 0.02 * hs * sc, y: H.y + (dx / dl) * 0.05 * hs * sc + (dy / dl) * 0.02 * hs * sc };
    add1(hull([...circlePts(H, 0.062 * hs * sc, 18), ...circlePts(th, 0.03 * hs * sc, 10)]), H.d + 0.0003, 'hand', side, role, st.hoseGlove);
  }
  shapes.sort((x, y) => x.depth - y.depth);
  return { shapes, face: { eyes: [], nose: null } };
}

/** The face of the rubber hose figure: a face patch, eyes (pie-cut by default), a nose and the mouth, bent onto the front of the head. */
function paintHoseFace(ctx, pz, cam, st, mouthId) {
  const map = headMap(pz, cam);
  const hcP = cam.p([pz.headC[0] + pz.pelvisX, pz.headC[1], pz.headC[2]]);
  if (map([0, 0]).d <= hcP.d) return; // turned away
  const poly = (pts) => { ctx.beginPath(); pts.map(map).forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); };
  const ell = (cz, cy, rz, ry, n = 22, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n }, (_, i) => { const t = a0 + ((a1 - a0) * i) / n; return [cz + rz * Math.cos(t), cy + ry * Math.sin(t)]; });
  const lw = cam.lw * 1.2;
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  poly(ell(0, -0.1, 0.68, 0.8, 28)); ctx.fillStyle = st.hoseFace; ctx.fill(); // the face patch
  const kind = st.hoseEyes || 'pie';
  for (const sg of [1, -1]) {
    const ez = sg * 0.3; const ey = 0.3;
    if (kind === 'dots') { poly(ell(ez, ey - 0.02, 0.07, 0.1)); ctx.fillStyle = '#111'; ctx.fill(); continue; }
    poly(ell(ez, ey, 0.21, 0.3)); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.strokeStyle = st.lineColor; ctx.lineWidth = lw; ctx.stroke();
    const pz2 = ez + sg * 0.03; const py = ey - 0.05; const pr = kind === 'round' ? [0.12, 0.2] : [0.11, 0.19];
    poly(ell(pz2, py, pr[0], pr[1])); ctx.fillStyle = '#111'; ctx.fill();
    if (kind === 'pie') { // a wedge cut out of the pupil
      const R = 0.3; const wedge = [[pz2, py], [pz2 + R * Math.cos(0.45), py + R * Math.sin(0.45)], [pz2 + R * Math.cos(1.15), py + R * Math.sin(1.15)]];
      ctx.save(); poly(ell(pz2, py, pr[0], pr[1])); ctx.clip(); poly(wedge); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.restore();
    }
  }
  poly(ell(0, -0.07, 0.13, 0.09)); ctx.fillStyle = '#111'; ctx.fill(); // the nose
  ctx.restore();
  paintMouth(ctx, mouthId || 'rest', ([z, y]) => map([z, -0.42 + y * 0.9]), { line: st.lineColor, lw: cam.lw * 1.1 });
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
  // Outline: the whole figure's edge was already drawn in a first pass, so this fill covers every line inside it.
  if (st.style === 'outline' && !ghost) { ctx.fillStyle = sh.fill ?? (far ? mixHex(st.fillColor, st.farTint, 0.4) : hexA(st.fillColor, 1)); ctx.fill(); return; }
  if (st.style === 'mannequin') {
    ctx.fillStyle = ghost ? hexA(ghost, 0.1) : sh.fill ?? (far ? hexA(st.farTint, st.farOpacity * 0.55) : hexA(st.fillColor, st.fillOpacity));
    ctx.fill();
  }
  ctx.strokeStyle = ghost || (far && !sh.fill ? st.farTint : st.lineColor);
  ctx.lineWidth = cam.lw * (sh.lw || 1);
  ctx.stroke();
}

const DEPTH_OFF = { back: -1000, behind: -0.0006, front: 0.0006, top: 1000 };
/** Whether a body shape is left out because a picture is attached to its part (or to any part, when the model is hidden). */
function coveredByPicture(sh, st, attach) {
  if (st.pictureModel === 'show the model' || !attach?.length) return false;
  const pics = attach.filter((it) => it.visible && it.kind === 'image' && it.img);
  if (!pics.length) return false;
  if (st.pictureModel === 'hide the model') return true;
  const partOf = (p) => (p === 'girdle' ? 'arm' : p);
  return pics.some((it) => it.part === partOf(sh.part) && (!it.side || !sh.side || it.side === sh.side));
}

/** The camera for a figure placed in the scene: its world is turned, scaled and moved before it reaches the main camera. */
function actorCam(cam, a) {
  const yaw = ((a.yaw || 0) * Math.PI) / 180; const c = Math.cos(yaw); const s = Math.sin(yaw); const k = a.scale || 1;
  return { ...cam, scale: cam.scale * k, p: (pt) => cam.p([(c * pt[0] + s * pt[2]) * k + a.x, pt[1] * k, (-s * pt[0] + c * pt[2]) * k + a.z]) };
}
const strideOf = (p) => (p.rig === 'dog' ? p.dogStride : 2 * p.stepLength);
/** The other figures and the scenery, each with the depth it sorts at: [{ d, paint }]. Figures use their own walk, started a little apart from the main one. */
function sceneDrawables(ctx, params, st, cam, env) {
  const out = []; const sc = params.scene; if (!sc) return out;
  const { ph, perf, t0, sp, pz, hits } = env;
  for (const a of sc.actors || []) {
    if (!a.visible) continue;
    const dogA = a.p.rig === 'dog'; const poser = dogA ? poseDog : pose3;
    // The figure goes a whole number of its own cycles to each cycle of the main one, with its stride set so the two cover the same ground. That keeps it in step and
    // stops it creeping ahead and snapping back each time the loop starts again.
    const sM = Math.max(0.05, strideOf(sp)); const k = Math.max(1, Math.round(sM / Math.max(0.05, strideOf(a.p)))); const sA = sM / k;
    const pA = dogA ? { ...a.p, dogStride: sA } : { ...a.p, stepLength: sA / 2 };
    const cyc = k * ph.u + a.phase; const u = cyc - Math.floor(cyc);
    const extra = { worldX: perf ? perf.x[t0] + a.phase * sA : cyc * sA, ...(perf ? { freeU: t0 / Math.max(2, Math.round(a.p.cycleFrames)) } : {}) };
    const pzA = poser({ ...pA, proportions: a.r, motion: {}, attach: [], speech: null }, {}, u, extra);
    const cA = actorCam(cam, a);
    const st2 = a.fill ? { ...st, fillColor: a.fill, hoseBody: a.fill } : st;
    out.push({ d: cA.p([pzA.pelvisX, 0, 0]).d, paint: () => { const r = drawFigureShapes(ctx, pzA, cA, st2, {}); hits.push({ id: a.id, shapes: r.shapes || [] }); } });
  }
  for (const q of sc.props || []) {
    if (!q.visible) continue;
    out.push({ d: cam.p([q.x, 0, q.z]).d, paint: () => paintProp(ctx, q, cam, st) });
  }
  void pz;
  return out.sort((a, b) => a.d - b.d);
}
/** A prop: its faces and balls, back to front, lit from above and the side. */
function paintProp(ctx, q, cam, st) {
  const { faces, balls, shade } = propParts(q);
  const parts = [];
  for (const f of faces) { const pts = f.pts.map((w) => cam.p(w)); parts.push({ d: pts.reduce((t, p) => t + p.d, 0) / pts.length, face: f, pts }); }
  for (const b of balls) { const c = cam.p(b.c); parts.push({ d: c.d, ball: b, c }); }
  parts.sort((a, b) => a.d - b.d);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = cam.lw * 0.7; ctx.strokeStyle = st.lineColor;
  for (const p of parts) {
    if (p.face) { ctx.beginPath(); p.pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath(); ctx.fillStyle = shade(p.face.color, faceLight(p.face.normal)); ctx.fill(); ctx.stroke(); }
    else {
      const r = p.ball.r * cam.scale; const ry = (p.ball.ry ?? p.ball.r) * cam.scale;
      const g = ctx.createRadialGradient(p.c.x - r * 0.35, p.c.y - ry * 0.4, r * 0.1, p.c.x, p.c.y, Math.max(r, ry));
      g.addColorStop(0, shade(p.ball.color, 1.25)); g.addColorStop(1, shade(p.ball.color, 0.72));
      ctx.beginPath(); ctx.ellipse(p.c.x, p.c.y, r, ry, 0, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
}

/** Draws the attachments of a figure that is drawn as lines: behind ones first, then in front. Returns the placed items. */
function paintAttachLines(ctx, pz, cam, opts, parts) {
  if (!opts.attach?.length || opts.tint) return [];
  const placed = placeItems(opts.attach, pz, cam).filter(({ f }) => (f.role === 'far' ? parts.far : f.role === 'near' ? parts.near : parts.body));
  for (const kind of ['back', 'behind', 'front', 'top']) for (const { it, f } of placed) if (it.depth === kind) paintItem(ctx, it, f, cam);
  return placed;
}

/** The mouth on the head's surface: its flat outline is bent onto the ellipsoid of the head, so it turns with the head and foreshortens at an angle. */
function paintHeadMouth(ctx, pz, cam, st, id) {
  const map = headMap(pz, cam);
  const surf = ([z, y]) => map([z, -0.45 + y]);
  if (surf([0, 0]).d <= cam.p([pz.headC[0] + pz.pelvisX, pz.headC[1], pz.headC[2]]).d) return; // turned away from the camera
  paintMouth(ctx, id, surf, { line: st.lineColor, lw: cam.lw * 0.85 });
}

/** For the rubber hose figure: the camera with the figure squashed toward its feet at the bottom of the bounce and stretched up at the top, about the ground it stands on. */
function squashCam(cam, pz, st) {
  if (pz.legs || pz.params?.model !== 'hose') return cam;
  const amt = st.hoseSquash ?? 1; if (!amt) return cam;
  const sq = Math.max(-1, Math.min(1, -(pz.bobDev || 0) / (Math.max(0.02, pz.params?.bob ?? 0.075) / 2)));
  const v = 1 - 0.2 * amt * sq; const gy = cam.p([pz.pelvisX, pz.groundY || 0, 0]).y;
  return { ...cam, p: (pt) => { const r = cam.p(pt); return { x: r.x, y: gy + (r.y - gy) * v, d: r.d }; } };
}
function drawFigureShapes(ctx, pz, cam0, st, opts = {}) {
  const cam = squashCam(cam0, pz, st);
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
  const hose = !pz.legs && pz.params?.model === 'hose';
  const built = pz.legs ? buildDogShapes(pz, cam) : hose ? buildHoseShapes(pz, cam, st) : buildShapes(pz, cam);
  const { face } = built; let shapes = built.shapes;
  // Attachments take their part's depth, a hair in front of it or behind it, so they sort with the body and with each other.
  const placed = opts.attach?.length && !ghost ? placeItems(opts.attach, pz, cam) : [];
  if (placed.length) shapes = [...shapes, ...placed.map(({ it, f }) => ({ attach: it, frame: f, depth: f.depth + (DEPTH_OFF[it.depth] ?? 0.0006), part: null, side: it.side, role: f.role, pts: [] }))].sort((a, b) => a.depth - b.depth);
  if (st.style === 'outline' && !ghost) {
    // First pass: every limb and the body, stroked twice as thick. The fills that follow leave only the outer edge, so arms, legs and body read as one outline with no lines crossing inside.
    ctx.save(); ctx.lineWidth = cam.lw * 2.2; ctx.lineJoin = 'round';
    for (const sh of shapes) {
      ctx.strokeStyle = sh.role === 'far' && !sh.fill ? mixHex(st.lineColor, st.farTint, 0.55) : st.lineColor;
      if (sh.attach || sh.pts.length < 3 || (!ghost && coveredByPicture(sh, st, opts.attach)) || (sh.role === 'far' && !parts.far) || (sh.role === 'near' && !parts.near) || (sh.role === 'body' && !parts.body)) continue;
      ctx.beginPath(); sh.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  for (const sh of shapes) {
    if ((sh.role === 'far' && !parts.far) || (sh.role === 'near' && !parts.near) || (sh.role === 'body' && !parts.body)) continue;
    if (sh.attach) { paintItem(ctx, sh.attach, sh.frame, cam); continue; }
    if (!ghost && coveredByPicture(sh, st, opts.attach)) continue;
    paintShape(ctx, sh, cam, st, ghost);
    if (sh.face && !ghost && (st.style === 'mannequin' || st.style === 'outline')) paintHoseFace(ctx, pz, cam, st, opts.mouth);
    if (sh.part === 'head' && opts.mouth && !hose && !ghost && (st.style === 'mannequin' || st.style === 'outline')) paintHeadMouth(ctx, pz, cam, st, opts.mouth);
    if ((sh.part === 'head' || sh.part === 'dog.head') && !hose && (st.style === 'mannequin' || st.style === 'outline') && !ghost) {
      ctx.strokeStyle = st.lineColor; ctx.fillStyle = st.lineColor; ctx.lineWidth = cam.lw * 0.9;
      for (const e of face.eyes) { ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1.5, cam.lw * 0.9, 0.05 * pz.headR * cam.scale), 0, TAU); ctx.fill(); }
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
  const terrain = !dog && params.terrain && params.terrain !== 'flat';
  const gyf = terrain ? (x) => groundAt(params, x) : () => 0; // the height of the ground
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
  const bodyTarget = [perf ? (params.travel === 'across' ? (perf.x[0] + perf.x[perf.T]) / 2 : pz.pelvisX + (dog ? 0.45 : 0)) : (params.travel === 'across' ? step : pz.pelvisX + (dog ? 0.45 : 0)), dog ? speciesOf(params).view.y + Math.min(1, params.dogFlight || 0) * (params.dogFlightHeight ?? 0) * 0.85 : 0.9, 0];
  bodyTarget[1] += gyf(bodyTarget[0]);
  // The head view looks at the face: the camera is centred on the head and zoomed in, and still orbits around it.
  const headView = st.focus === 'head' && !dog;
  const target = headView ? [pz.headC[0] + pz.pelvisX, pz.headC[1], pz.headC[2]] : bodyTarget;
  const mouthId = dog ? null : (opts.mouth ?? speechAt(params.speech, perf ? t0 : frame) ?? (headView ? 'rest' : null));
  const cam = makeCam(st, w, h, target, opts.yawOffset || 0, headView ? st.headZoom : dog ? speciesOf(params).view.zoom / (1 + 0.15 * Math.min(1, params.dogFlight || 0)) : 1, headView);
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
    if (st.showGround && !headView) {
      const x0 = target[0] - 5; const x1 = target[0] + 5;
      ctx.strokeStyle = hexA(st.guideColor, 0.75); ctx.lineWidth = cam.lw * 0.8;
      const dx = terrain ? 0.04 : x1 - x0;
      const run = (z) => { for (let x = x0; x <= x1 + 1e-9; x += dx) { const A = cam.p([x, gyf(x), z]); if (x === x0) ctx.moveTo(A.x, A.y); else ctx.lineTo(A.x, A.y); } };
      if (terrain) { // the ground is a solid, so a slope or a flight of steps reads as something to stand on
        ctx.fillStyle = hexA(st.guideColor, 0.12); ctx.beginPath(); run(0);
        const e1 = cam.p([x1, -0.4, 0]); const e0 = cam.p([x0, -0.4, 0]); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e0.x, e0.y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = hexA(st.guideColor, 0.75); ctx.lineWidth = cam.lw * 0.8;
      }
      ctx.beginPath(); run(0); ctx.stroke();
      ctx.strokeStyle = hexA(st.guideColor, 0.28);
      ctx.beginPath();
      if (terrain) for (const z of [-0.6, -0.3, 0.3, 0.6]) run(z); else for (const z of [-0.6, -0.3, 0.3, 0.6]) line([x0, 0, z], [x1, 0, z]);
      const half = step / 2;
      const first = Math.floor(x0 / half) * half;
      for (let x = first; x < x1; x += half) line([x, gyf(x), -0.6], [x, gyf(x), 0.6]);
      ctx.stroke();
      ctx.strokeStyle = hexA(st.guideColor, 0.75);
      ctx.beginPath();
      for (let x = first; x < x1; x += half) { const A = cam.p([x, gyf(x), 0]); ctx.moveTo(A.x, A.y); ctx.lineTo(A.x, A.y + 11 * cam.k); }
      ctx.stroke();
    }
    if (headView) { /* no ground in the head view */ } else if (st.showFootprints && dog) {
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
        const q = [[pl.x - 0.07, z - 0.045], [pl.x + 0.26, z - 0.045], [pl.x + 0.26, z + 0.045], [pl.x - 0.07, z + 0.045]].map(([x, zz]) => cam.p([x, gyf(pl.x), zz]));
        ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.fill();
      }
    } else if (st.showFootprints) {
      // Where each foot plants. They stay fixed on the ground while the body passes over them.
      ctx.fillStyle = hexA(st.guideColor, 0.38);
      const c0 = Math.floor((target[0] - 4) / (2 * step)); const c1 = Math.ceil((target[0] + 4) / (2 * step));
      for (let c = c0; c <= c1; c++) {
        for (const [sd, zs] of [['R', 1], ['L', -1]]) {
          const g = sideGait(params, sd);
          const ax = (c + g.off) * 2 * step + g.d;
          const z = zs * (params.stepWidth ?? 0.075);
          const q = [[ax - 0.07, z - 0.045], [ax + 0.26, z - 0.045], [ax + 0.26, z + 0.045], [ax - 0.07, z + 0.045]].map(([x, zz]) => cam.p([x, gyf(ax), zz]));
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

  let shapes = []; let placedAttach = []; let handles = null; let fixHandle = null; const sceneHits = [];
  const sceneItems = !opts.parts && !headView && st.showScene !== false && (params.scene?.actors?.length || params.scene?.props?.length) ? sceneDrawables(ctx, params, st, cam, { ph, perf, t0, sp, pz, hits: sceneHits }) : [];
  const dMain = cam.p([pz.pelvisX, 0, 0]).d;
  if (layers.figure) {
    for (const it of sceneItems) if (it.d < dMain) it.paint();
    if (st.showOnion && opts.onion !== false) {
      const ghostStyle = { ...st, style: st.style === 'silhouette' ? 'stick' : st.style };
      const ghost = (k) => (perf ? poseAt(Math.min(perf.T - 1, Math.max(0, t0 + k * ex))) : poser(params, motion, ph.u + k * ph.step));
      for (let k = st.onionBefore; k >= 1; k--) drawFigureShapes(ctx, ghost(-k), cam, ghostStyle, { tint: st.onionBeforeTint, alpha: st.onionOpacity * Math.pow(0.7, k - 1) });
      for (let k = st.onionAfter; k >= 1; k--) drawFigureShapes(ctx, ghost(k), cam, ghostStyle, { tint: st.onionAfterTint, alpha: st.onionOpacity * Math.pow(0.7, k - 1) });
    }
    const fig = drawFigureShapes(ctx, pz, cam, st, { parts: opts.parts, attach: attachNow, mouth: mouthId });
    shapes = fig.shapes; placedAttach = fig.placed || [];
    for (const it of sceneItems) if (it.d >= dMain) it.paint();
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
    if (opts.fix && sel) { // the fix handle: the end of the selected part, to drag back into line
      const bone = partBone(pz, sel.part, sel.seg ?? null, sel.side ?? null);
      if (bone) {
        const e = cam.p([bone[1][0] + pz.pelvisX, bone[1][1], bone[1][2]]); const r = 11 * cam.k;
        ctx.save(); ctx.lineWidth = cam.lw * 1.8; ctx.strokeStyle = '#e0662e'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.35, 0, TAU); ctx.fillStyle = '#e0662e'; ctx.fill();
        ctx.restore(); fixHandle = { x: e.x, y: e.y };
        // and one at the base of the part: it moves the part before it, since that is where this one starts
        const b0 = cam.p([bone[0][0] + pz.pelvisX, bone[0][1], bone[0][2]]); const q = 8 * cam.k;
        ctx.save(); ctx.lineWidth = cam.lw * 1.6; ctx.strokeStyle = '#e0662e'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.rect(b0.x - q, b0.y - q, q * 2, q * 2); ctx.fill(); ctx.stroke(); ctx.restore();
        fixHandle.base = { x: b0.x, y: b0.y };
      }
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

  if (layers.guides && layers.figure && st.showFootLabels && !dog && !headView && !pz.legs && st.style !== 'silhouette') {
    // Names on the near foot: ankle, heel, ball and toe, each with a dot and a short leader line.
    ctx.save();
    ctx.font = `600 ${Math.round(11 * cam.k)}px system-ui, sans-serif`;
    const marks = footMarks(pz, 'R').map((m) => ({ name: m.name, q: cam.p([m.p[0] + pz.pelvisX, m.p[1], m.p[2]]) }));
    const by = Object.fromEntries(marks.map((m) => [m.name, m.q]));
    const dir = by.toe.x >= by.heel.x ? 1 : -1; // which way the foot points on screen
    const place = { ankle: [-dir * 22, -18], heel: [-dir * 20, 20], ball: [dir * 2, 26], toe: [dir * 22, 16] };
    for (const m of marks) {
      const [dx, dy] = place[m.name]; const k = cam.k;
      const tx = m.q.x + dx * k, ty = m.q.y + dy * k;
      ctx.strokeStyle = hexA(st.guideColor, 0.85); ctx.fillStyle = hexA(st.guideColor, 0.95); ctx.lineWidth = Math.max(1, cam.lw * 0.6);
      ctx.beginPath(); ctx.moveTo(m.q.x, m.q.y); ctx.lineTo(tx, ty - (dy > 0 ? 8 : -2) * k); ctx.stroke();
      ctx.beginPath(); ctx.arc(m.q.x, m.q.y, Math.max(2, 2.6 * k), 0, TAU); ctx.fill();
      ctx.textAlign = dx * dir >= 0 && m.name !== 'ball' ? 'left' : m.name === 'ball' ? 'center' : 'right';
      ctx.fillText(m.name, tx, ty + (dy > 0 ? 4 : -2) * k);
    }
    ctx.restore();
  }
  if (layers.guides && layers.figure && st.showMouthLabel && mouthId && (opts.mouth || params.speech)) {
    // Which mouth shape this is, and the sounds it stands for.
    const v = VISEME_BY_ID[mouthId];
    ctx.save(); ctx.textAlign = 'right';
    ctx.font = `600 ${Math.round(28 * cam.k)}px system-ui, sans-serif`; ctx.fillStyle = hexA(st.guideColor, 0.95);
    ctx.fillText(`Mouth: ${v.label}`, w - 28 * cam.k, 88 * cam.k);
    ctx.font = `500 ${Math.round(20 * cam.k)}px system-ui, sans-serif`; ctx.fillStyle = hexA(st.guideColor, 0.85);
    ctx.fillText(v.sounds, w - 28 * cam.k, 118 * cam.k);
    ctx.restore();
  }
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
  return { key, drawing: ph.drawing, drawings: ph.drawings, u: ph.u, shapes, cam, pz, attach: placedAttach, handles, arcDots, fixHandle, sceneHits };
}
