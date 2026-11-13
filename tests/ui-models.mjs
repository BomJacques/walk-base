// The figures added in the models phase: robot, four-armed alien, monkey, ant, beetle, stegosaurus, crocodile, dragon and centaur; the spider's own-leg walk and the jaw movements.
// Usage: node walkbase/tests/ui-models.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
const wait = (ms) => page.waitForTimeout(ms);
const pick = async (v) => { await page.locator('[data-testid="rig"]').selectOption(v); await wait(350); };

const legCount = { ant: 6, beetle: 6, spider: 8, monkey: 4, stegosaurus: 4, crocodile: 4, dragon: 4, centaur: 4 };
for (const f of ['robot', 'alien', 'monkey', 'ant', 'beetle', 'stegosaurus', 'crocodile', 'dragon', 'centaur']) {
  await pick(f);
  check(`${f}: chosen`, (await ev(() => window.__walkBase.figKey())) === f);
  const frames = await ev(() => window.__walkBase.S.p.cycleFrames);
  const ok = []; for (const k of [0, 0.25, 0.5, 0.75]) { await ev((n) => window.__walkBase.setFrame(n), Math.floor(frames * k)); await wait(80); ok.push(await ev(() => window.__walkBase.S.last?.shapes?.length)); }
  check(`${f}: it draws all through its walk`, ok.every((n) => n > 8), ok);
  if (legCount[f]) check(`${f}: ${legCount[f]} legs on the ground or stepping`, (await ev(() => Object.values(window.__walkBase.S.last.pz.legs).filter((l) => !l.free).length)) === legCount[f]);
  const presets = await page.locator('#preset option').evaluateAll((os) => os.map((o) => o.textContent)); check(`${f}: it has its own walks`, presets.length >= 3, presets);
  if (shots) { await ev((n) => window.__walkBase.setFrame(Math.floor(n * 0.15)), frames); await wait(150); await page.screenshot({ path: path.join(shots, `wb-model-${f}-${name}.png`) }); }
}

// the robot and the alien are people on the human rig: the same walk, so the Body tab and the physics work
await pick('robot'); check('the robot is on the human rig, dressed as a robot', (await ev(() => window.__walkBase.S.p.rig === 'human' && window.__walkBase.S.p.model === 'robot')));
await pick('alien'); check('the alien starts tall, thin and big-headed', (await ev(() => window.__walkBase.S.r.head > 1.3 && window.__walkBase.S.r.limbGirth < 0.9)));
check('and the alien draws two pairs of arms (more arm shapes than a person)', (await ev(() => window.__walkBase.S.last.shapes.filter((s) => s.part === 'arm').length)) >= 4);

// the dragon's wings: folded on the walk, spread and beating in flight
await pick('dragon');
check('a dragon has a pair of wings apart from its legs', (await ev(() => { const l = window.__walkBase.S.last.pz.legs; return Boolean(l.WR && l.WL && l.FR && l.HR); })));
await page.locator('#preset').selectOption('Flying'); await wait(300);
const span = await ev(() => { const l = window.__walkBase.S.last.pz.legs; return Math.hypot(l.WR.wrist[2] - l.WL.wrist[2], l.WR.wrist[1] - l.WL.wrist[1]); });
check('in flight the wings are spread', span > 0.9, span);
check('and the front feet are tucked up under it', (await ev(() => window.__walkBase.S.last.pz.legs.FR.paw[1] > 0.6)));

