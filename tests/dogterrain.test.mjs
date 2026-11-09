import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULTS, groundAt } from '../src/rig.js';
import { poseDog, legsOf } from '../src/dog3.js';
import { PRESETS_DOG, PRESETS_SPECIES, CONTROLS, rigOf, shownFor } from '../src/controls.js';

const dog = (o = {}, species = 'dog') => ({ ...DEFAULTS, rig: 'dog', dogSpecies: species, motion: {}, proportions: {}, ...o });
/** The pose a long way along: the world position keeps growing, as in a performance. */
const walk = (p, i, per) => { const t = i / per; return poseDog(p, {}, t - Math.floor(t), { worldX: t * p.dogStride }); };

test('on a slope every planted paw is on the ground where it lands, and the dog climbs', () => {
  for (const grade of [12, -12]) {
    const p = dog({ terrain: 'slope', terrainGrade: grade }); const flat = dog();
    for (let i = 0; i < 96; i++) {
      const z = walk(p, i, 24); const f = walk(flat, i, 24);
      for (const leg of legsOf(p)) {
        const l = z.legs[leg]; assert.ok(l.reached, `${grade}° ${leg} at ${i}`);
        if (l.stance && l.w > 0.04 && l.w < p.dogDuty - 0.08) {
          const wx = (i / 24) * p.dogStride + l.paw[0];
          assert.ok(Math.abs(l.paw[1] - groundAt(p, wx) - f.legs[leg].paw[1]) < 0.03, `${leg} on the ground at ${i}`);
        }
      }
    }
    const a = walk(p, 0, 24).pelvis[1]; const b = walk(p, 96, 24).pelvis[1];
    assert.ok(grade > 0 ? b > a + 0.15 : b < a - 0.15, `the hips ${grade > 0 ? 'climb' : 'descend'}`);
  }
});

test('uphill the back tilts to carry the shoulders higher, downhill lower', () => {
  const sh = (grade) => { const p = dog({ terrain: 'slope', terrainGrade: grade }); const z = walk(p, 48, 24); return z.j3[1] - z.pelvis[1]; };
  assert.ok(sh(15) > sh(0) + 0.03 && sh(-15) < sh(0) - 0.03, `${sh(15)} ${sh(0)} ${sh(-15)}`);
});

test('the dog and the other animals keep every paw reachable on the terrain presets', () => {
  const cases = [['dog', PRESETS_DOG.Uphill], ['dog', PRESETS_DOG.Downhill], ['dog', PRESETS_DOG['Up the steps']]];
  for (const sp of ['theropod', 'sauropod', 'ceratopsian', 'bird']) cases.push([sp, { ...PRESETS_SPECIES[sp].Walk, terrain: 'slope', terrainGrade: 8 }], [sp, { ...PRESETS_SPECIES[sp].Walk, terrain: 'steps', terrainRise: 0.1, terrainRun: 1 }]);
  for (const [sp, pr] of cases) {
    const p = dog(pr, sp); const per = Math.round(p.cycleFrames);
    let bad = 0; for (let i = 0; i < per * 6; i++) { const z = walk(p, i, per); for (const leg of legsOf(p)) if (!z.legs[leg].reached) bad++; }
    assert.ok(bad <= per * 6 * 0.02, `${sp} ${pr.terrain}: ${bad} frames with a paw out of reach`);
  }
});

test('flat ground changes nothing for the dog', () => {
  const a = poseDog(dog(), {}, 0.37); const b = poseDog(dog({ terrainGrade: 20, terrainRise: 0.2 }), {}, 0.37);
  assert.deepEqual(a.legs.HR.paw, b.legs.HR.paw); assert.equal(a.groundY, 0);
});

test('the ground controls are shown for the dog too, and the presets are valid', () => {
  for (const id of ['terrain', 'terrainGrade', 'terrainRise', 'terrainRun', 'heading']) { const c = CONTROLS.find((x) => x.id === id); assert.ok(shownFor(c, 'dog') && shownFor(c, 'human'), id); assert.equal(rigOf(c), 'both'); }
  for (const name of ['Uphill', 'Downhill', 'Up the steps']) {
    for (const [k, v] of Object.entries(PRESETS_DOG[name])) { const c = CONTROLS.find((x) => x.id === k && x.scope === 'p'); assert.ok(c, `${name}.${k}`); assert.ok(c.type === 'enum' ? c.options.includes(v) : v >= c.min - 1e-9 && v <= c.max + 1e-9, `${name}.${k}=${v}`); }
  }
});
