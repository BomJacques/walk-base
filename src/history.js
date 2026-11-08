// Undo and redo over snapshots of the settings. A snapshot is a JSON string, so comparing and storing are cheap and nothing is shared by reference.
// Changes that arrive in quick succession (a slider being dragged, a take being recorded) are folded into one step.

export class History {
  /** limit: most steps kept. gap: milliseconds within which changes count as one step. */
  constructor({ limit = 100, gap = 500 } = {}) {
    this.limit = limit; this.gap = gap;
    this.stack = []; this.i = -1; this.last = -Infinity;
  }
  /** Start again from this state. */
  reset(snap) { this.stack = [snap]; this.i = 0; this.last = -Infinity; }
  get canUndo() { return this.i > 0; }
  get canRedo() { return this.i >= 0 && this.i < this.stack.length - 1; }
  get current() { return this.stack[this.i]; }
  /** Note the state after a change. Returns true when it was new. */
  record(snap, now = Date.now()) {
    if (this.i < 0) { this.reset(snap); return true; }
    if (snap === this.stack[this.i]) return false;
    // A change soon after the last one extends that step, unless there is nothing before it to go back to.
    if (now - this.last < this.gap && this.i > 0 && !this.canRedo) {
      this.stack[this.i] = snap; this.last = now; return true;
    }
    this.stack.length = this.i + 1; // a new change discards the redo steps
    this.stack.push(snap); this.i += 1; this.last = now;
    if (this.stack.length > this.limit) { this.stack.shift(); this.i -= 1; }
    return true;
  }
  /** The previous state, or null. */
  undo() { if (!this.canUndo) return null; this.i -= 1; this.last = -Infinity; return this.stack[this.i]; }
  redo() { if (!this.canRedo) return null; this.i += 1; this.last = -Infinity; return this.stack[this.i]; }
  /** After restoring, the app may normalise the state slightly; keep the stored copy in step without making a new step. */
  settle(snap) { if (this.i >= 0) this.stack[this.i] = snap; }
}
