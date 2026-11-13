// Gait settings for the dog. Units are shoulder heights (a standing dog's withers are about 1.0 high). Kept apart so rig.js can include them without a cycle.
export const DOG_DEFAULTS = Object.freeze({
  dogGait: 'walk',        // walk | trot | pace: which feet move together
  dogStride: 0.95,        // distance covered in one full cycle, in shoulder heights
  dogDuty: 0.68,          // fraction of the cycle a paw is on the ground
  dogLift: 0.13,          // paw clearance in the swing
  dogAsymTiming: 0,       // cycle fraction the left paws land late
  dogAsymDuty: 0,         // left paws' time on the ground, added to dogDuty
  dogAsymLift: 0,         // left paws' lift, as a fraction more or less
  dogLegVariety: 0.6,     // many-legged creatures: how far each leg goes its own way (0 is the same step for every leg)
  dogBob: 0.03,           // up and down travel of the hips
  dogFlex: 6,             // degrees the spine bends side to side
  dogArch: 2,             // degrees the back arches with each footfall
  dogWidth: 0.11,         // half the gap between left and right paws
  dogNeckSegs: 1,         // bones in the neck (a sauropod's is long and bends along its length)
  dogNeckCurve: 0,        // degrees the neck bends over its length (positive droops, negative arches)
  dogNeckWave: 0,         // degrees each neck bone nods as a wave runs up it
  dogNeckSway: 0,         // degrees each neck bone swings sideways as a wave runs up it
  dogNeckAngle: 52,       // degrees the neck rises from the back
  dogHeadAngle: 34,       // degrees the head tips back down from the neck
  dogHeadNod: 3,          // degrees
  dogTailAngle: 28,       // degrees the tail is carried above the back
  dogWag: 22,             // degrees the tail swings each way
  dogEar: 7,              // degrees the ears bounce
  dogElbowOut: 3,         // degrees the elbows and knees turn out
  dogShoulder: 0.05,      // how far each shoulder blade drops and slides as its paw lands, in shoulder heights
  dogTwist: 6,            // degrees the shoulders and hips counter-rotate along the spine
  dogSpecies: 'dog',      // dog | sauropod | ceratopsian | theropod | bird: which legged figure this is
  dogTilt: 0,             // two-legged figures: degrees the chest is raised above level (a theropod is nearly level, a bird is tipped up)
  dogHeadHold: 0,         // a bird holds its head still in space while the body moves under it, then thrusts it forward: 0 is off, 1 is fully held
  dogArmSwing: 0.02,      // two-legged figures: how far the small arms swing, in shoulder heights
  dogWingOpen: 0,         // bird: 0 folds the wings, 1 spreads them
  dogFlap: 0,             // bird: degrees each wing beats up and down
  dogFlapRate: 1,         // bird: beats per cycle
  dogFlapFrames: 0,       // bird: frames per wing beat on its own clock, so the wings keep beating when the walk slows or stops. 0 ties the beat to the walk cycle (Beats per cycle)
  dogFlight: 0,           // bird: 0 on the ground, 1 in the air (the feet tuck up under the tail and the body lifts, rising on each down-stroke)
  dogFlightHeight: 1.1,   // bird: how high the body flies above its standing height, in shoulder heights
  dogCurl: 14,            // gallop only: degrees the back curls up when the legs gather and stretches out when they reach
});
export const DOG_GAITS = Object.freeze({
  // How far each front paw trails the hind paw on the same side, as a fraction of the cycle.
  // The book's dog walk chart has the hips rise and fall twice a cycle, so the walk bobs at the same rate as the trot.
  walk: { front: 0.25, bobRate: 2 },
  trot: { front: 0.5, bobRate: 2 },
  pace: { front: 0, bobRate: 2 },
  // Gallop (a transverse gallop, as dogs run): the hind paws land one after the other, then the front paws, then the body is in the air with the legs gathered under it.
  // A second, shorter flight comes with the legs stretched out. `phases` gives each paw's landing; the body is highest in the two flights.
  // A two-legged run (a theropod, or a chicken): the feet alternate, there is a flight phase between steps, and the back squashes (legs gathered under the body, hips low,
  // back arched) at mid-stance and stretches (legs reaching, hips high, back long) in flight, once every step, so twice a cycle.
  run: { front: 0, bobRate: 2, bobPhase: 0.45, bobDown: true, chestSign: 1, chestLag: 0, curlPhase: 0.2, curlRate: 2, tailCurl: 0.9, phases: { HR: 0, HL: 0.5, FR: 0, FL: 0.5 } },
  // Both feet land together (a hop).
  hop: { front: 0, bobRate: 1, phases: { HL: 0, HR: 0, FL: 0, FR: 0 } },
  gallop: { front: 0.5, bobRate: 2, bobPhase: 0.36, bobDown: true, chestSign: 1, chestLag: 0, phases: { HL: 0, HR: 0.1, FL: 0.38, FR: 0.5 }, curlPhase: 0.85 },
});

