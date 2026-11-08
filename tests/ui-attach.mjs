// Attachments in the browser: adding shapes and pictures, following the part, the stage handles, re-attaching, saving, undo, export.
// Usage: node walkbase/tests/ui-attach.mjs <chromium|webkit> <playwrightDir> [shotDir]
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { press } from './helpers.mjs';

const [name, pwDir, shots] = process.argv.slice(2);
const pw = createRequire(path.join(pwDir, 'x.js'))('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let fails = 0;
const check = (label, ok, detail = '') => { if (!ok) fails++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}  ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`.slice(0, 300)); };
const url = process.env.WB_URL ?? pathToFileURL(path.join(root, 'WalkBase.html')).href;
const browser = await pw[name].launch();
const errors = [];

async function open(opts) {
  const context = await browser.newContext({ acceptDownloads: true, ...opts });
  const page = await context.newPage();
// these tests reload on purpose and expect the session back, so they opt in to File > Reopen with last session
await page.addInitScript(() => { if (!localStorage.getItem('walkbase.layout')) localStorage.setItem('walkbase.layout', JSON.stringify({ resume: true, expandAll: true })); });
  page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForFunction(() => window.__walkBase);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* none */ } });
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  return { context, page };
}
const countColour = (page, rgb, tol = 40) => page.evaluate(([r, g, b, t]) => { const c = document.querySelector('[data-testid="stage"]'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) < t && Math.abs(d[i + 1] - g) < t && Math.abs(d[i + 2] - b) < t) n++; return n; }, [...rgb, tol]);
const client = (page, fx, fy) => page.evaluate(([x, y]) => { const m = window.__walkBase.S.map; const r = document.querySelector('[data-testid="stage"]').getBoundingClientRect(); return { x: r.left + (m.x0 + (x / m.fcw) * m.zw) / m.d, y: r.top + (m.y0 + (y / m.fch) * m.zh) / m.d }; }, [fx, fy]);
const handles = (page) => page.evaluate(() => { const h = window.__walkBase.S.last.handles; return h ? { id: h.id, anchor: h.anchor, center: h.center, rotate: h.rotate, scale: h.scale } : null; });
const settle = async (page) => { await page.evaluate(() => window.__walkBase.render()); await page.waitForTimeout(120); };

// ============== with a pointer ==============
{
  const { context, page } = await open({ viewport: { width: 1280, height: 820 } });
  const ev = (fn, a) => page.evaluate(fn, a);
  const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();

  await q('tab-Attach').click();
  check('there is an Attach tab with an Add menu', await q('attach-add').isVisible() && !(await page.locator('[data-testid="attach-props"]').count()));
  await ev(() => window.__walkBase.selectPart({ part: 'forearm', side: 'R' }, { openTab: false }));
  await q('tab-Attach').click();
  const before = await countColour(page, [242, 184, 75]);
  await press(page, 'attach-add-ellipse');
  const it = await ev(() => { const w = window.__walkBase; return w.attachItem() && { ...w.attachItem() }; });
  check('adding a shape fixes it to the selected part', it && it.part === 'forearm' && it.side === 'R' && it.kind === 'ellipse', it && { p: it.part, s: it.side });
  check('and it is selected, with its properties showing', await q('attach-props').isVisible() && (await ev(() => window.__walkBase.S.attachSel)) === it.id);
  await ev(() => window.__walkBase.patchAttach(window.__walkBase.S.attachSel, { w: 0.3, h: 0.3, x: 0.12, y: 0 }));
  await settle(page);
  const after = await countColour(page, [242, 184, 75]);
  check('the shape is drawn on the figure', after > before + 300, { before, after });

  // it follows the part
  const rel = async (frame) => {
    await ev((f) => window.__walkBase.setFrame(f), frame); await settle(page);
    return ev(() => { const S = window.__walkBase.S; const h = S.last.handles; const e = S.last.attach.find((p) => p.it.id === h.id); const f = e.f; const dx = (h.center.x - f.ox) / f.scale; const dy = (h.center.y - f.oy) / f.scale; return { x: f.cos * dx + f.sin * dy, y: -f.sin * dx + f.cos * dy, sx: h.center.x, sy: h.center.y }; });
  };
  const r0 = await rel(0); const r1 = await rel(6); const r2 = await rel(15);
  check('it stays in the same place on the part through the walk', Math.abs(r0.x - r1.x) < 1e-6 && Math.abs(r0.y - r1.y) < 1e-6 && Math.abs(r0.x - r2.x) < 1e-6, [r0, r1].map((r) => [+r.x.toFixed(4), +r.y.toFixed(4)]));
  check('and moves across the screen with it', Math.hypot(r0.sx - r1.sx, r0.sy - r1.sy) > 5 && Math.hypot(r1.sx - r2.sx, r1.sy - r2.sy) > 5, { a: [r0.sx, r0.sy], b: [r1.sx, r1.sy] });
  await ev(() => window.__walkBase.patchMotion('elbow.flex.R', { amount: 3 }));
  const r3 = await rel(6);
  check('changing the part\'s own motion carries the attachment', Math.hypot(r3.sx - r1.sx, r3.sy - r1.sy) > 3);
  await ev(() => window.__walkBase.setMotion('elbow.flex.R', null));
  await rel(6);

  // handles
  await ev(() => window.__walkBase.patchAttach(window.__walkBase.S.attachSel, { x: 0.12, y: 0.05, rot: 0, scale: 1 }));
  await settle(page);
  const drag = async (from, to) => { const a = await client(page, from.x, from.y); const b = await client(page, to.x, to.y); await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 }); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up(); await settle(page); };
  const t0 = await ev(() => window.__walkBase.attachItem().anchor.t);
  let hs = await handles(page);
  check('the selected shape shows its handles on the stage', hs && hs.id === it.id);
  await drag(hs.anchor, { x: hs.anchor.x - 60, y: hs.anchor.y + 20 });
  const t1 = await ev(() => window.__walkBase.attachItem().anchor.t);
  check('dragging the ring slides the anchor round the edge of the part', Math.abs(t1 - t0) > 0.03, { t0, t1 });
  hs = await handles(page);
  const x0 = await ev(() => [window.__walkBase.attachItem().x, window.__walkBase.attachItem().y]);
  await drag(hs.center, { x: hs.center.x + 40, y: hs.center.y - 30 });
  const x1 = await ev(() => [window.__walkBase.attachItem().x, window.__walkBase.attachItem().y]);
  check('dragging the dot moves the shape relative to its anchor', Math.hypot(x1[0] - x0[0], x1[1] - x0[1]) > 0.02 && (await ev(() => Math.abs(window.__walkBase.attachItem().anchor.t - 0) >= 0)), { x0, x1 });
  hs = await handles(page);
  const rot0 = await ev(() => window.__walkBase.attachItem().rot);
  await drag(hs.rotate, { x: hs.rotate.x + 70, y: hs.rotate.y + 50 });
  check('dragging the round handle turns it', Math.abs((await ev(() => window.__walkBase.attachItem().rot)) - rot0) > 10);
  hs = await handles(page);
  const s0 = await ev(() => window.__walkBase.attachItem().scale);
  await drag(hs.scale, { x: hs.scale.x + 60, y: hs.scale.y + 60 });
  check('dragging the square sizes it', (await ev(() => window.__walkBase.attachItem().scale)) > s0 * 1.2);

  // drop on another part
  hs = await handles(page);
  const headShape = await ev(() => { const S = window.__walkBase.S; const sh = S.last.shapes.filter((s) => !s.attach && s.part === 'head')[0]; const c = sh.pts.reduce((a, p) => [a[0] + p[0] / sh.pts.length, a[1] + p[1] / sh.pts.length], [0, 0]); return { x: c[0], y: c[1] }; });
  await drag(hs.anchor, headShape);
  check('dropping the ring on another part moves the attachment there', (await ev(() => window.__walkBase.attachItem().part)) === 'head', await ev(() => window.__walkBase.attachItem().part));
  const head = await ev(() => { const it = window.__walkBase.attachItem(); return { t: it.anchor.t, off: it.anchor.off, side: it.side }; });
  check('with its anchor on the head\'s edge', head.side === null && head.off === 0 && head.t >= 0 && head.t <= 1, head);

  // tap to select, tap to clear
  await ev(() => window.__walkBase.selectAttach(null)); await settle(page);
  check('nothing is selected after Done', (await ev(() => window.__walkBase.S.attachSel)) === null && !(await handles(page)));
  const c = await ev(() => { const S = window.__walkBase.S; const e = S.last.attach[0]; const f = e.f; const it = e.it; return { id: it.id, x: S.last.attach[0] ? null : null }; });
  await ev(() => window.__walkBase.selectAttach(window.__walkBase.attachList()[0].id)); await settle(page);
  const cc = await handles(page); await ev(() => window.__walkBase.selectAttach(null)); await settle(page);
  const pt = await client(page, cc.center.x, cc.center.y);
  await page.mouse.click(pt.x, pt.y); await settle(page);
  check('clicking a shape on the figure selects it', (await ev(() => window.__walkBase.S.attachSel)) === c.id);
  await page.keyboard.press('Escape');
  check('Escape lets go of it', (await ev(() => window.__walkBase.S.attachSel)) === null);

  // properties
  await ev(() => window.__walkBase.selectAttach(window.__walkBase.attachList()[0].id));
  await q('attach-opacity-num').fill('0.4'); await q('attach-opacity-num').dispatchEvent('change');
  check('Opacity is a property', (await ev(() => window.__walkBase.attachItem().opacity)) === 0.4);
  await q('attach-depth-behind').click();
  check('Depth can put it behind the part', (await ev(() => window.__walkBase.attachItem().depth)) === 'behind');
  await q('attach-depth-front').click();
  await q('attach-mode-free').click();
  check('the anchor can be a free point instead of on the edge', (await ev(() => window.__walkBase.attachItem().anchor.mode)) === 'free' && await q('attach-ax').isVisible());
  await q('attach-mode-boundary').click();
  await page.locator('[data-testid="attach-part"]').selectOption({ label: 'Upper arm, left' });
  check('and the part it belongs to can be changed from a list', await ev(() => { const i = window.__walkBase.attachItem(); return i.part === 'arm' && i.side === 'L'; }));

  // copy to other side, duplicate, delete
  const n0 = await ev(() => window.__walkBase.attachList().length);
  await q('attach-mirror').click();
  const mir = await ev(() => { const l = window.__walkBase.attachList(); const m = l[l.length - 1]; return { n: l.length, side: m.side, flip: m.flip, part: m.part }; });
  check('Copy to the other side makes a flipped copy on the right', mir.n === n0 + 1 && mir.side === 'R' && mir.flip === true && mir.part === 'arm', mir);
  await q('attach-dup').click();
  check('Duplicate adds another', (await ev(() => window.__walkBase.attachList().length)) === n0 + 2);
  await page.waitForTimeout(400);
  await q('attach-del').click();
  check('Delete removes it', (await ev(() => window.__walkBase.attachList().length)) === n0 + 1 && (await ev(() => window.__walkBase.S.attachSel)) === null);

  // undo, then save and reload
  await page.waitForTimeout(400);
  await ev(() => window.__walkBase.undo()); await page.waitForTimeout(100);
  check('undo brings the deleted attachment back', (await ev(() => window.__walkBase.attachList().length)) === n0 + 2);
  await ev(() => window.__walkBase.redo());
  await page.waitForTimeout(700);
  const keep = await ev(() => JSON.stringify(window.__walkBase.attachList().map((a) => [a.part, a.side, a.kind, Math.round(a.x * 1000), a.depth])));
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  check('the attachments come back after a reload', (await ev(() => JSON.stringify(window.__walkBase.attachList().map((a) => [a.part, a.side, a.kind, Math.round(a.x * 1000), a.depth])))) === keep);

  // a damaged saved list is cleaned up, not trusted
  const cleaned = await ev(() => window.__walkBase.cleanAttach({ human: [{ kind: 'ellipse', part: 'forearm', side: 'R', w: 99, h: -4, fill: 'red; evil', scale: 'x', anchor: { t: 7 } }, { kind: 'bogus', part: 'head' }, { kind: 'rect', part: 'nonsense' }, null], dog: 'no' }));
  check('a damaged list is repaired: unknown shapes and parts dropped, numbers clamped, colours checked', cleaned.human.length === 1 && cleaned.human[0].w === 3 && cleaned.human[0].h === 0.01 && cleaned.human[0].fill === '#f2b84b' && cleaned.human[0].scale === 1 && cleaned.human[0].anchor.t === 1 && cleaned.dog.length === 0, cleaned.human[0]);

  // export
  await ev(() => { const w = window.__walkBase; w.S.attach.human = []; w.selectPart({ part: 'forearm', side: 'R' }, { openTab: false }); w.addAttach('ellipse', { w: 0.3, h: 0.3, fill: '#00aa00', x: 0.1 }); w.addAttach('ellipse', { w: 0.3, h: 0.3, fill: '#aa00aa', x: -0.1 }, { part: 'forearm', seg: null, side: 'L' }); });
  const frameHas = (part) => ev(async (p) => { const w = window.__walkBase; const c = w.frame(0, p, { width: 480, height: 360, background: 'solid' }); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const cnt = (r, g, b) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200 && Math.abs(d[i] - r) < 30 && Math.abs(d[i + 1] - g) < 30 && Math.abs(d[i + 2] - b) < 30) n++; return n; }; return { green: cnt(0, 170, 0), purple: cnt(170, 0, 170) }; }, part);
  const all = await frameHas(null); const near = await frameHas('near'); const far = await frameHas('far');
  check('an exported frame includes the attachments', all.green > 100 && all.purple > 100, all);
  check('the near layer holds the right-side attachment and the far layer the left', near.green > 100 && near.purple === 0 && far.purple > 100 && far.green === 0, { near, far });
  const sheet = await ev(async () => { const r = await window.__walkBase.exportZip({ cycles: 1, format: 'png-zip', width: 320, height: 240 }); return r.blob.size; });
  check('a PNG export with attachments is produced', sheet > 2000, sheet);

  // the stick style shows them too
  await ev(() => { const w = window.__walkBase; w.S.s.style = 'stick'; w.render(); }); await page.waitForTimeout(200);
  check('in the stick style the attachments are still drawn', (await countColour(page, [0, 170, 0])) > 100);
  await ev(() => { const w = window.__walkBase; w.S.s.style = 'mannequin'; });

  // each figure has its own
  await page.locator('[data-testid="rig"]').selectOption('dog');
  await q('tab-Attach').click();
  check('the dog starts with none of its own', await page.locator('[data-testid^="attach-item-"]').count() === 0);
  await ev(() => { const w = window.__walkBase; w.selectPart({ part: 'dog.tail2', side: null }, { openTab: false }); });
  await q('tab-Attach').click(); await press(page, 'attach-add-triangle');
  check('and a dog attachment goes on the dog part', (await ev(() => window.__walkBase.attachItem().part)) === 'dog.tail2');
  await page.locator('[data-testid="rig"]').selectOption('human');
  await q('tab-Attach').click();
  check('switching back shows the human\'s attachments', await page.locator('[data-testid^="attach-item-"]').count() >= 2);
  if (shots) { await ev(() => { const w = window.__walkBase; w.setFrame(4); w.selectAttach(w.attachList()[0].id); }); await page.waitForTimeout(250); await page.screenshot({ path: path.join(shots, `wb-attach-${name}.png`) }); }
  await context.close();
}

// ============== a picture, with a finger, and the settings file ==============
{
  const { context, page } = await open({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const ev = (fn, a) => page.evaluate(fn, a);
  const q = (id) => page.locator(`[data-testid="${id}"]:visible`).first();
  await ev(() => window.__walkBase.selectPart({ part: 'spine.upper', side: null }, { openTab: false }));
  await q('tab-Attach').tap();
  // a PNG with a transparent corner: red square, bottom-left quarter see-through
  const png = await ev(() => { const c = document.createElement('canvas'); c.width = 160; c.height = 100; const g = c.getContext('2d'); g.fillStyle = '#d02020'; g.fillRect(0, 0, 160, 100); g.clearRect(0, 50, 80, 50); return c.toDataURL('image/png').split(',')[1]; });
  await page.locator('[data-testid="attach-file"]').setInputFiles({ name: 'badge.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForFunction(() => window.__walkBase.attachItem()?.kind === 'image');
  await page.waitForTimeout(300);
  const im = await ev(() => { const i = window.__walkBase.attachItem(); return { kind: i.kind, name: i.name, h: i.h, w: i.w, img: Boolean(i.img) }; });
  check('adding a picture attaches it, keeping its shape', im.kind === 'image' && im.name === 'badge' && im.img && Math.abs(im.h / im.w - 100 / 160) < 0.01, im);
  await ev(() => window.__walkBase.patchAttach(window.__walkBase.attachItem().id, { w: 0.5, opacity: 1, x: 0, y: 0 }));
  await settle(page);
  const red = await countColour(page, [208, 32, 32], 30);
  check('the picture is drawn on the figure', red > 400, red);
  // the transparent corner shows what is behind it, so the red area is three quarters of the picture
  const hs = await handles(page);
  const lower = await ev(([cx, cy]) => { const w = window.__walkBase; const it = w.attachItem(); const e = w.S.last.attach.find((p) => p.it.id === it.id); return { aspect: it.h / it.w, k: e.f.scale * it.scale, w: it.w }; }, [hs.center.x, hs.center.y]);
  check('a picture shows its own aspect on the stage', lower.aspect > 0.6 && lower.aspect < 0.65);
  await page.waitForTimeout(700);
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(600);
  const back = await ev(() => { const w = window.__walkBase; const i = w.attachList().find((a) => a.kind === 'image'); return i ? { img: Boolean(i.img) } : null; });
  await ev(() => window.__walkBase.render()); await page.waitForTimeout(200);
  check('the picture and its attachment survive a reload', back?.img && (await countColour(page, [208, 32, 32], 30)) > 400);

  // the settings file carries attachments and pictures
  const [dl] = await Promise.all([page.waitForEvent('download'), press(page, 'file-save')]);
  const saved = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  check('Save settings includes the attachments and the picture', saved.attach?.human?.length === 1 && Object.keys(saved.images || {}).length === 1, { n: saved.attach?.human?.length, imgs: Object.keys(saved.images || {}).length });
  await ev(() => { try { localStorage.clear(); } catch { /* none */ } });
  await page.reload(); await page.waitForFunction(() => window.__walkBase); await page.waitForTimeout(300);
  check('after clearing there is nothing attached', (await ev(() => window.__walkBase.attachList().length)) === 0);
  await page.locator('[data-testid="settings-load"]').setInputFiles(await dl.path());
  await page.waitForFunction(() => window.__walkBase.attachList().length === 1, null, { timeout: 5000 });
  await settle(page); await page.waitForTimeout(300);
  check('Load settings brings the picture attachment back and draws it', (await countColour(page, [208, 32, 32], 30)) > 400);

  // size of everything on the Attach tab, with a finger
  await ev(() => { const w = window.__walkBase; w.selectAttach(w.attachList()[0].id); });
  await q('tab-Attach').tap(); await page.waitForTimeout(200);
  const bad = await ev(() => { const out = []; for (const el of document.querySelectorAll('.panel button, .panel input, .panel select')) { const box = (el.type === 'checkbox') ? (el.closest('label') || el) : el; const r = box.getBoundingClientRect(); const s = getComputedStyle(el); if (!r.width || !r.height || s.display === 'none' || el.disabled || el.type === 'file' || el.classList.contains('sr')) continue; const m = el.type === 'range' ? r.height : Math.min(r.width, r.height); if (m < 43.5) out.push(`${el.dataset.testid || el.className}:${Math.round(r.width)}x${Math.round(r.height)}`); } return out; });
  check('every control on the Attach tab is at least 44 px on a touch screen', bad.length === 0, bad.slice(0, 6).join(' '));
  const over = await ev(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('and nothing scrolls sideways', over <= 0, over);
  await context.close();
}

check('no page errors', errors.length === 0, errors.slice(0, 3));
await browser.close();
process.exit(fails ? 1 : 0);
