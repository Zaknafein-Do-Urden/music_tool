import assert from 'node:assert/strict';
import { KEYS, DEGREES, chordFor, voiceChord, bassNote } from '../js/theory.js';

const names = (keyName) => DEGREES.map((_, i) => chordFor(KEYS.find((k) => k.name === keyName), i).name);

assert.deepEqual(names('C'), ['C', 'Dm', 'Em', 'F', 'G', 'Am']);
assert.deepEqual(names('G'), ['G', 'Am', 'Bm', 'C', 'D', 'Em']);
assert.deepEqual(names('Eb'), ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm']);
assert.deepEqual(names('B'), ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m']);

// 每个调每个和弦都能排出三音、在音域内、音级正确
for (const key of KEYS) {
  let prev = null;
  for (let i = 0; i < DEGREES.length; i++) {
    const chord = chordFor(key, i);
    const v = voiceChord(chord.pcs, prev);
    assert.equal(v.length, 3, `${key.name} ${chord.name}`);
    assert.ok(v[0] >= 55 && v[2] <= 74 && v[2] - v[0] < 12);
    assert.deepEqual([...v.map((n) => n % 12)].sort(), [...chord.pcs].sort());
    prev = v;
    const b = bassNote(chord.root);
    assert.ok(b >= 40 && b <= 51 && b % 12 === chord.root);
  }
}

// 声部进行：C → G 应选移动小的转位（B-D-G），而不是跳到根位
const c = voiceChord([0, 4, 7], null);
const g = voiceChord([7, 11, 2], c);
const move = g.reduce((s, n, i) => s + Math.abs(n - c[i]), 0);
assert.ok(move <= 4, `C ${c} -> G ${g} moved ${move}`);

console.log('theory tests passed');
