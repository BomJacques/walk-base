# Walk Base parameters

Generated from `walkbase/src/controls.js`. Lengths are in leg lengths for the human and shoulder heights for the dog, unless noted. The Figure column says which figure shows the control.

## Gait

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Exposure | both |  | 1, 2, 3 | 1 | Frames each drawing is held. 2 is "on twos". |
| Camera | both |  | follow, across | follow | Follow keeps the figure in place while the ground scrolls. Across lets it cross the frame. |
| Cycle length | both | frames | 4 to 96 | 24 | Frames for two steps. 24 at 24 fps is one step every half second. |
| Frame rate | both | fps | 6 to 60 | 24 | Frames per second. Changing it changes the walking speed. |
| Step length | human | legs | 0.3 to 2.8 | 0.78 | Contact to contact, in leg lengths. Longer steps at the same timing walk faster. |
| Time on the ground | human |  | 0.25 to 0.85 | 0.6 | Fraction of the cycle each foot is down. Under 0.5 there is a moment with neither foot down: a run. Set Hip bob and Lowest point to match (the Run preset shows how). |
| Leg straightness | human |  | 0.85 to 0.999 | 0.985 | How straight the leg is at contact. Lower crouches the whole walk. |
| Feet width | human | legs | 0 to 0.6 | 0.075 | Distance of each foot from the centre line. |
| Toe out | human | ° | -30 to 80 | 8 | Feet turn outward. |
| Hip bob | human | legs | 0 to 0.6 | 0.075 | Vertical travel of the hips, lowest to highest. |
| Down position | human | cycle | 0.03 to 0.22 | 0.125 | When the body is lowest after contact. 0.125 is a quarter of a step. |
| Weight | human |  | -1 to 1 | 0 | How heavy the figure feels. Heavy (positive): longer on the ground, flatter and lower feet, a deeper drop into each step, shorter steps, less arm swing, a forward lean. Light (negative): springy, higher feet, quicker. Use a longer Cycle length for a heavy walk and a shorter one for a light walk. |
| Foot lift | human | legs | 0 to 1 | 0.16 | How high the swing foot clears the ground. |
| Foot is highest at | human | swing | 0.25 to 0.7 | 0.42 | Where in the swing the foot reaches its highest point. Early is a quick pick-up, late is a high step that stamps down. |
| Foot reaches forward early | human |  | 0 to 1 | 0.85 | 0 swings the foot at an even pace. 1 brings it forward early and lets it hang before it lands. |
| Heel strike | human | ° | 0 to 80 | 14 | Toe-up angle at contact. |
| Heel comes down over | human | stance | 0.04 to 0.4 | 0.18 | How much of the time on the ground the foot takes to roll from heel to flat. Small is a stamp, large is a slow roll. |
| Heel lifts at | human | stance | 0.35 to 0.85 | 0.52 | When in the time on the ground the heel starts to rise. Early is a long push off the toes, late is a flat-footed walk. |
| Toe off | human | ° | 0 to 120 | 32 | Heel-up angle at push-off. |
| Swing toe | human | ° | -40 to 80 | 8 | Toe angle while the foot swings through. |
| Far foot lands late | human | cycle | -0.24 to 0.24 | 0 | Moves the far foot off its half-cycle: the two steps become unequal, one short and one long. |
| Far foot time on ground | human |  | -0.3 to 0.3 | 0 | Added to the far foot only. Less is a leg that is hurried off the ground, as in a limp. |
| Far foot lift | human |  | -1.6 to 1.6 | 0 | The far foot lifts more (positive) or less (negative) than the near one. |
| Noise | human |  | 0 to 1 | 0 | Small wobble added to the bounce, sway, back, head and arms so the walk is not a metronome. 0 is none. |
| Noise speed | human |  | 1 to 4 | 2 | How quickly the wobble changes: 1 is slow, 4 is busy. |
| Noise seed | human |  | 1 to 999 | 7 | Which wobble you get. The same seed always gives the same take; change it to try another. |
| Keep the wobble looping | human |  | bool | true | On: the wobble repeats every cycle, so the loop stays seamless. Off: it carries on changing from cycle to cycle over a longer performance (the Loop button turns it back on). |
| Follow-through | human |  | 0 to 1.5 | 0.6 | Hands and swinging feet trail behind the arm or leg they are on and catch up after, so a limb flows instead of moving all at once. 0 is stiff. |
| Stretchy limbs | human |  | 0 to 1.5 | 0.5 | An arm that reaches, or a leg that swings out, stretches longer, up to half again at 1. 0 keeps every limb the same length. |
| Wobble | both |  | 0 to 1.5 | 0 | A wave runs along every arm, leg and tail and bends it like jelly. The hands and feet stay where they are; the limb between wobbles. 0 is off. |
| Wobbles per cycle | both |  | 1 to 4 | 2 | How many times each limb wobbles in one cycle. Whole numbers, so the cycle still loops. |
| Heading | both | ° | -180 to 180 | 0 | Which way the figure faces and walks. 0 is straight along the stage; a positive angle turns it toward you, a negative one away. Automate it on the Auto tab (or use Turn right, Turn left, U-turn and Walk a curve) to turn a corner or follow a curve. Footprints are hidden while the path bends. |
| Ground | both |  | flat, slope, steps | flat | What the figure walks on. A slope or a flight of steps makes the walk four cycles long so there is room to climb; the hips rise, each foot stands on the ground where it lands, and the swinging foot clears the next step. |
| Slope | both | ° | -30 to 30 | 8 | How steeply the ground rises along the slope (negative goes downhill). |
| Step height | both | legs | -0.6 to 0.6 | 0.14 | Height of each step, in leg lengths (negative goes down). |
| Step length | both | legs | 0.3 to 2.5 | 1 | Length of the flat top of each step. |
| Forward lean | human | ° | -30 to 60 | 4 | Torso tilt. Negative leans back. |
| Lean to the side | human | ° | -20 to 20 | 0 | The body leans to one side all the time: positive toward the near side, negative toward the far side. The head stays nearly upright. |
| Chest out or slouch | human | ° | -30 to 30 | 0 | Positive arches the back and brings the chest out, with the head held level. Negative slouches: the back rounds forward and the head comes forward with it. |
| Torso rock | human | ° | 0 to 20 | 1.6 | Extra tilt that rocks with each step. |
| Carrying a load | human |  | -1 to 1 | 0 | A heavy bag in one hand: positive in the near hand, negative in the far hand. That arm hangs straight and still, the body leans away to balance it and the other arm comes out. |
| Hip twist | human | ° | 0 to 50 | 6 | How far the hips turn each way. The right hip leads at contact. |
| Hip drop | human | ° | 0 to 30 | 3 | The swing-side hip drops this much. |
| Hip tilt | human | ° | 0 to 30 | 1.5 | Forward and back rock of the pelvis. |
| Side sway | human | legs | 0 to 0.24 | 0.03 | Hips shift over the supporting foot. |
| Knees out | human | ° | -30 to 60 | 3 | Knee direction away from straight ahead. |
| Arm swing | human | ° | 0 to 120 | 26 | Each way, opposite the legs. |
| Far arm swing | human |  | -1.6 to 1.6 | 0 | The far arm swings more or less than the near one. |
| Arms forward or back | human | ° | -60 to 90 | 0 | Where the arms swing about: positive carries both arms forward of where they hang, negative behind the body. |
| Arms out | human | ° | -20 to 80 | 4 | How far the arms hang from the body. |
| Arm lag | human | cycle | -0.4 to 0.6 | 0.07 | How far the arms trail the legs. A little drag reads as natural. |
| Elbow bend | human | ° | 0 to 160 | 14 | Resting bend. |
| Elbow bend, forward | human | ° | 0 to 160 | 26 | Extra bend as the arm swings forward. |
| Shoulder counter-twist | human | ° | 0 to 60 | 9 | Shoulders turn against the hips. |
| Head steadiness | human |  | 0 to 1 | 0.35 | 0 lets the head ride the hips, 1 holds it level. |
| Head keeps facing | human |  | 0 to 1 | 0.8 | How much the head cancels the twist and tilt of the body below it. |
| Look down or up | human | ° | -40 to 40 | 0 | The head held looking down (positive) or up (negative). |
| Head turned | human | ° | -90 to 90 | 0 | The head held turned to one side: positive toward the near side. |
| Head nod | human | ° | 0 to 24 | 2.5 | Small nod with each step. |
| Hip width | human | × | 0.3 to 3.24 | 1 | Scale of the distance between the hips. |
| Shoulder width | human | × | 0.3 to 3.24 | 1 | Scale of the distance between the shoulders. |
| Torso length | human | × | 0.36 to 2.7 | 1 | Scale of the spine. |
| Arm length | human | × | 0.36 to 2.7 | 1 | Scale of both arms. |
| Neck length | human | × | 0.18 to 4.5 | 1 | Scale of the neck. |
| Head size | human | × | 0.36 to 3.96 | 1 | Scale of the head. |
| Waist length | human | × | 0.3 to 3.24 | 1 | Scale of the lower spine, between the hips and the ribs. |
| Chest length | human | × | 0.3 to 3.24 | 1 | Scale of the upper spine, from the ribs to the shoulders. |
| Upper arm length | human | × | 0.36 to 2.88 | 1 | Scale of the upper arm only, on top of Arm length. |
| Forearm length | human | × | 0.36 to 2.88 | 1 | Scale of the forearm only, on top of Arm length. |
| Hand size | human | × | 0.3 to 4.5 | 1 | Scale of the hand, in length and in the drawing. |
| Upper leg share | human | × | 0.45 to 2.25 | 1 | How much of the leg is thigh and how much is shin. The leg stays the same total length, so the walk does not change. |
| Foot size | human | × | 0.36 to 3.6 | 1 | Scale of the drawn foot. Large for a clown shoe, small for a dancer. |
| Limb thickness | human | × | 0.3 to 3.96 | 1 | Thickness of the arms and legs in the drawing. |
| Body thickness | human | × | 0.36 to 3.24 | 1 | Thickness of the hips, waist, chest and neck in the drawing. |
| Gait | dog |  | walk, trot, pace, gallop, run, hop | walk | Which paws move together. Walk is four beats, trot pairs diagonal paws, pace pairs the paws on one side. Gallop lands the hind paws, then the front paws, with the body in the air and the legs tucked under it in between. |
| Stride | dog | heights | 0.1 to 10 | 0.95 | Ground covered in one cycle, in shoulder heights. Longer strides at the same timing run faster. |
| Time on the ground | dog |  | 0.15 to 0.85 | 0.68 | Fraction of the cycle each paw is down. |
| Paw lift | dog | heights | 0 to 1 | 0.13 | How high the swinging paw clears the ground. |
| Left paws land late | dog | cycle | -0.24 to 0.24 | 0 | Moves the left paws off their place in the beat, so the steps on the two sides are unequal. |
| Left paws time on ground | dog |  | -0.3 to 0.3 | 0 | Added to the left paws only. Less is a leg that is hurried off the ground, as when it hurts. |
| Left paws lift | dog |  | -1.6 to 1.6 | 0 | The left paws lift more (positive) or less (negative) than the right. |
| Paws width | dog | heights | 0 to 0.6 | 0.11 | Distance of each paw from the centre line. |
| Elbows and knees out | dog | ° | -30 to 60 | 3 | Direction the elbows and knees point away from straight ahead. |
| Body bounce | dog | heights | 0 to 0.6 | 0.03 | Up and down travel of the hips. |
| Spine bend | dog | ° | 0 to 50 | 6 | Side to side bend of the spine as the dog walks. |
| Back arch | dog | ° | 0 to 24 | 2 | How much the back arches and dips with each footfall. |
| Squash and stretch | dog | ° | 0 to 60 | 14 | Gallop and run only: the back humps up when the legs gather under the body and stretches out when they reach. A run does it once every step. |
| Torso twist | dog | ° | 0 to 40 | 6 | How far the shoulders and hips roll against each other along the spine. The shoulder on the side whose paw lands drops. |
| Shoulder blade | dog | heights | 0 to 0.3 | 0.05 | How far each shoulder blade drops and slides forward as its front paw lands. |
| Chest raise | dog | ° | -20 to 140 | 0 | Two-legged figures only: how far the chest is raised above level. A theropod is nearly level, a bird is tipped up. |
| Head hold | dog |  | 0 to 1 | 0 | A bird keeps its head still in space while the body moves under it, then thrusts it forward. 0 is off, 1 is fully held. |
| Arm swing | dog | heights | 0 to 0.3 | 0.02 | Theropod: how far the small arms swing against the legs. |
| Wings open | dog |  | 0 to 1 | 0 | Bird: 0 folds the wings against the body, 1 spreads them. |
| Wing beat | dog | ° | 0 to 140 | 0 | Bird: how far each wing beats up and down. Open the wings first. |
| In flight | dog |  | 0 to 1 | 0 | Bird: 0 stands on the ground, 1 flies. In flight the feet tuck up under the tail and the body rises on each down-stroke. Open the wings and set a wing beat. |
| Flight height | dog | heights | 0 to 6 | 1.1 | Bird: how far above the ground the body flies. |
| Frames per wing beat | dog | frames | 0 to 60 | 0 | Bird: how many frames one wing beat takes, on its own clock, so the wings keep beating when the walk slows or stops. 0 ties the beat to the walk cycle (Beats per cycle). |
| Beats per cycle | dog |  | 1 to 6 | 1 | Bird: wing beats in one cycle. |
| Neck segments | dog |  | 1 to 12 | 1 | How many bones the neck is made of. A long neck, such as a sauropod's, needs several to bend along its length. |
| Neck curve | dog | ° | -180 to 180 | 0 | How much the neck bends over its whole length: positive droops at the top like a swan, negative arches back. Needs two or more segments. |
| Neck wave, nodding | dog | ° | 0 to 40 | 0 | Each bone nods a little after the one below it, so a wave runs up the neck as the animal walks. |
| Neck wave, sideways | dog | ° | 0 to 40 | 0 | Each bone swings from side to side after the one below it, so the neck snakes as the animal walks. |
| Neck raise | dog | ° | 0 to 180 | 52 | How steeply the neck rises from the back. |
| Head tip | dog | ° | -40 to 160 | 34 | How far the head tips down from the neck. |
| Head nod | dog | ° | 0 to 30 | 3 | Small nod with each footfall. |
| Tail carry | dog | ° | -120 to 180 | 28 | How far above the back the tail is held. |
| Tail wag | dog | ° | 0 to 120 | 22 | How far the tail swings each way. Use Repeats on the tail channels for a faster wag. |
| Ear bounce | dog | ° | 0 to 60 | 7 | How much the ears flop. |
| Body length | dog | × | 0.42 to 2.52 | 1 | Scale of the back. |
| Leg length | dog | × | 0.42 to 2.52 | 1 | Scale of all four legs. |
| Neck length | dog | × | 0.3 to 3.24 | 1 | Scale of the neck. |
| Head size | dog | × | 0.36 to 3.24 | 1 | Scale of the head and snout. |
| Tail length | dog | × | 0.18 to 4.5 | 1 | Scale of the tail. |
| Ear length | dog | × | 0.24 to 4.5 | 1 | Scale of the ears. |

