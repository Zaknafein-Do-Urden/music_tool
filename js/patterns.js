// 拍号与节奏型数据（纯数据，可在 Node 下测试）。
// 引擎每个八分音符走一步；beats 为每拍起始步，用于"下一拍"换和弦和拍点指示。

export const METERS = {
  '4/4': { name: '4/4', steps: 8, beats: [0, 2, 4, 6] },
  '3/4': { name: '3/4', steps: 6, beats: [0, 2, 4] },
  '2/4': { name: '2/4', steps: 4, beats: [0, 2] },
  // 6/8 按附点四分音符数拍（每小节 2 拍），速度也按附点四分算，所以 Transport 的四分音符速度 ×1.5
  '6/8': { name: '6/8', steps: 6, beats: [0, 3], bpmScale: 1.5 },
};

// 每个节奏型按拍号给出：步 → 事件。notes 用索引引用右手音：0–2 为三和弦排列，3 为最低音高八度；'all' 为整个和弦。
// bass 弹根音，bassFifth 弹低音五度。
export const PATTERNS = {
  block: {
    name: '柱式',
    meters: {
      '4/4': {
        0: { bass: true, notes: 'all', vel: 0.8, dur: '2n' },
        2: { notes: 'all', vel: 0.5, dur: '4n' },
        4: { bass: true, notes: 'all', vel: 0.7, dur: '2n' },
        6: { notes: 'all', vel: 0.5, dur: '4n' },
      },
      '3/4': {
        0: { bass: true, notes: 'all', vel: 0.8, dur: '2n' },
        2: { notes: 'all', vel: 0.5, dur: '4n' },
        4: { notes: 'all', vel: 0.5, dur: '4n' },
      },
      '2/4': {
        0: { bass: true, notes: 'all', vel: 0.8, dur: '4n' },
        2: { notes: 'all', vel: 0.55, dur: '4n' },
      },
      '6/8': {
        0: { bass: true, notes: 'all', vel: 0.8, dur: '4n.' },
        3: { notes: 'all', vel: 0.55, dur: '4n.' },
      },
    },
  },
  arpeggio: {
    name: '分解',
    meters: {
      '4/4': {
        0: { bass: true, notes: [0], vel: 0.7, dur: '2n' },
        1: { notes: [1], vel: 0.5, dur: '4n' },
        2: { notes: [2], vel: 0.55, dur: '4n' },
        3: { notes: [3], vel: 0.5, dur: '4n' },
        4: { bass: true, notes: [2], vel: 0.6, dur: '2n' },
        5: { notes: [1], vel: 0.5, dur: '4n' },
        6: { notes: [2], vel: 0.5, dur: '4n' },
        7: { notes: [1], vel: 0.45, dur: '4n' },
      },
      '3/4': {
        0: { bass: true, notes: [0], vel: 0.7, dur: '2n.' },
        1: { notes: [1], vel: 0.5, dur: '4n' },
        2: { notes: [2], vel: 0.55, dur: '4n' },
        3: { notes: [3], vel: 0.5, dur: '4n' },
        4: { notes: [2], vel: 0.5, dur: '4n' },
        5: { notes: [1], vel: 0.45, dur: '4n' },
      },
      '2/4': {
        0: { bass: true, notes: [0], vel: 0.7, dur: '2n' },
        1: { notes: [1], vel: 0.5, dur: '4n' },
        2: { notes: [2], vel: 0.55, dur: '4n' },
        3: { notes: [1], vel: 0.45, dur: '4n' },
      },
      '6/8': {
        0: { bass: true, notes: [0], vel: 0.7, dur: '2n.' },
        1: { notes: [1], vel: 0.5, dur: '4n' },
        2: { notes: [2], vel: 0.5, dur: '4n' },
        3: { notes: [3], vel: 0.6, dur: '4n' },
        4: { notes: [2], vel: 0.5, dur: '4n' },
        5: { notes: [1], vel: 0.45, dur: '4n' },
      },
    },
  },
  ballad: {
    name: '抒情',
    meters: {
      '4/4': {
        0: { bass: true, notes: 'all', vel: 0.75, dur: '2n' },
        3: { notes: [2], vel: 0.45, dur: '8n' },
        4: { bassFifth: true, notes: [0], vel: 0.55, dur: '4n' },
        6: { notes: 'all', vel: 0.5, dur: '4n' },
        7: { notes: [3], vel: 0.4, dur: '8n' },
      },
      '3/4': {
        0: { bass: true, notes: 'all', vel: 0.75, dur: '2n.' },
        2: { notes: [2], vel: 0.45, dur: '4n' },
        3: { notes: [1], vel: 0.4, dur: '8n' },
        4: { notes: [3], vel: 0.45, dur: '4n' },
        5: { notes: [2], vel: 0.4, dur: '8n' },
      },
      '2/4': {
        0: { bass: true, notes: 'all', vel: 0.75, dur: '4n' },
        2: { bassFifth: true, notes: [0], vel: 0.55, dur: '4n' },
        3: { notes: [2], vel: 0.45, dur: '8n' },
      },
      '6/8': {
        0: { bass: true, notes: 'all', vel: 0.75, dur: '2n.' },
        2: { notes: [2], vel: 0.4, dur: '8n' },
        3: { bassFifth: true, notes: [1], vel: 0.55, dur: '4n.' },
        4: { notes: [3], vel: 0.45, dur: '8n' },
        5: { notes: [2], vel: 0.4, dur: '8n' },
      },
    },
  },
};
