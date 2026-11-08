// H.264 MP4 through WebCodecs and the vendored muxer. Offered only after a real encoder check for the exact size.
// Each timeline frame is one encoded frame with an exact timestamp, so this is not a screen recording.
import { Muxer, ArrayBufferTarget } from './mp4-muxer.mjs';

const CODECS = ['avc1.640033', 'avc1.640028', 'avc1.4D4028', 'avc1.42E028', 'avc1.42001F'];

export async function detectH264(width, height, fps, bitrateMbps = 12) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    return { supported: false, reason: 'This browser does not provide WebCodecs VideoEncoder.' };
  }
  if (width % 2 || height % 2) return { supported: false, reason: 'H.264 needs an even canvas width and height. Adjust the canvas to use video.' };
  for (const codec of CODECS) {
    const config = { codec, width, height, bitrate: bitrateMbps * 1e6, framerate: fps, avc: { format: 'avc' } };
    try {
      const r = await VideoEncoder.isConfigSupported(config);
      if (r.supported) return { supported: true, codec, config };
    } catch { /* try the next profile */ }
  }
  return { supported: false, reason: `No H.264 encoder is available in this browser for ${width}×${height}.` };
}

/** getFrame(i) resolves to a canvas holding timeline frame i, already flattened on a solid background. */
export async function encodeH264({ width, height, fps, count, bitrateMbps, getFrame, onFrame, signal }) {
  const check = await detectH264(width, height, fps, bitrateMbps);
  if (!check.supported) throw new Error(check.reason);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({ target, fastStart: 'in-memory', video: { codec: 'avc', width, height, frameRate: fps }, firstTimestampBehavior: 'strict' });
  let failure = null;
  let chunks = 0;
  const encoder = new VideoEncoder({
    output: (chunk, meta) => { muxer.addVideoChunk(chunk, meta); chunks += 1; },
    error: (e) => { failure = e; },
  });
  encoder.configure(check.config);
  const frameUs = 1e6 / fps;
  try {
    for (let i = 0; i < count; i++) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (failure) throw failure;
      const canvas = await getFrame(i);
      const vf = new VideoFrame(canvas, { timestamp: Math.round(i * frameUs), duration: Math.round((i + 1) * frameUs) - Math.round(i * frameUs) });
      encoder.encode(vf, { keyFrame: i % Math.max(1, Math.round(fps)) === 0 });
      vf.close();
      while (encoder.encodeQueueSize > 4) await new Promise((r) => { setTimeout(r, 5); });
      onFrame?.(i + 1);
    }
    await encoder.flush();
    if (failure) throw failure;
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
  muxer.finalize();
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), codec: check.codec, frames: count, chunks };
}
