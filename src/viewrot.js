// Turning the page with two fingers, as in a paint app: the angle the fingers have twisted, a small snap to square, and keeping the point between the fingers where it is.
const TAU = Math.PI * 2;
/** How far the line between two fingers has turned, from angle a to angle b, as a turn between -pi and pi. */
export function turned(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d <= -Math.PI) d += TAU; return d; }
/** A turn, kept between -pi and pi, and snapped to square (0, 90, 180, 270 degrees) when it is within tol of it. */
export function snapTurn(r, tol = (3 * Math.PI) / 180) { const n = turned(0, r); const q = Math.round(n / (Math.PI / 2)) * (Math.PI / 2); return Math.abs(n - q) <= tol ? turned(0, q) : n; }
/** The point (x, y) turned by rot about (cx, cy). */
export function spin(x, y, cx, cy, rot) { const c = Math.cos(rot); const s = Math.sin(rot); return [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c]; }
/** How far the middle of the page has to move so that the point (mx, my), between the fingers, stays under them while the page turns by d about its middle (cx, cy). */
export function holdPoint(mx, my, cx, cy, d) { const [x, y] = spin(mx, my, cx, cy, d); return [mx - x, my - y]; }
