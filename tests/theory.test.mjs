import assert from 'node:assert/strict';
import { MODES, makeKey, chordFor, voiceChord, bassNote, degreesFor, pentaPcs } from '../js/theory.js';

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

// 中国风五声化：C 调 C Dsus2 Em7 F6 Gsus2 Am；A 小调 Am C Dsus2 Em7 F6 Gsus2
const pentaNames = (tonic, mode) => MODES[mode].degrees.map((_, i) => chordFor(makeKey(tonic, mode), i, 'penta').name);
assert.deepEqual(pentaNames(0, 'major'), ['C', 'Dsus2', 'Em7', 'F6', 'Gsus2', 'Am']);
assert.deepEqual(pentaNames(9, 'minor'), ['Am', 'C', 'Dsus2', 'Em7', 'F6', 'Gsus2']);
assert.deepEqual(pentaNames(7, 'major'), ['G', 'Asus2', 'Bm7', 'C6', 'Dsus2', 'Em']);
// 每个调：上方三个音全在五声里，能排出转位；低音是原来的根音
for (const key of ALL_KEYS) {
  const penta = pentaPcs(key);
  let prev = null;
  for (let i = 0; i < 6; i++) {
    const c = chordFor(key, i, 'penta');
    assert.equal(c.root, chordFor(key, i).root, '低音不变');
    assert.ok(c.pcs.every((p) => penta.includes(p)), `${key.name} ${c.name} 上方有五声以外的音`);
    assert.equal(new Set(c.pcs).size, 3);
    prev = voiceChord(c.pcs, prev);
    assert.equal(prev.length, 3);
  }
}
// 按钮文字
assert.deepEqual(degreesFor('major', 'penta').map((d) => d.label), ['1', '2sus', '3m7', '4', '5sus', '6m']);
assert.deepEqual(degreesFor('minor', 'penta').map((d) => d.label), ['1m', '3', '4sus', '5m7', '6', '7sus']);
assert.equal(degreesFor('major'), MODES.major.degrees, '普通乐队不变');

console.log('theory tests passed');
