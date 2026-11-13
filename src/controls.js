// One list drives the panel, saved settings and docs. scope: p = gait params, s = look and guides, x = export settings.
import { DEFAULTS } from './rig.js';
import { STYLE_DEFAULTS } from './draw.js';
import { EXPORT_DEFAULTS } from './export.js';

const n = (scope, id, tab, group, label, unit, min, max, step, help) => ({ scope, id, tab, group, label, type: 'number', unit, min, max, step, help });
const e = (scope, id, tab, group, label, options, help) => ({ scope, id, tab, group, label, type: 'enum', options, help });
const b = (scope, id, tab, group, label, help) => ({ scope, id, tab, group, label, type: 'bool', help });
const c = (scope, id, tab, group, label, help) => ({ scope, id, tab, group, label, type: 'color', help });

/** What a tab is called on its button. Gait is the one tab for the walk, the body and the scene, and the person using it calls it Body. */
export const TAB_LABELS = { Gait: 'Body' };
export const TABS = ['Gait', 'Parts', 'Attach', 'Design', 'Draw', 'Auto', 'Physics', 'Speech', 'View', 'Sampler', 'Export'];

const RAW_CONTROLS = [
  // Gait
  e('p', 'exposure', 'Gait', 'Timing', 'Exposure', [1, 2, 3], 'Frames each drawing is held. 2 is "on twos".'),
  e('p', 'travel', 'Gait', 'Timing', 'Camera', ['follow', 'across'], 'Follow keeps the figure in place while the ground scrolls. Across lets it cross the frame.'),
  n('p', 'cycleFrames', 'Gait', 'Timing', 'Cycle length', 'frames', 4, 96, 1, 'Frames for two steps. 24 at 24 fps is one step every half second.'),
  n('p', 'fps', 'Gait', 'Timing', 'Frame rate', 'fps', 6, 60, 1, 'Frames per second. Changing it changes the walking speed.'),
  n('p', 'stepLength', 'Gait', 'Stride', 'Step length', 'legs', 0.3, 1.4, 0.01, 'Contact to contact, in leg lengths. Longer steps at the same timing walk faster.'),
  n('p', 'duty', 'Gait', 'Stride', 'Time on the ground', '', 0.25, 0.85, 0.01, 'Fraction of the cycle each foot is down. Under 0.5 there is a moment with neither foot down: a run. Set Hip bob and Lowest point to match (the Run preset shows how).'),
  n('p', 'legExtend', 'Gait', 'Stride', 'Leg straightness', '', 0.85, 0.999, 0.001, 'How straight the leg is at contact. Lower crouches the whole walk.'),
  n('p', 'bob', 'Gait', 'Weight', 'Hip bob', 'legs', 0, 0.3, 0.005, 'Vertical travel of the hips, lowest to highest.'),
  n('p', 'downPhase', 'Gait', 'Weight', 'Down position', 'cycle', 0.03, 0.22, 0.005, 'When the body is lowest after contact. 0.125 is a quarter of a step.'),
  n('p', 'footLift', 'Gait', 'Feet', 'Foot lift', 'legs', 0, 0.5, 0.005, 'How high the swing foot clears the ground.'),
  n('p', 'heelStrike', 'Gait', 'Feet', 'Heel strike', '°', 0, 40, 1, 'Toe-up angle at contact.'),
  n('p', 'toeOff', 'Gait', 'Feet', 'Toe off', '°', 0, 60, 1, 'Heel-up angle at push-off.'),
  n('p', 'swingToe', 'Gait', 'Feet', 'Swing toe', '°', -20, 40, 1, 'Toe angle while the foot swings through.'),
  n('p', 'heelDown', 'Gait', 'Foot roll', 'Heel comes down over', 'stance', 0.04, 0.4, 0.01, 'How much of the time on the ground the foot takes to roll from heel to flat. Small is a stamp, large is a slow roll.'),
  n('p', 'heelUp', 'Gait', 'Foot roll', 'Heel lifts at', 'stance', 0.35, 0.85, 0.01, 'When in the time on the ground the heel starts to rise. Early is a long push off the toes, late is a flat-footed walk.'),
  n('p', 'liftPeak', 'Gait', 'Swing', 'Foot is highest at', 'swing', 0.25, 0.7, 0.01, 'Where in the swing the foot reaches its highest point. Early is a quick pick-up, late is a high step that stamps down.'),
  n('p', 'swingReach', 'Gait', 'Swing', 'Foot reaches forward early', '', 0, 1, 0.01, '0 swings the foot at an even pace. 1 brings it forward early and lets it hang before it lands.'),
  n('p', 'asymTiming', 'Gait', 'Left and right', 'Far foot lands late', 'cycle', -0.12, 0.12, 0.005, 'Moves the far foot off its half-cycle: the two steps become unequal, one short and one long.'),
  n('p', 'asymDuty', 'Gait', 'Left and right', 'Far foot time on ground', '', -0.15, 0.15, 0.005, 'Added to the far foot only. Less is a leg that is hurried off the ground, as in a limp.'),
  n('p', 'asymLift', 'Gait', 'Left and right', 'Far foot lift', '', -0.8, 0.8, 0.01, 'The far foot lifts more (positive) or less (negative) than the near one.'),
  n('p', 'weight', 'Gait', 'Weight', 'Weight', '', -1, 1, 0.01, 'How heavy the figure feels. Heavy (positive): longer on the ground, flatter and lower feet, a deeper drop into each step, shorter steps, less arm swing, a forward lean. Light (negative): springy, higher feet, quicker. Use a longer Cycle length for a heavy walk and a shorter one for a light walk.'),
  n('p', 'noiseAmount', 'Gait', 'Variety', 'Noise', '', 0, 1, 0.01, 'Small wobble added to the bounce, sway, back, head and arms so the walk is not a metronome. 0 is none.'),
  n('p', 'noiseSpeed', 'Gait', 'Variety', 'Noise speed', '', 1, 4, 1, 'How quickly the wobble changes: 1 is slow, 4 is busy.'),
  n('p', 'noiseSeed', 'Gait', 'Variety', 'Noise seed', '', 1, 999, 1, 'Which wobble you get. The same seed always gives the same take; change it to try another.'),
  b('p', 'noiseLoop', 'Gait', 'Variety', 'Keep the wobble looping', 'On: the wobble repeats every cycle, so the loop stays seamless. Off: it carries on changing from cycle to cycle over a longer performance (the Loop button turns it back on).'),
  n('p', 'hoseFollow', 'Gait', 'Rubber hose', 'Follow-through', '', 0, 1.5, 0.05, 'Hands and swinging feet trail behind the arm or leg they are on and catch up after, so a limb flows instead of moving all at once. 0 is stiff.'),
  n('p', 'hoseWobble', 'Gait', 'Rubber hose', 'Wobble', '', 0, 1.5, 0.05, 'A wave runs along every arm, leg and tail and bends it like jelly. The hands and feet stay where they are; the limb between wobbles. 0 is off.'),
  n('p', 'hoseWobbleRate', 'Gait', 'Rubber hose', 'Wobbles per cycle', '', 1, 4, 1, 'How many times each limb wobbles in one cycle. Whole numbers, so the cycle still loops.'),
  n('p', 'hoseStretch', 'Gait', 'Rubber hose', 'Stretchy limbs', '', 0, 1.5, 0.05, 'An arm that reaches, or a leg that swings out, stretches longer, up to half again at 1. 0 keeps every limb the same length.'),
  n('p', 'heading', 'Gait', 'Direction', 'Heading', '°', -180, 180, 1, 'Which way the figure faces and walks. 0 is straight along the stage; a positive angle turns it toward you, a negative one away. Automate it on the Auto tab (or use Turn right, Turn left, U-turn and Walk a curve) to turn a corner or follow a curve. Footprints are hidden while the path bends.'),
  e('p', 'terrain', 'Gait', 'Ground', 'Ground', ['flat', 'slope', 'steps'], 'What the figure walks on. A slope or a flight of steps makes the walk four cycles long so there is room to climb; the hips rise, each foot stands on the ground where it lands, and the swinging foot clears the next step.'),
  n('p', 'terrainGrade', 'Gait', 'Ground', 'Slope', '°', -30, 30, 0.5, 'How steeply the ground rises along the slope (negative goes downhill).'),
  n('p', 'terrainRise', 'Gait', 'Ground', 'Step height', 'legs', -0.3, 0.3, 0.005, 'Height of each step, in leg lengths (negative goes down).'),
  n('p', 'terrainRun', 'Gait', 'Ground', 'Step length', 'legs', 0.3, 2.5, 0.05, 'Length of the flat top of each step.'),
  n('p', 'asymArm', 'Gait', 'Left and right', 'Far arm swing', '', -0.8, 0.8, 0.01, 'The far arm swings more or less than the near one.'),
  // Body
  n('p', 'lean', 'Body', 'Torso', 'Forward lean', '°', -15, 30, 0.5, 'Torso tilt. Negative leans back.'),
  n('p', 'sideLean', 'Body', 'Torso', 'Lean to the side', '°', -10, 10, 0.5, 'The body leans to one side all the time: positive toward the near side, negative toward the far side. The head stays nearly upright.'),
  n('p', 'chestOut', 'Body', 'Torso', 'Chest out or slouch', '°', -15, 15, 0.5, 'Positive arches the back and brings the chest out, with the head held level. Negative slouches: the back rounds forward and the head comes forward with it.'),
  n('p', 'carry', 'Body', 'Torso', 'Carrying a load', '', -1, 1, 0.01, 'A heavy bag in one hand: positive in the near hand, negative in the far hand. That arm hangs straight and still, the body leans away to balance it and the other arm comes out.'),
  n('p', 'torsoSway', 'Body', 'Torso', 'Torso rock', '°', 0, 10, 0.1, 'Extra tilt that rocks with each step.'),
  n('p', 'headBob', 'Body', 'Head', 'Head steadiness', '', 0, 1, 0.01, '0 lets the head ride the hips, 1 holds it level.'),
  n('p', 'headTilt', 'Body', 'Head', 'Look down or up', '°', -20, 20, 0.5, 'The head held looking down (positive) or up (negative).'),
  n('p', 'headTurn', 'Body', 'Head', 'Head turned', '°', -45, 45, 1, 'The head held turned to one side: positive toward the near side.'),
  n('p', 'headNod', 'Body', 'Head', 'Head nod', '°', 0, 12, 0.1, 'Small nod with each step.'),
  n('p', 'armSwing', 'Body', 'Arms', 'Arm swing', '°', 0, 60, 1, 'Each way, opposite the legs.'),
  n('p', 'armCarry', 'Body', 'Arms', 'Arms forward or back', '°', -30, 45, 1, 'Where the arms swing about: positive carries both arms forward of where they hang, negative behind the body.'),
  n('p', 'armLag', 'Body', 'Arms', 'Arm lag', 'cycle', -0.2, 0.3, 0.005, 'How far the arms trail the legs. A little drag reads as natural.'),
  n('p', 'elbowBase', 'Body', 'Arms', 'Elbow bend', '°', 0, 80, 1, 'Resting bend.'),
  n('p', 'elbowSwing', 'Body', 'Arms', 'Elbow bend, forward', '°', 0, 80, 1, 'Extra bend as the arm swings forward.'),
  // Hips and shoulders (these set the built-in motion of the Parts tab)
  n('p', 'pelvisYaw', 'Body', 'Hips and shoulders', 'Hip twist', '°', 0, 25, 0.5, 'How far the hips turn each way. The right hip leads at contact.'),
  n('p', 'pelvisRoll', 'Body', 'Hips and shoulders', 'Hip drop', '°', 0, 15, 0.5, 'The swing-side hip drops this much.'),
  n('p', 'pelvisPitch', 'Body', 'Hips and shoulders', 'Hip tilt', '°', 0, 15, 0.5, 'Forward and back rock of the pelvis.'),
  n('p', 'sway', 'Body', 'Hips and shoulders', 'Side sway', 'legs', 0, 0.12, 0.002, 'Hips shift over the supporting foot.'),
  n('p', 'shoulderCounter', 'Body', 'Hips and shoulders', 'Shoulder counter-twist', '°', 0, 30, 0.5, 'Shoulders turn against the hips.'),
  n('p', 'headKeep', 'Body', 'Hips and shoulders', 'Head keeps facing', '', 0, 1, 0.01, 'How much the head cancels the twist and tilt of the body below it.'),
  n('p', 'armOut', 'Body', 'Hips and shoulders', 'Arms out', '°', -10, 40, 0.5, 'How far the arms hang from the body.'),
  n('p', 'kneeOut', 'Body', 'Hips and shoulders', 'Knees out', '°', -15, 30, 0.5, 'Knee direction away from straight ahead.'),
  n('p', 'stepWidth', 'Body', 'Hips and shoulders', 'Feet width', 'legs', 0, 0.3, 0.005, 'Distance of each foot from the centre line.'),
  n('p', 'toeOut', 'Body', 'Hips and shoulders', 'Toe out', '°', -15, 40, 0.5, 'Feet turn outward.'),
  // Proportions
  n('r', 'hipWidth', 'Body', 'Proportions', 'Hip width', '×', 0.5, 1.8, 0.01, 'Scale of the distance between the hips.'),
  n('r', 'shoulderWidth', 'Body', 'Proportions', 'Shoulder width', '×', 0.5, 1.8, 0.01, 'Scale of the distance between the shoulders.'),
  n('r', 'torso', 'Body', 'Proportions', 'Torso length', '×', 0.6, 1.5, 0.01, 'Scale of the spine.'),
  n('r', 'arm', 'Body', 'Proportions', 'Arm length', '×', 0.6, 1.5, 0.01, 'Scale of both arms.'),
  n('r', 'neck', 'Body', 'Proportions', 'Neck length', '×', 0.3, 2.5, 0.01, 'Scale of the neck.'),
  n('r', 'head', 'Body', 'Proportions', 'Head size', '×', 0.6, 2.2, 0.01, 'Scale of the head.'),
  n('r', 'waist', 'Body', 'Proportions', 'Waist length', '×', 0.5, 1.8, 0.01, 'Scale of the lower spine, between the hips and the ribs.'),
  n('r', 'chest', 'Body', 'Proportions', 'Chest length', '×', 0.5, 1.8, 0.01, 'Scale of the upper spine, from the ribs to the shoulders.'),
  n('r', 'upperArm', 'Body', 'Proportions', 'Upper arm length', '×', 0.6, 1.6, 0.01, 'Scale of the upper arm only, on top of Arm length.'),
  n('r', 'foreArm', 'Body', 'Proportions', 'Forearm length', '×', 0.6, 1.6, 0.01, 'Scale of the forearm only, on top of Arm length.'),
  n('r', 'handSize', 'Body', 'Proportions', 'Hand size', '×', 0.5, 2.5, 0.01, 'Scale of the hand, in length and in the drawing.'),
  n('r', 'leg', 'Body', 'Proportions', 'Leg length', '×', 0.7, 1.4, 0.01, 'Scale of both legs. The steps stay the same length, so longer legs stand taller and straighter over them, and shorter legs bend and work harder. Lengthen the step to match if you want the same walk on longer legs.'),
  n('r', 'thighShare', 'Body', 'Proportions', 'Upper leg share', '×', 0.75, 1.25, 0.01, 'How much of the leg is thigh and how much is shin. The leg stays the same total length, so the walk does not change.'),
  n('r', 'footSize', 'Body', 'Proportions', 'Foot size', '×', 0.6, 2, 0.01, 'Scale of the drawn foot. Large for a clown shoe, small for a dancer.'),
  n('r', 'shoulderSlope', 'Body', 'Proportions', 'Shoulder slope', '×', 0, 3, 0.01, 'How far the shoulders sit below the base of the neck. 0 is square and high, 3 is sloping.'),
  n('r', 'headWidth', 'Body', 'Proportions', 'Head width', '×', 0.6, 1.7, 0.01, 'How wide the head is, side to side, apart from its height and length.'),
  n('r', 'footLength', 'Body', 'Proportions', 'Foot length', '×', 0.6, 1.7, 0.01, 'How long the foot is, apart from its height and width.'),
  n('r', 'armLeft', 'Body', 'Left and right proportions', 'Left arm length', '×', 0.6, 1.6, 0.01, 'Scale of the left arm only, on top of the arm length. Unlike the right arm, for a lopsided figure.'),
  n('r', 'handLeft', 'Body', 'Left and right proportions', 'Left hand size', '×', 0.5, 2.5, 0.01, 'Scale of the left hand only.'),
  n('r', 'hipGirth', 'Body', 'Thickness by part proportions', 'Hip thickness', '×', 0.6, 1.8, 0.01, 'Thickness of the hips, on top of body thickness.'),
  n('r', 'waistGirth', 'Body', 'Thickness by part proportions', 'Waist thickness', '×', 0.5, 1.8, 0.01, 'Thickness of the waist.'),
  n('r', 'chestGirth', 'Body', 'Thickness by part proportions', 'Chest thickness', '×', 0.6, 1.8, 0.01, 'Thickness of the chest and ribs.'),
  n('r', 'neckGirth', 'Body', 'Thickness by part proportions', 'Neck thickness', '×', 0.5, 2.2, 0.01, 'Thickness of the neck.'),
  n('r', 'upperArmGirth', 'Body', 'Thickness by part proportions', 'Upper arm thickness', '×', 0.5, 2.2, 0.01, 'Thickness of the upper arms, on top of limb thickness.'),
  n('r', 'foreArmGirth', 'Body', 'Thickness by part proportions', 'Forearm thickness', '×', 0.5, 2.2, 0.01, 'Thickness of the forearms.'),
  n('r', 'thighGirth', 'Body', 'Thickness by part proportions', 'Thigh thickness', '×', 0.5, 2.2, 0.01, 'Thickness of the thighs.'),
  n('r', 'shinGirth', 'Body', 'Thickness by part proportions', 'Shin thickness', '×', 0.5, 2.2, 0.01, 'Thickness of the shins and calves.'),
  n('r', 'limbGirth', 'Body', 'Proportions', 'Limb thickness', '×', 0.5, 2.2, 0.01, 'Thickness of the arms and legs in the drawing.'),
  n('r', 'torsoGirth', 'Body', 'Proportions', 'Body thickness', '×', 0.6, 1.8, 0.01, 'Thickness of the hips, waist, chest and neck in the drawing.'),
  // Dog (shown when the figure is the dog). Units are shoulder heights.
  e('p', 'dogGait', 'Gait', 'Dog gait', 'Gait', ['walk', 'trot', 'pace', 'gallop', 'run', 'hop'], 'Which paws move together. Walk is four beats, trot pairs diagonal paws, pace pairs the paws on one side. Gallop lands the hind paws, then the front paws, with the body in the air and the legs tucked under it in between.'),
  n('p', 'dogStride', 'Gait', 'Dog stride', 'Stride', 'heights', 0.1, 5, 0.01, 'Ground covered in one cycle, in shoulder heights. Longer strides at the same timing run faster.'),
  n('p', 'dogDuty', 'Gait', 'Dog stride', 'Time on the ground', '', 0.15, 0.85, 0.01, 'Fraction of the cycle each paw is down.'),
  n('p', 'dogLift', 'Gait', 'Dog paws', 'Paw lift', 'heights', 0, 0.5, 0.005, 'How high the swinging paw clears the ground.'),
  n('p', 'dogAsymTiming', 'Gait', 'Dog left and right', 'Left paws land late', 'cycle', -0.12, 0.12, 0.005, 'Moves the left paws off their place in the beat, so the steps on the two sides are unequal.'),
  n('p', 'dogAsymDuty', 'Gait', 'Dog left and right', 'Left paws time on ground', '', -0.15, 0.15, 0.005, 'Added to the left paws only. Less is a leg that is hurried off the ground, as when it hurts.'),
  n('p', 'dogLegVariety', 'Gait', 'Dog stride', 'Leg independence', '', 0, 1, 0.01, 'For creatures with many legs: how far each leg goes its own way. At 0 every leg takes the same step in its turn, like a machine. At 1 each leg has its own timing, step length, landing place and lift, and a leg may linger, as a spider does.'),
  n('p', 'dogAsymLift', 'Gait', 'Dog left and right', 'Left paws lift', '', -0.8, 0.8, 0.01, 'The left paws lift more (positive) or less (negative) than the right.'),
  n('p', 'dogWidth', 'Gait', 'Dog paws', 'Paws width', 'heights', 0, 0.3, 0.005, 'Distance of each paw from the centre line.'),
  n('p', 'dogElbowOut', 'Gait', 'Dog paws', 'Elbows and knees out', '°', -15, 30, 0.5, 'Direction the elbows and knees point away from straight ahead.'),
  n('p', 'dogBob', 'Body', 'Dog body', 'Body bounce', 'heights', 0, 0.3, 0.002, 'Up and down travel of the hips.'),
  n('p', 'dogFlex', 'Body', 'Dog body', 'Spine bend', '°', 0, 25, 0.5, 'Side to side bend of the spine as the dog walks.'),
  n('p', 'dogArch', 'Body', 'Dog body', 'Back arch', '°', 0, 12, 0.25, 'How much the back arches and dips with each footfall.'),
  n('p', 'dogCurl', 'Body', 'Dog body', 'Squash and stretch', '°', 0, 30, 0.5, 'Gallop and run only: the back humps up when the legs gather under the body and stretches out when they reach. A run does it once every step.'),
  n('p', 'dogTwist', 'Body', 'Dog body', 'Torso twist', '°', 0, 20, 0.5, 'How far the shoulders and hips roll against each other along the spine. The shoulder on the side whose paw lands drops.'),
  n('p', 'dogShoulder', 'Body', 'Dog body', 'Shoulder blade', 'heights', 0, 0.15, 0.005, 'How far each shoulder blade drops and slides forward as its front paw lands.'),
  n('p', 'dogTilt', 'Body', 'Two-legged body', 'Chest raise', '°', -10, 70, 1, 'Two-legged figures only: how far the chest is raised above level. A theropod is nearly level, a bird is tipped up.'),
  n('p', 'dogHeadHold', 'Body', 'Two-legged body', 'Head hold', '', 0, 1, 0.02, 'A bird keeps its head still in space while the body moves under it, then thrusts it forward. 0 is off, 1 is fully held.'),
  n('p', 'dogArmSwing', 'Body', 'Two-legged body', 'Arm swing', 'heights', 0, 0.15, 0.005, 'Theropod: how far the small arms swing against the legs.'),
  n('p', 'dogWingOpen', 'Body', 'Wings', 'Wings open', '', 0, 1, 0.02, 'Bird: 0 folds the wings against the body, 1 spreads them.'),
  n('p', 'dogFlap', 'Body', 'Wings', 'Wing beat', '°', 0, 70, 1, 'Bird: how far each wing beats up and down. Open the wings first.'),
  n('p', 'dogFlight', 'Body', 'Wings', 'In flight', '', 0, 1, 0.05, 'Bird: 0 stands on the ground, 1 flies. In flight the feet tuck up under the tail and the body rises on each down-stroke. Open the wings and set a wing beat.'),
  n('p', 'dogFlightHeight', 'Body', 'Wings', 'Flight height', 'heights', 0, 3, 0.05, 'Bird: how far above the ground the body flies.'),
  n('p', 'dogFlapFrames', 'Body', 'Wings', 'Frames per wing beat', 'frames', 0, 60, 1, 'Bird: how many frames one wing beat takes, on its own clock, so the wings keep beating when the walk slows or stops. 0 ties the beat to the walk cycle (Beats per cycle).'),
  n('p', 'dogFlapRate', 'Body', 'Wings', 'Beats per cycle', '', 1, 6, 1, 'Bird: wing beats in one cycle.'),
  n('p', 'dogNeckSegs', 'Body', 'Dog neck', 'Neck segments', '', 1, 12, 1, 'How many bones the neck is made of. A long neck, such as a sauropod\'s, needs several to bend along its length.'),
  n('p', 'dogNeckCurve', 'Body', 'Dog neck', 'Neck curve', '°', -90, 90, 1, 'How much the neck bends over its whole length: positive droops at the top like a swan, negative arches back. Needs two or more segments.'),
  n('p', 'dogNeckWave', 'Body', 'Dog neck', 'Neck wave, nodding', '°', 0, 20, 0.5, 'Each bone nods a little after the one below it, so a wave runs up the neck as the animal walks.'),
  n('p', 'dogNeckSway', 'Body', 'Dog neck', 'Neck wave, sideways', '°', 0, 20, 0.5, 'Each bone swings from side to side after the one below it, so the neck snakes as the animal walks.'),
  n('p', 'dogNeckAngle', 'Body', 'Dog head and tail', 'Neck raise', '°', 0, 90, 1, 'How steeply the neck rises from the back.'),
  n('p', 'dogHeadAngle', 'Body', 'Dog head and tail', 'Head tip', '°', -20, 80, 1, 'How far the head tips down from the neck.'),
  n('p', 'dogHeadNod', 'Body', 'Dog head and tail', 'Head nod', '°', 0, 15, 0.25, 'Small nod with each footfall.'),
  n('p', 'dogTailAngle', 'Body', 'Dog head and tail', 'Tail carry', '°', -60, 90, 1, 'How far above the back the tail is held.'),
  n('p', 'dogWag', 'Body', 'Dog head and tail', 'Tail wag', '°', 0, 60, 0.5, 'How far the tail swings each way. Use Repeats on the tail channels for a faster wag.'),
  n('p', 'dogEar', 'Body', 'Dog head and tail', 'Ear bounce', '°', 0, 30, 0.5, 'How much the ears flop.'),
  n('r', 'dBody', 'Body', 'Dog proportions', 'Body length', '×', 0.7, 1.4, 0.01, 'Scale of the back.'),
  n('r', 'dLeg', 'Body', 'Dog proportions', 'Leg length', '×', 0.7, 1.4, 0.01, 'Scale of all four legs.'),
  n('r', 'dNeck', 'Body', 'Dog proportions', 'Neck length', '×', 0.5, 1.8, 0.01, 'Scale of the neck.'),
  n('r', 'dHead', 'Body', 'Dog proportions', 'Head size', '×', 0.6, 1.8, 0.01, 'Scale of the head and snout.'),
  n('r', 'dGirth', 'Body', 'Dog proportions', 'Body thickness', '×', 0.5, 2.2, 0.01, 'How thick the body and limbs of a snake, spider or crab are, as a multiple of what they were.'),
  n('r', 'dTail', 'Body', 'Dog proportions', 'Tail length', '×', 0.3, 2.5, 0.01, 'Scale of the tail.'),
  n('r', 'dEar', 'Body', 'Dog proportions', 'Ear length', '×', 0.4, 2.5, 0.01, 'Scale of the ears.'),
  n('r', 'dEarW', 'Body', 'Dog proportions', 'Ear width', '×', 0.4, 2.5, 0.01, 'How broad the ears are drawn.'),
  n('r', 'dLegF', 'Body', 'Dog proportions', 'Front leg length', '×', 0.8, 1.3, 0.01, 'Scale of the front legs only, on top of Leg length. Longer front legs raise the shoulders and tip the back down toward the hips.'),
  n('r', 'dLegH', 'Body', 'Dog proportions', 'Hind leg length', '×', 0.8, 1.3, 0.01, 'Scale of the hind legs only, on top of Leg length. Longer hind legs raise the hips and tip the back down toward the head.'),
  n('r', 'dJaw', 'Body', 'Dog proportions', 'Jaw length', '×', 0.3, 2.5, 0.01, 'Length of the lower jaw on its own, from its hinge. Longer than the snout is an underbite; shorter is an overbite.'),
  n('r', 'dJawW', 'Body', 'Dog proportions', 'Jaw depth', '×', 0.4, 2.5, 0.01, 'How deep and thick the lower jaw is drawn.'),
  n('r', 'dSnout', 'Body', 'Dog proportions', 'Snout length', '×', 0.4, 2.2, 0.01, 'Scale of the snout and the jaw, from the eyes forward.'),
  n('r', 'dPaw', 'Body', 'Dog proportions', 'Paw size', '×', 0.5, 2.2, 0.01, 'How long the paws are.'),
  n('r', 'dTorso', 'Body', 'Dog proportions', 'Chest and belly depth', '×', 0.6, 1.8, 0.01, 'How deep and thick the body is drawn.'),
  n('r', 'dLimb', 'Body', 'Dog proportions', 'Leg thickness', '×', 0.5, 2, 0.01, 'How thick the legs are drawn.'),
  n('r', 'dNeckW', 'Body', 'Dog proportions', 'Neck thickness', '×', 0.5, 2, 0.01, 'How thick the neck is drawn.'),
  n('r', 'dTailW', 'Body', 'Dog proportions', 'Tail thickness', '×', 0.4, 2.5, 0.01, 'How thick the tail is drawn.'),
  // View
  n('s', 'camYaw', 'View', 'Pivot around the figure', 'Turn', '°', -180, 180, 1, 'Orbit left and right. 0 is the side view, −90 the front, 90 the back. Drag the stage to orbit.'),
  n('s', 'camPitch', 'View', 'Pivot around the figure', 'Height', '°', -85, 85, 1, 'Look from above (positive) or below. 85 is nearly a top view.'),
  b('s', 'autoOrbit', 'View', 'Pivot around the figure', 'Turntable', 'Slowly circles the figure while it plays.'),
  n('s', 'orbitSpeed', 'View', 'Pivot around the figure', 'Turntable speed', '°/s', -120, 120, 1, 'Degrees per second. Negative circles the other way.'),
  b('s', 'showGizmo', 'View', 'Pivot around the figure', 'Axes gizmo', 'Small x, y, z guide: x forward, y up, z the figure right side.'),
  c('s', 'selectColor', 'View', 'Pivot around the figure', 'Selection colour', 'Highlight for the selected part.'),
  // Look
  e('s', 'style', 'Look', 'Figure', 'Style', ['mannequin', 'outline', 'stick', 'silhouette', 'moebius', 'comic', 'ink', 'pencil', 'clay', 'lowpoly', 'blocks'], 'Clay is soft all the way out: every form is lit from one side and falls into shade with a highlight and thin contour lines, and the corners are rounded and the edge a little lumpy, as if shaped by hand. Lowpoly builds the figure as a solid of flat facets (see Facets round each limb), each lit by the way it faces, so it reads as a 3D model. Blocks builds it of square blocks, like voxels or pixel art (see Block size). All three take the light direction from the Moebius style group. Comic is flat colour inside a heavy black line with printed dots for the shadow. Ink is a rough brush line that swells and thins, with flat colour. Pencil is a sketch: a pale wash, light hatching and the outline gone over three times. The light direction and shadow reach in the Moebius style group set the shading of Comic and Pencil too. Moebius is a pen drawing: a thin ink line round the figure, flat soft colour, and shading by fine hatching, cross-hatching and a few dots on the side away from the light, on a paper-coloured stage. Mannequin is outlined limbs. Outline is only the outer edge of the figure, arms included, with no lines crossing inside. Stick is joints and bones. Silhouette is one solid shape.'),
  n('s', 'lineWidth', 'Look', 'Figure', 'Line width', 'px', 0.5, 12, 0.25, 'At 1080 pixels tall. It scales with the canvas.'),
  e('s', 'handStyle', 'Look', 'Figure', 'Hands', ['default', 'mitten', 'fist', 'fingers', 'pointing'], 'Default is each figure\'s own hand: a ball on the mannequin, a round glove on the rubber hose figure. Mitten has a thumb, Fist is closed, Fingers is an open hand and Pointing holds one finger out. Hand size is in the body proportions.'),
  e('s', 'footStyle', 'Look', 'Figure', 'Feet', ['default', 'boot', 'bare', 'round'], 'Default is each figure\'s own foot: a shoe on the mannequin, a round foot on the rubber hose figure. Boot adds a shaft up the shin, Bare is a low foot with toes, Round is the rubber hose foot. Foot size is in the body proportions.'),
  n('s', 'hoseLimb', 'Look', 'Rubber hose', 'Limb thickness', '×', 0.5, 2, 0.01, 'How thick the tube arms and legs are.'),
  n('s', 'hoseBend', 'Look', 'Rubber hose', 'Limb curve', '', 0, 1, 0.01, '1 bends each limb in one smooth curve, with no elbow or knee. 0 bends it sharply at the joint.'),
  n('s', 'hoseSquash', 'Look', 'Rubber hose', 'Squash and stretch', '', 0, 2, 0.05, 'At the bottom of the bounce the body squashes down and swells; at the top it stretches up and thins, legs and arms with it. 1 is clear, 2 is cartoon.'),
  e('s', 'pictureModel', 'Look', 'Pictures', 'Body under pictures', ['hide covered parts', 'hide the model', 'show the model'], 'What the body does once a picture is attached. Parts a picture sits on are left out by default, so the picture is not drawn over the mannequin.'),
  n('s', 'hoseTaper', 'Look', 'Rubber hose', 'Limb taper', '', -1, 1, 0.05, 'Positive makes each limb thicker where it joins the body and thinner at the hand or foot. Negative is the other way: thin at the body, thick at the end.'),
  n('s', 'hoseBelly', 'Look', 'Rubber hose', 'Belly', '×', 0.6, 1.8, 0.01, 'How round the middle of the body is.'),
  n('s', 'hoseTail', 'Look', 'Rubber hose', 'Tail', '', 0, 1.5, 0.05, 'A thin tail that swings and wobbles behind the figure. 0 is none.'),
  e('s', 'hoseEars', 'Look', 'Rubber hose', 'Ears', ['none', 'round'], 'Round ears on top of the head. Off by default.'),
  e('s', 'hoseEyes', 'Look', 'Rubber hose', 'Eyes', ['pie', 'round', 'dots'], 'Pie eyes have a wedge cut out of the pupil. Round eyes are plain pupils. Dots are black dots.'),
  n('s', 'moebiusLight', 'Look', 'Moebius style', 'Light direction', '°', -180, 180, 1, 'Where the light comes from, as an angle on the screen. -135 is the top left; the hatching goes on the other side of each form.'),
  n('s', 'moebiusAngle', 'Look', 'Moebius style', 'Hatch angle', '°', 0, 180, 1, 'The angle of the hatching lines.'),
  n('s', 'moebiusDensity', 'Look', 'Moebius style', 'Hatch spacing', 'px', 2, 14, 0.5, 'The gap between hatching lines. Smaller is darker and finer.'),
  n('s', 'moebiusShade', 'Look', 'Moebius style', 'Shadow reach', '', 0, 1, 0.01, 'How far the shadow reaches round each form. 0 is none, 1 is nearly all of it.'),
  n('s', 'moebiusStipple', 'Look', 'Moebius style', 'Stipple', '', 0, 1, 0.01, 'Dots along the edge of the shadow, for texture.'),
  b('s', 'moebiusPaper', 'Look', 'Moebius style', 'Paper-coloured stage', 'In the Moebius style the stage is the colour of paper instead of the background colour.'),
  e('s', 'shadowMode', 'Look', 'Shadow', 'Shadow', ['off', 'ground', 'drop', 'both'], 'Ground is a soft oval on the floor under every figure and piece of scenery, fainter as the feet leave the ground. Drop casts the drawing itself a little way down and to the side, like a sticker lifted off the page. Both does both. Each attachment has a drop shadow of its own in the Attach tab.'),
  n('s', 'shadowOpacity', 'Look', 'Shadow', 'Strength', '', 0, 1, 0.01, 'How dark the shadow is.'),
  n('s', 'shadowBlur', 'Look', 'Shadow', 'Softness', 'px', 0, 60, 1, 'How soft the edge is, at the 1080 line frame.'),
  n('s', 'shadowX', 'Look', 'Shadow', 'Drop across', 'px', -80, 80, 1, 'How far the drop shadow falls to the right (negative is the left).'),
  n('s', 'shadowY', 'Look', 'Shadow', 'Drop down', 'px', -80, 80, 1, 'How far the drop shadow falls down (negative is up).'),
  n('s', 'shadowSize', 'Look', 'Shadow', 'Ground size', '×', 0.3, 3, 0.05, 'How big the oval on the ground is.'),
  c('s', 'shadowColor', 'Look', 'Shadow', 'Shadow colour', 'The colour of the shadow.'),
  n('s', 'lineBoil', 'Look', 'Line', 'Boil', 'px', 0, 8, 0.25, 'The outline wobbles a little, and a new wobble comes every few frames, as a hand-drawn line does. The colour moves with it. 0 is perfectly still.'),
  n('s', 'boilRate', 'Look', 'Line', 'Frames per wobble', '', 1, 8, 1, 'How many frames each wobble lasts: 1 is a frantic boil, 4 is a slow shimmer.'),
  e('s', 'lineDash', 'Look', 'Line', 'Line pattern', ['solid', 'dashed', 'dotted'], 'Solid, dashed or dotted outlines.'),
  e('s', 'lineJoin', 'Look', 'Line', 'Corners', ['round', 'miter', 'bevel'], 'Round corners, sharp points, or cut-off corners where the line turns.'),
  n('s', 'lineDepth', 'Look', 'Line', 'Weight by depth', '', 0, 1, 0.01, '0 makes every line the same weight. Higher makes the lines on the far side of the figure lighter, so it reads as further away.'),
  n('s', 'lineOffset', 'Look', 'Line', 'Colour off the line', 'px', -12, 12, 0.5, 'The colour sits a little off its outline, as in a badly printed page. For the Outline, Moebius, Comic, Ink and Clay looks.'),
  n('s', 'blockSize', 'Look', 'Blocks and facets', 'Block size', 'px', 3, 40, 1, 'The side of each block in the Blocks look. Large blocks are chunky voxels; small ones are fine pixel art.'),
  n('s', 'polySides', 'Look', 'Blocks and facets', 'Facets round each limb', '', 4, 12, 1, 'The Lowpoly look builds every limb as a prism with this many flat sides: 4 is a box, 6 is chunky, 12 is nearly round.'),
  c('s', 'hoseBody', 'Look', 'Rubber hose', 'Body colour', 'The head, body, arms and legs.'),
  c('s', 'hoseFace', 'Look', 'Rubber hose', 'Face colour', 'The face patch on the head.'),
  c('s', 'hoseGlove', 'Look', 'Rubber hose', 'Glove colour', 'The hands.'),
  c('s', 'hoseShoe', 'Look', 'Rubber hose', 'Foot colour', 'The feet. White by default, like the gloves.'),
  c('s', 'hoseShorts', 'Look', 'Rubber hose', 'Shorts colour', 'The hips. The same as the body by default, so the figure is one colour.'),
  c('s', 'lineColor', 'Look', 'Figure', 'Line colour', 'Outline and silhouette colour.'),
  c('s', 'fillColor', 'Look', 'Figure', 'Fill colour', 'Mannequin fill.'),
  n('s', 'fillOpacity', 'Look', 'Figure', 'Fill opacity', '', 0, 1, 0.01, 'Lower it to trace through the body.'),
  c('s', 'farTint', 'Look', 'Figure', 'Far-side tint', 'The far arm and leg use this tint, so near and far read apart.'),
  n('s', 'farOpacity', 'Look', 'Figure', 'Far-side opacity', '', 0, 1, 0.01, 'Strength of the far-side tint.'),
  n('s', 'figureHeight', 'Look', 'Frame', 'Figure size', '', 0.2, 0.95, 0.01, 'Height of the figure as a fraction of the canvas.'),
  n('s', 'groundHeight', 'Look', 'Frame', 'Ground height', '', 0.4, 0.98, 0.01, 'Ground line position, top to bottom.'),
  n('s', 'offsetX', 'Look', 'Frame', 'Figure position', '', -0.4, 0.4, 0.01, 'Left or right of centre, as a fraction of the width.'),
  c('s', 'background', 'Look', 'Frame', 'Background colour', 'Preview and solid exports.'),
  // Guides
  b('s', 'showGround', 'Guides', 'Ground', 'Ground line and ticks', 'Ticks stay on the ground, so a sliding foot shows.'),
  b('s', 'showFootprints', 'Guides', 'Ground', 'Footprints', 'Where each foot plants.'),
  e('s', 'focus', 'Speech', 'Head view', 'Look at', ['body', 'head'], 'Body keeps the whole figure in view. Head fills the stage with the face. Drag to turn the head around, pinch or scroll to zoom in and out, two fingers to move it.'),
  n('s', 'headZoom', 'Speech', 'Head view', 'Head size', '×', 3, 14, 0.1, 'How large the head is when the view is on the head.'),
  e('s', 'eyeStyle', 'Speech', 'Eyes', 'Eye style', ['default', 'dots', 'round', 'pie', 'almond', 'closed'], 'Default is each figure\'s own eyes (the Eyes setting of the rubber hose figure, dots on the mannequin). Round is a white eye with a pupil, Pie has a wedge cut out of the pupil, Almond has pointed corners and a coloured iris, Closed is a happy curve. The other eye settings need a style other than Default.'),
  n('s', 'eyeSize', 'Speech', 'Eyes', 'Eye size', '×', 0.4, 2.2, 0.01, 'How big the eyes are.'),
  n('s', 'eyeSpacing', 'Speech', 'Eyes', 'Eye spacing', '×', 0.4, 1.8, 0.01, 'How far apart the eyes are.'),
  n('s', 'eyeHeight', 'Speech', 'Eyes', 'Eye height', '', -0.5, 0.5, 0.01, 'Up or down on the head, in head radii.'),
  n('s', 'eyeLookX', 'Speech', 'Eyes', 'Look across', '', -1, 1, 0.01, 'Where the pupils point, side to side.'),
  n('s', 'eyeLookY', 'Speech', 'Eyes', 'Look up or down', '', -1, 1, 0.01, 'Where the pupils point, up (positive) or down.'),
  n('s', 'eyeLid', 'Speech', 'Eyes', 'Eyelids', '', 0, 1, 0.01, 'How far the lids are down: 0 wide open, 0.5 sleepy, 1 shut.'),
  n('s', 'blinkRate', 'Speech', 'Eyes', 'Blinks per cycle', '', 0, 4, 1, 'The eyes blink this many times in each cycle. Whole numbers, so the cycle still loops. 0 is no blinking.'),
  c('s', 'eyeColor', 'Speech', 'Eyes', 'Eye colour', 'The pupil, or the iris of an almond eye.'),
  e('s', 'browStyle', 'Speech', 'Eyebrows', 'Eyebrows', ['none', 'line', 'thick', 'arched'], 'A line over each eye, in the line colour.'),
  n('s', 'browRaise', 'Speech', 'Eyebrows', 'Raise', '', -1, 1, 0.01, 'Up for surprise, down toward the eyes for a scowl.'),
  n('s', 'browFurrow', 'Speech', 'Eyebrows', 'Furrow', '', -1, 1, 0.01, 'Positive pulls the inner ends down (angry). Negative lifts them (worried, sad).'),
  e('s', 'mouthShow', 'Speech', 'Mouth', 'Show the mouth', ['when speaking', 'always'], 'The mannequin has a mouth only while it speaks, unless this is Always. The rubber hose figure always has one.'),
  e('s', 'mouthStyle', 'Speech', 'Mouth', 'Mouth style', ['full', 'line', 'curve', 'cartoon'], 'Full has lips, teeth and a tongue. Line has no lips. Curve is a plain line that opens to a plain dark shape. Cartoon is a bold opening with a row of teeth and a tongue.'),
  n('s', 'mouthWidth', 'Speech', 'Mouth', 'Mouth width', '×', 0.5, 1.8, 0.01, 'How wide the mouth is.'),
  n('s', 'lipThickness', 'Speech', 'Mouth', 'Lip thickness', '×', 0, 2.5, 0.01, 'How thick the lips are, in the Full style. 0 is none.'),
  n('s', 'mouthSmile', 'Speech', 'Mouth', 'Smile', '', -1, 1, 0.01, 'Positive lifts the corners of the mouth into a smile; negative drops them into a frown. It carries through every mouth shape of the speech.'),
  c('s', 'lipColor', 'Speech', 'Mouth', 'Lip colour', 'The lips, in the Full style.'),
  c('s', 'teethColor', 'Speech', 'Mouth', 'Teeth colour', 'The teeth.'),
  c('s', 'tongueColor', 'Speech', 'Mouth', 'Tongue colour', 'The tongue.'),
  c('s', 'cavityColor', 'Speech', 'Mouth', 'Inside colour', 'The dark of the open mouth.'),
  b('s', 'showMouthLabel', 'Speech', 'Head view', 'Mouth shape label', 'Names the current mouth shape and the sounds it stands for, in the top corner.'),
  b('s', 'showScene', 'Guides', 'Scene', 'Show the scene', 'The other figures and the scenery. Off draws the main figure alone.'),
  b('s', 'showArcs', 'Guides', 'Arcs', 'Motion arcs', 'Paths of the points you tick below through the cycle. Drag a dot to reshape the movement.'),
  b('s', 'arcDots', 'Guides', 'Arcs', 'Frame dots', 'One dot on the path for every frame, so the spacing shows speed and ease. Drag a dot to bend the path there.'),
  b('s', 'showOnion', 'Guides', 'Onion skin', 'Onion skin', 'Neighbouring drawings, tinted.'),
  n('s', 'onionBefore', 'Guides', 'Onion skin', 'Drawings before', '', 0, 6, 1, 'Preceding drawings.'),
  n('s', 'onionAfter', 'Guides', 'Onion skin', 'Drawings after', '', 0, 6, 1, 'Following drawings.'),
  n('s', 'onionOpacity', 'Guides', 'Onion skin', 'Onion opacity', '', 0.05, 1, 0.01, 'Nearest neighbour. Further ones fade.'),
  c('s', 'onionBeforeTint', 'Guides', 'Onion skin', 'Before tint', 'Colour of earlier drawings.'),
  c('s', 'onionAfterTint', 'Guides', 'Onion skin', 'After tint', 'Colour of later drawings.'),
  c('s', 'guideColor', 'Guides', 'Colours', 'Guide colour', 'Ground, arcs and labels.'),
  // Export
  n('x', 'width', 'Export', 'Canvas', 'Width', 'px', 64, 4096, 2, 'Even numbers, so video encodes.'),
  n('x', 'height', 'Export', 'Canvas', 'Height', 'px', 64, 4096, 2, 'Even numbers, so video encodes.'),
  n('x', 'orbit', 'Export', 'Length', 'Orbit while exporting', '°', 0, 720, 5, 'Turns the camera this far over the whole export, for a turntable. 360 is one full circle.'),
  n('x', 'cycles', 'Export', 'Length', 'Cycles', '', 1, 8, 1, 'How many times the cycle repeats in the export.'),
  e('x', 'format', 'Export', 'Output', 'Format', ['png-zip', 'mp4'], 'PNG frames in a ZIP are lossless. MP4 is offered only where this browser can encode it.'),
  e('x', 'timing', 'Export', 'Output', 'Timing', ['expanded', 'unique'], 'Expanded: one file per frame. Unique: one file per drawing, with an exposure list.'),
  e('x', 'layers', 'Export', 'Output', 'Layers', ['composite', 'split'], 'Split writes far limbs, body and near limbs as separate transparent layers.'),
  e('x', 'background', 'Export', 'Output', 'Background', ['solid', 'transparent'], 'Transparent applies to PNG only.'),
  b('x', 'includeGuides', 'Export', 'Output', 'Include guides', 'Ground, arcs, onion skin and labels. Off by default so exports are clean.'),
  e('x', 'target', 'Export', 'Target app', 'Import recipe', ['procreate', 'dreams', 'other'], 'Picks the import notes that go in the ZIP.'),
  n('x', 'padding', 'Export', 'Names', 'Frame digits', '', 2, 8, 1, 'Zero padding, so names sort in frame order.'),
  n('x', 'bitrate', 'Export', 'Names', 'Video bitrate', 'Mbps', 1, 80, 1, 'MP4 only.'),
];
/** Gait and Body are one tab: the walk first, then the body. `area` keeps which it came from, for its colour. */
/**
 * Room to exaggerate. A signed slider (one that already goes below zero) reaches twice as far each way; a slider in degrees, leg lengths or shoulder heights that starts at zero reaches twice as far up;
 * a proportion goes from a little over half its smallest to nearly twice its largest. Fractions with a natural limit (time on the ground, heel timing and the like), counts, the weight, the
 * heading and the terrain are left as they are, and the code that uses each value clamps it where the figure would break.
 */
