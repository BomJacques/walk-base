// Drop-down menus: a trigger button and a popover list. One open at a time. Works with a finger, a pointer and the keyboard.
//   Arrow keys move, Home and End jump, Enter or Space chooses, Escape closes and returns to the trigger.
//   In a menu bar, moving the pointer onto a neighbouring trigger, or pressing the left or right arrow, switches menus.
import { icon } from './icons.js';

/** Which trigger owns each menu item, by test id, so a script can find an item that is not on screen yet. */
const OWNER = new Map();
export const menuOwner = (testid) => OWNER.get(testid) ?? null;

let current = null; // { trigger, pop, off }

export function closeMenus({ restoreFocus = false } = {}) {
  if (!current) return;
  const { trigger, pop, off } = current;
  current = null; off();
  pop.remove(); trigger.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger.focus();
}

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k === 'testid') e.dataset.testid = v; else e.setAttribute(k, v === true ? '' : v); }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
};

/** Opens a menu at a point on the screen (a right-click or a long press), made of the same items as any menu. */
export function openMenuAt(x, y, items, label = 'Menu', testid = 'context-menu') {
  closeMenus();
  document.querySelectorAll('.ctx-anchor').forEach((a) => a.remove());
  const t = menuButton({ label: null, testid, items, ariaLabel: label, caret: false, className: 'ctx-anchor' });
  t.style.cssText = `position:fixed;left:${Math.round(x)}px;top:${Math.round(y)}px;width:1px;height:1px;padding:0;border:0;opacity:0;pointer-events:none;`;
  document.body.append(t); t.click();
}

/**
 * items: array, or a function returning an array, of
 *   { label, testid, onClick, shortcut, disabled, checked, radio, separator, heading }
 * Returns the trigger button. `bar` groups triggers into a menu bar.
 */
export function menuButton({ label, iconName = null, testid, items, ariaLabel, className = 'btn', bar = null, align = 'start', caret = true, title }) {
  const list = () => (typeof items === 'function' ? items() : items);
  const trigger = el('button', {
    type: 'button', class: `${className} menu-trigger`, testid, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-label': ariaLabel || (label || title || testid), title: title || null,
    ...(bar ? { 'data-menubar': bar, role: 'menuitem' } : {}),
  }, iconName ? icon(iconName) : null, label ? el('span', { class: 'lbl' }, label) : null, caret ? icon('chevronDown', 12) : null);
  for (const it of list()) if (it.testid) OWNER.set(it.testid, testid);

  const open = (focusFirst = false) => {
    if (current?.trigger === trigger) return;
    closeMenus();
    const pop = el('div', { class: 'menu', role: 'menu', 'aria-label': ariaLabel || label || title || '', testid: `${testid}-list` });
    const rows = [];
    for (const it of list()) {
      if (it.separator) { pop.append(el('div', { class: 'menu-sep', role: 'separator' })); continue; }
      if (it.heading) { pop.append(el('div', { class: 'menu-head', role: 'presentation' }, it.heading)); continue; }
      const role = it.radio ? 'menuitemradio' : it.checked != null ? 'menuitemcheckbox' : 'menuitem';
      const b = el('button', { type: 'button', class: 'mi', role, testid: it.testid || null, disabled: it.disabled || null, tabindex: '-1', ...(role !== 'menuitem' ? { 'aria-checked': String(Boolean(it.checked)) } : {}) },
        el('span', { class: 'mi-check' }, it.checked ? icon('check', 14) : null), el('span', { class: 'mi-label' }, it.label), it.shortcut ? el('span', { class: 'mi-key' }, it.shortcut) : null);
      b.addEventListener('click', () => { closeMenus(); if (!it.disabled) it.onClick?.(); trigger.focus({ preventScroll: true }); });
      pop.append(b); rows.push(b);
    }
    document.body.append(pop);
    trigger.setAttribute('aria-expanded', 'true');
    // Place it under the trigger, kept inside the window.
    const r = trigger.getBoundingClientRect(); const pw = pop.offsetWidth; const ph = pop.offsetHeight;
    const left = align === 'end' ? r.right - pw : r.left;
    pop.style.left = `${Math.max(4, Math.min(window.innerWidth - pw - 4, left))}px`;
    const below = r.bottom + 2; const top = below + ph > window.innerHeight - 4 ? Math.max(4, r.top - ph - 2) : below;
    pop.style.top = `${top}px`; pop.style.maxHeight = `${window.innerHeight - 8}px`;

    const onDown = (e) => { if (!pop.contains(e.target) && !trigger.contains(e.target)) closeMenus(); };
    const onKey = (e) => {
      const enabled = rows.filter((b) => !b.disabled); const i = enabled.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); closeMenus({ restoreFocus: true }); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); enabled[(i + 1) % enabled.length]?.focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); enabled[(i - 1 + enabled.length) % enabled.length]?.focus(); }
      else if (e.key === 'Home') { e.preventDefault(); enabled[0]?.focus(); }
      else if (e.key === 'End') { e.preventDefault(); enabled[enabled.length - 1]?.focus(); }
      else if (e.key === 'Tab') closeMenus();
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && bar) {
        const peers = [...document.querySelectorAll(`[data-menubar="${bar}"]`)]; const k = peers.indexOf(trigger);
        const next = peers[(k + (e.key === 'ArrowRight' ? 1 : -1) + peers.length) % peers.length];
        e.preventDefault(); next.focus(); next.click();
      }
    };
    const onResize = () => closeMenus();
    document.addEventListener('pointerdown', onDown, true); document.addEventListener('keydown', onKey, true); window.addEventListener('resize', onResize);
    current = { trigger, pop, off: () => { document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true); window.removeEventListener('resize', onResize); } };
    if (focusFirst) rows.find((b) => !b.disabled)?.focus();
  };

  trigger.addEventListener('click', (e) => { if (current?.trigger === trigger) closeMenus(); else open(e.detail === 0); });
  trigger.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(true); } });
  // In a bar, once one menu is open, pointing at another opens that one.
  if (bar) trigger.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && current && current.trigger !== trigger && current.trigger.dataset.menubar === bar) open(false); });
  return trigger;
}
