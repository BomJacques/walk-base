// Physics for scenery: a prop that is dropped (and bounces, and rolls or slides to a stop) or a box that is pushed over.
// Worked out ahead of time, frame by frame, from the prop's own numbers alone, so the same settings always give the same motion and any frame can be shown at once.
// Pure: no canvas, no state but a cache.

const G = 9.8; // metres a second, each second
const SUB = 8; // steps of the sum inside each frame
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(Number(v)) ? Number(v) : lo));

export const PHYS_MODES = [['none', 'None'], ['drop', 'Drop'], ['tip', 'Push over']];
export const hasPhysics = (q) => Boolean(q && (q.phys === 'drop' || (q.phys === 'tip' && q.kind === 'box')));

/**
 * The motion of a prop for frames 0..n: [{ dx, y, tilt }], dx metres along from where it was put, y the height of its base, tilt degrees (signed: positive falls towards its own +x).
 * Before q.physStart it stands as it was put.
 */
export function simulateProp(q, n, fps = 24) {
  const start = Math.max(0, Math.round(q.physStart || 0)); const dt = 1 / (Math.max(1, fps) * SUB);
  const e = clamp(q.bounce ?? 0.5, 0, 0.95); const mu = clamp(q.friction ?? 0.4, 0, 1);
  const y0 = Number(q.y) || 0; const floor = Math.min(0, y0); const round = q.kind === 'ball';
  const tip = q.phys === 'tip' && q.kind === 'box';
  let y = y0; let vy = 0; let dx = 0; let vx = tip ? 0 : clamp(q.throwX ?? 0, -12, 12); let down = y <= floor;
  // pushing over: the box turns about its bottom edge. th is how far it has turned, om how fast.
  const w = Math.max(0.01, q.w); const h = Math.max(0.01, q.h); const r = Math.hypot(w, h) / 2; const a0 = Math.atan2(h, w); const I = (w * w + h * h) / 3;
  const push = clamp(q.push ?? 1.3, -3, 3); const dir = push < 0 ? -1 : 1;
  let th = 0; let om = Math.sqrt((2 * G * r * (1 - Math.sin(a0))) / I) * Math.abs(push); // push 1 is just enough to bring it to the point of balance
  const out = [];
  for (let f = 0; f <= n; f++) {
    out.push({ dx, y, tilt: tip ? (th * 180 / Math.PI) * dir : 0 });
    if (f < start) continue;
    for (let s = 0; s < SUB; s++) {
      if (tip) {
        om += (-(G * r * Math.cos(a0 + th)) / I) * dt; th += om * dt;
        if (th >= Math.PI / 2) { th = Math.PI / 2; om = om > 0.6 ? -om * e * 0.35 : 0; } // it lands on its side, with a small bounce
        else if (th <= 0) { th = 0; om = om < -0.6 ? -om * e * 0.35 : 0; } // not pushed hard enough: it rocks back
        continue;
      }
      if (!down) {
        vy -= G * dt; y += vy * dt;
        if (y <= floor) { y = floor; vx *= 1 - 0.25 * mu; if (Math.abs(vy) * e < 0.35) { vy = 0; down = true; } else vy = -vy * e; }
      } else if (vx !== 0) { // a ball rolls a long way, a box scrapes to a stop
        const dec = (round ? 0.08 : 1) * mu * G * dt; vx = Math.abs(vx) <= dec ? 0 : vx - Math.sign(vx) * dec;
      }
      dx += vx * dt;
    }
  }
  return out;
}

const cache = new Map();
const keyOf = (q, fps) => [q.kind, q.phys, q.physStart, q.bounce, q.friction, q.throwX, q.push, q.y, q.w, q.h, fps].join('|');
/** The prop as it is at a frame: the same prop, moved and turned. */
export function movedProp(q, frame, fps = 24) {
  if (!hasPhysics(q)) return q;
  const f = Math.max(0, Math.min(20000, Math.round(frame))); const k = keyOf(q, fps); let hit = cache.get(q.id);
  if (!hit || hit.k !== k || hit.track.length <= f) { hit = { k, track: simulateProp(q, Math.max(f + 240, hit && hit.k === k ? hit.track.length * 2 : 0), fps) }; cache.set(q.id, hit); if (cache.size > 80) cache.delete(cache.keys().next().value); }
  const s = hit.track[f]; const a = (q.rot * Math.PI) / 180;
  return { ...q, x: q.x + Math.cos(a) * s.dx, z: q.z - Math.sin(a) * s.dx, y: s.y, tilt: s.tilt };
}
