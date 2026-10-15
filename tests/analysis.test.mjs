import assert from 'node:assert/strict';
import { yin, freqToMidi, midiName } from '../js/pitch.js';
import { segmentNotes, estimateKey, framesHistogram } from '../js/analysis.js';

// --- YIN 音高检测 ---
const SR = 48000;
function tone(freq, { n = 2048, harmonics = [1, 0.5, 0.25], amp = 0.3 } = {}) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    buf[i] = harmonics.reduce((s, a, h) => s + amp * a * Math.sin((2 * Math.PI * freq * (h + 1) * i) / SR), 0);
  }
  return buf;
}
for (const f of [98, 196, 220, 330, 523.25, 880]) {
  const r = yin(tone(f), SR);
  assert.ok(r, `${f}Hz 没检测到`);
  assert.ok(Math.abs(freqToMidi(r.freq) - freqToMidi(f)) < 0.1, `${f}Hz 检测成 ${r.freq}`);
  assert.ok(r.clarity > 0.9);
}
assert.equal(yin(new Float32Array(2048), SR), null, '静音应返回 null');
let seed = 1;
const noise = new Float32Array(2048).map(() => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.5);
const nr = yin(noise, SR);
assert.ok(!nr || nr.clarity < 0.8, '白噪声不应被当成清晰音高');
assert.equal(midiName(69), 'A4');
assert.equal(midiName(60.3), 'C4');

// --- 把旋律转成帧（每 40ms 一帧，带一点抖动），模拟麦克风输入 ---
function melodyFrames(notes) {
  const frames = [];
  let t = 0;
  for (const [midi, dur] of notes) {
    const end = t + dur;
    for (; t < end - 1e-9; t += 0.04) {
      frames.push(midi === null ? { t, midi: null, clarity: 0 } : { t, midi: midi + Math.sin(t * 30) * 0.15, clarity: 0.95 });
    }
  }
  return frames;
}

// 分段：两个音中间有停顿
const segs = segmentNotes(melodyFrames([[60, 0.5], [62, 0.5], [null, 0.4], [64, 0.8]]));
assert.deepEqual(segs.map((n) => n.midi), [60, 62, 64]);
assert.deepEqual(segs.map((n) => n.followedByRest), [false, true, true]);
assert.ok(Math.abs(segs[2].dur - 0.8) < 0.1);

// 小星星（G 大调）：G G D D E E D- | C C B B A A G-
const R = null;
const twinkleG = [
  [67, .4], [67, .4], [74, .4], [74, .4], [76, .4], [76, .4], [74, .8], [R, .3],
  [72, .4], [72, .4], [71, .4], [71, .4], [69, .4], [69, .4], [67, .8], [R, .3],
  [74, .4], [74, .4], [72, .4], [72, .4], [71, .4], [71, .4], [69, .8], [R, .3],
  [74, .4], [74, .4], [72, .4], [72, .4], [71, .4], [71, .4], [69, .8], [R, .3],
  [67, .4], [67, .4], [74, .4], [74, .4], [76, .4], [76, .4], [74, .8], [R, .3],
  [72, .4], [72, .4], [71, .4], [71, .4], [69, .4], [69, .4], [67, 1.2], [R, .5],
];
const g = estimateKey(segmentNotes(melodyFrames(twinkleG)));
assert.ok(g, '应该有结果');
assert.deepEqual([g.best.tonic, g.best.mode], [7, 'major'], `小星星判成 ${JSON.stringify(g.best)}`);
assert.deepEqual([g.alt.tonic, g.alt.mode], [4, 'minor'], 'G 大调的同组小调是 Em');
assert.deepEqual(g.range, { lo: 67, hi: 76 });

// A 小调旋律（带升 G 导音），以 A 结尾
const aMinor = [
  [69, .6], [72, .3], [76, .6], [74, .3], [72, .6], [71, .3], [68, .6], [69, 1.2], [R, .4],
  [64, .6], [69, .3], [72, .6], [71, .3], [69, .6], [68, .3], [71, .6], [69, 1.2], [R, .4],
  [76, .6], [74, .3], [72, .6], [71, .3], [72, .6], [74, .3], [68, .6], [69, 1.5], [R, .5],
];
const a = estimateKey(segmentNotes(melodyFrames(aMinor)));
assert.deepEqual([a.best.tonic, a.best.mode], [9, 'minor'], `A 小调判成 ${JSON.stringify(a.best)}`);

// 唱太少不给结果
assert.equal(estimateKey(segmentNotes(melodyFrames([[60, 0.5], [62, 0.5]]))), null);

// 实时直方图：只算窗口内，越近越重
const fr = melodyFrames([[60, 1], [67, 1]]);
const h = framesHistogram(fr, 2, 1.5);
assert.ok(h[7] > h[0] && h[0] > 0 && h[2] === 0);

console.log('analysis tests passed', { twinkle: g.confidence, aMinor: a.confidence });
