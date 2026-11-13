// The controls and part names were written for the dog (paws, a dog's gait). For the other figures this rewrites the words, and says which controls do not apply.
import { SPECIES, kindOf } from './dogdefaults.js';

const SPECIAL = {
  theropod: [['Front leg length', 'Arm length'], ['Hind leg length', 'Leg length'], ['Front legs', 'Arms'], ['Hind legs', 'Legs'], ['Front leg and elbow', 'Arm and elbow'], ['Front paw', 'Hand and claws'], ['Hind leg and knee', 'Leg and knee'], ['Hind paw', 'Foot']],
  snake: [['Spine bend', 'Wave height'], ['Neck raise', 'Rear up'], ['Stride', 'Wavelength'], ['Body bounce', 'Ripple'], ['Body length', 'Length']],
  crab: [['Tail wag', 'Claw snap'], ['Body bounce', 'Bob']],
  plesiosaur: [['Front leg length', 'Front flipper length'], ['Hind leg length', 'Rear flipper length'], ['Front legs', 'Front flippers'], ['Hind legs', 'Rear flippers'], ['Front leg and elbow', 'Flipper and elbow'], ['Hind leg and knee', 'Rear flipper and knee'], ['Front paw', 'Flipper tip'], ['Hind paw', 'Flipper tip'], ['Wings open', 'Flippers out'], ['Wing beat', 'Flipper beat'], ['In flight', 'Swimming'], ['Flight height', 'Swim depth'], ['Frames per wing beat', 'Frames per flipper beat'], ['Bird: ', ''], ['Open the wings first.', 'Put the flippers out first.']],
  bird: [['Front leg length', 'Wing length'], ['Hind leg length', 'Leg length'], ['Front legs', 'Wings'], ['Hind legs', 'Legs'], ['Front leg and elbow', 'Wing and elbow'], ['Front paw', 'Wing tip'], ['Hind leg and knee', 'Leg and knee'], ['Hind paw', 'Foot']],
};
const BIPED_ONLY = ['dogTilt', 'dogArmSwing'];
const BIRD_ONLY = ['dogHeadHold', 'dogWingOpen', 'dogFlap', 'dogFlapRate', 'dogFlapFrames', 'dogFlight', 'dogFlightHeight'];
const EARS = ['dogEar', 'dEar', 'dEarW'];
const NEW_BODY = ['dLegF', 'dLegH', 'dSnout', 'dJaw', 'dJawW', 'dPaw', 'dTorso', 'dLimb', 'dNeckW', 'dTailW']; // for the animals on the dog's rig, not the snake, spider and crab
const QUAD_ONLY = ['dogShoulder'];
const NONE = ['dogGait', 'dogFlex', 'dogArch', 'dogCurl', 'dogTwist', 'dogHeadAngle', 'dogHeadNod', 'dogTailAngle', 'dogWag', 'dogNeckAngle', 'dogNeckSegs', 'dogNeckCurve', 'dogNeckWave', 'dogNeckSway', 'dogElbowOut', 'dogWidth', 'dogLift', 'dogDuty', 'dogAsymTiming', 'dogAsymDuty', 'dogAsymLift'];
/** Controls to leave out, by figure. */
const HIDE = {
  dog: new Set([...BIPED_ONLY, ...BIRD_ONLY]),
  sauropod: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS]),
  ceratopsian: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS]),
  theropod: new Set([...BIRD_ONLY.filter((x) => x !== 'dogHeadHold'), ...EARS, ...QUAD_ONLY]), // a theropod holds its head steady in a run too
  bird: new Set([...EARS, ...QUAD_ONLY, 'dogArmSwing']),
  horse: new Set([...BIPED_ONLY, ...BIRD_ONLY]),
  lizard: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS, ...QUAD_ONLY]),
  centaur: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS]),
  crocodile: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS, ...QUAD_ONLY]),
  monkey: new Set([...BIPED_ONLY, ...BIRD_ONLY]),
  dragon: new Set([...BIPED_ONLY, ...EARS, 'dogHeadHold']),
  plesiosaur: new Set([...BIPED_ONLY, ...EARS, 'dogHeadHold']),
  snake: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS, ...QUAD_ONLY, ...NONE.filter((k) => !['dogFlex', 'dogNeckAngle'].includes(k)), 'dogEar', 'dEar', 'dNeck', 'dLeg', 'dHead', ...NEW_BODY]),
  spider: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS, ...QUAD_ONLY, ...NONE.filter((k) => !['dogLift', 'dogDuty', 'dogAsymTiming', 'dogAsymDuty', 'dogAsymLift'].includes(k)), 'dNeck', 'dTail', ...NEW_BODY]),
  ant: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS, ...QUAD_ONLY, ...NONE.filter((k) => !['dogLift', 'dogDuty', 'dogAsymTiming', 'dogAsymDuty', 'dogAsymLift'].includes(k)), 'dNeck', 'dTail', ...NEW_BODY]),
  beetle: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS, ...QUAD_ONLY, ...NONE.filter((k) => !['dogLift', 'dogDuty', 'dogAsymTiming', 'dogAsymDuty', 'dogAsymLift'].includes(k)), 'dNeck', 'dTail', ...NEW_BODY]),
  crab: new Set([...BIPED_ONLY, ...BIRD_ONLY, ...EARS, ...QUAD_ONLY, ...NONE.filter((k) => !['dogLift', 'dogDuty', 'dogAsymTiming', 'dogAsymDuty', 'dogAsymLift', 'dogWag'].includes(k)), 'dNeck', 'dTail', ...NEW_BODY]),
};
/** Rubber hose settings that are only for the person: the animals have no gloves, shorts or pie eyes. */
const HOSE_PERSON = new Set(['hoseEars', 'hoseEyes', 'hoseShorts', 'hoseGlove', 'hoseSquash', 'hoseTail']);

/** The gaits each figure can do. */
const GAITS = { dog: ['walk', 'trot', 'pace', 'gallop'], sauropod: ['walk'], ceratopsian: ['walk', 'trot'], theropod: ['walk', 'run'], bird: ['walk', 'run', 'hop'], horse: ['walk', 'trot', 'pace', 'gallop'], snake: ['walk'], spider: ['walk'], crab: ['walk'], ant: ['walk'], beetle: ['walk'], lizard: ['walk', 'trot'], stegosaurus: ['walk', 'trot'], monkey: ['walk', 'trot', 'gallop'], dragon: ['walk', 'trot'], plesiosaur: ['walk'] };

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
  const FACE = /^(eye|brow|blink|mouth(Show|Style|Width|Smile)|lip|teeth|tongue|cavity)/; // the face settings are for the two-legged figures' heads
  f.hides = (c) => hide.has(c.id) || (c.id === 'dGirth' && !sp?.crawler) || (c.id === 'dogLegVariety' && !(sp?.crawler && sp.legs > 0)) || (Boolean(sp) && c.scope === 's' && FACE.test(c.id)) || (/^hose/.test(c.id) && (sp?.hose ? HOSE_PERSON.has(c.id) : fig !== 'hose')); // the rubber hose controls belong to the rubber hose figures
  /** The choices a control offers this figure (a theropod has no hop or gallop). */
  f.options = (c) => (c.id === 'dogGait' && GAITS[kind] ? c.options.filter((o) => GAITS[kind].includes(o)) : c.options);
  f.hidesPart = (id) => Boolean(sp && fig !== 'dog' && id === 'dog.ear');
  return f;
}
