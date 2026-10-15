// 和弦推荐：根据最近唱的音、和弦走向习惯、用户自己的历史，给 6 个按钮打分。纯函数，可在 Node 下测试。
// 推荐本质是预测：和弦要在唱下一句之前按，所以只能用已经唱过的部分。
import { MODES, chordFor } from './theory.js';

// 和弦转移概率（流行歌经验值）：TRANSITIONS[mode][从][到]，按 MODES 里按钮顺序
export const TRANSITIONS = {
  // 1 2m 3m 4 5 6m
  major: [
    [0.05, 0.12, 0.06, 0.30, 0.27, 0.20],
    [0.10, 0.05, 0.08, 0.12, 0.50, 0.15],
    [0.10, 0.08, 0.05, 0.35, 0.12, 0.30],
    [0.30, 0.10, 0.08, 0.05, 0.35, 0.12],
    [0.45, 0.05, 0.08, 0.12, 0.05, 0.25],
    [0.10, 0.18, 0.10, 0.35, 0.22, 0.05],
  ],
  // 1m 3 4m 5 6 7
  minor: [
    [0.05, 0.15, 0.20, 0.15, 0.30, 0.15],
    [0.15, 0.05, 0.15, 0.10, 0.25, 0.30],
    [0.30, 0.05, 0.05, 0.35, 0.10, 0.15],
    [0.60, 0.05, 0.10, 0.05, 0.15, 0.05],
    [0.15, 0.15, 0.15, 0.15, 0.05, 0.35],
    [0.35, 0.30, 0.05, 0.05, 0.20, 0.05],
  ],
};

const sum = (a) => a.reduce((s, x) => s + x, 0);
const normalize = (a) => { const s = sum(a); return s > 0 ? a.map((x) => x / s) : a.map(() => 1 / a.length); };

// 旋律与每个和弦的契合度：唱的音落在和弦音上的比例，根音略加分
export function chordFit(key, hist) {
  return MODES[key.mode].degrees.map((_, i) => {
    const { root, pcs } = chordFor(key, i);
    return pcs.reduce((s, p) => s + hist[p], 0) + 0.2 * hist[root];
  });
}

// 以主音为 0 的相对音名分布，长度归一化，这样换调后历史仍可用
function relativeProfile(key, hist) {
  const rel = hist.map((_, p) => hist[(p + key.tonic) % 12]);
  const len = Math.sqrt(rel.reduce((s, x) => s + x * x, 0));
  return len > 0 ? rel.map((x) => x / len) : null;
}

// 用户的历史："唱了类似旋律之后按了哪个和弦"。歌会重复，第二遍主歌就能推荐第一遍按过的
export class ChordMemory {
  constructor(entries = [], { max = 300 } = {}) {
    this.entries = entries;
    this.max = max;
  }

  record(key, hist, degree) {
    const profile = relativeProfile(key, hist);
    if (!profile) return;
    this.entries.push({ mode: key.mode, profile: profile.map((x) => Math.round(x * 1000) / 1000), degree });
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
  }

  // 返回 6 个和弦的投票分布；没有足够相似的历史返回 null
  recall(key, hist, { minSim = 0.85 } = {}) {
    const profile = relativeProfile(key, hist);
    if (!profile) return null;
    const votes = new Array(MODES[key.mode].degrees.length).fill(0);
    for (const e of this.entries) {
      if (e.mode !== key.mode) continue;
      const sim = e.profile.reduce((s, x, i) => s + x * profile[i], 0);
      if (sim >= minSim) votes[e.degree] += (sim - minSim) / (1 - minSim) + 0.05;
    }
    return sum(votes) > 0 ? normalize(votes) : null;
  }

  toJSON() { return this.entries; }
}

// 综合打分，返回按分数从高到低的 [{ degree, score }]；唱得太少（hist 总量 < minWeight 秒）返回 []
export function suggestChords({ key, hist, current = null, memory = null, minWeight = 0.25 }) {
  if (sum(hist) < minWeight) return [];
  const fit = normalize(chordFit(key, hist));
  const trans = current === null ? null : normalize(TRANSITIONS[key.mode][current]);
  const mem = memory?.recall(key, hist) ?? null;

  const parts = [[fit, 0.5], [trans, 0.25], [mem, 0.25]].filter(([v]) => v);
  const totalW = sum(parts.map(([, w]) => w));
  const scores = fit.map((_, i) => parts.reduce((s, [v, w]) => s + (v[i] * w) / totalW, 0));
  return scores.map((score, degree) => ({ degree, score })).sort((a, b) => b.score - a.score);
}
