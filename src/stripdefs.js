// The settings of a swinging strip (cape, hair, scarf), shared by the drawing code and the simulation.
export const STRIP_DEFAULTS = { nodes: 8, stiff: 0.12, damp: 0.05, gravity: 1, wind: 0, gusts: 1, follow: 0, angle: 0, taper: 0.6 };
export const STRIP_LIMITS = { nodes: [3, 16, 1], stiff: [0, 1, 0.01], damp: [0, 0.4, 0.005], gravity: [0, 2, 0.01], wind: [-2, 2, 0.01], gusts: [0, 4, 1], follow: [0, 1, 0.01], angle: [-90, 90, 1], taper: [0.1, 1.5, 0.01] };
/** Settings forced into range, with anything missing set to its default. */
export const cleanPhys = (p = {}) => Object.fromEntries(Object.entries(STRIP_DEFAULTS).map(([k, d]) => {
  const [lo, hi] = STRIP_LIMITS[k]; const v = Number(p?.[k]); const x = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d;
  return [k, k === 'nodes' || k === 'gusts' ? Math.round(x) : x];
}));
