// Opening pictures from files: any kind the browser can decode, and a clear message for the ones it cannot.
// decodePicture gives back a canvas (with naturalWidth and naturalHeight, so it can stand where an image does).
// A video becomes a sprite sheet of frames taken evenly along it.

/** What the file pickers offer. Browsers differ in what they can decode (Safari opens HEIC, Chrome does not): the ones they cannot open give a message that says so. */
export const PICTURE_ACCEPT = 'image/*,.png,.jpg,.jpeg,.jfif,.webp,.avif,.gif,.apng,.bmp,.ico,.svg,.heic,.heif,.tif,.tiff';
export const PICTURE_VIDEO_ACCEPT = `${PICTURE_ACCEPT},video/*,.mp4,.m4v,.mov,.webm,.ogv`;
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif', apng: 'image/apng', bmp: 'image/bmp', ico: 'image/x-icon', svg: 'image/svg+xml', heic: 'image/heic', heif: 'image/heif', tif: 'image/tiff', tiff: 'image/tiff', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', ogv: 'video/ogg' };
export const extOf = (name) => (/\.([a-z0-9]+)$/i.exec(String(name || '')) || [])[1]?.toLowerCase() || '';
export const isVideo = (file) => /^video\//.test(file?.type || '') || /^(mp4|m4v|mov|webm|ogv)$/.test(extOf(file?.name));
/** The file's type: the one it says, or, when it says none (or only a generic one), the one its name gives. */
export const typeOf = (file) => { const t = file?.type || ''; return t && t !== 'application/octet-stream' ? t : MIME[extOf(file?.name)] || ''; };
const MAX_SIDE = 4096;

/** An SVG with no width and height has no size of its own, and a browser draws it as nothing: give it one from its viewBox. */
export function sizedSvg(text, fallback = 1024) {
  const open = /<svg\b[^>]*>/i.exec(text); if (!open) return text; const tag = open[0];
  const has = (a) => new RegExp(`\\s${a}\\s*=\\s*["'][^"']*["']`, 'i').test(tag) && !new RegExp(`\\s${a}\\s*=\\s*["'][^"']*%["']`, 'i').test(tag);
  if (has('width') && has('height')) return text;
  const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*["']/i.exec(tag); let w = fallback; let h = fallback;
  if (vb && +vb[3] > 0 && +vb[4] > 0) { const k = fallback / Math.max(+vb[3], +vb[4]); w = Math.round(+vb[3] * k); h = Math.round(+vb[4] * k); }
  const cleaned = tag.replace(/\s(width|height)\s*=\s*["'][^"']*["']/gi, '');
  return text.replace(tag, cleaned.replace(/<svg/i, `<svg width="${w}" height="${h}"`));
}
const load = (url) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('decode')); i.src = url; });
const toCanvas = (src, w, h) => {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h)); const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height); c.naturalWidth = c.width; c.naturalHeight = c.height; return c;
};
const sorry = (file) => { const e = extOf(file?.name); return new Error(`This browser cannot open ${e ? `.${e}` : 'that kind of'} files. Save it as PNG, JPG, WebP, GIF or SVG and bring that in.${/^(heic|heif|tif|tiff|avif)$/.test(e) ? ' (Safari opens more kinds than Chrome does.)' : ''}`); };

/** Opens a picture file of any kind the browser can decode. An animated one gives its first frame. */
export async function decodePicture(file) {
  if (!file) throw new Error('No file.');
  const type = typeOf(file); let blob = file;
  if (type === 'image/svg+xml') blob = new Blob([sizedSvg(await file.text())], { type }); else if (type && file.type !== type) blob = new Blob([file], { type });
  const url = URL.createObjectURL(blob);
  try {
    let img = null; try { img = await load(url); } catch { img = null; }
    if (img && img.naturalWidth > 0) return toCanvas(img, img.naturalWidth, img.naturalHeight);
    if (typeof createImageBitmap === 'function') { try { const bm = await createImageBitmap(blob); const c = toCanvas(bm, bm.width, bm.height); bm.close?.(); return c; } catch { /* fall through */ } }
    throw sorry(file);
  } finally { URL.revokeObjectURL(url); }
}

/** A video as a sheet of frames in a grid, taken evenly along it. Returns { canvas, cols, rows }. */
export async function videoSheet(file, { cols = 4, rows = 4, cell = 256 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video'); v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
    await new Promise((res, rej) => { v.onloadeddata = res; v.onerror = () => rej(new Error('This browser cannot play that video. Try an MP4 or WebM file.')); });
    if (!(v.videoWidth > 0) || !(v.duration > 0) || !Number.isFinite(v.duration)) throw new Error('This browser cannot read that video.');
    const k = cell / Math.max(v.videoWidth, v.videoHeight); const cw = Math.max(1, Math.round(v.videoWidth * k)); const ch = Math.max(1, Math.round(v.videoHeight * k));
    const cv = document.createElement('canvas'); cv.width = cw * cols; cv.height = ch * rows; const g = cv.getContext('2d'); const n = cols * rows;
    for (let i = 0; i < n; i++) {
      v.currentTime = Math.min(v.duration - 0.001, (v.duration * i) / n); await new Promise((res) => { v.onseeked = res; setTimeout(res, 2000); });
      g.drawImage(v, (i % cols) * cw, Math.floor(i / cols) * ch, cw, ch);
    }
    return { canvas: cv, cols, rows };
  } finally { URL.revokeObjectURL(url); }
}
