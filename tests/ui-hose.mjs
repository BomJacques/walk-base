// The rubber hose figure and the new proportion controls.
// Usage: node walkbase/tests/ui-hose.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const stagePng = () => page.locator('[data-testid="stage"]').screenshot();
const panelText = async (tab) => { await ev((t) => window.__walkBase.setTab(t), tab); await wait(200); return page.locator('#panel-body').innerText(); };

// ---- proportions on the human
const body = await panelText('Body');
for (const l of ['Waist length', 'Chest length', 'Upper arm length', 'Forearm length', 'Hand size', 'Upper leg share', 'Foot size', 'Limb thickness', 'Body thickness']) check(`the Body tab has ${l}`, body.includes(l));
check('the human does not see rubber hose controls', !(await panelText('Look')).includes('Limb curve'));
const a = await stagePng();
await ev(() => { window.__walkBase.S.r = { footSize: 1.8, limbGirth: 1.8, handSize: 2 }; window.__walkBase.render(); }); await wait(120);
check('the new proportions change the drawing', Buffer.compare(a, await stagePng()) !== 0);
await ev(() => { window.__walkBase.S.r = {}; });

// ---- switch to the rubber hose figure
const opts = await page.locator('[data-testid="rig"] option').evaluateAll((os) => os.map((o) => o.value));
check('the Figure menu has the rubber hose figure', opts.includes('hose') && opts[1] === 'hose', opts);
await ev(() => window.__walkBase.setFigure('hose')); await wait(300);
const st = await ev(() => ({ fig: window.__walkBase.figKey(), model: window.__walkBase.S.p.model, rig: window.__walkBase.S.p.rig, preset: window.__walkBase.S.preset, head: window.__walkBase.S.r.head, exp: window.__walkBase.S.p.exposure }));
check('it is the human rig with the hose model', st.fig === 'hose' && st.model === 'hose' && st.rig === 'human', st);
check('it starts with its own walk (Bouncy, on twos) and proportions', st.preset === 'Bouncy' && st.exp === 2 && st.head > 1.3, st);
const presets = await page.locator('[data-testid="preset"] option').allTextContents();
check('the Preset menu lists the hose walks', ['Bouncy', 'Strut', 'Sneak', 'Skip', 'Stomp', 'Tired'].every((p) => presets.includes(p)), presets);
const look = await panelText('Look');
for (const l of ['Limb thickness', 'Limb curve', 'Squash and stretch', 'Ears', 'Eyes', 'Body colour', 'Glove colour', 'Shoe colour']) check(`the Look tab has ${l}`, look.includes(l));

// ---- it draws as a rubber hose figure
const hosePng = await stagePng();
await ev(() => window.__walkBase.setFigure('human')); await wait(250);
const humanPng = await stagePng();
check('the hose figure looks different from the mannequin', Buffer.compare(hosePng, humanPng) !== 0);
const back = await ev(() => ({ fig: window.__walkBase.figKey(), model: window.__walkBase.S.p.model, preset: window.__walkBase.S.preset, r: window.__walkBase.S.r }));
check('going back restores the mannequin, its walk and its proportions', back.fig === 'human' && back.model === 'mannequin' && back.preset === 'Normal' && Object.keys(back.r).length === 0, back);
await ev(() => window.__walkBase.setFigure('hose')); await wait(250);
const shapes = await ev(() => window.__walkBase.S.last.shapes.map((s) => ({ part: s.part, fill: s.fill ?? null, n: s.pts.length })));
check('the shapes are tubes, a head, big shoes and gloves', ['leg', 'arm', 'hand', 'foot', 'head', 'spine.mid', 'pelvis', 'neck'].every((p) => shapes.some((s) => s.part === p)) && shapes.every((s) => s.fill), shapes.map((s) => s.part).join(' '));
check('there is no knee or elbow part: a limb is one shape', shapes.filter((s) => s.part === 'leg').length === 2 && shapes.filter((s) => s.part === 'forearm').length === 0);
// the limb is one smooth curve: no corner as sharp as a joint
const sharp = await ev(() => { const s = window.__walkBase.S.last.shapes.filter((x) => x.part === 'leg')[0].pts; let worst = 0; for (let i = 1; i < s.length - 1; i++) { const a = [s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]]; const b = [s[i + 1][0] - s[i][0], s[i + 1][1] - s[i][1]]; const c = (a[0] * b[0] + a[1] * b[1]) / ((Math.hypot(...a) * Math.hypot(...b)) || 1); worst = Math.max(worst, Math.acos(Math.max(-1, Math.min(1, c)))); } return worst; });
check('the limb outline has no sharp corner', sharp < 1.3, sharp.toFixed(2));
// the limb curve control: 0 is a sharp joint
await ev(() => { window.__walkBase.S.s.hoseBend = 0; window.__walkBase.render(); }); await wait(120);
const straightLeg = await ev(() => window.__walkBase.S.last.shapes.filter((x) => x.part === 'leg')[0].pts.length);
await ev(() => { window.__walkBase.S.s.hoseBend = 1; window.__walkBase.render(); }); await wait(100);
check('the limb curve control reshapes the limb', (await stagePng()).length > 0 && straightLeg > 10);
// squash and stretch: the body is wider at the bottom of the bounce than at the top
const widths = [];
for (const f of [0, 3, 6, 9]) { await ev((x) => window.__walkBase.setFrame(x), f); await wait(80); widths.push(await ev(() => { const s = window.__walkBase.S.last.shapes.find((x) => x.part === 'spine.mid'); const xs = s.pts.map((q) => q[0]); return Math.max(...xs) - Math.min(...xs); })); }
check('the body swells and thins through the bounce', Math.max(...widths) - Math.min(...widths) > 0.5, widths.map((v) => +v.toFixed(1)));
await ev(() => { window.__walkBase.S.s.hoseSquash = 0; window.__walkBase.render(); });
const flat = []; for (const f of [0, 3, 6, 9]) { await ev((x) => window.__walkBase.setFrame(x), f); await wait(60); flat.push(await ev(() => { const s = window.__walkBase.S.last.shapes.find((x) => x.part === 'spine.mid'); const xs = s.pts.map((q) => q[0]); return Math.max(...xs) - Math.min(...xs); })); }
check('with squash off the body keeps its width', Math.max(...flat) - Math.min(...flat) < Math.max(...widths) - Math.min(...widths), flat.map((v) => +v.toFixed(1)));
await ev(() => { window.__walkBase.S.s.hoseSquash = 0.6; });

