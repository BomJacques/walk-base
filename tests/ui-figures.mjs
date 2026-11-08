// The legged figures: theropod, bird, sauropod, ceratopsian. Switching, presets, own attachments and performances, saving, parts, arcs, cape, wings.
// Usage: node walkbase/tests/ui-figures.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true })); });
page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url); await page.waitForFunction(() => window.__walkBase);
const ev = (fn, arg) => page.evaluate(fn, arg);
const fig = () => ev(() => window.__walkBase.figKey());
const pick = async (v) => { await page.locator('[data-testid="rig"]').selectOption(v); await page.waitForTimeout(350); };
const presets = () => page.locator('#preset option').evaluateAll((os) => os.map((o) => o.textContent));

const opts = await page.locator('[data-testid="rig"] option').evaluateAll((os) => os.map((o) => o.value));
check('the Figure menu offers all six figures', JSON.stringify(opts) === JSON.stringify(['human', 'dog', 'theropod', 'bird', 'sauropod', 'ceratopsian']), opts);

const expectPresets = { theropod: ['Walk', 'Stalk', 'Run'], bird: ['Walk', 'Hop', 'Flapping'], sauropod: ['Walk'], ceratopsian: ['Walk', 'Charge'] };
for (const f of ['theropod', 'bird', 'sauropod', 'ceratopsian']) {
  await pick(f);
  const ps = await presets();
  check(`${f}: chosen, with its own presets`, (await fig()) === f && expectPresets[f].every((n) => ps.includes(n)), ps);
  check(`${f}: its species is set and it draws`, (await ev(() => window.__walkBase.S.p.dogSpecies)) === f && (await ev(() => window.__walkBase.S.last?.shapes?.length)) > 10);
  const frames = await ev(() => window.__walkBase.S.p.cycleFrames);
  await ev((n) => { for (const i of [0, Math.floor(n / 3), Math.floor((2 * n) / 3)]) window.__walkBase.setFrame(i); }, frames);
  if (shots) { await ev((n) => window.__walkBase.setFrame(Math.floor(n * 0.1)), frames); await page.waitForTimeout(150); await page.screenshot({ path: path.join(shots, `wb-fig-${f}-${name}.png`) }); }
}

// each figure keeps its own attachments
await pick('bird');
await ev(() => window.__walkBase.addAttach('ellipse', {}, { part: 'dog.head', seg: null, side: null }));
await ev(() => window.__walkBase.addAttach('strip', {}, { part: 'dog.tail1', seg: null, side: null })); await page.waitForTimeout(250);
check('the bird wears a shape and a swinging strip', (await ev(() => window.__walkBase.attachList().length)) === 2);
await pick('theropod');
check('the theropod has none of them', (await ev(() => window.__walkBase.attachList().length)) === 0);
await pick('bird');
check('the bird still has its own when you come back', (await ev(() => window.__walkBase.attachList().length)) === 2);
await pick('dog');
check('the dog has none, and a fresh Walk preset', (await ev(() => window.__walkBase.attachList().length)) === 0 && (await ev(() => window.__walkBase.S.p.dogSpecies)) === 'dog');

// settings and the species survive a reload
await pick('bird'); await ev(() => window.__walkBase.S.s.showArcs = true); await page.waitForTimeout(500);
await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(400);
check('the species and its attachments come back after a reload', (await fig()) === 'bird' && (await ev(() => window.__walkBase.attachList().length)) === 2 && (await page.locator('[data-testid="rig"]').inputValue()) === 'bird');

// presets set the whole figure: the bird's Hop is a hop, Flapping opens the wings
await ev(() => document.getElementById('preset').value = 'Hop'); await page.locator('#preset').selectOption('Hop'); await page.waitForTimeout(300);
check('the bird Hop preset hops', (await ev(() => window.__walkBase.S.p.dogGait)) === 'hop');
await page.locator('#preset').selectOption('Flapping'); await page.waitForTimeout(300);
const wrists = []; for (let i = 0; i < 8; i++) { await ev((k) => window.__walkBase.setFrame(k), i); await page.waitForTimeout(80); wrists.push(await ev(() => window.__walkBase.S.last.pz.legs.FR.wrist[1])); }
check('Flapping opens the wings and beats them', Math.max(...wrists) - Math.min(...wrists) > 0.2, wrists.map((v) => +v.toFixed(2)));
if (shots) { await ev(() => window.__walkBase.setFrame(2)); await page.waitForTimeout(150); await page.screenshot({ path: path.join(shots, `wb-fig-flap-${name}.png`) }); }

