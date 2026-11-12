// Draws the 3D rig with an orbit camera. One function serves the stage, the contact sheet and every export.
// World: x forward, y up, z the figure's right. Camera: yaw orbits about the vertical through the figure, pitch lifts it above (positive) or below.
// Yaw 0 and pitch 0 is the side view, with the figure's right side toward you.
import { cycleFrames, keyPhases, sideGait, groundAt } from './rig.js';
import { pose3, footCorners, footShape, footMarks, add, mul, apply, hoseLimbs } from './rig3.js';
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
import { paintEyes, paintBrows, mouthOptions, EYE_BASE } from './face.js';
import { capsuleFacets, slabFacets, ellipsoidFacets, chainFacets, withFacets } from './lowpoly.js';
import { clayOutline } from './clay.js';
import { partKey, partFrame, skinMatrix, cellFor, cellToUV, fromUV } from './design.js';
import { paintStrokes } from './ink.js';
import { hasGround, hasDrop, stageDrop, castShadow, paintGroundShadow, groundStrength } from './shadow.js';
import { hoseCurve, tubePoly, wobble, taperRadii } from './hoseshape.js';
import { movedProp } from './propphys.js';

export const STYLE_DEFAULTS = Object.freeze({
  style: 'mannequin',        // mannequin | outline | stick | silhouette | moebius | comic | ink | pencil | clay | lowpoly | blocks
  moebiusLight: -135,        // the direction the light comes from, in degrees on the screen (-135 is the top left)
  moebiusAngle: 50,          // the angle of the hatching, in degrees
  moebiusDensity: 4.5,       // the gap between hatching lines, in pixels at the 1080 line frame
  moebiusShade: 0.5,         // how far the shadow reaches round each form (0 none, 1 nearly all)
  moebiusStipple: 0.4,       // dots along the edge of the shadow
  moebiusPaper: true,        // the stage is the colour of paper
  shadowMode: 'off',         // off | ground (a soft oval on the floor) | drop (the drawing cast down and to the side) | both
  shadowColor: '#000000', shadowOpacity: 0.35, shadowBlur: 14, shadowX: 14, shadowY: 18, shadowSize: 1,
  lineBoil: 0,               // the outline wobbles, a new wobble every few frames, as a hand-drawn line does (0 is still)
  boilRate: 2,               // frames between one wobble and the next
  lineDash: 'solid',         // solid | dashed | dotted
  lineJoin: 'round',         // round | miter | bevel: the corners of the line
  lineDepth: 0,              // 0 is every line the same weight; 1 makes the far side's lines half as heavy
  lineOffset: 0,             // the colour sits a little off its outline, as in a badly printed page (outlined looks only)
  blockSize: 7,              // the Blocks look: the side of each block, in pixels at the 1080 line frame
  polySides: 6,              // the Lowpoly look: how many flat sides each limb has
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
  showLabels: false,
  pictureModel: 'hide covered parts', // what the body does when pictures are attached
  showScene: true,           // the other figures and the scenery
  showFootLabels: false,
  showGizmo: true,
  showMouthLabel: true,
  // the face: 'default' eyes are each figure's own; the rest are drawn on the front of the head
  eyeStyle: 'default', eyeSize: 1, eyeSpacing: 1, eyeHeight: 0, eyeLookX: 0, eyeLookY: 0, eyeColor: '#111111', eyeLid: 0, blinkRate: 0,
  browStyle: 'none', browRaise: 0, browFurrow: 0,
  mouthShow: 'when speaking', mouthStyle: 'full', mouthWidth: 1, lipThickness: 1, mouthSmile: 0, lipColor: '#d98c8c', teethColor: '#ffffff', tongueColor: '#d9786f', cavityColor: '#5b2c2c',
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
  handStyle: 'default',      // default (each figure's own) | mitten | fist | fingers | pointing
  footStyle: 'default',      // default (each figure's own) | boot | bare | round
  hoseLimb: 1, hoseBend: 1, hoseSquash: 1, hoseEars: 'none', hoseEyes: 'pie',
  hoseTaper: 0,              // rubber hose limbs: positive is thicker at the body, negative thicker at the hand or foot
  hoseBelly: 1,              // how round the middle of the rubber hose body is
  hoseTail: 0,               // the rubber hose person's tail: 0 none, 1 a long one
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
function buildShapes(pz, cam, st = STYLE_DEFAULTS) {
  const shapes = [];
  const S = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]);
  const sc = cam.scale; const lp = st.style === 'lowpoly'; const NS = Math.max(4, Math.min(12, Math.round(st.polySides ?? 6)));
  const pr = pz.params?.proportions || {}; const gk = pr.limbGirth ?? 1; const tk = pr.torsoGirth ?? 1; // drawn thickness of the limbs and of the body
  const capsule = (a, b, ra, rb, part, side, role, k = 1) => {
    const A = S(a); const B = S(b);
    const sh = { pts: hull([...circlePts(A, ra * k * sc), ...circlePts(B, rb * k * sc)]), depth: (A.d + B.d) / 2, part, side, role }; shapes.push(sh);
    if (lp) withFacets(sh, capsuleFacets(S, sc, a, b, ra * k, rb * k, NS)); // a real prism of flat sides, turning with the camera
  };
  const section = (C, M, rf, rl, n = 12) => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * TAU;
    return S(add(C, apply(M, [rf * Math.cos(t), 0, rl * Math.sin(t)])));
  });
  const tube = (C0, C1, M0, M1, r0, r1, part) => {
    const a = section(C0, M0, r0[0] * tk, r0[1] * tk); const b = section(C1, M1, r1[0] * tk, r1[1] * tk);
    const sh = { pts: hull([...a, ...b].map((q) => [q.x, q.y])), depth: (S(C0).d + S(C1).d) / 2, part, side: null, role: 'body' }; shapes.push(sh);
    if (lp) { const wr = (C, M, rf, rl) => Array.from({ length: NS }, (_, i) => { const t = (i / NS) * TAU; return add(C, apply(M, [rf * Math.cos(t), 0, rl * Math.sin(t)])); }); withFacets(sh, slabFacets(S, sc, wr(C0, M0, r0[0] * tk, r0[1] * tk), wr(C1, M1, r1[0] * tk, r1[1] * tk))); }
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
  if (lp) withFacets(shapes[shapes.length - 1], ellipsoidFacets(S, sc, pz.headC, (q) => apply(pz.Rh, mul(q, hr)), [0.95, 1.08, 0.85], NS));
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
    const fk = pr.footSize ?? 1; const footAt = (x, y, z = 0) => add(sd.ankle, add(mul(sd.foot.fx, x * fk), add(mul(sd.foot.fy, y), mul(sd.foot.lat, z * fk))));
    if (st.footStyle === 'round') capsule(footAt(-0.02, -0.075 + 0.056 * fk), footAt(0.25, -0.075 + 0.05 * fk), 0.056 * fk, 0.05 * fk, 'foot', side, role); // a round, rubber hose foot
    else if (st.footStyle === 'bare') { // a bare foot: a low sole and five toes
      capsule(footAt(-0.03, -0.075 + 0.04 * fk), footAt(0.17, -0.075 + 0.032 * fk), 0.04 * fk, 0.032 * fk, 'foot', side, role);
      for (let j = 0; j < 5; j++) { const T = S(footAt(0.225 - Math.abs(j - 1) * 0.008, -0.075 + 0.02 * fk, (j - 2) * 0.021 * (side === 'R' ? -1 : 1))); shapes.push({ pts: circlePts(T, (0.021 - j * 0.0018) * fk * sc, 10), depth: T.d + 0.0002, part: 'foot', side, role }); }
    } else {
      shapes.push({ pts: shoePts, depth: S(sd.ankle).d, part: 'foot', side, role });
      if (st.footStyle === 'boot') capsule(sd.ankle, lerp3(sd.ankle, sd.knee, 0.45), 0.062, 0.072, 'foot', side, role, gk); // the shaft of a boot up the shin
    }
    capsule(sd.shoulder, sd.elbow, 0.05, 0.038, 'arm', side, role, gk);
    capsule(sd.elbow, sd.wrist, 0.036, 0.028, 'forearm', side, role, gk);
    const hc2 = add(sd.wrist, mul([sd.hand[0] - sd.wrist[0], sd.hand[1] - sd.wrist[1], sd.hand[2] - sd.wrist[2]], 0.6));
    const H = S(hc2);
    const hp = handPolys(H, S(sd.wrist), 0.045 * (pr.handSize ?? 1) * sc, st.handStyle);
    if (hp) hp.forEach((pts, i) => shapes.push({ pts, depth: H.d + i * 0.00002, part: 'hand', side, role }));
    else shapes.push({ pts: circlePts(H, 0.045 * (pr.handSize ?? 1) * sc, 14), depth: H.d, part: 'hand', side, role });
    const SH = S(sd.shoulder);
    shapes.push({ pts: circlePts(SH, 0.052 * sc, 14), depth: SH.d + 0.0005, part: 'girdle', side, role });
  }
  shapes.sort((a, b) => a.depth - b.depth);
  return { shapes, face };
}

