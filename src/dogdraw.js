// Shapes for the dog: the same kind of screen polygons as the human, each tagged with its part and side so it can be picked, tinted and exported in layers.
import { add, sub, mul, norm, apply } from './rig3.js';
import { hull, circlePts, TAU } from './geom.js';
import { pawGait, poseDog, legsOf, bonesOf, DOGB } from './dog3.js';
import { speciesOf, kindOf } from './dogdefaults.js';
import { hosePath, tubePoly, wobble, taperRadii } from './hoseshape.js';
import { capsuleFacets, slabFacets, ellipsoidFacets, chainFacets, withFacets } from './lowpoly.js';
import { buildCrawlerShapes } from './crawldraw.js';

const mixHex = (a, b, t) => { const pa = parseInt(a.slice(1), 16); const pb = parseInt(b.slice(1), 16); const ch = (s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t); return '#' + [16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join(''); };
/**
 * A rubber hose animal: the same bones as the figure it is like, drawn the rubber hose way. Every leg is one tube with no knee or hock, the neck and tail are tubes,
 * the body is a sausage, the head a ball with a pale muzzle (or a beak) and a round eye. The colours are the rubber hose ones in the View tab.
 */
function buildHoseAnimal(pz, cam, st) {
  const shapes = []; const p = pz.params; const sp = speciesOf(p); const K = sp.look; const bird = kindOf(p.dogSpecies) === 'bird';
  const S = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]); const sc = cam.scale;
  const hs = (p.proportions?.dHead ?? 1) * (bonesOf(p).skull / DOGB.skull);
  const limbK = st.hoseLimb ?? 1; const bend = Math.max(0, Math.min(1, st.hoseBend ?? 1)); const taper = st.hoseTaper ?? 0; const belly = st.hoseBelly ?? 1;
  const body = st.hoseBody ?? '#2d2a2e'; const pale = st.hoseFace ?? '#fff8e8'; const shoe = st.hoseShoe ?? '#ffffff'; const tint = st.farTint ?? '#9db4d0';
  const col = (c, role) => (role === 'far' ? mixHex(c, tint, 0.3) : c);
  const add1 = (pts, depth, part, side, role, color) => shapes.push({ pts, depth, part, side, role, fill: col(color, role), lw: 1.6 });
  const wobA = Math.max(0, p.hoseWobble || 0) * 0.03 * sc; const wobR = Math.max(1, Math.round(p.hoseWobbleRate || 2));
  const tube = (pts3, radii, part, side, role, color, bias = 0, wob = null, depth = null) => {
    let P = pts3.map(S); if (wob) P = wobble(P, wobA * (wob.gain ?? 1), (pz.u || 0) * wobR + wob.k, wob.free);
    add1(tubePoly(P, radii.map((r) => r * sc)), depth ?? P.reduce((t, q) => t + q.d, 0) / P.length + bias, part, side, role, color); Object.assign(shapes[shapes.length - 1], { spine: P, spineR: radii.map((r) => r * sc) });
    if (st.style === 'lowpoly') withFacets(shapes[shapes.length - 1], chainFacets(S, sc, pts3, radii, Math.max(4, Math.min(12, Math.round(st.polySides ?? 6)))), false);
  };
  const BO = K.body;
  tube(hosePath([pz.pelvis, pz.j1, pz.j2, pz.j3], 1, 10), Array.from({ length: 10 }, (_, i) => BO * (0.14 + 0.055 * belly * Math.sin(Math.PI * (0.12 + 0.76 * (i / 9))))), 'dog.spine2', null, 'body', body);
  const nk = pz.neck || [pz.neckBase, pz.neckTop];
  tube(hosePath(nk, 1, 8), taperRadii(8, 0.058 * K.neck * limbK, 0.3), 'dog.neck', null, 'body', body, -0.0002, { k: 0.4, gain: 0.4 });
  // the head: a ball, a pale muzzle or a beak, the jaw, an eye on each side
  const HC = S(pz.headC); add1(circlePts(HC, 0.135 * hs * sc, 24), HC.d, 'dog.head', null, 'body', body);
  // The head is layered from the ball outwards: ears and jaw behind it, the muzzle (or beak) growing out of it, the eyes on top. The jaw only shows when the mouth opens.
  const NT0 = S(pz.noseTip); const toward = NT0.d >= HC.d; // is the nose nearer the camera than the head?
  if (bird) tube([add(pz.neckTop, apply(pz.Rh, [0.2 * hs, 0, 0])), pz.noseTip], [0.055 * hs, 0.012 * hs], 'dog.head', null, 'body', '#f0b030', 0, null, HC.d + (toward ? 0.0003 : -0.0003));
  else tube([add(pz.headC, mul(sub(pz.noseTip, pz.headC), 0.3)), add(pz.headC, mul(sub(pz.noseTip, pz.headC), 0.65)), pz.noseTip], [0.098 * hs, 0.085 * hs, 0.07 * hs], 'dog.head', null, 'body', pale, 0, null, HC.d + (toward ? 0.0003 : -0.0003));
  tube([pz.hinge, pz.jawEnd], [0.04 * hs, 0.03 * hs], 'dog.jaw', null, 'body', bird ? '#f0b030' : pale, 0, null, HC.d - 0.0005);
  const NT = S(pz.noseTip); let fx = NT.x - HC.x; let fy = NT.y - HC.y; const fl = Math.hypot(fx, fy) || 1; fx /= fl; fy /= fl;
  for (const s of [1, -1]) {
    const E = S(add(pz.headC, apply(pz.Rh, [0.035 * hs, 0.045 * hs, s * 0.115 * hs]))); if (E.d <= HC.d - 0.0001) continue; // on the side of the ball, clear of the muzzle
    shapes.push({ pts: circlePts(E, 0.05 * hs * sc, 16), depth: HC.d + 0.0006, part: 'dog.head', side: null, role: 'body', fill: '#ffffff', lw: 1.2 });
    shapes.push({ pts: circlePts({ x: E.x + fx * 0.015 * hs * sc, y: E.y + fy * 0.015 * hs * sc }, 0.027 * hs * sc, 12), depth: HC.d + 0.0007, part: 'dog.head', side: null, role: 'body', fill: '#111111', lw: 0 });
  }
  if (!bird) for (const side of ['R', 'L']) tube([pz.ears[side].root, add(pz.ears[side].root, mul(sub(pz.ears[side].tip, pz.ears[side].root), 1.7))], [0.04, 0.016], 'dog.ear', side, side === 'R' ? 'near' : 'far', body, 0,  { k: side === 'R' ? 0.1 : 0.6, free: true, gain: 0.5 }, HC.d - 0.0004);
  tube(hosePath(pz.tail, 1, 12), bird ? Array.from({ length: 12 }, (_, i) => K.tail * (0.03 + 0.045 * (i / 11))) : taperRadii(12, 0.034 * K.tail, 0.9), 'dog.tail2', null, 'body', body, -0.0003, { k: 0.3, free: true });
  let n = 0;
  for (const leg4 of ['HR', 'HL', 'FR', 'FL']) {
    const l = pz.legs[leg4]; const role = l.side === 'R' ? 'near' : 'far'; const pre = l.front ? 'dog.f' : 'dog.h'; const k = (n++) * 0.25;
    const path = hosePath([l.root, l.mid, l.wrist, l.paw], bend, 16);
    if (bird && l.front && l.free) { // a floppy wing: one broad tube and a few fat feathers trailing from it
      const open = Math.min(1, p.dogWingOpen || 0); const back = apply(pz.R3, [-1, 0, 0]); const W = K.wing * (0.03 + 0.028 * open);
      tube(path, Array.from({ length: 16 }, (_, i) => W * (0.55 + 0.9 * Math.sin(Math.PI * Math.min(1, 0.1 + (i / 15) * 0.95)))), 'dog.fleg', l.side, role, body, 0, { k, gain: 0.6 });
      const hand = norm(sub(l.paw, l.wrist));
      for (let i = 0; i < 4; i++) { const t = 0.3 + 0.2 * i; const base = path[Math.round(t * 15)]; const mix = norm([hand[0] + (back[0] - hand[0]) * (0.8 - 0.35 * open), hand[1] + (back[1] - hand[1]) * (0.8 - 0.35 * open) - 0.15, hand[2] + (back[2] - hand[2]) * (0.8 - 0.35 * open)]); tube([base, add(base, mul(mix, (0.1 + 0.12 * open) * K.wing))], [W * 0.9, W * 0.45], 'dog.fleg', l.side, role, body, -0.0002 - i * 0.00002); }
      continue;
    }
    const r = (l.free ? 0.022 : 0.05) * Math.max(0.45, K.leg) * limbK;
    tube(path, taperRadii(16, r, taper + 0.25), `${pre}leg`, l.side, role, body, 0, { k });
    tube([l.paw, l.toe], [r * 1.45, r * 1.3], `${pre}paw`, l.side, role, bird ? '#f0b030' : shoe, 0.0003);
  }
  shapes.sort((a, b) => a.depth - b.depth);
  return { shapes, face: { eyes: [], nose: null, noseBase: null, c: HC } };
}

