// Shapes for the dog: the same kind of screen polygons as the human, each tagged with its part and side so it can be picked, tinted and exported in layers.
import { add, sub, mul, norm, apply } from './rig3.js';
import { hull, circlePts, TAU } from './geom.js';
import { pawPhase, poseDog, legsOf, bonesOf, DOGB } from './dog3.js';
import { speciesOf } from './dogdefaults.js';

export function buildDogShapes(pz, cam) {
  const shapes = [];
  const S = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]);
  const sc = cam.scale;
  const hs = (pz.params.proportions?.dHead ?? 1) * (bonesOf(pz.params).skull / DOGB.skull); // head drawn in proportion to this species' skull
  const sp = speciesOf(pz.params); const K = sp.look; const bird = pz.params.dogSpecies === 'bird'; const cera = pz.params.dogSpecies === 'ceratopsian';
  const capsule = (a, b, ra, rb, part, side, role) => {
    const A = S(a); const B = S(b);
    shapes.push({ pts: hull([...circlePts(A, ra * sc), ...circlePts(B, rb * sc)]), depth: (A.d + B.d) / 2, part, side, role });
  };
  // An elliptical tube along a local x axis: its cross-section lies in the local y-z plane.
  const tube = (C0, C1, M0, M1, r0, r1, part) => {
    const ring = (C, M, ry, rz) => Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * TAU; const q = S(add(C, apply(M, [0, ry * Math.cos(t), rz * Math.sin(t)]))); return [q.x, q.y]; });
    shapes.push({ pts: hull([...ring(C0, M0, ...r0), ...ring(C1, M1, ...r1)]), depth: (S(C0).d + S(C1).d) / 2, part, side: null, role: 'body' });
  };
  const roundBody = (C, r, part) => { const A = S(C); shapes.push({ pts: circlePts(A, r * sc, 16), depth: A.d, part, side: null, role: 'body' }); };

  const BO = K.body; const NK = K.neck;
  roundBody(pz.pelvis, 0.16 * BO, 'dog.pelvis');
  tube(pz.pelvis, pz.j1, pz.R1, pz.R1, [0.16 * BO, 0.1 * BO], [0.165 * BO, 0.105 * BO], 'dog.spine1');
  tube(pz.j1, pz.j2, pz.R2, pz.R2, [0.165 * BO, 0.105 * BO], [0.18 * BO, 0.11 * BO], 'dog.spine2');
  tube(pz.j2, pz.j3, pz.R3, pz.R3, [0.18 * BO, 0.11 * BO], [0.2 * BO, 0.115 * BO], 'dog.spine3');
  capsule(pz.neckBase, pz.neckTop, 0.09 * NK, 0.065 * NK, 'dog.neck', null, 'body');

  // Head: a skull and a tapering snout, with the jaw under it.
  const skullC = pz.headC;
  const skull = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * TAU;
    for (const q of [[Math.cos(t) * 0.14 * hs, Math.sin(t) * 0.09 * hs, 0], [Math.cos(t) * 0.14 * hs, 0, Math.sin(t) * 0.08 * hs], [0, Math.cos(t) * 0.09 * hs, Math.sin(t) * 0.08 * hs]]) {
      const P = S(add(skullC, apply(pz.Rh, q))); skull.push([P.x, P.y]);
    }
  }
  const snoutStart = add(pz.neckTop, apply(pz.Rh, [0.22 * hs, 0, 0]));
  const A = S(snoutStart); const B = S(pz.noseTip);
  shapes.push({ pts: hull([...skull, ...circlePts(A, 0.06 * hs * sc), ...circlePts(B, 0.035 * hs * sc)]), depth: S(skullC).d, part: 'dog.head', side: null, role: 'body' });
  capsule(pz.hinge, pz.jawEnd, 0.04 * hs, 0.022 * hs, 'dog.jaw', null, 'body');
  const hc = S(skullC);
  const eyes = [1, -1].map((s) => S(add(pz.neckTop, apply(pz.Rh, [0.17 * hs, 0.05 * hs, s * 0.07 * hs]))));
  const face = { eyes: eyes.filter((e) => e.d > hc.d - 0.0001), nose: null, noseBase: null, dot: B, c: hc };

  for (const side of ['R', 'L']) {
    const role = side === 'R' ? 'near' : 'far';
    capsule(pz.ears[side].root, pz.ears[side].tip, 0.045, 0.03, 'dog.ear', side, role);
  }
  for (let k = 0; k < 3; k++) capsule(pz.tail[k], pz.tail[k + 1], (0.035 - k * 0.008) * K.tail, (0.03 - k * 0.009) * K.tail, `dog.tail${k + 1}`, null, 'body');
  if (bird) { // a tail fan: a wedge of feathers spreading out from the last joint
    const d = norm(sub(pz.tail[3], pz.tail[2])); const base = pz.tail[2]; const tip = add(pz.tail[3], mul(d, 0.12));
    const spread = 1 + 0.9 * Math.min(1, pz.params.dogFlight || 0); // the tail fans out in flight
    const ends = [-1, -0.5, 0, 0.5, 1].map((a) => add(tip, [0, a * 0.02, a * 0.16 * spread]));
    const P = [S(base), ...ends.map(S)]; shapes.push({ pts: hull(P.map((q) => [q.x, q.y])), depth: S(pz.tail[3]).d, part: 'dog.tail3', side: null, role: 'body' });
  }
  if (cera) { // a bony frill rising behind the head, a brow horn over each eye and a horn on the nose, sized from the skull
    const Ls = bonesOf(pz.params).skull * (pz.params.proportions?.dHead ?? 1); const H = (x, y, z) => add(pz.neckTop, apply(pz.Rh, [x * Ls, y * Ls, z * Ls]));
    const ring = []; for (const z of [-0.05, 0.05]) for (let i = 0; i < 20; i++) { const t = (i / 20) * TAU; const q = S(H(0.1 + Math.cos(t) * 0.5, 0.45 + Math.sin(t) * 0.6, z)); ring.push([q.x, q.y]); }
    shapes.push({ pts: hull(ring), depth: S(pz.neckTop).d - 0.0004, part: 'dog.head', side: null, role: 'body' });
    for (const s of [1, -1]) capsule(H(0.75, 0.15, s * 0.14), H(1.1, 0.62, s * 0.14), 0.07 * Ls, 0.012 * Ls, 'dog.head', null, 'body');
    const nb = add(pz.noseTip, apply(pz.Rh, [-0.18 * Ls, 0.02 * Ls, 0])); capsule(nb, add(nb, apply(pz.Rh, [0.08 * Ls, 0.42 * Ls, 0])), 0.07 * Ls, 0.012 * Ls, 'dog.head', null, 'body');
  }
  for (const leg4 of ['HR', 'HL', 'FR', 'FL']) {
    const l = pz.legs[leg4]; const role = l.side === 'R' ? 'near' : 'far';
    const pre = l.front ? 'dog.f' : 'dog.h';
    // The blade: a flat plate from the withers down to the shoulder joint, drawn first so the upper arm tucks under it.
    if (bird && l.front && l.free) { // flight feathers, drawn as separate quills behind the wing bones
      const open = Math.min(1, pz.params.dogWingOpen || 0); const back = apply(pz.R3, [-1, 0, 0]);
      const mix = (a, b, t) => norm([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
      const hand = norm(sub(l.paw, l.wrist)); const fore = norm(sub(l.wrist, l.mid)); const lerp3 = (a, b, t) => add(a, mul(sub(b, a), t));
      const quill = (base, dir, len, r0) => { const q = (a, b, c, e) => capsule(a, b, c, e, `${pre}leg`, l.side, role); q(base, add(base, mul(dir, len)), r0, r0 * 0.3); };
      const n2 = 6; for (let i = 0; i < n2; i++) { const t = 0.12 + (0.88 * i) / (n2 - 1); quill(lerp3(l.mid, l.wrist, t), mix(fore, back, 0.8 - 0.3 * open), (0.11 + 0.09 * t) * (0.55 + 0.45 * open) * K.wing, 0.02); } // secondaries
      const n1 = 7; for (let i = 0; i < n1; i++) { const t = (i + 0.5) / n1; quill(lerp3(l.wrist, l.paw, t), mix(hand, back, 0.12 + 0.5 * (1 - open) + 0.08 * i), (0.2 - 0.012 * i) * (0.5 + 0.5 * open) * K.wing, 0.018); } // primaries, fanning out toward the tip
    }
    const W = l.front && l.free ? (bird ? K.wing : 0.6) : K.leg; // a wing is broad, a theropod's arm is small
    if (l.front && !l.free) capsule(l.top, l.root, 0.05 * W, 0.075 * W, 'dog.fshoulder', l.side, role);
    capsule(l.root, l.mid, (l.front ? 0.07 : 0.095) * W, 0.05 * W, `${pre}leg`, l.side, role);
    capsule(l.mid, l.wrist, 0.05 * W, 0.03 * W, `${pre}leg`, l.side, role);
    capsule(l.wrist, l.paw, 0.028 * W, 0.03 * W, `${pre}paw`, l.side, role);
    capsule(l.paw, l.toe, 0.04 * (l.free ? 0.5 : K.leg), 0.032 * (l.free ? 0.3 : K.leg), `${pre}paw`, l.side, role);
  }
  shapes.sort((a, b) => a.depth - b.depth);
  return { shapes, face };
}

/** Polylines for the stick style: [points, far]. */
export function dogSticks(pz) {
  const out = [
    [[pz.pelvis, pz.j1, pz.j2, pz.j3, pz.neckBase, pz.neckTop, pz.noseTip], false],
    [[pz.hinge, pz.jawEnd], false],
    [pz.tail, false],
  ];
  for (const side of ['R', 'L']) out.push([[pz.ears[side].root, pz.ears[side].tip], side === 'L']);
  for (const k of ['HR', 'HL', 'FR', 'FL']) { const l = pz.legs[k]; out.push([l.top ? [l.top, l.root, l.mid, l.wrist, l.paw, l.toe] : [l.root, l.mid, l.wrist, l.paw, l.toe], l.side === 'L']); }
  return out;
}

/** World point that a part pivots about. */
export function dogPivot(pz, part, side) {
  const front = part.startsWith('dog.f');
  const leg = side ? pz.legs[`${front ? 'F' : 'H'}${side}`] : null;
  const map = {
    'dog.pelvis': pz.pelvis, 'dog.spine1': pz.pelvis, 'dog.spine2': pz.j1, 'dog.spine3': pz.j2, 'dog.neck': pz.neckBase, 'dog.head': pz.neckTop, 'dog.jaw': pz.hinge,
    'dog.ear': side ? pz.ears[side].root : null, 'dog.tail1': pz.tail[0], 'dog.tail2': pz.tail[1], 'dog.tail3': pz.tail[2],
    'dog.fshoulder': leg?.top, 'dog.fleg': leg?.root, 'dog.fpaw': leg?.wrist, 'dog.hleg': leg?.root, 'dog.hpaw': leg?.wrist,
  };
  return map[part] || null;
}

export const DOG_ARCS = {
  head: (z) => z.headC, hip: (z) => z.pelvis, wrist: (z) => z.legs.FR.paw, ankle: (z) => z.legs.HR.paw, tail: (z) => z.tail[3],
};

/** Where paws land over a stretch of ground, for the footprint guide in a plain cycle. */
export function dogPrints(params, fromX, toX) {
  if ((params.dogFlight || 0) > 0.5) return []; // nothing touches the ground in flight
  const stride = params.dogStride; const out = [];
  const c0 = Math.floor((fromX - 2) / stride); const c1 = Math.ceil((toX + 2) / stride);
  for (const leg of legsOf(params)) {
    const ph = pawPhase(params.dogGait, leg);
    const z = poseDog(params, params.motion || {}, ph);
    const px = z.legs[leg].paw[0] + ph * stride;
    for (let c = c0; c <= c1; c++) out.push({ leg, x: px + c * stride, z: z.legs[leg].paw[2] });
  }
  return out;
}
