import fs from 'node:fs';
import { detectCuts } from '../src/slicer.js';
const [bin, w, h, ...rest] = process.argv.slice(2);
const chan = new Uint8Array(fs.readFileSync(bin));
for (const ms of [10, 25, 40, 60]) {
  const cuts = detectCuts(chan, Number(w), Number(h), { minSize: ms });
  console.log(`minSize ${ms}: ${cuts.length}`, cuts.map((c) => `${c.w}x${c.h}`).join(' '));
}
