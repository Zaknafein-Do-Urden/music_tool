import assert from 'node:assert/strict';
import { encodeWav } from '../js/wav.js';

const samples = new Float32Array([0, 0.5, -0.5, 1, -1, 2]);
const buf = encodeWav(samples, 48000);
const v = new DataView(buf);
const str = (o, n) => String.fromCharCode(...new Uint8Array(buf, o, n));

assert.equal(buf.byteLength, 44 + samples.length * 2);
assert.equal(str(0, 4), 'RIFF');
assert.equal(str(8, 4), 'WAVE');
assert.equal(v.getUint16(22, true), 1);
assert.equal(v.getUint32(24, true), 48000);
assert.equal(v.getUint32(40, true), samples.length * 2);
assert.equal(v.getInt16(44 + 2 * 3, true), 32767);
assert.equal(v.getInt16(44 + 2 * 4, true), -32768);
assert.equal(v.getInt16(44 + 2 * 5, true), 32767, '超出范围要削顶');

console.log('wav tests passed');
