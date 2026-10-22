// 音高曲线画布：横轴时间，背景横线是音（有调时只画调内音并标级数），
// 曲线按离最近的音偏多少上色：绿 = 准（±25 音分内），黄 = 有点偏（±50），红 = 偏得多。
import { scalePcs, degreeOf, centsOff } from './pitchtrack.js';
import { midiName } from './pitch.js';

const ALL_PCS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const COLORS = { good: '#6edca0', near: '#f0c75a', off: '#ff7b7b' };

export function colorFor(cents) {
  const a = Math.abs(cents);
  return a <= 25 ? COLORS.good : a <= 50 ? COLORS.near : COLORS.off;
}

// 曲线的纵向范围：唱到的最低最高音上下各留 pad 个半音，至少 span 个半音
export function curveRange(curve, { pad = 2, span = 12, fallback = [55, 72] } = {}) {
  let lo = Infinity, hi = -Infinity;
  for (const m of curve) if (m === m) { lo = Math.min(lo, m); hi = Math.max(hi, m); }
  if (lo > hi) return fallback;
  lo = Math.floor(lo) - pad;
  hi = Math.ceil(hi) + pad;
  if (hi - lo < span) { const c = (lo + hi) / 2; lo = Math.floor(c - span / 2); hi = lo + span; }
  return [lo, hi];
}

// curve：数组或 Float32Array（NaN = 没音高），每 hop 秒一点；画 [t0, t1] 这段。cursor：播放位置（秒）
export function drawCurve(canvas, { curve, hop, t0, t1, lo, hi, key = null, cursor = null }) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const y = (m) => h - ((m - lo) / (hi - lo)) * h;
  const x = (t) => ((t - t0) / (t1 - t0)) * w;
  const pcs = key ? scalePcs(key) : ALL_PCS;

  // 背景横线和左侧标签
  g.font = '11px -apple-system, sans-serif';
  g.textBaseline = 'middle';
  for (let m = Math.ceil(lo); m <= Math.floor(hi); m++) {
    const pc = ((m % 12) + 12) % 12;
    if (!pcs.includes(pc)) continue;
    const deg = key ? degreeOf(pc, key) : null;
    const tonic = key ? pc === key.tonic : pc === 0;
    g.strokeStyle = tonic ? '#4a5068' : '#2a2e3b';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, y(m) + 0.5);
    g.lineTo(w, y(m) + 0.5);
    g.stroke();
    if (key || pc === 0) {
      g.fillStyle = tonic ? '#c4c9d6' : '#6c7285';
      g.fillText(key ? `${deg} ${midiName(m)}` : midiName(m), 4, y(m) - 7);
    }
  }

  // 曲线：相邻两点都有音高才连线，颜色看后一点的偏差
  g.lineWidth = 3;
  g.lineCap = 'round';
  const i0 = Math.max(1, Math.floor(t0 / hop)), i1 = Math.min(curve.length - 1, Math.ceil(t1 / hop));
  for (let i = i0; i <= i1; i++) {
    const a = curve[i - 1], b = curve[i];
    if (a !== a || b !== b) continue;
    g.strokeStyle = colorFor(centsOff(b, pcs));
    g.beginPath();
    g.moveTo(x((i - 1) * hop), y(a));
    g.lineTo(x(i * hop), y(b));
    g.stroke();
  }

  if (cursor !== null) {
    g.strokeStyle = '#f0a43a';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x(cursor), 0);
    g.lineTo(x(cursor), h);
    g.stroke();
  }
}
