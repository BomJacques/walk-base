# Walk Base parameters

Generated from `walkbase/src/controls.js`. Lengths are in leg lengths for the human and shoulder heights for the dog, unless noted. The Figure column says which figure shows the control.

## Gait

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Exposure | both |  | 1, 2, 3 | 1 | Frames each drawing is held. 2 is "on twos". |
| Camera | both |  | follow, across | follow | Follow keeps the figure in place while the ground scrolls. Across lets it cross the frame. |
| Cycle length | both | frames | 4 to 96 | 24 | Frames for two steps. 24 at 24 fps is one step every half second. |
| Frame rate | both | fps | 6 to 60 | 24 | Frames per second. Changing it changes the walking speed. |
| Step length | human | legs | 0.3 to 1.4 | 0.78 | Contact to contact, in leg lengths. Longer steps at the same timing walk faster. |
| Time on the ground | human |  | 0.52 to 0.85 | 0.6 | Fraction of the cycle each foot is down. Under 0.5 would be a run, so it stops at 0.52. |
| Leg straightness | human |  | 0.85 to 0.999 | 0.985 | How straight the leg is at contact. Lower crouches the whole walk. |
| Hip bob | human | legs | 0 to 0.3 | 0.075 | Vertical travel of the hips, lowest to highest. |
| Down position | human | cycle | 0.03 to 0.22 | 0.125 | When the body is lowest after contact. 0.125 is a quarter of a step. |
| Foot lift | human | legs | 0 to 0.5 | 0.16 | How high the swing foot clears the ground. |
| Heel strike | human | ° | 0 to 40 | 14 | Toe-up angle at contact. |
| Toe off | human | ° | 0 to 60 | 32 | Heel-up angle at push-off. |
| Swing toe | human | ° | -20 to 40 | 8 | Toe angle while the foot swings through. |
| Gait | dog |  | walk, trot, pace, gallop, run, hop | walk | Which paws move together. Walk is four beats, trot pairs diagonal paws, pace pairs the paws on one side. Gallop lands the hind paws, then the front paws, with the body in the air and the legs tucked under it in between. |
| Stride | dog | heights | 0.1 to 5 | 0.95 | Ground covered in one cycle, in shoulder heights. Longer strides at the same timing run faster. |
| Time on the ground | dog |  | 0.15 to 0.85 | 0.68 | Fraction of the cycle each paw is down. |
| Paw lift | dog | heights | 0 to 0.5 | 0.13 | How high the swinging paw clears the ground. |
| Paws width | dog | heights | 0 to 0.3 | 0.11 | Distance of each paw from the centre line. |
| Elbows and knees out | dog | ° | -15 to 30 | 3 | Direction the elbows and knees point away from straight ahead. |

