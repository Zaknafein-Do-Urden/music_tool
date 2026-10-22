import assert from 'node:assert/strict';
import { HOP, pitchFrameCount, trackPitch, cleanCurve, curveToFrames, scalePcs, degreeOf, centsOff } from '../js/pitchtrack.js';
import { segmentNotes, estimateKey } from '../js/analysis.js';

// --- 整段音高曲线：16kHz 合成一段 G 大调旋律，中间夹一段静音 ---
const SR = 16000;
const melody = [[67, 0.5], [null, 0.3], [71, 0.4], [74, 0.6], [72, 0.4], [71, 0.4], [69, 0.4], [67, 0.8], [66, 0.4], [67, 1]];
const total = melody.reduce((s, [, d]) => s + d, 0);
const samples = new Float32Array(Math.round(total * SR));
let pos = 0, phase = 0;
for (const [m, d] of melody) {
  const n = Math.round(d * SR);
  const f = m === null ? 0 : 440 * 2 ** ((m - 69) / 12);
  for (let i = 0; i < n; i++, pos++) {
    phase += (2 * Math.PI * f) / SR;
    samples[pos] = m === null ? 0 : 0.3 * (Math.sin(phase) + 0.5 * Math.sin(2 * phase) + 0.25 * Math.sin(3 * phase));
  }
}

const count = pitchFrameCount(samples.length, SR);
assert.equal(count, Math.floor(total / HOP));
const midi = new Float32Array(count), clarity = new Float32Array(count);
// 分段算和一次算结果一样
trackPitch(samples, SR, { from: 0, to: 100, midi, clarity });
trackPitch(samples, SR, { from: 100, midi, clarity });
const curve = cleanCurve(midi, clarity);

const at = (t) => curve[Math.round(t / HOP)];
assert.ok(Math.abs(at(0.25) - 67) < 0.1, `0.25s 应为 G4，得到 ${at(0.25)}`);
assert.ok(Number.isNaN(at(0.65)), '静音段应为 NaN');
assert.ok(Math.abs(at(1.3) - 74) < 0.1);

const est = estimateKey(segmentNotes(curveToFrames(curve)), { minSeconds: 3 });
assert.ok(est, '应能判断调');
assert.deepEqual([est.best.tonic, est.best.mode], [7, 'major'], `判成 ${est.best.tonic} ${est.best.mode}`);
assert.equal(est.range.lo, 66);
assert.equal(est.range.hi, 74);

// --- 清理：低 clarity、单帧跳八度、零碎片段 ---
const m2 = Float32Array.from([60, 60, 72, 60, 60, 60, 64, 64, NaN, 65, 60, 60, 60]);
const c2 = Float32Array.from([1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 0.5, 1, 1]);
const cl = cleanCurve(m2, c2);
assert.equal(cl[2], 60, '单帧跳八度应被中值滤掉');
assert.ok(Number.isNaN(cl[9]), '单帧片段丢掉');
assert.ok(Number.isNaN(cl[10]), 'clarity 低的帧丢掉');
assert.ok(Number.isNaN(cl[11]) && Number.isNaN(cl[12]), '两帧片段丢掉');
assert.equal(cl[7], 64);

// --- 调内音、级数、音分偏差 ---
const C = { tonic: 0, mode: 'major' };
const Am = { tonic: 9, mode: 'minor' };
assert.deepEqual(scalePcs(C), [0, 2, 4, 5, 7, 9, 11]);
assert.deepEqual(scalePcs(Am), [9, 11, 0, 2, 4, 5, 7, 8]);
assert.equal(degreeOf(7, C), '5');
assert.equal(degreeOf(6, C), null);
assert.equal(degreeOf(0, Am), '3');
assert.equal(degreeOf(8, Am), '#7');
assert.ok(Math.abs(centsOff(60.2, scalePcs(C)) - 20) < 1e-3);
assert.ok(Math.abs(centsOff(61.4, scalePcs(C)) + 60) < 1e-3, 'C#+40 离 D 更近，算偏低 60 音分');
assert.ok(Math.abs(centsOff(66, scalePcs(C)) - 100) < 1e-3, 'F# 不在 C 大调里，离 F、G 都差 100 音分');

console.log('pitchtrack tests passed');