const KEEP_RANGE = new Set(['cycleFrames', 'fps', 'exposure', 'weight', 'heading', 'terrainGrade', 'terrainRun', 'noiseAmount', 'noiseSpeed', 'noiseSeed', 'dogNeckSegs', 'duty', 'dogDuty', 'headBob', 'legExtend', 'heelDown', 'heelUp', 'liftPeak', 'swingReach', 'downPhase', 'hoseFollow', 'hoseStretch', 'hoseWobble', 'hoseWobbleRate', 'carry']);
const widen = (c) => {
  if (c.type !== 'number' || (c.scope !== 'p' && c.scope !== 'r') || KEEP_RANGE.has(c.id)) return c;
  const r = (v) => +v.toFixed(4);
  if (c.scope === 'r') return { ...c, min: r(Math.max(0.1, c.min * 0.6)), max: r(c.max * 1.8) };
  if (c.min < 0) return { ...c, min: r(c.min * 2), max: r(c.max * 2) };
  if (c.unit === '°' || c.unit === 'legs' || c.unit === 'heights') return { ...c, max: r(c.max * 2) };
  return c;
};
/**
 * How the walk and body settings of the two-legged figures are laid out in the Body tab: [area, group, settings in order]. One part of the body, one group:
 * everything about the arms is under Shoulders and arms (the far arm's swing too), everything about where the feet go is under Stride, and so on.
 * The list above says what each setting is; this says where it is shown.
 */
