# Walk Base: suggestions and a physics roadmap

Walk Base is a reference program. It plays a movement, lets you adjust it, and exports frames to trace. Everything below keeps that: more ways to get the reference you need, not a second animator.

## Where it stands

- Two figures, a human and a dog, with the same customisation: every part has channels you can scale, offset, repeat faster and draw by hand.
- Automation: any gait setting or channel can change over a longer performance. Record it by hand (Touch or Latch), add a ready-made movement (Walk to stop, Reach for, Pick up, Trip forward, written for each figure), or edit lanes by tapping and dragging.
- The dog's walk follows the Animator's Survival Kit dog walk chart (book pages 330 and 331): hips and chest bob in opposition twice a cycle, each shoulder blade is a bone of its own on top of the ribs (pivoting at the withers, with the shoulder joint at its lower end) that slides, drops and swings as its front paw lands, and the shoulders and hips counter-rotate along the spine (Body tab: Torso twist, Shoulder blade). The chart was read from scanned page images, so the footfall offset (hind paw about 0.2 to 0.25 of a cycle ahead of the front) and the exact bob timing are the author's reading of the drawings.
- Sampling a picture of your own drawings onto the same timeline.
- PNG, MP4, contact sheet and timing manifest exports.

## Next phase: build out the character, and see every point's arc

Requested 2026-11-07. Three linked features. Together they turn the base figure into something you can dress and trace: add a coat, a cape, hair, armour or any shape to the body, see how each point travels, and have the loose parts move on their own.

### A. Attachments: collage onto the body (first pass done 2026-11-08)

**Built:** the Attach tab and the stage handles.
- Shapes (ellipse, rectangle, triangle, line) and pictures (PNG with transparency, or a photo, shrunk to 720 pixels) fixed to any part of either figure. They inherit the part's whole motion, including its channels, curves and automation, and stay put when the camera orbits.
- The anchor is a ring that slides round the edge of the part (a capsule round its bone), or a free point. Drag it on the stage, or drop it on a different part to move the attachment there. A dot moves the shape, a round handle turns it, a square sizes it. New ones start upright on the screen.
- Properties: attached to, edge position, out from the edge, along, across, turn, size, width, height, depth (in front or behind the part), flip, fill, outline, opacity. Copy to the other side (flipped), duplicate, delete, hide.
- Drawn in every style, sorted with the body by depth, and in exports: composite, and in the near and far layers by side. Saved with the settings and in Save settings (pictures included), undoable, repaired if damaged.
- Tested: geometry (`tests/attach.test.mjs`) and the browser (`tests/ui-attach.mjs`).

**Still to do from the plan:** a separate pivot handle (it turns about its centre now), anchoring one attachment to two parts so it stretches, freehand strokes, pictures kept in IndexedDB instead of the small settings store (a handful fit now), a layer order beyond front and behind, an export layer of its own per attachment, and the manifest listing them.

The plan as first written:

**What it is.** Shapes and pictures that you attach to a body part. They inherit that part's movement, so a hat follows the head and a bracer follows the forearm, including every Amount, Offset, Repeats, drawn curve and automation lane you have set on the part.

**What you can attach**
- Simple shapes: ellipse, rounded rectangle, polygon, capsule, line.
- Freehand strokes drawn on the figure.
- Imported pictures: PNG with transparency (also JPEG and SVG if cheap). A picture is a flat plate in the part's own space.
- Chains and strips for the physics features below (hair, cape, coat edge).

**How it attaches**
- Every attachment has a **parent part** (a part and a side, as in the Parts tab) and an **anchor point**. The anchor is stored in the part's own coordinates, never on the screen, so it stays put as the figure moves and as you orbit the camera.
- **Boundary anchors.** An anchor can sit on the edge of the body shape. It is a point that slides along the part's outline (a position from 0 to 1 around the edge, plus an offset along the outward direction) and is drawn as a ring you drag on the figure. This is the "points to attach to the body base boundaries" part. It snaps to the edge, with a toggle for free anchors that float in the part's space.
- **Pivot.** The point the attachment rotates about. It is a second, independent handle, so a cape can pivot at the collar while hanging from the shoulders.
- **Two anchors (later).** Attach the two ends to two different parts and the shape stretches between them, for a sleeve across an elbow or a cape across the shoulders.
- Handles for position, rotation and scale, plus a layer list with Front/Behind, depth offset, opacity, tint, outline, lock, hide, and Mirror to the other side.

**Movement on top.** Each attachment has its own small set of channels (offset, rotate, scale, sway) that use the same Amount, Repeats, curve and automation controls, so a flag can wave while it rides the arm.

**In 3D.** Attachments live in the parent's 3D frame, so they orbit with the figure and are depth-sorted with the body. A picture can be fixed to the part's plane or set to always face the camera.

**Saving and export.** Pictures are stored with the project in the browser's database (IndexedDB), downscaled to 2048 pixels on the long side, because they are too big for the small settings store. Exports get an optional separate layer for each attachment, and the manifest lists them with their parents and anchors.

**Works for both figures** (the dog and the human share the part system).

**Checks**
- An attachment's anchor keeps a fixed position in its parent's coordinates for the whole cycle.
- Doubling a part's Amount moves its attachments by the same amount.
- A boundary anchor stays on the edge of the part's outline in every pose.
- Save, reload, and export round-trip pictures and layers.
- A 4K export with several pictures finishes and stays within memory on both browser engines.

### B. Motion arcs for every point, and adjustable (first pass done 2026-11-08)

**Built:** Guides tab, Arc points. Tick any of the human's head, hips, shoulders, elbows, wrists, fingertips, knees and ankles, or the dog's head, nose, hips, tail tip, and each leg's joint and paw. Each gets its own colour, a dashed path, and a dot on every frame (current frame larger). Drag any dot and the movement bends there: the app solves the channels that move that point (`src/arcs.js`), bakes them to curves, and only those curves change. Undo works. Arcs also follow a whole performance, read-only. Tests: `tests/arcs.test.mjs`, `tests/ui-arcs.mjs`.

**Still to do:** drag dots along the arc to ease in or out without changing the path, path offsets for points with no channel of their own, arcs for attachment points, editing inside a performance, arcs in exports (contact sheet, overlay layer, manifest).

The plan as first written:

**Today** the arc guide traces a handful of fixed points (head, hip, wrist, ankle, tail tip) as read-only lines.

