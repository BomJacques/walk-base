// The controls and part names were written for the dog (paws, a dog's gait). For the other figures this rewrites the words, and says which controls do not apply.
import { SPECIES, kindOf } from './dogdefaults.js';

const SPECIAL = {
  theropod: [['Front legs', 'Arms'], ['Hind legs', 'Legs'], ['Front leg and elbow', 'Arm and elbow'], ['Front paw', 'Hand and claws'], ['Hind leg and knee', 'Leg and knee'], ['Hind paw', 'Foot']],
  bird: [['Front legs', 'Wings'], ['Hind legs', 'Legs'], ['Front leg and elbow', 'Wing and elbow'], ['Front paw', 'Wing tip'], ['Hind leg and knee', 'Leg and knee'], ['Hind paw', 'Foot']],
};
const BIPED_ONLY = ['dogTilt', 'dogArmSwing'];
const BIRD_ONLY = ['dogHeadHold', 'dogWingOpen', 'dogFlap', 'dogFlapRate', 'dogFlapFrames', 'dogFlight', 'dogFlightHeight'];
const EARS = ['dogEar', 'dEar'];
const QUAD_ONLY = ['dogShoulder'];
/** Controls to leave out, by figure. */
const HIDE = {
  dog: new Set([...BIPED_ONLY, ...BIRD_ONLY]),
  sauropod: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS]),
  ceratopsian: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS]),
  theropod: new Set([...BIRD_ONLY.filter((x) => x !== 'dogHeadHold'), ...EARS, ...QUAD_ONLY]), // a theropod holds its head steady in a run too
  bird: new Set([...EARS, ...QUAD_ONLY, 'dogArmSwing']),
  horse: new Set([...BIPED_ONLY, ...BIRD_ONLY]),
};
/** Rubber hose settings that are only for the person: the animals have no gloves, shorts or pie eyes. */
const HOSE_PERSON = new Set(['hoseEars', 'hoseEyes', 'hoseShorts', 'hoseGlove', 'hoseSquash', 'hoseTail']);

/** The gaits each figure can do. */
const GAITS = { dog: ['walk', 'trot', 'pace', 'gallop'], sauropod: ['walk'], ceratopsian: ['walk', 'trot'], theropod: ['walk', 'run'], bird: ['walk', 'run', 'hop'], horse: ['walk', 'trot', 'pace', 'gallop'] };

/** A function that rewrites a label for this figure, with .hides(control) and .hidesPart(id). The human and the dog are left as they are. */
export function wordsFor(fig) {
  const sp = SPECIES[fig]; const kind = kindOf(fig);
  const hide = HIDE[kind] || new Set();
  let f;
  if (!sp || fig === 'dog') f = (s) => String(s ?? '');
  else {
    const name = sp.word || sp.label; const low = name.toLowerCase(); const special = SPECIAL[kind] || [];
    f = (s) => {
      let t = String(s ?? '');
      for (const [a, b] of special) t = t.split(a).join(b);
      return t.replace(/\bDog\b/g, name).replace(/\bdog\b/g, low).replace(/\bPaws\b/g, 'Feet').replace(/\bpaws\b/g, 'feet').replace(/\bPaw\b/g, 'Foot').replace(/\bpaw\b/g, 'foot');
    };
  }
  f.hides = (c) => hide.has(c.id) || (/^hose/.test(c.id) && (sp?.hose ? HOSE_PERSON.has(c.id) : fig !== 'hose')); // the rubber hose controls belong to the rubber hose figures
  /** The choices a control offers this figure (a theropod has no hop or gallop). */
  f.options = (c) => (c.id === 'dogGait' && GAITS[kind] ? c.options.filter((o) => GAITS[kind].includes(o)) : c.options);
  f.hidesPart = (id) => Boolean(sp && fig !== 'dog' && id === 'dog.ear');
  return f;
}
