// 拍号与伴奏织体（纯数据 + 解析，可在 Node 下测试）。
// 引擎每个十六分音符走一步；beats 为每拍起始步，用于"下一拍"换和弦和拍点指示。

export const METERS = {
  '4/4': { name: '4/4', steps: 16, beats: [0, 4, 8, 12] },
  '3/4': { name: '3/4', steps: 12, beats: [0, 4, 8] },
  '2/4': { name: '2/4', steps: 8, beats: [0, 4] },
  // 6/8 按附点四分音符数拍（每小节 2 拍），速度也按附点四分算，所以 Transport 的四分音符速度 ×1.5
  '6/8': { name: '6/8', steps: 12, beats: [0, 6], bpmScale: 1.5 },
};

// 织体写法：一小节一串记号，空格分隔，每个记号占一个八分音符（记号数 = 八分音符数）
// 或一个十六分音符（记号数 = 十六分音符数）。
//   .  不弹
//   B  低音根音   F  低音五度   O  低音根音高八度
//   A  整个和弦   0 1 2  和弦第 1/2/3 个音（由低到高）   3  最低音高八度
//   开头加 > 重音，加 - 轻弹
// 力度按位置自动给：小节第一拍最重，其余拍次之，反拍更轻。
// 2/4 没写时取 4/4 的前半小节。
export const PATTERNS = {
  block: {
    name: '柱式', desc: '每拍一个和弦，最稳最通用',
    grids: {
      '4/4': 'BA . -A . BA . -A .',
      '3/4': 'BA . -A . -A .',
      '6/8': 'BA . . A . .',
    },
  },
  arpeggio: {
    name: '分解', desc: '和弦音一个个往上走再下来，流畅柔和',
    grids: {
      '4/4': 'B0 1 2 3 B2 1 2 1',
      '3/4': 'B0 1 2 3 2 1',
      '6/8': 'B0 1 2 >3 2 1',
    },
  },
  ballad: {
    name: '抒情', desc: '稀疏留白，适合慢歌',
    grids: {
      '4/4': 'BA . . 2 F0 . A -3',
      '3/4': 'BA . 2 -1 3 -2',
      '6/8': 'BA . 2 F1 3 2',
    },
  },
  pad: {
    name: '长音', desc: '一小节只按一次，最安静，不抢人声',
    grids: {
      '4/4': 'BA . . . . . . .',
      '3/4': 'BA . . . . .',
      '6/8': 'BA . . . . .',
    },
  },
  heavy: {
    name: '厚重', desc: '柱式加八度低音，声音更饱满有力',
    grids: {
      '4/4': 'BOA . -A . BOA . -A .',
      '3/4': 'BOA . -A . -A .',
      '6/8': 'BOA . . OA . .',
    },
  },
  stride: {
    name: '跨步', desc: '低音和和弦一左一右交替，老歌、进行曲感',
    grids: {
      '4/4': 'B . A . F . A .',
      '3/4': 'B . A . A .',
      '6/8': 'B . A F . A',
    },
  },
  alberti: {
    name: '阿尔贝蒂', desc: '低-高-中-高循环，古典钢琴的流动感',
    grids: {
      '4/4': 'B0 2 1 2 0 2 1 2',
      '3/4': 'B0 2 1 2 0 2',
      '6/8': 'B0 2 1 F0 2 1',
    },
  },
  flow16: {
    name: '十六分', desc: '十六分音符分解，像流水一样连绵',
    grids: {
      '4/4': 'B0 1 2 3 2 1 2 1 F0 1 2 3 2 1 2 1',
      '3/4': 'B0 1 2 3 2 1 0 1 2 3 2 1',
      '6/8': 'B0 1 2 3 2 1 F0 1 2 3 2 1',
    },
  },
  syncopation: {
    name: '切分', desc: '3+3+2 的错位重音，流行和拉丁味',
    grids: {
      '4/4': 'BA . . >A . . A .',
      '3/4': 'BA . . >A . .',
      '6/8': 'BA . >A . A .',
    },
  },
  rock: {
    name: '摇滚', desc: '每个八分音符都弹，推动感强',
    grids: {
      '4/4': '>BA -A A -A >BA -A A -A',
      '3/4': '>BA -A A -A A -A',
      '6/8': '>BA -A -A >FA -A -A',
    },
  },
  folk: {
    name: '民谣', desc: '模仿吉他扫弦"下 下上 上下上"',
    grids: {
      '4/4': 'BA . A -A . -A A -A',
      '3/4': 'BA . A -A A -A',
      '6/8': 'BA -A -A FA -A -A',
    },
  },
  bass: {
    name: '只弹低音', desc: '只有低音，几乎是清唱的感觉',
    grids: {
      '4/4': 'B . . . F . . .',
      '3/4': 'B . . . . .',
      '6/8': 'B . . F . .',
    },
  },
};

export const DEFAULT_FAVORITES = ['block', 'arpeggio', 'ballad'];

const BASS = { B: 'root', F: 'fifth', O: 'octave' };

function parseToken(tok) {
  if (tok === '.') return null;
  let s = tok;
  let accent = 0;
  if (s[0] === '>') { accent = 0.15; s = s.slice(1); }
  else if (s[0] === '-') { accent = -0.15; s = s.slice(1); }
  const ev = { bass: [], notes: [], accent };
  for (const c of s) {
    if (BASS[c]) ev.bass.push(BASS[c]);
    else if (c === 'A') ev.notes = 'all';
    else if ('0123'.includes(c) && ev.notes !== 'all') ev.notes.push(+c);
    else throw new Error(`看不懂的织体记号 "${tok}"`);
  }
  return ev;
}

function gridFor(pattern, meterId) {
  if (pattern.grids[meterId]) return pattern.grids[meterId];
  if (meterId === '2/4') {
    const toks = pattern.grids['4/4'].split(/\s+/);
    return toks.slice(0, toks.length / 2).join(' ');
  }
  throw new Error(`${pattern.name} 缺少 ${meterId}`);
}

// 把织体编译成 { 十六分步: 事件 }。事件：{ bass[], notes 'all'|索引[], vel, dur, bassDur }，时长单位是十六分音符
export function compilePattern(id, meterId) {
  const meter = METERS[meterId];
  const toks = gridFor(PATTERNS[id], meterId).trim().split(/\s+/);
  let scale;
  if (toks.length === meter.steps) scale = 1;
  else if (toks.length * 2 === meter.steps) scale = 2;
  else throw new Error(`${PATTERNS[id].name} ${meterId} 记号数 ${toks.length} 不对`);

  const events = {};
  toks.forEach((tok, i) => {
    const ev = parseToken(tok);
    if (!ev) return;
    const step = i * scale;
    const base = step === 0 ? 0.78 : meter.beats.includes(step) ? 0.62 : step % 2 === 0 ? 0.5 : 0.42;
    ev.vel = Math.min(1, Math.max(0.15, base + ev.accent));
    delete ev.accent;
    events[step] = ev;
  });

  // 时长：和弦音响到下一次弹和弦音，低音响到下一个低音；最后一个延到小节末
  const steps = Object.keys(events).map(Number);
  const until = (from, has) => {
    const next = steps.find((s) => s > from && has(events[s]));
    return (next ?? meter.steps) - from;
  };
  for (const s of steps) {
    const ev = events[s];
    ev.dur = until(s, (e) => e.notes === 'all' || e.notes.length);
    ev.bassDur = until(s, (e) => e.bass.length);
  }
  return events;
}