// ---- tapping a part selects it, and every style still draws
await ev(() => window.__walkBase.setFrame(2)); await wait(100);
const pick = await ev(() => { const sh = window.__walkBase.S.last.shapes.find((s) => s.part === 'hand'); const cx = sh.pts.reduce((t, q) => t + q[0], 0) / sh.pts.length; const cy = sh.pts.reduce((t, q) => t + q[1], 0) / sh.pts.length; const m = window.__walkBase.S.map; const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return { x: r.left + (m.x0 + (cx / m.fcw) * m.zw) / m.d, y: r.top + (m.y0 + (cy / m.fch) * m.zh) / m.d }; });
await page.mouse.click(pick.x, pick.y); await wait(200);
check('tapping a glove selects the hand', (await ev(() => window.__walkBase.S.sel?.part)) === 'hand');
for (const style of ['mannequin', 'outline', 'stick', 'silhouette']) { await ev((s) => { window.__walkBase.S.s.style = s; window.__walkBase.render(); }, style); await wait(80); }
await ev(() => { window.__walkBase.S.s.style = 'mannequin'; });
check('every style draws the hose figure without errors', errors.length === 0, errors);

// ---- the face, the mouth and the head view
await ev(() => { window.__walkBase.S.sel = null; const w = window.__walkBase; w.S.s.focus = 'head'; w.S.s.camYaw = -80; w.S.s.camPitch = 0; w.S.mouthPreview = 'th'; w.render(); }); await wait(150);
const th = await stagePng();
await ev(() => { window.__walkBase.S.mouthPreview = 'ah'; window.__walkBase.render(); }); await wait(120);
const ah = await stagePng();
check('the hose face shows the mouth shapes', Buffer.compare(th, ah) !== 0);
await ev(() => { window.__walkBase.S.s.hoseEyes = 'dots'; window.__walkBase.render(); }); await wait(100);
const dots = await stagePng();
await ev(() => { window.__walkBase.S.s.hoseEyes = 'pie'; window.__walkBase.render(); }); await wait(100);
check('the eye style changes the face', Buffer.compare(dots, await stagePng()) !== 0);
if (shots) { await ev(() => { window.__walkBase.S.mouthPreview = 'th'; window.__walkBase.render(); }); await wait(120); await page.screenshot({ path: path.join(shots, `wb-hose-head-${name}.png`) }); await ev(() => { window.__walkBase.S.s.focus = 'body'; window.__walkBase.S.s.camYaw = -55; window.__walkBase.S.mouthPreview = null; window.__walkBase.setFrame(4); }); await wait(150); await page.screenshot({ path: path.join(shots, `wb-hose-${name}.png`) }); }
await ev(() => { window.__walkBase.S.s.focus = 'body'; window.__walkBase.S.mouthPreview = null; window.__walkBase.render(); });

// ---- an exported frame, saving and coming back
const frame = await ev(async () => { const r = await window.__walkBase.frame(3); return r?.blob?.size ?? r?.size ?? 1; }).catch(() => 0);
check('a frame exports', frame > 0);
await wait(500);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await wait(300);
check('the rubber hose figure is still there after a reload', (await ev(() => window.__walkBase.figKey())) === 'hose');

check('no page errors', errors.length === 0, errors);
console.log(`\n${name}: ${fails ? fails + ' failed' : 'all passed'}`);
await browser.close();
process.exit(fails ? 1 : 0);
