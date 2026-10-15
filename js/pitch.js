// 单声部音高检测（YIN 算法）。纯函数，可在 Node 下测试。

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const freqToMidi = (f) => 69 + 12 * Math.log2(f / 440);
export const midiName = (m) => NOTE_NAMES[((Math.round(m) % 12) + 12) % 12] + (Math.floor(Math.round(m) / 12) - 1);

// 返回 { freq, clarity }，clarity 0–1 越大越可信；静音或无明确音高返回 null。
// 人声范围默认 70–1000 Hz；2048 点 @48kHz 约 43ms 一帧足够
export function yin(buf, sampleRate, { minFreq = 70, maxFreq = 1000, threshold = 0.15, minRms = 0.01 } = {}) {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  if (Math.sqrt(rms / buf.length) < minRms) return null;

  const maxTau = Math.min(Math.floor(sampleRate / minFreq), Math.floor(buf.length / 2));
  const minTau = Math.max(2, Math.floor(sampleRate / maxFreq));
  const w = buf.length - maxTau;

  // 差分函数 + 累积均值归一化
  const d = new Float32Array(maxTau + 1);
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    running += sum;
    d[tau] = running > 0 ? (sum * tau) / running : 1;
  }

  // 第一个低于阈值的谷；找不到就取全局最小，再用 clarity 让调用方过滤
  let tau = -1;
  for (let t = minTau; t <= maxTau; t++) {
    if (d[t] < threshold) {
      while (t + 1 <= maxTau && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) {
    tau = minTau;
    for (let t = minTau + 1; t <= maxTau; t++) if (d[t] < d[tau]) tau = t;
  }

  // 抛物线插值求更精确的周期
  let better = tau;
  if (tau > 1 && tau < maxTau) {
    const a = d[tau - 1], b = d[tau], c = d[tau + 1];
    const denom = a + c - 2 * b;
    if (denom !== 0) better = tau + (a - c) / (2 * denom);
  }
  return { freq: sampleRate / better, clarity: Math.max(0, 1 - d[tau]) };
}
