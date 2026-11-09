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
export const TABS = ['Gait', 'Parts', 'Attach', 'Auto', 'Speech', 'View', 'Sampler', 'Export'];

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
  n('p', 'hoseFollow', 'Gait', 'Rubber hose', 'Follow-through', '', 0, 1.5, 0.05, 'Hands and swinging feet trail behind the arm or leg they are on and catch up after, so a limb flows instead of moving all at once. 0 is stiff.'),
  n('p', 'hoseStretch', 'Gait', 'Rubber hose', 'Stretchy limbs', '', 0, 1.5, 0.05, 'An arm that reaches, or a leg that swings out, stretches longer, up to half again at 1. 0 keeps every limb the same length.'),
  n('p', 'heading', 'Gait', 'Direction', 'Heading', '°', -180, 180, 1, 'Which way the figure faces and walks. 0 is straight along the stage; a positive angle turns it toward you, a negative one away. Automate it on the Auto tab (or use Turn right, Turn left, U-turn and Walk a curve) to turn a corner or follow a curve. Footprints are hidden while the path bends.'),
  e('p', 'terrain', 'Gait', 'Ground', 'Ground', ['flat', 'slope', 'steps'], 'What the figure walks on. A slope or a flight of steps makes the walk four cycles long so there is room to climb; the hips rise, each foot stands on the ground where it lands, and the swinging foot clears the next step.'),
  n('p', 'terrainGrade', 'Gait', 'Ground', 'Slope', '°', -30, 30, 0.5, 'How steeply the ground rises along the slope (negative goes downhill).'),
  n('p', 'terrainRise', 'Gait', 'Ground', 'Step height', 'legs', -0.3, 0.3, 0.005, 'Height of each step, in leg lengths (negative goes down).'),
  n('p', 'terrainRun', 'Gait', 'Ground', 'Step length', 'legs', 0.3, 2.5, 0.05, 'Length of the flat top of each step.'),
  n('p', 'asymArm', 'Gait', 'Left and right', 'Far arm swing', '', -0.8, 0.8, 0.01, 'The far arm swings more or less than the near one.'),
  // Body
  n('p', 'lean', 'Body', 'Torso', 'Forward lean', '°', -15, 30, 0.5, 'Torso tilt. Negative leans back.'),
  n('p', 'torsoSway', 'Body', 'Torso', 'Torso rock', '°', 0, 10, 0.1, 'Extra tilt that rocks with each step.'),
  n('p', 'headBob', 'Body', 'Head', 'Head steadiness', '', 0, 1, 0.01, '0 lets the head ride the hips, 1 holds it level.'),
  n('p', 'headNod', 'Body', 'Head', 'Head nod', '°', 0, 12, 0.1, 'Small nod with each step.'),
  n('p', 'armSwing', 'Body', 'Arms', 'Arm swing', '°', 0, 60, 1, 'Each way, opposite the legs.'),
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
  n('r', 'thighShare', 'Body', 'Proportions', 'Upper leg share', '×', 0.75, 1.25, 0.01, 'How much of the leg is thigh and how much is shin. The leg stays the same total length, so the walk does not change.'),
  n('r', 'footSize', 'Body', 'Proportions', 'Foot size', '×', 0.6, 2, 0.01, 'Scale of the drawn foot. Large for a clown shoe, small for a dancer.'),
  n('r', 'limbGirth', 'Body', 'Proportions', 'Limb thickness', '×', 0.5, 2.2, 0.01, 'Thickness of the arms and legs in the drawing.'),
  n('r', 'torsoGirth', 'Body', 'Proportions', 'Body thickness', '×', 0.6, 1.8, 0.01, 'Thickness of the hips, waist, chest and neck in the drawing.'),
  // Dog (shown when the figure is the dog). Units are shoulder heights.
  e('p', 'dogGait', 'Gait', 'Dog gait', 'Gait', ['walk', 'trot', 'pace', 'gallop', 'run', 'hop'], 'Which paws move together. Walk is four beats, trot pairs diagonal paws, pace pairs the paws on one side. Gallop lands the hind paws, then the front paws, with the body in the air and the legs tucked under it in between.'),
  n('p', 'dogStride', 'Gait', 'Dog stride', 'Stride', 'heights', 0.1, 5, 0.01, 'Ground covered in one cycle, in shoulder heights. Longer strides at the same timing run faster.'),
  n('p', 'dogDuty', 'Gait', 'Dog stride', 'Time on the ground', '', 0.15, 0.85, 0.01, 'Fraction of the cycle each paw is down.'),
  n('p', 'dogLift', 'Gait', 'Dog paws', 'Paw lift', 'heights', 0, 0.5, 0.005, 'How high the swinging paw clears the ground.'),
  n('p', 'dogAsymTiming', 'Gait', 'Dog left and right', 'Left paws land late', 'cycle', -0.12, 0.12, 0.005, 'Moves the left paws off their place in the beat, so the steps on the two sides are unequal.'),
  n('p', 'dogAsymDuty', 'Gait', 'Dog left and right', 'Left paws time on ground', '', -0.15, 0.15, 0.005, 'Added to the left paws only. Less is a leg that is hurried off the ground, as when it hurts.'),
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
  n('r', 'dTail', 'Body', 'Dog proportions', 'Tail length', '×', 0.3, 2.5, 0.01, 'Scale of the tail.'),
  n('r', 'dEar', 'Body', 'Dog proportions', 'Ear length', '×', 0.4, 2.5, 0.01, 'Scale of the ears.'),
  // View
  n('s', 'camYaw', 'View', 'Pivot around the figure', 'Turn', '°', -180, 180, 1, 'Orbit left and right. 0 is the side view, −90 the front, 90 the back. Drag the stage to orbit.'),
  n('s', 'camPitch', 'View', 'Pivot around the figure', 'Height', '°', -85, 85, 1, 'Look from above (positive) or below. 85 is nearly a top view.'),
  b('s', 'autoOrbit', 'View', 'Pivot around the figure', 'Turntable', 'Slowly circles the figure while it plays.'),
  n('s', 'orbitSpeed', 'View', 'Pivot around the figure', 'Turntable speed', '°/s', -120, 120, 1, 'Degrees per second. Negative circles the other way.'),
  b('s', 'showGizmo', 'View', 'Pivot around the figure', 'Axes gizmo', 'Small x, y, z guide: x forward, y up, z the figure right side.'),
  c('s', 'selectColor', 'View', 'Pivot around the figure', 'Selection colour', 'Highlight for the selected part.'),
  // Look
  e('s', 'style', 'Look', 'Figure', 'Style', ['mannequin', 'outline', 'stick', 'silhouette'], 'Mannequin is outlined limbs. Outline is only the outer edge of the figure, arms included, with no lines crossing inside. Stick is joints and bones. Silhouette is one solid shape.'),
  n('s', 'lineWidth', 'Look', 'Figure', 'Line width', 'px', 0.5, 12, 0.25, 'At 1080 pixels tall. It scales with the canvas.'),
  n('s', 'hoseLimb', 'Look', 'Rubber hose', 'Limb thickness', '×', 0.5, 2, 0.01, 'How thick the tube arms and legs are.'),
  n('s', 'hoseBend', 'Look', 'Rubber hose', 'Limb curve', '', 0, 1, 0.01, '1 bends each limb in one smooth curve, with no elbow or knee. 0 bends it sharply at the joint.'),
  n('s', 'hoseSquash', 'Look', 'Rubber hose', 'Squash and stretch', '', 0, 2, 0.05, 'At the bottom of the bounce the body squashes down and swells; at the top it stretches up and thins, legs and arms with it. 1 is clear, 2 is cartoon.'),
  e('s', 'pictureModel', 'Look', 'Pictures', 'Body under pictures', ['hide covered parts', 'hide the model', 'show the model'], 'What the body does once a picture is attached. Parts a picture sits on are left out by default, so the picture is not drawn over the mannequin.'),
  e('s', 'hoseEars', 'Look', 'Rubber hose', 'Ears', ['none', 'round'], 'Round ears on top of the head. Off by default.'),
  e('s', 'hoseEyes', 'Look', 'Rubber hose', 'Eyes', ['pie', 'round', 'dots'], 'Pie eyes have a wedge cut out of the pupil. Round eyes are plain pupils. Dots are black dots.'),
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
  b('s', 'showMouthLabel', 'Speech', 'Head view', 'Mouth shape label', 'Names the current mouth shape and the sounds it stands for, in the top corner.'),
  b('s', 'showScene', 'Guides', 'Scene', 'Show the scene', 'The other figures and the scenery. Off draws the main figure alone.'),
  b('s', 'showFootLabels', 'Guides', 'Poses', 'Foot labels', 'Names the ankle, heel, ball and toe on the near foot.'),
  b('s', 'showArcs', 'Guides', 'Arcs', 'Motion arcs', 'Paths of the points you tick below through the cycle. Drag a dot to reshape the movement.'),
  b('s', 'arcDots', 'Guides', 'Arcs', 'Frame dots', 'One dot on the path for every frame, so the spacing shows speed and ease. Drag a dot to bend the path there.'),
  b('s', 'showLabels', 'Guides', 'Poses', 'Pose labels', 'Names CONTACT, DOWN, PASSING and UP on the frames where they fall.'),
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
export const CONTROLS = RAW_CONTROLS.map((c) => (c.tab === 'Body' ? { ...c, tab: 'Gait', area: 'Body' } : c.tab === 'Look' || c.tab === 'Guides' ? { ...c, tab: 'View', area: c.tab } : { ...c, area: c.tab }));

