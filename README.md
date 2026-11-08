# Walk Base

A reference program for tracing movement into an animation app. It is not an animator: it plays reference, lets you adjust it, and exports frames.

`WalkBase.html` is the whole app in one file. No server, no install, no network, and no book content. Everything stays on the device.

## Open it

On a computer, double-click `WalkBase.html`.

iPad Safari has no dependable way to run a local HTML file, so serve it from a computer on the same trusted Wi-Fi, then open the printed address on the iPad:

```bash
python -m http.server 8080 --directory walkbase
```

Rebuild after changing `src/` with `node walkbase/build.mjs <folder whose node_modules holds esbuild>`.

## Publishing

The app is published as a static website on **GitHub Pages**. Every push to `main` runs the tests, builds the page, packages `site/` and publishes it (`.github/workflows/pages.yml`). See [DEPLOY.md](DEPLOY.md) for the one-time setup and for checking a deploy.

To build it yourself: `npm install`, then `npm test`, `npm run build` (writes `WalkBase.html`, the whole app in one file) and `npm run package` (writes `site/`). Commands in this file that start `node walkbase/` are run from the folder above this one; inside this repository drop the `walkbase/`.

## Two sources for the stage

Pick one in the header (**Source**):

- **3D walk**: an original figure you can adjust and orbit.
- **Sampled drawings**: frames you cut from a picture of your own.

Both play on the same timeline and export the same way.

## The 3D walk

- **Gait, Body, Look, Guides**: every setting on a line, with a slider, a number and a reset. Tap a label for its help.
- **Parts**: tap a body part on the figure, or pick one in the list. Each part has motion channels (hip height, twist, tilt and sway; three spine joints; neck; head; shoulders; arms; elbows; wrists; knees; feet). Each channel can be scaled, offset, shifted in time, or **drawn by hand** in a pop-out graph (handles or freehand). Left and right can be linked, half a cycle apart.
- **View**: drag the stage to orbit, pinch to zoom. Presets for side, ¾, front, back and top, and a turntable.
- Feet are planted by IK, so there is no sliding. Hip height and turn are the pelvis channels.

## Two figures

Pick **Figure** in the header: a human or a dog. Each has its own presets (the dog: Walk, Brisk walk, Trot, Pace, Gallop, Sniffing, Old dog), its own gait and body settings, its own Parts, and keeps its own edits and automation when you switch.

