// Body physics in the browser: the Physics tab, dragging the figure about, falling, hanging from a hold, floating, recording a take.
// Usage: node walkbase/tests/ui-bodyphys.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 300)); };

const browser = await pw[name].launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n) => { if (shots) await page.screenshot({ path: path.join(shots, `wb-bodyphys-${name}-${n}.png`) }); };
const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();
const until = (fn, arg, ms = 6000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);

await page.goto(process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href);
await page.waitForFunction(() => window.__walkBase);
await page.waitForTimeout(300);
await ev(() => { try { localStorage.clear(); } catch { /* none */ } });
await ev(() => { const w = window.__walkBase; w.S.scene = { actors: [], props: [] }; w.setFigure('human'); w.setTab('Physics'); });
await page.waitForTimeout(200);

// where the body is on the screen, in client pixels, and in the figure's own units
const where = () => ev(() => {
  const w = window.__walkBase; const { body } = w.physState(); const m = w.S.map; const info = w.S.last; const cam = info.cam; const px = info.pz.pelvisX;
  const toClient = (x, y) => { const p = cam.p([x + px, y, 0]); return [m.left + (m.x0 + (p.x / m.fcw) * m.zw) / m.d, m.top + (m.y0 + (p.y / m.fch) * m.zh) / m.d]; };
  return { pts: Array.from(body.x, (x, i) => toClient(x, body.y[i])), x: Array.from(body.x), y: Array.from(body.y), grip: { ...body.grip }, holds: w.S.phys.holds.map((h) => toClient(h.x, h.y)), toClient: null };
});
const drag = async (from, to, steps = 18, wait = 30) => { await page.mouse.move(from[0], from[1]); await page.mouse.down(); for (let i = 1; i <= steps; i++) { await page.mouse.move(from[0] + ((to[0] - from[0]) * i) / steps, from[1] + ((to[1] - from[1]) * i) / steps); await page.waitForTimeout(wait); } };

// ---- the tab and the switch
check('there is a Physics tab, separate from Auto', (await page.locator('[data-testid="tab-Physics"]').count()) === 1 && (await page.locator('[data-testid="tab-Auto"]').count()) === 1);
check('physics starts off', !(await ev(() => window.__walkBase.physActive())));
await q('phys-on').check(); await page.waitForTimeout(500);
check('turning it on leaves the walk alone: nothing is taken over until the figure is touched', await ev(async () => { const w = window.__walkBase; const a = []; for (const f of [0, 6, 12]) { w.setFrame(f); await new Promise((r) => setTimeout(r, 40)); a.push(w.S.last.pz.sides.R.ankle[0]); } w.setFrame(0); return !w.S.physLive && !w.physState().engaged && Math.max(...a) - Math.min(...a) > 0.05; }), await ev(() => Boolean(window.__walkBase.S.physLive)));
await q('phys-reset').click(); await page.waitForTimeout(400);
check('Stand it up gives the figure a body, standing on the ground', await ev(() => { const s = window.__walkBase.physState(); return s.body && Math.abs(s.body.y[9] - 0.075) < 0.01 && s.body.y[0] > 1; }));
check('the controls are there: gravity, muscles, holds, record', (await Promise.all(['phys-gravity', 'phys-strength', 'phys-drag', 'phys-add-hold', 'phys-record', 'phys-reset'].map((t) => page.locator(`[data-testid="${t}"]`).count()))).every((n) => n === 1));
await shot('1-stand');
const stand = await where();
check('the body holds still on its feet', await until(() => { const b = window.__walkBase.physState().body; return Math.abs(b.y[0] - 1.074) < 0.03; }) && Math.abs(stand.x[0]) < 0.2, stand.y[0]);

// ---- drag it up by the head, let go: it falls and lands
{
  const [hx, hy] = stand.pts[2];
  await drag([hx, hy], [hx + 70, hy - 110], 14);
  const up = await where(); check('dragging the head carries the whole body up', up.y[0] > 2 && up.y[2] > 2.5, [up.y[0], up.y[2]]);
  await shot('2-lifted');
  await page.mouse.up();
  check('and when let go it comes down and lands', await until(() => { const b = window.__walkBase.physState().body; return b.y[0] < 1.3 && b.contact.some((c) => c); }, undefined, 5000));
  await page.waitForTimeout(1200);
  const down = await where(); check('on the ground it is at rest and has not flown off', down.y[0] < 1.2 && Math.abs(down.x[0]) < 6, [down.x[0], down.y[0]]);
  await shot('3-landed');
}

