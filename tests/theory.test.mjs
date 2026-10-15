import assert from 'node:assert/strict';
import { MODES, makeKey, chordFor, voiceChord, bassNote } from '../js/theory.js';

const NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

const names = (keyName, mode = 'major') => {
  const key = makeKey(NAMES.indexOf(keyName), mode);
  return MODES[mode].degrees.map((_, i) => chordFor(key, i).name);
};

assert.deepEqual(names('C'), ['C', 'Dm', 'Em', 'F', 'G', 'Am']);
assert.deepEqual(names('G'), ['G', 'Am', 'Bm', 'C', 'D', 'Em']);
assert.deepEqual(names('Eb'), ['Eb', 'Fm', 'Gm', 'Ab', 'Bb', 'Cm']);
assert.deepEqual(names('B'), ['B', 'C#m', 'D#m', 'E', 'F#', 'G#m']);

// 小调：1m 3 4m 5 6 7
assert.deepEqual(names('A', 'minor'), ['Am', 'C', 'Dm', 'E', 'F', 'G']);
assert.deepEqual(names('E', 'minor'), ['Em', 'G', 'Am', 'B', 'C', 'D']);
assert.deepEqual(names('D', 'minor'), ['Dm', 'F', 'Gm', 'A', 'Bb', 'C']);
assert.equal(makeKey(-2, 'minor').name, 'Bbm');
assert.equal(makeKey(13).name, 'Db');

// 每个调每个和弦都能排出三音、在音域内、音级正确
const ALL_KEYS = Object.keys(MODES).flatMap((mode) => Array.from({ length: 12 }, (_, t) => makeKey(t, mode)));
for (const key of ALL_KEYS) {
  let prev = null;
  for (let i = 0; i < MODES[key.mode].degrees.length; i++) {
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