## Speech

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Look at | both |  | body, head | body | Body keeps the whole figure in view. Head fills the stage with the face. Drag to turn the head around, pinch or scroll to zoom in and out, two fingers to move it. |
| Head size | both | × | 3 to 14 | 4.6 | How large the head is when the view is on the head. |
| Eye style | both |  | default, dots, round, pie, almond, closed | default | Default is each figure's own eyes (the Eyes setting of the rubber hose figure, dots on the mannequin). Round is a white eye with a pupil, Pie has a wedge cut out of the pupil, Almond has pointed corners and a coloured iris, Closed is a happy curve. The other eye settings need a style other than Default. |
| Eye size | both | × | 0.4 to 2.2 | 1 | How big the eyes are. |
| Eye spacing | both | × | 0.4 to 1.8 | 1 | How far apart the eyes are. |
| Eye height | both |  | -0.5 to 0.5 | 0 | Up or down on the head, in head radii. |
| Look across | both |  | -1 to 1 | 0 | Where the pupils point, side to side. |
| Look up or down | both |  | -1 to 1 | 0 | Where the pupils point, up (positive) or down. |
| Eyelids | both |  | 0 to 1 | 0 | How far the lids are down: 0 wide open, 0.5 sleepy, 1 shut. |
| Blinks per cycle | both |  | 0 to 4 | 0 | The eyes blink this many times in each cycle. Whole numbers, so the cycle still loops. 0 is no blinking. |
| Eye colour | both |  | color | #111111 | The pupil, or the iris of an almond eye. |
| Eyebrows | both |  | none, line, thick, arched | none | A line over each eye, in the line colour. |
| Raise | both |  | -1 to 1 | 0 | Up for surprise, down toward the eyes for a scowl. |
| Furrow | both |  | -1 to 1 | 0 | Positive pulls the inner ends down (angry). Negative lifts them (worried, sad). |
| Show the mouth | both |  | when speaking, always | when speaking | The mannequin has a mouth only while it speaks, unless this is Always. The rubber hose figure always has one. |
| Mouth style | both |  | full, line, curve, cartoon | full | Full has lips, teeth and a tongue. Line has no lips. Curve is a plain line that opens to a plain dark shape. Cartoon is a bold opening with a row of teeth and a tongue. |
| Mouth width | both | × | 0.5 to 1.8 | 1 | How wide the mouth is. |
| Lip thickness | both | × | 0 to 2.5 | 1 | How thick the lips are, in the Full style. 0 is none. |
| Smile | both |  | -1 to 1 | 0 | Positive lifts the corners of the mouth into a smile; negative drops them into a frown. It carries through every mouth shape of the speech. |
| Lip colour | both |  | color | #d98c8c | The lips, in the Full style. |
| Teeth colour | both |  | color | #ffffff | The teeth. |
| Tongue colour | both |  | color | #d9786f | The tongue. |
| Inside colour | both |  | color | #5b2c2c | The dark of the open mouth. |
| Mouth shape label | both |  | bool | true | Names the current mouth shape and the sounds it stands for, in the top corner. |

