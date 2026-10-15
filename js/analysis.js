// 旋律分析：音高帧 → 音符、音名直方图、判断调。纯函数，可在 Node 下测试。
// 帧格式 { t 秒, midi 浮点或 null, clarity 0–1 }

// Krumhansl–Kessler 调式轮廓（索引 0 = 主音）
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

const pc = (m) => ((Math.round(m) % 12) + 12) % 12;

// 把连续、音高稳定的帧合成音符；短于 minDur 的滑音/杂音丢掉。
// 音符后有 restGap 以上的停顿记为 followedByRest（乐句结尾，往往是主音或和弦音）
export function segmentNotes(frames, { minDur = 0.1, tol = 0.6, minClarity = 0.8, maxGap = 0.12, restGap = 0.25 } = {}) {
  const notes = [];
  let cur = null;
  const dt = frames.length > 1 ? Math.min(0.1, (frames.at(-1).t - frames[0].t) / (frames.length - 1)) : 0.04;

  const close = () => {
    if (!cur) return;
    const end = cur.lastT + dt;
    if (end - cur.start >= minDur) {
      notes.push({ start: cur.start, end, dur: end - cur.start, midi: Math.round(cur.sum / cur.n) });
    }
    cur = null;
  };

  for (const f of frames) {
    const voiced = f.midi !== null && f.clarity >= minClarity;
    if (voiced && cur && Math.abs(f.midi - cur.sum / cur.n) < tol && f.t - cur.lastT <= maxGap) {
      cur.sum += f.midi;
      cur.n++;
      cur.lastT = f.t;
      continue;
    }
    close();
    if (voiced) cur = { start: f.t, lastT: f.t, sum: f.midi, n: 1 };
  }
  close();

  notes.forEach((n, i) => {
    const next = notes[i + 1];
    n.followedByRest = !next || next.start - n.end >= restGap;
  });
  return notes;
}

// 音名直方图：按时长加权，乐句结尾音再加权
export function notesHistogram(notes, { phraseEndBoost = 1.5 } = {}) {
  const hist = new Array(12).fill(0);
  for (const n of notes) hist[pc(n.midi)] += n.dur * (n.followedByRest ? phraseEndBoost : 1);
  return hist;
}

// 最近 window 秒的帧直方图，越近权重越大（用于实时推荐）
export function framesHistogram(frames, now, window, { minClarity = 0.8, frameDur = 0.04 } = {}) {
  const hist = new Array(12).fill(0);
  for (const f of frames) {
    const age = now - f.t;
    if (age < 0 || age > window || f.midi === null || f.clarity < minClarity) continue;
    hist[pc(f.midi)] += frameDur * (1 - 0.5 * (age / window));
  }
  return hist;
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

// 24 个调按相关系数从高到低排列
export function rankKeys(hist) {
  const ranked = [];
  for (const [mode, profile] of [['major', MAJOR_PROFILE], ['minor', MINOR_PROFILE]]) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const rotated = hist.map((_, p) => profile[(p - tonic + 12) % 12]);
      ranked.push({ tonic, mode, score: pearson(hist, rotated) });
    }
  }
  return ranked.sort((a, b) => b.score - a.score);
}

// "音阶家族"：C 大调和 A 小调用同一组音，对伴奏来说差别只是哪个和弦算 1
const family = (k) => (k.mode === 'major' ? k.tonic : (k.tonic + 3) % 12);

// 从唱过的音符判断调。返回 null 表示唱得还不够（有效音符不足 minSeconds）
export function estimateKey(notes, { minSeconds = 4 } = {}) {
  const total = notes.reduce((s, n) => s + n.dur, 0);
  if (total < minSeconds || notes.length < 4) return null;
  const ranked = rankKeys(notesHistogram(notes));
  const best = ranked[0];
  const rival = ranked.find((k) => family(k) !== family(best));
  const alt = ranked.find((k) => family(k) === family(best) && k.mode !== best.mode);
  const margin = best.score - rival.score;
  const confidence = margin > 0.12 ? 'high' : margin > 0.05 ? 'mid' : 'low';
  const midis = notes.map((n) => n.midi);
  return {
    best, alt, rival, margin, confidence, seconds: total,
    range: { lo: Math.min(...midis), hi: Math.max(...midis) },
  };
}
