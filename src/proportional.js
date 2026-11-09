// Proportional editing, as in Blender: moving one control point also moves its neighbours, by less the further away they are, so a drag makes a smooth arc
// instead of a spike. One setting is shared by the channel curves, the automation lanes and the dots on a motion arc.

/** The falloff shapes. x is the distance as a share of the radius (0 at the point, 1 at the edge); the weight goes from 1 down to 0. */
export const FALLOFFS = [['smooth', 'Smooth'], ['sphere', 'Sphere'], ['root', 'Root'], ['linear', 'Linear'], ['sharp', 'Sharp'], ['constant', 'Constant']];

export function falloff(type, x) {
  if (x <= 0) return 1;
  if (type === 'constant') return x <= 1 ? 1 : 0;
  if (x >= 1) return 0;
  const t = 1 - x;
  switch (type) {
    case 'sphere': return Math.sqrt(1 - x * x);
    case 'root': return Math.sqrt(t);
    case 'linear': return t;
    case 'sharp': return t * t;
    default: return t * t * (3 - 2 * t); // smooth
  }
}

/** The shared setting: on or off, the radius (a share of the cycle or the performance) and the falloff shape. */
export const PROP = { on: false, radius: 0.2, type: 'smooth' };
const KEY = 'walkbase.proportional';
export function loadProp() {
  try { const r = JSON.parse(localStorage.getItem(KEY) || 'null'); if (r) setProp(r, false); } catch { /* none */ }
  return PROP;
}
export function setProp(patch, keep = true) {
  if (typeof patch.on === 'boolean') PROP.on = patch.on;
  if (Number.isFinite(patch.radius)) PROP.radius = Math.min(0.5, Math.max(0.02, patch.radius));
  if (FALLOFFS.some(([k]) => k === patch.type)) PROP.type = patch.type;
  if (keep) { try { localStorage.setItem(KEY, JSON.stringify(PROP)); } catch { /* not kept */ } }
}

/** The distance between two positions in a cycle (0 to 1, wrapping round). */
export const wrapDist = (a, b) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };

/**
 * After the handle at `index` has been dragged from base[index] to pts[index], moves the other handles' values along with it, by the falloff of their distance.
 * dist(a, b) is the distance between two handles as a share of the whole. Only values move, so the handles keep their order. Edits pts in place.
 */
export function proportionalMove(pts, base, index, dist, prop = PROP) {
  if (!prop.on) return pts;
  const dv = pts[index].v - base[index].v;
  if (!dv) return pts;
  for (let i = 0; i < pts.length; i++) {
    if (i === index) continue;
    const w = falloff(prop.type, dist(base[i], base[index]) / prop.radius);
    if (w > 0) pts[i].v = base[i].v + dv * w;
  }
  return pts;
}
