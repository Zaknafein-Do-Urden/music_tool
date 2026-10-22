// 乐队（乐器组合）：乐器配置 + 织体 + 加花。纯数据，可在 Node 下测试；记号写法见 patterns.js 顶部。
//
// 乐器 type：
//   keys  弹和弦的乐器（钢琴、吉他、古筝、琵琶、长笛）
//   bass  贝斯
//   drums 鼓
// 乐器 noteSet：数字记号指什么
//   chord 和弦音（0–2 由低到高，3 = 最低音高八度）
//   penta 五声音阶梯子（0 = 和弦根音，往上 1 2 3… 只走宫商角徵羽，最多到 9）
// 音区（MIDI 音高）：chordRange 和弦排列，bassRange 低音，powerFrom 强力和弦根音下限，ladderFrom 五声梯子起点
// volume：默认音量（dB）。FluidR3 采样比钢琴、鼓采样小声很多，按实测峰值和钢琴拉平
// 乐队 progressions：主界面下方列出的常用和弦走向，steps 是按钮序号（0 = 左上），显示时换成按钮上的级数
// 乐队 harmony：'penta' 时和弦按钮五声化（中国风），不写就是普通三和弦
// onChange：换和弦那一刻如果这件乐器这一步没弹低音，补弹什么，让切换听得清楚

const FLUID = (name, octaves) => ({ kind: 'fluid', name, octaves });

