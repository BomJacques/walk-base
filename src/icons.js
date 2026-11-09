// Line icons on a 16 pixel grid. They take their colour from the text around them.
// Each entry: [stroke paths, filled paths].
const ICONS = {
  undo: ['M6.5 3 3 6.5 6.5 10M3 6.5h6.2a3.3 3.3 0 0 1 0 6.6H6', ''],
  redo: ['M9.5 3 13 6.5 9.5 10M13 6.5H6.8a3.3 3.3 0 0 0 0 6.6H10', ''],
  first: ['M3.5 3.5v9', 'M12.5 3.8v8.4L6 8z'],
  prev: ['', 'M11.5 3.8v8.4L5 8z'],
  next: ['', 'M4.5 3.8v8.4L11 8z'],
  last: ['M12.5 3.5v9', 'M3.5 3.8v8.4L10 8z'],
  play: ['', 'M5 3.2v9.6L13 8z'],
  pause: ['M5.5 3.5v9M10.5 3.5v9', ''],
  rec: ['', 'M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z'],
  face: ['M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4zM5.4 9.6c.6 1.1 1.4 1.6 2.6 1.6s2-.5 2.6-1.6', 'M5.6 6.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6zM10.4 6.2a.8.8 0 1 0 0 1.6.8.8 0 0 0 0-1.6z'],
  select: ['M4.5 2.5l8 5.6-3.5.7 2.1 3.7-1.7 1-2.1-3.7-2.8 2.2z', ''],
  help: ['M5.9 6.2a2.1 2.1 0 1 1 3 1.9c-.6.3-.9.7-.9 1.3M8 11.7v.4M8 1.8a6.2 6.2 0 1 0 0 12.4A6.2 6.2 0 0 0 8 1.8z', ''],
  loop: ['M3 8.2a5 5 0 0 1 8.7-3.3L13 6.2M13 2.6v3.6H9.4M13 7.8a5 5 0 0 1-8.7 3.3L3 9.8M3 13.4V9.8h3.6', ''],
  orbit: ['M13 8a5 5 0 1 1-1.6-3.7M13 2.8v2.8h-2.8', ''],
  pan: ['M8 2v12M2 8h12M6.2 3.8 8 2l1.8 1.8M6.2 12.2 8 14l1.8-1.8M3.8 6.2 2 8l1.8 1.8M12.2 6.2 14 8l-1.8 1.8', ''],
  spin: ['M2.5 8c0-1.7 2.5-3 5.5-3s5.5 1.3 5.5 3-2.5 3-5.5 3M10 9.3 12.2 11 10 12.7', ''],
  fit: ['M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10', ''],
  chevronDown: ['M4 6.2 8 10l4-3.8', ''],
  chevronRight: ['M6.2 4 10 8l-3.8 4', ''],
  check: ['M3.5 8.4 6.6 11.5 12.5 4.6', ''],
  reset: ['M3 8a5 5 0 1 0 1.6-3.7M3 2.8v2.8h2.8', ''],
  close: ['M4 4l8 8M12 4 4 12', ''],
  info: ['M8 7.2v4M8 4.9v.1', 'M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4z'],
  more: ['', 'M3 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM8 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2zM13 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z'],
};
// the info icon is an outline circle with a mark, not a filled disc
ICONS.info = ['M8 7.4v3.6M8 5v.1M8 14.2A6.2 6.2 0 1 0 8 1.8a6.2 6.2 0 0 0 0 12.4z', ''];

const NS = 'http://www.w3.org/2000/svg';
/** An inline SVG icon by name. Decorative: the button around it carries the label. */
export function icon(name, size = 16) {
  const [stroke, fill] = ICONS[name] || ['', ''];
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('width', String(size)); svg.setAttribute('height', String(size));
  svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false'); svg.setAttribute('class', `icon icon-${name}`);
  if (stroke) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', stroke); p.setAttribute('fill', 'none'); p.setAttribute('stroke', 'currentColor'); p.setAttribute('stroke-width', '1.5'); p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); svg.append(p); }
  if (fill) { const p = document.createElementNS(NS, 'path'); p.setAttribute('d', fill); p.setAttribute('fill', 'currentColor'); p.setAttribute('stroke', name === 'rec' || name === 'play' ? 'none' : 'currentColor'); p.setAttribute('stroke-width', '1'); p.setAttribute('stroke-linejoin', 'round'); svg.append(p); }
  return svg;
}
export const ICON_NAMES = Object.keys(ICONS);
