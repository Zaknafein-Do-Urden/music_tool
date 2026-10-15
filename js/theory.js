// 乐理工具：调、级数和弦、和弦排列（voicing）。纯函数，无音频依赖，可在 Node 下测试。

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// 调 = 主音音级 + 调式。降号拼写按调号习惯：大调 Db Eb F Ab Bb；小调 Cm Dm Ebm Fm Gm Bbm
const FLAT_TONICS = {
  major: [1, 3, 5, 8, 10],
  minor: [0, 2, 3, 5, 7, 10],
};

export const MODES = {
  major: {
    name: '大调',
    // 大调里最常用的 6 个顺阶和弦：1 2m 3m 4 5 6m
    degrees: [
      { label: '1', offset: 0, minor: false, hint: '家·稳定' },
      { label: '2m', offset: 2, minor: true, hint: '过渡' },
      { label: '3m', offset: 4, minor: true, hint: '柔和' },
      { label: '4', offset: 5, minor: false, hint: '展开·温暖' },
      { label: '5', offset: 7, minor: false, hint: '紧张·想回家' },
      { label: '6m', offset: 9, minor: true, hint: '伤感' },
    ],
  },
  minor: {
    name: '小调',
    // 小调流行歌最常用的 6 个：1m 3 4m 5 6 7。5 用大三和弦（和声小调），回到 1m 的感觉更强
    degrees: [
      { label: '1m', offset: 0, minor: true, hint: '家·忧郁' },
      { label: '3', offset: 3, minor: false, hint: '明亮' },
      { label: '4m', offset: 5, minor: true, hint: '深沉' },
      { label: '5', offset: 7, minor: false, hint: '紧张·想回家' },
      { label: '6', offset: 8, minor: false, hint: '温暖·展开' },
      { label: '7', offset: 10, minor: false, hint: '推进' },
    ],
  },
};

export function makeKey(tonic, mode = 'major') {
  const t = ((tonic % 12) + 12) % 12;
  const flat = FLAT_TONICS[mode].includes(t);
  return { tonic: t, mode, flat, name: pcName(t, flat) + (mode === 'minor' ? 'm' : '') };
}

export function pcName(pc, flat) {
  return (flat ? FLAT_NAMES : SHARP_NAMES)[((pc % 12) + 12) % 12];
}

// 某调某级的和弦：{ root 音级, pcs 三个音级, name 如 "Am" }
export function chordFor(key, degreeIndex) {
  const d = MODES[key.mode].degrees[degreeIndex];
  const root = (key.tonic + d.offset) % 12;
  const third = (root + (d.minor ? 3 : 4)) % 12;
  const fifth = (root + 7) % 12;
  return { root, pcs: [root, third, fifth], name: pcName(root, key.flat) + (d.minor ? 'm' : '') };
}

// 所有落在 [lo, hi] 内、跨度小于八度的密集排列三和弦（含转位）
function closedVoicings(pcs, lo, hi) {
  const result = [];
  for (let bottom = lo; bottom <= hi; bottom++) {
    if (!pcs.includes(bottom % 12)) continue;
    const notes = [bottom];
    for (let n = bottom + 1; n < bottom + 12 && notes.length < 3; n++) {
      if (pcs.includes(n % 12)) notes.push(n);
    }
    if (notes.length === 3 && notes[2] <= hi) result.push(notes);
  }
  return result;
}

// 右手和弦排列：选和上一个排列移动最小的转位（声部进行平滑），首个和弦靠近 D4
export function voiceChord(pcs, prev, lo = 55, hi = 74) {
  const candidates = closedVoicings(pcs, lo, hi);
  const target = prev ?? [60, 62, 66];
  let best = candidates[0];
  let bestCost = Infinity;
  for (const v of candidates) {
    const cost = v.reduce((s, n, i) => s + Math.abs(n - target[i]), 0);
    if (cost < bestCost) { best = v; bestCost = cost; }
  }
  return best;
}

// 左手低音：根音放在 E2(40)–Eb3(51) 之间
export function bassNote(rootPc, lo = 40) {
  return lo + ((rootPc - lo % 12) + 12) % 12;
}