## Body

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Forward lean | human | ° | -15 to 30 | 4 | Torso tilt. Negative leans back. |
| Torso rock | human | ° | 0 to 10 | 1.6 | Extra tilt that rocks with each step. |
| Head steadiness | human |  | 0 to 1 | 0.35 | 0 lets the head ride the hips, 1 holds it level. |
| Head nod | human | ° | 0 to 12 | 2.5 | Small nod with each step. |
| Arm swing | human | ° | 0 to 60 | 26 | Each way, opposite the legs. |
| Arm lag | human | cycle | -0.2 to 0.3 | 0.07 | How far the arms trail the legs. A little drag reads as natural. |
| Elbow bend | human | ° | 0 to 80 | 14 | Resting bend. |
| Elbow bend, forward | human | ° | 0 to 80 | 26 | Extra bend as the arm swings forward. |
| Hip twist | human | ° | 0 to 25 | 6 | How far the hips turn each way. The right hip leads at contact. |
| Hip drop | human | ° | 0 to 15 | 3 | The swing-side hip drops this much. |
| Hip tilt | human | ° | 0 to 15 | 1.5 | Forward and back rock of the pelvis. |
| Side sway | human | legs | 0 to 0.12 | 0.03 | Hips shift over the supporting foot. |
| Shoulder counter-twist | human | ° | 0 to 30 | 9 | Shoulders turn against the hips. |
| Head keeps facing | human |  | 0 to 1 | 0.8 | How much the head cancels the twist and tilt of the body below it. |
| Arms out | human | ° | -10 to 40 | 4 | How far the arms hang from the body. |
| Knees out | human | ° | -15 to 30 | 3 | Knee direction away from straight ahead. |
| Feet width | human | legs | 0 to 0.3 | 0.075 | Distance of each foot from the centre line. |
| Toe out | human | ° | -15 to 40 | 8 | Feet turn outward. |
| Hip width | human | × | 0.5 to 1.8 | 1 | Scale of the distance between the hips. |
| Shoulder width | human | × | 0.5 to 1.8 | 1 | Scale of the distance between the shoulders. |
| Torso length | human | × | 0.6 to 1.5 | 1 | Scale of the spine. |
| Arm length | human | × | 0.6 to 1.5 | 1 | Scale of both arms. |
| Neck length | human | × | 0.3 to 2.5 | 1 | Scale of the neck. |
| Head size | human | × | 0.6 to 1.8 | 1 | Scale of the head. |
| Body bounce | dog | heights | 0 to 0.3 | 0.03 | Up and down travel of the hips. |
| Spine bend | dog | ° | 0 to 25 | 6 | Side to side bend of the spine as the dog walks. |
| Back arch | dog | ° | 0 to 12 | 2 | How much the back arches and dips with each footfall. |
| Squash and stretch | dog | ° | 0 to 30 | 14 | Gallop and run only: the back humps up when the legs gather under the body and stretches out when they reach. A run does it once every step. |
| Torso twist | dog | ° | 0 to 20 | 6 | How far the shoulders and hips roll against each other along the spine. The shoulder on the side whose paw lands drops. |
| Shoulder blade | dog | heights | 0 to 0.15 | 0.05 | How far each shoulder blade drops and slides forward as its front paw lands. |
| Chest raise | dog | ° | -10 to 70 | 0 | Two-legged figures only: how far the chest is raised above level. A theropod is nearly level, a bird is tipped up. |
| Head hold | dog |  | 0 to 1 | 0 | A bird keeps its head still in space while the body moves under it, then thrusts it forward. 0 is off, 1 is fully held. |
| Arm swing | dog | heights | 0 to 0.15 | 0.02 | Theropod: how far the small arms swing against the legs. |
| Wings open | dog |  | 0 to 1 | 0 | Bird: 0 folds the wings against the body, 1 spreads them. |
| Wing beat | dog | ° | 0 to 70 | 0 | Bird: how far each wing beats up and down. Open the wings first. |
| In flight | dog |  | 0 to 1 | 0 | Bird: 0 stands on the ground, 1 flies. In flight the feet tuck up under the tail and the body rises on each down-stroke. Open the wings and set a wing beat. |
| Flight height | dog | heights | 0 to 3 | 1.1 | Bird: how far above the ground the body flies. |
| Frames per wing beat | dog | frames | 0 to 60 | 0 | Bird: how many frames one wing beat takes, on its own clock, so the wings keep beating when the walk slows or stops. 0 ties the beat to the walk cycle (Beats per cycle). |
| Beats per cycle | dog |  | 1 to 6 | 1 | Bird: wing beats in one cycle. |
| Neck raise | dog | ° | 0 to 90 | 52 | How steeply the neck rises from the back. |
| Head tip | dog | ° | -20 to 80 | 34 | How far the head tips down from the neck. |
| Head nod | dog | ° | 0 to 15 | 3 | Small nod with each footfall. |
| Tail carry | dog | ° | -60 to 90 | 28 | How far above the back the tail is held. |
| Tail wag | dog | ° | 0 to 60 | 22 | How far the tail swings each way. Use Repeats on the tail channels for a faster wag. |
| Ear bounce | dog | ° | 0 to 30 | 7 | How much the ears flop. |
| Body length | dog | × | 0.7 to 1.4 | 1 | Scale of the back. |
| Leg length | dog | × | 0.7 to 1.4 | 1 | Scale of all four legs. |
| Neck length | dog | × | 0.5 to 1.8 | 1 | Scale of the neck. |
| Head size | dog | × | 0.6 to 1.8 | 1 | Scale of the head and snout. |
| Tail length | dog | × | 0.3 to 2.5 | 1 | Scale of the tail. |
| Ear length | dog | × | 0.4 to 2.5 | 1 | Scale of the ears. |

## View

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Turn | both | ° | -180 to 180 | 0 | Orbit left and right. 0 is the side view, −90 the front, 90 the back. Drag the stage to orbit. |
| Height | both | ° | -85 to 85 | 0 | Look from above (positive) or below. 85 is nearly a top view. |
| Turntable | both |  | bool | false | Slowly circles the figure while it plays. |
| Turntable speed | both | °/s | -120 to 120 | 24 | Degrees per second. Negative circles the other way. |
| Axes gizmo | both |  | bool | true | Small x, y, z guide: x forward, y up, z the figure right side. |
| Selection colour | both |  | color | #e0662e | Highlight for the selected part. |

## Look

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Style | both |  | mannequin, stick, silhouette | mannequin | Mannequin is outlined limbs. Stick is joints and bones. Silhouette is one solid shape. |
| Line width | both | px | 0.5 to 12 | 3 | At 1080 pixels tall. It scales with the canvas. |
| Line colour | both |  | color | #26231f | Outline and silhouette colour. |
| Fill colour | both |  | color | #f6f1e7 | Mannequin fill. |
| Fill opacity | both |  | 0 to 1 | 0.55 | Lower it to trace through the body. |
| Far-side tint | both |  | color | #8fa3bf | The far arm and leg use this tint, so near and far read apart. |
| Far-side opacity | both |  | 0 to 1 | 0.85 | Strength of the far-side tint. |
| Figure size | both |  | 0.2 to 0.95 | 0.62 | Height of the figure as a fraction of the canvas. |
| Ground height | both |  | 0.4 to 0.98 | 0.8 | Ground line position, top to bottom. |
| Figure position | both |  | -0.4 to 0.4 | 0 | Left or right of centre, as a fraction of the width. |
| Background colour | both |  | color | #ffffff | Preview and solid exports. |

## Guides

| Control | Figure | Unit | Range | Default | What it does |
|---|---|---|---|---|---|
| Ground line and ticks | both |  | bool | true | Ticks stay on the ground, so a sliding foot shows. |
| Footprints | both |  | bool | true | Where each foot plants. |
| Motion arcs | both |  | bool | false | Paths of the points you tick below through the cycle. Drag a dot to reshape the movement. |
| Frame dots | both |  | bool | true | One dot on the path for every frame, so the spacing shows speed and ease. Drag a dot to bend the path there. |
| Pose labels | both |  | bool | true | Names CONTACT, DOWN, PASSING and UP on the frames where they fall. |
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
