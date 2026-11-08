// Store-only ZIP writer and reader. PNG is already compressed, so storing costs nothing, and entries stay as separate Blobs
// so a long export never holds every frame in one buffer.

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes, seed = 0) {
  let c = ~seed;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}

const enc = new TextEncoder();
const LIMIT = 0xffffffff - 1024;

export class ZipWriter {
  constructor(date = new Date()) {
    this.parts = [];
    this.central = [];
    this.offset = 0;
    this.time = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((date.getSeconds() / 2) & 31);
    this.date = (((date.getFullYear() - 1980) & 127) << 9) | (((date.getMonth() + 1) & 15) << 5) | (date.getDate() & 31);
    this.names = new Set();
  }

  get size() { return this.offset; }

  /** data: Uint8Array, string or Blob. */
  async add(name, data) {
    if (this.names.has(name)) throw new Error(`Duplicate file in export: ${name}`);
    this.names.add(name);
    let bytes;
    if (typeof data === 'string') bytes = enc.encode(data);
    else if (data instanceof Uint8Array) bytes = data;
    else bytes = new Uint8Array(await data.arrayBuffer());
    if (this.offset + bytes.length > LIMIT) throw new Error('ZIP part would pass 4 GB. Use a smaller chunk size.');
    const crc = crc32(bytes);
    const nameBytes = enc.encode(name);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(4, 20, true);
    head.setUint16(6, 0x0800, true);
    head.setUint16(8, 0, true);
    head.setUint16(10, this.time, true);
    head.setUint16(12, this.date, true);
    head.setUint32(14, crc, true);
    head.setUint32(18, bytes.length, true);
    head.setUint32(22, bytes.length, true);
    head.setUint16(26, nameBytes.length, true);
    this.central.push({ nameBytes, crc, size: bytes.length, offset: this.offset });
    // A Blob per entry lets the browser spill to disk rather than keep frames in the JS heap.
    this.parts.push(new Blob([head.buffer, nameBytes, bytes]));
    this.offset += 30 + nameBytes.length + bytes.length;
  }

  finish() {
    const cdStart = this.offset;
    const out = [];
    let cdSize = 0;
    for (const e of this.central) {
      const h = new DataView(new ArrayBuffer(46));
      h.setUint32(0, 0x02014b50, true);
      h.setUint16(4, 20, true);
      h.setUint16(6, 20, true);
      h.setUint16(8, 0x0800, true);
      h.setUint16(10, 0, true);
      h.setUint16(12, this.time, true);
      h.setUint16(14, this.date, true);
      h.setUint32(16, e.crc, true);
      h.setUint32(20, e.size, true);
      h.setUint32(24, e.size, true);
      h.setUint16(28, e.nameBytes.length, true);
      h.setUint32(42, e.offset, true);
      out.push(h.buffer, e.nameBytes);
      cdSize += 46 + e.nameBytes.length;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, this.central.length, true);
    end.setUint16(10, this.central.length, true);
    end.setUint32(12, cdSize, true);
    end.setUint32(16, cdStart, true);
    return new Blob([...this.parts, ...out, end.buffer], { type: 'application/zip' });
  }
}

/** Reads the central directory of a stored ZIP. Returns { names, read(name) -> Promise<Uint8Array> }. */
export async function readZip(blob) {
  const tailSize = Math.min(blob.size, 66000);
  const tail = new Uint8Array(await blob.slice(blob.size - tailSize).arrayBuffer());
  let p = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail[i] === 0x50 && tail[i + 1] === 0x4b && tail[i + 2] === 5 && tail[i + 3] === 6) { p = i; break; }
  }
  if (p < 0) throw new Error('Not a ZIP file.');
  const v = new DataView(tail.buffer, tail.byteOffset + p);
  const count = v.getUint16(10, true);
  const cdSize = v.getUint32(12, true);
  const cdStart = v.getUint32(16, true);
  const cd = new Uint8Array(await blob.slice(cdStart, cdStart + cdSize).arrayBuffer());
  const dv = new DataView(cd.buffer);
  const dec = new TextDecoder();
  const entries = new Map();
  let at = 0;
  for (let i = 0; i < count; i++) {
    const method = dv.getUint16(at + 10, true);
    const crc = dv.getUint32(at + 16, true);
    const size = dv.getUint32(at + 24, true);
    const nameLen = dv.getUint16(at + 28, true);
    const extra = dv.getUint16(at + 30, true);
    const comment = dv.getUint16(at + 32, true);
    const offset = dv.getUint32(at + 42, true);
    const name = dec.decode(cd.subarray(at + 46, at + 46 + nameLen));
    entries.set(name, { method, crc, size, offset });
    at += 46 + nameLen + extra + comment;
  }
  return {
    names: [...entries.keys()],
    async read(name) {
      const e = entries.get(name);
      if (!e) throw new Error(`No ${name} in ZIP.`);
      if (e.method !== 0) throw new Error('Only stored ZIP entries can be read here.');
      const head = new DataView(await blob.slice(e.offset, e.offset + 30).arrayBuffer());
      const start = e.offset + 30 + head.getUint16(26, true) + head.getUint16(28, true);
      const bytes = new Uint8Array(await blob.slice(start, start + e.size).arrayBuffer());
      if (crc32(bytes) !== e.crc) throw new Error(`CRC mismatch for ${name}.`);
      return bytes;
    },
    blobOf(name) {
      const e = entries.get(name);
      return e;
    },
  };
}
