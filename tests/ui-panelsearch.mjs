// Find a control (the search over the panel), Reset that is faint at the starting value, and the names that no longer clash.
// Usage: node walkbase/tests/ui-panelsearch.mjs <chromium|webkit> <playwrightDir>
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`); };
const browser = await pw[name].launch();
const errors = [];
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true })); }); // folded sections stay folded
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(pathToFileURL(path.join(root, 'WalkBase.html')).href); await page.waitForFunction(() => window.__walkBase);
page.setDefaultTimeout(8000);
const ev = (fn, arg) => page.evaluate(fn, arg);
const wait = (ms) => page.waitForTimeout(ms);
const q = (id) => page.locator(`[data-testid="${id}"]`);
await ev(() => { const w = window.__walkBase; w.pause(); w.setFigure('human'); w.setTab('Gait'); }); await wait(300);

const visibleRows = () => ev(() => [...document.querySelectorAll('#panel-body .row')].filter((r) => r.offsetParent !== null).map((r) => r.querySelector('.lab')?.textContent.trim()));
const before = (await visibleRows()).length;
await q('panel-search').fill('hip bob'); await wait(250);
const rows = await visibleRows();
check('typing finds the control, opening its (folded) section and hiding the rest', rows.length >= 1 && rows.length < before && rows.some((r) => /hip bob/i.test(r)), [before, rows]);
check('the count says how many were found', /found/.test(await q('panel-search-count').textContent()), await q('panel-search-count').textContent());
const secs = await ev(() => [...document.querySelectorAll('#panel-body section.group')].filter((s) => s.offsetParent !== null).length);
check('sections with nothing in them are hidden', secs >= 1 && secs <= 3, secs);
// a folded section is opened for the search and folds again when it is cleared
await q('panel-search').fill('slope'); await wait(250);
check('a folded section (Terrain) opens for the search', (await visibleRows()).some((r) => /slope/i.test(r)), await visibleRows());
await q('panel-search').fill('zzzzqq'); await wait(250);
check('nothing found says so', /Nothing found/.test(await q('panel-search-count').textContent()) && (await visibleRows()).length === 0);
await q('panel-search').fill(''); await wait(250);
check('clearing brings everything back, and the Terrain section folds again', (await visibleRows()).length === before, [before, (await visibleRows()).length]);
await q('panel-search').fill('stride'); await q('panel-search').press('Escape'); await wait(200);
check('Escape clears the search', (await q('panel-search').inputValue()) === '' && (await visibleRows()).length === before);
await q('panel-search').fill('stride'); await wait(200); await ev(() => window.__walkBase.setTab('View')); await wait(300);
check('changing tab clears it', (await q('panel-search').inputValue()) === '' && !/found/.test(await q('panel-search-count').textContent()));

// Reset is faint while the value is the starting one, and follows the control
await ev(() => window.__walkBase.setTab('Gait')); await wait(300);
const dim = () => ev(() => document.querySelector('[data-testid="reset-stepLength"]')?.classList.contains('is-default'));
check('Reset is faint at the starting value', (await dim()) === true);
await page.locator('[data-testid="rng-stepLength"]').evaluate((el) => { el.value = String(Number(el.max) * 0.9); el.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(200);
check('and strong once the value is changed', (await dim()) === false);
await q('reset-stepLength').click(); await wait(300);
check('Reset still works and the button goes faint again', (await dim()) === true);

// the names that clashed
await ev(() => window.__walkBase.setTab('Gait')); await wait(200);
const heads = await ev(() => [...document.querySelectorAll('#panel-body h3')].map((h) => h.textContent.trim()));
check('the walking surface is Terrain in the Body tab (Ground is the View tab\'s line)', heads.includes('Terrain') && !heads.includes('Ground'), heads);
await ev(() => window.__walkBase.setTab('Auto')); await wait(300);
check('the Auto tab section is Performance length, not another Length', (await ev(() => [...document.querySelectorAll('#panel-body h3')].map((h) => h.textContent.trim()))).includes('Performance length'));
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
