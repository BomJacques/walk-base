// The pen stroke engine: what happens to a pen's points between the finger and the page. Pure numbers, no canvas, so it can be tested.
// A stroke's point is [u, v] (old drawings, and shapes) or [u, v, p]: p is the width factor there, 0 to 1 rounded to two decimals, from the pencil's pressure or from the pen's speed (0.5 is the width asked for).
// A stroke with p on its points is painted as one smooth, tapered ribbon (see ink.js ribbon); one without paints exactly as it always did.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Whether a stroke's points carry a width factor (a stroke drawn with the stroke engine). */
export const isRich = (s) => Array.isArray(s?.pts) && s.pts.length > 0 && Array.isArray(s.pts[0]) && s.pts[0].length > 2;
/** A point with its width factor kept: `q` is the mapped [u, v], `src` the point it came from. */
export const keepWidth = (src, q) => (src.length > 2 ? [q[0], q[1], src[2]] : q);
export const roundP = (p) => Math.round(clamp(p, 0, 1) * 100) / 100;

/** How much a width factor widens the line: 0.5 is the width asked for, 0 is a thin line, 1 a heavy one. */
export const widthFactor = (p) => clamp(0.35 + 1.3 * p, 0.2, 1.8);
/** The width factor of a pen with no pressure: a little thinner the faster it goes (px per ms). */
export const speedToP = (speed) => 0.58 - 0.2 * clamp(speed / 2.5, 0, 1);

/** How far (in screen px) the stabiliser lags behind the pen for a smoothing strength 0 to 1: none at 0. */
export const lagFor = (strength) => 30 * clamp(strength, 0, 1) ** 2;
/** A fresh state for the stabiliser. */
export const newSmoother = () => ({ n: 0, x: 0, y: 0, p: 0.5, rx: 0, ry: 0, rp: 0.5, speed: 0, t: 0, run: 0 });
/**
 * Takes one more pen sample (screen position x, y; pressure `press` 0 to 1 or null when the device has none; time t in ms) and returns the stabilised point { x, y, p }.
 * The point follows the pen with a lag that is the same however fast the events come (the weight of a sample is worked out from the distance it moved), so a stroke does not change with the event rate.
 * With `finish` (0 to 1) it goes that share of the way to the true last point regardless of the lag: a stroke ends exactly where the pen lifted.
 */
export function smoothStep(st, x, y, press, t, strength, finish = null) {
  const lag = lagFor(strength);
  if (st.n === 0) { st.x = x; st.y = y; st.rx = x; st.ry = y; st.t = t; st.p = press == null ? 0.5 : clamp(press, 0, 1); st.rp = st.p; st.n = 1; return { x, y, p: st.p }; }
  const d = Math.hypot(x - st.rx, y - st.ry); if (finish == null) st.run += d; const dt = Math.max(1, t - st.t); st.rx = x; st.ry = y; st.rp = press == null ? st.rp : press;
  if (finish == null) { st.speed += (d / dt - st.speed) * 0.3; st.t = t; }
  const target = press == null ? speedToP(st.speed) : clamp(press, 0, 1);
  const lagNow = lag * Math.min(1, st.run / (3 * lag + 1e-9)); // the lag builds up over the first few lengths of it, so a stroke begins right where the pen went down
  const a = finish != null ? finish : lagNow < 0.01 ? 1 : 1 - Math.exp(-d / lagNow);
  st.x += (x - st.x) * a; st.y += (y - st.y) * a; st.p += (target - st.p) * Math.max(0.25, a); st.n++;
  return { x: st.x, y: st.y, p: st.p };
}

/** Halves the points of a stroke that is getting too long, keeping both ends: the stroke stays one stroke. */
export function decimate(pts) { return pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1); }

/** The line through P (canvas [x, y]) with more points where the gaps are wide, along a Catmull-Rom curve, so a fast stroke is round and not a polyline. W: a number for each point, which is carried along. */
export function densify(P, W, gap = 5) {
  const n = P.length; const Q = [P[0]]; const V = [W[0]];
  for (let i = 0; i < n - 1; i++) {
    const a = P[i]; const b = P[i + 1]; const l = Math.hypot(b[0] - a[0], b[1] - a[1]); const k = clamp(Math.ceil(l / gap), 1, 12);
    if (k > 1) {
      const p0 = P[Math.max(0, i - 1)]; const p3 = P[Math.min(n - 1, i + 2)];
      for (let j = 1; j < k; j++) {
        const t = j / k; const t2 = t * t; const t3 = t2 * t;
        const f = (c) => 0.5 * (2 * a[c] + (-p0[c] + b[c]) * t + (2 * p0[c] - 5 * a[c] + 4 * b[c] - p3[c]) * t2 + (-p0[c] + 3 * a[c] - 3 * b[c] + p3[c]) * t3);
        Q.push([f(0), f(1)]); V.push(W[i] + (W[i + 1] - W[i]) * t);
      }
    }
    Q.push(b); V.push(W[i + 1]);
  }
  return { Q, V };
}
const ease = (t) => { const c = clamp(t, 0, 1); return c * c * (3 - 2 * c); };
/**
 * The half widths along a stroke: Q the points on the canvas, F the width factor at each, w the width asked for (canvas units), `kind` the brush ('taper' for the brush pen), `tp` which ends continue elsewhere (1 start, 2 end: no taper there), minW the thinnest line.
 * The round brush tapers a little at both ends (a pen lifting off); the brush pen goes to a fine point at both. A short stroke tapers all through.
 */
export function halfWidths(Q, F, w, kind = 'round', tp = 0, minW = 0.6) {
  const n = Q.length; const cum = [0]; for (let i = 1; i < n; i++) cum.push(cum[i - 1] + Math.hypot(Q[i][0] - Q[i - 1][0], Q[i][1] - Q[i - 1][1])); const L = cum[n - 1] || 1; const H = [];
  for (let i = 0; i < n; i++) {
    let m;
    if (kind === 'taper') m = Math.max(0.1, Math.sin(Math.PI * Math.min(1, cum[i] / L)) ** 0.6);
    else { const s = tp & 1 ? 1 : 0.42 + 0.58 * ease(cum[i] / (1.1 * w)); const e = tp & 2 ? 1 : 0.35 + 0.65 * ease((L - cum[i]) / (1.6 * w)); m = Math.min(s, e); }
    H.push(Math.max(minW, w * widthFactor(F[i]) * m) / 2);
  }
  return H;
}