export const BODY_LAYOUT = [
  ['Gait', 'Timing', ['exposure', 'travel', 'cycleFrames', 'fps']],
  ['Gait', 'Stride', ['stepLength', 'duty', 'legExtend', 'stepWidth', 'toeOut']],
  ['Gait', 'Bounce and weight', ['bob', 'downPhase', 'weight']],
  ['Gait', 'Feet', ['footLift', 'liftPeak', 'swingReach', 'heelStrike', 'heelDown', 'heelUp', 'toeOff', 'swingToe', 'asymTiming', 'asymDuty', 'asymLift']], // the far foot against the near one is here too: one group for the feet
  ['Gait', 'Variety', ['noiseAmount', 'noiseSpeed', 'noiseSeed', 'noiseLoop']],
  ['Gait', 'Rubber hose', ['hoseFollow', 'hoseStretch', 'hoseWobble', 'hoseWobbleRate']],
  ['Gait', 'Direction', ['heading']],
  ['Gait', 'Ground', ['terrain', 'terrainGrade', 'terrainRise', 'terrainRun']],
  ['Body', 'Torso', ['lean', 'sideLean', 'chestOut', 'torsoSway', 'carry']],
  ['Body', 'Hips and legs', ['pelvisYaw', 'pelvisRoll', 'pelvisPitch', 'sway', 'kneeOut']],
  ['Body', 'Shoulders and arms', ['armSwing', 'asymArm', 'armCarry', 'armOut', 'armLag', 'elbowBase', 'elbowSwing', 'shoulderCounter']],
  ['Body', 'Head', ['headBob', 'headKeep', 'headTilt', 'headTurn', 'headNod']],
];
const PLACE = Object.fromEntries(BODY_LAYOUT.flatMap(([area, group, ids], g) => ids.map((id, i) => [id, { area, group, at: g * 100 + i }])));
const arrange = (list) => { // the settings in the layout come first, in its order; everything else follows as it was
  const placed = list.filter((c) => c.scope === 'p' && PLACE[c.id]).map((c) => ({ ...c, area: PLACE[c.id].area, group: PLACE[c.id].group })).sort((a, b) => PLACE[a.id].at - PLACE[b.id].at);
  return [...placed, ...list.filter((c) => !(c.scope === 'p' && PLACE[c.id]))];
};
export const CONTROLS = arrange(RAW_CONTROLS.map((c) => widen(c.tab === 'Body' ? { ...c, tab: 'Gait', area: 'Body' } : c.tab === 'Look' || c.tab === 'Guides' ? { ...c, tab: 'View', area: c.tab } : { ...c, area: c.tab })));