export function buildDogShapes(pz, cam, st = {}) {
  if (pz.crawler) return buildCrawlerShapes(pz, cam, st);
  if (speciesOf(pz.params).hose) return buildHoseAnimal(pz, cam, st);
  const ptero = Boolean(speciesOf(pz.params).membrane);
  const shapes = []; const lp = st.style === 'lowpoly'; const NS = Math.max(4, Math.min(12, Math.round(st.polySides ?? 6)));
  const S = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]);
  const sc = cam.scale;
  const hs = (pz.params.proportions?.dHead ?? 1) * (bonesOf(pz.params).skull / DOGB.skull); // head drawn in proportion to this species' skull
  const sp = speciesOf(pz.params); const K = sp.look; const bird = kindOf(pz.params.dogSpecies) === 'bird' && !sp.membrane; const cera = pz.params.dogSpecies === 'ceratopsian';
  const capsule = (a, b, ra, rb, part, side, role) => {
    const A = S(a); const B = S(b);
    const sh = { pts: hull([...circlePts(A, ra * sc), ...circlePts(B, rb * sc)]), depth: (A.d + B.d) / 2, part, side, role }; shapes.push(sh);
    if (lp) withFacets(sh, capsuleFacets(S, sc, a, b, ra, rb, NS));
  };
  // An elliptical tube along a local x axis: its cross-section lies in the local y-z plane.
  const tube = (C0, C1, M0, M1, r0, r1, part) => {
    const ring = (C, M, ry, rz) => Array.from({ length: 12 }, (_, i) => { const t = (i / 12) * TAU; const q = S(add(C, apply(M, [0, ry * Math.cos(t), rz * Math.sin(t)]))); return [q.x, q.y]; });
    const sh = { pts: hull([...ring(C0, M0, ...r0), ...ring(C1, M1, ...r1)]), depth: (S(C0).d + S(C1).d) / 2, part, side: null, role: 'body' }; shapes.push(sh);
    if (lp) { const wr = (C, M, ry, rz) => Array.from({ length: NS }, (_, i) => { const t = (i / NS) * TAU; return add(C, apply(M, [0, ry * Math.cos(t), rz * Math.sin(t)])); }); withFacets(sh, slabFacets(S, sc, wr(C0, M0, ...r0), wr(C1, M1, ...r1))); }
  };
  const roundBody = (C, r, part) => { const A = S(C); const sh = { pts: circlePts(A, r * sc, 16), depth: A.d, part, side: null, role: 'body' }; shapes.push(sh); if (lp) withFacets(sh, ellipsoidFacets(S, sc, C, (q) => q, [r, r, r], NS)); };

  const BO = K.body; const NK = K.neck;
  roundBody(pz.pelvis, 0.16 * BO, 'dog.pelvis');
  tube(pz.pelvis, pz.j1, pz.R1, pz.R1, [0.16 * BO, 0.1 * BO], [0.165 * BO, 0.105 * BO], 'dog.spine1');
  tube(pz.j1, pz.j2, pz.R2, pz.R2, [0.165 * BO, 0.105 * BO], [0.18 * BO, 0.11 * BO], 'dog.spine2');
  tube(pz.j2, pz.j3, pz.R3, pz.R3, [0.18 * BO, 0.11 * BO], [0.2 * BO, 0.115 * BO], 'dog.spine3');
  { const nk = pz.neck || [pz.neckBase, pz.neckTop]; const n = nk.length - 1; for (let i = 0; i < n; i++) capsule(nk[i], nk[i + 1], (0.09 - 0.025 * (i / n)) * NK, (0.09 - 0.025 * ((i + 1) / n)) * NK, 'dog.neck', null, 'body'); }

  // Head: a skull and a tapering snout, with the jaw under it.
  const skullC = pz.headC;
  const skull = [];
  for (let i = 0; i < 20; i++) {
    const t = (i / 20) * TAU;
    for (const q of [[Math.cos(t) * 0.14 * hs, Math.sin(t) * 0.09 * hs, 0], [Math.cos(t) * 0.14 * hs, 0, Math.sin(t) * 0.08 * hs], [0, Math.cos(t) * 0.09 * hs, Math.sin(t) * 0.08 * hs]]) {
      const P = S(add(skullC, apply(pz.Rh, q))); skull.push([P.x, P.y]);
    }
  }
  const snoutStart = add(pz.neckTop, apply(pz.Rh, [0.22 * hs, 0, 0])); const SN = K.snout ?? 1; // a horse's muzzle is deep
  const A = S(snoutStart); const B = S(pz.noseTip);
  shapes.push({ pts: hull([...skull, ...circlePts(A, 0.06 * SN * hs * sc), ...circlePts(B, 0.035 * SN * hs * sc)]), depth: S(skullC).d, part: 'dog.head', side: null, role: 'body' });
  if (SN > 1) { const J0 = S(pz.hinge); const J1 = S(pz.jawEnd); shapes.push({ pts: hull([...circlePts(J0, 0.05 * hs * sc), ...circlePts(J1, 0.032 * hs * sc)]), depth: S(skullC).d - 0.0005, part: 'dog.jaw', side: null, role: 'body' }); } // tucked behind the muzzle: it shows when the mouth opens
  else capsule(pz.hinge, pz.jawEnd, 0.04 * hs, 0.022 * hs, 'dog.jaw', null, 'body');
  const hc = S(skullC);
  const eyes = [1, -1].map((s) => S(add(pz.neckTop, apply(pz.Rh, [0.17 * hs, 0.05 * hs, s * 0.07 * hs]))));
  const face = { eyes: eyes.filter((e) => e.d > hc.d - 0.0001), nose: null, noseBase: null, dot: B, c: hc };

  for (const side of ['R', 'L']) {
    const role = side === 'R' ? 'near' : 'far';
    capsule(pz.ears[side].root, pz.ears[side].tip, 0.045 * (K.ear ?? 1), 0.03 * (K.ear ?? 1) * (K.ear ? 0.5 : 1), 'dog.ear', side, role);
  }
  for (let k = 0; k < 3; k++) capsule(pz.tail[k], pz.tail[k + 1], (0.035 - k * 0.008) * K.tail, (0.03 - k * 0.009) * K.tail, `dog.tail${k + 1}`, null, 'body');
  if (bird) { // a tail fan: a wedge of feathers spreading out from the last joint
    const d = norm(sub(pz.tail[3], pz.tail[2])); const base = pz.tail[2]; const tip = add(pz.tail[3], mul(d, 0.12));
    const spread = 1 + 0.9 * Math.min(1, pz.params.dogFlight || 0); // the tail fans out in flight
    const ends = [-1, -0.5, 0, 0.5, 1].map((a) => add(tip, [0, a * 0.02, a * 0.16 * spread]));
    const P = [S(base), ...ends.map(S)]; shapes.push({ pts: hull(P.map((q) => [q.x, q.y])), depth: S(pz.tail[3]).d, part: 'dog.tail3', side: null, role: 'body' });
  }
  if (sp.crest) { const Lc = bonesOf(pz.params).skull * (pz.params.proportions?.dHead ?? 1); const Hc = (x, y) => add(pz.neckTop, apply(pz.Rh, [x * Lc, y * Lc, 0])); capsule(Hc(0.35, 0.12), Hc(-1.0, 0.85), 0.07 * Lc, 0.015 * Lc, 'dog.head', null, 'body'); } // a long bony crest sweeping back from the head
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
    if (ptero && l.front && l.free) { // the wing membrane: skin stretched from the long finger back to the hip, behind the wing bones
      const hipPt = add(pz.pelvis, apply(pz.Rp, [-0.05, -0.03, l.s * 0.05])); const mem = [l.root, l.mid, l.wrist, l.paw, hipPt].map(S);
      shapes.push({ pts: hull(mem.map((q) => [q.x, q.y])), depth: S(l.mid).d - 0.0004, part: `${pre}leg`, side: l.side, role, fill: mixHex(st.fillColor ?? '#f2eee6', '#b98a62', 0.5) });
    }
    if (speciesOf(pz.params).flipper && l.free) { // a flipper: a leaf-shaped paddle, thin at the shoulder, broad in the middle and pointed at the tip
      const path = [l.root, l.mid, l.wrist, l.paw]; const dense = []; for (let i = 0; i < 3; i++) for (let t = 0; t < 1; t += 0.25) dense.push(add(path[i], mul(sub(path[i + 1], path[i]), t))); dense.push(path[3]);
      const n = dense.length; const circles = dense.flatMap((q, i) => { const t = i / (n - 1); const r = (0.03 + 0.085 * Math.sin(Math.PI * Math.min(1, t * 1.15))) * (K.wing / 1.8) * 1.4; return circlePts(S(q), Math.max(0.006, r) * sc, 10); });
      shapes.push({ pts: hull(circles), depth: S(l.mid).d, part: `${pre}leg`, side: l.side, role }); continue;
    }
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
    [[pz.pelvis, pz.j1, pz.j2, pz.j3, ...(pz.neck || [pz.neckBase, pz.neckTop]), pz.noseTip], false],
    [[pz.hinge, pz.jawEnd], false],
    [pz.tail, false],
  ];
  for (const side of ['R', 'L']) out.push([[pz.ears[side].root, pz.ears[side].tip], side === 'L']);
  for (const k of Object.keys(pz.legs)) { const l = pz.legs[k]; out.push([l.top ? [l.top, l.root, l.mid, l.wrist, l.paw, l.toe] : [l.root, l.mid, l.wrist, l.paw, l.toe], l.side === 'L']); }
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
    const ph = pawGait(params, leg).ph;
    const z = poseDog(params, params.motion || {}, ph);
    const px = z.legs[leg].paw[0] + ph * stride;
    for (let c = c0; c <= c1; c++) out.push({ leg, x: px + c * stride, z: z.legs[leg].paw[2] });
  }
  return out;
}