The dog walks, trots, paces or gallops with the right paw order (the walk follows the dog walk chart in The Animator's Survival Kit: hips and chest bob in opposition, shoulder blades that slide and drop, a twisting torso; the gallop gathers the legs under the body, with a flight phase and a curling back), planted paws, a bending spine, a neck and head that can reach and tilt, a jaw, ears and a three-joint tail. Every part has the same channels as the human: scale, offset, repeat faster (a quicker wag), shift in time, or draw the curve by hand.

## Automation and movements

The **Auto** tab turns anything into a movement over time.

- **Length**: how long the performance is. One cycle by default; make it several so there is room.
- **Record by hand**: arm **Rec** (also on the transport), press Play and move any gait slider or a part's Amount or Offset. Your moves become automation lanes, like recording a synth knob. **Touch** records while you hold and glides back when you let go. **Latch** records from your first touch and holds the last value until you stop.
- **Movements**: Walk to stop, Reach for, Pick up and Trip forward, written for both figures. Choose where one starts and how long and strong it is, then add it. A movement is ordinary lanes, so you can edit or redraw it afterwards.
- **Lanes**: each automated value has a lane. Edit opens it in the pop-out: tap to add a point, drag to move it, double-tap to remove it, or draw it freehand. Controls that a lane drives follow it as the playhead moves and show a dot.

- **Lane tools** (in the lane pop-out): copy a span and paste it at the playhead, loop it to the end, move the lane earlier or later, copy it to the other side, or bake the playhead into a drawn curve.
- **Saved performances**: keep the automation you have built under a name and switch between versions. Each figure has its own list.
- **Free running**: a channel can run on its own clock instead of the walk's, so a tail or ears carry on when the walk stops (Repeats, offset, shift, free).

The figure travels as the performance says: it slows, stops, or stumbles, and its feet stay planted.

## A less crowded panel

After a review of the interface on iPad and iPhone sizes: the rarely used groups start **folded** (Body: Hips and shoulders and Proportions; Guides: Onion skin and Colours; Export: Names and Target app; Auto: Saved performances, Length and Record by hand), and a choice you make is remembered. The ten tabs **wrap onto two rows** instead of scrolling sideways. **Arc points** are tap-sized chips with the right and left side by side, a single row to show Both sides, Right, Left, All or None, and the symmetry choices folded under one button. **Movements** show one kind at a time (Pace, Posture, Action, Gesture). A menu opened on one tab no longer floats over the next. `tests/ui-layout.mjs` checks all of this at iPad landscape and portrait sizes.

## Gaits

Each figure offers only the gaits it can do: the dog walk, trot, pace and gallop; the theropod **walk and run**; the bird walk, run and hop; the sauropod walk; the ceratopsian walk and trot. The theropod and bird **run** is a two-legged run in the manner of a running chicken or a Deinonychus drawing: the feet alternate with a flight phase between steps, the swing foot tucks up high under the body, the back squashes (legs gathered, hips low, back arched) at mid-stance and stretches (legs reaching, hips high, back long) in flight once every step, the body leans forward with the neck in an S, and the tail is held out level and never drags. The Run preset is a twelve frame cycle; **Squash and stretch** on the Body tab sets how much.

## Corrections: fix a part without losing the animation

On the **Parts** tab, pick a part (the neck, say), turn on **Show the fix handle on the stage**, go to the frame where it has drifted out of line, and drag the orange ring at the end of the part, or the square at its base, back where it belongs. The base moves the part before it, since that is where this one starts. The app finds the small change in that part's channels that puts the end where you dropped it, and adds it as a smooth **correction** on top of the animation, easing back out over **Spread** frames either side. The animation underneath is not changed: **Clear corrections** puts the part back exactly as it was, and Undo works. A part turns about its base, so its end can only go round an arc; drop it near the arc.

Corrections are lanes named "correction" (Auto tab), so they can be edited, copied or removed like any other automation.

## Movements

New since: **Kneel**, **Limp** and **Walk normally**, **Scratch head** for the human; **Scratch** (sits and scratches with a hind leg) and **Roll over** for the dog. The other animals have movements of their own: the **bird** can **Take off**, **Land** and **Peck**; the **theropod** can **Roar** and **Lunge and bite**; the **sauropod** can **Rear up** and **Swing the neck**; the **ceratopsian** can **Lower the head** and **Toss the head**. All of them also start, stop, speed up and slow down, and look around.

The **Auto** tab has about twenty movements for each of the human and the dog, in four groups (Pace, Posture, Action, Gesture). Human: start walking, walk to stop, break into a run, slow to a walk, sit, stand up, crouch, bow, stretch, jump, kick, throw, pick up, reach, point, wave, cheer, shrug, nod, shake head, look around, trip. Dog: start, stop, speed up, slow down, sit, lie down, sit up and beg, stand up, play bow, leap, chase tail, shake off, sniff the ground, bark, howl, pick up, reach, look around, excited tail wag, trip.

Every movement starts from whatever the figure is doing when it begins, and the lanes ease from one value to the next, so they chain: **Walk to stop, Sit, Stand up, Start walking** runs as one smooth performance. Sit, lie down, beg and crouch hold their pose until you **Stand up**, which returns every part they changed to neutral. A movement is ordinary automation, so you can edit it afterwards, and strength (the K setting) and length can be changed before applying.

## More figures

The **Figure** menu has a human, a dog and four more that share the dog's legged rig: a **theropod** (T. rex, raptor), a **bird**, a **sauropod** and a **ceratopsian**. Each has its own presets, attachments and saved performances. Choosing one starts from its first preset.

The bird has a **Head hold** (it keeps its head still in space while the body moves under it, then thrusts forward), a **hop** gait, and wings that fold, spread and beat (Body tab; open the wings first, and orbit to the front to see the beat). The theropod's small arms swing against its legs and its tail balances the body. Running theropods and birds have a flight phase.

## Capes and hair

**Attach, Add, Cape or hair (swings)** puts a ribbon on a part. It is pinned at its ring and swings with the body: gravity pulls it down, it trails behind as the figure walks, and a little wind with gusts can push it. In the Physics group set gravity, stiffness (limp cloth to a held ponytail), air drag, wind, gusts, whether it follows the part, and its rest angle. Drag the square at its tip to set the length. It is worked out for the whole cycle at once, so scrubbing and exporting always show the same frame. With Motion arcs on, its tip and middle get a path and a dot on every frame. It swings in the side-view plane only for now.

## Motion arcs

Dragging a dot now moves a point in all three directions: along the body, up and down, and **sideways** (the arcs include the width and turn channels, so from the front or from above a horizontal drag changes how far apart the feet or hands are, or swings the head, hips or tail side to side). Turn the camera to the front or the top to move things sideways.

**Symmetry** (Guides tab, Arc points) says what the other side does when you drag a dot: **Alternate** (the same movement half a cycle later, as a walk has it), **Mirror** (the same movement at the same moment, mirrored left to right, so both hands lift or spread together), or **Independent**. **Copy right to left** and **Copy left to right** make the two sides match, using the chosen mode.

Arcs now start on **both sides** (head, hips, both wrists, both ankles; for the dog all four paws and the tail). Under **Arc points** there are buttons for **Both sides**, **Right only**, **Left only**, **All** and **None**, and more points to follow: the chest, the toes, and for the dog the jaw tip and the middle of the tail. **Move both sides together** is on by default: when you drag a dot on one foot or hand, the other side follows half a cycle later, as it does when you edit a curve; turn it off to change one side alone.

On the **Guides** tab, tick the points to trace under **Arc points** (head, hips, shoulders, elbows, wrists, knees, ankles; for the dog the head, nose, tail tip and each leg's joint and paw). Each gets a colour, a dashed path, and a dot on every frame, so you can read the speed from the spacing. **Drag a dot** to bend the movement at that frame: only the curves that move that point change, and Undo puts it back. With a performance on, the arcs show the whole thing but are read-only.

## Starting clean

Each visit starts with a clean figure. **File, Reopen with last session** turns the old behaviour back on, and **File, New** clears everything now. Save settings first to keep your work.

## Attachments

The **Attach** tab builds out the character with shapes and pictures. **Add** an ellipse, rectangle, triangle, line, or a picture (a PNG with transparency, or a photo). It is fixed to the part you had selected and moves with it, including every curve and automation on that part, and it stays put as you orbit.

On the stage the selected attachment has handles: the **ring** is its anchor, which you slide round the edge of the part, or drop on another part to move the attachment there; the **dot** moves it; the **round handle** turns it; the **square** sizes it. Tap an attachment on the figure to select it, Escape to let go. In the panel you can also set the part, the edge position, offset, turn, size, depth (in front or behind), flip, colours and opacity, copy it to the other side, duplicate it, or hide it.

Attachments are drawn in every style and in every export (composite, and in the near and far layers by side). Each figure keeps its own. They are saved with your settings; pictures are kept in the browser (a handful fit) and also go into **Save settings**.

## The interface

Drag a row's label sideways to change its value. A menu bar (File, Edit, View, Performance) holds the commands; the stage has a slim toolbar (Orbit, Pan, a View dropdown, Spin, Fit); the timeline has icon transport buttons and a timecode. The panel on the right is an inspector with folding sections. Light and dark follow your device, or choose under View, Theme.

**View, Interface size** switches between **Compact** (for a mouse or trackpad) and **Comfortable** (for a finger; every control is at least 44 px). Automatic picks one from your device.

## Undo, reference picture and data

- **Undo and redo** (header, or Ctrl or Cmd + Z, add Shift to redo): every setting, curve, lane, movement and saved performance. A slider drag is one step. The camera is not part of it.
- **Reference picture** (Guides tab): put a photo or a drawing under the figure. Opacity, Size, Left and right, Up and down, and a Ground line to match where the feet touch. It can be included in exports and is kept between visits.
- **Lane data** (Export tab): CSV or JSON, one row per frame with the cycle phase, position and every lane. **Key poses only** exports just the frames where the movement turns round or a foot lands, with a note of why.

See [ROADMAP.md](ROADMAP.md) for suggested improvements and a plan for physics (pick the character up and drop it, falling).

## Sampling a picture

Sampler tab: choose a picture of a movement sequence (a photo, a scan, a sheet of your own drawings).

1. **Cuts**: the app suggests cuts. Auto finds gaps between drawings. **Cut into N** is for drawings that overlap. **Region** limits where it looks, which matters on a page with text. Long ground lines are ignored.
2. **Cut window**: rectangles assigned to frames. Drag a rectangle's handles to fit it. **Stamp** drops a same-sized box wherever you tap, numbered in order, so a sequence takes one tap per drawing. Boxes may overlap. Split, merge, reorder, delete, and type your own frame number (later boxes count on from it).
3. **Clean up** (Slice view): erase and restore brushes, lasso, box, magic wand, specks, remove paper, undo and redo.
4. **Timeline**: each frame has a hold. Line the drawings up by Feet, Centre, or As laid out.

Your cut rectangles, numbers and holds are remembered. The picture and your erasing are not: load the same picture again and the cuts come back.

## Export

PNG frames in a ZIP, as one file per timeline frame or one per drawing plus a timing list. Optionally split the walk into far limbs, body and near limbs. MP4 where the browser can encode H.264. Contact sheet. Timing manifest and an import recipe for Procreate, Dreams and other apps. The 3D walk can orbit during export.

## What has been tested

| Test | Result |
|---|---|
| `node --test walkbase/tests/*.test.mjs` (rig, curves, slicer, automation, clips, dog, history, lane tools, key poses, attachments) | 135 of 135 |
| `ui.mjs`, both figures' panels, opened as a file with emulated touch, every control at least 44 px | 58 of 58 Chromium, 50 of 50 WebKit |
| `ui-auto.mjs`, movements, recording by hand (touch and latch), the lane editor, saving | 29 of 29 in both |
| `ui-dog.mjs`, switching figures, picking dog parts, the same editing, movements, export, saving | 26 of 26 in both |
| `ui-tools.mjs`, undo and redo, free running, lane tools, reference picture, saved performances, key pose and lane data export | 44 of 44 in both |
| `ui-menus.mjs`, menus with mouse, finger and keyboard, density, theme, scrubbing labels, folding sections, contrast, names for icon buttons | 49 of 49 in both |
| `ui-attach.mjs`, adding shapes and pictures, following the part, the stage handles, re-attaching, save, undo, export layers | 44 of 44 in both |
| `ui-overlap.mjs`, no controls overlap in any tab, at five window shapes, in both densities | 7 of 7 in both |
| `ui-sampler.mjs`, a synthetic sheet (`tests/fixtures/sheet.png`) | 39 of 39 in both |
| `ui-sampler.mjs`, a real scanned page (kept out of the project) | 40 of 40 in both before the automation work; not re-run since |
| Exports decoded outside the browser | PNG ZIPs, the unique-plus-timing rebuild, and MP4 (48 frames, 24 fps, H.264), before the automation work |

**Not tested:** a physical iPad, Apple Pencil, Procreate or Dreams import, WebKit on iPadOS, MP4 in WebKit. Emulated touch proves the logic only.

## Limits

- Automatic cutting cannot separate overlapping drawings by itself. Region plus Cut into N, or Stamp, then adjusting by hand, is the dependable route.
- Erasing is picture-wide, so overlapping boxes share erased pixels.
- Key pose labels (contact, down, passing, up) follow the built-in timing, not curves you draw. The dog has none.
- Recording writes lanes during playback only. A dog's tail wag runs on the walk cycle unless its channel is set to Free running.
- Hip and foot channels move planted feet through IK, so wild settings can stretch a leg to its limit.
- The figure is original and generic. It is not any book's drawing.

## Files

| Path | What |
|---|---|
| `src/rig.js`, `rig3.js`, `motion.js` | The human walk: planar gait, 3D skeleton, motion channels (the dog's channels live here too) |
| `src/dog3.js`, `dogdraw.js`, `dogdefaults.js` | The dog: skeleton and IK, shapes, gait settings |
| `src/automation.js`, `clips.js`, `lanes.js` | Automation lanes, the performance, recording, movements, the lane editor and lane tools |
| `src/history.js`, `keyposes.js` | Undo and redo; the pose at any frame, key poses, the lane table |
| `src/physics.js`, `stripdefs.js` | Swinging strips: the chain simulation and its settings |
| `src/arcs.js` | Motion arcs: points, paths, dragging a dot |
| `src/attach.js` | Attachments: part frames, the edge of a part, anchors, hit testing, handles, painting |
| `src/draw.js`, `geom.js`, `curves.js` | Rendering, orbit camera, part picking, curve editor |
| `src/slicer.js`, `sampler.js`, `cutwindow.js` | Cut detection and editing, sampler state, cut window |
| `src/export.js`, `controls.js`, `app.js` | Export, control definitions, the app |
| `src/menu.js`, `icons.js`, `app.css` | Drop-down menus, line icons, the design system |
| `PARAMETERS.md` | Every adjustable setting, generated |
| `ROADMAP.md` | What is done, the next phases (attachments, arcs, the interface) and the physics plan |
| `tests/` | Unit, browser and decode checks |