// ---- a bar: take the hand to it and it hangs
await q('phys-reset').click(); await page.waitForTimeout(300);
await q('phys-add-hold').click(); await ev(() => { window.__walkBase.S.phys.holds[0] = { x: 0.3, y: 3.3 }; });
await page.waitForTimeout(300);
{
  const w0 = await where(); const [hx, hy] = w0.pts[5]; const [bx, by] = w0.holds[0];
  await drag([hx, hy], [bx, by], 24);
  check('a hand taken to the bar takes hold of it', await until(() => window.__walkBase.physState().body.grip.R === 0 || window.__walkBase.physState().body.grip.L === 0, undefined, 3000), (await where()).grip);
  await page.mouse.up(); await page.waitForTimeout(700);
  const hang = await where(); const g = hang.grip.R === 0 ? 5 : 6; void g;
  check('and it hangs from it, with its feet off the ground', hang.y[9] > 0.5 && hang.y[10] > 0.5, [hang.y[9], hang.y[10]]);
  await shot('4-hanging');
  // swing: the hips move from side to side under the bar, and the hand does not leave it
  await q('phys-shove-fwd').click();
  const xs = []; for (let i = 0; i < 24; i++) { await page.waitForTimeout(100); xs.push((await where()).x[0]); }
  check('a push sets it swinging under the bar', Math.max(...xs) - Math.min(...xs) > 0.4, [Math.min(...xs), Math.max(...xs)]);
  const hand = await ev(() => { const { body } = window.__walkBase.physState(); const s = body.grip.R === 0 ? 5 : 6; return [body.x[s] - 0.3, body.y[s] - 3.3]; });
  check('the hand stays on the bar however it swings', Math.hypot(hand[0], hand[1]) < 0.02, hand);
  await shot('5-swinging');
  await q('phys-letgo').click();
  check('let go, it falls to the ground', await until(() => { const b = window.__walkBase.physState().body; return b.y[0] < 1.3 && b.grip.R == null && b.grip.L == null; }, undefined, 5000));
}