// jaw movements
await ev(() => { const w = window.__walkBase; w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.setFigure('dragon'); }); await wait(250);
await ev(() => window.__walkBase.setTab('Auto')); await wait(250);
check('the dragon can roar and chomp', (await page.locator('.pchip[data-testid="clip-roar"]').count()) === 1 && (await page.locator('.pchip[data-testid="clip-chomp"]').count()) === 1);
await ev(() => { const w = window.__walkBase; const c = w.clipsForFigure('dragon').find((x) => x.id === 'roar'); w.addClip(c, 10, c.frames, 1); }); await wait(300);
const gap = []; for (const f of [4, 22, 34, 62]) { await ev((k) => window.__walkBase.setFrame(k), f); await wait(120); gap.push(await ev(() => { const z = window.__walkBase.S.last.pz; return Math.hypot(z.jawEnd[0] - z.noseTip[0], z.jawEnd[1] - z.noseTip[1]); })); }
check('the roar opens the jaw wide and then closes it', gap[2] > gap[0] + 0.15 && gap[3] < gap[2] - 0.1, gap.map((v) => +v.toFixed(2)));
for (const f of ['sauropod', 'ceratopsian', 'lizard', 'snake', 'bird', 'horse', 'monkey', 'theropod']) {
  await ev((x) => { const w = window.__walkBase; w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.setFigure(x); }, f); await wait(150);
  check(`${f}: has a jaw movement`, (await ev((x) => window.__walkBase.clipsForFigure(x).some((c) => ['roar', 'chomp', 'hiss', 'squawk', 'whinny'].includes(c.id)), f)));
}

// the spider: legs on their own, so not the same pattern every time round and no two legs alike
await pick('spider');
const feet = await ev(() => { const w = window.__walkBase; const n = 120; const out = {}; for (let i = 0; i < n; i++) { w.setFrame(Math.floor((i / n) * w.S.p.cycleFrames)); w.render(); const l = w.S.last.pz.legs; for (const k of Object.keys(l)) (out[k] ||= []).push(l[k].stance ? 1 : 0); } return out; });
const patterns = new Set(Object.values(feet).map((a) => a.join('')));
check('no two of the eight legs step in the same pattern', patterns.size >= 7, patterns.size);
await ev(() => window.__walkBase.setParam('dogLegVariety', 0));
const feet0 = await ev(() => { const w = window.__walkBase; const n = 120; const out = {}; for (let i = 0; i < n; i++) { w.setFrame(Math.floor((i / n) * w.S.p.cycleFrames)); w.render(); const l = w.S.last.pz.legs; for (const k of Object.keys(l)) (out[k] ||= []).push(l[k].stance ? 1 : 0); } return out; });
check('with Leg independence at 0 the legs fall into two sets again', new Set(Object.values(feet0).map((a) => a.join(''))).size <= 3, new Set(Object.values(feet0).map((a) => a.join(''))).size);

// body shapes and the new proportion sliders, on the human
await pick('human'); await ev(() => window.__walkBase.setTab('Gait')); await wait(300);
check('body shapes are offered over the proportion sliders', (await page.locator('[data-testid="shape-child"]').count()) === 1 && (await page.locator('[data-testid="shape-lopsided"]').count()) === 1 && (await page.locator('[data-testid="shape-normal"]').count()) === 1);
await page.locator('[data-testid="shape-child"]').click(); await wait(250);
check('Child sets a big head and short legs', (await ev(() => window.__walkBase.S.r.head > 1.3 && window.__walkBase.S.r.leg < 0.8)));
await page.locator('[data-testid="shape-lopsided"]').click(); await wait(250);
check('Lopsided makes the left arm longer than the right', (await ev(() => { const w = window.__walkBase; w.setFrame(3); w.render(); const s = w.S.last.pz.sides; const L = (q) => Math.hypot(...[0, 1, 2].map((i) => q.shoulder[i] - q.elbow[i])); return L(s.L) > 1.2 * L(s.R); })));
await page.locator('[data-testid="shape-normal"]').click(); await wait(250);
check('Normal puts the proportions back', (await ev(() => Object.keys(window.__walkBase.S.r).length)) === 0);
await ev(() => { const w = window.__walkBase; w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; w.setTab('Auto'); }); await wait(300);
const mv = []; for (const id of ['tiptoe', 'march', 'crouchwalk', 'spin', 'dance', 'think', 'facepalm', 'handsup', 'yawn', 'shiver', 'dodge', 'push']) mv.push([id, await page.locator(`.pchip[data-testid="clip-${id}"]`).count()]);
check('the person has twelve new movements', mv.every(([, n]) => n === 1), mv);

check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
