// How crowded the panel is on an iPad, with the default layout (no sections forced open): advanced groups folded, tabs that fit, pop-ups that close, chips instead of checkbox lists.
// Usage: node walkbase/tests/ui-layout.mjs <chromium|webkit> <playwrightDir> [shotDir]
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
const sizes = { landscape: { width: 1194, height: 834 }, portrait: { width: 834, height: 1194 } };

for (const [label, viewport] of Object.entries(sizes)) {
  const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const tab = async (t) => { await ev((x) => window.__walkBase.setTab(x), t); await page.waitForTimeout(250); };

  // the top bar: four pop-up buttons, as wide as what they show
  const bar = await ev(() => { const b = document.querySelector('.bar').getBoundingClientRect(); const ps = [...document.querySelectorAll('.pillfield')].map((e) => e.getBoundingClientRect()); return { barH: Math.round(b.height), n: ps.length, minH: Math.min(...ps.map((p) => p.height)), widths: ps.map((p) => Math.round(p.width)), labels: [...document.querySelectorAll('.pillfield small')].map((e) => e.textContent) }; });
  check(`${label}: the top bar is ${bar.barH}px tall (it was about 96px) with four pop-up buttons ${bar.widths.join(', ')}px wide`, bar.n === 4 && bar.minH >= 44 && bar.widths.every((w) => w < 130) && bar.barH < 70, bar);
  await page.locator('#rig').selectOption('ceratopsian'); await page.waitForTimeout(250);
  const after = await ev(() => { const e = document.querySelector('.pillfield:has(#rig)'); return { w: Math.round(e.getBoundingClientRect().width), text: e.querySelector('select').selectedOptions[0].text }; });
  check('the Figure button grows to fit the figure you pick, and still fits the bar', after.text === 'Ceratopsian' && after.w > bar.widths[0] && after.w < 150, after);
  await page.locator('#rig').selectOption('human'); await page.waitForTimeout(250);
  // tabs fit without scrolling sideways, and every tab is reachable and big enough
  const tabs = await ev(() => { const t = document.querySelector('.tabs'); const bs = [...t.querySelectorAll('.tab')].map((b) => b.getBoundingClientRect()); const pr = document.querySelector('.panel').getBoundingClientRect(); return { sideways: t.scrollWidth > t.clientWidth + 1, n: bs.length, tall: Math.min(...bs.map((b) => b.height)), inside: bs.every((b) => b.left >= pr.left - 1 && b.right <= pr.right + 1) }; });
  check(`${label}: all ${tabs.n} tabs fit in the panel, with no sideways scrolling`, tabs.n >= 10 && !tabs.sideways && tabs.inside && tabs.tall >= 40, tabs);

  // advanced groups start folded
  await tab('Body');
  const folded = await ev(() => [...document.querySelectorAll('#panel-body section.group')].map((s) => ({ t: s.querySelector('.sec-toggle')?.textContent.trim(), open: s.querySelector('.sec-toggle')?.getAttribute('aria-expanded') === 'true' })));
  check(`${label}: Body starts with Proportions and Hips and shoulders folded`, folded.filter((x) => /proportions|hips and shoulders/i.test(x.t)).every((x) => !x.open) && folded.some((x) => x.open), folded);
  const bodyScreens = await ev(() => document.getElementById('panel-body').scrollHeight / document.getElementById('panel-body').clientHeight);
  check(`${label}: the Body tab is now about ${bodyScreens.toFixed(1)} screens of scrolling, down from 1.6`, bodyScreens < 1.3, bodyScreens.toFixed(2));
  await page.locator('#panel-body .sec-toggle', { hasText: /proportions/i }).first().click(); await page.waitForTimeout(150);
  check('tapping a folded group opens it and the choice is remembered', await ev(() => [...document.querySelectorAll('#panel-body .sec-toggle')].find((b) => /proportions/i.test(b.textContent))?.getAttribute('aria-expanded')) === 'true');
  await ev(() => window.__walkBase.setTab('Gait')); await tab('Body');
  check('and it is still open when you come back to the tab', await ev(() => [...document.querySelectorAll('#panel-body .sec-toggle')].find((b) => /proportions/i.test(b.textContent))?.getAttribute('aria-expanded')) === 'true');
  await ev(() => { const L = window.__walkBase.LAYOUT; L.collapsed = {}; });

  // pop-ups close when the tab changes
  await tab('Attach'); await page.locator('[data-testid="attach-add"]').click(); await page.waitForTimeout(200);
  const open = await page.locator('[data-testid="attach-add-ellipse"]').isVisible();
  await tab('Body');
  check(`${label}: the Add menu on Attach does not stay open over the next tab`, open && !(await page.locator('[data-testid="attach-add-ellipse"]').isVisible().catch(() => false)));

  // arc points: chips, in pairs, easy to hit
  await tab('Guides');
  const chips = await ev(() => { const cs = [...document.querySelectorAll('.arcchip')]; const rs = cs.map((c) => c.getBoundingClientRect()); const sec = document.querySelector('[data-testid="arc-section"]').getBoundingClientRect(); return { n: cs.length, minH: Math.min(...rs.map((r) => r.height)), height: Math.round([...document.querySelectorAll('.arcchips')].reduce((n, e) => n + e.getBoundingClientRect().height, 0)), section: Math.round(sec.height), pairs: cs.filter((c) => /\.R$/.test(c.dataset.testid)).every((c) => { const l = document.querySelector(`[data-testid="${c.dataset.testid.replace(/R$/, 'L')}"]`); const a = c.getBoundingClientRect(); const b = l?.getBoundingClientRect(); return b && Math.abs(a.top - b.top) < 2; }) }; });
  check(`${label}: the ${chips.n} arc points are tap-sized chips, right and left side by side, in ${chips.height}px of chips (the checkbox list was about 760px)`, chips.n >= 17 && chips.minH >= 40 && chips.pairs && chips.height < 520, chips);
  await page.locator('[data-testid="arc-chest"]').click(); await page.waitForTimeout(150);
  check('tapping a chip turns that arc on', (await ev(() => window.__walkBase.S.s.arcs)).includes('chest'));

  // movements: one group at a time
  await tab('Auto');
  const mv = await ev(() => { const rows = [...document.querySelectorAll('.cliprow')]; const vis = rows.filter((r) => !r.hidden && r.offsetParent); return { groups: [...document.querySelectorAll('[data-testid^="clip-group-"]')].map((b) => b.textContent), visibleChips: vis.reduce((n, r) => n + r.querySelectorAll('.pchip').length, 0), allChips: document.querySelectorAll('.pchip[data-testid^="clip-"]').length }; });
  check(`${label}: movements show one kind at a time (${mv.visibleChips} of ${mv.allChips} chips)`, mv.groups.length === 4 && mv.visibleChips > 0 && mv.visibleChips < mv.allChips / 2, mv);
  await page.locator('[data-testid="clip-group-Gesture"]').click(); await page.waitForTimeout(150);
  check('choosing Gesture shows the gestures and hides the others', await page.locator('.pchip[data-testid="clip-wave"]').isVisible() && !(await page.locator('.pchip[data-testid="clip-sit"]').isVisible()));

  // Auto: the long explanations start folded so the movements are near the top
  await tab('Auto');
  const autoFolded = await ev(() => [...document.querySelectorAll('#panel-body .sec-toggle')].map((b) => [b.textContent.trim(), b.getAttribute('aria-expanded')]));
  check(`${label}: on Auto, Saved performances, Length and Record by hand start folded`, ['Saved performances', 'Length', 'Record by hand'].every((n) => autoFolded.some(([t, e]) => /^saved performances|^length|^record by hand/i.test(t) && t.toLowerCase().startsWith(n.toLowerCase().slice(0, 6)) && e === 'false')), autoFolded);
  const mvTop = await ev(() => { const m = [...document.querySelectorAll('#panel-body .sec-toggle')].find((b) => /movements/i.test(b.textContent)); const r = m?.getBoundingClientRect(); return r ? Math.round(r.top - document.getElementById('panel-body').getBoundingClientRect().top) : null; });
  check(`${label}: the Movements section starts ${mvTop}px down the Auto tab (it was about 700px)`, mvTop != null && mvTop < 450, mvTop);
  // slider rows: compact on one line, roomy with the label above a full-width track, two columns when the panel is wide
  await tab('Gait');
  const geo = () => ev(() => { const rows = [...document.querySelectorAll('#panel-body .group-body:not([hidden]) > .row-number')]; const r = rows[0]; const lab = r.querySelector('.lab').getBoundingClientRect(); const rng = r.querySelector('.rng').getBoundingClientRect(); const r2 = rows[1].getBoundingClientRect(); const r1 = r.getBoundingClientRect(); const b = document.getElementById('panel-body'); return { labelAbove: rng.top >= lab.bottom - 12, trackW: Math.round(rng.width), twoColumns: Math.abs(r1.top - r2.top) < 4 && r2.left > r1.left + 100, wide: b.dataset.wide, screens: +(b.scrollHeight / b.clientHeight).toFixed(2), rowH: Math.round(r1.height), thumb: parseFloat(getComputedStyle(r.querySelector('.rng'), '::-webkit-slider-thumb').width) || null }; });
  const g0 = await geo();
  if (label === 'landscape') {
    check('landscape: slider rows are compact by default (label, track and number on one line)', !g0.labelAbove && g0.wide === '0', g0);
    await ev(() => window.__walkBase.setRows('roomy')); await page.waitForTimeout(250);
    const g1 = await geo();
    check(`landscape: Roomy puts the label above a ${g1.trackW}px track (it was ${g0.trackW}px)`, g1.labelAbove && g1.trackW > g0.trackW * 1.8 && g1.trackW >= 240, { g0, g1 });
    await page.locator('[data-testid="menu-view"]').click(); await page.waitForTimeout(200);
    check('and the View menu offers Automatic, Compact and Roomy, with the choice ticked', (await page.locator('[data-testid^="rows-"]').count()) === 3 && (await page.locator('[data-testid="rows-roomy"]').getAttribute('aria-checked').catch(() => 'true')) !== 'false');
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    await ev(() => window.__walkBase.setRows('auto')); await page.waitForTimeout(200);
  } else {
    check(`portrait: a wide panel sets the slider rows out in two columns, name and number on one line with the track below (${g0.screens} screens)`, g0.wide === '1' && g0.twoColumns && g0.labelAbove, g0);
    await ev(() => window.__walkBase.setRows('roomy')); await page.waitForTimeout(250);
    const g1 = await geo();
    check('portrait: Roomy goes back to one column with the label above the track', !g1.twoColumns && g1.labelAbove, g1);
    check(`portrait: two columns save scrolling (${g0.screens} screens against ${g1.screens} in one column)`, g0.screens < g1.screens * 0.8, { g0: g0.screens, g1: g1.screens });
    await ev(() => window.__walkBase.setRows('auto')); await page.waitForTimeout(200);
  }
  // every tab: height of scrolling, no overlap, no sideways scroll
  const rep = {};
  for (const t of ['Gait', 'Parts', 'Attach', 'Auto', 'Body', 'View', 'Look', 'Guides', 'Export']) { await tab(t); rep[t] = await ev(() => { const b = document.getElementById('panel-body'); return { screens: +(b.scrollHeight / b.clientHeight).toFixed(2), sideways: b.scrollWidth > b.clientWidth + 1 }; }); }
  check(`${label}: no tab scrolls sideways`, Object.values(rep).every((r) => !r.sideways), rep);
  if (shots) { await tab('Body'); await page.screenshot({ path: path.join(shots, `wb-layout-${label}-body-${name}.png`) }); await tab('Guides'); await page.screenshot({ path: path.join(shots, `wb-layout-${label}-guides-${name}.png`) }); await tab('Auto'); await page.screenshot({ path: path.join(shots, `wb-layout-${label}-auto-${name}.png`) }); }
  await context.close();
}
check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