// the flying bird, and wording that fits each animal
await page.locator('#preset').selectOption('Flying'); await page.waitForTimeout(300);
check('the Flying preset lifts the bird off the ground and turns the camera', (await ev(() => window.__walkBase.S.p.dogFlight)) === 1 && (await ev(() => window.__walkBase.S.s.camYaw)) === 35);
const hips = []; for (const i of [0, 4, 8, 12]) { await ev((k) => window.__walkBase.setFrame(k), i); await page.waitForTimeout(80); hips.push(await ev(() => [window.__walkBase.S.last.pz.pelvis[1], window.__walkBase.S.last.pz.legs.HR.toe[1]])); }
check('in flight the body is high, the feet are clear of the ground and the body bobs', hips.every(([h, t]) => h > 1.5 && t > 0.5) && Math.max(...hips.map((x) => x[0])) - Math.min(...hips.map((x) => x[0])) > 0.02, hips);
if (shots) { await ev((k) => window.__walkBase.setFrame(k), 5); await page.waitForTimeout(150); await page.screenshot({ path: path.join(shots, `wb-fig-flying-${name}.png`) }); }
await ev(() => { window.__walkBase.S.s.camYaw = 0; window.__walkBase.setTab('Gait'); }); await page.waitForTimeout(250);
const heads = await page.locator('section.group h3').allTextContents();
check('the bird panels say bird, not dog', heads.some((t) => /bird gait/i.test(t)) && heads.some((t) => /bird feet/i.test(t)) && !heads.some((t) => /\bdog\b/i.test(t)), heads);
const words = await page.locator('#panel-body').innerText().catch(() => '');
check('no dog or paw wording is left on the bird Gait tab', !/\bdog\b|\bpaws?\b/i.test(words), (words.match(/.{0,20}\b(dog|paws?)\b.{0,20}/i) || [''])[0]);
await ev(() => window.__walkBase.setTab('Body')); await page.waitForTimeout(250);
const bodyTxt = await page.locator('#panel-body').innerText().catch(() => '');
check('the bird Body tab has no ear controls and no dog wording', !/ear bounce|ear length/i.test(bodyTxt) && !/\bdog\b/i.test(bodyTxt), (bodyTxt.match(/.{0,20}\b(dog|ear bounce)\b.{0,20}/i) || [''])[0]);
await pick('dog'); await ev(() => window.__walkBase.setTab('Body')); await page.waitForTimeout(250);
check('the dog keeps its own words, and does not show wing controls', (await page.locator('[data-testid="rng-dogWingOpen"]').count()) === 0 && (await page.locator('[data-testid="rng-dogEar"]').count()) === 1 && /dog/i.test(await page.locator('section.group h3').first().innerText()));
await pick('bird');

// parts and controls
await ev(() => window.__walkBase.setTab('Body')); await page.waitForTimeout(200);
check('the Body tab shows the two-legged and wing controls', (await page.locator('[data-testid="rng-dogHeadHold"]').count()) === 1 && (await page.locator('[data-testid="rng-dogWingOpen"]').count()) === 1);
await ev(() => window.__walkBase.setTab('Parts')); await page.waitForTimeout(200);
check('the Parts tab lists parts for the figure', (await page.locator('[data-testid^="part-"]').count()) > 8);

// arcs follow the arms and feet of a two-legged figure
await pick('theropod'); await ev(() => { const w = window.__walkBase; w.S.s.showArcs = true; w.S.s.arcsDog = ['head', 'hip', 'paw.HR', 'paw.FR', 'tail']; w.render(); }); await page.waitForTimeout(200);
check('arcs draw for a theropod', (await ev(() => window.__walkBase.S.last.arcDots.length)) >= 4 * 20);

// a performance works on a new figure
await ev(() => { const w = window.__walkBase; w.S.perfLen = 40; w.S.ver++; w.render(); }); await page.waitForTimeout(300);
check('a performance on a theropod draws', (await ev(() => window.__walkBase.S.last.shapes.length)) > 10);

// the human still works
await pick('human');
check('the human is still there', (await fig()) === 'human' && (await ev(() => window.__walkBase.S.last.shapes.length)) > 10);
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
