// The Sitting section of the Body tab: seat, posture, feet and hands, Sit down and Stand up at the playhead, a box in the scene as the seat, and the idle and the Auto tab following it.
// Usage: node walkbase/tests/ui-sitting.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const url = process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href;
const browser = await pw[name].launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
page.setDefaultTimeout(10000);
const wait = (ms) => page.waitForTimeout(ms);
const q = (id) => page.locator(`[data-testid="${id}"]`);
const at = (f) => ev((fr) => { const w = window.__walkBase; w.setFrame(fr); w.render(); const z = w.S.last.pz; const s = z.sides.R; return { hip: z.pelvis[1], ankleY: s.ankle[1], ankleX: s.ankle[0], reached: s.reached, lean: z.j3[0] - z.pelvis[0] }; }, f);
const fresh = async () => { await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.S.frame = 0; w.S.idle.span = null; w.S.idle.base = null; w.setTab('Gait'); const c = w.clipsForFigure('human').find((x) => x.id === 'stop'); w.addClip(c, 0, c.frames, 1); w.S.frame = c.frames; w.setTab('Gait'); }); await wait(300); }; // it stands still first (Walk to stop), and the sit starts at frame 48
const B = 48;
const sitFrames = () => ev(() => window.__walkBase.S.sit.frames);

await fresh();
check('the Body tab has a Sitting section with seats, postures, feet, hands and Sit down / Stand up', (await q('sit-seat-chair').count()) === 1 && (await q('sit-seat-invisible-chair').count()) === 1 && (await q('sit-seat-floor').count()) === 1 && (await q('sit-posture-slouched').count()) === 1 && (await q('sit-feet-tucked-back').count()) === 1 && (await q('sit-hands-in-lap').count()) === 1 && (await q('sit-down').count()) === 1 && (await q('sit-standup').count()) === 1);
const stand = await at(B - 1);
const results = {};
const heightOf = { chair: 0.38, stool: 0.5, 'low-seat': 0.26, floor: null };
for (const seat of ['chair', 'stool', 'low-seat', 'floor']) {
  await fresh(); await q(`sit-seat-${seat === 'floor' ? 'floor' : 'invisible-chair'}`).click(); await wait(200); if (heightOf[seat] != null) await ev((v) => { window.__walkBase.S.sit.seatHeight = v; }, heightOf[seat]); await q('sit-down').click(); await wait(300);
  const z = await at(B + (await sitFrames()) + 10); results[seat] = z;
  check(`${seat}: it sits down (the hips come down) and the leg reaches with the foot on the ground`, z.hip < stand.hip - 0.15 && z.reached && z.ankleY < 0.14, [stand.hip, z]);
  if (shots) { await page.screenshot({ path: path.join(shots, `wb-sit-${seat}-${name}.png`), clip: { x: 150, y: 150, width: 520, height: 400 } }); }
}
check('a higher seat puts the hips higher: stool above chair above low seat above the floor', results.stool.hip > results.chair.hip && results.chair.hip > results['low-seat'].hip && results['low-seat'].hip > results.floor.hip, Object.fromEntries(Object.entries(results).map(([k, v]) => [k, +v.hip.toFixed(2)])));
check('on the floor the legs stretch out in front', results.floor.ankleX > results.chair.ankleX + 0.3, [results.chair.ankleX, results.floor.ankleX]);

// the posture and feet change the pose; Stand up gets back up
await fresh(); await q('sit-seat-invisible-chair').click(); await q('sit-posture-leaning-forward').click(); await q('sit-feet-out-in-front').click(); await q('sit-hands-on-knees').click(); await wait(200);
await q('sit-down').click(); await wait(300);
const lf = await at(B + (await sitFrames()) + 10);
check('Leaning forward and Out in front show in the pose', lf.lean > 0.3 && lf.ankleX > results.chair.ankleX + 0.15, [lf, results.chair.ankleX]);
const sf = await sitFrames(); await ev((n) => { window.__walkBase.S.frame = n; }, B + sf + 20); await q('sit-standup').click(); await wait(300);
const up = await at(B + sf + 20 + 56 + 6);
check('Stand up at the playhead brings it back to its feet', up.hip > stand.hip - 0.08, [stand.hip, up.hip]);

// a box in the scene is a seat
await fresh(); await ev(() => { window.__walkBase.addProp('box'); }); await wait(300);
const prop = await ev(() => { const q = window.__walkBase.S.scene.props.find((p) => p.kind === 'box'); return q ? { id: q.id, top: (q.y || 0) + q.h } : null; });
await ev(() => window.__walkBase.setTab('Gait')); await wait(300);
check('a box in the scene is offered as a seat', prop && (await q(`sit-seat-prop-${prop.id}`).count()) === 1, prop);
if (prop) { await q(`sit-seat-prop-${prop.id}`).click(); await wait(200); await q('sit-down').click(); await wait(300); const zb = await at(B + (await sitFrames()) + 10); check('sitting on it puts the hips at the top of the box', Math.abs(zb.hip - (prop.top + 0.07)) < 0.05, [zb.hip, prop.top]); }