// ---- space: no gravity, and nothing brings it down
await q('phys-reset').click(); await q('phys-env-space').click(); // the preset itself gives it a hop
check('Space sets gravity to nothing', (await ev(() => window.__walkBase.S.phys.gravity)) === 0);
{
  // a jump is the same spring up from the feet in both; what differs is what the body does next. Stepped exactly, so the timing is the same everywhere.
  const speeds = await ev(() => { const w = window.__walkBase; const { body } = w.physState(); const vy = () => (body.y[0] - body.oy[0]) * 24 * 8; w.physAdvance(1); const out = [vy()]; w.physAdvance(8); out.push(vy()); out.push(body.contact.some((c) => c) ? 1 : 0); out.push(body.y[0]); return out; });
  check('in space the jump keeps its upward speed (gravity would have taken most of it)', speeds[0] > 3 && speeds[1] > speeds[0] * 0.75 && speeds[2] === 0, speeds);
  await shot('6-space');
}
await q('phys-reset').click(); await q('phys-env-earth').click(); await page.waitForTimeout(300);
{ // the settings do something: the same hop goes higher on the Moon than on Earth
  const hop = async (btn) => { await q('phys-reset').click(); await q(btn).click(); return ev(() => { const w = window.__walkBase; const { body } = w.physState(); let top = 0; for (let i = 0; i < 40; i++) { w.physAdvance(1); top = Math.max(top, body.y[0]); } return top; }); };
  const earth = await hop('phys-env-earth'); const moon = await hop('phys-env-moon');
  check('the weight and air settings work: the same jump goes much higher on the Moon', moon > earth + 0.5, [earth, moon]);
  await q('phys-reset').click(); await ev(() => { const s = document.querySelector('[data-testid="phys-gravity"]'); s.value = '0.3'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  check('and a slider changes the live setting', (await ev(() => window.__walkBase.S.phys.gravity)) === 0.3);
  await q('phys-env-earth').click();
}

// ---- a box in the scene is ground
await q('phys-reset').click(); await page.waitForTimeout(200);
await ev(() => { const w = window.__walkBase; w.S.scene.props.push({ id: 'pbox', name: 'Box', kind: 'box', x: 0, y: 0, z: 0, w: 1.4, d: 0.6, h: 0.5, rot: 0, visible: true, locked: false, color: '#b08968', tilt: 0 }); w.S.ver++; });
await ev(() => { const { body } = window.__walkBase.physState(); for (let i = 0; i < 12; i++) { body.y[i] += 1.2; body.oy[i] += 1.2; } });
await ev(() => window.__walkBase.physAdvance(70)); // stepped, not timed: a loaded machine runs the frame loop slowly
{
  const w1 = await where(); check('the figure falls onto a box and stands on top of it', Math.abs(w1.y[9] - 0.575) < 0.05 && w1.y[0] > 1.5, [w1.y[9], w1.y[0]]);
  await ev(() => { window.__walkBase.S.scene.props = []; window.__walkBase.S.ver++; });
}

// ---- record a take: the body is stepped exactly, then played back from ordinary lanes
await q('phys-env-earth').click(); await q('phys-reset').click(); await page.waitForTimeout(300);
await ev(() => window.__walkBase.setFrame(0));
await q('phys-record').click(); await page.waitForTimeout(150);
check('Record starts a take on the timeline', await ev(() => Boolean(window.__walkBase.physState().taking)));
const rec = await ev(() => { // lifted and dropped, stepped by hand in one go so nothing else moves it
  const w = window.__walkBase; const { body } = w.physState(); for (let i = 0; i < 12; i++) { body.y[i] += 1.5; body.oy[i] += 1.5; } w.physAdvance(36);
  const tk = w.physState().taking; return { start: tk.start, rows: tk.frames.map((c) => [c['pelvis.y'], c['foot.y.R'], c['arm.pitch.R'], c['pelvis.x']]) };
});
const during = await ev(() => window.__walkBase.S.frame); check('the playhead moves on as it records', during > rec.start + 30, during);
await q('phys-record').click(); await page.waitForTimeout(300);
const take = await ev(() => { const w = window.__walkBase; const L = w.S.lanes; const ph = Object.keys(L).filter((t) => L[t].phys); return { n: ph.length, py: L['c:pelvis.y:offset']?.pts?.length, amount: L['c:pelvis.y:amount']?.pts?.map((p) => p.v), cad: L.cadence?.pts?.map((p) => p.v), interp: L['c:pelvis.y:offset']?.interp, frame: w.S.frame, len: w.S.perfLen, bob: L['p:headBob']?.pts?.map((p) => p.v) }; });
check('the take is written as ordinary lanes, with the walk switched off under them', take.n >= 40 && take.py > 4 && take.amount.includes(0) && take.cad.includes(0) && take.bob.includes(0), take);
check('as straight-line lanes, so the points that were thinned out cost nothing', take.interp === 'linear', take.interp);
check('the performance is as long as the take', take.len >= take.frame, take);
await q('tab-Auto').click(); await page.waitForTimeout(200);
check('the Auto tab shows it as one physics take, not dozens of lanes', (await page.locator('[data-testid="phys-lanes-clear"]').count()) === 1 && (await page.locator('[data-testid^="lane-c:pelvis"]').count()) === 0);
await page.locator('[data-testid="tab-Physics"]').click(); await q('phys-on').uncheck(); await page.waitForTimeout(300);
check('with physics off nothing is live any more', !(await ev(() => window.__walkBase.S.physLive)));
const play = await ev(async ({ start, n }) => { const w = window.__walkBase; const out = []; for (let k = 0; k < n; k++) { w.setFrame(start + k); await new Promise((r) => setTimeout(r, 15)); const nv = w.nowValues(); out.push([nv.m['pelvis.y']?.offset, nv.m['foot.y.R']?.offset, nv.m['arm.pitch.R']?.offset, nv.m['pelvis.x']?.offset, nv.m['pelvis.y']?.amount]); } return out; }, { start: rec.start, n: rec.rows.length });
let worst = 0; for (let k = 0; k < rec.rows.length; k++) for (let j = 0; j < 4; j++) worst = Math.max(worst, Math.abs(play[k][j] - rec.rows[k][j]));
check('played back from the lanes, every frame is what the body did (to within a hundredth of a leg)', worst < 0.02, worst);
check('the walk is off under it, and the body falls: high at the start, on the ground at the end', play.every((r) => r[4] === 0) && Math.max(...rec.rows.map((r) => r[0])) > 1.2 && Math.abs(rec.rows.at(-1)[0] - 0.107) < 0.03, [Math.max(...rec.rows.map((r) => r[0])), rec.rows.at(-1)[0]]);
await shot('7-playback');
await page.locator('[data-testid="tab-Auto"]').click(); await q('phys-lanes-clear').click(); await page.waitForTimeout(200);
check('Remove it takes the physics lanes off the timeline', await ev(() => Object.values(window.__walkBase.S.lanes).every((l) => !l.phys)));

// ---- rag doll: every joint goes limp
await page.locator('[data-testid="tab-Physics"]').click(); await q('phys-on').check(); await q('phys-reset').click(); await page.waitForTimeout(300);
await q('phys-ragdoll').click();
check('Rag doll is a mode that keeps the muscle sliders as they were', await ev(() => window.__walkBase.S.phys.ragdoll === true && window.__walkBase.S.phys.strength > 0.5));
check('and the body crumples under its own weight: hips and head come down, the back folds', await until(() => { const b = window.__walkBase.physState().body; return b.y[0] < 0.6 && b.y[2] < 0.6; }, undefined, 6000));
await shot('8-ragdoll');
const fall1 = await ev(() => window.__walkBase.physState().body.x.slice(0, 12));
// it stays limp through the other moves: a weight preset, a jump, standing it up again
await q('phys-env-moon').click(); await q('phys-jump').click(); await page.waitForTimeout(300);
check('the weight presets and a jump do not stiffen it', await ev(() => window.__walkBase.S.phys.ragdoll === true));
await q('phys-reset').click(); await page.waitForTimeout(1500);
check('stood up again it still collapses (the mode stays on)', await until(() => { const b = window.__walkBase.physState().body; return b.y[2] < 1.2; }, undefined, 6000));
await q('phys-env-earth').click(); await q('phys-reset').click(); await page.waitForTimeout(1500);
const fall2 = await ev(() => window.__walkBase.physState().body.x.slice(0, 12));
check('and it does not fall the same way twice', fall1.some((v, i) => Math.abs(v - fall2[i]) > 0.02), [fall1, fall2]);
check('the mode is saved with the settings', await ev(() => window.__walkBase.S.phys.ragdoll === true));
await q('phys-ragdoll').click(); check('Stiffen up puts the muscles back', await ev(() => window.__walkBase.S.phys.ragdoll === false));
await q('phys-reset').click(); await page.waitForTimeout(500);
check('and it stands again', await until(() => { const b = window.__walkBase.physState().body; return b.y[0] > 1 && b.y[2] > 1.8; }, undefined, 4000));

// ---- Play while the body is in charge: the walk takes over again, so the legs do not fight it
await page.locator('[data-testid="tab-Physics"]').click(); await q('phys-reset').click(); await page.waitForTimeout(400);
check('the body is in charge', await ev(() => window.__walkBase.physState().engaged));
await ev(() => window.__walkBase.play()); await page.waitForTimeout(500);
check('Play hands the figure back to the walk', await ev(() => !window.__walkBase.physState().engaged && !window.__walkBase.S.physLive));
await ev(() => window.__walkBase.pause());

// ---- holds are kept with the settings
await page.locator('[data-testid="tab-Physics"]').click(); await q('phys-add-ladder').click(); await page.waitForTimeout(200);
check('a ladder is a row of holds', (await ev(() => window.__walkBase.S.phys.holds.length)) >= 6);
await q('phys-clear-holds').click(); check('and they can be cleared', (await ev(() => window.__walkBase.S.phys.holds.length)) === 0);

check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
console.log(fails ? `${fails} failed` : 'all passed'); process.exit(fails ? 1 : 0);
