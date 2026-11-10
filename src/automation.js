// Automation: parameters that change over a longer performance, recorded live like a synth's controller automation.
// Pure logic, no DOM. A lane is a list of {t, v} points (t in frames); between points the value eases from one to the next.
// Targets: 'p:<gait parameter>', 'cadence' (how fast the cycle turns, 1 = built-in), and 'c:<channel>:amount', 'c:<channel>:offset' or 'c:<channel>:fix'.
// A 'fix' lane is a correction: it is added to the channel's offset, so it nudges a part back into line without changing the movement under it.

export const CADENCE = 'cadence';
export const targetOfParam = (id) => `p:${id}`;
export const targetOfChannel = (id, what) => `c:${id}:${what}`;
export function parseTarget(target) {
  if (target === CADENCE) return { kind: 'cadence' };
  if (target.startsWith('p:')) return { kind: 'param', id: target.slice(2) };
  if (target.startsWith('c:')) { const [, id, what] = target.match(/^c:(.+):(amount|offset|fix)$/) || []; return id ? { kind: 'channel', id, what } : null; }
  return null;
}

const smooth = (x) => x * x * (3 - 2 * x);
const sorted = (pts) => pts.slice().sort((a, b) => a.t - b.t);

/** Value of a lane at frame t. Before the first point it holds the first value; after the last, the last. An empty lane returns `fallback`. */
export function laneValue(lane, t, fallback) {
  const pts = lane?.pts;
  if (!pts || !pts.length) return fallback;
  if (t <= pts[0].t) return pts[0].v;
  const last = pts[pts.length - 1];
  if (t >= last.t) return last.v;
  let i = 0;
  while (i < pts.length - 2 && pts[i + 1].t <= t) i++;
  const a = pts[i]; const b = pts[i + 1];
  if (b.t === a.t) return b.v;
  const x = (t - a.t) / (b.t - a.t);
  return lane.interp === 'linear' ? a.v + (b.v - a.v) * x : a.v + (b.v - a.v) * smooth(x);
}

export const hasLanes = (lanes) => Boolean(lanes && Object.values(lanes).some((l) => l.pts?.length));

/** Gait parameters at frame t. `live` holds values being recorded right now, which win over the lane. */
export function paramsAt(base, lanes, t, live = null) {
  if (!hasLanes(lanes) && !live) return base;
  const out = { ...base };
  for (const [target, lane] of Object.entries(lanes || {})) {
    const k = parseTarget(target);
    if (k?.kind === 'param' && lane.pts?.length && !(live && target in live)) out[k.id] = laneValue(lane, t, base[k.id]);
  }
  if (live) for (const [target, v] of Object.entries(live)) { const k = parseTarget(target); if (k?.kind === 'param') out[k.id] = v; }
  return out;
}

/** Channel settings at frame t: amount and offset taken from their lanes. */
export function motionAt(base, lanes, t, live = null) {
  if (!hasLanes(lanes) && !live) return base;
  const out = { ...base };
  const set = (id, what, v) => { out[id] = { ...(out[id] || {}), [what]: v }; };
  const fixes = [];
  for (const [target, lane] of Object.entries(lanes || {})) {
    const k = parseTarget(target);
    if (k?.kind === 'channel' && k.what === 'fix' && lane.pts?.length) fixes.push([k.id, laneValue(lane, t, 0)]);
    else if (k?.kind === 'channel' && lane.pts?.length && !(live && target in live)) set(k.id, k.what, laneValue(lane, t, k.what === 'amount' ? 1 : 0));
  }
  for (const [id, v] of fixes) out[id] = { ...(out[id] || {}), offset: (out[id]?.offset || 0) + v };
  if (live) for (const [target, v] of Object.entries(live)) { const k = parseTarget(target); if (k?.kind === 'channel') set(k.id, k.what, v); }
  return out;
}

/**
 * Runs the walk forward in time: the cycle phase u and the figure's position x at every frame.
 * Phase advances by cadence / cycleFrames each frame; position advances by the step length, two steps per cycle, so planted feet stay put.
 * Returns { u, x, plants } where plants lists where each foot lands.
 */
export function integrate(base, lanes, T, cycleFrames, footContact = null) {
  const u = new Float64Array(T + 1); const x = new Float64Array(T + 1);
  const px = new Float64Array(T + 1); const pz = new Float64Array(T + 1); let path = false; // where the figure is on the ground: the distance walked, turned by the heading at each moment
  const plants = [];
  for (let t = 0; t < T; t++) {
    const p = paramsAt(base, lanes, t);
    const cad = laneValue(lanes?.[CADENCE], t, 1);
    const du = (cad * 1) / cycleFrames;
    u[t + 1] = u[t] + du;
    x[t + 1] = x[t] + du * (p.rig === 'dog' ? p.dogStride : 2 * p.stepLength);
    const hr = ((p.heading || 0) * Math.PI) / 180; if (p.heading) path = true;
    px[t + 1] = px[t] + (x[t + 1] - x[t]) * Math.cos(hr); pz[t + 1] = pz[t] + (x[t + 1] - x[t]) * Math.sin(hr);
    if (footContact) {
      for (const [side, off] of [['R', 0], ['L', 0.5 + (p.asymTiming || 0)]]) {
        if (Math.floor(u[t + 1] - off + 1e-9) > Math.floor(u[t] - off + 1e-9)) plants.push({ side, t: t + 1, x: x[t + 1] + footContact(paramsAt(base, lanes, t + 1), side).x });
      }
    }
  }
  return { u, x, px, pz, path, plants };
}