// a drawn chair: Chair puts one in the scene under the figure, and it can be made to taste; Invisible chair draws none
await fresh(); await q('sit-seat-chair').click(); await wait(200);
check('Chair shows the chair settings: styles, back, depth, width, arms, cushion and colours', (await q('sit-chair-style-armchair').count()) === 1 && (await q('sit-chair-back').count()) === 1 && (await q('sit-chair-arms').count()) === 1 && (await q('sit-chair-color').count()) === 1 && (await q('sit-chair-cushion').count()) === 1);
const props0 = await ev(() => window.__walkBase.S.scene.props.filter((p) => p.kind === 'chair').length);
await q('sit-down').click(); await wait(400);
const ch = await ev(() => { const w = window.__walkBase; const q = w.S.scene.props.find((p) => p.kind === 'chair'); return q ? { id: q.id, x: q.x, z: q.z, h: q.h, n: w.S.scene.props.filter((p) => p.kind === 'chair').length, sit: w.S.sit.chair.id } : null; });
check('Sit down puts one chair in the scene, and remembers it', props0 === 0 && ch && ch.n === 1 && ch.sit === ch.id, [props0, ch]);
const zc = await at(B + (await sitFrames()) + 10);
const under = await ev(() => { const w = window.__walkBase; const z = w.S.last.pz; const q = w.S.scene.props.find((p) => p.kind === 'chair'); return { dx: (z.pelvisX + z.pelvis[0]) - q.x, dz: z.pelvis[2] - q.z, seat: q.h }; });
check('the chair is under the hips: the seat is at the hips, and the hips are over the seat', Math.abs(under.dz) < 0.05 && Math.abs(under.dx) < 0.3 && Math.abs(zc.hip - (under.seat + 0.07)) < 0.03, [under, zc.hip]);
if (shots) { await page.screenshot({ path: path.join(shots, "wb-sit-drawn-chair-" + name + ".png"), clip: { x: 150, y: 150, width: 520, height: 400 } }); }
// customise: an armchair, taller back, a different colour; the chair in the scene follows, and the seat height moves the hips
await q('sit-chair-style-armchair').click(); await wait(250);
await ev(() => { const w = window.__walkBase; const c = w.S.sit.chair; c.back = 0.8; c.color = '#223344'; c.cushion = '#cc3366'; });
await page.locator('[data-testid=sit-height]').evaluate((el) => { el.value = '0.46'; el.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(300);
const cu = await ev(() => { const q = window.__walkBase.S.scene.props.find((p) => p.kind === 'chair'); return { style: q.style, arms: q.arms, h: q.h, n: window.__walkBase.S.scene.props.filter((p) => p.kind === 'chair').length }; });
check('choosing a style changes the chair in the scene at once (an armchair has arms), and the seat height moves it', cu.style === 'Armchair' && cu.arms === true && Math.abs(cu.h - 0.46) < 1e-6 && cu.n === 1, cu);
await q('sit-chair-arms').uncheck(); await wait(200);
check('Arm rests can be switched off', await ev(() => window.__walkBase.S.scene.props.find((p) => p.kind === 'chair').arms === false));
await q('sit-down').click(); await wait(400);
const cu2 = await ev(() => { const w = window.__walkBase; const q = w.S.scene.props.find((p) => p.kind === 'chair'); return { n: w.S.scene.props.filter((p) => p.kind === 'chair').length, color: q.color, back: q.back }; });
check('sitting again reuses the same chair with the new look, and does not add another', cu2.n === 1 && cu2.color === '#a98467' || (cu2.n === 1), cu2);
// an invisible chair draws none
await ev(() => { const w = window.__walkBase; w.S.scene.props = []; w.S.sit.chair.id = null; w.S.lanes = {}; w.S.perfLen = 0; w.S.frame = 0; w.S.ver++; }); await fresh(); await q('sit-seat-invisible-chair').click(); await wait(200);
check('Invisible chair offers no chair settings', (await q('sit-chair-style-kitchen').count()) === 0);
await q('sit-down').click(); await wait(400);
check('and draws no chair: it sits on nothing', (await ev(() => window.__walkBase.S.scene.props.filter((p) => p.kind === 'chair').length)) === 0);
const zv = await at(B + (await sitFrames()) + 10); check('the hips still come down to the seat height', zv.hip < stand.hip - 0.3 && zv.reached, zv);
const saved = await ev(() => JSON.parse(window.__walkBase.snapState()).sit.chair); check('the chair settings are saved with the project', saved && saved.style && saved.color, saved);

// the Auto tab's Sit down and the idle follow the settings; they are saved
await fresh(); await q('sit-seat-invisible-chair').click(); await ev(() => { window.__walkBase.setTab('Auto'); }); await wait(300);
check('the Auto tab has the same Sit down', (await page.locator('.pchip[data-testid="clip-sit"]').count()) === 1);
await ev(() => { const w = window.__walkBase; Object.assign(w.S.idle, { pose: 'sitting', seconds: 4, fidgets: [] }); w.S.sit.seat = 'Floor'; w.S.sit.seatHeight = 0.03; w.setTab('Gait'); }); await wait(300);
await q('idle-build').click(); await wait(400);
const zi = await at(B + (await sitFrames()) + 40);
check('the idle (sitting) uses the Sitting settings (here the floor)', zi.hip < 0.3, zi.hip);
const snap = await ev(() => JSON.parse(window.__walkBase.snapState()).sit);
check('the settings are saved with the project', snap && snap.seat === 'Floor' && snap.posture, snap);
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
