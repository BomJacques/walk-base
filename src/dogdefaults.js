// Gait settings for the dog. Units are shoulder heights (a standing dog's withers are about 1.0 high). Kept apart so rig.js can include them without a cycle.
export const DOG_DEFAULTS = Object.freeze({
  dogGait: 'walk',        // walk | trot | pace: which feet move together
  dogStride: 0.95,        // distance covered in one full cycle, in shoulder heights
  dogDuty: 0.68,          // fraction of the cycle a paw is on the ground
  dogLift: 0.13,          // paw clearance in the swing
  dogAsymTiming: 0,       // cycle fraction the left paws land late
  dogAsymDuty: 0,         // left paws' time on the ground, added to dogDuty
  dogAsymLift: 0,         // left paws' lift, as a fraction more or less
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
export const SPECIES = Object.freeze({
  dog: { label: 'Dog', legs: 4, front: 'leg', bones: {}, lean: { hock: 0.35, pastern: 0.12 }, look: { body: 1, leg: 1, neck: 1, tail: 1, wing: 1 }, view: { zoom: 1.45, y: 0.55 } },
  sauropod: {
    label: 'Sauropod', legs: 4, front: 'leg',
    bones: { spine: [0.42, 0.42, 0.42], neck: 1.7, skull: 0.15, snout: 0.1, jaw: 0.1, upper: 0.55, fore: 0.5, pastern: 0.1, thigh: 0.6, shin: 0.5, meta: 0.1, paw: 0.06, pawLen: 0.24, shoulderDrop: 0.1, scapula: 0.3, tail: [0.75, 0.65, 0.55], ear: 0.02, hipWidth: 0.16, shoulderWidth: 0.17, scapulaWidth: 0.14 },
    lean: { hock: 0.06, pastern: 0.04 }, look: { body: 2.1, leg: 2.1, neck: 1.25, tail: 1.8, wing: 1 }, view: { zoom: 0.72, y: 1.0 },
  },
  ceratopsian: {
    label: 'Ceratopsian', legs: 4, front: 'leg',
    bones: { spine: [0.36, 0.36, 0.36], neck: 0.3, skull: 0.5, snout: 0.28, jaw: 0.32, upper: 0.36, fore: 0.34, pastern: 0.12, thigh: 0.42, shin: 0.36, meta: 0.12, paw: 0.06, pawLen: 0.2, scapula: 0.26, tail: [0.42, 0.36, 0.3], ear: 0.02, hipWidth: 0.13, shoulderWidth: 0.15, scapulaWidth: 0.12 },
    lean: { hock: 0.14, pastern: 0.08 }, look: { body: 1.7, leg: 1.6, neck: 1.5, tail: 1.5, wing: 1 }, view: { zoom: 1.05, y: 0.6 },
  },
  theropod: {
    label: 'Theropod', legs: 2, front: 'arm', armRest: [0.1, -0.13, 0],
    bones: { spine: [0.36, 0.36, 0.36], neck: 0.55, skull: 0.5, snout: 0.34, jaw: 0.52, upper: 0.14, fore: 0.12, pastern: 0.06, thigh: 0.64, shin: 0.62, meta: 0.44, paw: 0.06, pawLen: 0.24, shoulderDrop: 0.1, scapula: 0.14, tail: [0.8, 0.7, 0.6], ear: 0.02, hipWidth: 0.1, shoulderWidth: 0.08, scapulaWidth: 0.07 },
    lean: { hock: 0.3, pastern: 0.1 }, look: { body: 1.7, leg: 1.5, neck: 1.5, tail: 1.8, wing: 1 }, view: { zoom: 0.8, y: 0.95 },
  },
  bird: {
    label: 'Bird', legs: 2, front: 'wing', armRest: [-0.2, -0.04, 0],
    bones: { spine: [0.15, 0.15, 0.15], neck: 0.5, skull: 0.13, snout: 0.15, jaw: 0.13, upper: 0.34, fore: 0.34, pastern: 0.22, thigh: 0.3, shin: 0.38, meta: 0.34, paw: 0.03, pawLen: 0.14, shoulderDrop: 0.06, shoulderBack: 0.02, scapula: 0.1, tail: [0.12, 0.12, 0.1], ear: 0.02, hipWidth: 0.06, shoulderWidth: 0.07, scapulaWidth: 0.05 },
    lean: { hock: 0.55, pastern: 0.1 }, look: { body: 1.5, leg: 0.4, neck: 0.8, tail: 1.2, wing: 1.8 }, view: { zoom: 1.25, y: 0.6 },
  },
});
export const speciesOf = (p) => SPECIES[p?.dogSpecies] || SPECIES.dog;
