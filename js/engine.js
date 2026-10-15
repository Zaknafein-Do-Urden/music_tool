// 伴奏引擎：Tone.js 钢琴采样 + 按八分音符步进的节奏型。
// 点按钮不是"播一下"，而是排队一个和弦，在下一拍/下一小节切换；节奏由 Transport 保证。
import { chordFor, voiceChord, bassNote } from './theory.js';

const Tone = window.Tone;

// Salamander Grand Piano 采样（Tone.js 官方托管），只取 A1–C7 节省流量
const SAMPLE_BASE = 'https://tonejs.github.io/audio/salamander/';
function sampleUrls() {
  const urls = {};
  for (let oct = 1; oct <= 6; oct++) {
    for (const n of ['C', 'D#', 'F#', 'A']) {
      urls[`${n}${oct}`] = `${n.replace('#', 's')}${oct}.mp3`;
    }
  }
  urls.C7 = 'C7.mp3';
  return urls;
}

// 节奏型：一小节 8 个八分音符步。notes 用索引引用右手音：0–2 为三和弦排列，3 为最低音高八度；'all' 为整个和弦
export const PATTERNS = {
  block: {
    name: '柱式',
    steps: {
      0: { bass: true, notes: 'all', vel: 0.8, dur: '2n' },
      2: { notes: 'all', vel: 0.5, dur: '4n' },
      4: { bass: true, notes: 'all', vel: 0.7, dur: '2n' },
      6: { notes: 'all', vel: 0.5, dur: '4n' },
    },
  },
  arpeggio: {
    name: '分解',
    steps: {
      0: { bass: true, notes: [0], vel: 0.7, dur: '2n' },
      1: { notes: [1], vel: 0.5, dur: '4n' },
      2: { notes: [2], vel: 0.55, dur: '4n' },
      3: { notes: [3], vel: 0.5, dur: '4n' },
      4: { bass: true, notes: [2], vel: 0.6, dur: '2n' },
      5: { notes: [1], vel: 0.5, dur: '4n' },
      6: { notes: [2], vel: 0.5, dur: '4n' },
      7: { notes: [1], vel: 0.45, dur: '4n' },
    },
  },
  ballad: {
    name: '抒情',
    steps: {
      0: { bass: true, notes: 'all', vel: 0.75, dur: '2n' },
      3: { notes: [2], vel: 0.45, dur: '8n' },
      4: { bassFifth: true, notes: [0], vel: 0.55, dur: '4n' },
      6: { notes: 'all', vel: 0.5, dur: '4n' },
      7: { notes: [3], vel: 0.4, dur: '8n' },
    },
  },
};

const midiToNote = (m) => Tone.Frequency(m, 'midi').toNote();

export class Engine {
  constructor({ onStep, onLoaded }) {
    this.onStep = onStep;
    this.key = null;
    this.pattern = PATTERNS.block;
    this.quantize = 'beat'; // 'beat' | 'bar'
    this.current = null; // 当前级数索引
    this.pending = null; // 排队中的级数索引
    this.voicing = null;
    this.step = 0;
    this.started = false;

    this.piano = new Tone.Sampler({
      urls: sampleUrls(),
      baseUrl: SAMPLE_BASE,
      release: 1.2,
      onload: onLoaded,
    }).toDestination();
    this.piano.volume.value = -3;

    Tone.Transport.bpm.value = 80;
    Tone.Transport.scheduleRepeat((time) => this._tick(time), '8n');
  }

  setKey(key) {
    this.key = key;
    if (this.current !== null) this.voicing = this._voice(this.current, this.voicing);
  }
  setBpm(bpm) { Tone.Transport.bpm.rampTo(bpm, 0.1); }
  setPattern(id) { this.pattern = PATTERNS[id]; }
  setQuantize(q) { this.quantize = q; }

  // 用户点了某个和弦按钮
  async press(degree) {
    if (!this.started) {
      await Tone.start();
      // iOS 17+：让网页音频不受静音键影响
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
      this.started = true;
    }
    if (Tone.Transport.state !== 'started') {
      this.current = degree;
      this.pending = null;
      this.voicing = this._voice(degree, this.voicing);
      this.step = 0;
      Tone.Transport.start('+0.05');
      return;
    }
    // 点当前正在响的和弦 = 取消排队
    this.pending = degree === this.current ? null : degree;
    this.onStep?.({ step: null, current: this.current, pending: this.pending });
  }

  stop() {
    Tone.Transport.stop();
    this.piano.releaseAll();
    this.current = null;
    this.pending = null;
    this.step = 0;
    this.onStep?.({ step: null, current: null, pending: null });
  }

  get playing() { return Tone.Transport.state === 'started'; }

  _voice(degree, prev) {
    const chord = chordFor(this.key, degree);
    return voiceChord(chord.pcs, prev);
  }

  _tick(time) {
    const step = this.step;
    this.step = (step + 1) % 8;

    const boundary = this.quantize === 'bar' ? step === 0 : step % 2 === 0;
    let changed = false;
    if (this.pending !== null && boundary) {
      this.current = this.pending;
      this.pending = null;
      this.voicing = this._voice(this.current, this.voicing);
      changed = true;
    }

    if (this.current !== null) {
      const chord = chordFor(this.key, this.current);
      const ev = this.pattern.steps[step];
      // 换和弦那一刻若节奏型这一步没有低音，补一个低音+整和弦，让切换清晰可闻
      if (changed && !(ev && (ev.bass || ev.bassFifth))) {
        this._play(chord, { bass: true, notes: 'all', vel: 0.7, dur: '4n' }, time);
      } else if (ev) {
        this._play(chord, ev, time);
      }
    }

    const current = this.current;
    const pending = this.pending;
    Tone.Draw.schedule(() => this.onStep?.({ step, current, pending, changed }), time);
  }

  _play(chord, ev, time) {
    const ext = [...this.voicing, this.voicing[0] + 12];
    const notes = ev.notes === 'all' ? [...this.voicing] : ev.notes.map((i) => ext[i]);
    const bass = bassNote(chord.root);
    if (ev.bass) notes.push(bass);
    if (ev.bassFifth) notes.push(bassNote((chord.root + 7) % 12));
    this.piano.triggerAttackRelease(notes.map(midiToNote), ev.dur, time, ev.vel);
  }
}
