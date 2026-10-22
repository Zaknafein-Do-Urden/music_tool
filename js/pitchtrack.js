// 整段录音的音高曲线、调内音、音准偏差。纯函数，可在 Node 下测试。
// 曲线格式：Float32Array，每 hop 秒一帧（帧中心在 i * hop），值为浮点 MIDI 音高，NaN = 没有音高
import { yin, freqToMidi } from './pitch.js';

export const HOP = 0.02;

export const pitchFrameCount = (length, sampleRate, hop = HOP) => Math.floor(length / (hop * sampleRate));

// 算第 [from, to) 帧，写进 midi、clarity（调用方分段调用，浏览器里每段之间让出主线程）。
// samples 建议 16kHz：窗口 1024 点 = 64ms，够测到 70Hz，比 48kHz 快近 10 倍
export function trackPitch(samples, sampleRate, { hop = HOP, win = 1024, from = 0, to, midi, clarity }) {
  const end = Math.min(to ?? midi.length, midi.length);
  for (let i = from; i < end; i++) {
    const start = Math.min(Math.max(0, Math.round(i * hop * sampleRate) - win / 2), Math.max(0, samples.length - win));
    const r = samples.length >= win ? yin(samples.subarray(start, start + win), sampleRate) : null;
    midi[i] = r ? freqToMidi(r.freq) : NaN;
    clarity[i] = r ? r.clarity : 0;
  }
}

// 去掉不可信的帧：clarity 低的置 NaN，三点中值滤掉单帧跳八度，短于 minRun 帧的零碎片段丢掉
export function cleanCurve(midi, clarity, { minClarity = 0.8, minRun = 3 } = {}) {
  const n = midi.length;
  const raw = new Float32Array(n);
  for (let i = 0; i < n; i++) raw[i] = clarity[i] >= minClarity ? midi[i] : NaN;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const v = [raw[i - 1], raw[i], raw[i + 1]].filter((x) => x === x && x !== undefined);
    out[i] = raw[i] !== raw[i] ? NaN : v.length === 3 ? v.sort((a, b) => a - b)[1] : raw[i];
  }
  for (let i = 0; i < n;) {
    if (out[i] !== out[i]) { i++; continue; }
    let j = i;
    while (j < n && out[j] === out[j]) j++;
    if (j - i < minRun) out.fill(NaN, i, j);
    i = j;
  }
  return out;
}

// 转成 analysis.js 用的帧格式，好复用 segmentNotes / estimateKey
export const curveToFrames = (curve, hop = HOP) =>
  Array.from(curve, (m, i) => ({ t: i * hop, midi: m === m ? m : null, clarity: m === m ? 1 : 0 }));

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

// 调内音（音级集合）。小调加上和声小调的 #7（流行歌里 5 级大三和弦常带出来）
export function scalePcs(key) {
  const steps = key.mode === 'major' ? MAJOR_STEPS : [...MINOR_STEPS, 11];
  return steps.map((s) => (key.tonic + s) % 12);
}

// 音级在调里的级数：'1'–'7'，小调的 #7 为 '#7'，不在调里返回 null
export function degreeOf(pc, key) {
  const rel = (((pc - key.tonic) % 12) + 12) % 12;
  const steps = key.mode === 'major' ? MAJOR_STEPS : MINOR_STEPS;
  const i = steps.indexOf(rel);
  if (i >= 0) return String(i + 1);
  return key.mode === 'minor' && rel === 11 ? '#7' : null;
}

// 离 pcs 里最近的音差多少音分（正 = 偏高）
export function centsOff(midi, pcs) {
  let best = Infinity;
  for (let m = Math.floor(midi) - 2; m <= Math.ceil(midi) + 2; m++) {
    if (!pcs.includes(((m % 12) + 12) % 12)) continue;
    const d = (midi - m) * 100;
    if (Math.abs(d) < Math.abs(best)) best = d;
  }
  return best;
}
