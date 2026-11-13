// The stepping of an animal with many legs, each leg on its own. A leg takes a few steps in every cycle, and each step has its own length of time, its own landing place, its own lift
// and its own swing, picked by a fixed hash so the same frame always gives the same pose and the cycle still loops. The legs are only loosely tied together: a leg is set a place in the
// order (a tetrapod, a tripod or a wave) and then wanders from it. Pure logic, no DOM.

const TAU = Math.PI * 2;
const wrap = (u) => u - Math.floor(u);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (x) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

/** A repeatable number in 0..1 from three whole numbers. */
export function hash01(a, b, c) { const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + 0.5) * 43758.5453; return x - Math.floor(x); }
const signed = (a, b, c) => hash01(a, b, c) * 2 - 1;

/**
 * The steps one leg takes in a cycle. o: { seed, n (steps a cycle), phase (where the first starts, 0..1), duty (share of each step on the ground), D (how far the body travels in a cycle),
 * jT (how much each step's length of time varies), jS (swing time), jP (landing place, in reach), jL (lift), reach }. Returns the list of steps, in order.
 */
export function legSchedule(o) {
  const n = Math.max(1, Math.round(o.n)); const raw = []; let sum = 0;
  for (let i = 0; i < n; i++) { const t = Math.max(0.35, 1 + (o.jT ?? 0) * signed(o.seed, i, 1)); raw.push(t); sum += t; }
  const T = raw.map((t) => t / sum); const steps = []; let c = 0;
  for (let i = 0; i < n; i++) {
    const swing = clamp(T[i] * (1 - o.duty) * (1 + (o.jS ?? 0) * signed(o.seed, i, 2)), 0.02, T[i] * 0.62);
    steps.push({ start: c, T: T[i], swing, land: (o.jP ?? 0) * (o.reach ?? 1) * signed(o.seed, i, 3), lift: (o.lift ?? 0.1) * (1 + (o.jL ?? 0) * signed(o.seed, i, 4)), dip: hash01(o.seed, i, 5) });
    c += T[i];
  }
  for (let i = 0; i < n; i++) { const prev = steps[(i + n - 1) % n]; steps[i].from = prev.land - o.D * (steps[i].T - steps[i].swing); }
  return steps;
}

/** Where the foot is, along the way the body travels, at phase u in the cycle: { x (from where it rests), y (lift), stance, k (how far through the swing), i (which step) }. */
export function legFoot(u, o, steps = legSchedule(o)) {
  const w = wrap(u - (o.phase || 0)); let st = steps[steps.length - 1];
  for (const s of steps) if (w >= s.start && w < s.start + s.T) { st = s; break; }
  const prev = steps[(steps.indexOf(st) + steps.length - 1) % steps.length]; const tau = w - st.start; const stance = st.T - st.swing;
  if (tau < stance) return { x: prev.land - o.D * tau, y: 0, stance: true, k: 0, i: steps.indexOf(st) };
  const k = clamp((tau - stance) / st.swing, 0, 1); const prog = 0.8 * (1 - Math.pow(1 - k, 1.7)) + 0.2 * smooth(k);
  const touch = o.touch ? o.touch * Math.max(0, Math.sin(TAU * k * 1.5 - 0.4)) * smooth(k * 3) * (1 - k) * 0.6 * st.lift : 0; // a probing tap near the end of the swing, for the feelers up front
  return { x: st.from + (st.land - st.from) * prog, y: st.lift * Math.pow(Math.sin(Math.PI * Math.pow(k, 0.8)), 1.25) + touch, stance: false, k, i: steps.indexOf(st) };
}

/** How many steps each leg takes in a cycle so that one step's stance covers a comfortable stretch of ground (`reach` is the leg's reach, `stretch` the share of it a step may cover). */
export const stepsFor = (D, duty, reach, stretch = 0.4) => clamp(Math.round((D * duty) / Math.max(0.05, reach * stretch)), 1, 6);

/** Which set a leg belongs to when the sets take turns: 'tetrapod' (legs 1 and 3 of one side with 2 and 4 of the other), 'tripod' (1 and 3 of one side with 2 of the other) or 'wave'. j is the leg pair, front is 0. */
export function setOf(kind, j, side, pairs) {
  const odd = (j + (side === 'L' ? 1 : 0)) % 2;
  if (kind === 'wave') return ((pairs - 1 - j) * 0.16) + (side === 'L' ? 0.5 : 0); // not sets: each leg lifts a little after the one behind it
  return odd * 0.5;
}