## View

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Turn | both | ° | -180 to 180 | 0 | Orbit left and right. 0 is the side view, −90 the front, 90 the back. Drag the stage to orbit. |
| Height | both | ° | -85 to 85 | 0 | Look from above (positive) or below. 85 is nearly a top view. |
| Turntable | both |  | bool | false | Slowly circles the figure while it plays. |
| Turntable speed | both | °/s | -120 to 120 | 24 | Degrees per second. Negative circles the other way. |
| Axes gizmo | both |  | bool | true | Small x, y, z guide: x forward, y up, z the figure right side. |
| Selection colour | both |  | color | #e0662e | Highlight for the selected part. |
| Style | both |  | mannequin, outline, stick, silhouette, moebius, comic, ink, pencil | mannequin | Comic is flat colour inside a heavy black line with printed dots for the shadow. Ink is a rough brush line that swells and thins, with flat colour. Pencil is a sketch: a pale wash, light hatching and the outline gone over three times. The light direction and shadow reach in the Moebius style group set the shading of Comic and Pencil too. Moebius is a pen drawing: a thin ink line round the figure, flat soft colour, and shading by fine hatching, cross-hatching and a few dots on the side away from the light, on a paper-coloured stage. Mannequin is outlined limbs. Outline is only the outer edge of the figure, arms included, with no lines crossing inside. Stick is joints and bones. Silhouette is one solid shape. |
| Line width | both | px | 0.5 to 12 | 3 | At 1080 pixels tall. It scales with the canvas. |
| Hands | both |  | default, mitten, fist, fingers, pointing | default | Default is each figure's own hand: a ball on the mannequin, a round glove on the rubber hose figure. Mitten has a thumb, Fist is closed, Fingers is an open hand and Pointing holds one finger out. Hand size is in the body proportions. |
| Feet | both |  | default, boot, bare, round | default | Default is each figure's own foot: a shoe on the mannequin, a round foot on the rubber hose figure. Boot adds a shaft up the shin, Bare is a low foot with toes, Round is the rubber hose foot. Foot size is in the body proportions. |
| Limb thickness | both | × | 0.5 to 2 | 1 | How thick the tube arms and legs are. |
| Limb curve | both |  | 0 to 1 | 1 | 1 bends each limb in one smooth curve, with no elbow or knee. 0 bends it sharply at the joint. |
| Squash and stretch | both |  | 0 to 2 | 1 | At the bottom of the bounce the body squashes down and swells; at the top it stretches up and thins, legs and arms with it. 1 is clear, 2 is cartoon. |
| Body under pictures | both |  | hide covered parts, hide the model, show the model | hide covered parts | What the body does once a picture is attached. Parts a picture sits on are left out by default, so the picture is not drawn over the mannequin. |
| Limb taper | both |  | -1 to 1 | 0 | Positive makes each limb thicker where it joins the body and thinner at the hand or foot. Negative is the other way: thin at the body, thick at the end. |
| Belly | both | × | 0.6 to 1.8 | 1 | How round the middle of the body is. |
| Tail | both |  | 0 to 1.5 | 0 | A thin tail that swings and wobbles behind the figure. 0 is none. |
| Ears | both |  | none, round | none | Round ears on top of the head. Off by default. |
| Eyes | both |  | pie, round, dots | pie | Pie eyes have a wedge cut out of the pupil. Round eyes are plain pupils. Dots are black dots. |
| Light direction | both | ° | -180 to 180 | -135 | Where the light comes from, as an angle on the screen. -135 is the top left; the hatching goes on the other side of each form. |
| Hatch angle | both | ° | 0 to 180 | 50 | The angle of the hatching lines. |
| Hatch spacing | both | px | 2 to 14 | 4.5 | The gap between hatching lines. Smaller is darker and finer. |
| Shadow reach | both |  | 0 to 1 | 0.5 | How far the shadow reaches round each form. 0 is none, 1 is nearly all of it. |
| Stipple | both |  | 0 to 1 | 0.4 | Dots along the edge of the shadow, for texture. |
| Paper-coloured stage | both |  | bool | true | In the Moebius style the stage is the colour of paper instead of the background colour. |
| Body colour | both |  | color | #2d2a2e | The head, body, arms and legs. |
| Face colour | both |  | color | #fff8e8 | The face patch on the head. |
| Glove colour | both |  | color | #ffffff | The hands. |
| Foot colour | both |  | color | #ffffff | The feet. White by default, like the gloves. |
| Shorts colour | both |  | color | #2d2a2e | The hips. The same as the body by default, so the figure is one colour. |
| Line colour | both |  | color | #26231f | Outline and silhouette colour. |
| Fill colour | both |  | color | #f6f1e7 | Mannequin fill. |
| Fill opacity | both |  | 0 to 1 | 0.55 | Lower it to trace through the body. |
| Far-side tint | both |  | color | #8fa3bf | The far arm and leg use this tint, so near and far read apart. |
| Far-side opacity | both |  | 0 to 1 | 0.85 | Strength of the far-side tint. |
| Figure size | both |  | 0.2 to 0.95 | 0.62 | Height of the figure as a fraction of the canvas. |
| Ground height | both |  | 0.4 to 0.98 | 0.8 | Ground line position, top to bottom. |
| Figure position | both |  | -0.4 to 0.4 | 0 | Left or right of centre, as a fraction of the width. |
| Background colour | both |  | color | #ffffff | Preview and solid exports. |
| Ground line and ticks | both |  | bool | true | Ticks stay on the ground, so a sliding foot shows. |
| Footprints | both |  | bool | true | Where each foot plants. |
| Show the scene | both |  | bool | true | The other figures and the scenery. Off draws the main figure alone. |
| Motion arcs | both |  | bool | false | Paths of the points you tick below through the cycle. Drag a dot to reshape the movement. |
| Frame dots | both |  | bool | true | One dot on the path for every frame, so the spacing shows speed and ease. Drag a dot to bend the path there. |
| Onion skin | both |  | bool | false | Neighbouring drawings, tinted. |
| Drawings before | both |  | 0 to 6 | 2 | Preceding drawings. |
| Drawings after | both |  | 0 to 6 | 2 | Following drawings. |
| Onion opacity | both |  | 0.05 to 1 | 0.35 | Nearest neighbour. Further ones fade. |
| Before tint | both |  | color | #d0342c | Colour of earlier drawings. |
| After tint | both |  | color | #1f7a3d | Colour of later drawings. |
| Guide colour | both |  | color | #e0662e | Ground, arcs and labels. |

