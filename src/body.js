// Body physics: the figure as a body with mass, in the side view. Pure logic, no DOM.
// Twelve points carry the weight (hips, the middle of the spine, shoulders, head, two elbows, two hands, two knees, two ankles) joined by fixed-length bones. Every step gravity and air drag move them,
// the ground and the tops of boxes push back, a hand can take hold of a hold and then the body swings from it, and muscles (springs at the joints) pull the limbs back towards the pose
// the figure was given. The muscles' strength is the one setting that makes the difference between a figure that stands, one that slumps and one that is limp.
// Nothing here is a keyframed pose: poses only say what the muscles are trying to do. Units are leg lengths and seconds, like the rest of the rig.

export const G0 = 10.9; // gravity in leg lengths a second squared (about 9.8 m/s² for a leg of 0.9 m)
const SUB = 8; // steps in a frame
const ITER = 14; // constraint passes in a step
const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const PT = Object.freeze({ P: 0, S: 1, H: 2, ER: 3, EL: 4, HR: 5, HL: 6, KR: 7, KL: 8, AR: 9, AL: 10, M: 11 });
export const PT_NAMES = ['P', 'S', 'H', 'ER', 'EL', 'HR', 'HL', 'KR', 'KL', 'AR', 'AL', 'M'];
const N = 12;
const MASS = [6, 4, 3, 0.9, 0.9, 0.6, 0.6, 2.2, 2.2, 1.4, 1.4, 4];
const RADIUS = [0.1, 0.09, 0.15, 0.04, 0.04, 0.05, 0.05, 0.06, 0.06, 0.075, 0.075, 0.09]; // how far each point stays above the ground
export const HAND = Object.freeze({ R: PT.HR, L: PT.HL }); export const ELBOW = Object.freeze({ R: PT.ER, L: PT.EL }); export const KNEE = Object.freeze({ R: PT.KR, L: PT.KL }); export const ANKLE = Object.freeze({ R: PT.AR, L: PT.AL });
const SIDES = ['R', 'L'];

/** An angle measured from straight down, positive towards the front (+x): a limb hanging straight is 0. */
const angDown = (vx, vy) => Math.atan2(vx, -vy);
/** An angle measured from straight up, positive towards the front: the body standing straight is 0. */
const angUp = (vx, vy) => Math.atan2(vx, vy);

/**
 * Where every point is for a set of joint angles. d: bone lengths { L1 (hips to mid-spine), L2 (mid-spine to shoulders), drop, Lh, l1, l2, ua, fa }.
 * a: { P: [x, y], phi (the lower back, from upright), phi2 (the upper back; the same as phi when the spine is straight), psi (the head), arm: { R: [raise, bend], L }, leg: { R: [hip, knee bend], L } }.
 * These are the numbers the rig's channels carry: pelvis tilt, neck tilt, arm swing, elbow bend.
 */
export function bodyFromAngles(d, a) {
  const pts = new Array(N); const phi2 = a.phi2 ?? a.phi;
  const P = a.P; const Mid = [P[0] + d.L1 * Math.sin(a.phi), P[1] + d.L1 * Math.cos(a.phi)]; const Sh = [Mid[0] + d.L2 * Math.sin(phi2), Mid[1] + d.L2 * Math.cos(phi2)];
  const J = [Sh[0] + d.drop * Math.sin(phi2), Sh[1] + d.drop * Math.cos(phi2)];
  pts[PT.P] = [P[0], P[1]]; pts[PT.M] = Mid; pts[PT.S] = Sh; pts[PT.H] = [J[0] + d.Lh * Math.sin(a.psi), J[1] + d.Lh * Math.cos(a.psi)];
  for (const s of SIDES) {
    const [raise, bend] = a.arm[s]; const tu = raise - phi2; const tf = tu + bend;
    const E = [Sh[0] + d.ua * Math.sin(tu), Sh[1] - d.ua * Math.cos(tu)];
    pts[ELBOW[s]] = E; pts[HAND[s]] = [E[0] + d.fa * Math.sin(tf), E[1] - d.fa * Math.cos(tf)];
    const [hip, knee] = a.leg[s]; const tt = hip - a.phi; const ts = tt - knee;
    const K = [P[0] + d.l1 * Math.sin(tt), P[1] - d.l1 * Math.cos(tt)];
    pts[KNEE[s]] = K; pts[ANKLE[s]] = [K[0] + d.l2 * Math.sin(ts), K[1] - d.l2 * Math.cos(ts)];
  }
  return pts;
}