/** Which figure a control belongs to: 'both', 'human' or 'dog'. Timing, camera, look, guides and export are shared. */
const SHARED_P = new Set(['cycleFrames', 'fps', 'exposure', 'travel', 'terrain', 'terrainGrade', 'terrainRise', 'terrainRun', 'heading']);
export const rigOf = (c) => (c.scope === 'p' || c.scope === 'r' ? (SHARED_P.has(c.id) ? 'both' : c.id.startsWith('dog') || (c.scope === 'r' && c.id.length > 1 && c.id[0] === 'd' && c.id[1] === c.id[1].toUpperCase()) ? 'dog' : 'human') : 'both');
export const shownFor = (c, rig) => rigOf(c) === 'both' || rigOf(c) === rig;

export const DEFAULT_OF = (c) => (c.scope === 'r' ? 1 : ({ p: DEFAULTS, s: STYLE_DEFAULTS, x: EXPORT_DEFAULTS })[c.scope][c.id]);

export const PRESETS = {
  Normal: {},
  Casual: { stepLength: 0.7, bob: 0.06, armSwing: 18, lean: 2, footLift: 0.12, duty: 0.62, torsoSway: 1.2 },
  Confident: { stepLength: 0.86, bob: 0.1, armSwing: 32, lean: 0, torsoSway: 2.4, headBob: 0.6, duty: 0.58, footLift: 0.18, elbowSwing: 34 },
  Brisk: { stepLength: 0.95, bob: 0.09, duty: 0.56, armSwing: 34, lean: 6, cycleFrames: 16, footLift: 0.2, elbowBase: 40, elbowSwing: 30 },
  Heavy: { stepLength: 0.66, bob: 0.13, duty: 0.64, footLift: 0.09, lean: 6, armSwing: 14, elbowBase: 20, headNod: 3.5, cycleFrames: 32, heelStrike: 18, torsoSway: 3 },
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
  Waddle: { stepLength: 0.5, duty: 0.64, bob: 0.06, pelvisRoll: 9, sway: 0.07, torsoSway: 5, toeOut: 22, stepWidth: 0.12, armSwing: 10, armOut: 14, lean: 2, cycleFrames: 34, headNod: 4 },
  Tired: { stepLength: 0.5, bob: 0.05, footLift: 0.05, lean: 11, armSwing: 8, duty: 0.68, cycleFrames: 32, headNod: 4, headBob: 0, heelStrike: 6, toeOff: 20, legExtend: 0.95 },
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
  ceratopsian: {
    Walk: sp('ceratopsian', { dogGait: 'walk', dogStride: 1.1, dogDuty: 0.7, dogLift: 0.1, dogBob: 0.014, dogFlex: 2, dogArch: 1, dogTwist: 3, dogShoulder: 0.04, dogWidth: 0.13, dogElbowOut: 6, dogNeckAngle: 8, dogHeadAngle: 34, dogHeadNod: 3, dogTailAngle: -4, dogWag: 8, cycleFrames: 32 }),
    Charge: sp('ceratopsian', { dogGait: 'trot', dogStride: 2.0, dogDuty: 0.46, dogLift: 0.2, dogBob: 0.05, dogFlex: 1, dogArch: 2, dogTwist: 2, dogShoulder: 0.05, dogWidth: 0.12, dogElbowOut: 3, dogNeckAngle: 4, dogHeadAngle: 48, dogHeadNod: 3, dogTailAngle: -2, dogWag: 5, cycleFrames: 18 }),
  },
};
/** The presets for one figure: 'human', 'dog', or a species name. */
/** The rubber hose figure: bouncy, on twos, with a lot of arm swing and bob. */
export const PRESETS_HOSE = {
  Bouncy: { stepLength: 0.72, bob: 0.16, duty: 0.56, armSwing: 46, elbowBase: 4, elbowSwing: 10, footLift: 0.26, cycleFrames: 12, exposure: 2, lean: 3, torsoSway: 4, headNod: 5, headBob: 0.1, pelvisRoll: 6, sway: 0.05, heelStrike: 8, toeOff: 40, toeOut: 14, liftPeak: 0.4, swingReach: 0.7 },
  Strut: { stepLength: 0.7, bob: 0.12, duty: 0.58, armSwing: 40, elbowBase: 6, elbowSwing: 12, footLift: 0.2, cycleFrames: 16, exposure: 2, lean: -3, torsoSway: 3, headNod: 4, headBob: 0.4, pelvisRoll: 9, pelvisYaw: 12, sway: 0.07, heelStrike: 12, toeOut: 16 },
  Sneak: { stepLength: 0.45, bob: 0.06, duty: 0.7, armSwing: 8, elbowBase: 30, elbowSwing: 10, footLift: 0.2, cycleFrames: 32, exposure: 2, lean: 14, torsoSway: 1, headNod: 3, headBob: 0.6, heelStrike: 0, toeOff: 45, legExtend: 0.9, heelDown: 0.1, heelUp: 0.35 },
  Skip: { stepLength: 0.85, bob: 0.2, duty: 0.52, armSwing: 55, elbowBase: 20, elbowSwing: 20, footLift: 0.36, cycleFrames: 14, exposure: 2, lean: 2, torsoSway: 5, headNod: 6, headBob: 0, pelvisRoll: 5, heelStrike: 6, toeOff: 45, liftPeak: 0.35, swingReach: 0.6 },
  Stomp: { stepLength: 0.66, bob: 0.11, duty: 0.6, armSwing: 28, elbowBase: 40, elbowSwing: 14, footLift: 0.24, cycleFrames: 18, exposure: 2, lean: 6, torsoSway: 3, headNod: 5, heelStrike: 28, heelDown: 0.07, liftPeak: 0.3, swingReach: 0.95, legExtend: 0.985, toeOut: 10 },
  Tired: { stepLength: 0.5, bob: 0.07, duty: 0.66, armSwing: 14, elbowBase: 8, elbowSwing: 6, footLift: 0.07, cycleFrames: 32, exposure: 2, lean: 14, torsoSway: 3, headNod: 6, headBob: 0, heelStrike: 4, toeOff: 18, legExtend: 0.94, toeOut: 20 },
  Run: { stepLength: 0.95, duty: 0.4, footLift: 0.3, bob: 0.14, downPhase: 0.17, lean: 8, legExtend: 0.93, cycleFrames: 12, exposure: 2, armSwing: 60, elbowBase: 20, elbowSwing: 10, torsoSway: 3 },
};
/** The proportions the rubber hose figure starts with: a big head, a short body, long thin limbs. */
export const HOSE_PROPORTIONS = Object.freeze({ head: 1.5, neck: 0.35, torso: 0.8, waist: 0.9, shoulderWidth: 0.8, arm: 1.15, handSize: 1.3, footSize: 1.35, limbGirth: 1 });
export const presetsForFigure = (fig) => (fig === 'human' ? PRESETS : fig === 'hose' ? PRESETS_HOSE : PRESETS_SPECIES[fig] || PRESETS_DOG);
export const presetsFor = (rig) => (rig === 'dog' ? PRESETS_DOG : PRESETS);