/** Which figure a control belongs to: 'both', 'human' or 'dog'. Timing, camera, look, guides and export are shared. */
const SHARED_P = new Set(['cycleFrames', 'fps', 'exposure', 'travel', 'terrain', 'terrainGrade', 'terrainRise', 'terrainRun', 'heading', 'hoseWobble', 'hoseWobbleRate']); // the wobble is for every rubber hose figure, on two legs or four
export const rigOf = (c) => (c.scope === 'p' || c.scope === 'r' ? (SHARED_P.has(c.id) ? 'both' : c.id.startsWith('dog') || (c.scope === 'r' && c.id.length > 1 && c.id[0] === 'd' && c.id[1] === c.id[1].toUpperCase()) ? 'dog' : 'human') : 'both');
export const shownFor = (c, rig) => rigOf(c) === 'both' || rigOf(c) === rig;

export const DEFAULT_OF = (c) => (c.scope === 'r' ? 1 : ({ p: DEFAULTS, s: STYLE_DEFAULTS, x: EXPORT_DEFAULTS })[c.scope][c.id]);

export const PRESETS = {
  Normal: {},
  Casual: { stepLength: 0.7, bob: 0.06, armSwing: 18, lean: 2, footLift: 0.12, duty: 0.62, torsoSway: 1.2 },
  Confident: { stepLength: 0.86, bob: 0.1, armSwing: 32, lean: 0, torsoSway: 2.4, headBob: 0.6, duty: 0.58, footLift: 0.18, elbowSwing: 34 },
  Brisk: { stepLength: 0.95, bob: 0.09, duty: 0.56, armSwing: 34, lean: 6, cycleFrames: 16, footLift: 0.2, elbowBase: 40, elbowSwing: 30 },
  Heavy: { weight: 0.8, stepLength: 0.7, cycleFrames: 34, duty: 0.66, lean: 6, bob: 0.085, armSwing: 14, headNod: 2 },
  Light: { weight: -0.7, stepLength: 0.82, cycleFrames: 18, duty: 0.56, footLift: 0.2, bob: 0.07, armSwing: 28 },
  Jog: { stepLength: 0.9, duty: 0.46, footLift: 0.26, bob: 0.09, downPhase: 0.2, lean: 7, legExtend: 0.95, cycleFrames: 18, armSwing: 40, elbowBase: 70, elbowSwing: 8, torsoSway: 2 },
  Run: { stepLength: 1.05, duty: 0.36, footLift: 0.32, bob: 0.12, downPhase: 0.18, lean: 10, legExtend: 0.93, cycleFrames: 16, armSwing: 50, elbowBase: 80, elbowSwing: 10, torsoSway: 3 },
  Sprint: { stepLength: 1.35, duty: 0.28, footLift: 0.4, bob: 0.14, downPhase: 0.14, lean: 16, legExtend: 0.92, cycleFrames: 12, armSwing: 60, elbowBase: 90, elbowSwing: 12, torsoSway: 4 },
  Uphill: { stepLength: 0.5, terrain: 'slope', terrainGrade: 12, lean: 8, bob: 0.07, footLift: 0.2, cycleFrames: 28 },
  Downhill: { stepLength: 0.55, terrain: 'slope', terrainGrade: -12, lean: -3, bob: 0.06, footLift: 0.12, cycleFrames: 24 },
  'Up the steps': { stepLength: 0.45, terrain: 'steps', terrainRise: 0.14, terrainRun: 0.9, lean: 5, bob: 0.04, footLift: 0.2, duty: 0.66, cycleFrames: 30 },
  'Down the steps': { stepLength: 0.45, terrain: 'steps', terrainRise: -0.15, terrainRun: 0.9, lean: -2, bob: 0.06, footLift: 0.2, duty: 0.66, cycleFrames: 28 },
  Limp: { stepLength: 0.6, duty: 0.62, asymDuty: -0.1, asymTiming: 0.05, asymLift: -0.4, asymArm: -0.5, bob: 0.07, lean: 5, headNod: 3, torsoSway: 3, pelvisRoll: 6, cycleFrames: 30, footLift: 0.1 },
  Shuffle: { stepLength: 0.42, duty: 0.68, footLift: 0.03, heelStrike: 4, toeOff: 8, armSwing: 8, lean: 9, bob: 0.03, headNod: 3, cycleFrames: 32, heelDown: 0.35, heelUp: 0.8, liftPeak: 0.5 },
  March: { stepLength: 0.8, duty: 0.56, footLift: 0.3, armSwing: 44, elbowBase: 80, elbowSwing: 6, lean: 0, headBob: 1, bob: 0.05, heelStrike: 18, cycleFrames: 20, liftPeak: 0.5, swingReach: 0.5, torsoSway: 0.5 },
  Stomp: { stepLength: 0.7, duty: 0.6, footLift: 0.22, bob: 0.11, heelStrike: 30, heelDown: 0.07, liftPeak: 0.3, swingReach: 0.95, legExtend: 0.985, armSwing: 22, lean: 4, cycleFrames: 22, torsoSway: 3 },
  Sneak: { stepLength: 0.5, duty: 0.72, footLift: 0.22, bob: 0.03, lean: 12, armSwing: 6, cycleFrames: 40, heelStrike: 3, headBob: 0.9, legExtend: 0.9, liftPeak: 0.55, heelDown: 0.3, torsoSway: 0.6 },
  Strut: { stepLength: 0.8, duty: 0.58, footLift: 0.15, bob: 0.09, lean: -2, armSwing: 30, headBob: 0.7, pelvisRoll: 7, pelvisYaw: 12, sway: 0.05, torsoSway: 3, shoulderCounter: 14, toeOut: 12, cycleFrames: 28 },
  // Robot: straight stiff legs, flat feet that never roll, hips that do not bob or twist, arms held at a right angle, the head locked, and on twos so it steps from pose to pose.
  Robot: { stepLength: 0.55, duty: 0.6, legExtend: 0.995, heelStrike: 0, toeOff: 0, swingToe: 0, heelDown: 0.04, heelUp: 0.85, footLift: 0.16, liftPeak: 0.5, swingReach: 0, bob: 0.008, downPhase: 0.1, armSwing: 18, elbowBase: 80, elbowSwing: 0, armLag: 0, pelvisYaw: 0, pelvisRoll: 0, pelvisPitch: 0, sway: 0, torsoSway: 0, shoulderCounter: 0, headBob: 1, headNod: 0, headKeep: 1, lean: 0, noiseAmount: 0, cycleFrames: 28, exposure: 2 },
  // Skip: a step and a hop on each side, so the rhythm is long-short, the body leaves the ground, and the arms swing high.
  Skip: { stepLength: 0.8, duty: 0.4, footLift: 0.34, liftPeak: 0.45, bob: 0.13, downPhase: 0.2, legExtend: 0.98, armSwing: 50, elbowBase: 40, elbowSwing: 25, lean: 3, headNod: 3, headBob: 0.5, pelvisRoll: 3, torsoSway: 2, asymTiming: 0.07, asymLift: 0.5, asymDuty: -0.04, heelStrike: 6, toeOff: 30, cycleFrames: 20 },
  // Tiptoe: up on the balls of the feet, short light steps, the heel never lands.
  Tiptoe: { stepLength: 0.4, duty: 0.58, heelStrike: 0, toeOff: 60, swingToe: 25, heelDown: 0.04, heelUp: 0.35, footLift: 0.18, bob: 0.025, lean: -2, armSwing: 6, elbowBase: 20, elbowSwing: 6, headBob: 0.9, legExtend: 0.97, cycleFrames: 30, torsoSway: 0.6 },
  // Catwalk: one foot in front of the other on a single line, hips swinging, shoulders quiet, chin level.
  Catwalk: { stepLength: 0.75, duty: 0.55, stepWidth: 0, toeOut: 0, pelvisRoll: 10, pelvisYaw: 20, sway: 0.03, shoulderCounter: 6, armSwing: 10, elbowBase: 25, bob: 0.06, lean: -4, chestOut: 8, headBob: 1, headKeep: 1, footLift: 0.12, heelStrike: 12, cycleFrames: 30 },
  // Zombie: dragging feet, arms held out in front, head lolling to one side.
  Zombie: { stepLength: 0.45, duty: 0.7, footLift: 0.05, armCarry: 40, armSwing: 4, elbowBase: 5, elbowSwing: 0, lean: 10, headTilt: 10, headTurn: 8, asymLift: -0.3, asymDuty: -0.05, bob: 0.03, heelStrike: 2, toeOff: 8, cycleFrames: 44, noiseAmount: 0.3, torsoSway: 4, sideLean: 4 },
  // Drunk: a wide uneven stagger, the body rocking about and the arms flung.
  Drunk: { stepLength: 0.55, duty: 0.62, stepWidth: 0.2, sway: 0.1, sideLean: 6, noiseAmount: 0.7, noiseSpeed: 1, torsoSway: 7, pelvisRoll: 8, armSwing: 22, headNod: 5, lean: 3, footLift: 0.14, asymTiming: 0.03, kneeOut: 5, toeOut: 20, cycleFrames: 36 },
  'Power walk': { stepLength: 1.0, duty: 0.52, armSwing: 48, elbowBase: 85, elbowSwing: 10, lean: 5, footLift: 0.14, bob: 0.06, heelStrike: 20, pelvisYaw: 8, shoulderCounter: 12, torsoSway: 1.5, cycleFrames: 17 },
  Waddle: { stepLength: 0.5, duty: 0.64, bob: 0.06, pelvisRoll: 9, sway: 0.07, torsoSway: 5, toeOut: 22, stepWidth: 0.12, armSwing: 10, armOut: 14, lean: 2, cycleFrames: 34, headNod: 4 },
  Tired: { stepLength: 0.5, bob: 0.05, footLift: 0.05, lean: 11, armSwing: 8, duty: 0.68, cycleFrames: 32, headNod: 4, headBob: 0, heelStrike: 6, toeOff: 20, legExtend: 0.95 },
  'Carrying a bag': { carry: 0.9, stepLength: 0.66, bob: 0.06, duty: 0.63, cycleFrames: 28, lean: 3, armSwing: 20, sway: 0.045, weight: 0.4, asymTiming: 0.02 },
  Slouch: { chestOut: -14, headTilt: 8, stepLength: 0.66, bob: 0.05, armSwing: 14, footLift: 0.1, lean: 6, cycleFrames: 28, toeOut: 12 },
  'Chest out': { chestOut: 13, headTilt: -6, lean: -2, stepLength: 0.84, armSwing: 34, elbowSwing: 30, shoulderCounter: 13, bob: 0.09, cycleFrames: 24, footLift: 0.18 },
  'Looking back': { headTurn: 70, sideLean: 3, stepLength: 0.7, armSwing: 18, cycleFrames: 26, shoulderCounter: 12, camYaw: -35 },
};