/**
 * The legged figures share one rig (the dog's: a back of three bones, a neck, a head, a tail of three, and four limbs with IK paws).
 * A species changes its bones and how the limbs are used: `front` is 'leg' (planted), 'arm' (hangs free, swings a little) or 'wing' (folds, or opens and flaps);
 * `legs` is how many limbs carry the body; `lean` is how far the hock and the wrist lean (a column leg is nearly straight);
 * `look` scales the thickness of each part when drawn; `view` frames the figure.
 */
const SPECIES_BASE = Object.freeze({
  dog: { label: 'Dog', legs: 4, front: 'leg', bones: {}, lean: { hock: 0.35, pastern: 0.12 }, look: { body: 1, leg: 1, neck: 1, tail: 1, wing: 1 }, view: { zoom: 1.45, y: 0.55 } },
  sauropod: {
    label: 'Sauropod', legs: 4, front: 'leg', belly: 0.95, tailBase: 1.7, neckBase: 1.9,
    bones: { spine: [0.42, 0.42, 0.42], neck: 1.7, skull: 0.15, snout: 0.1, jaw: 0.1, upper: 0.55, fore: 0.5, pastern: 0.1, thigh: 0.6, shin: 0.5, meta: 0.1, paw: 0.06, pawLen: 0.24, shoulderDrop: 0.1, scapula: 0.3, tail: [0.75, 0.65, 0.55], ear: 0.02, hipWidth: 0.16, shoulderWidth: 0.17, scapulaWidth: 0.14 },
    lean: { hock: 0.06, pastern: 0.04 }, look: { body: 2.1, leg: 2.1, neck: 1.25, tail: 1.8, wing: 1 }, view: { zoom: 0.72, y: 1.0 },
  },
  ceratopsian: {
    label: 'Ceratopsian', legs: 4, front: 'leg', belly: 0.95, tailBase: 1.4, neckBase: 1.4,
    bones: { spine: [0.36, 0.36, 0.36], neck: 0.3, skull: 0.5, snout: 0.28, jaw: 0.32, upper: 0.36, fore: 0.34, pastern: 0.12, thigh: 0.42, shin: 0.36, meta: 0.12, paw: 0.06, pawLen: 0.2, scapula: 0.26, tail: [0.42, 0.36, 0.3], ear: 0.02, hipWidth: 0.13, shoulderWidth: 0.15, scapulaWidth: 0.12 },
    lean: { hock: 0.14, pastern: 0.08 }, look: { body: 1.7, leg: 1.6, neck: 1.5, tail: 1.5, wing: 1 }, view: { zoom: 1.05, y: 0.6 },
  },
  theropod: {
    label: 'Theropod', legs: 2, front: 'arm', armRest: [0.1, -0.13, 0], belly: 0.95, tailBase: 1.9, neckBase: 1.7, teeth: true, brow: true,
    bones: { spine: [0.36, 0.36, 0.36], neck: 0.55, skull: 0.5, snout: 0.34, jaw: 0.52, upper: 0.14, fore: 0.12, pastern: 0.06, thigh: 0.64, shin: 0.62, meta: 0.44, paw: 0.06, pawLen: 0.24, shoulderDrop: 0.1, scapula: 0.14, tail: [0.8, 0.7, 0.6], ear: 0.02, hipWidth: 0.1, shoulderWidth: 0.08, scapulaWidth: 0.07 },
    lean: { hock: 0.3, pastern: 0.1 }, look: { body: 1.7, leg: 1.5, neck: 1.5, tail: 1.8, wing: 1 }, view: { zoom: 0.8, y: 0.95 },
  },
  horse: {
    label: 'Horse', legs: 4, front: 'leg',
    bones: { spine: [0.33, 0.33, 0.33], neck: 0.56, skull: 0.26, snout: 0.3, jaw: 0.34, upper: 0.27, fore: 0.34, pastern: 0.25, thigh: 0.34, shin: 0.35, meta: 0.27, paw: 0.05, pawLen: 0.09, tail: [0.24, 0.24, 0.22], ear: 0.1, hipWidth: 0.085, shoulderWidth: 0.09 },
    lean: { hock: 0.26, pastern: 0.07 }, look: { body: 1.3, leg: 0.85, neck: 1.3, tail: 1.5, wing: 1, snout: 1.6, ear: 0.55 }, view: { zoom: 1.15, y: 0.65 }, // a deep muzzle that covers the jaw, and small pointed ears
  },
  snake: {
    label: 'Snake', crawler: 'snake', legs: 0, legKeys: [], front: 'leg',
    bones: { spine: [1, 1, 1], neck: 0.8, skull: 0.2, snout: 0.12, jaw: 0.2, tail: [0.9, 0.8, 0.7], upper: 0.1, fore: 0.1, pastern: 0.05, thigh: 0.1, shin: 0.1, meta: 0.05, paw: 0.02, pawLen: 0.05, ear: 0.02 },
    lean: { hock: 0, pastern: 0 }, look: { body: 1, leg: 1, neck: 1, tail: 1, wing: 1 }, view: { zoom: 0.42, y: 0.12 },
  },
  spider: {
    label: 'Spider', crawler: 'spider', legs: 8, legKeys: ['FR', 'FL', 'AR', 'AL', 'BR', 'BL', 'HR', 'HL'], front: 'leg',
    bones: { spine: [0.28, 0.2, 0.2], neck: 0.05, skull: 0.12, snout: 0.05, jaw: 0.1, tail: [0.1, 0.1, 0.1], upper: 0.55, fore: 0.7, pastern: 0.22, thigh: 0.4, shin: 0.4, meta: 0.2, paw: 0.02, pawLen: 0.05, ear: 0.02 },
    lean: { hock: 0, pastern: 0 }, look: { body: 1, leg: 1, neck: 1, tail: 1, wing: 1 }, view: { zoom: 1.0, y: 0.4 },
  },
  ant: {
    label: 'Ant', crawler: 'ant', legs: 6, legKeys: ['FR', 'FL', 'AR', 'AL', 'HR', 'HL'], front: 'leg',
    bones: { spine: [0.5, 0.24, 0.3], neck: 0.04, skull: 0.2, snout: 0.06, jaw: 0.1, tail: [0.1, 0.1, 0.1], upper: 0.22, fore: 0.3, pastern: 0.12, thigh: 0.4, shin: 0.4, meta: 0.2, paw: 0.02, pawLen: 0.05, ear: 0.02 },
    lean: { hock: 0, pastern: 0 }, look: { body: 1, leg: 1, neck: 1, tail: 1, wing: 1 }, view: { zoom: 2.0, y: 0.2 },
  },
  beetle: {
    label: 'Beetle', crawler: 'beetle', legs: 6, legKeys: ['FR', 'FL', 'AR', 'AL', 'HR', 'HL'], front: 'leg',
    bones: { spine: [0.7, 0.3, 0.36], neck: 0.04, skull: 0.2, snout: 0.06, jaw: 0.1, tail: [0.1, 0.1, 0.1], upper: 0.22, fore: 0.3, pastern: 0.1, thigh: 0.3, shin: 0.3, meta: 0.14, paw: 0.025, pawLen: 0.05, ear: 0.02 },
    lean: { hock: 0, pastern: 0 }, look: { body: 1, leg: 1, neck: 1, tail: 1, wing: 1 }, view: { zoom: 2.0, y: 0.18 },
  },
  crab: {
    label: 'Crab', crawler: 'crab', legs: 8, legKeys: ['FR', 'FL', 'AR', 'AL', 'BR', 'BL', 'HR', 'HL'], front: 'leg',
    bones: { spine: [0.2, 0.3, 0.2], neck: 0.05, skull: 0.08, snout: 0.05, jaw: 0.08, tail: [0.1, 0.1, 0.1], upper: 0.3, fore: 0.34, pastern: 0.12, thigh: 0.3, shin: 0.28, meta: 0.12, paw: 0.02, pawLen: 0.05, ear: 0.02 },
    lean: { hock: 0, pastern: 0 }, look: { body: 1, leg: 1, neck: 1, tail: 1, wing: 1 }, view: { zoom: 1.5, y: 0.3 },
  },
  lizard: {
    label: 'Lizard', legs: 4, front: 'leg',
    bones: { spine: [0.4, 0.4, 0.4], neck: 0.28, skull: 0.3, snout: 0.24, jaw: 0.3, upper: 0.2, fore: 0.19, pastern: 0.1, thigh: 0.22, shin: 0.2, meta: 0.1, paw: 0.045, pawLen: 0.16, shoulderDrop: 0.06, scapula: 0.14, tail: [0.75, 0.65, 0.55], ear: 0.02, hipWidth: 0.1, shoulderWidth: 0.11, scapulaWidth: 0.09 },
    lean: { hock: 0.3, pastern: 0.12 }, look: { body: 0.95, leg: 1.2, neck: 1.2, tail: 1.6, wing: 1 }, view: { zoom: 1.0, y: 0.45 },
  },
  pterodactyl: {
    label: 'Pterodactyl', like: 'bird', legs: 2, front: 'wing', armRest: [-0.3, -0.02, 0], crest: true, membrane: true,
    bones: { spine: [0.17, 0.17, 0.17], neck: 0.55, skull: 0.3, snout: 0.5, jaw: 0.3, upper: 0.55, fore: 0.6, pastern: 0.5, thigh: 0.28, shin: 0.34, meta: 0.3, paw: 0.03, pawLen: 0.14, shoulderDrop: 0.06, shoulderBack: 0.02, scapula: 0.1, tail: [0.1, 0.1, 0.08], ear: 0.02, hipWidth: 0.06, shoulderWidth: 0.07, scapulaWidth: 0.05 },
    lean: { hock: 0.5, pastern: 0.1 }, look: { body: 1.3, leg: 0.5, neck: 0.7, tail: 0.8, wing: 1.5 }, view: { zoom: 0.95, y: 0.7 },
  },
  plesiosaur: {
    label: 'Plesiosaur', legs: 4, front: 'wing', hind: 'wing', flipper: true, armRest: [-0.12, -0.12, 0.28], hindRest: [-0.1, -0.1, 0.26],
    bones: { spine: [0.5, 0.5, 0.5], neck: 1.8, skull: 0.2, snout: 0.16, jaw: 0.2, upper: 0.4, fore: 0.36, pastern: 0.26, thigh: 0.4, shin: 0.36, meta: 0.26, paw: 0.03, pawLen: 0.1, shoulderDrop: 0.1, scapula: 0.2, tail: [0.45, 0.35, 0.28], ear: 0.02, hipWidth: 0.14, shoulderWidth: 0.15, scapulaWidth: 0.12 },
    lean: { hock: 0.1, pastern: 0.05 }, look: { body: 2.1, leg: 1.6, neck: 1.1, tail: 1.4, wing: 1.8 }, view: { zoom: 0.7, y: 1.0 },
  },
  stegosaurus: {
    label: 'Stegosaurus', word: 'Stegosaurus', like: 'ceratopsian', legs: 4, front: 'leg', belly: 0.95, tailBase: 1.5, neckBase: 1.3, plates: 1, tailSpikes: true,
    bones: { spine: [0.42, 0.42, 0.4], neck: 0.3, skull: 0.22, snout: 0.26, jaw: 0.24, upper: 0.28, fore: 0.26, pastern: 0.1, thigh: 0.5, shin: 0.4, meta: 0.14, paw: 0.06, pawLen: 0.2, scapula: 0.2, tail: [0.6, 0.55, 0.5], ear: 0.02, hipWidth: 0.14, shoulderWidth: 0.15, scapulaWidth: 0.12 },
    lean: { hock: 0.12, pastern: 0.06 }, look: { body: 1.9, leg: 1.5, neck: 1.5, tail: 1.5, wing: 1 }, view: { zoom: 0.9, y: 0.75 },
  },
  crocodile: {
    label: 'Crocodile', like: 'lizard', legs: 4, front: 'leg', ridge: 0.6,
    bones: { spine: [0.5, 0.5, 0.5], neck: 0.16, skull: 0.5, snout: 0.8, jaw: 0.85, upper: 0.18, fore: 0.17, pastern: 0.09, thigh: 0.2, shin: 0.18, meta: 0.09, paw: 0.04, pawLen: 0.14, shoulderDrop: 0.05, scapula: 0.12, tail: [0.95, 0.85, 0.75], ear: 0.02, hipWidth: 0.13, shoulderWidth: 0.14, scapulaWidth: 0.11 },
    lean: { hock: 0.3, pastern: 0.1 }, look: { body: 2, leg: 1.4, neck: 1.8, tail: 2.5, wing: 1, snout: 1.2 }, view: { zoom: 0.8, y: 0.4 },
  },
  monkey: {
    label: 'Monkey', legs: 4, front: 'leg',
    bones: { spine: [0.3, 0.3, 0.3], neck: 0.22, skull: 0.32, snout: 0.12, jaw: 0.14, upper: 0.42, fore: 0.42, pastern: 0.16, thigh: 0.34, shin: 0.34, meta: 0.16, paw: 0.05, pawLen: 0.16, shoulderDrop: 0.1, shoulderBack: 0.04, scapula: 0.2, tail: [0.55, 0.55, 0.5], ear: 0.1, hipWidth: 0.08, shoulderWidth: 0.1, scapulaWidth: 0.08 },
    lean: { hock: 0.35, pastern: 0.18 }, look: { body: 1.05, leg: 0.8, neck: 1, tail: 1.1, wing: 1, ear: 0.8 }, view: { zoom: 1.35, y: 0.6 },
  },
  centaur: {
    label: 'Centaur', word: 'Centaur', like: 'horse', legs: 4, front: 'leg', arms: { upper: 0.3, fore: 0.28 },
    bones: { spine: [0.33, 0.33, 0.33], neck: 0.62, skull: 0.2, snout: 0.02, jaw: 0.08, upper: 0.27, fore: 0.34, pastern: 0.25, thigh: 0.34, shin: 0.35, meta: 0.27, paw: 0.05, pawLen: 0.09, tail: [0.24, 0.24, 0.22], ear: 0.01, hipWidth: 0.085, shoulderWidth: 0.09 },
    lean: { hock: 0.26, pastern: 0.07 }, look: { body: 1.4, leg: 0.85, neck: 1.9, tail: 1.5, wing: 1, snout: 1, ear: 0.2 }, view: { zoom: 0.9, y: 0.85 }, // the horse's neck is the human trunk, and its head the human head
  },
  dragon: {
    label: 'Dragon', legs: 4, front: 'leg', horns: true, ridge: 1, wings: { upper: 0.85, fore: 0.9, finger: 0.75, root: [-0.04, 0.12, 0.13], rest: [-0.45, 0.32, 0.12] },
    bones: { spine: [0.42, 0.42, 0.42], neck: 0.85, skull: 0.42, snout: 0.38, jaw: 0.42, upper: 0.44, fore: 0.4, pastern: 0.14, thigh: 0.5, shin: 0.44, meta: 0.3, paw: 0.06, pawLen: 0.22, shoulderDrop: 0.1, scapula: 0.26, tail: [0.9, 0.8, 0.7], ear: 0.02, hipWidth: 0.16, shoulderWidth: 0.16, scapulaWidth: 0.13 },
    lean: { hock: 0.28, pastern: 0.08 }, look: { body: 1.9, leg: 1.7, neck: 1.3, tail: 1.9, wing: 1.2 }, view: { zoom: 0.7, y: 0.9 },
  },
  bird: {
    label: 'Bird', legs: 2, front: 'wing', armRest: [-0.2, -0.04, 0],
    bones: { spine: [0.15, 0.15, 0.15], neck: 0.5, skull: 0.13, snout: 0.15, jaw: 0.13, upper: 0.34, fore: 0.34, pastern: 0.22, thigh: 0.3, shin: 0.38, meta: 0.34, paw: 0.03, pawLen: 0.14, shoulderDrop: 0.06, shoulderBack: 0.02, scapula: 0.1, tail: [0.12, 0.12, 0.1], ear: 0.02, hipWidth: 0.06, shoulderWidth: 0.07, scapulaWidth: 0.05 },
    lean: { hock: 0.55, pastern: 0.1 }, look: { body: 1.5, leg: 0.4, neck: 0.8, tail: 1.2, wing: 1.8 }, view: { zoom: 1.25, y: 0.6 },
  },
});
// The rubber hose animals: the same bones and gaits as the figure they are `like`, drawn as tubes with no knees or elbows.
const ALL_SPECIES = { ...SPECIES_BASE, hosehorse: { ...SPECIES_BASE.horse, label: 'Rubber hose horse', word: 'Horse', hose: true, like: 'horse' }, hosebird: { ...SPECIES_BASE.bird, label: 'Rubber hose bird', word: 'Bird', hose: true, like: 'bird' } };
export const SPECIES = Object.freeze(ALL_SPECIES);
/** The figure whose bones, words and movements this one uses: 'bird' for the rubber hose bird. */
export const kindOf = (name) => SPECIES[name]?.like || name;
export const speciesOf = (p) => SPECIES[p?.dogSpecies] || SPECIES.dog;

/** How thick each part is drawn for this animal: the species' own look, times the thickness sliders (chest and belly, leg, neck and tail). */
export function lookOf(p) {
  const k = speciesOf(p).look; const r = p?.proportions || {};
  return { ...k, body: k.body * (r.dTorso ?? 1), leg: k.leg * (r.dLimb ?? 1), neck: k.neck * (r.dNeckW ?? 1), tail: k.tail * (r.dTailW ?? 1) };
}
