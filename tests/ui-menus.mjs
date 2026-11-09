// The interface itself: menus (pointer, touch and keyboard), density, folding sections, contrast in both themes, names for icon buttons.
// Usage: node walkbase/tests/ui-menus.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 300)); };
const url = process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href;
const browser = await pw[name].launch();
const errors = [];

async function open(ctxOpts) {
  const context = await browser.newContext(ctxOpts);
  const page = await context.newPage();
// these tests reload on purpose and expect the session back, so they opt in to File > Reopen with last session
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.__walkBase);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* none */ } });
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  return { context, page };
}

// ================= pointer: compact density =================
{
  const { context, page } = await open({ viewport: { width: 1280, height: 800 } });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();
  check('a mouse gets the compact density by default', await ev(() => document.documentElement.dataset.density === 'compact'));
  const h = await ev(() => Math.round(document.querySelector('[data-testid="menu-file"]').getBoundingClientRect().height));
  check('compact controls are slim, not 44 px', h <= 32, h);

  // the menu bar
  const menus = await page.locator('.menubar [role="menuitem"]').evaluateAll((els) => els.map((e) => ({ t: e.textContent.trim(), p: e.getAttribute('aria-haspopup') })));
  check('File, Edit, View and Performance menus, each a menu button', menus.map((m) => m.t).join() === 'File,Edit,View,Performance' && menus.every((m) => m.p === 'menu'), menus);
  await q('menu-file').click();
  check('clicking File opens a list of actions', await q('menu-file-list').isVisible() && await page.locator('[role="menuitem"].mi').count() >= 6);
  check('and marks the button as expanded', (await q('menu-file').getAttribute('aria-expanded')) === 'true');
  await page.keyboard.press('Escape');
  check('Escape closes it and puts focus back on the button', !(await page.locator('[data-testid="menu-file-list"]').count()) && await ev(() => document.activeElement?.dataset.testid === 'menu-file'));
  await q('menu-file').click();
  await page.mouse.click(640, 400);
  check('clicking elsewhere closes it', !(await page.locator('.menu').count()));

  // keyboard
  await q('menu-edit').focus();
  await page.keyboard.press('ArrowDown');
  check('ArrowDown on a menu button opens it and focuses the first available item', await ev(() => document.activeElement?.classList.contains('mi')), await ev(() => document.activeElement?.textContent));
  await page.keyboard.press('End');
  check('End jumps to the last item', await ev(() => document.activeElement?.dataset.testid === 'reset-all'));
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  check('ArrowRight moves to the next menu', await q('menu-view-list').isVisible() && !(await page.locator('[data-testid="menu-edit-list"]').count()));
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await q('menu-view').click();
  await q('density-comfortable').click();
  check('choosing a radio item applies it', await ev(() => document.documentElement.dataset.density === 'comfortable'));
  await q('menu-view').click();
  check('and the menu shows it ticked', (await q('density-comfortable').getAttribute('aria-checked')) === 'true' && (await q('density-compact').getAttribute('aria-checked')) === 'false');
  await q('density-compact').click();
  check('a chosen density is remembered after a reload', await (async () => { await page.reload(); await page.waitForFunction(() => window.__walkBase); return ev(() => document.documentElement.dataset.density === 'compact'); })());
  await q('menu-view').click(); await q('density-auto').click();

  await q('menu-perf').click(); await q('pm-arm').click();
  check('a checkbox item toggles and closes the menu', await ev(() => window.__walkBase.S.armed === true) && !(await page.locator('.menu').count()));
  await q('menu-perf').click();
  check('a checked item shows as checked next to its name', (await q('pm-arm').getAttribute('aria-checked')) === 'true');
  await page.keyboard.press('Escape'); await ev(() => window.__walkBase.setArmed(false));

  // the commands that used to be rows of buttons now live in menus
  await q('menu-edit').click();
  check('Edit has Undo and Redo, disabled with nothing to undo', (await q('menu-undo').isDisabled()) && (await q('menu-redo').isDisabled()));
  await page.keyboard.press('Escape');
  await ev(() => window.__walkBase.setParam('bob', 0.1)); await page.waitForTimeout(400);
  await q('menu-edit').click();
  check('and Undo is available after a change', await q('menu-undo').isEnabled());
  await q('menu-undo').click();
  check('choosing it undoes the change', await ev(() => window.__walkBase.S.p.bob !== 0.1));

  // camera views are one dropdown
  const viewButtons = await page.locator('.viewbar button').count();
  check('the camera tools are a compact bar: tools, the View menu, the Select tool, five quick angles and three icons', viewButtons <= 12, viewButtons);
  await q('view-menu').click(); await q('view-front').click();
  check('the View dropdown changes the camera', await ev(() => window.__walkBase.S.s.camYaw === -90));
  await q('view-menu').click();
  check('and ticks the current view', (await q('view-front').getAttribute('aria-checked')) === 'true');
  await page.keyboard.press('Escape');

  // folding sections
  await q('tab-Gait').click();
  const sec = page.locator('.sec-toggle', { hasText: 'Timing' }).first();
  check('groups in the inspector are collapsible sections', (await sec.getAttribute('aria-expanded')) === 'true');
  await sec.click();
  check('folding one hides its controls', !(await page.locator('[data-testid="rng-cycleFrames"]:visible').count()) && (await sec.getAttribute('aria-expanded')) === 'false');
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  check('a folded section stays folded after a reload', !(await page.locator('[data-testid="rng-cycleFrames"]:visible').count()));
  await page.locator('.sec-toggle', { hasText: 'Timing' }).first().click();
  check('and unfolds again', await page.locator('[data-testid="rng-cycleFrames"]:visible').count() === 1);

  // scrubbing: dragging a label sideways changes its value; a tap still opens the help
  await q('tab-Gait').click();
  const rowOf = (id) => page.locator('.row', { has: page.locator(`[data-testid="${id}"]`) });
  const lab = rowOf('rng-stepLength').locator('.lab').first();
  const lb = await lab.boundingBox();
  const v0 = await ev(() => window.__walkBase.S.p.stepLength);
  await page.mouse.move(lb.x + 20, lb.y + lb.height / 2); await page.mouse.down(); await page.mouse.move(lb.x + 60, lb.y + lb.height / 2, { steps: 4 }); await page.mouse.move(lb.x + 120, lb.y + lb.height / 2, { steps: 4 }); await page.mouse.up();
  const v1 = await ev(() => window.__walkBase.S.p.stepLength);
  check('dragging a label to the right raises its value', v1 > v0 + 0.05, { v0, v1 });
  check('and the drag did not open the help text', !(await rowOf('rng-stepLength').evaluate((r) => r.classList.contains('open'))));
  await lab.click();
  check('a plain tap on the label still opens the help text', await rowOf('rng-stepLength').evaluate((r) => r.classList.contains('open')));
  await lab.click();
  const lb2 = await lab.boundingBox();
  await page.mouse.move(lb2.x + 60, lb2.y + lb2.height / 2); await page.mouse.down(); await page.mouse.move(lb2.x - 20, lb2.y + lb2.height / 2, { steps: 6 }); await page.mouse.up();
  check('dragging left lowers it again', (await ev(() => window.__walkBase.S.p.stepLength)) < v1 - 0.03);
  await page.waitForTimeout(400);
  const vNow = await ev(() => window.__walkBase.S.p.stepLength);
  await ev(() => window.__walkBase.undo());
  check('a scrub is one undo step', (await ev(() => window.__walkBase.S.p.stepLength)) !== vNow);

  // theme
  const lum = () => ev(() => { const c = getComputedStyle(document.body).backgroundColor.match(/[0-9.]+/g).map(Number); return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; });
  const light0 = await lum();
  await q('menu-view').click(); await q('theme-dark').click();
  check('the Theme menu can force the dark theme', (await ev(() => document.documentElement.dataset.theme)) === 'dark' && (await lum()) < 0.3 && light0 > 0.7, { light0, now: await lum() });
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(200);
  check('and the choice is remembered', (await ev(() => document.documentElement.dataset.theme)) === 'dark');
  await q('menu-view').click(); await q('theme-light').click();
  check('Light forces light', (await ev(() => document.documentElement.dataset.theme)) === 'light' && (await lum()) > 0.7);
  await q('menu-view').click(); await q('theme-auto').click();
  check('Follow the device removes the override', (await ev(() => document.documentElement.dataset.theme)) === undefined);

  // compact audit: every control is still comfortable to hit with a pointer
  const small = async () => ev(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, input, select, [role="tab"]')) {
      const box = (el.type === 'checkbox' || el.type === 'radio') ? (el.closest('label') || el) : el;
      const r = box.getBoundingClientRect(); const s = getComputedStyle(el);
      if (!r.width || !r.height || s.display === 'none' || s.visibility === 'hidden' || el.disabled || el.type === 'file' || el.classList.contains('sr')) continue;
      const m = el.type === 'range' ? r.height : Math.min(r.width, r.height);
      if (m < 26) out.push(`${el.dataset.testid || el.className}:${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  const bad = new Set();
  for (const tab of ['Gait', 'Parts', 'Auto', 'Body', 'View', 'Look', 'Guides', 'Export']) { await ev((t) => window.__walkBase.setTab(t), tab); await page.waitForTimeout(150); (await small()).forEach((x) => bad.add(`${tab}/${x}`)); }
  check('compact density: every control at least 26 px', bad.size === 0, [...bad].slice(0, 8).join(' '));
  await ev(() => window.__walkBase.setTab('Gait'));
  if (shots) await page.screenshot({ path: path.join(shots, `wb-ui-${name}-compact.png`) });
  await context.close();
}

// ================= touch: comfortable density, menus with a finger =================
{
  const { context, page } = await open({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();
  check('a touch screen gets the comfortable density', await ev(() => document.documentElement.dataset.density === 'comfortable'));
  await q('menu-file').tap();
  const rows = await page.locator('.menu .mi').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  check('menu rows are at least 44 px for a finger', rows.length >= 6 && rows.every((x) => x >= 44), rows);
  const box = await page.locator('.menu').boundingBox();
  check('the menu stays inside the window', box.x >= 0 && box.y >= 0 && box.x + box.width <= 1180 && box.y + box.height <= 820, box);
  await page.locator('.menu .mi').first().tap();
  check('tapping an item runs it and closes the menu', !(await page.locator('.menu').count()));
  // narrow screens keep the menu inside
  await page.setViewportSize({ width: 390, height: 780 }); await page.waitForTimeout(300);
  await q('menu-perf').tap();
  const nb = await page.locator('.menu').boundingBox();
  check('on a phone-width window the menu fits', nb.x >= 0 && nb.x + nb.width <= 390, nb);
  await page.keyboard.press('Escape');
  const over = await ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('the top bar wraps instead of scrolling sideways', over <= 0, over);
  await page.setViewportSize({ width: 1180, height: 820 });

  // names for every icon-only button
  const unnamed = await ev(() => [...document.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width && !(b.getAttribute('aria-label') || b.textContent.trim())).map((b) => b.dataset.testid || b.className));
  check('every button has a name for assistive tools', unnamed.length === 0, unnamed);
  const icons = await ev(() => [...document.querySelectorAll('svg.icon')].every((s) => s.getAttribute('aria-hidden') === 'true'));
  check('icons are decorative, the label carries the name', icons);
  check('Play, Record and the frame buttons are icon buttons with names', await ev(() => ['play', 'rec', 'first', 'prev', 'next', 'last', 'undo', 'redo'].every((id) => { const b = document.querySelector(`[data-testid="${id}"]`); return b && b.querySelector('svg') && (b.getAttribute('aria-label') || b.textContent.trim()); })));
  await ev(() => window.__walkBase.play()); await page.waitForTimeout(150);
  check('the Play button turns into Pause', await ev(() => document.querySelector('#play').getAttribute('aria-label') === 'Pause' && document.querySelector('#play svg').classList.contains('icon-pause')));
  await ev(() => window.__walkBase.pause());
  check('the timeline shows a timecode', /^\d\d:\d\d \/ \d\d:\d\d$/.test(await ev(() => document.querySelector('#tc').textContent)));
  await context.close();
}

// ================= a visit starts clean unless File > Reopen with last session is on =================
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage(); // no opt-in script here
  page.on('dialog', (d) => d.accept());
  await page.goto(url); await page.waitForFunction(() => window.__walkBase);
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const frames = () => ev(() => window.__walkBase.S.p.cycleFrames);
  const change = async (v) => { await ev((x) => { const w = window.__walkBase; w.setTab('Gait'); }); const r = page.locator('[data-testid="rng-cycleFrames"]:visible').first(); await r.fill(String(v)); await page.waitForTimeout(500); };
  const start = await frames();
  await change(start === 20 ? 24 : 20); const changed = await frames();
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  check('a refresh starts clean by default', (await frames()) === start && changed !== start, `${start} ${changed} ${await frames()}`);
  await change(changed);
  const { press } = await import('./helpers.mjs');
  await press(page, 'file-resume'); await page.waitForTimeout(400);
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  check('with Reopen with last session on, a refresh keeps the work', (await frames()) === changed, String(await frames()));
  await press(page, 'file-new'); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(500);
  check('File > New clears everything', (await frames()) === start, String(await frames()));
  await context.close();
}

// ================= contrast in both themes =================
for (const scheme of ['light', 'dark']) {
  const { context, page } = await open({ viewport: { width: 1280, height: 800 }, colorScheme: scheme });
  const ev = (fn, arg) => page.evaluate(fn, arg);
  await ev(() => { const w = window.__walkBase; w.setTab('Gait'); });
  const rep = await ev(() => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/) || c.match(/color\(srgb ([^)]+)\)/); if (!m) return null; const p = m[1].replace('/', ' ').split(/[ ,]+/).filter(Boolean).map(Number); const scale = c.startsWith('color(') ? 255 : 1; return { r: p[0] * scale, g: p[1] * scale, b: p[2] * scale, a: p[3] ?? 1 }; };
    const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0.5) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };
    const ratio = (el) => { const fg = parse(getComputedStyle(el).color); const bg = bgOf(el); const a = lum(fg); const b = lum(bg); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
    const pick = { 'row label': '.row .lab .name', 'unit text': '.row .lab small', 'field label': '.bar .pillfield small', 'tab': '.tab[aria-selected="false"]', 'selected tab': '.tab[aria-selected="true"]', 'section heading': '.sec-toggle', 'timecode': '#tc', 'menu bar': '.menubar .btn', 'primary button': '.transport .btn.primary', 'hint': '.hint' };
    const out = {};
    for (const [k, sel] of Object.entries(pick)) { const el = document.querySelector(sel); if (el) out[k] = +ratio(el).toFixed(2); }
    return out;
  });
  const weak = Object.entries(rep).filter(([, v]) => v < 4.5);
  check(`${scheme} theme: text reaches 4.5:1 contrast`, weak.length === 0 && Object.keys(rep).length >= 8, weak.length ? weak : Object.keys(rep).length);
  if (shots) await page.screenshot({ path: path.join(shots, `wb-ui-${name}-${scheme}.png`) });
  await context.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
