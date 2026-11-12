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

## Added to the phases (asked for 2026-11-10, later still)

**H. Characters and looks**
- **Mouth customisation.** Pick the mouth style and edit it: line, open mouth with teeth and tongue, a simple curve, a cartoon mouth; lip thickness, width and corner shape, the colours of lips, teeth, tongue and the inside; a mouth for each of the 15 lip-sync shapes that can be redrawn by hand (drag the lip points) and saved with the character. Works on the mannequin and the rubber hose figure, and per figure.
- **Eye customisation.** Eye style (dots, round, pie-cut, almond, closed lines), size, spacing and height on the head, pupil position and look direction, eyelids and blinks (a blink lane, automatic blinks with a rate), eyebrows (shape, thickness, raise and furrow for expression), colours. Per figure.
- **Different hand and foot styles.** Hands: the round glove, a mitten with a thumb, a simple fist, a hand with fingers (spread, relaxed, pointing, gripping) and a hand pose per movement. Feet: the shoe, a bare foot, a boot, a hose-style round foot, a paw or a hoof for the animals. Chosen per figure, with size and colour.
- **Art styles, leaning into Moebius (Jean Giraud).** A style that draws the figure as a clean ink line drawing: a thin, even, confident line with a slight taper, flat soft colour (muted sky blues, sand, sage and coral), shading by fine parallel hatching and cross-hatching on the side away from the light instead of a grey tint, stipple dots for texture, and long thin lines for the ground and horizon with wide empty space. Features: Hatching (angle, density, how far round the form it reaches), Line weight variation, Stipple, a light direction control, and a paper background. Applies to the figure, the scenery (the line-drawn trees) and the ground, and to the Outline, Stick and Silhouette styles. Other styles to follow in the same place: a rubber hose ink look with a rough line, a comic book look with flat colour and a thick line, and a pencil sketch.

## Phase A started (2026-11-10): touch, pivot, attach fix, scenery height, figure colours

Done: a Select tool is the default (one finger taps to select and drags what it touches; only two fingers pan and zoom, and the Orbit and Pan tools stay for one-finger camera moves); on a mouse the middle button pivots the camera and Shift with it pans; pictures attached to the rubber hose figure now go with its stretched arms, trailing hands and feet (they were left behind when the limbs stretched, which is why attaching to a hose hand or arm seemed not to work); a selected shoulder carries a picture on the upper arm; scenery can be raised and lowered (Raise); each scene figure has its own fill, line and far-side tint. Still to do in A: context menus on the selected object, and the main figure's colours as a per-figure setting.

## Phase A finished (2026-11-10): menus on the selected object, and colours for every figure

- **Context menus.** Right-click, or press and hold a finger still (about half a second; moving first cancels it), opens a menu for whatever is under the pointer, and every item acts on that object: a picture (Edit, Duplicate, Copy to the other side, the four layers, Hide, Delete), a part of the main figure (select and open its settings, attach a shape here, attach a picture here), a figure or piece of scenery in the scene (Select, Duplicate, Raise and Lower for scenery, Hide, Remove) or the empty stage (Fit to the window, Look at the head, Hide the scene).
- **Colours for every figure.** The main figure is the first row of the Scene list, with its own fill, line and far-side tint; each other figure has its own. A hint on each row.
- Phase A is done apart from judging touch on a real iPad. Next phases in order: B (copy and paste, save, help overlay), C (seamless loop), D (menu clean-up), E (gait: weight, stumble, noise).

## Phase B done (2026-11-10): copy and paste, save, help