## Export

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Width | both | px | 64 to 4096 | 1920 | Even numbers, so video encodes. |
| Height | both | px | 64 to 4096 | 1080 | Even numbers, so video encodes. |
| Orbit while exporting | both | ° | 0 to 720 | 0 | Turns the camera this far over the whole export, for a turntable. 360 is one full circle. |
| Cycles | both |  | 1 to 8 | 1 | How many times the cycle repeats in the export. |
| Format | both |  | png-zip, mp4 | png-zip | PNG frames in a ZIP are lossless. MP4 is offered only where this browser can encode it. |
| Timing | both |  | expanded, unique | expanded | Expanded: one file per frame. Unique: one file per drawing, with an exposure list. |
| Layers | both |  | composite, split | composite | Split writes far limbs, body and near limbs as separate transparent layers. |
| Background | both |  | solid, transparent | solid | Transparent applies to PNG only. |
| Include guides | both |  | bool | false | Ground, arcs, onion skin and labels. Off by default so exports are clean. |
| Import recipe | both |  | procreate, dreams, other | procreate | Picks the import notes that go in the ZIP. |
| Frame digits | both |  | 2 to 8 | 4 | Zero padding, so names sort in frame order. |
| Video bitrate | both | Mbps | 1 to 80 | 12 | MP4 only. |