/** The joint angles of a set of points: the inverse of bodyFromAngles. */
export function anglesOf(d, pts) {
  const P = pts[PT.P]; const Mid = pts[PT.M]; const Sh = pts[PT.S];
  const phi = angUp(Mid[0] - P[0], Mid[1] - P[1]); const phi2 = angUp(Sh[0] - Mid[0], Sh[1] - Mid[1]);
  const J = [Sh[0] + d.drop * Math.sin(phi2), Sh[1] + d.drop * Math.cos(phi2)];
  const psi = angUp(pts[PT.H][0] - J[0], pts[PT.H][1] - J[1]);
  const arm = {}; const leg = {};
  for (const s of SIDES) {
    const E = pts[ELBOW[s]]; const Hd = pts[HAND[s]]; const tu = angDown(E[0] - Sh[0], E[1] - Sh[1]); const tf = angDown(Hd[0] - E[0], Hd[1] - E[1]);
    arm[s] = [wrapA(tu + phi2), wrapA(tf - tu)];
    const K = pts[KNEE[s]]; const A = pts[ANKLE[s]]; const tt = angDown(K[0] - P[0], K[1] - P[1]); const ts = angDown(A[0] - K[0], A[1] - K[1]);
    leg[s] = [wrapA(tt + phi), wrapA(tt - ts)];
  }
  return { P: [P[0], P[1]], phi, phi2, psi, arm, leg };
}

/** A body at rest in the given joint angles. The same angles are what its muscles aim for until they are changed (body.target). */
export function createBody(d, a) {
  const pts = bodyFromAngles(d, a);
  const b = { d, x: Float64Array.from(pts, (q) => q[0]), y: Float64Array.from(pts, (q) => q[1]), ox: null, oy: null, target: JSON.parse(JSON.stringify({ ...a, phi2: a.phi2 ?? a.phi })), grip: { R: null, L: null }, cool: { R: 0, L: 0 }, drag: null, t: 0, contact: new Uint8Array(N), grounded: false };
  b.ox = Float64Array.from(b.x); b.oy = Float64Array.from(b.y);
  return b;
}
export const pointsOf = (b) => Array.from(b.x, (x, i) => [x, b.y[i]]);
export const anglesNow = (b) => anglesOf(b.d, pointsOf(b));
/** Every point moves at the same velocity (leg lengths a second): a throw or a shove. The step is one frame's worth of substeps. */
export function setVelocity(b, vx, vy, fps = 24) { const dt = 1 / (fps * SUB); for (let i = 0; i < N; i++) { b.ox[i] = b.x[i] - vx * dt; b.oy[i] = b.y[i] - vy * dt; } }
export function shove(b, vx, vy, fps = 24) { const dt = 1 / (fps * SUB); for (let i = 0; i < N; i++) { b.ox[i] -= vx * dt; b.oy[i] -= vy * dt; } }
export const velocityOf = (b, i, fps = 24) => [((b.x[i] - b.ox[i]) * fps * SUB), ((b.y[i] - b.oy[i]) * fps * SUB)];
export const centreOfMass = (b) => { let m = 0; let x = 0; let y = 0; for (let i = 0; i < N; i++) { m += MASS[i]; x += MASS[i] * b.x[i]; y += MASS[i] * b.y[i]; } return [x / m, y / m]; };

/** Takes hold of hold number k with a hand. */
export function grip(b, side, k) { b.grip[side] = k; }
export function release(b, side, cool = 0.6) { if (b.grip[side] != null) { b.grip[side] = null; b.cool[side] = cool; } }

/** The pointer takes a point: it follows the pointer while dragged, and on letting go the body keeps the pointer's speed (a throw). Times are in seconds. */
export function dragStart(b, i, x, y, now = 0) { b.drag = { i, x, y, hist: [{ x, y, t: now }] }; }
export function dragMove(b, x, y, now = 0) { if (!b.drag) return; b.drag.x = x; b.drag.y = y; const h = b.drag.hist; h.push({ x, y, t: now }); while (h.length > 2 && now - h[0].t > 0.12) h.shift(); }
export function dragEnd(b, now = 0, { fps = 24, scale = 0.6 } = {}) {
  const dr = b.drag; b.drag = null; if (!dr) return;
  const h = dr.hist; const a = h[0]; const z = h[h.length - 1];
  if (h.length < 2 || now - z.t > 0.12 || z.t - a.t < 0.02) return; // it had stopped before it was let go
  const dt = z.t - a.t;
  setVelocity(b, clamp(((z.x - a.x) / dt) * scale, -10, 10), clamp(((z.y - a.y) / dt) * scale, -10, 10), fps);
}