**Next**
- **Any point.** Pick any joint, the tip of any part, or any attachment point and show its arc over the whole performance, automation included. Several arcs at once, with a colour for each.
- **Frame dots on the arc.** One dot per frame, so the spacing shows speed and ease at a glance. This is what you trace: the path and the timing.
- **Adjust the arc.** Drag a point on the arc and the app changes the movement to match. A paw or hand already has Reach and Lift channels, so these map straight onto them. Other points get a small **path offset** (x, y, z in the parent's frame) as a drawn curve like the ones you already have, so the arc bends where you drag and the rest of the body is left alone.
- **Adjust the spacing.** Drag the dots along the arc to ease in or out without changing the path.
- **Export.** Arcs as vector lines in the contact sheet, as an overlay layer, and as point lists in the manifest.

**Checks**
- With no edits an arc matches what the pose function gives.
- A looping motion gives a closed arc.
- Dragging a point moves that point to within a pixel and leaves the others where they were.
- Path offsets of zero change nothing.

### C. Physics-based motion for anything attached (coat, cape, hair) (first pass done 2026-11-08)

**Built:** a new attachment, **Cape or hair (swings)**, in the Attach menu. It is a ribbon of joints pinned at a ring on any part (`src/physics.js`, `src/stripdefs.js`). The chain is simulated over the whole cycle or performance ahead of time (verlet points with fixed segment lengths, gravity, drag, bend stiffness, wind with gusts, and the walk's forward travel so it trails behind), so scrubbing and exports always agree and the loop closes. Settings: width at the top and tip, length (drag the square at its tip), joints, gravity, stiffness, air drag, wind, gusts per cycle, follow the part, rest angle. With Motion arcs on, the tip and the middle get a path and a dot per frame as a motion guide. It saves, undoes, exports and works on the dog. Tests: `tests/physics.test.mjs`, `tests/ui-physics.mjs`.

**Still to do:** the sideways direction (it swings in the side-view plane only), collision with the body so a cape does not pass through the legs, a strip made of several strands for hair, a coat edge that follows two parts, drawing the guides as per-frame ribbons for export, a picture that bends along the strip, and baking the swing into editable curves.

The plan as first written:

This is Phase 2 of the physics plan below, widened from the dog's tail and ears to anything you add. It comes after A, because it needs attachments to exist.

**What it does.** Chains and strips hang from their anchor and follow the body with lag, overshoot and swing, the way loose cloth and hair do. Each point's motion also shows as an arc (B), so you can trace the follow-through.

**Kinds**
- **Strand:** a chain of segments (hair, a tail, a scarf end, a rope).
- **Strip or cape:** several strands joined side by side, with a width.
- **Clump:** a fan of strands from a line on the boundary (a mane, fur, a fringe).
- **Coat edge:** a hem hanging from a line around the body.

**Dials for each:** length, taper, mass, stiffness, damping, gravity, drag, bounce on collision with the body (simple capsules), and wind (direction, strength and gusts). All of them can be automated, so a gust can be a lane. **Rest pose:** how it hangs when still.

**How it runs.** Verlet integration with fixed time steps. The same inputs always give the same motion. It is driven by the movement of its parent part, so a stop or a trip pulls the cape forward and swings it. To make a looping walk loop, it runs a few cycles first and uses the last. The result is cached for scrubbing and can be **baked** into frames and drawn curves so you can edit it by hand.

**Checks**
- It is deterministic: the same settings give identical frames.
- Stiff enough, it behaves like a rigid attachment.
- It never gains energy.
- Segment lengths hold.
- It doesn't go through the body.
- The loop closes after pre-roll.
- No NaN values or runaway motion at high speed.

### Order and size

1. **A, rigid attachments, boundary anchors, pictures, layers, saving and export.** Medium to large. Everything else depends on it.
2. **B, arcs for any point, with frame dots, then dragging to adjust.** Medium. Showing arcs is small and can ship first. Adjusting them is the bigger part.
3. **C, strands, then strips, clumps and the coat edge, wind and baking.** Medium to large.
4. **Two-anchor stretching and picture deformation (a cape that really drapes).** Large, and optional.

### Risks

- **Touch handling.** Anchors, pivots, handles and layers are many small targets on an iPad. Needs the same 44 px audit and a real device pass.
- **Memory and speed.** Many large pictures at 4K export. Downscale on import and cache the drawn plates.
- **Looks wrong, not just is wrong.** Cloth and hair need tuning. Keep rigid attachments as the fallback.
- **Overlap with the pin and props ideas below** (7 and 8). A pin is an anchor that holds a point on an object, so it should reuse the anchor system from A rather than being built twice.

## Phase for the interface: a professional look (first pass done)

**Done in the first pass (2026-11-08):**
- A design system in `src/app.css`: colour, type, spacing and radius tokens, light and dark themes that follow the system, flat controls with hairlines, a thin slider and custom checkboxes, and line icons (`src/icons.js`).
- Two densities. **Compact** (28 px controls, 13 px text) for a pointer; **Comfortable** (44 px controls, 16 px fields) for a finger. The default follows the device and View, Interface size overrides it. Touch hit areas stay 44 px, but the controls are flat so they do not look chunky.
- A menu bar (File, Edit, View, Performance) with drop-down menus (`src/menu.js`): shortcuts shown, ticked items, disabled items, arrow keys, Home and End, Escape, left and right between menus, and touch-sized rows. Save and load settings, export, contact sheet, key poses, lane data, undo and redo, reset, stage only, interface size, play, record style, and movements all live in menus now.
- A slim icon toolbar on the stage (Orbit, Pan, a View dropdown, Spin, Fit) instead of eight text buttons; icon transport with a timecode; undo and redo as icon buttons.
- The inspector: folding sections that remember their state, light property rows with a reset icon, flatter channel cards (Draw curve, Options, reset), part chips, and a tab strip that scrolls with an edge fade.
- Grouped commands in the tabs: Set length (menu), More exports and Settings file (menus), and the lane tools as Span, Move and More menus.
- Checked by tests (`tests/ui-menus.mjs`): menu behaviour with mouse, finger and keyboard, density, folding, 4.5:1 text contrast in both themes, accessible names on every icon button, no sideways scroll, a 26 px minimum in compact and 44 px in comfortable.

**Also done (second pass):** drag a row's label sideways to change its value (it drives the slider, so recording and undo work), a Theme choice (follow the device, light, dark) in the View menu, the key-pose label moved clear of the camera bar, and an overlap audit (`tests/ui-overlap.mjs`) that checks no controls overlap in any tab, at five window shapes, in both densities (and proves it can see an overlap).

**Still to do from this plan:** the automation lanes as visible rows in the timeline with zoom, long-press context menus, a properties panel that follows the selection in every tab, icons on the tabs, and a review on a real iPad.

The original plan follows.

Requested 2026-11-08. The big rounded buttons in rows read as quickly generated. The goal is the quality of a professional creative tool (it does not need to copy Adobe): calm, dense, consistent, with actions grouped instead of laid out as rows of buttons.

**Where it falls short today**
- Every action is a large pill button, shown all the time, so a panel can be several rows of them.
- Every control has the same touch-sized look whatever its job.
- Related actions are not grouped: camera views, file actions, automation tools and exports are each a loose row.
- The long scrolling tabs mix settings with commands.

**What it should become**
1. **A small design system.** Type scale, a 4 pixel spacing grid, neutral greys with one accent, 1 pixel hairlines, small radii, flat controls, quiet hover and pressed states, line icons (16 and 20 pixels), light and dark themes, clear focus rings, tabular numbers for values.
2. **A menu bar with grouped commands.** File (Save and load settings, Export, Contact sheet, Key poses, Lane data), Edit (Undo, Redo, Reset all), Figure, View (camera views, guides, stage only), Performance (Record, Movements, Saved performances). Menus show shortcuts and disabled states.
3. **A compact toolbar.** Icon buttons with tooltips, grouped in segmented controls. Camera views become one View dropdown instead of eight buttons. The transport (first, step, play, record, last) becomes an icon strip with a timecode.
4. **A real inspector.** Collapsible sections with headers, property rows with the label on the left and a compact value field and slider on the right, number fields you can scrub by dragging the label, and channel cards that open only when you want them. A properties panel that follows the selection.
5. **A better timeline.** Dockable, with a timecode, the automation lanes as visible rows (like a track in an audio editor), zoom and scroll, and the frame strip.
6. **Touch and pointer from one design.** Compact density with a mouse or Pencil hover, comfortable density on touch, using larger hit areas around smaller visuals rather than larger visuals. Long-press for a context menu. Menu rows are touch-sized inside the popover while the closed bar stays slim.
7. **Keep what already works:** one offline file, keyboard operation, roles and labels for assistive tools, contrast, and respect for reduced motion.

**Order of work**
1. Inventory every control and decide its group and place (information architecture on paper first).
2. Tokens, then the component set: menu, popover, segmented control, property row, accordion section, icon button, tooltip, toolbar.
3. Move one tab at a time to the new components, keeping the test ids so the tests move with it.
4. Screenshot review on iPad and desktop sizes, both themes.
5. Remove the old styles.

**Checks:** the 44 pixel hit-area audit on touch, keyboard navigation and focus order for every menu, contrast ratios in both themes, no sideways scrolling at iPad portrait and landscape, and screenshots reviewed by eye. New tests for menus: open, move with arrow keys, Escape, and choosing an item.

**Risks:** it touches every screen, so the tests move with it; icon-only buttons are harder to discover without hover on an iPad (menus carry the words); and the look needs real review on a device.

**Order against the other phases:** it could go before the attachments, arcs and physics phase or after. Before is the better order, because that phase adds many controls (anchors, handles, layers, arc editing) that would otherwise be built in the old look and rebuilt.

## Interface review (an agent audited the app at iPad and iPhone sizes)

**Done:** folded advanced groups; tabs that wrap; arc points as chips with one Show row and folded symmetry; one group of movements at a time; pop-ups close when the tab changes; Auto's long explanations folded; a layout test.

**Done since:** the top bar as one line of four pop-up buttons (iPad) that wrap on a phone; slider rows: Compact, Roomy (label above a full-width track) and Automatic in the View menu, two columns on a wide panel, a bigger thumb on touch.

**Recommended and not yet done:** on the phone the panel gets only about 214px (a bottom sheet that snaps between peek and half-height, with Figure and Walk in its header); Parts as a body-region picker instead of 33 buttons; Attach's Place and Look groups behind Advanced; help text behind an info toggle per section; merging rarely used tabs (Look, Guides, Sampler, Export) into one More menu or into the top menus; phone tap targets still under 44px in Guides and Body.

## Added 2026-11-08 (later): flight, wording, corrections, movements

- **Arcs in three directions and symmetry:** every point's chain now includes its sideways channels (width, turn, out), so a drag from the front or top moves it sideways; arm points can also use a shrug of the shoulder when the arm is straight. Symmetry choices Independent, Alternate and Mirror, and Copy right to left / left to right. **Still limited:** a joint with one channel (an elbow or knee) can only go round its arc; a fully straight arm or leg cannot be pushed further out; the chest cannot move along the body.

- **Arcs on both sides:** they start with both sides shown, with buttons for right only and left only, and dragging a dot moves the other side too (half a cycle later) unless Move both sides together is turned off. More points: chest, toes, jaw tip, middle of the tail. **Not yet:** arcs for the ears, the attachments' points and the strips' joints in the picker (the strips already show their tip and middle).

- **More movements (`src/moves2.js`):** kneel, limp and walk normally, scratch head (human); scratch, roll over (dog); take off, land, peck (bird); roar, lunge (theropod); rear up, swing the neck (sauropod); lower the head, toss the head (ceratopsian). The animals' movement lists are built by `clipsForFigure`. **Not yet:** a human lie-down and get-up, crawl, climb, dance; a bird's flap-glide-flap, a hop-up, preening; a theropod's feeding head-shake; a ceratopsian's charge with the head lowered all the way through the run. A limp is approximated with hip drop, lean and a slower pace; a true limp needs left and right gait settings.

- **Theropod run (requested with a Deinonychus run-cycle drawing):** the gait list per figure (theropod: walk, run; no hop or gallop), and a two-legged run gait with flight, high foot tuck, squash and stretch once per step, forward lean and a level tail (`runPawPath` in `src/dog3.js`, `run` in `src/dogdefaults.js`). **Not yet:** the stretch pose in the drawing has the whole body arching over a single planted foot; the reach and tuck could be tuned further against the drawing, with a body roll and a head that stays steadier than the hips. Feathered raptor tail and arms.
- **Corrections at the base of a part:** a square handle at the start of the selected part moves the part before it (the base of the neck is the end of the upper spine).
- **Bird feathers and flap clock:** quills drawn as separate feathers (secondaries along the forearm, primaries fanning from the wrist); Frames per wing beat gives the wings a clock of their own in a performance.
- **Counter:** the frame counter on the stage is off by default (View, Frame information on the stage).

- **Flying bird:** presets Flying and Gliding (body lifted, feet tucked under the tail, wings that sweep back, fold at the elbow on the up-stroke with the tip trailing the beat, the body rising on each down-stroke, the tail fanned). Controls In flight and Flight height. Wings beat sideways, so the preset turns the camera to three-quarters. **Not yet:** feathers as separate shapes, a take-off and landing, a flap cycle with its own length, and body roll in turns.
- **Wording:** panels and part names now say Bird, Theropod, Sauropod or Ceratopsian, feet instead of paws, wing and arm instead of front leg, and leave out controls that do not apply (ears on a dinosaur, wings on a dog).
- **Corrections** (`src/fix.js`): drag the end of a part at a frame to add a smooth correction lane that is added to the channel, leaving the animation underneath untouched. **Not yet:** drag a part's start (its anchor) as well as its end, corrections for the attachments' anchors, and showing the correction as a ghost.
- **Movements** (`src/moves.js`): about twenty each for the human and the dog, grouped, and chaining (each begins from what the figure is doing). **Ideas not done:** turn about, kneel, lie down for the human, scratch and roll over for the dog, limp, tiptoe, climb, crawl, dance, a stumble that recovers into a run, and movements for the other animals (the bird's take-off, a theropod's roar and lunge, a sauropod's rear-up).

## Figures to add: a bird, and dinosaurs (a theropod and a quadruped) (first pass done 2026-11-08)

**Built, as species of the dog's legged rig** (`SPECIES` in `src/dogdefaults.js`; the Figure menu now lists Human, Dog, Theropod, Bird, Sauropod, Ceratopsian):
- A species is a table: its bones, how many limbs carry it (two or four), whether the front limbs are legs, free arms or wings, how straight the legs are, how thick each part is drawn, and how the camera frames it. The dog's code now reads the table, so the dog itself is unchanged (all its tests still pass).
- **Theropod:** level back balanced by a long tail, long neck, big head and jaw, small swinging arms, three-bone digitigrade legs. Presets: Walk, Stalk, Run (with a flight phase), Small fast runner.
- **Bird:** tipped-up body, long neck and a beak, digitigrade legs with the backward ankle, a tail fan, wings that fold, spread and beat. A **Head hold** control keeps the head still in space while the body moves under it, then thrusts it forward. New gait: **hop** (both feet together). Presets: Walk, Hop, Run, Wading, Flapping.
- **Sauropod:** column legs, a very long neck, heavy tail, small head. Presets: Walk, Neck up.
- **Ceratopsian:** big skull with a frill and three horns, heavy body, short legs. Presets: Walk, Charge.
- Each figure keeps its own attachments, saved performances and automation, so a cape on the bird does not turn up on the dog. Choosing a species starts from its first preset.
- Tests: `tests/species.test.mjs` (poses finite, feet on the ground, limbs reaching, two feet down on two-legged figures, a flight phase when running, head hold, wings) and `tests/ui-figures.mjs`.

**Still to do:** a jointed neck (a sauropod's neck is one bone, so it cannot curve), a second flapping cycle that is separate from the walk cycle, wing feathers (a wing is a broad ribbon now, best seen from the front), the tail driven by the hips and head instead of a wave, a tail club, plates and sails, part names that say arm or wing for the species, clips for each species (it uses the dog's), more species (a heron, a duck, an armoured walker), and a quadruped's rear-up.

The plan as first written:

Requested 2026-11-08, for the phase after attachments. Each follows the dog's pattern (a pose function with IK legs, a channel list, shapes, presets and movements), but three figures on top of two is the point to stop copying and build a **legged-figure description**: a table of the bones, the leg chains (joint lengths, which way the knee bends), the neck and tail chains, the gait (which paw lands when), and the drawing radii. The human, the dog and the new figures would then share one pose, channel and drawing path instead of one file each.

**Bird** (a walking and hopping bird, a duck or a heron as the default)
- A two-legged, toe-walking (digitigrade) stance: the long visible "shin" is really the foot, so the leg chain is hip, knee (hidden in the body feathers), ankle (the backward-pointing joint) and toes.
- The head and neck bob: the head holds still in space while the body moves under it (head-stabilisation), then snaps forward. This is the key bird motion, so it needs its own channel: how much the head is held.
- Wings: fold and unfold, a flap cycle (down-stroke, up-stroke, with the wing bending at the wrist), and a glide. Flapping is the first cycle that is not a leg gait, so a second kind of cycle sits beside the walk cycle.
- Gaits: walk, hop (feet together), run, and a perched idle. Tail fan open and shut. Presets for a small songbird, a duck, a heron.

**Theropod dinosaur** (a two-legged predator, from a raptor to a T. rex)
- A horizontal back balanced over the hips by a heavy tail, a long forward neck and head, short arms with two or three claws.
- The tail carries the balance: it swings against the head and torso, so its motion should be driven by the hips and the head, not just a sine.
- A long stride, a clear weight shift from foot to foot, a slow turn through the hips. Gaits: walk, run (a flight phase at speed). Movements: stalk, lunge, a roar (head back, jaw open), turn.
- Presets: a feathered raptor, a T. rex, a small fast runner.

**Quadruped dinosaur** (a sauropod, and a ceratopsian as the second preset)
- Straight, column-like legs (little knee bend), a very long neck and tail for a sauropod, a heavy head frill and horns for a ceratopsian.
- A slow walk with the four-beat footfall, a big body with little bounce, a neck that sways late and far (secondary motion with long lag), a tail that follows the hips.
- Movements: walk, a slow turn, rear up to reach (neck high), a head swing.
- Presets: sauropod, ceratopsian, a lighter armoured walker.

**What these need from the rest of the plan**
- **Attachments:** feathers, crests, frills, saddles and armour plates are attachments, so the attachable parts for each figure come from its description. Boundary anchors on the neck and tail are what make a frill or a row of plates easy.
- **Secondary motion (physics section C):** tails, necks, feather fans and frills are the main users. The theropod tail and the sauropod neck should be the first test cases.
- **Interface:** the Figure menu grows from two to five. The Parts tab must group by body region, not by a fixed list, and the preset menu must be per figure.
- **Reference:** none of these is in the PDF. They would be built from general anatomy and published gait studies. Footfall order and timing will be written into the figure description and tested, the way the dog's walk and gallop were.

**Order:** the legged-figure description first (moving the dog onto it as the proof), then the theropod (closest to a bird, one pair of legs), then the bird, then the quadruped.

**Overlaps to watch:** the bird's wing and the human's arm share the shoulder and wrist structure; the dino arms and the human arms do too. Parts should share channel definitions where they really are the same motion, and be separate where they are not, so a change to the human arm does not move a wing.

## Suggestions, in the order I would do them

### Small and valuable

1. **Undo and redo everywhere. Done.** Header buttons and Ctrl or Cmd + Z. A snapshot stack of the settings: sliders, drawn curves, lanes, movements, saved performances and the figure choice. Changes less than a quarter of a second apart (a slider drag, a recorded take) are one step. The camera and the sampler are left out; the cut window keeps its own undo.
2. **Secondary motion on its own clock. Done.** Every channel has a Free running tick (under Repeats, offset, shift, free). It follows the timeline frame instead of the walk phase, so it carries on when the walk slows or stops. The dog's Walk to stop now stops the cycle completely and sets the tail and ears to free running.
3. **Lane tools. Done.** In the lane pop-out: Copy span and Paste at playhead, Loop span to end, Earlier and Later by a number of frames, Copy to other side, and Bake playhead into curve (draws the channel as it looks at the playhead into a one-cycle curve and removes the lanes).
4. **A reference picture under the figure. Done.** Guides tab: add a picture, then Opacity, Size, Left and right, Up and down, a Ground line (where its feet touch the ground), Flip, and an option to include it in exports. It is kept in the browser between visits, shrunk to 1400 pixels, and is not part of undo or the settings file.
5. **Named performances. Done.** Auto tab, Saved performances: Save current under a name, Load and Delete. Each figure has its own list. Saving and deleting are undoable.
6. **Export what the lanes say. Done.** Export tab: Lane data (CSV and JSON), one row per frame with the cycle phase, position and every lane. Key poses only: a zip of just the frames where a tracked point (head, hips, hands, feet or paws, tail tip) turns round, or a foot lands, with key_poses.json saying why each was chosen.

### Medium

7. **Pin a hand, foot or paw to the world.** Today the legs are planted by IK but a hand or a mouth cannot be held on an object. Pins with blend in and out make Reach for and Pick up land exactly on a target, and make steps, ledges and a hand on a rail possible. Medium.
8. **Props and ground height.** A target object to reach for or pick up, steps, a slope. The clips then aim at the object instead of at fixed values. Medium.
9. **Heading and path.** Automate the direction the figure faces, so it can turn a corner or walk a curve, with the feet still planted. Medium.
10. **More movements.** Human: run, jog, skip, sneak, limp, carry a weight, sit, stand up, jump. Dog: trot-to-gallop, sit, lie down, jump, shake, sniff the ground. Each is a clip, so they are ordinary lanes you can edit. Medium each.
11. **More figures.** The dog shows the pattern: a pose function, a channel list, a drawing function, clips. A child, a cat, a horse and a bird are each a few hundred lines, not a rewrite. Medium each.
12. **Clip blending.** Overlap two clips, and stretch a clip in time while keeping its shape. Medium.

### Needs real hardware

13. **An iPad pass.** Everything is tested with emulated touch in Chromium and WebKit, which proves the logic, not the feel. Check the real device: pinch and orbit, two-finger gestures against the divider, Pencil input while drawing curves and lanes, 4K export speed and memory, MP4 in iPadOS Safari, and recording a take while touching a slider.
14. **Pencil pressure and tilt** as a recording input: pressure drives a lane value while you play, which is a better recording control than a slider.

## Physics roadmap

Goal: pick the character up and drop it, trip and fall with real weight, and get more convincing falls, as reference you can trace. The simulation is a way to generate movement. Its result is baked into ordinary lanes and frames, so you can still edit it and export it, and a run can be repeated exactly.

### What it needs first

- **A root with mass.** The figure has no body position of its own apart from the gait. Physics needs a centre of mass with position and velocity that the pose hangs from.
- **Joint rotations as data.** The rigs compute joints by FK and two-bone IK. A ragdoll needs each bone's orientation and limits. The matrices (`Rp`, `R1`..`R3`, `Rn`, `Rh`) already exist per segment, so this is an extraction, not a rewrite.
- **Collision shapes.** The drawing already uses a capsule per limb and an ellipse per torso section. The same shapes, scaled by the proportions, make the colliders.
- **Determinism.** A fixed time step (1/240 s, several substeps per frame), no random numbers except from a seed. Same inputs, same fall. That is what makes a result bakeable and testable.

### Phases

**Phase 0: a ballistic drop with no solver (small).**
A root that follows gravity: `y = y0 + v·t − ½·g·t²`, rotation carried by angular momentum, ground at y = 0. A **Drop** clip: the body is lifted, released, and the pose blends from carried to falling (limbs trailing), lands with a crouch and recovers. It uses root height, pitch and the pose channels, so it already fits the automation lanes. This alone gives "pick up the character and drop it" in a believable, editable form.

**Phase 1: grab and release (small to medium).**
Touch a part to grab it: a spring pulls the grabbed joint to your finger while the rest hangs (pendulum). Release and Phase 0 takes over from the real velocity of your finger, so a flick throws it. Record the take with the same Touch and Latch recorder, so the drag becomes lanes.

**Phase 2: spring chains for secondary motion (medium).** The first version for anything you attach is section C of the next phase above; this phase then covers the figure's own tail, ears and limbs.
Tail, ears, arms and the head as damped springs driven by the root's acceleration. Landing makes the tail whip and the ears flop. Verlet integration, roughly 150 lines, and fully deterministic. The dog gains most here.

**Phase 3: ragdoll (large).**
A rigid body per bone, joint constraints with the limits already implied by each channel's range, ground contact with friction and a little bounce, and an XPBD or sequential-impulse solver. Roughly 600 lines written by hand keeps the app a single offline file. A physics library such as Rapier (compiled to WebAssembly, several hundred kilobytes) is the alternative: faster to a result, heavier, and it needs inlining to stay one file. Falling then comes from the simulation instead of a recipe.

**Phase 4: balance and recovery (large).**
Centre of mass against the support polygon of the planted feet. A trip becomes: toe catches, balance is lost, a protective step or a hand catch tries to recover, and if it cannot the figure goes to ragdoll. A blend from animation to physics and back (stand up) makes the transition. A dog tumbles, a human can fall forward with the arms out or backward.

**Phase 5: authoring (medium).**
Gravity, body mass, stiffness and damping, friction, bounce, slow motion, and a seed with a **Re-roll** button. Cache the run so scrubbing the timeline is instant. **Bake** writes the result into lanes and drawn curves so the physics can be switched off and the movement edited by hand.

### How to test it, before looking at it

- Free fall from height `h` lands at `t = √(2h/g)`.
- Bounce height equals `e²·h` for restitution `e`.
- Momentum is conserved in a release with no ground contact; energy does not grow.
- Joint limits are never exceeded; bone lengths never change.
- The same seed gives byte-identical frames; a different seed differs.
- No NaN, no figure under the ground, no tunnelling at high speed.
- Then the same checks as the rest of the app: both browser engines, emulated touch, a decode of the exported frames.

### Risks

- **Looks wrong, not just is wrong.** A sim can be correct and still look floaty or stiff. Plan on tuning time, and keep the clips as a fallback for reference that must look right.
- **Frame cost on an older iPad.** Substeps at 240 Hz for a dozen bodies is light, but export at 4K multiplies it. Cache and bake.
- **Scope.** This is the largest item here. Phases 0 to 2 give most of the "pick up and drop" and "more physical falling" value for a fraction of the cost of Phase 3.

## Known limits today

- Recording only writes lanes during playback; scrubbing while armed does not record.
- A very long stride on short legs shortens the dog's steps instead of stretching the leg, so the paws slide a little at the extremes.
- Key pose labels (contact, down, passing, up) are the human's and follow the built-in timing; the dog has none.
- Movements are written for a figure standing or walking straight. Applied over another movement they replace the lanes they touch from their start.
- Everything is tested in emulated touch. A physical iPad has not been used.

## Phase: publish on GitHub Pages (Netlify is using too much) (prepared 2026-11-08)

**Done in the project:** the packaged folder is now `site/` (no Netlify files), all paths relative, the security policy and referrer rule inside the page, `.nojekyll` and a `404.html`; the project is self-contained (it no longer reaches into the old Trace Desk folder: the four export helpers and the icons are copied in); `package.json`; a GitHub Actions workflow that tests, builds, packages and publishes; `tests/serve-site.mjs` serves `site/` like Pages, under a sub-path; `tests/deploy-check.mjs` passes at the root and under `/walk-base/` in both engines. **Left:** create the repository, push, and switch Pages to GitHub Actions (DEPLOY.md).

The plan as first written:

Host the app as a free static website from a GitHub repository instead of Netlify.

- Put `walkbase/` in a repository. The app is one built page plus a few files, so Pages can serve the packaged folder as it is (`walkbase/netlify/` today, to be renamed `site/`).
- A GitHub Actions workflow runs the build and the unit tests, then publishes to Pages on every push to the main branch. No server and no build minutes beyond that.
- Relative paths everywhere, because a project site lives under `/<repo>/` and not at the root. The existing deploy check (`tests/deploy-check.mjs`) gets a mode that serves the folder under a sub-path to prove this.
- Keep it working offline: the page already needs nothing from a network; a small service worker would make it installable on the iPad home screen.
- Remove the Netlify-only files (headers and redirects) or translate them: Pages cannot set custom headers, so check nothing depends on them.
- Needs from the user: a GitHub repository (new or existing) and permission to push to it. Nothing is pushed until they say so.

## Phase: head view and lip sync (done, 2026-11-09)

A Speech tab turns typed text into mouth shapes on the timeline. 15 shapes (rest, M B P, F V, TH, L N T D, AH, AE E, EE, OH, OO W, UH, CH SH J, R, S Z, K G), each drawn on the human head's own surface so it turns and foreshortens with the head. English spelling rules plus a short exceptions list (`src/lipsync.js`); keys land on timeline frames, labelled by their code, saved with the settings and carried into every export frame. A Head view (button in the stage bar, or Speech > Look at) centres and zooms the camera on the face; orbit, pan, pinch and zoom out still work. A chart of all 15 shapes lets you hold one on the head to trace. Optional spoken audio uses the device's own voice (its timing is its own).

Limits: human head only (dogs and species have a jaw channel but no mouth shapes); no real phonetics, so odd spellings drift; shapes are discrete per frame with no in-between tweening; no hand editing of single keys yet.

## Next phases (asked for 2026-11-09)

- **More gait control.** The Gait tab is thin. Ideas: separate left and right (limp, uneven stride), step width and toe-out, cadence curve across the cycle, pelvis and shoulder counter-rotation tied to the stride, knee lift and swing path shape, foot roll curve (heel to toe), arm swing offset and elbow path, weight shift side to side, stride from speed (walk to run blend with flight time), terrain (slope, steps), plus a visible gait diagram (stance and swing bars per foot).
- **More proportion adjustments, and a rubber hose model.** Wider proportion sliders for every segment (neck, hands, feet, torso parts, head shape), then a second human model in the 1930s rubber hose style: tube limbs with no joints (bending curves), pie-cut eyes, round gloved hands, circle head, thick even outline, squash and stretch along the limb. Needs research on the style's rules (limb as a bezier hose, no elbows or knees, overlapping and follow-through, bouncy walk cycles on twos or threes) before building.

## Phase: more gait control (done, 2026-11-09)

Gait tab (human): Foot roll (heel comes down over, heel lifts at), Swing (foot is highest at, reaches forward early), Left and right (far foot lands late, time on ground, lift, arm swing: an uneven walk or a limp that keeps every foot planted), a gait chart (which feet are down when, double support, steps a minute, legs a second, stride, uneven steps; the dog and species show four bars and feet in the air), and seven new presets: Limp, Shuffle, March, Stomp, Sneak, Strut, Waddle. Footprints follow the far foot's own timing. Not done: a real run with a flight phase for the human (the walk rig needs its pelvis height rebuilt for that), terrain (slopes and steps), and left and right differences for the dog and species.

## Phase: rubber hose figure and more proportions (done, 2026-11-09)

Research (thin, sources agree on the core): the 1920s to early 1930s style draws limbs as continuous tubes with no elbows or knees, rounded and bendy, with bouncy, elastic movement and squash and stretch to carry weight; characters have big round heads, pie-cut eyes, round gloved hands and big shoes; walks bounce, are drawn on twos, and swing the arms widely. See Esme Duncan's notes on the rubber hose style (esmeduncan.myblog.arts.ac.uk) and the Garagefarm overview (garagefarm.net).

Built: a **Rubber hose** entry in the Figure menu. It is the human rig dressed differently (`model: 'hose'`), so every gait control, movement, lane, curve and the lip sync work on it. Each limb is one smooth tube through its three joints (Limb curve 1 is a single curve with no elbow or knee, 0 is a sharp joint), a pear-shaped body with shorts, a round head with a face patch, pie-cut eyes (or round, or dots), a nose, the full lip-sync mouth, white gloves with a thumb, big round shoes. Squash and stretch: the body swells at the bottom of the bounce and thins at the top. Colours for body, face, gloves, shoes and shorts. Round ears exist as an option and are off. Six walks, all on twos: Bouncy, Strut, Sneak, Skip, Stomp, Tired. It keeps its own proportions (big head, short neck and body, long arms, big hands and feet) apart from the human's.

Nine new proportions for the human and the hose figure: waist length, chest length, upper arm, forearm, hand size, upper leg share (the leg keeps its length, so the walk does not change), foot size, limb thickness, body thickness. Head size goes up to 2.2.

Also: the mouth tongue is now drawn for TH (the tip pokes out over the lower lip), L and R; Play with voice keeps the mouth in step with the device's voice (the voice sets the pace, the mouth starts with it and jumps to each word as the voice reaches it); two Stomp presets no longer lose a foot.

Not done: arms and legs that stretch in length (only their width squashes); follow-through (overlap) on the hands and feet; a tail; a hose version of the animals.

## Phase: scene, terrain, pictures and editing (done, 2026-11-10)

Asked for: terrain, a human run, more movements, heading and path, left and right gait for the animals, a tidier top bar, pictures that bend and sit in the right layers, a scene with more figures and scenery, and Blender-style proportional editing.

Done:
- **Top bar.** The caption of each pop-up now sits beside its value instead of on top of it (it was overlapping and clipping the text). On a narrow screen the caption is dropped so the four pop-ups stay on one row.
- **Pictures.** Four layers (Back, Behind, In front, Top) instead of two, so a picture can be set behind the other leg or arm, or behind or in front of the whole figure. The mannequin no longer shows under a picture: Look > Body under pictures hides the parts a picture sits on (the default), the whole model, or nothing. A picture on the upper leg or upper arm can Bend over the knee or elbow: it is cut into thin slices that follow a smooth curve through the joint, so it bends with the limb instead of staying straight.
- **Proportional editing** (curve editor, automation lanes and the dots on a motion arc). Moving one point also moves the points near it by less the further they are, with a Reach and a falloff (Smooth, Sphere, Root, Linear, Sharp, Constant). The shaded band shows how far it reaches. The setting is remembered. Only values move, so the points keep their order.
- **Scene tab.** Add other figures (any of the seven) each with its own walk, place, depth, facing, size, start point round the cycle and fill colour, and scenery (box, step, wall, fence, pillar, lamp post, ball, tree, rock) with size, turn and colour. Figures follow the playhead, so they work in a cycle, in a performance and in every export. Items are sorted by depth with the main figure. Saved, undoable, in Save settings.
- **Terrain** (human and rubber hose). Ground: flat, slope or steps. Each planted foot stands on the ground where it lands, the swinging foot lifts to clear the next step, the foot tilts to the slope, and the hips ride near the lower foot (the higher leg bends). On uneven ground a plain cycle becomes four cycles so there is room to climb. Presets: Uphill, Downhill, Up the steps, Down the steps. The ground is drawn as a solid profile.
- **Left and right gait for the dog and the animals**: left paws land late, stay down for a different time, lift differently; a Limp preset for the dog; the gait chart and footprints follow each paw.

Not done (still open): a real human run with a flight phase (the walk rig keeps one foot down, min time on ground 0.52); more movements (run, jog, sit, jump); heading and path (turning a corner, walking a curve); rubber hose stretchy limbs and follow-through; terrain for the dog and animals; scenery that the figure can touch (props to reach for, a hand on a rail); dragging figures and scenery on the stage (sliders only today); a picture bending over joints other than the knee and elbow.

## Later the same day (2026-11-10): menus merged, neck segments, hose colour, quick views

- **One Body tab** (id Gait) holds the scene, the gait chart, the walk, the body and the proportions. Section colours say which part: violet scene, blue walk, amber body, sage proportions. The separate Scene tab is gone; each scene row has a remove button, and tapping a figure on the stage selects it. Not done: the other tabs (View, Look, Guides) are not merged yet, and a scene figure cannot be made the main figure.
- **Second figure glitch fixed.** A second walker used its own stride and snapped back at the start of each loop. It now goes a whole number of its own cycles to each of the main figure's, with its stride set to cover the same ground.
- **Sauropod neck segments** (1 to 12 bones, Neck curve, a nodding wave and a sideways wave running up the neck); any dog-rig figure can use them. The sauropod presets use 7.
- **Rubber hose** is one colour (body, shorts, legs, arms) with white outlined gloves and feet and the cream face. Squash and stretch now changes the height as well as the width, about the ground, so the legs and arms stretch at the top of the bounce; the strength control goes up to 2.
- **Outline style** tints the far side (line and fill) with the far-side tint.
- **Top bar** pop-ups are smaller, and Side, Three-quarter, Front, Back and Top are buttons next to the View menu.

## Phase: run, more movements, heading and path, merged View tab (done, 2026-11-10)

- **A real run.** Time on the ground now goes down to 0.25 (it stopped at 0.52), so both feet can be off the ground at once. Presets Jog (6% of the cycle in the air), Run (27%) and Sprint (44%), and a Run for the rubber hose figure. The hips are lowest in the middle of a stance and highest in flight (Down position 0.14 to 0.2); every foot stays reachable through the whole cycle. The Break into a run movement now ends in a real run, and Slow to a walk undoes the new settings too.
- **More movements** (human and rubber hose): Jog, Sprint, Duck, Punch, Clap, Salute.
- **Heading and path.** Heading (Gait tab, Direction) turns the figure to face and walk along a direction; automated, the path curves (the distance walked is turned by the heading at each moment). Movements: Turn right, Turn left, U-turn, Walk a curve, Face straight on (the pace eases through the bend); the dog and the other animals turn too. The camera follows, the ground grid follows, and the figure's drawing, selection, arcs and attachments all follow the path. Limits: feet are planted in the figure's own frame, so in a sharp turn a planted foot slides a little; footprints are hidden while the path bends; the other figures in a scene do not follow the heading, and terrain is measured along the stage, not along the path.
- **One View tab** holds the camera (blue), the look (amber) and the guides (teal); the Look and Guides tabs are gone (old names still work in the code and in the tests).

## Phase: stretchy hose limbs, dragging in the scene, terrain for animals (done, 2026-11-10)

- **Rubber hose follow-through and stretch.** Follow-through: the wrist and hand drag behind the arm, and a swinging foot trails behind the leg and eases back to nothing as it lands and leaves the ground (a planted foot never moves). Stretchy limbs: an arm that reaches grows up to half again as long, and a leg that swings out stretches along the ground, never down through it. Both are Gait tab settings for the rubber hose figure (Follow-through, Stretchy limbs).
- **Dragging in the scene.** Drag a scene figure or a piece of scenery along the ground on the stage; the main figure and pictures on it win over the scene. Along is always possible; depth needs a view from above or an angle. Not done: height (see the next phase).
- **Terrain for the dog and the animals.** Slope and steps work for the dog and the other animals: each paw stands on the ground where it lands, the swinging paw clears the next step, the hips and shoulders ride near the lower paw of their pair, and the back tilts to carry the shoulders. Dog presets Uphill, Downhill, Up the steps. Not done for a flying bird.

## Next phases (asked for 2026-11-10, in the order I would do them)

**A. Selecting and touch controls (do first: everything else leans on it)**
1. **Touch like Procreate.** Two fingers pan and pinch; one finger taps to select and drags to move what is under it; the camera orbit moves to a deliberate gesture (a dedicated Orbit tool, or two-finger twist). Today a single finger on empty space pans or orbits, which fights with selecting. Needs a real iPad to judge.
2. **Select by tap, and context menus act on that object.** Tapping any figure or scenery object makes it the one every menu, panel and context menu applies to (the Body tab, colours, copy, delete, move). A small floating menu next to the selection (Copy, Paste, Duplicate, Delete, Colour, Height). The main figure is just another selectable figure.
3. **Each figure has its own colours.** Fill, line and far-side tint per figure (today these are one setting for the whole stage); the rubber hose colours per figure too.
4. **Move scenery up and down** (a Height slider and a drag handle), so a box can be lifted, a ball dropped from a height, a shelf set.

**B. Working with the file**
5. **Copy and paste.** Copy a figure, an object, a picture attachment, a lane or a span of frames, and paste it (with an offset).
6. **Save.** A clear Save (and Save as) in the File menu with a visible saved or unsaved state; autosave to the browser already exists, so this is about a named file you can keep and reopen.
7. **Help overlay.** A Help button that dims the screen and points at each part (top bar, stage tools, tabs, timeline) with one line each, plus a short list of gestures. Shown once on first visit, always available.

**C. Making loops**
8. **Seamless loop.** One button: find the nearest frame count and phase so the last frame joins the first with no jump, by adjusting the cycle length, the stride to the distance travelled and the start phase (and, for a performance, fading lanes to meet at the ends), then show the join. Checked by a test that compares frame 0 with frame N.

**D. Menu clean-up**
9. **Dark mode dropdowns.** The pop-up menus and the native pickers take the dark theme's background and text.
10. **Remove the Preset dropdown for poses and keep labels off.** The pose labels (Cn, Dn, Pn, Un on the timeline) default to off and the pose pop-up is removed from the top bar.
11. **Do we need layers?** A recommendation, not a build: not a full layer system. Three things already act as layers (figures, scenery, pictures) and the Scene list is the layer list. Worth adding: show or hide and lock per item, and drag to reorder depth within the Scene section. Revisit only if drawings (not figures) become something you paint.

**E. More gait variety**
12. **Noise and variety.** Small, repeatable randomness so a walk is not a metronome: wobble in stride length, step timing, bounce, hip sway, head, arms and hands, each with an amount and a speed (smooth noise, not jitter), a seed so a take can be repeated, and a Make it a loop option that keeps the noise periodic. Other body and gait ideas: a tired walk that sags over time, a weight carried on one side, a heel-to-toe and a flat-footed choice, an arm-swing phase shift, a drunk or wobbly walk (sway and stagger), and a mood slider that moves several settings together (happy, sad, sneaky, proud).

## Added to the phases (asked for 2026-11-10, later)

Both lists are fitted into the lettered phases above.

**A. Selecting and touch controls**
- **PC pivot.** Ctrl and the middle mouse button pivot the camera, as in Blender: Ctrl + middle-drag orbits, middle-drag pans, the wheel zooms. Today the wheel zooms and a drag orbits or pans.
- **Bug to look at first: no arm or hand in the Attach pop-up.** The code lists Upper arm, Forearm and Hand (both sides) as places to attach, so find out when the pop-up leaves them out (a selected shoulder, the rubber hose figure, a part with a picture already on it, or a stale selection) and fix it.
- **Character attribute reset.** A Reset button on the Body tab for the selected figure: reset gait, body proportions, colours or all, each undoable, with a confirm for All. Today only each slider has its own reset.

**B. Working with the file**
- **Import scenery pictures.** Bring in a JPG, PNG or similar as a piece of scenery: a flat cut-out standing on the ground, with Along, Depth, Height, Size and Turn, sorted by depth with the figures, saved with the file. Optional: a crop and a tolerance to cut out a plain background.
- **Conform a picture of someone to the model.** Today a picture bends over one joint. Next: put pins on a picture (head, shoulders, elbows, wrists, hips, knees, ankles), tie each pin to the matching joint of the figure, and warp the picture (a mesh of triangles) so it follows the figure as it walks. A helper places the pins from a photo of a standing person. Needs a triangle mesh draw (canvas has none, so slices or WebGL) and a way to keep the far limbs behind.

**E. More gait**
- **Weight.** One Weight slider for the sense of heaviness: a slower cadence, a longer time on the ground, a deeper and later down position, smaller and slower foot lifts, heavier landings (a small pause and a drop at contact), arms swinging less, the head and chest lagging. Light does the opposite. Presets Heavy and Light, set per figure.
- **Stumble.** A movement: the toe catches, the body pitches forward, the arms fling out, a quick recovery step and straighten (or a fall, in the physics phase). Variants: trip on a step, slip, stagger. Uses Weight and Terrain.

**F. The scene**
- **Physics for scenery.** Props that can be dropped, pushed and bounce: gravity, a floor, bounce and friction per prop, a push from a foot or hand; the result is baked into ordinary lanes so it can be repeated and edited (see the physics roadmap). Start with a ball dropped from a height, then a box pushed over.
- **Line-drawn scenery.** Make trees (then rocks, a lamp post, fences) in the same line-drawn style as the figures: an outline in the line colour with a light fill, trunk and branch strokes, a canopy of overlapping round shapes, and the same Outline, Stick and Silhouette styles as the figure, so a scene matches whatever style is chosen. Keep the look of the current graphics.

**G. Menu clean-up**
- **Remove the gait chart** from the Body tab (it takes the top of the panel). Keep its numbers (feet down, steps a minute) as a one-line summary.

**F. Physics for the figures (added 2026-11-10)**
- **Swing and hang.** The figure holds a bar, a rope or a ledge with one or both hands and swings on it: a pendulum from the grip, the body hanging from the arms, legs trailing and swinging, a push to start and a damping so it settles. Controls: grip point (a scenery object or a height), rope length, push, damping. Needs the hand pinned to a point in the world (the pin idea in the first suggestions list).
- **Fall.** A drop from a height or a trip into a fall: gravity on the body, limbs flung and then going slack, a landing on the ground or on scenery, a bounce or roll and a settle. The stumble movement can hand over to it. Variants: backward, forward, off a ledge.
- **Hop.** A real ballistic hop and jump: push off, flight on a parabola with the body and limbs following it, a landing that takes the weight (knees give, arms swing) and a settle. One-footed and two-footed, a series of hops, and a hop with a landing on a step. It uses the same flight phase as the run, so the body height in the air comes from gravity, not a drawn curve.
- **How.** One simple body simulation (a chain of bones with gravity, joint limits and a damping), run ahead of time over the whole performance like the cape and hair already are, and baked into ordinary lanes so a result can be repeated, edited and exported. Test it before looking at it: energy never grows, a dropped body lands, and a run of the same take is identical. This is the physics roadmap's first phase for the figures (see Physics roadmap above); the scenery physics (a ball dropped, a box pushed) uses the same engine, so build the engine once.
