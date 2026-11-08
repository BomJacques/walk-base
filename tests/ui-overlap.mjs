// Nothing in the interface sits on top of anything else it should not: controls against controls, floating bars against the readout, text against
// the figure's labels, at every window shape, in every tab, in both densities, with an attachment selected.
// Usage: node walkbase/tests/ui-overlap.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 320)); };
const url = process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href;
const browser = await pw[name].launch();
const errors = [];

/** Runs in the page: every visible interactive or text element in the chrome, and the pairs that overlap by more than a few pixels. */
const overlaps = () => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && s.display !== 'none' && !el.classList.contains('sr') && s.opacity !== '0'; };
  const groups = {
    'top bar': '.bar button, .bar select, .bar label.pillfield, .bar .brand',
    'stage bar': '.viewbar > *, .hud, [data-testid="stage-back"]',
    'tabs': '.tabs .tab',
    'transport': '.transport > *, .transport .grp > *',
    'panel rows': '.panel-body .row .lab, .panel-body .row .ctl, .panel-body .row .btn, .panel-body .row .seg, .panel-body .btnrow > *, .panel-body .chips > *',
  };
  const out = [];
  const name = (el) => el.dataset.testid || el.id || el.className.toString().split(' ')[0] || el.tagName;
  for (const [g, sel] of Object.entries(groups)) {
    const els = [...document.querySelectorAll(sel)].filter(vis);
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i]; const b = els[j];
      if (a.contains(b) || b.contains(a)) continue;
      const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
      const w = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left); const h = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      if (w > 3 && h > 3) out.push(`${g}: ${name(a)} x ${name(b)} (${Math.round(w)}x${Math.round(h)})`);
    }
  }
  // the floating camera bar against the figure's own label and the readout, and everything against the window edges
  const vb = document.querySelector('.viewbar'); const hud = document.querySelector('.hud'); const st = document.querySelector('.stage-wrap');
  if (vb && hud && vis(vb) && vis(hud)) { const a = vb.getBoundingClientRect(); const b = hud.getBoundingClientRect(); if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3) out.push('camera bar x readout'); }
  const W = window.innerWidth; const H = window.innerHeight;
  for (const el of document.querySelectorAll('.bar *, .viewbar *, .transport *, .tabs *, .hud')) { if (!vis(el)) continue; const r = el.getBoundingClientRect(); if (r.right > W + 1 && !el.closest('.tabs')) out.push(`off the right edge: ${name(el)}`); }
  // text clipped inside its own box (a label cut off with no room), for the short labels that must be read whole
  for (const el of document.querySelectorAll('.btn .lbl, .segbtn, .tab, .pchip, .att-pick, .mi-label, .sec-toggle')) { if (!vis(el) || el.closest('.tabs')) continue; if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).textOverflow !== 'ellipsis') out.push(`clipped text: ${name(el)} "${(el.textContent || '').trim().slice(0, 24)}"`); }
  return out;
};

const shapes = { landscape: { width: 1180, height: 820 }, portrait: { width: 820, height: 1180 }, narrow: { width: 507, height: 820 }, phone: { width: 390, height: 780 }, short: { width: 1024, height: 520 } };
for (const [density, touch] of [['comfortable', true], ['compact', false]]) {
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: touch });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.__walkBase);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* none */ } });
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  const ev = (fn, a) => page.evaluate(fn, a);
  check(`${density}: the density is what was asked for`, await ev((d) => document.documentElement.dataset.density === d, density));
  await ev(() => { const w = window.__walkBase; w.selectPart({ part: 'forearm', side: 'R' }, { openTab: false }); w.addAttach('rect', { w: 0.1, h: 0.08 }); w.addAttach('image', { w: 0.1 }); });
  const bad = new Map();
  for (const [label, size] of Object.entries(shapes)) {
    await page.setViewportSize(size); await page.waitForTimeout(250);
    for (const tab of ['Gait', 'Parts', 'Attach', 'Auto', 'Body', 'View', 'Look', 'Guides', 'Export']) {
      await ev((t) => window.__walkBase.setTab(t), tab); await page.waitForTimeout(120);
      for (const o of await ev(overlaps)) bad.set(`${label}/${tab}/${o}`, 1);
    }
    // a view with the stage only, the lane editor, and the curve editor open
    await ev(() => { const w = window.__walkBase; w.S.lanes = { cadence: { pts: [{ t: 0, v: 1 }, { t: 30, v: 0.5 }], interp: 'smooth' } }; w.S.perfLen = 48; w.S.ver++; w.setTab('Auto'); w.openLaneEditor('cadence'); }); await page.waitForTimeout(200);
    for (const o of await ev(overlaps)) bad.set(`${label}/lane editor/${o}`, 1);
    await ev(() => { const w = window.__walkBase; w.closeEditor(); w.S.lanes = {}; w.S.perfLen = 0; w.S.ver++; }); await page.waitForTimeout(100);
  }
  check(`${density}: no controls overlap, in any tab, at five window shapes`, bad.size === 0, [...bad.keys()].slice(0, 8));
  if (shots) { await page.setViewportSize(shapes.landscape); await ev(() => window.__walkBase.setTab('Attach')); await page.screenshot({ path: path.join(shots, `wb-overlap-${name}-${density}.png`) }); }
  await context.close();
}

// the figure's own labels do not run under the camera bar
{
  const context = await browser.newContext({ viewport: { width: 700, height: 600 } });
  const page = await context.newPage();
  await page.goto(url); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  const clash = await page.evaluate(() => {
    const S = window.__walkBase.S; const m = S.map; const c = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); const vb = document.querySelector('.viewbar').getBoundingClientRect();
    // where the key-pose label sits on the screen: it is drawn near the top of the frame, at the side given by its alignment
    const k = (S.last.cam?.k ?? 1); const labelW = 220 * k; const right = c.left + (m.x0 + m.zw - 28 * k * (m.zw / m.fcw)) / m.d; const left = right - labelW * (m.zw / m.fcw) / m.d; const top = c.top + (m.y0 + 30 * k * (m.zh / m.fch)) / m.d; const bottom = top + 28 * k * (m.zh / m.fch) / m.d;
    const w = Math.min(right, vb.right) - Math.max(left, vb.left); const h = Math.min(bottom, vb.bottom) - Math.max(top, vb.top);
    return { w: Math.round(w), h: Math.round(h), overlap: w > 2 && h > 2 };
  });
  check('on a small stage the key pose label does not sit under the camera bar', !clash.overlap, clash);
  await context.close();
}

// the audit itself: a deliberate overlap must be reported, or a clean result means nothing
{
  const context = await browser.newContext({ viewport: { width: 1180, height: 820 } });
  const page = await context.newPage();
  await page.goto(url); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  await page.evaluate(() => { window.__walkBase.LAYOUT.hud = true; window.__walkBase.render(); }); await page.addStyleTag({ content: '.hud { top: 8px !important; left: 8px !important; bottom: auto !important; } .tab { margin-right: -30px; }' });
  const found = await page.evaluate(`(${overlaps.toString()})()`);
  check('the audit notices an overlap when one is made on purpose', found.some((x) => x.startsWith('camera bar x readout')) && found.some((x) => x.startsWith('tabs:')), found.slice(0, 3));
  await context.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