// ---------- the rubber hose figure ----------
const mixHex = (a, b, t) => { const pa = parseInt(a.slice(1), 16); const pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join(''); };
/**
 * A hand drawn in one of the styles, on the screen: H is the middle of the hand, W the wrist (both { x, y }), r the size of the palm in pixels.
 * Returns the outlines to fill, the palm first, or null for the figure's own hand.
 */
export function handPolys(H, W, r, style) {
  if (!style || style === 'default') return null;
  let dx = H.x - W.x; let dy = H.y - W.y; const dl = Math.hypot(dx, dy); if (dl < 1e-6) { dx = 0; dy = 1; } else { dx /= dl; dy /= dl; }
  const nx = -dy; const ny = dx; // across the hand, towards the thumb
  const P = (a, b) => ({ x: H.x + (dx * a + nx * b) * r, y: H.y + (dy * a + ny * b) * r });
  const disc = (c, k, n = 10) => circlePts(c, k * r, n); const cap = (A, B, ka, kb) => hull([...disc(A, ka), ...disc(B, kb)]);
  const fist = () => hull([...disc(P(-0.25, -0.45), 0.5), ...disc(P(0.65, -0.45), 0.5), ...disc(P(-0.25, 0.45), 0.5), ...disc(P(0.65, 0.45), 0.5)]);
  switch (style) {
    case 'mitten': return [hull([...disc(P(0, 0), 0.9, 16), ...disc(P(0.8, 0), 0.8, 16), ...disc(P(0.15, 0.95), 0.38)])];
    case 'fist': return [fist(), cap(P(0.1, 0.8), P(0.6, 0.85), 0.26, 0.24)];
    case 'pointing': return [fist(), cap(P(0.7, -0.45), P(2.2, -0.45), 0.23, 0.19), cap(P(0.1, 0.8), P(0.6, 0.85), 0.26, 0.24)];
    case 'fingers': {
      const out = [hull([...disc(P(0, 0), 0.85, 16), ...disc(P(0.5, 0), 0.8, 16)])];
      for (let i = 0; i < 4; i++) { const k = i - 1.5; const a = (k * 11 * Math.PI) / 180; const len = i === 0 || i === 3 ? 1.05 : 1.3; const b = P(0.9, k * 0.4); out.push(cap(b, { x: b.x + (dx * Math.cos(a) + nx * Math.sin(a)) * len * r, y: b.y + (dy * Math.cos(a) + ny * Math.sin(a)) * len * r }, 0.21, 0.17)); }
      out.push(cap(P(0.05, 0.7), P(0.7, 1.4), 0.24, 0.19));
      return out;
    }
    default: return null;
  }
}
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
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
  // the wobble: a wave along each limb, a whole number of times a cycle so the cycle still loops. `wob` is where in its wave this limb starts (each one differs), or { k, free, plus } for a tail.
  const wobA = Math.max(0, pz.params?.hoseWobble || 0) * 0.03 * sc; const wobR = Math.max(1, Math.round(pz.params?.hoseWobbleRate || 2)); const taper = st.hoseTaper ?? 0;
  const tubeOf = (pts3, radii, part, side, role, color, bias = 0, wob = null) => {
    let P = pts3.map(S); if (wob != null) { const o = typeof wob === 'number' ? { k: wob } : wob; P = wobble(P, wobA + (o.plus || 0), (pz.u || 0) * wobR + o.k, o.free); }
    const poly = tubePoly(P, radii.map((r) => r * sc));
    add1(poly, P.reduce((t, q) => t + q.d, 0) / P.length + bias, part, side, role, color); Object.assign(shapes[shapes.length - 1], { spine: P, spineR: radii.map((r) => r * sc) }); // so a drawing or a skin bends with it
    if (st.style === 'lowpoly') withFacets(shapes[shapes.length - 1], chainFacets(S, sc, pts3, radii, Math.max(4, Math.min(12, Math.round(st.polySides ?? 6)))), false);
  };
  const blob = (center, R, rad, n = 10, m = 24) => { // an ellipsoid's outline
    const out = [];
    for (let lat = 0; lat <= n; lat++) { const ph = (lat / n) * Math.PI; for (let lon = 0; lon < (lat === 0 || lat === n ? 1 : m); lon++) { const th = (lon / m) * TAU; const q = [rad[0] * Math.sin(ph) * Math.cos(th), rad[1] * Math.cos(ph), rad[2] * Math.sin(ph) * Math.sin(th)]; const P = S(add(center, apply(R, q))); out.push([P.x, P.y]); } }
    return hull(out);
  };

  // body: a pear of overlapping round sections from the hips to the shoulders, then shorts over the hips and a short neck
  const T = [pz.pelvis, pz.base0, pz.j1, pz.j2, pz.j3];
  const belly = st.hoseBelly ?? 1;
  tubeOf(T, [0.125, 0.13 * belly, 0.14 * belly, 0.13 * belly, 0.105].map((r) => r * bodyK * wMul), 'spine.mid', null, 'body', st.hoseBody);
  if ((st.hoseTail ?? 0) > 0) { // a thin tail from the seat, curling up, swinging with the walk and wobbling along its length
    const L = 0.55 * st.hoseTail; const sw = Math.sin(2 * Math.PI * (pz.u || 0));
    const tail = Array.from({ length: 10 }, (_, i) => { const t = i / 9; return add(pz.pelvis, apply(pz.Rp, [-0.08 - L * 0.8 * t, -0.04 + L * 0.55 * t * t, 0.22 * L * t * sw])); });
    tubeOf(tail, taperRadii(10, 0.016 * limbK, 0.6), 'pelvis', null, 'body', st.hoseBody, -0.0006, { k: 0.4, free: true, plus: 0.012 * sc * st.hoseTail });
  }
  tubeOf([add(pz.pelvis, apply(pz.Rp, [0, -0.06, 0])), pz.pelvis, pz.base0].map((p) => p), [0.12, 0.125, 0.13].map((r) => r * bodyK * wMul * 1.04), 'pelvis', null, 'body', st.hoseShorts, 0.0004);
  tubeOf([pz.neckBase, pz.neckTop], [0.05 * bodyK, 0.045 * bodyK], 'neck', null, 'body', st.hoseBody);

  // head and ears
  const hr = pz.headR; const hc = S(pz.headC);
  shapes.push({ pts: blob(pz.headC, pz.Rh, [0.95 * hr, 1.08 * hr, 0.85 * hr], 12, 32), depth: hc.d, part: 'head', side: null, role: 'body', fill: st.hoseBody, lw: 1.6, face: true });
  if (st.style === 'lowpoly') withFacets(shapes[shapes.length - 1], ellipsoidFacets(S, sc, pz.headC, (q) => apply(pz.Rh, q), [0.95 * hr, 1.08 * hr, 0.85 * hr], Math.max(4, Math.min(12, Math.round(st.polySides ?? 6)))));
  if (st.hoseEars === 'round') {
    for (const sg of [1, -1]) {
      const C = S(add(pz.headC, apply(pz.Rh, [-0.05 * hr, 1.0 * hr, sg * 0.7 * hr])));
      shapes.push({ pts: circlePts(C, 0.46 * hr * sc, 22), depth: hc.d - 0.0008, part: 'head', side: null, role: 'body', fill: st.hoseBody, lw: 1.6 });
    }
  }

  for (const side of ['R', 'L']) {
    const sd = hoseLimbs(pz.sides[side], pz.params); const role = side === 'R' ? 'near' : 'far';
    // legs and arms are single tubes with no knee or elbow: one curve through the three joints
    tubeOf(hoseCurve(sd.hip, sd.knee, sd.ankle, bend), taperRadii(14, 0.052 * limbK * wMul, taper), 'leg', side, role, st.hoseBody, 0, side === 'R' ? 0 : 0.5);
    tubeOf(hoseCurve(sd.shoulder, sd.elbow, sd.wrist, bend), taperRadii(14, 0.04 * limbK * wMul, taper), 'arm', side, role, st.hoseBody, 0, side === 'R' ? 0.25 : 0.75);
    // the foot: a short, round tube along the sole, the same colour as the leg so the two read as one hose
    const k = pr.footSize ?? 1; const f = sd.foot; const r = 0.055 * k; const cy = -0.075 + r; // its underside rests on the ground
    const along = (x) => add(sd.ankle, add(mul(f.fx, x * k), mul(f.fy, cy)));
    if (st.footStyle === 'bare') {
      const rb = r * 0.7; const low = (x, z = 0) => add(sd.ankle, add(mul(f.fx, x * k), add(mul(f.fy, -0.075 + rb), mul(f.lat, z * k))));
      tubeOf([low(-0.02), low(0.1), low(0.2)], [rb, rb, rb * 0.85], 'foot', side, role, st.hoseShoe);
      for (let j = 0; j < 5; j++) { const T = S(add(low(0.25 - Math.abs(j - 1) * 0.008, (j - 2) * 0.024 * (side === 'R' ? -1 : 1)), mul(f.fy, -rb * 0.45))); add1(circlePts(T, (0.024 - j * 0.002) * k * sc, 10), T.d + 0.0004, 'foot', side, role, st.hoseShoe); }
    } else {
      tubeOf([along(-0.02), along(0.12), along(0.27)], [r, r * 1.02, r * 0.9], 'foot', side, role, st.hoseShoe);
      if (st.footStyle === 'boot') tubeOf([sd.ankle, lerp3(sd.ankle, sd.knee, 0.22), lerp3(sd.ankle, sd.knee, 0.45)], [0.07 * limbK, 0.074 * limbK, 0.08 * limbK], 'foot', side, role, st.hoseShoe, 0.0002);
    }
    // a round glove with a thumb
    const hs = pr.handSize ?? 1; const hc2 = add(sd.wrist, mul([sd.hand[0] - sd.wrist[0], sd.hand[1] - sd.wrist[1], sd.hand[2] - sd.wrist[2]], 0.6));
    const H = S(hc2); const Wr = S(sd.wrist); const dx = H.x - Wr.x; const dy = H.y - Wr.y; const dl = Math.hypot(dx, dy) || 1;
    const th = { x: H.x + (-dy / dl) * 0.05 * hs * sc + (dx / dl) * 0.02 * hs * sc, y: H.y + (dx / dl) * 0.05 * hs * sc + (dy / dl) * 0.02 * hs * sc };
    const hp = handPolys(H, Wr, 0.058 * hs * sc, st.handStyle);
    if (hp) hp.forEach((pts, i) => add1(pts, H.d + 0.0003 + i * 0.00002, 'hand', side, role, st.hoseGlove));
    else add1(hull([...circlePts(H, 0.062 * hs * sc, 18), ...circlePts(th, 0.03 * hs * sc, 10)]), H.d + 0.0003, 'hand', side, role, st.hoseGlove);
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
  const kind = st.hoseEyes || 'pie'; const faceO = { base: EYE_BASE.hose, lw, line: st.lineColor, skin: st.hoseFace, u: pz.u };
  const own = !paintEyes(ctx, map, st, faceO); // a chosen eye style replaces the figure's own eyes
  for (const sg of own ? [1, -1] : []) {
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
  paintBrows(ctx, map, st, { ...faceO, browLine: st.hoseFace }); // above the face patch, on the dark of the head, so in the pale colour
  paintMouth(ctx, mouthId || 'rest', ([z, y]) => map([z, -0.42 + y * 0.9]), mouthOptions(st, cam.lw * 1.1));
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

/**
 * Shading in the manner of a pen drawing: instead of a grey tone the form is hatched with fine parallel lines on the side away from the light, cross-hatched where it is deepest, with a few dots
 * along the edge of the shadow. The shadow is a half plane across the form, so the hatching reads as a form turning away from the light. Everything is clipped to the shape.
 */
function hatchShape(ctx, pts, st, cam, key) {
  if (pts.length < 3) return;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2; const R = Math.hypot(x1 - x0, y1 - y0) / 2;
  if (R < 6 * cam.k) return;
  const la = ((st.moebiusLight ?? -135) * Math.PI) / 180; const sx = -Math.cos(la); const sy = -Math.sin(la); const px = -sy; const py = sx; // the shadow side, and across it
  const reach = Math.max(0, Math.min(1, st.moebiusShade ?? 0.5)); const thr = R * (0.6 - 1.1 * reach);
  const sp = Math.max(2, (st.moebiusDensity ?? 4.5) * cam.k); const ang = ((st.moebiusAngle ?? 50) * Math.PI) / 180;
  ctx.save();
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
  const halfPlane = (t) => { // everything further along the shadow direction than t
    const ax = cx + sx * t + px * R * 3; const ay = cy + sy * t + py * R * 3; const bx = cx + sx * t - px * R * 3; const by = cy + sy * t - py * R * 3;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(bx + sx * R * 3, by + sy * R * 3); ctx.lineTo(ax + sx * R * 3, ay + sy * R * 3); ctx.closePath(); ctx.clip();
  };
  const hatch = (a, gap) => {
    const dx = Math.cos(a); const dy = Math.sin(a); const nx = -dy; const ny = dx;
    ctx.beginPath(); for (let k = -R * 1.5; k <= R * 1.5; k += gap) { ctx.moveTo(cx + nx * k - dx * R * 2, cy + ny * k - dy * R * 2); ctx.lineTo(cx + nx * k + dx * R * 2, cy + ny * k + dy * R * 2); } ctx.stroke();
  };
  ctx.strokeStyle = st.lineColor; ctx.lineCap = 'round'; ctx.lineWidth = Math.max(0.6, cam.lw * 0.38);
  ctx.save(); halfPlane(thr); hatch(ang, sp);
  ctx.save(); halfPlane(thr + R * 0.5); hatch(ang + 1.2, sp * 1.25); ctx.restore(); ctx.restore();
  const dots = st.moebiusStipple ?? 0;
  if (dots > 0) {
    const rand = rng(key); const n = Math.round(dots * ((R * R) / (sp * sp)) * 0.7); ctx.fillStyle = st.lineColor;
    for (let i = 0, got = 0; i < n * 6 && got < n; i++) {
      const a = rand() * Math.PI * 2; const d = R * Math.sqrt(rand()); const x = cx + Math.cos(a) * d; const y = cy + Math.sin(a) * d;
      const t = (x - cx) * sx + (y - cy) * sy; if (t > thr || t < thr - R * 0.4) continue;
      ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, cam.lw * 0.3), 0, Math.PI * 2); ctx.fill(); got++;
    }
  }
  ctx.restore();
}
const cellCache = new Map();
/** One cell of a sprite sheet as a small canvas of its own, kept so it is cut out once. */
function cellCanvas(img, id, cols, rows, idx) {
  const key = `${id}|${cols}x${rows}|${idx}`; const hit = cellCache.get(key); if (hit && hit.src === img) return hit.cv;
  const cw = Math.max(1, Math.floor(img.naturalWidth / cols)); const ch = Math.max(1, Math.floor(img.naturalHeight / rows));
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  cv.getContext('2d').drawImage(img, (idx % cols) * cw, Math.floor(idx / cols) * ch, cw, ch, 0, 0, cw, ch);
  cellCache.set(key, { src: img, cv }); if (cellCache.size > 240) cellCache.delete(cellCache.keys().next().value);
  return cv;
}
/** A picture laid over a part through its UV map, clipped to the part. The cell it shows follows the frame (a sprite sheet plays), and the picture turns with the part. */
function paintSkin(ctx, sh, skin, frame, pivot) {
  const inf = imageInfo(skin.img); if (!inf?.img || !inf.img.naturalWidth || sh.pts.length < 3) return;
  const cell = cellCanvas(inf.img, skin.img, skin.cols, skin.rows, cellFor(skin, frame));
  const fr = partFrame(sh, pivot); const M = fr.spine ? null : skinMatrix(fr, skin, cell.width, cell.height);
  ctx.save(); tracePts(ctx, sh.pts); ctx.clip(); ctx.globalAlpha *= skin.opacity; ctx.globalCompositeOperation = skin.blend || 'source-over';
  if (fr.spine) { // a bent part: the picture is cut into slices across its length, each laid on the curve
    const N = 24; const cw = cell.width; const ch = cell.height; const map = (s, t) => { const [u, v] = cellToUV(skin, s, t); return fromUV(fr, u, v); };
    for (let i = 0; i < N; i++) {
      const s0 = i / N; const s1 = (i + 1) / N; const A = map(s0, 0); const B = map(s1, 0); const C = map(s0, 1); const sx0 = s0 * cw; const sw = (s1 - s0) * cw;
      const a = (B[0] - A[0]) / sw; const b = (B[1] - A[1]) / sw; ctx.save(); ctx.transform(a, b, (C[0] - A[0]) / ch, (C[1] - A[1]) / ch, A[0] - a * sx0, A[1] - b * sx0); ctx.drawImage(cell, sx0, 0, Math.min(sw + 1, cw - sx0), ch, sx0, 0, Math.min(sw + 1, cw - sx0), ch); ctx.restore();
    }
  } else if (skin.fit === 'tile' && typeof DOMMatrix !== 'undefined') { const pat = ctx.createPattern(cell, 'repeat'); pat.setTransform(new DOMMatrix(M)); ctx.fillStyle = pat; const b = boundsOf(sh.pts); ctx.fillRect(b.x0 - 2, b.y0 - 2, b.x1 - b.x0 + 4, b.y1 - b.y0 + 4); }
  else { ctx.transform(M[0], M[1], M[2], M[3], M[4], M[5]); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(cell, 0, 0); }
  ctx.restore();
}
/** The strokes drawn on a part, laid on it through its UV frame so they turn and move with it (and bend with it, if it bends). A stroke's width is a share of the part's size. */
function paintInk(ctx, sh, ink, pivot, frame = 0) {
  if (!ink?.strokes?.length || sh.pts.length < 3) return;
  const fr = partFrame(sh, pivot); paintStrokes(ctx, ink.strokes, (u, v) => fromUV(fr, u, v), (fr.L + fr.W) / 2, frame);
}
/** The dash pattern for the line style, for a line this wide. */
const dashOf = (st, w) => (st.lineDash === 'dashed' ? [w * 4, w * 3] : st.lineDash === 'dotted' ? [0.01, w * 2.4] : []);
const depthK = (st, sh) => (sh.role === 'far' ? 1 - 0.55 * (st.lineDepth || 0) : 1);
/** The drawing styles that show a face (eyes, a mouth) on the head. */
const faceStyle = (st) => st.style === 'mannequin' || st.style === 'outline' || st.style === 'comic' || st.style === 'ink' || st.style === 'pencil' || st.style === 'clay' || st.style === 'lowpoly';
/** The styles drawn as one outline round the whole figure, and how thick that line is against the plain line width. */
const OUTLINED = { outline: 2.2, moebius: 1.7, comic: 3.6, ink: 2.4, clay: 1.8 };
/** The colour a shape is filled with, as a plain hex, whatever the style does to it afterwards. */
const baseHex = (sh, st) => (typeof sh.fill === 'string' && sh.fill[0] === '#' ? sh.fill.slice(0, 7) : sh.role === 'far' ? mixHex(st.fillColor, st.farTint, 0.4) : st.fillColor);
const boundsOf = (pts) => { let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity; let cx = 0; let cy = 0; for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; cx += x; cy += y; } return { x0, y0, x1, y1, cx: cx / pts.length, cy: cy / pts.length, R: Math.hypot(x1 - x0, y1 - y0) / 2 }; };
const lightDir = (st) => { const a = ((st.moebiusLight ?? -135) * Math.PI) / 180; return [Math.cos(a), Math.sin(a)]; }; // toward the light, on the screen
/** Low-poly as a solid: each facet is lit by the way it really faces, in 3D, so the faces turn light and dark as the figure and the camera turn. */
function paintFacets(ctx, sh, cam, st) {
  const [lx, ly] = lightDir(st); const L = [lx, ly, 0.8]; const ll = Math.hypot(...L); const base = baseHex(sh, st);
  ctx.save(); ctx.lineJoin = 'bevel';
  for (const f of sh.facets) {
    const d = (f.n[0] * L[0] + f.n[1] * L[1] + f.n[2] * L[2]) / ll;
    const col = d >= 0 ? mixHex(base, '#ffffff', Math.min(0.6, 0.62 * d)) : mixHex(base, st.lineColor, Math.min(0.55, 0.5 * -d));
    tracePts(ctx, f.pts); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, cam.lw * 0.3); ctx.stroke(); // its own colour on the seam, so no hairline gaps
    ctx.strokeStyle = hexA(mixHex(col, st.lineColor, 0.45), 0.65); ctx.lineWidth = Math.max(0.6, cam.lw * 0.4); ctx.stroke(); // and the crease between facets, a shade darker
  }
  if (sh.facetOutline !== false) { ctx.strokeStyle = sh.role === 'far' ? mixHex(st.lineColor, st.farTint, 0.55) : st.lineColor; ctx.lineWidth = Math.max(0.8, cam.lw * 0.75); tracePts(ctx, sh.pts); ctx.stroke(); }
  ctx.restore();
}
/**
 * Clay: every form is rounded. It is lit from one side, falling smoothly into shade on the other, with a soft highlight, and thin contour lines follow the form inward
 * like the lines of a map, so the roundness reads even in a still.
 */
