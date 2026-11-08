// Runs the detector on a page image and compares its cuts with hand-checked crops.
// Usage: node compare_page.mjs page.bin w h catalog.json '{"mode":"count","count":8,"region":{...}}'
import fs from 'node:fs';
import { detectCuts } from '../src/slicer.js';
const [bin, w, h, cat, optJson] = process.argv.slice(2);
const chan = new Uint8Array(fs.readFileSync(bin));
const truth = JSON.parse(fs.readFileSync(cat));
const opts = optJson ? JSON.parse(optJson) : {};
const iou = (a, b) => { const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)); const iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const i = ix * iy; return i / (a.w * a.h + b.w * b.h - i); };
const cuts = detectCuts(chan, Number(w), Number(h), opts);
const inRegion = opts.region ? truth.filter((t) => t.y >= opts.region.y - 10 && t.y + t.h <= opts.region.y + opts.region.h + 10) : truth;
const best = inRegion.map((t) => Math.max(0, ...cuts.map((c) => iou(c, t))));
const matched = best.filter((v) => v > 0.5).length;
console.log(JSON.stringify(opts).slice(0, 90), `-> ${cuts.length} cuts; catalogue crops in range ${inRegion.length}; matched (IoU>0.5) ${matched}; mean best IoU ${(best.reduce((a, b) => a + b, 0) / Math.max(1, best.length)).toFixed(2)}`);
console.log('  ' + cuts.map((c) => `${c.x},${c.y} ${c.w}x${c.h}`).join(' | '));