/** Removes points that a straight line between their neighbours already describes, within eps. Keeps the first and last. */
export function thinPoints(pts, eps) {
  if (pts.length <= 2) return pts.slice();
  const keep = new Array(pts.length).fill(false); keep[0] = keep[pts.length - 1] = true;
  const rec = (a, b) => {
    let worst = -1; let wd = eps;
    for (let i = a + 1; i < b; i++) {
      const f = (pts[i].t - pts[a].t) / Math.max(1e-9, pts[b].t - pts[a].t);
      const d = Math.abs(pts[i].v - (pts[a].v + (pts[b].v - pts[a].v) * f));
      if (d > wd) { wd = d; worst = i; }
    }
    if (worst >= 0) { keep[worst] = true; rec(a, worst); rec(worst, b); }
  };
  rec(0, pts.length - 1);
  return pts.filter((_, i) => keep[i]);
}

/** Replaces a lane's points between t0 and t1 with new ones. */
export function replaceSpan(lane, t0, t1, fresh) {
  const keep = (lane?.pts || []).filter((q) => q.t < t0 || q.t > t1);
  return { ...(lane || {}), pts: sorted([...keep, ...fresh]) };
}

export function addPoint(lane, t, v) {
  const pts = (lane?.pts || []).filter((q) => q.t !== t);
  return { ...(lane || {}), pts: sorted([...pts, { t, v }]) };
}

/**
 * Records control moves as they happen during playback, with the two modes a synth offers.
 *   touch: records while you hold a control; on letting go it glides back to what was there.
 *   latch: records from the first touch and holds the last value until playback stops.
 * The caller feeds it the current frame; commit() returns the edited lanes.
 */
export class Recorder {
  constructor() { this.mode = 'off'; this.glide = 8; this.reset(); }

  reset() { this.items = new Map(); this.live = {}; }
  get armed() { return this.mode === 'touch' || this.mode === 'latch'; }
  setMode(mode) { this.mode = mode; this.reset(); }

  /** The values being recorded right now, so the figure follows your hand. */
  liveValues() { return { ...this.live }; }

  /** opts.hold: the value stays after the take (a change of state, like a pad), instead of gliding back or letting go when the take stops. */
  touch(target, t, value, opts = null) {
    if (!this.armed) return;
    let it = this.items.get(target);
    // `base` is the control's value before it was touched: what the frames before the take should keep.
    if (!it) { it = { target, t0: t, base: value, pts: [], held: false, writing: false, releasedAt: null, last: t - 1 }; this.items.set(target, it); }
    it.held = true; it.writing = true; it.releasedAt = null; if (opts?.hold) it.hold = true;
    this.live[target] = value;
    this.push(it, t, value);
  }

  set(target, t, value) {
    if (!this.armed) return;
    const it = this.items.get(target);
    if (!it?.writing) return;
    this.live[target] = value;
    this.push(it, t, value);
  }

  release(target, t) {
    const it = this.items.get(target);
    if (!it || !it.held || it.hold) return;
    it.held = false;
    if (this.mode === 'touch') { it.writing = false; it.releasedAt = t; delete this.live[target]; }
  }

  push(it, t, value) {
    const lastPt = it.pts[it.pts.length - 1];
    if (lastPt && lastPt.t === t) lastPt.v = value; else it.pts.push({ t, v: value });
    it.last = t;
  }

  /** Called every frame of playback: writing targets record the value they hold. */
  tick(t) {
    for (const it of this.items.values()) if (it.writing && t !== it.last) this.push(it, t, this.live[it.target]);
  }

  /** Ends the take at frame t. Returns the lanes with the recording written in. */
  commit(lanes, t, rangeOf = () => 1) {
    const out = { ...lanes };
    for (const it of this.items.values()) {
      if (!it.pts.length) continue;
      const end = it.writing ? t : (it.releasedAt ?? t);
      const pts = it.pts.slice();
      const old = out[it.target];
      // Touch mode: glide back to what the lane held, so letting go does not jump.
      // With no earlier automation the value glides back to what the control held before the take.
      const back = (at) => (old?.pts?.length ? laneValue(old, at, it.base) : it.base);
      let glideTo = !it.writing ? { t: end + this.glide, v: back(end + this.glide) } : null;
      if (it.writing && pts[pts.length - 1].t < t) pts.push({ t, v: pts[pts.length - 1].v });
      // Latch holds until the take stops, then lets go on the next frame.
      if (it.writing) glideTo = { t: t + 1, v: back(t + 1) };
      if (it.hold) glideTo = null; // it stays: nothing brings it back
      const fresh = thinPoints(pts, rangeOf(it.target) * 0.004);
      // Anchor the frame just before the take, so the earlier part of the lane does not ramp toward it.
      if (it.t0 > 0) fresh.unshift({ t: it.t0 - 1, v: old?.pts?.length ? laneValue(old, it.t0 - 1, it.base) : it.base });
      if (glideTo) fresh.push(glideTo);
      out[it.target] = replaceSpan(old, it.t0 - 1, glideTo ? glideTo.t : end, fresh);
    }
    this.reset();
    return out;
  }
}