/**
 * A spring at a joint. J is the joint, Q the far end of the bone it hangs from, C the far end of the bone being moved. The angle from J->Q round to J->C (measured from straight up, the same
 * convention as above) is pulled towards relTarget by a share of the way. The two bones are turned in opposite directions, the lighter and shorter one more, and all three points are then
 * shifted together so that the spring adds no push to the body as a whole: a muscle moves the limbs against the body, it cannot lift the body by itself.
 */
let turnCap = Infinity; // the most a joint may be turned in one pass: muscles are strong but not instant
function jointSpring(b, J, Q, C, relTarget, share, uncapped = false) {
  if (share <= 0) return;
  const qx = b.x[Q] - b.x[J]; const qy = b.y[Q] - b.y[J]; const cx = b.x[C] - b.x[J]; const cy = b.y[C] - b.y[J];
  const lq = Math.hypot(qx, qy) || 1e-9; const lc = Math.hypot(cx, cy) || 1e-9;
  const aq = angUp(qx, qy); const ac = angUp(cx, cy);
  let da = wrapA(relTarget - wrapA(ac - aq)) * share;
  if (!uncapped) da = clamp(da, -turnCap, turnCap);
  const iq = MASS[Q] * lq * lq; const ic = MASS[C] * lc * lc; const wc = iq / (iq + ic); const wq = 1 - wc;
  const nq = aq - da * wq; const nc = ac + da * wc;
  const Qx = b.x[J] + lq * Math.sin(nq); const Qy = b.y[J] + lq * Math.cos(nq); const Cx = b.x[J] + lc * Math.sin(nc); const Cy = b.y[J] + lc * Math.cos(nc);
  const dqx = Qx - b.x[Q]; const dqy = Qy - b.y[Q]; const dcx = Cx - b.x[C]; const dcy = Cy - b.y[C];
  const M = MASS[J] + MASS[Q] + MASS[C]; const sx = -(MASS[Q] * dqx + MASS[C] * dcx) / M; const sy = -(MASS[Q] * dqy + MASS[C] * dcy) / M;
  b.x[Q] = Qx + sx; b.y[Q] = Qy + sy; b.x[C] = Cx + sx; b.y[C] = Cy + sy; b.x[J] += sx; b.y[J] += sy;
}

/**
 * Advances the body by `frames` frames.
 * env: { gravity (1 is the earth's, 0 is space), drag (how fast the air slows it: 0 to 8 a second), strength (muscles, 0 limp to 1 firm; 0 is a rag doll), limbs (0 to 1: how firmly the arms and head are held), spine (how firm the back is), balance (0 to 1: how hard it keeps upright on its feet),
 *        ground(x) -> height of the ground at x, xmin and xmax and ymax (walls and a ceiling it bounces off), holds: [{ x, y }], reach (how close a hand has to come to take hold), autoGrab, bounce, friction, fps }
 */
export function stepBody(b, env, frames = 1) {
  for (let f = 0; f < frames; f++) stepFrame(b, env, 1 / (env.fps || 24));
}

