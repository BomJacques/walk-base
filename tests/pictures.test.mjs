import test from 'node:test';
import assert from 'node:assert/strict';
import { sizedSvg, extOf, typeOf, isVideo, PICTURE_ACCEPT } from '../src/pictures.js';

test('file names and types: the name stands in when the type is missing or generic', () => {
  assert.equal(extOf('Face.SVG'), 'svg'); assert.equal(extOf('noext'), ''); assert.equal(extOf('a.b.PNG'), 'png');
  assert.equal(typeOf({ name: 'x.webp', type: '' }), 'image/webp'); assert.equal(typeOf({ name: 'x.png', type: 'application/octet-stream' }), 'image/png'); assert.equal(typeOf({ name: 'x.jpg', type: 'image/png' }), 'image/png'); assert.equal(typeOf({ name: 'x.zzz', type: '' }), '');
  assert.equal(isVideo({ name: 'a.MOV', type: '' }), true); assert.equal(isVideo({ name: 'a.png', type: 'image/png' }), false); assert.equal(isVideo({ name: 'a', type: 'video/webm' }), true);
  for (const e of ['.svg', '.heic', '.avif', '.gif', '.tiff', '.webp']) assert.ok(PICTURE_ACCEPT.includes(e), e);
});
test('an SVG with no size gets one from its viewBox; one with a size is left alone', () => {
  const a = sizedSvg('<svg xmlns="x" viewBox="0 0 20 10"><rect/></svg>'); assert.match(a, /<svg width="1024" height="512"/);
  assert.equal(sizedSvg('<svg width="30" height="40"><rect/></svg>'), '<svg width="30" height="40"><rect/></svg>');
  const b = sizedSvg('<svg width="100%" height="100%" viewBox="0 0 5 5"><rect/></svg>'); assert.match(b, /width="1024" height="1024"/); assert.ok(!/100%/.test(b));
  assert.match(sizedSvg('<svg><rect/></svg>'), /width="1024" height="1024"/); assert.equal(sizedSvg('not svg'), 'not svg');
});