- **Copy and paste.** Ctrl+C, Ctrl+V, Ctrl+D (Duplicate) and Delete, also in the Edit menu and the right-click and press-and-hold menus. It copies what is selected: a picture or shape (pasted onto the selected part, or the part it came from), a figure or scenery in the scene, and with nothing selected the main figure itself, which pastes into the scene as another figure with its walk, proportions and colours. The clipboard is kept in the browser, so it survives a reload.
- **Save.** File > Save (Ctrl+S) saves under the current name and File > Save as asks for a name (the name is stored in the file and shown in the window title); Open reads a file back under its own name. A small note beside the name says Unsaved changes after an edit and Saved after a save, and a browser that is set to start clean warns before it closes on unsaved changes.
- **Help.** The ? button (or F1 or ?) draws numbered boxes on the top bar, the stage tools, the stage, the tabs and the timeline with a card that says what each does, the gestures and the keys. It opens by itself once, on a first visit.
- Not done: copying a lane or a span of frames, and copy and paste between two open pages as text (it goes through the browser's storage, not the system clipboard).

## Phase C done (2026-11-10): seamless loop

A Loop button in the transport bar (and Performance > Make a seamless loop) adjusts the frames so the last frame leads straight back into the first:
- the cycle is made a whole number of drawings at the current exposure;
- a performance (automation lanes) is made a whole number of cycles long, every lane eases back to where it started over the last few frames, and the pace (the cadence lane) is trimmed a fraction so the walk arrives back at exactly the same point of its stride;
- a plain cycle already repeats exactly, so there it only fits the exposure.
It says what it changed and how smooth the join is: the step from the last frame to the first, as a share of the biggest step between other frames (1 or less is seamless). One Undo puts it back. A test checks that a drifting performance has a jump at the join and none after.
Limits: terrain and a turning path do not repeat (the figure's movement does, the ground does not, and it says so); a figure that runs free (a channel set to Free running with a frequency that is not a whole number) may still drift; the scene's other figures take a whole number of their own cycles to each of the main figure's, so they loop with it.

## Phase D done (2026-11-10): menu clean-up and layers

- **Dark mode dropdowns.** The theme you choose (Light, Dark, or follow the device) now also decides how the browser draws its own pop-up lists and pickers, so the Figure, Preset, Speed and Source lists and every other drop-down are dark in the dark theme whatever the device is set to.
- **Poses.** The pose labels on the stage (CONTACT, DOWN, PASSING, UP) are off by default. The Poses group of settings is gone from the View tab (and Foot labels with it); the labels are one item in the View menu, Pose labels on the stage.
- **Layers.** No full layer system: figures, scenery and pictures already act as layers. The Scene list is the layer list, nearest at the top and furthest at the bottom; each row has an eye (show or hide), a lock (it cannot be dragged, moved or removed), and Bring forward and Send back (which move it nearer or further, so the order is the real depth). Right-click has Lock and Unlock too. Pictures on a figure keep their four layers (Back, Behind, In front, Top).

## Fix (2026-11-10): a kink at the loop join when a cape or hair is attached

A swinging strip (cape or hair) was simulated through six warm-up cycles, which left it a little off from where the next cycle would start, so the join between the last and first frame had a small kink. It now warms up through thirty cycles and then spreads what is left over the cycle so the last frame leads exactly into the first. Pictures and shapes follow the body directly and always loop. A test checks the join is no sharper than the sharpest bend elsewhere, for three kinds of strip.

## Fix (2026-11-10): a pop at the loop join on the rubber hose figure

The rubber hose leg stretched only while the foot was off the ground, and the stretch was switched on and off at the moment a foot landed or left it. The loop starts at a foot landing, so the leg (and anything attached to it) jumped by about a seventh of a leg length at the join. The stretch now fades in and out over the swing. A test samples every walk at 960 steps a cycle and checks that no joint jumps.

## Phase E done (2026-11-10): weight, variety, stumbles, reset

- **Weight** (Gait tab, one slider from -1 to 1; the figure, the animals and every walk). Heavy: longer on the ground, lower and flatter feet, a deeper drop into each step, shorter steps, less arm swing, more heel strike, a forward lean and more hip roll and head nod. Light: the other way round. It is applied once, in one place, so the gait chart numbers, the footprints, the curve guides and the drawing all agree; every walk still keeps both feet reachable at the heaviest and lightest. Presets Heavy and Light for the human and the dog (set a longer Cycle length for slow, which the presets do). The old Heavy preset is replaced by the weight-based one.
- **Variety** (noise). Noise amount, Noise speed, Noise seed and Keep the wobble looping. Small smooth wobble in the bounce, sway, hips, back, head and arms (and for the animals the back, neck, head and tail); the same seed always gives the same take. With looping on, the wobble repeats every cycle exactly so a loop stays seamless; with it off it drifts from cycle to cycle over a performance (the Loop button turns it back on).
- **Stumble, Slip, Stagger** movements (Action group; the human and the rubber hose figure). Stumble: a toe catches, the body pitches forward, the arms fling up and out, a quick short step, recover. Slip: a foot slides out, the hips drop, the body leans back, the arms fling out, regain balance. Stagger: the body rocks side to side with short uneven steps, then steadies. Each pairs with Weight and Terrain; all keep the feet reachable.
- **The gait chart is gone** from the Body tab; its numbers are one line (both feet down, steps a minute, speed, stride) that updates as you drag a slider.
- **Reset.** Select a figure in the Scene list (the main one is the first row) and choose Reset: the walk (gait, weight and variety), the body (proportions), the colours, or everything (with a confirm). Undoable.
Not done: a mood slider that moves several settings together, a tired walk that sags over time, and carrying a weight on one side. A fall after a stumble waits for the physics phase.

## Done (2026-11-10, later): scenery pictures, line-drawn trees, Moebius style, longer performances, wider ranges

- **Scenery pictures.** Add scenery > Picture… takes a JPG, PNG or similar (photos are kept as JPEG, a PNG keeps its transparency; shrunk to 1400 pixels) and stands it on the ground as a flat cut-out with Along, Depth, Raise, Width, Turn and Flip, depth-sorted with the figures. Cut out the background makes the plain colour in the picture's corners transparent, with a Tolerance slider and a soft edge, and Undo brings it back. The pictures are kept between visits and saved in the settings file.
- **Line-drawn scenery.** Tree, Pine and Bush are drawn as line work like the figure: a thick outline round the whole shape with the fill laid over the inside lines so only the outer edge shows, bark strokes, leaf marks, the same every frame, facing the camera as a drawing does. They follow the figure's drawing style (outline, bare lines, solid shape). An old saved tree becomes a line-drawn one.
- **Moebius art style.** A new Style in View > Figure: a thin ink line round the figure, flat soft colour, and shading by fine hatching, cross-hatching and a few dots on the side away from the light, on a paper-coloured stage. Light direction, Hatch angle, Hatch spacing, Shadow reach, Stipple and Paper-coloured stage are in the Moebius style group. Choosing it the first time brings sand, sky-grey and dark-ink colours (if the colours were still the defaults). It works on the mannequin, the rubber hose figure and the animals. Not done: varying the weight of the line along its length, hatching on the scenery, and the other art styles (a rubber hose ink look, comic book, pencil sketch).
- **Longer performances.** A performance can now be up to ten minutes (14,400 frames at 24 a second; it was 100 seconds). Set length has 2, 4, 6, 8, 16, 32 and 64 cycles and 30 seconds, 1, 2, 5 and 10 minutes (whole cycles, so it still loops). Past 1,200 frames the timeline strip has one cell for several frames, labelled in seconds, so a long performance stays quick.
- **Wider ranges.** Signed sliders go twice as far each way (a lean of -30 to 60 degrees, arm swing to 120 degrees, knees out to -30), sliders in degrees, leg lengths and heights go twice as far up, proportions run from 0.6 of their smallest to 1.8 of their largest, every part's Offset goes twice as far each way and Amount up to 6 times. Fractions with a natural limit (time on the ground, heel timing), counts, Weight, Heading and the terrain are left as they were. Pushing a slider to the end can make a foot unreachable; the legs stretch no further than they can.

## Done (2026-11-10, later still): the loop is seamless in the drawing, not only in the numbers

- **Onion skin over the join.** Ghost figures past the last frame stood a whole stride away from the figure; they now keep their place beside it, so the ghosts and the figure agree at the wrap.
- **Looped performances.** A performance made into a loop now repeats its ground grid and footprints with the walk, and capes, hair and tails are warmed up through laps of it and eased so the last frame leads into the first.
- **Across the screen cannot loop.** Pressing Loop with the camera set to Across switches it to Follow and says so.
- **Whole drawings.** With drawings held for two or three frames, the cycle length stays a whole number of drawings, so the last drawing is not held for less time.
- Checked by comparing the picture at the wrap with the picture between any two other frames, in onion skin, performance, cape and exposure cases (ui-file test; striploop unit test).

## Done (2026-11-10, night): scenery physics (first pass), hand and foot styles

- **Scenery that falls and bounces.** A box, step, wall, fence, ball or rock has a Physics choice in This scenery. Drop: at its start frame it falls from its Raise height, bounces lower each time and comes to rest; Throw sends it along (a ball rolls on, a box scrapes to a stop); Bounce and Friction set how. Push over (boxes): it turns about its bottom edge and lands on its side; Push 1 is just enough to reach the point of balance, less and it rocks back, negative goes the other way. Worked out ahead of time from the prop's own numbers (`src/propphys.js`), so the same settings always give the same motion and any frame can be shown at once. Tested: bounces never gain height, a dropped ball lands and stays, a tipped box rests on the ground.
- Not done: a push from a foot or a hand (the start is a frame number), props hitting each other or standing on one another, terrain under a prop (the floor is flat), a ball that visibly spins, and baking the result into lanes. In a plain cycle the motion starts again with the cycle, so a longer take needs a performance.
- **Hand styles** (View > Figure > Hands): default (the figure's own), mitten, fist, fingers, pointing. **Foot styles** (Feet): default, boot, bare (with toes), round. On the mannequin and the rubber hose figure, in every drawing style. Not done: per figure (one choice for the stage), a hand pose per movement, gripping, paws and hooves for the animals.
- Still open from the lists above: physics for the figures (swing and hang, fall, hop), conforming a picture to the model with pins and a mesh, mouth and eye customisation, the other art styles, a mood slider, a tired walk, carrying a weight.

## Done (2026-11-11): more rubber hose: controls, a horse and a bird, wobbly walks and movements

- **Wobble.** Body tab > Rubber hose: Wobble (a wave runs along every arm, leg, neck and tail and bends it like jelly; hands and feet stay put) and Wobbles per cycle (whole numbers, so a cycle still loops). They are walk settings, so presets, movements and automation lanes can drive them.
- **More look controls** (View > Rubber hose): Limb taper (thick at the body or thick at the end), Belly, and Tail (a thin tail that swings and wobbles) for the person.
- **Horse** (a new figure on the dog's rig): Walk, Trot, Canter, Gallop, Grazing, Prance. First pass: the proportions want tuning against reference, and it has the dog's movements.
- **Rubber hose horse and Rubber hose bird.** The same bones and gaits as the horse and the bird, drawn the rubber hose way: every leg one tube with no knee or hock, tube neck and tail, a sausage body, a ball head with a pale muzzle or a beak and a round eye, floppy wings. They use the rubber hose colours, limb thickness, curve, taper and belly. Presets: Bouncy, Walk, Wobbly, Jelly legs, Gallop, Prance for the horse; Strut, Hop, Wobbly, Run, Flying, Flapping for the bird. A species can now be `like` another (`src/dogdefaults.js`), so a rubber hose dog or dinosaur is a few lines.
- **Wobbly walks** for the rubber hose person: Wobbly, Jelly legs, Noodle arms, Drunk, Boing.
- **Wobbly movements** (Auto > Movements > Wobbly, rubber hose figures only): Go wobbly, Firm up, Wobble like jelly, Noodle arms, Jelly legs, Shimmy, Boing; the animals have Go wobbly, Firm up, Wobble like jelly, Jelly legs and Boing.
- Not done: squash and stretch of the body for the rubber hose animals, pie-cut eyes and a mouth on them, a mane, wobble on the body itself (only limbs, neck, ears and tail), rubber hose versions of the dog and the dinosaurs.
- **Later the same day.** The rubber hose figure's first walk (Bouncy) is slower: a cycle of 20 frames, not 12. A **Length** button beside Loop on the transport bar sets how long the playback runs (2 to 64 cycles, or 30 seconds to 10 minutes) without changing the speed of the walk; it is the same menu as Auto > Length > Set length. The browser tests now run six at a time (under two minutes for all 34 runs).

## Done (2026-11-11, later): eyes, eyebrows and mouth styles; horse head fix

- **Eyes** (Speech tab > Eyes, for the mannequin and the rubber hose figure): Eye style (default, dots, round, pie, almond, closed), Eye size, Eye spacing, Eye height, Look across, Look up or down, Eyelids, Blinks per cycle (whole numbers, so a cycle loops; the eyes are open on the first frame), Eye colour. Default keeps each figure's own eyes.
- **Eyebrows**: none, line, thick, arched, with Raise and Furrow (positive is angry, negative is worried). On the rubber hose head they are in the pale face colour, since they sit on the dark of the head.
- **Mouth**: Show the mouth (the mannequin can have one all the time, not only while speaking), Mouth style (full, line, curve, cartoon), Mouth width, Lip thickness, Smile (lifts or drops the corners through every mouth shape of the speech), and the colours of the lips, teeth, tongue and the inside.
- The face settings are stage settings (one face for the stage), drawn in `src/face.js` and `src/mouth.js`; they are hidden for the animals.
- Not done: a face per figure in the scene, redrawing each of the 15 mouth shapes by hand, a blink lane and expression lanes for automation (the settings are not animatable yet), eyelashes, a nose choice, faces for the animals.
- **Horse heads.** The jaw was drawn through the muzzle and the ears sat as blobs on the skull. The horse has a deeper muzzle with the jaw tucked behind it and small pointed ears; the rubber hose animals' heads are layered from the head ball (ears and jaw behind, muzzle growing out of it, eye on the side of the ball).

## Done (2026-11-11, night): mood pad, posture, carrying, three art styles, tidier menus

- **Mood pad** (Body tab > Mood, `src/mood.js`). A square with a mood in each corner: Happy, Angry, Tired and Sneaky to start. The middle is the walk as it is; dragging the dot toward a corner turns the walk into that mood, and along an edge it mixes the two moods on it. A readout says the mix. Each corner can be any mood (Happy, Angry, Tired, Sneaky, Sad, Proud, Scared, Dreamy), any of the figure's own walks, or a walk captured from the sliders (Use this walk as a corner). What the pad moves lists every setting the corners touch, each with a tick to leave it out. A mood is a change to the walk in the middle, so a happy limp is still a limp; a slider moved while the dot is off centre moves the middle too; choosing a walk or another figure puts the dot back. The dog and the other animals have the pad with their own moods. Arrow keys move the dot.
- **Posture** (Body tab): Lean to the side, Chest out or slouch, Look down or up, Head turned, Arms forward or back, and Carrying a load (a heavy bag in one hand: that arm hangs straight and still, the body leans away, the other arm comes out). Walks: Carrying a bag, Slouch, Chest out, Looking back.
- **Moods over time** (Auto > Movements > Mood): Get tired (a long slide into a tired walk, with the cadence slowing), Perk up, Cheer up, Get angry, Go sneaky.
- **Art styles** (View > Figure > Style): Comic (flat colour inside a heavy line, printed dots for the shadow), Ink (a rough brush line that swells and thins), Pencil (a pale wash, light hatching, the outline gone over three times). The light direction and shadow reach of the Moebius group set the shading of Comic and Pencil. Faces show in all three.
- **Figure menu in groups**: People, Animals, Dinosaurs, Rubber hose animals (the same groups, with dividers, in Add figure).
- **Body tab layout audited** (`BODY_LAYOUT` in `src/controls.js`): one part of the body, one group. Far arm swing, Arms out and Shoulder counter-twist are with the arms (Shoulders and arms); Feet width and Toe out are with the Stride; Head keeps facing is with the Head; Hip bob, Down position and Weight are one group (Bounce and weight); the three foot groups are one (Feet); the rubber hose settings are together. Hips and legs, Left and right feet, Feet, Variety, Direction and Ground start folded. A test fails if a new setting has no place or a group is split.
- Not done: moving the pad while recording does not write automation (use the Mood movements for a change over time); the pad's corners are not saved per figure; the line weight of Moebius still does not vary; no hatching on scenery; the dog's groups have not had the same audit.

## Done (2026-11-12): pad bank, and one Feet group

- **Pads** (Body tab > Pads, `src/pads.js`). Eight pads for each figure, like the pads of a drum machine, each holding a whole walk: every gait and body setting, and where the mood pad was (its dot, its corners and the walk in its middle). Tap an empty pad to keep the walk as it is now on it; tap a full pad and the figure changes to its walk. Store then a pad overwrites it, Clear then a pad empties it, and the pad that is on can be named.
- **How it changes.** Change: Now, or End of cycle (the pad waits, pulsing, until the walk comes round to its first frame, so the change lands on the beat). Blend over: Cut, half a cycle, 1, 2 or 4 cycles of the walk that is playing, eased in and out. The cycle length blends too, keeping the same place in the step. Choices that cannot be blended (the dog's gait, the ground, whole-number settings) switch at the start. Paused, the blend still plays out on its own clock.
- **Recording.** With Rec on, a pad's blend is written into the take as automation, so a run of pad taps becomes a performance that plays back and exports. Use Latch, so each walk holds until the next pad. The cycle length is not written (speed in a take is the cadence lane).
- **Banks.** The bank of each figure is kept with the settings and in the settings file. Save bank writes a `.padbank.json` file and Load bank reads one (for the same kind of figure).
- **Feet.** The far foot against the near one (lands late, time on ground, lift) is in the Feet group with the rest; there is no separate left and right group.
- Not done: more than eight pads or several banks side by side; number keys for the pads; a pad that plays a movement (a stumble, a jump) rather than holding a walk; recording a moving path of the mood dot onto a pad (a pad holds where the dot was, not a gesture); pads for figures in the scene.

## Done (2026-11-12, later): hover help, recording the mood pad and pads, guide and read-me

- **Help on hover.** With a mouse, resting the pointer on any slider or choice shows its line of help beside the row (on the stage side, so it never covers the control). It follows a moving mouse only, so a panel that redraws after a click shows nothing. Touch still opens the help by tapping the name.
- **The mood pad records.** With Rec on, dragging the mood dot writes its path into the take as automation, like a slider, and leaves the walk underneath alone. It follows the recording mode: Touch glides back when you let go, Latch holds until you pause.
- **Pads hold when recorded.** A pad tapped in a take writes its blend and then stays to the end of the performance, in Touch and in Latch (`Recorder.touch(..., { hold: true })`), since a pad is a change of walk and not a gesture.
- **Store and Clear flash the pads** until one is chosen, so it is plain where the walk will go.
- **Guide.** The ? guide points at the mood pad and the pads and has a How to list: recording the mood pad and the pads, making the playback longer, changing or undoing a take, and help for one control. The read-me has a section on moods, pads and recording them.
- **Leg length** (Body tab > Proportions) for the human and the rubber hose figure: scales both legs. The steps stay the same length; the hips ride higher on longer legs with the knees keeping their bend, and lower on shorter ones. Not done: the stage does not re-frame, so very long legs can put the head off the top (lower Figure size in View, or zoom out); the dog has its own Leg length already.

## Done (2026-11-12, night): audit, a pad's pace in a take, three more looks

- **Audit of the screen and the program.** Every tab was opened for the human, the rubber hose figure and the dog at desktop, tablet and phone sizes, in light and dark, and checked by a script for sideways scrolling, controls sticking out of the panel, cut-off text, controls with no name, repeated ids, repeated group titles and console messages. All of those came back clean. What it did find, and what was done:
  - **A bug:** a human reached by way of the dog was left with the rubber hose figure's walk (drawn on twos, a 20 frame cycle) under the name Normal. Every figure now keeps its own walk, its preset name, its proportions and its performance when you switch away and back; a figure not seen before starts on its first walk.
  - The eight (now eleven) drawing styles wrapped raggedly over four rows. A choice with five or more options is now an even grid, with every name in full.
  - The Speech and View tabs had grown long. Eyebrows, Mouth, Moebius style, Pictures and Pivot around the figure now start folded.
  - On a wide panel (a tablet held upright) the four mood corners sit side by side instead of in one tall column.
  - The read-me's figure section still said two figures.
- **Left as found:** on a phone the stage tools take two rows over a small stage, the names in the top bar's menus are cut short (Huma, Norm), and the Body tab is about 17 screens long. The app is made for a tablet and a desktop; a phone layout is its own piece of work. The dog's groups have not been regrouped the way the people's were.
- **A pad's pace is recorded.** A take keeps one cycle length, so a pad whose walk is quicker or slower is written as the speed lane (a 16 frame walk tapped over a 24 frame one is speed 1.5) and holds with the rest of the pad.
- **Three more looks** (View > Figure > Style): **Clay** (rounded: lit from one side, falling smoothly into shade, with a highlight and thin contour lines that follow each form), **Lowpoly** (flat facets with straight edges) and **Blocks** (square blocks on a grid, like voxels or pixel art). They take the light direction from the Moebius style group and work on every figure.
- Not done: true 3D voxels or a mesh (these are looks painted on the same flat shapes); contour lines that wrap round a limb's axis rather than its outline; a block size control.

## Done (2026-11-12, later still): Lowpoly as a solid, Block size, Clay to the edge

- **Lowpoly is a 3D model now** (`src/lowpoly.js`). Every limb, the neck, the tail, the head and the body sections are built in the figure's own 3D space as prisms with a set number of flat sides, ending in blunt points. The faces turn with the camera, the ones facing away are left out, and each is lit by the way it really faces (in 3D, from the light direction of the Moebius group), so the figure reads as a faceted model and not as a drawing. A creased edge is drawn between facets. Facets round each limb (4 to 12; 4 is a box, 12 nearly round) is in View > Blocks and facets. Works on the mannequin, the rubber hose figure and every animal. Not done: the hands, feet and skull still use the earlier flat fan of facets; a rubber hose limb's wobble is not shown in this look; no shadow on the ground.
- **Block size** (View > Blocks and facets): the side of each block in the Blocks look, 3 to 40 pixels.
- **Clay is soft to the edge** (`src/clay.js`). The outline of every form is rounded at the corners and a little lumpy, as if shaped by hand, on top of the lit shading and contour lines. The lumps are tied to each shape's own long axis, so a limb that turns carries its lumps with it and nothing shimmers. Not done: a control for how lumpy; thumbprints and a soft shadow where a foot meets the ground.

## Done (2026-11-13): speech fixed, shadows, the Design tab (skins, UV, sprite sheets), character files, line options, six more animals

- **Speech.** It was working but could not be seen: in the side view (the view the app opens in) the face is edge on, so the mouth cannot be drawn on the body, and the body is small in any view. While there is speech, or a mouth shape is held, a close-up of the face from the front now sits in the corner of the stage (`paintFaceInset`), with the mouth moving word by word, for the human and the rubber hose figure. The voice (Play with voice) was already speaking. Not done: mouth shapes for the animals.
- **Shadows** (View > Shadow). Ground (a soft oval on the floor under every figure and piece of scenery, fainter as the feet leave the ground, flattened enough to see from the level of the ground), Drop (the whole drawing cast down and to the side), or both; strength, softness, colour, drop across and down, ground size. Each attachment has a drop shadow of its own (Attach tab > Drop shadow), each part has one in the Design tab, and each scene figure and prop has a Casts shadow toggle.
- **The Design tab.** The character design engine, first pass. Choose a part (tap it on the stage, or from the list) and give it: its own fill colour, line colour, line weight, opacity, a drop shadow, hiding; a **skin**: a picture laid over the part through its **UV map** (u runs from the joint the part swings from toward its far end, v across it, so the picture turns with the part and stays on it as it swings), with slide, scale, turn and flip, stretch or tile, opacity and blend mode (normal, multiply, screen, overlay); and a **sprite sheet**: columns and rows, a cell to hold, or cells that play (loop, ping-pong, frames per cell), so a part can be coloured frame by frame. A UV preview shows where the part falls on the picture. **Whole figure:** Save a UV template (one cell for every part, with its outline in it) to paint over in another app, then Import painted sheet gives every part its own cell. Copy to the other side, reset a part, remove all skins.
- **Character files** (File > Export this character / Import a character, and in the Design tab). The figure, its walk, proportions, look, motion edits, attachments, design and pads, in one `.character.json` file with the pictures they use. Importing puts the character on the stage as the main figure, changing the figure if it is another kind.
- **Line** (View > Line): Boil (the outline wobbles, a new wobble every few frames, the colour with it), Frames per wobble, Line pattern (solid, dashed, dotted), Corners (round, miter, bevel), Weight by depth (far-side lines lighter), Colour off the line (misregistration). Per part: line colour and weight in the Design tab.
- **Animals.** Lizard, Pterodactyl and Plesiosaur are on the dog rig: the lizard is low and sprawling with a long tail and a bending back; the pterodactyl has a long beak and crest and a leathery wing with a membrane; the plesiosaur has four flippers that beat (hind ones a quarter beat behind), a neck of many bones, and swims. The **Snake**, **Spider** and **Crab** have a rig of their own (`src/crawler.js`, drawn by `src/crawldraw.js`): the snake is a chain of nodes each following the one in front, so a wave runs down it and it slides through its own track, with Wavelength, Wave height and Rear up; the spider has eight legs, two sets of four taking turns, planted by IK; the crab walks sideways on eight legs with two claws that snip (Claw snap). All have walks to choose from, movements to stop, start and turn, adjustable proportions (length, legs, head, and a new Body thickness for the snake, spider and crab) and work in every drawing style. The Figure menu is grouped: People, Animals, Dinosaurs and reptiles, Rubber hose animals.
- Not done: painting on a part inside the app (the UV template goes out to another app for that); skins on scene figures and on attachments' parts; a skin that follows the surface of a limb as it bends (the UV box is flat, so it does not bend with a bent hose limb); mouths and faces for the animals; the plesiosaur's water and the snake's tongue is a flick, not a fork; the snake, spider and crab in the rubber hose style; lowpoly facets for the snake, spider and crab; eight legs' gait is two sets, not yet a spider's wave gait or a crab's pauses; character files carry one figure (not a scene).

## Done (2026-11-12): the Draw tab, drawing on parts and on the whole figure

- **Draw tab.** Pen, Fill shape, Eraser and Pick part, with colour, size and opacity. **One part** mode draws on the chosen part; **Whole figure** mode draws over everything and splits each line between the parts it crosses. Strokes are stored in each part's UV box (the same one skins use), so a drawing turns and moves with its part, in every drawing style, and goes out in character files. Undo, clear a part, clear all, faint part outlines as a guide, and "Use my drawing instead of the part/figure" to hide the stock shapes. Limits: 300 strokes of 500 points per part. Not done: a drawing per frame (one drawing per part, so far), drawing on scene figures and attachments, a drawing that bends with a bent hose limb, a zoomed-in canvas for a single part, drawing a figure from nothing.

## Done (2026-11-12): skins: more picture types, scaling in the preview, sliders that stuck
- Fixed: the skin and shadow sliders worked from the values the panel was drawn with, so moving Scale across undid Scale along. They now change the live values. Scale range is 0.05 to 10.
- New: src/pictures.js (one decoder for every picture file, SVG sizing, file type from the name, video to sprite sheet); the UV preview has a box with handles, a Scale (both ways) slider and Fit to the part.

## Done (2026-11-12): drawing bends, scene figures, attachments, blank figures
- Hose limbs, tails, necks and the snake carry their curve (`spine`), and their UV frame runs along it (design.js `spineFrame`), so strokes and skins bend with them; skins are cut into 24 slices along the curve (no tiling on a bent part yet). Scene figures have their own `design`; attachments have `ink`. Auto-commit on the first line, Hide guide lines, Start from a blank figure.
- Still open: drawing on scenery props, per-frame drawings are one set per part, no freeform canvas that is not on a rig.

## Done (2026-11-12): picking a part, bucket fill, spider wave gait
- Draw tab: the little figure to pick parts on (src/app.js paintPicker, TPOSE), hold-to-pick, tap = dot, bucket fill (ink.js floodRegion, maskLoops, simplifyLoop; a fill stroke is `loops` painted even-odd), drawings painted after all part fills, no selection outline over a drawing. Outline and Ink looks cover the hairline where two fills meet (the faint seam lines on the dinosaurs).
- Spider: a wave gait, each leg stepping in turn from the back of a side to the front, the far side half a cycle behind. The crab keeps two sets of four. Not done: a choice of gait for the spider, and a wave for the crab.

## Done (2026-11-12): physics phase 0, the Drop movement
- **Drop** (Body tab > Movements > Action, for the people and the dog, and the rubber hose figure): the figure is lifted and held, let go, falls under gravity, lands with the knees giving, and stands. The height lane is written frame by frame as the true parabola (`dropHeights` in src/moves.js: y = h - g t^2 / 2, fall time = sqrt(2h/g) at the frame rate, so a higher drop takes longer; Strength sets the height). Tested against the formula, and the fall time scaling.
- Still to do from the physics roadmap: grab and release with a flick (phase 1), spring chains for the figure's own tail and ears (phase 2), ragdoll, balance, authoring. Not done for the other animals' movement lists.

## Done (2026-11-12): brushes
- Nine brushes for the Draw pen (src/ink.js `brushStroke`, names in design.js `BRUSHES`), a `b` on each stroke. Not done: tilt from a pencil (pressure and speed are done: see the pen stroke engine), brush spacing and angle controls, brushes for the filled shape.

## Done (2026-11-12): the pen stroke engine

- Draw pen strokes feel like Procreate's. Input (src/app.js `inkMoves`, `inkFeed`, `inkMove`, `inkEnd`): all the coalesced pointer events between frames; pencil pressure from `event.pressure` (a pen, or a touch whose force is not 0 or 0.5), otherwise width from speed; a stabiliser (src/stroke.js `smoothStep`: spatial exponential lag, the same at any event rate, building up over the first few lengths so the start is true, finishing with the real last point); a long stroke is thinned (`decimate`) and stays one stroke instead of being cut at 500 points. Storage: a point is `[u, v]` or `[u, v, p]` (p the width factor, 0 to 1, two decimals; 0.5 is the width asked for), `tp` (1 start, 2 end) marks a stroke that goes on into another (no taper there); `cleanStroke`, `mapStroke` and `mirrorStroke` keep p. Paint (src/ink.js `ribbon`, stroke.js `densify`, `halfWidths`): a stroke with p on its points and the Round or Brush pen brush is one filled path (Catmull-Rom centre line, quadratic edges, round ends and corners, nonzero fill, so one tone where it overlaps itself) with a soft taper at each end (strong for the Brush pen); every other stroke, and every old one, paints as before. Controls: Pen section, Smoothing slider and Pressure and speed switch (src/app.js `drawSection`). Tests: tests/stroke.test.mjs, tests/ui-stroke.mjs (including touch with force in chromium). Not done: the other brushes (marker, pencil, chalk, soft, dotted, dashed, calligraphy) get the smoothing but not the width variation; tilt; a taper on/off switch; filled shapes and the Shapes tool are not smoothed.

## Done (2026-11-12): more body controls for the animals
- Nine proportions on the dog's rig: separate front and hind leg length (the stance travel and the stand heights use each pair's own length, so the back tilts and every paw is still reached and planted within 0.8 to 1.3), snout length, paw size, and drawn thickness of the body, legs, neck and tail plus ear width (`lookOf` in dogdefaults.js). Not done: a wing span and feather control for the birds, the pterodactyl's membrane, a snout width, thickness per leg, the same for the crawlers.

## Done (2026-11-12): jaw controls and more part controls

Jaw length and Jaw depth (Body > Proportions); Mouth open, Side to side and Forward and back for the jaw, Swivel for each ear, and Stretch for the neck (Parts tab). The jaw is a part to draw on: the Draw tab's little figure opens its mouth so it can be seen and tapped. Still open: a tongue and teeth as parts, a mouth for the snake, spider and crab beyond opening, bird wing span, snout width.

## Done (2026-11-12): more drawing tools, scenery drawings, turning the page

Shapes (line, oval, box), the colour picker, Move with Bigger, Smaller and Turn, Copy and Mirror to the other side, drawings on any scenery prop, the Drawing sheet for a backdrop, and two-finger twist to turn the page. Also done the same day: a drawing on a leg no longer doubles (it belongs to the thigh or the shin it was drawn on), the bucket fills shapes drawn outside a part's outline, and a two-finger tap undoes (three redoes). Still open: a drawing on a tree, pine or bush follows a box round the shape, not its outline; the page turns about its middle and zoom is still about the middle too; drawing on the ground itself; layers.