function stepFrame(b, env, frameDt) {
  const dt = frameDt / SUB; const d = b.d; const g = G0 * (env.gravity ?? 1); const drag = clamp(env.drag ?? 0.15, 0, 8);
  const ground = env.ground || (() => 0); const holds = env.holds || [];
  const st0 = clamp(env.strength ?? 0.8, 0, 1); const bal = clamp(env.balance ?? 0.8, 0, 1); const mu = clamp(env.friction ?? 0.6, 0, 1); const bounce = clamp(env.bounce ?? 0.1, 0, 0.8);
  const im = MASS.map((m) => 1 / m); const xmin = env.xmin ?? -Infinity; const xmax = env.xmax ?? Infinity; const ymax = env.ymax ?? Infinity;
  const share = (k) => 1 - (1 - clamp(k, 0, 0.98)) ** (1 / ITER);
  const bones = [[PT.P, PT.M, d.L1], [PT.M, PT.S, d.L2], [PT.S, PT.ER, d.ua], [PT.ER, PT.HR, d.fa], [PT.S, PT.EL, d.ua], [PT.EL, PT.HL, d.fa], [PT.P, PT.KR, d.l1], [PT.KR, PT.AR, d.l2], [PT.P, PT.KL, d.l1], [PT.KL, PT.AL, d.l2]];
  const vpre = new Float64Array(2 * N);
  for (let s = 0; s < SUB; s++) {
    // a body that has come down on its back, side or head goes slack: muscles cannot push a sprawled body about, and trying to makes it hop
    let sprawled = false; for (const i of [PT.P, PT.M, PT.S, PT.H, PT.ER, PT.EL, PT.HR, PT.HL, PT.KR, PT.KL]) if (b.contact[i]) { sprawled = true; break; }
    const st = sprawled && !(b.grip.R != null || b.grip.L != null) ? st0 * 0.12 : st0;
    turnCap = ((env.muscleSpeed ?? 9) * Math.max(0.15, st) * dt) / ITER;
    // --- move: what each point was doing carries on, gravity pulls, the air slows it
    const damp = Math.max(0, 1 - drag * dt);
    // the body's own motion against itself dies away (muscles and joints are not springs that ring for ever); the motion of the body as a whole is the air's business alone
    // (a swing of the whole body about a hold, or a spin in the air, is not damped: only what the body does against its own shape is)
    let mvx = 0; let mvy = 0; let mm = 0; let cx = 0; let cy = 0;
    for (let i = 0; i < N; i++) { mvx += MASS[i] * (b.x[i] - b.ox[i]); mvy += MASS[i] * (b.y[i] - b.oy[i]); cx += MASS[i] * b.x[i]; cy += MASS[i] * b.y[i]; mm += MASS[i]; }
    mvx /= mm; mvy /= mm; cx /= mm; cy /= mm;
    let ang = 0; let inertia = 0;
    for (let i = 0; i < N; i++) { const rx = b.x[i] - cx; const ry = b.y[i] - cy; ang += MASS[i] * (rx * (b.y[i] - b.oy[i] - mvy) - ry * (b.x[i] - b.ox[i] - mvx)); inertia += MASS[i] * (rx * rx + ry * ry); }
    const omega = ang / Math.max(1e-9, inertia);
    const inner = clamp(env.jointDamp ?? 0.05, 0, 0.5);
    for (let i = 0; i < N; i++) {
      const rx = b.x[i] - cx; const ry = b.y[i] - cy; const rigx = mvx - omega * ry; const rigy = mvy + omega * rx; // the speed the point would have if the body were one stiff piece
      const vx = (rigx + (b.x[i] - b.ox[i] - rigx) * (1 - inner)) * damp; const vy = (rigy + (b.y[i] - b.oy[i] - rigy) * (1 - inner)) * damp;
      b.ox[i] = b.x[i]; b.oy[i] = b.y[i]; b.x[i] += vx; b.y[i] += vy - g * dt * dt;
      vpre[i * 2] = vx; vpre[i * 2 + 1] = vy - g * dt * dt;
    }
    for (const sd of SIDES) b.cool[sd] = Math.max(0, b.cool[sd] - dt);
    // --- a hand that comes near a hold takes it
    if (env.autoGrab !== false && holds.length) {
      const reach = env.reach ?? 0.16;
      for (const sd of SIDES) {
        if (b.grip[sd] != null || b.cool[sd] > 0) continue;
        const h = HAND[sd];
        for (let k = 0; k < holds.length; k++) if (Math.hypot(b.x[h] - holds[k].x, b.y[h] - holds[k].y) < reach) { grip(b, sd, k); break; }
      }
    }
    const gripped = { R: b.grip.R != null ? holds[b.grip.R] : null, L: b.grip.L != null ? holds[b.grip.L] : null };
    // --- constraints and muscles, solved a little at a time, several times over
    for (let it = 0; it < ITER; it++) {
      for (const [i, j, L] of bones) {
        const dx = b.x[j] - b.x[i]; const dy = b.y[j] - b.y[i]; const dist = Math.hypot(dx, dy) || 1e-9; const e = (dist - L) / dist; const wi = im[i]; const wj = im[j]; const ws = wi + wj;
        b.x[i] += dx * e * (wi / ws); b.y[i] += dy * e * (wi / ws); b.x[j] -= dx * e * (wj / ws); b.y[j] -= dy * e * (wj / ws);
      }
      // the head is on a neck from the top of the spine
      const phi2 = angUp(b.x[PT.S] - b.x[PT.M], b.y[PT.S] - b.y[PT.M]); const jx = b.x[PT.S] + d.drop * Math.sin(phi2); const jy = b.y[PT.S] + d.drop * Math.cos(phi2);
      { const dx = b.x[PT.H] - jx; const dy = b.y[PT.H] - jy; const dist = Math.hypot(dx, dy) || 1e-9; const e = (dist - d.Lh) / dist; const wH = im[PT.H]; const wS = im[PT.S] * 0.5; const ws = wH + wS;
        b.x[PT.H] -= dx * e * (wH / ws); b.y[PT.H] -= dy * e * (wH / ws); b.x[PT.S] += dx * e * (wS / ws); b.y[PT.S] += dy * e * (wS / ws); }
      // the back bends, but only so far
      { const bend = wrapA(angUp(b.x[PT.S] - b.x[PT.M], b.y[PT.S] - b.y[PT.M]) - angUp(b.x[PT.M] - b.x[PT.P], b.y[PT.M] - b.y[PT.P])); const lim = env.spineLimit ?? 1.1; if (bend > lim) jointSpring(b, PT.M, PT.P, PT.S, -Math.PI + lim, 0.5, true); else if (bend < -lim) jointSpring(b, PT.M, PT.P, PT.S, -Math.PI - lim, 0.5, true); }
      // elbows fold forward and knees fold back, and neither bends the wrong way
      for (const sd of SIDES) {
        const t1 = angDown(b.x[ELBOW[sd]] - b.x[PT.S], b.y[ELBOW[sd]] - b.y[PT.S]); const t2 = angDown(b.x[HAND[sd]] - b.x[ELBOW[sd]], b.y[HAND[sd]] - b.y[ELBOW[sd]]);
        const fe = wrapA(t2 - t1); if (fe < 0) jointSpring(b, ELBOW[sd], PT.S, HAND[sd], -Math.PI, 0.5, true); else if (fe > 2.7) jointSpring(b, ELBOW[sd], PT.S, HAND[sd], -Math.PI - 2.7, 0.5, true);
        const k1 = angDown(b.x[KNEE[sd]] - b.x[PT.P], b.y[KNEE[sd]] - b.y[PT.P]); const k2 = angDown(b.x[ANKLE[sd]] - b.x[KNEE[sd]], b.y[ANKLE[sd]] - b.y[KNEE[sd]]);
        const fk = wrapA(k1 - k2); if (fk < 0) jointSpring(b, KNEE[sd], PT.P, ANKLE[sd], -Math.PI, 0.5, true); else if (fk > 2.6) jointSpring(b, KNEE[sd], PT.P, ANKLE[sd], -Math.PI + 2.6, 0.5, true);
      }
      // muscles pull each joint back towards the target pose
      const tg = b.target;
      if (st > 0) {
        const lk = clamp(env.limbs ?? 0.5, 0, 1) * 2; // how firmly the arms and the head are held; the legs and the back are the muscles that keep it standing
        jointSpring(b, PT.M, PT.P, PT.S, tg.phi2 - tg.phi - Math.PI, share(st * 0.3 * clamp(env.spine ?? 1, 0, 1.5)));
        jointSpring(b, PT.S, PT.M, PT.H, tg.psi - tg.phi2 - Math.PI, share(st * 0.25 * lk));
        for (const sd of SIDES) {
          const armK = gripped[sd] ? 0.03 : 1; const w = share(st * 0.35 * armK * lk); const wl = share(st * 0.45);
          jointSpring(b, PT.S, PT.M, ELBOW[sd], -tg.arm[sd][0], w);
          jointSpring(b, ELBOW[sd], PT.S, HAND[sd], -Math.PI - tg.arm[sd][1], w);
          jointSpring(b, PT.P, PT.M, KNEE[sd], Math.PI - tg.leg[sd][0], wl);
          jointSpring(b, KNEE[sd], PT.P, ANKLE[sd], -Math.PI + tg.leg[sd][1], wl);
        }
        // keeping upright: with a foot on the ground the whole body leans back over its feet, turning about the planted ankle as a stiff piece (a body hanging by its hands or flying through the air does not).
        // It is a reflex for staying up: it fades out as the body tips past about half a radian, and a body on the ground gets up by no reflex.
        if (b.grounded && !gripped.R && !gripped.L) {
          let sx = 0; let sy = 0; let ns = 0; for (const a of [PT.AR, PT.AL]) if (b.contact[a]) { sx += b.x[a]; sy += b.y[a]; ns++; }
          if (ns) {
            sx /= ns; sy /= ns; let mx = 0; let my = 0; let mm = 0; for (let i = 0; i < N; i++) { mx += MASS[i] * b.x[i]; my += MASS[i] * b.y[i]; mm += MASS[i]; } mx /= mm; my /= mm;
            let vcx = 0; for (let i = 0; i < N; i++) vcx += MASS[i] * (b.x[i] - b.ox[i]); vcx = (vcx / mm) / dt; // how fast the body is travelling along the ground: a body that is running away from its feet is stumbling, and there is nothing to balance
            const lean = angUp(mx - sx, my - sy); const upright = Math.max(0, 1 - Math.abs(lean) / 0.9) * Math.max(0, 1 - Math.abs(vcx) / 3);
            const balCap = (env.balanceSpeed ?? 1.1) * dt / ITER; const da = clamp(-lean * share(bal * st * 0.5 * upright), -balCap, balCap); const c = Math.cos(da); const s2 = Math.sin(da);
            for (const i of [PT.P, PT.M, PT.S, PT.H, PT.ER, PT.EL, PT.HR, PT.HL, PT.KR, PT.KL]) { const dx = b.x[i] - sx; const dy = b.y[i] - sy; b.x[i] = sx + dx * c + dy * s2; b.y[i] = sy - dx * s2 + dy * c; }
          }
        }
      }
      // a hand on a hold stays on it: the hold does not move, so the arm and the whole body are drawn round it by the bones
      for (const sd of SIDES) if (gripped[sd]) { const h = HAND[sd]; b.x[h] = gripped[sd].x; b.y[h] = gripped[sd].y; b.ox[h] = gripped[sd].x; b.oy[h] = gripped[sd].y; }
      // the pointer's hold on a point
      if (b.drag) { const i = b.drag.i; b.x[i] += (b.drag.x - b.x[i]) * 0.5; b.y[i] += (b.drag.y - b.y[i]) * 0.5; }
      // the ground and the tops of boxes
      for (let i = 0; i < N; i++) { const gy = ground(b.x[i]) + RADIUS[i]; if (b.y[i] < gy) { b.y[i] = gy; b.contact[i] = 1; } if (b.x[i] < xmin) b.x[i] = xmin; else if (b.x[i] > xmax) b.x[i] = xmax; if (b.y[i] > ymax) b.y[i] = ymax; }
    }
    // after the passes: points on the ground lose their downward speed (or bounce a little) and slide less
    let any = false;
    for (let i = 0; i < N; i++) {
      { const vx = b.x[i] - b.ox[i]; if (b.x[i] <= xmin + 1e-6 && vx < 0) b.ox[i] = b.x[i] + vx * bounce; else if (b.x[i] >= xmax - 1e-6 && vx > 0) b.ox[i] = b.x[i] + vx * bounce; const vy2 = b.y[i] - b.oy[i]; if (b.y[i] >= ymax - 1e-6 && vy2 > 0) b.oy[i] = b.y[i] + vy2 * bounce; }
      const gy = ground(b.x[i]) + RADIUS[i];
      if (b.y[i] <= gy + 1e-6) {
        const vy = vpre[i * 2 + 1]; const up = vy < -0.004 ? -vy * bounce : 0;
        b.oy[i] = b.y[i] - up; const sv = b.x[i] - b.ox[i]; b.ox[i] = Math.abs(sv) < mu * 0.6 * dt ? b.x[i] : b.x[i] - sv * (1 - mu * 0.35); // a foot that is hardly moving sticks
        if (i === PT.AR || i === PT.AL) any = true;
      } else b.contact[i] = 0;
    }
    b.grounded = any;
    // nothing a body does moves faster than a fall from a great height: a safety net against a runaway
    const cap = 30 * dt; for (let i = 0; i < N; i++) { const vx = b.x[i] - b.ox[i]; const vy = b.y[i] - b.oy[i]; const v = Math.hypot(vx, vy); if (v > cap) { b.ox[i] = b.x[i] - vx * (cap / v); b.oy[i] = b.y[i] - vy * (cap / v); } }
    b.t += dt;
  }
  // a hand pulled well away from the hold it is on lets go
  if (b.drag) for (const sd of SIDES) if (b.grip[sd] != null && b.drag.i === HAND[sd]) { const hl = holds[b.grip[sd]]; if (hl && Math.hypot(b.drag.x - hl.x, b.drag.y - hl.y) > 0.3) release(b, sd, 0.8); }
}