export const ENSEMBLES = {
  piano: {
    name: '钢琴',
    voices: {
      piano: {
        name: '钢琴', type: 'keys', noteSet: 'chord', source: { kind: 'salamander' }, volume: -3,
        chordRange: [55, 74], bassRange: [40, 51], onChange: 'BA',
      },
    },
    defaultFavorites: ['block', 'arpeggio', 'ballad'],
    progressions: {
      major: [
        { name: '万能', steps: [0, 4, 5, 3] },
        { name: '校园', steps: [0, 5, 3, 4] },
        { name: '抒情', steps: [3, 4, 2, 5, 1, 4, 0] },
        { name: '流行', steps: [5, 3, 0, 4] },
      ],
      minor: [
        { name: '忧伤', steps: [0, 4, 1, 5] },
        { name: '经典', steps: [0, 2, 3, 0] },
        { name: '下行', steps: [0, 5, 4, 3] },
        { name: '上扬', steps: [4, 5, 0] },
      ],
    },
    textures: {
      block: { name: '柱式', desc: '每拍一个和弦，最稳最通用', parts: { piano: {
        '4/4': 'BA . -A . BA . -A .', '3/4': 'BA . -A . -A .', '6/8': 'BA . . A . .' } } },
      arpeggio: { name: '分解', desc: '和弦音一个个往上走再下来，流畅柔和', parts: { piano: {
        '4/4': 'B0 1 2 3 B2 1 2 1', '3/4': 'B0 1 2 3 2 1', '6/8': 'B0 1 2 >3 2 1' } } },
      ballad: { name: '抒情', desc: '稀疏留白，适合慢歌', parts: { piano: {
        '4/4': 'BA . . 2 F0 . A -3', '3/4': 'BA . 2 -1 3 -2', '6/8': 'BA . 2 F1 3 2' } } },
      pad: { name: '长音', desc: '一小节只按一次，最安静，不抢人声', parts: { piano: {
        '4/4': 'BA . . . . . . .', '3/4': 'BA . . . . .', '6/8': 'BA . . . . .' } } },
      heavy: { name: '厚重', desc: '柱式加八度低音，声音更饱满有力', parts: { piano: {
        '4/4': 'BOA . -A . BOA . -A .', '3/4': 'BOA . -A . -A .', '6/8': 'BOA . . OA . .' } } },
      stride: { name: '跨步', desc: '低音和和弦一左一右交替，老歌、进行曲感', parts: { piano: {
        '4/4': 'B . A . F . A .', '3/4': 'B . A . A .', '6/8': 'B . A F . A' } } },
      alberti: { name: '阿尔贝蒂', desc: '低-高-中-高循环，古典钢琴的流动感', parts: { piano: {
        '4/4': 'B0 2 1 2 0 2 1 2', '3/4': 'B0 2 1 2 0 2', '6/8': 'B0 2 1 F0 2 1' } } },
      flow16: { name: '十六分', desc: '十六分音符分解，像流水一样连绵', parts: { piano: {
        '4/4': 'B0 1 2 3 2 1 2 1 F0 1 2 3 2 1 2 1', '3/4': 'B0 1 2 3 2 1 0 1 2 3 2 1', '6/8': 'B0 1 2 3 2 1 F0 1 2 3 2 1' } } },
      syncopation: { name: '切分', desc: '3+3+2 的错位重音，流行和拉丁味', parts: { piano: {
        '4/4': 'BA . . >A . . A .', '3/4': 'BA . . >A . .', '6/8': 'BA . >A . A .' } } },
      rock: { name: '摇滚', desc: '每个八分音符都弹，推动感强', parts: { piano: {
        '4/4': '>BA -A A -A >BA -A A -A', '3/4': '>BA -A A -A A -A', '6/8': '>BA -A -A >FA -A -A' } } },
      folk: { name: '民谣', desc: '模仿吉他扫弦"下 下上 上下上"', parts: { piano: {
        '4/4': 'BA . A -A . -A A -A', '3/4': 'BA . A -A A -A', '6/8': 'BA -A -A FA -A -A' } } },
      bass: { name: '只弹低音', desc: '只有低音，几乎是清唱的感觉', parts: { piano: {
        '4/4': 'B . . . F . . .', '3/4': 'B . . . . .', '6/8': 'B . . F . .' } } },
    },
    // 加花：小节最后一拍和弦音快速往上跑
    fills: { piano: { '4/4': '0 1 2 3', '3/4': '0 1 2 3', '6/8': '0 1 2 3 2 3' } },
    credits: ['钢琴：Salamander Grand Piano（Alexander Holm，CC BY 3.0），经 Tone.js 托管'],
  },

  band: {
    name: '摇滚乐队',
    voices: {
      drums: { name: '鼓', type: 'drums', source: { kind: 'drums' }, volume: -7 },
      bass: {
        name: '贝斯', type: 'bass', source: FLUID('electric_bass_finger', [1, 3]), volume: 6,
        bassRange: [36, 47], onChange: 'B',
      },
      guitar: {
        name: '失真吉他', type: 'keys', noteSet: 'chord', source: FLUID('distortion_guitar', [2, 4]), volume: 2,
        chordRange: [52, 71], powerFrom: 40,
      },
      clean: {
        name: '清音吉他', type: 'keys', noteSet: 'chord', source: FLUID('electric_guitar_clean', [3, 5]), volume: 8,
        chordRange: [52, 71],
      },
    },
    defaultFavorites: ['rock8', 'pop16', 'halftime'],
    progressions: {
      major: [
        { name: '万能', steps: [0, 4, 5, 3] },
        { name: '摇滚', steps: [0, 3, 4, 3] },
        { name: '流行', steps: [5, 3, 0, 4] },
        { name: '老歌', steps: [0, 5, 3, 4] },
      ],
      minor: [
        { name: '硬摇滚', steps: [0, 4, 5, 0] },
        { name: '忧伤', steps: [0, 4, 1, 5] },
        { name: '下行', steps: [0, 5, 4, 3] },
        { name: '布鲁斯', steps: [0, 2, 0, 3] },
      ],
    },
    textures: {
      rock8: { name: '摇滚八分', desc: '失真吉他闷音八分，最典型的摇滚', parts: {
        drums: { '4/4': 'KH H SH H KH KH SH H', '3/4': 'KH H SH H SH H', '6/8': 'KH H H SH H H' },
        bass: { '4/4': 'B -B B -B B -B B -B', '3/4': 'B -B B -B B -B', '6/8': 'B -B -B F -B -B' },
        guitar: { '4/4': '>P !P !P !P >P !P !P !P', '3/4': '>P !P !P !P !P !P', '6/8': '>P !P !P >P !P !P' },
      } },
      pop16: { name: '流行十六分', desc: '十六分踩镲 + 清音扫弦，现代流行', parts: {
        drums: {
          '4/4': 'KH -H H -H SH -H H -H KH -H KH -H SH -H H -H',
          '3/4': 'KH -H H -H SH -H H -H SH -H H -H',
          '6/8': 'KH -H H -H H -H SH -H H -H H -H',
        },
        bass: { '4/4': 'B . . -B . . F .', '3/4': 'B . . -B F .', '6/8': 'B . . F . .' },
        clean: { '4/4': 'A . A -A . -A A -A', '3/4': 'A . A -A A -A', '6/8': 'A -A -A A -A -A' },
      } },
      halftime: { name: '抒情慢摇', desc: '军鼓只在第三拍，宽松舒展，适合慢歌', parts: {
        drums: { '4/4': 'KH -H -H -H SH -H -H -H', '3/4': 'KH -H -H -H SH -H', '6/8': 'KH -H -H SH -H -H' },
        bass: { '4/4': 'B . . . . . F .', '3/4': 'B . . . . .', '6/8': 'B . . F . .' },
        clean: { '4/4': '0 1 2 3 2 1 2 1', '3/4': '0 1 2 3 2 1', '6/8': '0 1 2 3 2 1' },
      } },
      groove: { name: '律动', desc: '只有鼓和贝斯，给人声留足空间', parts: {
        drums: { '4/4': 'KH -H SH -H KH KH SH -H', '3/4': 'KH -H SH -H SH -H', '6/8': 'KH -H -H SH -H -H' },
        bass: { '4/4': 'B . . B . B F .', '3/4': 'B . . B F .', '6/8': 'B . F B . F' },
      } },
      unplugged: { name: '不插电', desc: '清音吉他扫弦 + 贝斯，没有鼓', parts: {
        bass: { '4/4': 'B . . . F . . .', '3/4': 'B . . . . .', '6/8': 'B . . F . .' },
        clean: { '4/4': 'A . A -A . -A A -A', '3/4': 'A . A -A A -A', '6/8': 'A -A -A A -A -A' },
      } },
      power: { name: '强力长音', desc: '失真长音 + 每小节一镲，副歌爆发', parts: {
        drums: { '4/4': 'KC -H SH -H KH KH SH -H', '3/4': 'KC -H SH -H SH -H', '6/8': 'KC -H -H SH -H -H' },
        bass: { '4/4': 'B -B B -B B -B B -B', '3/4': 'B -B B -B B -B', '6/8': 'B -B -B F -B -B' },
        guitar: { '4/4': '>P . . . . . . .', '3/4': '>P . . . . .', '6/8': '>P . . . . .' },
      } },
      disco: { name: '迪斯科', desc: '每拍底鼓 + 八度贝斯，适合跳舞', parts: {
        drums: { '4/4': 'KH Q KS Q KH Q KS Q', '3/4': 'KH Q KS Q KS Q', '6/8': 'KH -H Q KS -H Q' },
        bass: { '4/4': 'B O B O B O B O', '3/4': 'B O B O B O', '6/8': 'B O O F O O' },
        clean: { '4/4': '. !A . !A . !A . !A', '3/4': '. !A . !A . !A', '6/8': '. !A !A . !A !A' },
      } },
      reggae: { name: '雷鬼', desc: '吉他只在反拍"嚓"一下，慵懒放松', parts: {
        drums: { '4/4': 'H -H H -H KSH -H H -H', '3/4': 'H -H H -H KSH -H', '6/8': 'H -H -H KSH -H -H' },
        bass: { '4/4': 'B . . F . . B .', '3/4': 'B . . F . .', '6/8': 'B . . F . .' },
        clean: { '4/4': '. . >!A . . . >!A .', '3/4': '. . !A . !A .', '6/8': '. . . >!A . .' },
      } },
      shuffle: { name: '布鲁斯', desc: '摇摆的三连音律动，老摇滚、布鲁斯', swing: 1, parts: {
        drums: { '4/4': 'KH H SH H KH H SH H', '3/4': 'KH H SH H SH H', '6/8': 'KH H H SH H H' },
        bass: { '4/4': 'B B F F N N F F', '3/4': 'B F N F B F', '6/8': 'B F N B F N' },
        guitar: { '4/4': '>P . !P . >P . !P .', '3/4': '>P . !P . !P .', '6/8': '>P . !P >P . !P' },
      } },
    },
    // 加花：鼓从军鼓滚到嗵鼓，贝斯往上走，吉他快速拨弦（都写成十六分，靠右对齐到小节末）
    fills: {
      drums: { '4/4': '>S S T T M M L L', '3/4': '>S S T T M M L L', '6/8': '>S S T M L L' },
      bass: { '4/4': 'B . F . O . F .', '3/4': 'B . F . O . F .', '6/8': 'B . F . O .' },
      guitar: { '4/4': '>P P P P >P P P P', '3/4': '>P P P P >P P P P', '6/8': '>P P P P P P' },
      clean: { '4/4': 'A -A A -A A -A A -A', '3/4': 'A -A A -A A -A A -A', '6/8': 'A -A A -A A -A' },
    },
    credits: [
      '贝斯、吉他：FluidR3 GM 音色库（Frank Wen，CC BY 3.0），经 midi-js-soundfonts 托管',
      '鼓：Chris Wilson web-audio-samples，经 Tone.js 托管；镲和开镲为合成音',
    ],
  },

  chinese: {
    name: '中国风',
    // 和弦五声化：按钮换成五声版（见 theory.js PENTA_DEGREES），推荐用中国风的和弦走向习惯
    harmony: 'penta',
    voices: {
      guzheng: {
        name: '古筝', type: 'keys', noteSet: 'penta', source: FLUID('koto', [2, 6]), volume: 13,
        chordRange: [55, 74], bassRange: [38, 49], ladderFrom: 55, onChange: 'B',
      },
      pipa: {
        name: '琵琶', type: 'keys', noteSet: 'penta', source: FLUID('shamisen', [3, 6]), volume: 11,
        chordRange: [57, 76], ladderFrom: 60,
      },
      flute: {
        name: '长笛', type: 'keys', noteSet: 'chord', source: FLUID('flute', [4, 6]), volume: 6,
        chordRange: [72, 88],
      },
    },
    reverb: { decay: 3.5, wet: 0.35 },
    defaultFavorites: ['flow', 'gliss', 'tremolo'],
    progressions: {
      major: [
        { name: '古风', steps: [0, 5, 3, 4] },
        { name: '婉转', steps: [5, 3, 4, 0] },
        { name: '抒情', steps: [3, 4, 2, 5] },
        { name: '卡农', steps: [0, 4, 5, 2, 3, 0, 3, 4] },
      ],
      minor: [
        { name: '古风', steps: [0, 4, 5, 0] },
        { name: '沉吟', steps: [0, 2, 3, 0] },
        { name: '回望', steps: [4, 5, 1, 0] },
        { name: '叙事', steps: [0, 1, 4, 5] },
      ],
    },
    textures: {
      flow: { name: '流水', desc: '古筝五声音阶上下流动，长笛轻轻托着', parts: {
        guzheng: { '4/4': 'B0 1 2 3 4 3 2 1', '3/4': 'B0 1 2 3 2 1', '6/8': 'B0 1 2 3 2 1' },
        flute: { '4/4': '-2 . . . -1 . . .', '3/4': '-2 . . . . .', '6/8': '-2 . . -1 . .' },
      } },
      gliss: { name: '刮奏', desc: '每小节一个古筝刮奏，大气', parts: {
        guzheng: { '4/4': 'BG . . . 4 . 2 .', '3/4': 'BG . . . 2 .', '6/8': 'BG . . 4 . 2' },
        flute: { '4/4': '-2 . . . . . . .', '3/4': '-2 . . . . .', '6/8': '-2 . . . . .' },
      } },
      tremolo: { name: '轮指', desc: '琵琶轮指持续颤音，古筝托住低音', parts: {
        guzheng: { '4/4': 'B . . . F . . .', '3/4': 'B . . . . .', '6/8': 'B . . F . .' },
        pipa: { '4/4': '*2 . . . *0 . . .', '3/4': '*2 . . . . .', '6/8': '*2 . . *0 . .' },
      } },
      lively: { name: '欢快', desc: '琵琶弹挑跳跃，民乐合奏的热闹', parts: {
        guzheng: { '4/4': 'B . F . B . F .', '3/4': 'B . F . F .', '6/8': 'B . . F . .' },
        pipa: { '4/4': '!0 !2 !1 !2 !0 !2 !1 !2', '3/4': '!0 !2 !1 !2 !0 !2', '6/8': '!0 !2 !1 !0 !2 !1' },
        flute: { '4/4': '-2 . . . -1 . . .', '3/4': '-2 . . . . .', '6/8': '-2 . . -1 . .' },
      } },
      flow16: { name: '十六分流水', desc: '古筝十六分音符连绵不断', parts: {
        guzheng: {
          '4/4': 'B0 1 2 3 4 5 4 3 2 1 2 3 4 3 2 1',
          '3/4': 'B0 1 2 3 4 3 2 1 2 3 2 1',
          '6/8': 'B0 1 2 3 4 3 F0 1 2 3 2 1',
        },
        flute: { '4/4': '-2 . . . . . . .', '3/4': '-2 . . . . .', '6/8': '-2 . . . . .' },
      } },
      harmonics: { name: '泛音', desc: '稀疏的高音点缀，清淡空灵（模仿古琴泛音）', parts: {
        guzheng: { '4/4': 'B . . . -7 . . .', '3/4': 'B . . -7 . .', '6/8': 'B . . -7 . .' },
      } },
      sustain: { name: '长音', desc: '古筝一小节一个和弦，长笛托着，最安静', parts: {
        guzheng: { '4/4': 'BA . . . . . . .', '3/4': 'BA . . . . .', '6/8': 'BA . . . . .' },
        flute: { '4/4': '-1 . . . . . . .', '3/4': '-1 . . . . .', '6/8': '-1 . . . . .' },
      } },
    },
    // 加花：古筝最后一拍刮奏，琵琶轮指，长笛往上跑
    fills: {
      guzheng: { '4/4': 'G . . .', '3/4': 'G . . .', '6/8': 'G . . . . .' },
      pipa: { '4/4': '*2 . . .', '3/4': '*2 . . .', '6/8': '*2 . . . . .' },
      flute: { '4/4': '0 1 2 3', '3/4': '0 1 2 3', '6/8': '0 1 2 3 2 1' },
    },
    credits: [
      '古筝、琵琶、长笛：FluidR3 GM 音色库（Frank Wen，CC BY 3.0），经 midi-js-soundfonts 托管。古筝用 Koto、琵琶用 Shamisen 近似',
    ],
  },
};

export const DEFAULT_ENSEMBLE = 'piano';