function paintClay(ctx, sh, cam, st) {
  const b = boundsOf(sh.pts); const [lx, ly] = lightDir(st); const base = baseHex(sh, st); const R = Math.max(2, b.R);
  const g = ctx.createLinearGradient(b.cx + lx * R, b.cy + ly * R, b.cx - lx * R, b.cy - ly * R);
  g.addColorStop(0, mixHex(base, '#ffffff', 0.5)); g.addColorStop(0.45, base); g.addColorStop(1, mixHex(base, st.lineColor, 0.5));
  tracePts(ctx, sh.pts); ctx.fillStyle = g; ctx.fill();
  if (R < 7 * cam.k) return;
  ctx.save(); tracePts(ctx, sh.pts); ctx.clip();
  const hl = ctx.createRadialGradient(b.cx + lx * R * 0.45, b.cy + ly * R * 0.45, 0, b.cx + lx * R * 0.45, b.cy + ly * R * 0.45, R * 0.6); hl.addColorStop(0, 'rgba(255,255,255,0.5)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hl; ctx.fillRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
  ctx.strokeStyle = hexA(st.lineColor, 0.22); ctx.lineWidth = Math.max(0.6, cam.lw * 0.35); ctx.lineJoin = 'round';
  for (const k of [0.74, 0.48]) { tracePts(ctx, sh.pts.map(([x, y]) => [b.cx - lx * R * 0.1 + (x - b.cx) * k, b.cy - ly * R * 0.1 + (y - b.cy) * k])); ctx.stroke(); } // contours, pulled a little toward the shaded side
  ctx.restore();
}
/** Low-poly: the outline is cut down to a few straight edges and the form is built of flat facets fanned from its middle, each one lighter or darker as it faces the light. */
function paintLowPoly(ctx, sh, cam, st) {
  const b = boundsOf(sh.pts); const [lx, ly] = lightDir(st); const base = baseHex(sh, st); const n = sh.pts.length;
  const want = Math.max(5, Math.min(9, Math.round(b.R / (9 * cam.k)) + 4)); const step = Math.max(1, n / want); const P = [];
  for (let i = 0; i < n - 0.5; i += step) P.push(sh.pts[Math.floor(i)]);
  ctx.save(); ctx.lineJoin = 'bevel'; ctx.lineWidth = Math.max(0.6, cam.lw * 0.45);
  for (let i = 0; i < P.length; i++) {
    const a = P[i]; const c = P[(i + 1) % P.length]; const mx = (a[0] + c[0]) / 2 - b.cx; const my = (a[1] + c[1]) / 2 - b.cy; const ml = Math.hypot(mx, my) || 1;
    const lit = (mx / ml) * lx + (my / ml) * ly; // 1 facing the light, -1 facing away
    const col = lit >= 0 ? mixHex(base, '#ffffff', 0.42 * lit) : mixHex(base, st.lineColor, 0.42 * -lit);
    ctx.beginPath(); ctx.moveTo(b.cx, b.cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(c[0], c[1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.stroke(); // its own colour on the seams, so no hairline gaps
  }
  ctx.strokeStyle = sh.role === 'far' ? mixHex(st.lineColor, st.farTint, 0.55) : st.lineColor; ctx.lineWidth = Math.max(0.8, cam.lw * 0.7); tracePts(ctx, P); ctx.stroke();
  ctx.restore();
}
/** Blocks: the form is built of square blocks on a grid fixed to the page, like voxels seen from the side or pixel art, with the blocks on the shaded edge darker and the lit edge lighter. */
function paintBlocks(ctx, sh, cam, st) {
  const b = boundsOf(sh.pts); const [lx, ly] = lightDir(st); const base = baseHex(sh, st); const s = Math.max(2, Math.round((st.blockSize ?? 7) * cam.k)); const pts = sh.pts; const n = pts.length;
  const inside = (x, y) => { let c = false; for (let i = 0, j = n - 1; i < n; j = i++) { const [xi, yi] = pts[i]; const [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  const gx0 = Math.floor(b.x0 / s) * s; const gy0 = Math.floor(b.y0 / s) * s; const lit = mixHex(base, '#ffffff', 0.38); const dark = mixHex(base, st.lineColor, 0.45); const edge = hexA(st.lineColor, 0.28);
  let drew = false;
  for (let y = gy0; y <= b.y1; y += s) for (let x = gx0; x <= b.x1; x += s) {
    if (!inside(x + s / 2, y + s / 2)) continue; drew = true;
    const toLight = inside(x + s / 2 + lx * s, y + s / 2 + ly * s); const toShade = inside(x + s / 2 - lx * s, y + s / 2 - ly * s);
    ctx.fillStyle = !toLight ? lit : !toShade ? dark : base; ctx.fillRect(x, y, s, s);
    ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
  }
  if (!drew) { tracePts(ctx, pts); ctx.fillStyle = base; ctx.fill(); } // too small for one block: keep it there as a dab of its colour
}
/** A shape's outline with each point nudged a little, the same way every frame (seeded by the part), for a hand-drawn line. */
function roughPts(pts, amp, key) { const r = rng(key); return pts.map(([x, y]) => [x + (r() - 0.5) * 2 * amp, y + (r() - 0.5) * 2 * amp]); }
const tracePts = (ctx, pts) => { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); };
/** Comic book shading: a field of dots on the side away from the light, bigger the deeper into the shadow, clipped to the shape. */
function dotShade(ctx, pts, st, cam, color) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const cx = (x0 + x1) / 2; const cy = (y0 + y1) / 2; const R = Math.hypot(x1 - x0, y1 - y0) / 2; if (R < 6 * cam.k) return;
  const la = ((st.moebiusLight ?? -135) * Math.PI) / 180; const sx = -Math.cos(la); const sy = -Math.sin(la);
  const reach = Math.max(0, Math.min(1, st.moebiusShade ?? 0.5)); const thr = R * (0.6 - 1.1 * reach); const sp = Math.max(3, 5.5 * cam.k);
  ctx.save(); tracePts(ctx, pts); ctx.clip(); ctx.fillStyle = color; ctx.beginPath();
  const gx0 = Math.floor(x0 / sp) * sp; const gy0 = Math.floor(y0 / sp) * sp; // the dots sit on a grid fixed to the page, as printed dots do
  for (let y = gy0, row = 0; y <= y1; y += sp * 0.866, row++) for (let x = gx0 + (row % 2 ? sp / 2 : 0); x <= x1; x += sp) {
    const t = (x - cx) * sx + (y - cy) * sy - thr; if (t <= 0) continue;
    const r = sp * 0.42 * Math.min(1, 0.35 + t / (R * 0.9)); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  ctx.fill(); ctx.restore();
}
function paintShape(ctx, sh, cam, st, ghost) {
  if (sh.pts.length < 3) return;
  if (sh.lineColor) st = { ...st, lineColor: sh.lineColor };
  const far = sh.role === 'far';
  ctx.beginPath();
  sh.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
  ctx.closePath();
  if (st.style === 'silhouette' && !ghost) { ctx.fillStyle = st.lineColor; ctx.fill(); return; }
  // Outline: the whole figure's edge was already drawn in a first pass, so this fill covers every line inside it.
  if (st.style === 'moebius' && !ghost) { // flat soft colour, then the hatching
    ctx.fillStyle = sh.fill ?? (far ? mixHex(st.fillColor, st.farTint, 0.4) : hexA(st.fillColor, 1)); ctx.fill();
    hatchShape(ctx, sh.pts, st, cam, `${sh.part}${sh.side}`); return;
  }
  if ((st.style === 'outline' || st.style === 'ink') && !ghost) { ctx.fillStyle = sh.fill ?? (far ? mixHex(st.fillColor, st.farTint, 0.4) : hexA(st.fillColor, 1)); ctx.fill(); return; }
  if (st.style === 'clay' && !ghost) { paintClay(ctx, sh, cam, st); return; }
  if (st.style === 'lowpoly' && !ghost) { if (sh.facets) paintFacets(ctx, sh, cam, st); else paintLowPoly(ctx, sh, cam, st); return; }
  if (st.style === 'blocks' && !ghost) { paintBlocks(ctx, sh, cam, st); return; }
  if (st.style === 'comic' && !ghost) { // flat colour inside a heavy line, with printed dots for the shadow
    const flat = sh.fill ?? (far ? mixHex(st.fillColor, st.farTint, 0.45) : hexA(st.fillColor, 1)); ctx.fillStyle = flat; ctx.fill();
    dotShade(ctx, sh.pts, st, cam, mixHex(typeof flat === 'string' && flat[0] === '#' ? flat.slice(0, 7) : st.fillColor, st.lineColor, 0.42)); return;
  }
  if (st.style === 'pencil' && !ghost) { // a pale wash, a little hatching, and the outline gone over three times, never quite in the same place
    ctx.fillStyle = hexA(sh.fill && sh.fill[0] === '#' ? sh.fill.slice(0, 7) : far ? mixHex(st.fillColor, st.farTint, 0.4) : st.fillColor, 0.55); ctx.fill();
    ctx.save(); ctx.globalAlpha = 0.45; hatchShape(ctx, sh.pts, { ...st, moebiusStipple: 0, moebiusDensity: (st.moebiusDensity ?? 4.5) * 1.3 }, cam, `${sh.part}${sh.side}`); ctx.restore();
    ctx.save(); ctx.strokeStyle = hexA(st.lineColor, 0.5); ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(0.7, cam.lw * 0.5);
    for (let i = 0; i < 3; i++) { tracePts(ctx, roughPts(sh.pts, cam.lw * 0.55, `${sh.part}${sh.side}${(sh.depth ?? 0).toFixed(5)}p${i}`)); ctx.stroke(); }
    ctx.restore(); return;
  }
  if (st.style === 'mannequin') {
    ctx.fillStyle = ghost ? hexA(ghost, 0.1) : sh.fill ?? (far ? hexA(st.farTint, st.farOpacity * 0.55) : hexA(st.fillColor, st.fillOpacity));
    ctx.fill();
  }
  ctx.strokeStyle = ghost || (far && !sh.fill ? st.farTint : st.lineColor);
  ctx.lineWidth = cam.lw * (sh.lw || 1) * (sh.lwK ?? 1) * depthK(st, sh); ctx.lineJoin = st.lineJoin || 'round'; if (st.lineDash && st.lineDash !== 'solid') { ctx.lineCap = 'round'; ctx.setLineDash(dashOf(st, ctx.lineWidth)); }
  ctx.stroke(); ctx.setLineDash([]);
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
    // each figure can have its own colours; one with none set uses the ones in the View tab
    const st2 = a.fill || a.line || a.tint ? { ...st, ...(a.fill ? { fillColor: a.fill, hoseBody: a.fill, hoseShorts: a.fill } : {}), ...(a.line ? { lineColor: a.line } : {}), ...(a.tint ? { farTint: a.tint } : {}) } : st;
    out.push({ d: cA.p([pzA.pelvisX, 0, 0]).d, paint: () => {
      if (hasGround(st) && !a.noShadow) paintGroundShadow(ctx, cA.p, st, cam.k, [pzA.pelvisX + (dogA ? (pzA.pelvis[0] + pzA.j3[0]) / 2 : 0.05), 0, 0], dogA ? Math.abs(pzA.j3[0] - pzA.pelvis[0]) / 2 + 0.22 : 0.27, dogA ? 0.13 : 0.15, 1);
      const fo = { design: a.design || null, skinFrame: env.frame ?? 0, wantFrames: env.wantFrames };
      const r = hasDrop(st) && !a.noShadow ? castShadow(ctx, stageDrop(st), cam.k, (c) => drawFigureShapes(c, pzA, cA, st2, fo)) : drawFigureShapes(ctx, pzA, cA, st2, fo);
      hits.push({ id: a.id, shapes: r.shapes || [], frames: r.frames || null });
    } });
  }
  for (const q0 of sc.props || []) {
    if (!q0.visible) continue;
    const q = movedProp(q0, env.frame ?? 0, params.fps || 24); // dropped or pushed over: where it has got to by this frame
    out.push({ d: cam.p([q.x, 0, q.z]).d, paint: () => {
      if (hasGround(st) && !q.noShadow && q.kind !== 'image') paintGroundShadow(ctx, cam.p, st, cam.k, [q.x, q.y > 0 ? 0 : q.y, q.z], Math.max(0.08, q.w * 0.62), Math.max(0.06, (q.kind === 'box' ? q.d : q.w) * 0.55), 1 / (1 + 3.5 * Math.max(0, q.y)));
      hits.push({ id: q.id, shapes: paintProp(ctx, q, cam, st).map((pts) => ({ pts, part: 'prop', side: null })) }); } });
  }
  void pz;
  return out.sort((a, b) => a.d - b.d);
}
/** A prop: its faces and balls, back to front, lit from above and the side. */
/** A small repeatable random number generator, so a line-drawn tree is the same every frame. */
const rng = (id) => { let h = 2166136261; for (let i = 0; i < String(id).length; i++) { h ^= String(id).charCodeAt(i); h = Math.imul(h, 16777619); } return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; }; };
/** A picture standing on the ground: its four corners, mapped from the picture with one affine step (the camera does not bend straight lines). */
function paintImageProp(ctx, im, cam, st) {
  const c = im.corners.map((w) => cam.p(w)); const info = imageInfo(im.img); const poly = c.map((p) => [p.x, p.y]);
  ctx.save();
  if (info) {
    const iw = info.img.naturalWidth; const ih = info.img.naturalHeight;
    ctx.setTransform(...(() => { const m = ctx.getTransform(); const q = [(c[2].x - c[3].x) / iw, (c[2].y - c[3].y) / iw, (c[0].x - c[3].x) / ih, (c[0].y - c[3].y) / ih, c[3].x, c[3].y]; return [m.a * q[0] + m.c * q[1], m.b * q[0] + m.d * q[1], m.a * q[2] + m.c * q[3], m.b * q[2] + m.d * q[3], m.a * q[4] + m.c * q[5] + m.e, m.b * q[4] + m.d * q[5] + m.f]; })());
    ctx.drawImage(info.img, 0, 0);
  } else { ctx.strokeStyle = st.lineColor; ctx.lineWidth = cam.lw; ctx.beginPath(); c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); ctx.moveTo(c[0].x, c[0].y); ctx.lineTo(c[2].x, c[2].y); ctx.moveTo(c[1].x, c[1].y); ctx.lineTo(c[3].x, c[3].y); ctx.stroke(); }
  ctx.restore();
  return [poly];
}
/**
 * A tree, a pine or a bush drawn as line work, the way the figure is: a thick outline round the whole shape with the fill laid over the inside lines, so only the outer edge shows, then a few strokes for
 * the bark and the leaves. It follows the figure's style (an outline, bare lines, or a solid shape) and is the same every frame. It always faces the camera, as a drawing does.
 */
function paintLineProp(ctx, L, cam, st) {
  const B = cam.p(L.base); const s = cam.scale; const H = L.h * s; const W = Math.max(L.w * s, 4);
  const rand = rng(L.id); const shapes = []; const marks = []; let x0 = B.x; let x1 = B.x; let y0 = B.y; let y1 = B.y;
  const grow = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
  const circle = (cx, cy, r, fill) => { shapes.push({ fill, draw: () => ctx.arc(cx, cy, r, 0, TAU) }); grow(cx - r, cy - r); grow(cx + r, cy + r); };
  const poly = (pts, fill) => { shapes.push({ fill, draw: () => pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))) }); pts.forEach(([x, y]) => grow(x, y)); };
  const leaf = hexA(L.color, 1); const lit = mixHex(L.color, '#ffffff', 0.55); const wood = st.fillColor;
  const trunk = (h0, h1, wBase, wTop) => { // a trunk from the ground to h1 of the height, a little wider at the foot
    const top = B.y - H * h1; const sway = (rand() - 0.5) * W * 0.3;
    poly([[B.x - wBase / 2, B.y], [B.x - wBase * 0.34, B.y - H * h0], [B.x - wTop / 2 + sway, top], [B.x + wTop / 2 + sway, top], [B.x + wBase * 0.34, B.y - H * h0], [B.x + wBase / 2, B.y]], wood);
    for (let i = 0; i < 3; i++) { const y = B.y - H * (0.06 + 0.5 * h1 * rand()); const dx = (rand() - 0.5) * wBase * 0.4; marks.push([B.x + dx, y, B.x + dx * 0.7, y - H * 0.06]); }
  };
  if (L.kind === 'ltree') {
    trunk(0.3, 0.55, W, W * 0.62);
    const cx = B.x; const cy = B.y - H * 0.74; const R = H * 0.2;
    circle(cx, cy, R * 1.1, lit);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + rand() * 0.6; const d = R * (0.75 + 0.3 * rand()); circle(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, R * (0.6 + 0.25 * rand()), lit); }
    for (let i = 0; i < 7; i++) { const a = rand() * TAU; const d = R * 1.1 * Math.sqrt(rand()); const lx = cx + Math.cos(a) * d; const ly = cy + Math.sin(a) * d * 0.85; marks.push([lx - R * 0.12, ly, lx + R * 0.12, ly - R * 0.08, 'leaf']); }
  } else if (L.kind === 'lpine') {
    trunk(0.12, 0.2, W * 0.8, W * 0.55);
    const tiers = 4;
    for (let t = 0; t < tiers; t++) { // from the bottom tier up; each is a triangle with a toothed foot
      const base = 0.16 + t * 0.19; const apex = base + 0.34 - t * 0.02; const half = H * 0.2 * (1 - t * 0.2);
      const yb = B.y - H * base; const ya = B.y - H * apex; const teeth = 4;
      const pts = [[B.x, ya]]; for (let k = 0; k <= teeth; k++) { pts.push([B.x + half - (2 * half * k) / teeth, yb + (k % 2 ? 0 : H * 0.018)]); }
      poly(pts, lit);
      marks.push([B.x - half * 0.3, yb - H * 0.05, B.x + half * 0.1, yb - H * 0.1, 'leaf']);
    }
  } else { // a bush
    const R = H * 0.5; const n = 4;
    for (let i = 0; i < n; i++) { const dx = (i / (n - 1) - 0.5) * W * 1.1 * (0.9 + 0.2 * rand()); circle(B.x + dx, B.y - R * (0.55 + 0.35 * Math.sin((i / (n - 1)) * Math.PI)), R * (0.6 + 0.2 * rand()), lit); }
    for (let i = 0; i < 5; i++) { const lx = B.x + (rand() - 0.5) * W; const ly = B.y - R * (0.3 + 0.7 * rand()); marks.push([lx - R * 0.12, ly, lx + R * 0.12, ly - R * 0.08, 'leaf']); }
  }
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const trace = (sh) => { ctx.beginPath(); sh.draw(); ctx.closePath(); };
  const style = st.style;
  if (style === 'stick') { ctx.strokeStyle = st.lineColor; ctx.lineWidth = cam.lw * 1.1; for (const sh of shapes) { trace(sh); ctx.stroke(); } }
  else {
    ctx.strokeStyle = st.lineColor; ctx.lineWidth = cam.lw * 2.2; for (const sh of shapes) { trace(sh); ctx.stroke(); }
    for (const sh of shapes) { trace(sh); ctx.fillStyle = style === 'silhouette' ? st.lineColor : sh.fill; ctx.fill(); }
  }
  if (style !== 'silhouette') { ctx.strokeStyle = st.lineColor; ctx.lineWidth = cam.lw * 0.8; ctx.beginPath(); for (const m of marks) { ctx.moveTo(m[0], m[1]); if (m[4] === 'leaf') ctx.quadraticCurveTo((m[0] + m[2]) / 2, m[3] - 2 * cam.k, m[2], m[3]); else ctx.lineTo(m[2], m[3]); } ctx.stroke(); }
  ctx.restore(); void leaf;
  return [[[x0, y0], [x1, y0], [x1, y1], [x0, y1]]];
}

