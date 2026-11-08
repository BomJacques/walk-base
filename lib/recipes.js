// Target-app import recipes included with each export and shown before export.
// These describe documented routes. docs/EXPORT-RECIPES.md separates documentation from device testing.

export const PRESETS = {
  procreate: {
    label: 'Procreate',
    suggest: 'mp4-h264',
    fallback: 'png-zip',
    summary: 'Import an MP4 into Procreate: its frames become Animation Assist layers, up to your iPad\'s layer limit for the canvas size.',
    steps: [
      'Export an H.264 MP4 reference video from this app.',
      'In Procreate, Gallery → Import, and pick the MP4. Procreate documents that video import becomes Animation Assist frames.',
      'The frame limit is the layer limit for this device and canvas. If frames go missing, export a shorter range or a smaller canvas.',
      'Add a new layer above each frame, or trace on separate layers, using Animation Assist background and onion skin settings.',
      'If MP4 is not available in this browser: use the PNG ZIP. Procreate lists PNG as an import format, but this app knows of no documented numbered-sequence import, so place frames by hand in filename order, or convert locally with the ffmpeg command in this file.',
    ],
    notes: 'This app does not write .procreate files. Repeated exposures are real repeated frames in an expanded export.',
  },
  dreams: {
    label: 'Procreate Dreams',
    suggest: 'mp4-h264',
    fallback: 'png-zip',
    summary: 'Add an H.264 MP4 to a track as reference. Animated GIF imports as a Flipbook, with GIF\'s colour, alpha and timing limits.',
    steps: [
      'Export an H.264 MP4 at your movie\'s frame rate.',
      'In Procreate Dreams, import the MP4 from Files onto a track. Procreate documents H.264 in .mp4, .m4v and .mov.',
      'Check that the movie frame rate matches the FPS in this file, then lock the track and draw on a new Flipbook track above it.',
      'GIF route: export GIF from this app and import it; Procreate documents that animated GIFs arrive as Flipbooks. GIF has 256 colours, on/off transparency and centisecond delays, so check the timing.',
      'H.264 from this app is opaque. Do not treat it as an alpha video.',
    ],
    notes: 'This app does not write .drm files. Alpha video codecs Dreams can import (HEVC, ProRes 4444) are not produced by this app.',
  },
  other: {
    label: 'Other animation apps',
    suggest: 'png-zip',
    fallback: 'png-zip',
    summary: 'Numbered PNG frames and a timing manifest. Import as an image sequence wherever your app supports it.',
    steps: [
      'Expanded export: import the numbered PNGs as an image sequence at the FPS in this file. One file is one timeline frame.',
      'Unique export: each drawing appears once. manifest.json lists each file\'s start frame and exposure length, and you set those holds yourself or with an importer.',
      'File names are zero padded, so a plain name sort gives frame order.',
    ],
    notes: 'No universal automatic import is claimed. Only apps named in docs/EXPORT-RECIPES.md as tested have been tested.',
  },
};

export function ffmpegCommand({ fps, padding, prefix = 'frame_' }) {
  return `ffmpeg -framerate ${fps} -i "${prefix}%0${padding}d.png" -c:v libx264 -pix_fmt yuv420p -vf "pad=ceil(iw/2)*2:ceil(ih/2)*2" -r ${fps} output.mp4`;
}

export function recipeText(presetId, summary) {
  const p = PRESETS[presetId] || PRESETS.other;
  return [
    `Trace Desk export: ${summary.projectName}`,
    `Private personal study material. Do not redistribute: it may contain drawings from the owner's book.`,
    '',
    `Target: ${p.label}`,
    p.summary,
    '',
    ...p.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    p.notes,
    '',
    `Timeline: ${summary.frames} frames at ${summary.fps} fps = ${summary.duration.toFixed(3)} s. Canvas ${summary.width}×${summary.height}.`,
    `Timing representation: ${summary.timing === 'unique' ? 'unique drawings plus exposure manifest; your importer or you must apply the holds' : 'expanded; one file per timeline frame, repeats are intentional'}.`,
    `File order: zero padded to ${summary.padding} digits. Frame numbers in names are zero-based timeline frames, not the book's drawing numbers.`,
    '',
    'Optional local conversion of an expanded PNG sequence, if you have ffmpeg (rename to your folder and pattern):',
    ffmpegCommand({ fps: summary.fps, padding: summary.padding, prefix: summary.ffmpegPrefix || 'frame_' }),
    '',
    'manifest.json holds PDF page, printed page, the book\'s own drawing label, crop rectangle, timing origin and every assumption.',
  ].join('\n');
}
