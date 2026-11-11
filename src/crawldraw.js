// Drawing the snake, the spider and the crab: the same kind of screen shapes as the dog's, each tagged with the part it is, so they can be picked, tinted, skinned and exported in layers.
import { add, sub, mul, norm } from './rig3.js';
import { hull, circlePts, TAU } from './geom.js';
import { tubePoly } from './hoseshape.js';

const mean = (a) => a.reduce((t, v) => t + v, 0) / a.length;

export function buildCrawlerShapes(pz, cam, st = {}) {
  const shapes = []; const S = (pt) => cam.p([pt[0] + pz.pelvisX, pt[1], pt[2]]); const sc = cam.scale; const kind = pz.crawler; const girth = pz.params?.proportions?.dGirth ?? 1;
  const capsule = (a, b, ra, rb, part, side, role = 'body') => { const A = S(a); const B = S(b); shapes.push({ pts: hull([...circlePts(A, ra * sc, 10), ...circlePts(B, rb * sc, 10)]), depth: (A.d + B.d) / 2, part, side, role }); };
  const ellipsoid = (c, rx, ry, rz, part, side = null, role = 'body', bias = 0) => {
    const out = []; for (let lat = 0; lat <= 8; lat++) { const ph = (lat / 8) * Math.PI; for (let lon = 0; lon < (lat === 0 || lat === 8 ? 1 : 20); lon++) { const th = (lon / 20) * TAU; const q = S(add(c, [rx * Math.sin(ph) * Math.cos(th), ry * Math.cos(ph), rz * Math.sin(ph) * Math.sin(th)])); out.push([q.x, q.y]); } }
    shapes.push({ pts: hull(out), depth: S(c).d + bias, part, side, role });
  };
  let eyes = [];
  if (kind === 'snake') {
    const { pts, radii, N } = pz.chain; const L = pz.body.length;
    const range = (a, b) => { const i0 = Math.floor(a * (N - 1)); const i1 = Math.ceil(b * (N - 1)); return { p: pts.slice(i0, i1 + 1), r: radii.slice(i0, i1 + 1) }; };
    for (const [part, a, b] of [['dog.tail1', 0.76, 1], ['dog.spine1', 0.56, 0.8], ['dog.spine2', 0.34, 0.6], ['dog.spine3', 0.16, 0.38], ['dog.neck', 0.02, 0.2]]) {
      const { p, r } = range(a, b); if (p.length < 2) continue; const P = p.map(S); shapes.push({ pts: tubePoly(P, r.map((v) => v * sc)), depth: mean(P.map((q) => q.d)), part, side: null, role: 'body' });
    }
    const hc = pz.headC; const nose = pz.noseTip; const hr = pz.body.head * 0.42 * girth;
    capsule(add(hc, mul(norm(sub(pts[3], hc)), 0.04)), nose, hr * 1.05, hr * 0.7, 'dog.head', null);
    if (pz.body.tongue > 0.8) { const dir = norm(sub(nose, hc)); capsule(nose, add(nose, mul(dir, 0.16)), 0.012, 0.006, 'dog.jaw', null); }
    eyes = [1, -1].map((sg) => S(add(hc, [0.02, hr * 0.55, sg * hr * 0.75])));
  } else if (kind === 'spider') {
    const b = pz.body; const g = b.girth;
    ellipsoid(b.abdomen, b.abdL * 0.5, 0.16 * g, 0.15 * g, 'dog.spine1'); ellipsoid(b.thorax, b.thoL * 0.5, 0.09 * g, 0.1 * g, 'dog.spine3'); ellipsoid(pz.headC, 0.05 * g, 0.045 * g, 0.055 * g, 'dog.head', null, 'body', 0.0004);
    for (const sg of [1, -1]) capsule(add(pz.noseTip, [0, 0, sg * 0.015]), add(pz.noseTip, [0.01, -0.07, sg * 0.012]), 0.013, 0.005, 'dog.jaw', null);
    eyes = b.eyes.map(S);
  } else if (kind === 'crab') {
    const b = pz.body; const g = b.girth;
    ellipsoid(b.centre, b.half, 0.1 * g, 0.19 * g, 'dog.spine2');
    for (const e of b.eyes) { capsule(e.base, e.tip, 0.014, 0.011, 'dog.head', null); const t = S(e.tip); shapes.push({ pts: circlePts(t, 0.034 * sc, 14), depth: t.d + 0.0004, part: 'dog.head', side: null, role: 'body' }); }
    eyes = b.eyes.map((e) => S(e.tip));
  }
  for (const key of Object.keys(pz.legs)) {
    const l = pz.legs[key]; const role = l.side === 'R' ? 'near' : 'far'; const pre = key[0] === 'C' || key[0] === 'F' ? 'dog.f' : 'dog.h'; const tk = kind === 'crab' ? 1.1 : 0.9;
    if (l.free) { // a crab's claw
      capsule(l.root, l.mid, 0.034 * girth, 0.038 * girth, `${pre}leg`, l.side, role); capsule(l.mid, l.wrist, 0.042 * girth, 0.05 * girth, `${pre}leg`, l.side, role);
      const d0 = norm(sub(l.toe, l.wrist)); const per = [-d0[1], d0[0], 0]; const a = l.open ?? 0.3;
      capsule(l.wrist, add(l.wrist, mul(add(mul(d0, Math.cos(a)), mul(per, Math.sin(a))), 0.14)), 0.03, 0.009, `${pre}paw`, l.side, role);
      capsule(l.wrist, add(l.wrist, mul(add(mul(d0, Math.cos(a)), mul(per, -Math.sin(a) * 0.2)), 0.14)), 0.03, 0.009, `${pre}paw`, l.side, role);
      continue;
    }
    const front = key[0] === 'F' || key[0] === 'A'; const part = `${front ? 'dog.f' : 'dog.h'}leg`;
    capsule(l.root, l.mid, 0.021 * tk * girth, 0.018 * tk * girth, part, l.side, role); capsule(l.mid, l.wrist, 0.018 * tk * girth, 0.013 * tk * girth, part, l.side, role); capsule(l.wrist, l.paw, 0.012 * tk * girth, 0.008 * tk * girth, `${front ? 'dog.f' : 'dog.h'}paw`, l.side, role);
  }
  shapes.sort((a, b) => a.depth - b.depth);
  const hcS = S(pz.headC);
  return { shapes, face: { eyes: eyes.filter((e) => e.d > hcS.d - 0.2), nose: null, noseBase: null, dot: null, c: hcS } };
}