function paintProp(ctx, q, cam, st) {
  const { faces, balls, shade, image, line } = propParts(q);
  if (image) return paintImageProp(ctx, image, cam, st);
  if (line) return paintLineProp(ctx, line, cam, st);
  const parts = [];
  for (const f of faces) { const pts = f.pts.map((w) => cam.p(w)); parts.push({ d: pts.reduce((t, p) => t + p.d, 0) / pts.length, face: f, pts }); }
  for (const b of balls) { const c = cam.p(b.c); parts.push({ d: c.d, ball: b, c }); }
  parts.sort((a, b) => a.d - b.d);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = cam.lw * 0.7; ctx.strokeStyle = st.lineColor;
  const polys = []; // where it is on the screen, so it can be tapped and dragged
  for (const p of parts) {
    if (p.face) { polys.push(p.pts.map((s) => [s.x, s.y])); ctx.beginPath(); p.pts.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y))); ctx.closePath(); ctx.fillStyle = shade(p.face.color, faceLight(p.face.normal)); ctx.fill(); ctx.stroke(); }
    else {
      const r = p.ball.r * cam.scale; const ry = (p.ball.ry ?? p.ball.r) * cam.scale;
      polys.push(Array.from({ length: 16 }, (_, i) => [p.c.x + r * Math.cos((i / 16) * TAU), p.c.y + ry * Math.sin((i / 16) * TAU)]));
      const g = ctx.createRadialGradient(p.c.x - r * 0.35, p.c.y - ry * 0.4, r * 0.1, p.c.x, p.c.y, Math.max(r, ry));
      g.addColorStop(0, shade(p.ball.color, 1.25)); g.addColorStop(1, shade(p.ball.color, 0.72));
      ctx.beginPath(); ctx.ellipse(p.c.x, p.c.y, r, ry, 0, 0, TAU); ctx.fillStyle = g; ctx.fill(); ctx.stroke();
    }
  }
  ctx.restore();
  return polys;
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
  paintMouth(ctx, id, surf, mouthOptions(st, cam.lw * 0.85));
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
  const built = pz.legs ? buildDogShapes(pz, cam, st) : hose ? buildHoseShapes(pz, cam, st) : buildShapes(pz, cam, st);
  const { face } = built; let shapes = built.shapes;
  if (st.style === 'clay' && !ghost) shapes = shapes.map((sh) => (sh.pts.length < 4 ? sh : { ...sh, pts: clayOutline(sh.pts, `${sh.part}${sh.side}`, cam.k, 1) })); // rounded, lumpy edges that stay with the shape
  if (opts.design && !ghost) { // each part's own colour, line and skin
    shapes = shapes.map((sh) => { const dz = sh.attach ? null : opts.design[partKey(sh.part, sh.side)]; if (!dz) return sh; return { ...sh, dz, ...(dz.fill ? { fill: dz.fill } : {}), ...(dz.line ? { lineColor: dz.line } : {}), lwK: dz.lineW, hidden: dz.visible === false }; });
  }
  const frames = opts.wantFrames ? {} : null;
  if (st.lineBoil > 0 && !ghost) { // a new wobble every few frames: the outline, and the colour with it, never quite where it was
    const step = Math.floor((opts.skinFrame ?? 0) / Math.max(1, Math.round(st.boilRate || 1))); const lump = Math.min(1, st.lineBoil / 5);
    shapes = shapes.map((sh) => (sh.pts.length < 4 || sh.facets ? sh : { ...sh, pts: clayOutline(sh.pts, `${sh.part}${sh.side}~${step}`, cam.k, lump) }));
  }
  // Attachments take their part's depth, a hair in front of it or behind it, so they sort with the body and with each other.
  const placed = opts.attach?.length && !ghost ? placeItems(opts.attach, pz, cam) : [];
  if (placed.length) shapes = [...shapes, ...placed.map(({ it, f }) => ({ attach: it, frame: f, depth: f.depth + (DEPTH_OFF[it.depth] ?? 0.0006), part: null, side: it.side, role: f.role, pts: [] }))].sort((a, b) => a.depth - b.depth);
  if (OUTLINED[st.style] && !ghost) {
    // First pass: every limb and the body, stroked twice as thick. The fills that follow leave only the outer edge, so arms, legs and body read as one outline with no lines crossing inside.
    ctx.save(); ctx.lineWidth = cam.lw * OUTLINED[st.style]; ctx.lineJoin = st.lineJoin || 'round'; const rough = st.style === 'ink'; const dashed = st.lineDash && st.lineDash !== 'solid'; if (dashed) ctx.lineCap = 'round';
    for (const sh of shapes) {
      ctx.strokeStyle = sh.role === 'far' && !sh.fill ? mixHex(st.lineColor, st.farTint, 0.55) : st.lineColor;
      if (!rough) { ctx.lineWidth = cam.lw * OUTLINED[st.style] * depthK(st, sh); if (dashed) ctx.setLineDash(dashOf(st, ctx.lineWidth)); }
      if (sh.hidden || sh.dz?.ink?.replace) continue;
      if (sh.lineColor) ctx.strokeStyle = sh.lineColor; if (sh.lwK != null && !rough) ctx.lineWidth *= sh.lwK;
      if (sh.attach || sh.pts.length < 3 || (!ghost && coveredByPicture(sh, st, opts.attach)) || (sh.role === 'far' && !parts.far) || (sh.role === 'near' && !parts.near) || (sh.role === 'body' && !parts.body)) continue;
      if (rough) { // a brush line: two passes that do not quite agree, so the line swells and thins along its length
        const key = `${sh.part}${sh.side}`; ctx.lineWidth = cam.lw * 2.8; tracePts(ctx, roughPts(sh.pts, cam.lw * 0.5, `${key}a`)); ctx.stroke(); ctx.lineWidth = cam.lw * 1.5; tracePts(ctx, roughPts(sh.pts, cam.lw * 0.9, `${key}b`)); ctx.stroke(); continue;
      }
      ctx.beginPath(); sh.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
  }
  for (const sh of shapes) {
    if ((sh.role === 'far' && !parts.far) || (sh.role === 'near' && !parts.near) || (sh.role === 'body' && !parts.body)) continue;
    if (sh.attach) { paintItem(ctx, sh.attach, sh.frame, cam, null, opts.skinFrame ?? 0); continue; }
    if (!ghost && coveredByPicture(sh, st, opts.attach)) continue;
    if (frames && sh.part && sh.pts.length >= 3) { const k = partKey(sh.part, sh.side); (frames[k] ||= []).push({ pts: sh.pts, fr: partFrame(sh, pivotOf(pz, cam, sh.part, sh.side)) }); }
    if (sh.hidden) continue;
    const paintBody = (c) => {
      c.save(); if (sh.dz && sh.dz.opacity < 1) c.globalAlpha *= sh.dz.opacity;
      if (sh.dz?.ink?.replace && !ghost) { /* the drawing stands in for the part */ } else if (st.lineOffset && !ghost && OUTLINED[st.style]) { c.save(); c.translate(st.lineOffset * cam.k, st.lineOffset * cam.k * 0.7); paintShape(c, sh, cam, st, ghost); c.restore(); } else paintShape(c, sh, cam, st, ghost);
      if (sh.dz?.skin && !ghost) paintSkin(c, sh, sh.dz.skin, opts.skinFrame ?? 0, pivotOf(pz, cam, sh.part, sh.side));
      if (sh.dz?.ink && !ghost) paintInk(c, sh, sh.dz.ink, pivotOf(pz, cam, sh.part, sh.side), opts.skinFrame ?? 0);
      c.restore();
    };
    if (sh.dz?.shadow?.on && !ghost) castShadow(ctx, sh.dz.shadow, cam.k, paintBody); else paintBody(ctx);
    const drawnOver = sh.dz?.ink?.replace; // a head the user has drawn takes no stock face
    if (sh.face && !ghost && !drawnOver && faceStyle(st)) paintHoseFace(ctx, pz, cam, st, opts.mouth);
    const faceOn = sh.part === 'head' && !hose && !ghost && !drawnOver && faceStyle(st);
    if (faceOn && (opts.mouth || st.mouthShow === 'always')) paintHeadMouth(ctx, pz, cam, st, opts.mouth || 'rest');
    let ownEyes = true;
    if (faceOn && (st.eyeStyle !== 'default' || st.browStyle !== 'none')) { // eyes and eyebrows of a chosen style, on the front of the head
      const map = headMap(pz, cam);
      if (map([0, 0]).d > cam.p([pz.headC[0] + pz.pelvisX, pz.headC[1], pz.headC[2]]).d) { const fo = { base: EYE_BASE.mannequin, lw: cam.lw * 0.9, line: st.lineColor, skin: st.fillColor, u: pz.u }; ownEyes = !paintEyes(ctx, map, st, fo); paintBrows(ctx, map, st, fo); }
      else ownEyes = st.eyeStyle === 'default';
    }
    if ((sh.part === 'head' || sh.part === 'dog.head') && !hose && !drawnOver && faceStyle(st) && !ghost) {
      ctx.strokeStyle = st.lineColor; ctx.fillStyle = st.lineColor; ctx.lineWidth = cam.lw * 0.9;
      for (const e of ownEyes ? face.eyes : []) { ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1.5, cam.lw * 0.9, 0.05 * pz.headR * cam.scale), 0, TAU); ctx.fill(); }
      if (face.dot) { ctx.beginPath(); ctx.arc(face.dot.x, face.dot.y, Math.max(2, cam.lw * 1.4), 0, TAU); ctx.fill(); }
      if (face.nose) { ctx.beginPath(); ctx.moveTo(face.noseBase.x, face.noseBase.y); ctx.lineTo(face.nose.x, face.nose.y); ctx.stroke(); }
    }
  }
  ctx.restore();
  return { shapes, placed, frames };
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
  for (let i = shapes.length - 1; i >= 0; i--) if (!shapes[i].hidden && inside(shapes[i].pts)) return { part: shapes[i].part, side: shapes[i].side };
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
  const terrain = params.terrain && params.terrain !== 'flat' && !(dog && (params.dogFlight || 0) > 0.5);
  const gyf = terrain ? (x) => groundAt(params, x) : () => 0; // the height of the ground
  const poser = dog ? poseDog : pose3;
  const perf = params.perf || null;
  const perfLooped = Boolean(perf && perf.T > 1 && perf.x[perf.T] > 0.01 && Math.abs(perf.u[perf.T] - Math.round(perf.u[perf.T])) < 1e-6); // the performance ends where it began
  const ex = Math.max(1, params.exposure ?? 1);
  const t0 = perf ? Math.min(perf.T - 1, Math.floor(frame / ex) * ex) : 0;
  const valuesAt = (t) => perf ? { p: paramsAt(params, perf.lanes, t, perf.live), m: motionAt(params.motion || {}, perf.lanes, t, perf.live) } : { p: params, m: params.motion || {} };
  const poseAt = (t) => { const v = valuesAt(t); return poser(v.p, v.m, perf ? perf.u[t] : phaseFor(params, frame).u, perf ? { worldX: perf.x[t], freeU: t / Math.max(2, Math.round(params.cycleFrames)) } : null); };
  const ph = perf ? { u: perf.u[t0], drawing: Math.floor(t0 / ex) + 1, drawings: Math.ceil(perf.T / ex), step: ex / params.cycleFrames } : phaseFor(params, frame);
  const motion = perf ? valuesAt(t0).m : (params.motion || {});
  const pz = poseAt(t0);
  const sp = perf ? valuesAt(t0).p : params;
  const step = dog ? sp.dogStride / 2 : sp.stepLength;
  const bodyTarget = [perf ? (params.travel === 'across' ? (perf.x[0] + perf.x[perf.T]) / 2 : pz.pelvisX + (dog ? (pz.centreX ?? 0.45) : 0)) : (params.travel === 'across' ? step : pz.pelvisX + (dog ? (pz.centreX ?? 0.45) : 0)), dog ? speciesOf(params).view.y + Math.min(1, params.dogFlight || 0) * (params.dogFlightHeight ?? 0) * 0.85 : 0.9, 0];
  bodyTarget[1] += gyf(bodyTarget[0]);
  // The head view looks at the face: the camera is centred on the head and zoomed in, and still orbits around it.
  const headView = st.focus === 'head' && !dog;
  // Heading and path: the figure faces a direction and walks along it; with a heading lane the path curves. Its points are turned and moved to that place on the ground.
  const hDeg = sp.heading || 0; const pathOn = hDeg !== 0 || Boolean(perf?.path);
  const hRad = (hDeg * Math.PI) / 180; const ch = Math.cos(hRad); const sh = Math.sin(hRad);
  const Pw = perf ? [perf.px[t0], perf.pz[t0]] : [pz.pelvisX * ch, pz.pelvisX * sh];
  const toWorld = pathOn ? (pt) => { const lx = pt[0] - pz.pelvisX; return [Pw[0] + lx * ch - pt[2] * sh, pt[1], Pw[1] + lx * sh + pt[2] * ch]; } : (pt) => pt;
  if (pathOn) { const across = params.travel === 'across' && perf; const c = toWorld([pz.pelvisX + (dog ? (pz.centreX ?? 0.45) : 0), 0, 0]); bodyTarget[0] = across ? (perf.px[0] + perf.px[perf.T]) / 2 : c[0]; bodyTarget[2] = across ? (perf.pz[0] + perf.pz[perf.T]) / 2 : c[2]; }
  const target = headView ? toWorld([pz.headC[0] + pz.pelvisX, pz.headC[1], pz.headC[2]]) : bodyTarget;
  const mouthId = dog ? null : (opts.mouth ?? speechAt(params.speech, perf ? t0 : frame) ?? (headView ? 'rest' : null));
  const cam = makeCam(st, w, h, target, opts.yawOffset || 0, headView ? st.headZoom : dog ? speciesOf(params).view.zoom / (1 + 0.15 * Math.min(1, params.dogFlight || 0)) : 1, headView);
  const camF = pathOn ? { ...cam, p: (pt) => cam.p(toWorld(pt)) } : cam; // the camera for the figure, whose points are in its own frame
  const zc = target[2]; // the ground is drawn about where the figure is
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
  if (!transparent) { ctx.fillStyle = st.style === 'moebius' && st.moebiusPaper ? '#f2ead6' : st.background; ctx.fillRect(0, 0, w, h); }
  // A picture to line the figure up with goes under everything else: the stage passes it in, and an export can too.
  opts.under?.(ctx, w, h, cam);

  const arcDots = [];
  if (layers.guides) {
    const line = (a, b) => { const A = cam.p(a); const B = cam.p(b); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); };
    if (st.showGround && !headView) {
      const x0 = target[0] - 5; const x1 = target[0] + 5;
      ctx.strokeStyle = hexA(st.guideColor, 0.75); ctx.lineWidth = cam.lw * 0.8;
      const dx = terrain ? 0.04 : x1 - x0;
      const run = (z) => { for (let x = x0; x <= x1 + 1e-9; x += dx) { const A = cam.p([x, gyf(x), z + zc]); if (x === x0) ctx.moveTo(A.x, A.y); else ctx.lineTo(A.x, A.y); } };
      if (terrain) { // the ground is a solid, so a slope or a flight of steps reads as something to stand on
        ctx.fillStyle = hexA(st.guideColor, 0.12); ctx.beginPath(); run(0);
        const e1 = cam.p([x1, -0.4, zc]); const e0 = cam.p([x0, -0.4, zc]); ctx.lineTo(e1.x, e1.y); ctx.lineTo(e0.x, e0.y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = hexA(st.guideColor, 0.75); ctx.lineWidth = cam.lw * 0.8;
      }
      ctx.beginPath(); run(0); ctx.stroke();
      ctx.strokeStyle = hexA(st.guideColor, 0.28);
      ctx.beginPath();
      if (terrain) for (const z of [-0.6, -0.3, 0.3, 0.6]) run(z); else for (const z of [-0.6, -0.3, 0.3, 0.6]) line([x0, 0, z + zc], [x1, 0, z + zc]);
      let half = step / 2;
      if (perfLooped) { const nT = Math.max(1, Math.round(perf.x[perf.T] / half)); half = perf.x[perf.T] / nT; } // the grid divides the distance walked, so it repeats at the loop join
      const first = Math.floor(x0 / half) * half;
      for (let x = first; x < x1; x += half) line([x, gyf(x), -0.6 + zc], [x, gyf(x), 0.6 + zc]);
      ctx.stroke();
      ctx.strokeStyle = hexA(st.guideColor, 0.75);
      ctx.beginPath();
      for (let x = first; x < x1; x += half) { const A = cam.p([x, gyf(x), zc]); ctx.moveTo(A.x, A.y); ctx.lineTo(A.x, A.y + 11 * cam.k); }
      ctx.stroke();
    }
    if (headView || pathOn) { /* no ground in the head view, and no footprints while the path bends */ } else if (st.showFootprints && dog) {
      ctx.fillStyle = hexA(st.guideColor, 0.38);
      for (const pl of perf ? perf.plants : dogPrints(params, target[0] - 4, target[0] + 4)) {
        if (Math.abs(pl.x - target[0]) > 4) continue;
        const q = [[pl.x - 0.05, pl.z - 0.035], [pl.x + 0.12, pl.z - 0.035], [pl.x + 0.12, pl.z + 0.035], [pl.x - 0.05, pl.z + 0.035]].map(([x, zz]) => cam.p([x, gyf(pl.x), zz]));
        ctx.beginPath(); q.forEach((pt, i) => (i ? ctx.lineTo(pt.x, pt.y) : ctx.moveTo(pt.x, pt.y))); ctx.closePath(); ctx.fill();
      }
    } else if (st.showFootprints && perf) {
      ctx.fillStyle = hexA(st.guideColor, 0.38);
      const z0 = params.stepWidth ?? 0.075;
      const total = perfLooped ? perf.x[perf.T] : 0;
      for (const lap of perfLooped ? [-1, 0, 1] : [0]) for (const pl of perf.plants) { // a looped walk repeats, so the footprints on either side of it are the same
        const px = pl.x + lap * total;
        if (Math.abs(px - target[0]) > 4) continue;
        const z = pl.side === 'R' ? z0 : -z0;
        const q = [[px - 0.07, z - 0.045], [px + 0.26, z - 0.045], [px + 0.26, z + 0.045], [px - 0.07, z + 0.045]].map(([x, zz]) => cam.p([x, gyf(px), zz]));
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
          const pts = sim.frames.map((s) => { const nd = s.nodes[which === 'tip' ? s.nodes.length - 1 : Math.floor(s.nodes.length / 2)]; return camF.p([s.root[0] + nd[0] + arcOffsetX(params, { pelvisX: s.pelvisX }, pz), s.root[1] + nd[1], s.root[2]]); });
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
        const col = arcColor(dog ? 'dog' : 'human', d.id); const pts = paths.get(d.id).map((s) => ({ frame: s.frame, ...camF.p(s.p) }));
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

  let figFrames = null; let shapes = []; let placedAttach = []; let handles = null; let fixHandle = null; const sceneHits = [];
  const sceneItems = !opts.parts && !headView && st.showScene !== false && (params.scene?.actors?.length || params.scene?.props?.length) ? sceneDrawables(ctx, params, st, cam, { ph, perf, t0, sp, pz, hits: sceneHits, frame: perf ? t0 : frame, wantFrames: opts.wantFrames }) : [];
  const dMain = camF.p([pz.pelvisX, 0, 0]).d;
  if (layers.figure) {
    for (const it of sceneItems) if (it.d < dMain) it.paint();
    if (st.showOnion && opts.onion !== false) {
      const ghostStyle = { ...st, style: st.style === 'silhouette' ? 'stick' : st.style };
      const ghost = (k) => (perf ? poseAt(Math.min(perf.T - 1, Math.max(0, t0 + k * ex))) : poser(params, motion, ph.u + k * ph.step, { worldX: pz.pelvisX + k * ph.step * strideOf(pz.params ?? params) })); // a ghost over the loop join stays beside the figure instead of a stride away
      for (let k = st.onionBefore; k >= 1; k--) drawFigureShapes(ctx, ghost(-k), camF, ghostStyle, { tint: st.onionBeforeTint, alpha: st.onionOpacity * Math.pow(0.7, k - 1) });
      for (let k = st.onionAfter; k >= 1; k--) drawFigureShapes(ctx, ghost(k), camF, ghostStyle, { tint: st.onionAfterTint, alpha: st.onionOpacity * Math.pow(0.7, k - 1) });
    }
    if (hasGround(st) && !headView && !opts.parts) { // the oval on the floor, fainter as the feet leave it
      const gy = gyf(pz.pelvisX); const feet = pz.legs ? Object.values(pz.legs).map((l) => l.paw?.[1] ?? 0) : [pz.sides.R.ankle[1], pz.sides.L.ankle[1]]; const lift = Math.max(0, Math.min(...feet) - (pz.legs ? 0.06 : 0.1));
      const cx = pz.legs ? pz.pelvisX + (pz.pelvis[0] + pz.j3[0]) / 2 : pz.pelvisX + 0.05; const rx = pz.legs ? Math.abs(pz.j3[0] - pz.pelvis[0]) / 2 + 0.22 : 0.27; const rz = pz.legs ? 0.13 : 0.15;
      paintGroundShadow(ctx, camF.p, st, cam.k, [cx, gy, 0], rx, rz, groundStrength(lift));
    }
    const drawMain = (c) => drawFigureShapes(c, pz, camF, st, { parts: opts.parts, attach: attachNow, mouth: mouthId, skinFrame: perf ? t0 : frame, design: params.design, wantFrames: opts.wantFrames });
    const fig = hasDrop(st) && !opts.parts ? castShadow(ctx, stageDrop(st), cam.k, drawMain) : drawMain(ctx);
    shapes = fig.shapes; placedAttach = fig.placed || []; figFrames = fig.frames || null;
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
        const e = camF.p([bone[1][0] + pz.pelvisX, bone[1][1], bone[1][2]]); const r = 11 * cam.k;
        ctx.save(); ctx.lineWidth = cam.lw * 1.8; ctx.strokeStyle = '#e0662e'; ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(e.x, e.y, r * 0.35, 0, TAU); ctx.fillStyle = '#e0662e'; ctx.fill();
        ctx.restore(); fixHandle = { x: e.x, y: e.y };
        // and one at the base of the part: it moves the part before it, since that is where this one starts
        const b0 = camF.p([bone[0][0] + pz.pelvisX, bone[0][1], bone[0][2]]); const q = 8 * cam.k;
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
  return { key, drawing: ph.drawing, drawings: ph.drawings, u: ph.u, shapes, cam: camF, camWorld: cam, pz, attach: placedAttach, handles, arcDots, fixHandle, sceneHits, frames: figFrames };
}
