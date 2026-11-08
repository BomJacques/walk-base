// The controls and part names were written for the dog (paws, a dog's gait). For the other figures this rewrites the words, and says which controls do not apply.
import { SPECIES } from './dogdefaults.js';

const SPECIAL = {
  theropod: [['Front legs', 'Arms'], ['Hind legs', 'Legs'], ['Front leg and elbow', 'Arm and elbow'], ['Front paw', 'Hand and claws'], ['Hind leg and knee', 'Leg and knee'], ['Hind paw', 'Foot']],
  bird: [['Front legs', 'Wings'], ['Hind legs', 'Legs'], ['Front leg and elbow', 'Wing and elbow'], ['Front paw', 'Wing tip'], ['Hind leg and knee', 'Leg and knee'], ['Hind paw', 'Foot']],
};
const BIPED_ONLY = ['dogTilt', 'dogArmSwing'];
const BIRD_ONLY = ['dogHeadHold', 'dogWingOpen', 'dogFlap', 'dogFlapRate', 'dogFlapFrames', 'dogFlight', 'dogFlightHeight'];
const EARS = ['dogEar', 'dEar'];
const QUAD_ONLY = ['dogShoulder', 'dogCurl'];
/** Controls to leave out, by figure. */
const HIDE = {
  dog: new Set([...BIPED_ONLY, ...BIRD_ONLY]),
  sauropod: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS]),
  ceratopsian: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS]),
  theropod: new Set([...BIRD_ONLY, ...EARS, ...QUAD_ONLY]),
  bird: new Set([...EARS, ...QUAD_ONLY, 'dogArmSwing']),
};

/** A function that rewrites a label for this figure, with .hides(control) and .hidesPart(id). The human and the dog are left as they are. */
export function wordsFor(fig) {
  const sp = SPECIES[fig];
  const hide = HIDE[fig] || new Set();
  let f;
  if (!sp || fig === 'dog') f = (s) => String(s ?? '');
  else {
    const name = sp.label; const low = name.toLowerCase(); const special = SPECIAL[fig] || [];
    f = (s) => {
      let t = String(s ?? '');
      for (const [a, b] of special) t = t.split(a).join(b);
      return t.replace(/\bDog\b/g, name).replace(/\bdog\b/g, low).replace(/\bPaws\b/g, 'Feet').replace(/\bpaws\b/g, 'feet').replace(/\bPaw\b/g, 'Foot').replace(/\bpaw\b/g, 'foot');
    };
  }
  f.hides = (c) => hide.has(c.id);
  f.hidesPart = (id) => Boolean(sp && fig !== 'dog' && id === 'dog.ear');
  return f;
}