/** Markdown reference generated from this list. */
export function parametersMarkdown() {
  const rows = ['# Walk Base parameters', '', 'Generated from `walkbase/src/controls.js`. Lengths are in leg lengths for the human and shoulder heights for the dog, unless noted. The Figure column says which figure shows the control.', ''];
  for (const tab of TABS) {
    if (!CONTROLS.some((x) => x.tab === tab)) continue; // Parts and Auto have no plain settings: their controls are the channels and lanes
    rows.push(`## ${tab}`, '', '| Control | Figure | Unit | Range | Default | What it does |', '|---|---|---|---|---|---|');
    for (const c of CONTROLS.filter((x) => x.tab === tab)) {
      const range = c.type === 'number' ? `${c.min} to ${c.max}` : c.type === 'enum' ? c.options.join(', ') : c.type;
      rows.push(`| ${c.label} | ${rigOf(c)} | ${c.unit || ''} | ${range} | ${DEFAULT_OF(c)} | ${c.help} |`);
    }
    rows.push('');
  }
  return rows.join('\n');
}

export const PRESETS_DOG = {
  Walk: {},
  'Brisk walk': { dogStride: 1.15, dogLift: 0.16, dogBob: 0.04, dogWag: 28, cycleFrames: 20 },
  Trot: { dogGait: 'trot', dogStride: 1.35, dogDuty: 0.52, dogLift: 0.2, dogBob: 0.05, dogFlex: 3, dogArch: 3, dogTwist: 3, dogShoulder: 0.035, cycleFrames: 16, dogWag: 30 },
  Pace: { dogGait: 'pace', dogStride: 1.3, dogDuty: 0.55, dogLift: 0.18, dogBob: 0.04, dogFlex: 9, dogTwist: 2, dogShoulder: 0.03, cycleFrames: 16 },
  Gallop: { dogGait: 'gallop', dogStride: 2.6, dogDuty: 0.22, dogLift: 0.38, dogBob: 0.2, dogFlex: 3, dogArch: 0, dogCurl: 18, dogTwist: 2, dogShoulder: 0.07, dogWidth: 0.07, dogHeadNod: 6, dogEar: 18, dogTailAngle: 10, dogWag: 6, cycleFrames: 12 },
  Sniffing: { dogStride: 0.55, dogLift: 0.08, dogNeckAngle: 15, dogHeadAngle: 55, dogTailAngle: 8, dogWag: 8, cycleFrames: 32, dogBob: 0.015 },
  Limp: { dogStride: 0.7, dogLift: 0.1, dogDuty: 0.7, dogAsymDuty: -0.14, dogAsymLift: -0.5, dogAsymTiming: 0.04, dogBob: 0.03, dogNeckAngle: 44, dogHeadAngle: 40, dogWag: 4, cycleFrames: 28 },
  // Robot: even, mechanical steps, a rigid back and a level head, on twos.
  Robot: { dogStride: 0.8, dogDuty: 0.6, dogLift: 0.12, dogBob: 0, dogFlex: 0, dogArch: 0, dogTwist: 0, dogShoulder: 0, dogNeckAngle: 30, dogHeadAngle: 30, dogWag: 0, dogEar: 0, cycleFrames: 24, exposure: 2 },
  // Bounding along: all four feet leave the ground together, the back flexing like a springing cat or a deer.
  Skip: { dogGait: 'gallop', dogStride: 1.5, dogDuty: 0.34, dogLift: 0.3, dogBob: 0.14, dogFlex: 2, dogCurl: 12, dogShoulder: 0.05, dogHeadNod: 5, dogTailAngle: 14, dogWag: 14, cycleFrames: 18 },
  Heavy: { weight: 0.8, dogStride: 0.75, dogDuty: 0.72, dogLift: 0.09, dogBob: 0.04, cycleFrames: 36 },
  Light: { weight: -0.6, dogStride: 1.05, dogDuty: 0.6, dogLift: 0.17, dogBob: 0.04, cycleFrames: 20 },
  Uphill: { dogStride: 0.85, dogLift: 0.17, dogBob: 0.04, dogDuty: 0.64, terrain: 'slope', terrainGrade: 12, dogNeckAngle: 46, dogHeadAngle: 30, cycleFrames: 24 },
  Downhill: { dogStride: 0.85, dogLift: 0.12, dogBob: 0.035, dogDuty: 0.66, terrain: 'slope', terrainGrade: -12, dogNeckAngle: 56, dogHeadAngle: 34, cycleFrames: 24 },
  'Up the steps': { dogStride: 0.8, dogLift: 0.2, dogBob: 0.04, dogDuty: 0.66, terrain: 'steps', terrainRise: 0.12, terrainRun: 0.8, cycleFrames: 28 },
  'Old dog': { dogStride: 0.6, dogLift: 0.06, dogDuty: 0.74, dogBob: 0.012, dogFlex: 3, dogArch: 1, dogTwist: 3, dogShoulder: 0.025, dogNeckAngle: 38, dogHeadAngle: 42, dogTailAngle: 0, dogWag: 6, cycleFrames: 36 },
};
/** Presets for the other legged figures. Each one names its species, so choosing it sets the whole figure. Units are the figure's own heights. */
const sp = (dogSpecies, o) => ({ dogSpecies, ...o });
export const PRESETS_SPECIES = {
  theropod: {
    Walk: sp('theropod', { dogGait: 'walk', dogStride: 1.7, dogDuty: 0.62, dogLift: 0.14, dogBob: 0.025, dogFlex: 2, dogArch: 1, dogTwist: 3, dogWidth: 0.07, dogTilt: 6, dogNeckAngle: 28, dogHeadAngle: 24, dogTailAngle: -4, dogWag: 5, dogHeadNod: 2, dogArmSwing: 0.03, cycleFrames: 30 }),
    Stalk: sp('theropod', { dogGait: 'walk', dogStride: 1.1, dogDuty: 0.72, dogLift: 0.1, dogBob: 0.012, dogTwist: 4, dogWidth: 0.06, dogTilt: 2, dogNeckAngle: 38, dogHeadAngle: 36, dogTailAngle: -6, dogWag: 8, dogArmSwing: 0.015, cycleFrames: 40 }),
    Run: sp('theropod', { dogGait: 'run', dogStride: 4.2, dogDuty: 0.4, dogLift: 0.5, dogBob: 0.2, dogCurl: 24, dogFlex: 1, dogArch: 0, dogTwist: 2, dogWidth: 0.06, dogTilt: -6, dogNeckAngle: 44, dogHeadAngle: 58, dogTailAngle: 0, dogWag: 2, dogHeadNod: 0, dogHeadHold: 0.5, dogArmSwing: 0.04, cycleFrames: 12 }),
    'Small fast runner': sp('theropod', { dogGait: 'run', dogStride: 3.4, dogDuty: 0.36, dogLift: 0.45, dogBob: 0.18, dogCurl: 20, dogFlex: 1, dogArch: 0, dogTwist: 2, dogWidth: 0.05, dogTilt: -10, dogNeckAngle: 46, dogHeadAngle: 60, dogTailAngle: 2, dogWag: 2, dogHeadNod: 0, dogHeadHold: 0.5, dogArmSwing: 0.05, cycleFrames: 10 }),
  },
  bird: {
    Walk: sp('bird', { dogGait: 'walk', dogStride: 0.75, dogDuty: 0.64, dogLift: 0.2, dogBob: 0.02, dogFlex: 3, dogArch: 0, dogTwist: 4, dogWidth: 0.05, dogTilt: 38, dogNeckAngle: 40, dogHeadAngle: 74, dogTailAngle: 20, dogWag: 4, dogHeadNod: 0, dogHeadHold: 1, dogWingOpen: 0, cycleFrames: 24 }),
    Hop: sp('bird', { dogGait: 'hop', dogStride: 0.5, dogDuty: 0.3, dogLift: 0.3, dogBob: 0.1, dogFlex: 0, dogTwist: 0, dogWidth: 0.04, dogTilt: 40, dogNeckAngle: 40, dogHeadAngle: 72, dogTailAngle: 24, dogWag: 2, dogHeadHold: 0.4, cycleFrames: 14 }),
    Run: sp('bird', { dogGait: 'run', dogStride: 1.9, dogDuty: 0.4, dogLift: 0.35, dogBob: 0.08, dogCurl: 12, dogTwist: 3, dogWidth: 0.05, dogTilt: 22, dogNeckAngle: 46, dogHeadAngle: 56, dogTailAngle: 14, dogWag: 2, dogHeadHold: 0.2, dogWingOpen: 0.25, dogFlap: 10, dogFlapRate: 2, cycleFrames: 12 }),
    Wading: sp('bird', { dogGait: 'walk', dogStride: 0.5, dogDuty: 0.72, dogLift: 0.34, dogBob: 0.012, dogTwist: 3, dogWidth: 0.05, dogTilt: 30, dogNeckAngle: 52, dogHeadAngle: 70, dogTailAngle: 16, dogWag: 2, dogHeadHold: 1, cycleFrames: 40 }),
    Flying: sp('bird', { dogGait: 'walk', dogStride: 3.2, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 0, dogTwist: 0, dogWidth: 0.05, dogTilt: 8, dogNeckAngle: 16, dogHeadAngle: 22, dogTailAngle: 8, dogWag: 0, dogHeadHold: 0, dogWingOpen: 1, dogFlap: 55, dogFlapRate: 1, dogFlapFrames: 8, dogFlight: 1, dogFlightHeight: 1.1, cycleFrames: 16, camYaw: 35 }),
    Gliding: sp('bird', { dogGait: 'walk', dogStride: 3.2, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 0, dogTwist: 0, dogWidth: 0.05, dogTilt: 4, dogNeckAngle: 12, dogHeadAngle: 18, dogTailAngle: 4, dogWag: 0, dogHeadHold: 0, dogWingOpen: 1, dogFlap: 6, dogFlapRate: 1, dogFlight: 1, dogFlightHeight: 1.3, cycleFrames: 48, camYaw: 35 }),
    Flapping: sp('bird', { dogGait: 'walk', dogStride: 0.2, dogDuty: 0.8, dogLift: 0.05, dogBob: 0.0, dogTilt: 28, dogNeckAngle: 44, dogHeadAngle: 60, dogTailAngle: 12, dogWag: 0, dogHeadHold: 0, dogWingOpen: 1, dogFlap: 48, dogFlapRate: 2, cycleFrames: 24 }),
  },
  sauropod: {
    Walk: sp('sauropod', { dogNeckSegs: 7, dogNeckCurve: 25, dogNeckWave: 2.5, dogNeckSway: 4, dogGait: 'walk', dogStride: 1.3, dogDuty: 0.74, dogLift: 0.07, dogBob: 0.008, dogFlex: 1.5, dogArch: 0.5, dogTwist: 2, dogShoulder: 0.03, dogWidth: 0.16, dogElbowOut: 1, dogNeckAngle: 48, dogHeadAngle: 36, dogHeadNod: 1.5, dogTailAngle: -2, dogWag: 6, cycleFrames: 44 }),
    'Neck up': sp('sauropod', { dogNeckSegs: 7, dogNeckCurve: -10, dogNeckWave: 2, dogNeckSway: 3, dogGait: 'walk', dogStride: 0.9, dogDuty: 0.78, dogLift: 0.05, dogBob: 0.006, dogTwist: 1.5, dogShoulder: 0.025, dogWidth: 0.16, dogNeckAngle: 74, dogHeadAngle: 52, dogTailAngle: 4, dogWag: 4, cycleFrames: 52 }),
  },
  snake: {
    Slither: sp('snake', { dogStride: 2.4, dogFlex: 30, dogNeckAngle: 10, dogBob: 0.01, cycleFrames: 32, camYaw: -25, camPitch: 55 }),
    Creep: sp('snake', { dogStride: 1.8, dogFlex: 18, dogNeckAngle: 6, dogBob: 0.004, cycleFrames: 56, camYaw: -25, camPitch: 55 }),
    Rear: sp('snake', { dogStride: 3, dogFlex: 14, dogNeckAngle: 62, dogBob: 0.006, cycleFrames: 52, camYaw: -25, camPitch: 20 }),
    'Fast glide': sp('snake', { dogStride: 3.2, dogFlex: 36, dogNeckAngle: 12, dogBob: 0.012, cycleFrames: 14, camYaw: -25, camPitch: 55 }),
  },
  spider: {
    Walk: sp('spider', { dogStride: 0.7, dogDuty: 0.72, dogLift: 0.22, dogBob: 0.012, dogLegVariety: 0.6, cycleFrames: 24, camYaw: -35, camPitch: 18 }),
    Probing: sp('spider', { dogStride: 0.45, dogDuty: 0.7, dogLift: 0.2, dogBob: 0.006, dogLegVariety: 1, cycleFrames: 36, camYaw: -35, camPitch: 18 }),
    Scuttle: sp('spider', { dogStride: 1.15, dogDuty: 0.7, dogLift: 0.3, dogBob: 0.02, cycleFrames: 12, camYaw: -35, camPitch: 18 }),
    Creep: sp('spider', { dogStride: 0.3, dogDuty: 0.8, dogLift: 0.15, dogBob: 0.006, cycleFrames: 40, camYaw: -35, camPitch: 18 }),
  },
  crab: {
    Sidle: sp('crab', { dogStride: 0.6, dogDuty: 0.62, dogLift: 0.18, dogBob: 0.01, dogWag: 14, cycleFrames: 24, camYaw: -70, camPitch: 12 }),
    Scuttle: sp('crab', { dogStride: 0.8, dogDuty: 0.46, dogLift: 0.26, dogBob: 0.018, dogWag: 24, cycleFrames: 10, camYaw: -70, camPitch: 12 }),
    Threat: sp('crab', { dogStride: 0.25, dogDuty: 0.75, dogLift: 0.12, dogBob: 0.004, dogWag: 40, cycleFrames: 36, camYaw: -70, camPitch: 12 }),
  },
  ant: {
    Walk: sp('ant', { dogStride: 0.8, dogDuty: 0.66, dogLift: 0.14, dogBob: 0.008, cycleFrames: 18, camYaw: -35, camPitch: 18 }),
    Scurry: sp('ant', { dogStride: 1.4, dogDuty: 0.64, dogLift: 0.18, dogBob: 0.012, cycleFrames: 9, camYaw: -35, camPitch: 18 }),
    Search: sp('ant', { dogStride: 0.4, dogDuty: 0.74, dogLift: 0.12, dogBob: 0.004, dogLegVariety: 0.9, cycleFrames: 30, camYaw: -35, camPitch: 18 }),
  },
  beetle: {
    Plod: sp('beetle', { dogStride: 0.5, dogDuty: 0.74, dogLift: 0.1, dogBob: 0.006, cycleFrames: 30, camYaw: -35, camPitch: 18 }),
    Scuttle: sp('beetle', { dogStride: 0.9, dogDuty: 0.68, dogLift: 0.14, dogBob: 0.01, cycleFrames: 14, camYaw: -35, camPitch: 18 }),
    Trundle: sp('beetle', { dogStride: 0.3, dogDuty: 0.8, dogLift: 0.08, dogBob: 0.004, dogLegVariety: 0.3, cycleFrames: 44, camYaw: -35, camPitch: 18 }),
  },
  stegosaurus: {
    Walk: sp('stegosaurus', { dogGait: 'walk', dogStride: 1.0, dogDuty: 0.72, dogLift: 0.08, dogBob: 0.012, dogFlex: 2, dogArch: 1, dogTwist: 2, dogShoulder: 0.03, dogWidth: 0.14, dogElbowOut: 6, dogNeckAngle: 4, dogHeadAngle: 40, dogHeadNod: 3, dogTailAngle: 4, dogWag: 10, cycleFrames: 36 }),
    Trudge: sp('stegosaurus', { dogGait: 'walk', dogStride: 0.6, dogDuty: 0.8, dogLift: 0.05, dogBob: 0.006, dogFlex: 1.5, dogTwist: 1.5, dogShoulder: 0.02, dogWidth: 0.14, dogNeckAngle: 4, dogHeadAngle: 44, dogHeadNod: 2, dogTailAngle: 6, dogWag: 6, cycleFrames: 52 }),
    Charge: sp('stegosaurus', { dogGait: 'trot', dogStride: 1.7, dogDuty: 0.5, dogLift: 0.16, dogBob: 0.03, dogFlex: 1, dogArch: 2, dogTwist: 2, dogShoulder: 0.04, dogWidth: 0.13, dogNeckAngle: 4, dogHeadAngle: 36, dogHeadNod: 3, dogTailAngle: 2, dogWag: 14, cycleFrames: 20 }),
  },
  crocodile: {
    'High walk': sp('crocodile', { dogGait: 'walk', dogStride: 0.6, dogDuty: 0.72, dogLift: 0.07, dogBob: 0.006, dogFlex: 10, dogArch: 0, dogTwist: 5, dogWidth: 0.12, dogElbowOut: 40, dogNeckAngle: 6, dogHeadAngle: 8, dogHeadNod: 2, dogTailAngle: -2, dogWag: 18, cycleFrames: 40 }),
    Crawl: sp('crocodile', { dogGait: 'walk', dogStride: 0.4, dogDuty: 0.8, dogLift: 0.04, dogBob: 0.003, dogFlex: 14, dogTwist: 4, dogWidth: 0.14, dogElbowOut: 55, dogNeckAngle: 2, dogHeadAngle: 4, dogTailAngle: -4, dogWag: 24, cycleFrames: 56 }),
    Lunge: sp('crocodile', { dogGait: 'trot', dogStride: 1.6, dogDuty: 0.42, dogLift: 0.12, dogBob: 0.012, dogFlex: 8, dogTwist: 6, dogWidth: 0.11, dogElbowOut: 35, dogNeckAngle: 8, dogHeadAngle: 6, dogTailAngle: 2, dogWag: 14, cycleFrames: 12 }),
  },
  monkey: {
    Knuckle: sp('monkey', { dogGait: 'walk', dogStride: 0.95, dogDuty: 0.66, dogLift: 0.14, dogBob: 0.025, dogFlex: 4, dogArch: 3, dogTwist: 4, dogShoulder: 0.04, dogWidth: 0.1, dogNeckAngle: 28, dogHeadAngle: 30, dogHeadNod: 4, dogTailAngle: 28, dogWag: 6, dogEar: 3, cycleFrames: 26 }),
    Scamper: sp('monkey', { dogGait: 'trot', dogStride: 1.5, dogDuty: 0.5, dogLift: 0.22, dogBob: 0.05, dogFlex: 3, dogArch: 3, dogTwist: 3, dogShoulder: 0.05, dogWidth: 0.09, dogNeckAngle: 24, dogHeadAngle: 26, dogHeadNod: 3, dogTailAngle: 40, dogWag: 8, dogEar: 4, cycleFrames: 14 }),
    Bound: sp('monkey', { dogGait: 'gallop', dogStride: 2.2, dogDuty: 0.3, dogLift: 0.3, dogBob: 0.1, dogFlex: 2, dogArch: 0, dogCurl: 10, dogTwist: 2, dogShoulder: 0.06, dogWidth: 0.08, dogNeckAngle: 20, dogHeadAngle: 20, dogTailAngle: 50, dogWag: 6, dogEar: 6, cycleFrames: 12 }),
    Amble: sp('monkey', { dogGait: 'walk', dogStride: 0.55, dogDuty: 0.74, dogLift: 0.1, dogBob: 0.015, dogFlex: 3, dogTwist: 3, dogShoulder: 0.03, dogWidth: 0.1, dogNeckAngle: 34, dogHeadAngle: 36, dogHeadNod: 5, dogTailAngle: 18, dogWag: 10, dogEar: 4, cycleFrames: 40 }),
  },
  dragon: {
    Prowl: sp('dragon', { dogNeckSegs: 6, dogNeckCurve: 20, dogNeckWave: 2, dogNeckSway: 3, dogGait: 'walk', dogStride: 1.2, dogDuty: 0.7, dogLift: 0.1, dogBob: 0.012, dogFlex: 3, dogArch: 1, dogTwist: 3, dogShoulder: 0.03, dogWidth: 0.15, dogElbowOut: 6, dogNeckAngle: 52, dogHeadAngle: 34, dogHeadNod: 2, dogTailAngle: -4, dogWag: 10, dogWingOpen: 0, cycleFrames: 36 }),
    Stomp: sp('dragon', { dogNeckSegs: 6, dogNeckCurve: 10, dogNeckWave: 1.5, dogNeckSway: 2, dogGait: 'trot', dogStride: 1.8, dogDuty: 0.5, dogLift: 0.2, dogBob: 0.03, dogFlex: 2, dogArch: 2, dogTwist: 2, dogShoulder: 0.04, dogWidth: 0.14, dogNeckAngle: 44, dogHeadAngle: 40, dogHeadNod: 3, dogTailAngle: -2, dogWag: 8, dogWingOpen: 0.25, cycleFrames: 20 }),
    Flying: sp('dragon', { dogNeckSegs: 6, dogNeckCurve: 14, dogNeckWave: 1.5, dogNeckSway: 2, dogGait: 'walk', dogStride: 3.2, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 2, dogTwist: 1, dogWidth: 0.12, dogNeckAngle: 30, dogHeadAngle: 24, dogTailAngle: 0, dogWag: 8, dogWingOpen: 1, dogFlap: 40, dogFlapRate: 1, dogFlapFrames: 20, dogFlight: 1, dogFlightHeight: 1.4, cycleFrames: 20 }),
    Gliding: sp('dragon', { dogNeckSegs: 6, dogNeckCurve: 10, dogNeckWave: 1, dogNeckSway: 1, dogGait: 'walk', dogStride: 3, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 1, dogTwist: 0, dogWidth: 0.12, dogNeckAngle: 22, dogHeadAngle: 20, dogTailAngle: 0, dogWag: 5, dogWingOpen: 1, dogFlap: 5, dogFlapRate: 1, dogFlight: 1, dogFlightHeight: 1.7, cycleFrames: 48 }),
  },
  lizard: {
    Walk: sp('lizard', { dogGait: 'walk', dogStride: 0.7, dogDuty: 0.7, dogLift: 0.07, dogBob: 0.006, dogFlex: 15, dogArch: 0, dogTwist: 6, dogWidth: 0.12, dogElbowOut: 45, dogNeckAngle: 10, dogHeadAngle: 10, dogHeadNod: 2, dogTailAngle: 0, dogWag: 26, cycleFrames: 36 }),
    Stalk: sp('lizard', { dogGait: 'walk', dogStride: 0.35, dogDuty: 0.82, dogLift: 0.05, dogBob: 0.004, dogFlex: 8, dogTwist: 4, dogWidth: 0.12, dogElbowOut: 40, dogNeckAngle: 16, dogHeadAngle: 6, dogTailAngle: 0, dogWag: 14, cycleFrames: 56 }),
    Scuttle: sp('lizard', { dogGait: 'trot', dogStride: 1.5, dogDuty: 0.5, dogLift: 0.12, dogBob: 0.01, dogFlex: 20, dogTwist: 8, dogWidth: 0.12, dogElbowOut: 50, dogNeckAngle: 12, dogHeadAngle: 8, dogTailAngle: 0, dogWag: 34, cycleFrames: 14 }),
    Sprint: sp('lizard', { dogGait: 'trot', dogStride: 2.2, dogDuty: 0.4, dogLift: 0.16, dogBob: 0.014, dogFlex: 13, dogTwist: 6, dogWidth: 0.1, dogElbowOut: 38, dogNeckAngle: 14, dogHeadAngle: 6, dogTailAngle: 6, dogWag: 20, cycleFrames: 10 }),
  },
  pterodactyl: {
    Walk: sp('pterodactyl', { dogGait: 'walk', dogStride: 0.7, dogDuty: 0.66, dogLift: 0.18, dogBob: 0.02, dogFlex: 3, dogTwist: 4, dogWidth: 0.05, dogTilt: 34, dogNeckAngle: 30, dogHeadAngle: 50, dogTailAngle: 10, dogWag: 3, dogHeadHold: 0.6, dogWingOpen: 0, cycleFrames: 26 }),
    Flying: sp('pterodactyl', { dogGait: 'walk', dogStride: 3.4, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 0, dogTwist: 0, dogWidth: 0.05, dogTilt: 8, dogNeckAngle: 14, dogHeadAngle: 20, dogTailAngle: 6, dogWag: 0, dogHeadHold: 0, dogWingOpen: 1, dogFlap: 45, dogFlapRate: 1, dogFlapFrames: 18, dogFlight: 1, dogFlightHeight: 1.2, cycleFrames: 18, camYaw: 35 }),
    Gliding: sp('pterodactyl', { dogGait: 'walk', dogStride: 3.2, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 0, dogTwist: 0, dogWidth: 0.05, dogTilt: 4, dogNeckAngle: 10, dogHeadAngle: 16, dogTailAngle: 4, dogWag: 0, dogHeadHold: 0, dogWingOpen: 1, dogFlap: 5, dogFlapRate: 1, dogFlight: 1, dogFlightHeight: 1.5, cycleFrames: 48, camYaw: 35 }),
    Flapping: sp('pterodactyl', { dogGait: 'walk', dogStride: 0.2, dogDuty: 0.8, dogLift: 0.05, dogBob: 0, dogTilt: 28, dogNeckAngle: 36, dogHeadAngle: 46, dogTailAngle: 10, dogWag: 0, dogHeadHold: 0, dogWingOpen: 1, dogFlap: 40, dogFlapRate: 2, cycleFrames: 24 }),
    'Take-off run': sp('pterodactyl', { dogGait: 'run', dogStride: 1.0, dogDuty: 0.45, dogLift: 0.14, dogBob: 0.05, dogCurl: 6, dogTwist: 3, dogWidth: 0.05, dogTilt: 18, dogNeckAngle: 36, dogHeadAngle: 44, dogTailAngle: 10, dogWag: 2, dogHeadHold: 0.2, dogWingOpen: 0.3, dogFlap: 12, dogFlapRate: 2, cycleFrames: 12 }),
  },
  plesiosaur: {
    Cruise: sp('plesiosaur', { dogNeckSegs: 9, dogNeckCurve: 18, dogNeckWave: 2, dogNeckSway: 3, dogGait: 'walk', dogStride: 1.6, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 2, dogTwist: 2, dogWidth: 0.12, dogNeckAngle: 35, dogHeadAngle: 30, dogHeadNod: 2, dogTailAngle: -5, dogWag: 6, dogWingOpen: 1, dogFlap: 32, dogFlapRate: 1, dogFlight: 1, dogFlightHeight: 0.7, cycleFrames: 40 }),
    Fast: sp('plesiosaur', { dogNeckSegs: 9, dogNeckCurve: 10, dogNeckWave: 1.5, dogNeckSway: 2, dogGait: 'walk', dogStride: 3, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 3, dogTwist: 3, dogWidth: 0.12, dogNeckAngle: 22, dogHeadAngle: 24, dogHeadNod: 1, dogTailAngle: -8, dogWag: 10, dogWingOpen: 1, dogFlap: 46, dogFlapRate: 1, dogFlight: 1, dogFlightHeight: 0.7, cycleFrames: 24 }),
    'Neck up': sp('plesiosaur', { dogNeckSegs: 9, dogNeckCurve: -18, dogNeckWave: 2, dogNeckSway: 4, dogGait: 'walk', dogStride: 1, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 2, dogTwist: 2, dogWidth: 0.12, dogNeckAngle: 72, dogHeadAngle: 40, dogHeadNod: 3, dogTailAngle: -3, dogWag: 6, dogWingOpen: 1, dogFlap: 18, dogFlapRate: 1, dogFlight: 1, dogFlightHeight: 0.6, cycleFrames: 52 }),
    Glide: sp('plesiosaur', { dogNeckSegs: 9, dogNeckCurve: 14, dogNeckWave: 1, dogNeckSway: 2, dogGait: 'walk', dogStride: 2, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 1, dogTwist: 1, dogWidth: 0.12, dogNeckAngle: 28, dogHeadAngle: 28, dogHeadNod: 1, dogTailAngle: -4, dogWag: 4, dogWingOpen: 1, dogFlap: 6, dogFlapRate: 1, dogFlight: 1, dogFlightHeight: 0.7, cycleFrames: 56 }),
  },
  horse: {
    Walk: sp('horse', { dogGait: 'walk', dogStride: 1.15, dogDuty: 0.64, dogLift: 0.16, dogBob: 0.02, dogFlex: 2, dogArch: 1, dogTwist: 3, dogShoulder: 0.03, dogWidth: 0.09, dogNeckAngle: 46, dogHeadAngle: 86, dogHeadNod: 6, dogTailAngle: -38, dogWag: 6, dogEar: 4, cycleFrames: 28 }),
    Trot: sp('horse', { dogGait: 'trot', dogStride: 1.7, dogDuty: 0.46, dogLift: 0.26, dogBob: 0.05, dogFlex: 1, dogArch: 2, dogTwist: 2, dogShoulder: 0.03, dogWidth: 0.08, dogNeckAngle: 54, dogHeadAngle: 94, dogHeadNod: 2, dogTailAngle: -24, dogWag: 5, dogEar: 6, cycleFrames: 16 }),
    Canter: sp('horse', { dogGait: 'gallop', dogStride: 1.8, dogDuty: 0.34, dogLift: 0.3, dogBob: 0.1, dogFlex: 1, dogArch: 0, dogCurl: 8, dogTwist: 2, dogShoulder: 0.05, dogWidth: 0.07, dogNeckAngle: 44, dogHeadAngle: 84, dogHeadNod: 7, dogTailAngle: -10, dogWag: 4, dogEar: 8, cycleFrames: 16 }),
    Gallop: sp('horse', { dogGait: 'gallop', dogStride: 2.5, dogDuty: 0.24, dogLift: 0.36, dogBob: 0.12, dogFlex: 1, dogArch: 0, dogCurl: 12, dogTwist: 2, dogShoulder: 0.06, dogWidth: 0.06, dogNeckAngle: 30, dogHeadAngle: 70, dogHeadNod: 8, dogTailAngle: 2, dogWag: 3, dogEar: 10, cycleFrames: 11 }),
    Grazing: sp('horse', { dogGait: 'walk', dogStride: 0.45, dogDuty: 0.76, dogLift: 0.08, dogBob: 0.008, dogTwist: 2, dogWidth: 0.09, dogNeckAngle: 2, dogHeadAngle: 52, dogHeadNod: 2, dogTailAngle: -40, dogWag: 14, dogEar: 6, cycleFrames: 48 }),
    Prance: sp('horse', { dogGait: 'trot', dogStride: 1.0, dogDuty: 0.5, dogLift: 0.42, dogBob: 0.07, dogArch: 3, dogTwist: 2, dogWidth: 0.08, dogNeckAngle: 66, dogHeadAngle: 106, dogHeadNod: 3, dogTailAngle: 6, dogWag: 8, dogEar: 6, cycleFrames: 20 }),
  },
  hosehorse: {
    Bouncy: sp('hosehorse', { dogGait: 'trot', dogStride: 1.3, dogDuty: 0.5, dogLift: 0.34, dogBob: 0.12, dogFlex: 4, dogArch: 5, dogTwist: 5, dogWidth: 0.09, dogNeckAngle: 56, dogHeadAngle: 96, dogHeadNod: 9, dogTailAngle: 4, dogWag: 26, dogEar: 16, hoseWobble: 0.5, hoseWobbleRate: 2, cycleFrames: 16, exposure: 2 }),
    Walk: sp('hosehorse', { dogGait: 'walk', dogStride: 1.1, dogDuty: 0.62, dogLift: 0.22, dogBob: 0.05, dogFlex: 5, dogArch: 3, dogTwist: 5, dogWidth: 0.09, dogNeckAngle: 48, dogHeadAngle: 88, dogHeadNod: 9, dogTailAngle: -24, dogWag: 18, dogEar: 10, hoseWobble: 0.3, hoseWobbleRate: 2, cycleFrames: 24, exposure: 2 }),
    Wobbly: sp('hosehorse', { dogGait: 'walk', dogStride: 0.9, dogDuty: 0.64, dogLift: 0.2, dogBob: 0.07, dogFlex: 11, dogArch: 6, dogTwist: 9, dogWidth: 0.11, dogElbowOut: 10, dogNeckAngle: 50, dogHeadAngle: 90, dogHeadNod: 12, dogTailAngle: -10, dogWag: 34, dogEar: 20, hoseWobble: 1.2, hoseWobbleRate: 2, cycleFrames: 20, exposure: 2 }),
    'Jelly legs': sp('hosehorse', { dogGait: 'pace', dogStride: 0.8, dogDuty: 0.6, dogLift: 0.16, dogBob: 0.09, dogFlex: 14, dogArch: 4, dogTwist: 12, dogWidth: 0.12, dogElbowOut: 16, dogNeckAngle: 44, dogHeadAngle: 84, dogHeadNod: 14, dogTailAngle: -18, dogWag: 30, dogEar: 22, hoseWobble: 1.5, hoseWobbleRate: 3, cycleFrames: 22, exposure: 2 }),
    Gallop: sp('hosehorse', { dogGait: 'gallop', dogStride: 2.5, dogDuty: 0.26, dogLift: 0.42, dogBob: 0.18, dogFlex: 2, dogArch: 0, dogCurl: 22, dogTwist: 3, dogShoulder: 0.07, dogWidth: 0.07, dogNeckAngle: 32, dogHeadAngle: 72, dogHeadNod: 10, dogTailAngle: 8, dogWag: 8, dogEar: 20, hoseWobble: 0.4, hoseWobbleRate: 1, cycleFrames: 10, exposure: 2 }),
    Prance: sp('hosehorse', { dogGait: 'trot', dogStride: 0.9, dogDuty: 0.48, dogLift: 0.5, dogBob: 0.14, dogArch: 6, dogTwist: 4, dogWidth: 0.08, dogNeckAngle: 68, dogHeadAngle: 108, dogHeadNod: 6, dogTailAngle: 14, dogWag: 22, dogEar: 12, hoseWobble: 0.4, hoseWobbleRate: 2, cycleFrames: 16, exposure: 2 }),
  },
  hosebird: {
    Strut: sp('hosebird', { dogGait: 'walk', dogStride: 0.8, dogDuty: 0.6, dogLift: 0.3, dogBob: 0.06, dogFlex: 5, dogArch: 0, dogTwist: 7, dogWidth: 0.06, dogTilt: 40, dogNeckAngle: 42, dogHeadAngle: 76, dogTailAngle: 26, dogWag: 14, dogHeadNod: 0, dogHeadHold: 1, dogWingOpen: 0, hoseWobble: 0.4, hoseWobbleRate: 2, cycleFrames: 16, exposure: 2 }),
    Hop: sp('hosebird', { dogGait: 'hop', dogStride: 0.6, dogDuty: 0.3, dogLift: 0.36, dogBob: 0.16, dogFlex: 0, dogTwist: 0, dogWidth: 0.05, dogTilt: 42, dogNeckAngle: 40, dogHeadAngle: 72, dogTailAngle: 28, dogWag: 6, dogHeadHold: 0.3, dogWingOpen: 0.2, dogFlap: 14, dogFlapRate: 1, hoseWobble: 0.5, hoseWobbleRate: 1, cycleFrames: 12, exposure: 2 }),
    Wobbly: sp('hosebird', { dogGait: 'walk', dogStride: 0.6, dogDuty: 0.64, dogLift: 0.24, dogBob: 0.05, dogFlex: 10, dogTwist: 12, dogWidth: 0.08, dogTilt: 34, dogNeckAngle: 44, dogHeadAngle: 70, dogTailAngle: 20, dogWag: 26, dogHeadNod: 8, dogHeadHold: 0, dogWingOpen: 0.15, dogFlap: 8, dogFlapRate: 2, hoseWobble: 1.3, hoseWobbleRate: 2, cycleFrames: 20, exposure: 2 }),
    Run: sp('hosebird', { dogGait: 'run', dogStride: 1.9, dogDuty: 0.4, dogLift: 0.4, dogBob: 0.1, dogCurl: 14, dogTwist: 4, dogWidth: 0.05, dogTilt: 20, dogNeckAngle: 46, dogHeadAngle: 56, dogTailAngle: 14, dogWag: 6, dogHeadHold: 0.2, dogWingOpen: 0.3, dogFlap: 16, dogFlapRate: 2, hoseWobble: 0.5, hoseWobbleRate: 2, cycleFrames: 10, exposure: 2 }),
    Flying: sp('hosebird', { dogGait: 'walk', dogStride: 3.2, dogDuty: 0.5, dogLift: 0.05, dogBob: 0, dogFlex: 0, dogTwist: 0, dogWidth: 0.05, dogTilt: 8, dogNeckAngle: 16, dogHeadAngle: 22, dogTailAngle: 8, dogWag: 0, dogHeadHold: 0, dogWingOpen: 1, dogFlap: 60, dogFlapRate: 1, dogFlapFrames: 8, dogFlight: 1, dogFlightHeight: 1.1, hoseWobble: 0.6, hoseWobbleRate: 2, cycleFrames: 16, exposure: 2, camYaw: 35 }),
    Flapping: sp('hosebird', { dogGait: 'walk', dogStride: 0.2, dogDuty: 0.8, dogLift: 0.05, dogBob: 0.0, dogTilt: 28, dogNeckAngle: 44, dogHeadAngle: 60, dogTailAngle: 12, dogWag: 0, dogHeadHold: 0, dogWingOpen: 1, dogFlap: 52, dogFlapRate: 2, hoseWobble: 0.8, hoseWobbleRate: 2, cycleFrames: 24, exposure: 2 }),
  },
  ceratopsian: {
    Walk: sp('ceratopsian', { dogGait: 'walk', dogStride: 1.1, dogDuty: 0.7, dogLift: 0.1, dogBob: 0.014, dogFlex: 2, dogArch: 1, dogTwist: 3, dogShoulder: 0.04, dogWidth: 0.13, dogElbowOut: 6, dogNeckAngle: 8, dogHeadAngle: 34, dogHeadNod: 3, dogTailAngle: -4, dogWag: 8, cycleFrames: 32 }),
    Charge: sp('ceratopsian', { dogGait: 'trot', dogStride: 2.0, dogDuty: 0.46, dogLift: 0.2, dogBob: 0.05, dogFlex: 1, dogArch: 2, dogTwist: 2, dogShoulder: 0.05, dogWidth: 0.12, dogElbowOut: 3, dogNeckAngle: 4, dogHeadAngle: 48, dogHeadNod: 3, dogTailAngle: -2, dogWag: 5, cycleFrames: 18 }),
  },
};
/** The presets for one figure: 'human', 'dog', or a species name. */
/** The rubber hose figure: bouncy, on twos, with a lot of arm swing and bob. */
export const PRESETS_HOSE = {
  Bouncy: { stepLength: 0.72, bob: 0.16, duty: 0.56, armSwing: 46, elbowBase: 4, elbowSwing: 10, footLift: 0.26, cycleFrames: 20, exposure: 2, lean: 3, torsoSway: 4, headNod: 5, headBob: 0.1, pelvisRoll: 6, sway: 0.05, heelStrike: 8, toeOff: 40, toeOut: 14, liftPeak: 0.4, swingReach: 0.7 },
  Strut: { stepLength: 0.7, bob: 0.12, duty: 0.58, armSwing: 40, elbowBase: 6, elbowSwing: 12, footLift: 0.2, cycleFrames: 16, exposure: 2, lean: -3, torsoSway: 3, headNod: 4, headBob: 0.4, pelvisRoll: 9, pelvisYaw: 12, sway: 0.07, heelStrike: 12, toeOut: 16 },
  Sneak: { stepLength: 0.45, bob: 0.06, duty: 0.7, armSwing: 8, elbowBase: 30, elbowSwing: 10, footLift: 0.2, cycleFrames: 32, exposure: 2, lean: 14, torsoSway: 1, headNod: 3, headBob: 0.6, heelStrike: 0, toeOff: 45, legExtend: 0.9, heelDown: 0.1, heelUp: 0.35 },
  Skip: { stepLength: 0.85, bob: 0.2, duty: 0.52, armSwing: 55, elbowBase: 20, elbowSwing: 20, footLift: 0.36, cycleFrames: 14, exposure: 2, lean: 2, torsoSway: 5, headNod: 6, headBob: 0, pelvisRoll: 5, heelStrike: 6, toeOff: 45, liftPeak: 0.35, swingReach: 0.6 },
  Stomp: { stepLength: 0.66, bob: 0.11, duty: 0.6, armSwing: 28, elbowBase: 40, elbowSwing: 14, footLift: 0.24, cycleFrames: 18, exposure: 2, lean: 6, torsoSway: 3, headNod: 5, heelStrike: 28, heelDown: 0.07, liftPeak: 0.3, swingReach: 0.95, legExtend: 0.985, toeOut: 10 },
  Tired: { stepLength: 0.5, bob: 0.07, duty: 0.66, armSwing: 14, elbowBase: 8, elbowSwing: 6, footLift: 0.07, cycleFrames: 32, exposure: 2, lean: 14, torsoSway: 3, headNod: 6, headBob: 0, heelStrike: 4, toeOff: 18, legExtend: 0.94, toeOut: 20 },
  Run: { stepLength: 0.95, duty: 0.4, footLift: 0.3, bob: 0.14, downPhase: 0.17, lean: 8, legExtend: 0.93, cycleFrames: 12, exposure: 2, armSwing: 60, elbowBase: 20, elbowSwing: 10, torsoSway: 3 },
  Wobbly: { stepLength: 0.64, bob: 0.08, legExtend: 0.94, duty: 0.58, armSwing: 40, elbowBase: 6, elbowSwing: 14, footLift: 0.22, cycleFrames: 16, exposure: 2, lean: 2, torsoSway: 7, headNod: 6, pelvisRoll: 6, sway: 0.05, toeOut: 14, hoseWobble: 1, hoseWobbleRate: 2, hoseFollow: 1.2, hoseStretch: 0.8 },
  'Jelly legs': { stepLength: 0.55, bob: 0.2, duty: 0.62, armSwing: 26, elbowBase: 10, elbowSwing: 10, footLift: 0.16, cycleFrames: 20, exposure: 2, lean: 4, torsoSway: 5, headNod: 7, pelvisRoll: 13, sway: 0.1, kneeOut: 14, legExtend: 0.86, toeOut: 22, hoseWobble: 1.3, hoseWobbleRate: 3, hoseFollow: 1, hoseStretch: 1 },
  'Noodle arms': { stepLength: 0.74, bob: 0.13, duty: 0.56, armSwing: 80, elbowBase: 0, elbowSwing: 44, armOut: 10, footLift: 0.24, cycleFrames: 14, exposure: 2, lean: 3, torsoSway: 5, shoulderCounter: 16, headNod: 4, hoseWobble: 0.9, hoseWobbleRate: 2, hoseFollow: 1.5, hoseStretch: 1.3 },
  Drunk: { stepLength: 0.52, bob: 0.045, legExtend: 0.92, duty: 0.66, armSwing: 20, armOut: 12, elbowBase: 14, elbowSwing: 8, footLift: 0.12, cycleFrames: 30, exposure: 2, lean: 7, torsoSway: 10, headNod: 8, pelvisRoll: 5, sway: 0.07, stepWidth: 0.06, toeOut: 18, asymTiming: 0.06, asymLift: 0.4, noiseAmount: 0.4, noiseSpeed: 1, hoseWobble: 0.7, hoseWobbleRate: 1, hoseFollow: 1.4 },
  Boing: { stepLength: 0.7, bob: 0.19, duty: 0.5, armSwing: 50, elbowBase: 10, elbowSwing: 16, footLift: 0.4, cycleFrames: 16, exposure: 2, lean: 1, torsoSway: 3, headNod: 8, liftPeak: 0.35, toeOff: 50, hoseWobble: 0.5, hoseWobbleRate: 2, hoseFollow: 1.1, hoseStretch: 1.5 },
};
/** The proportions the rubber hose figure starts with: a big head, a short body, long thin limbs. */
/** The robot: a person on the same rig and the same walks, drawn as boxes and balls, with a stiff, even, machine step. */
export const PRESETS_ROBOT = {
  March: { stepLength: 0.7, bob: 0.015, armSwing: 16, elbowSwing: 0, elbowBase: 10, lean: 0, duty: 0.6, torsoSway: 0, headBob: 0, footLift: 0.22, cycleFrames: 24 },
  Servo: { stepLength: 0.5, bob: 0.008, armSwing: 8, elbowSwing: 0, elbowBase: 6, lean: 0, duty: 0.7, torsoSway: 0, headBob: 0, footLift: 0.16, cycleFrames: 40 },
  Stomp: { stepLength: 0.8, bob: 0.03, armSwing: 12, elbowSwing: 0, elbowBase: 20, lean: 2, duty: 0.55, torsoSway: 0, headBob: 0, footLift: 0.3, cycleFrames: 30 },
  Patrol: { stepLength: 0.9, bob: 0.02, armSwing: 20, elbowSwing: 0, elbowBase: 14, lean: 0, duty: 0.58, torsoSway: 0, headBob: 0, footLift: 0.24, cycleFrames: 18 },
};
export const ROBOT_PROPORTIONS = Object.freeze({ head: 1.05, neck: 0.7, torso: 0.95, shoulderWidth: 1.15, limbGirth: 1.2, torsoGirth: 1.2, handSize: 1.1, footSize: 1.2 });
/** The four-armed alien: tall, thin and long-necked, with a big head, a gliding step and a second pair of arms. */
export const PRESETS_ALIEN = {
  Glide: { stepLength: 0.55, bob: 0.015, armSwing: 6, elbowSwing: 10, lean: 0, duty: 0.7, torsoSway: 0.6, footLift: 0.08, cycleFrames: 40 },
  Gangly: { stepLength: 0.8, bob: 0.06, armSwing: 36, elbowSwing: 22, lean: 3, duty: 0.6, torsoSway: 2, footLift: 0.16, cycleFrames: 30 },
  Skitter: { stepLength: 0.9, bob: 0.05, armSwing: 28, elbowSwing: 30, lean: 8, duty: 0.52, torsoSway: 1.5, footLift: 0.24, cycleFrames: 14 },
};
export const ALIEN_PROPORTIONS = Object.freeze({ head: 1.6, neck: 1.4, torso: 1.05, arm: 1.25, upperArm: 1, foreArm: 1.1, leg: 1.1, limbGirth: 0.7, torsoGirth: 0.8, handSize: 1.3 });
/** Body shapes: ready sets of proportions, over the figure's own starting ones. */
export const BODY_SHAPES = {
  Child: { head: 1.45, neck: 0.8, torso: 0.8, leg: 0.72, arm: 0.78, handSize: 1.15, footSize: 1.1, limbGirth: 1.1 },
  Giant: { leg: 1.35, arm: 1.3, torso: 1.2, head: 0.85, limbGirth: 1.25, torsoGirth: 1.25, footSize: 1.25 },
  Stocky: { leg: 0.85, torso: 0.92, shoulderWidth: 1.2, neck: 0.7, limbGirth: 1.4, torsoGirth: 1.4, hipWidth: 1.2, thighGirth: 1.15 },
  Heroic: { shoulderWidth: 1.4, torso: 1.1, waist: 0.8, chest: 1.3, leg: 1.12, head: 0.88, limbGirth: 1.15, chestGirth: 1.2, waistGirth: 0.85, shoulderSlope: 0.5 },
  Lanky: { leg: 1.3, arm: 1.3, torso: 0.92, neck: 1.4, limbGirth: 0.7, torsoGirth: 0.75, handSize: 1.25, footSize: 1.2 },
  'Big head': { head: 1.9, neck: 0.55, torso: 0.85, leg: 0.8, handSize: 1.4, footSize: 1.4, shoulderWidth: 0.85 },
  Lopsided: { armLeft: 1.3, handLeft: 1.6, shoulderSlope: 2.2, headWidth: 1.2 },
};
/** The proportions a figure starts with. */
export const propsFor = (fig) => (fig === 'hose' ? { ...HOSE_PROPORTIONS } : fig === 'robot' ? { ...ROBOT_PROPORTIONS } : fig === 'alien' ? { ...ALIEN_PROPORTIONS } : {});
export const HOSE_PROPORTIONS = Object.freeze({ head: 1.5, neck: 0.35, torso: 0.8, waist: 0.9, shoulderWidth: 0.8, arm: 1.15, handSize: 1.3, footSize: 1.35, limbGirth: 1 });
PRESETS_SPECIES.centaur = Object.fromEntries(['Walk', 'Trot', 'Canter', 'Gallop'].map((n) => [n, { ...PRESETS_SPECIES.horse[n], dogSpecies: 'centaur', dogNeckAngle: 76, dogHeadAngle: 78, dogHeadNod: 1, dogEar: 0 }])); // a horse's body and legs, with the trunk where the neck was
export const presetsForFigure = (fig) => (fig === 'human' ? PRESETS : fig === 'hose' ? PRESETS_HOSE : fig === 'robot' ? PRESETS_ROBOT : fig === 'alien' ? PRESETS_ALIEN : PRESETS_SPECIES[fig] || PRESETS_DOG);
export const presetsFor = (rig) => (rig === 'dog' ? PRESETS_DOG : PRESETS);
