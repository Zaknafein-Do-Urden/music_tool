// 伴奏引擎：Tone.js 钢琴采样 + 按八分音符步进的节奏型。
// 点按钮不是"播一下"，而是排队一个和弦，在下一拍/下一小节切换；节奏由 Transport 保证。
import { chordFor, voiceChord, bassNote } from './theory.js';
import { METERS, PATTERNS } from './patterns.js';

export { METERS, PATTERNS };

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

const midiToNote = (m) => Tone.Frequency(m, 'midi').toNote();

export class Engine {
  constructor({ onStep, onLoaded }) {
    this.onStep = onStep;
    this.key = null;
    this.pattern = PATTERNS.block;
    this.meter = METERS['4/4'];
    this.bpm = 80;
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
  // bpm 指"每分钟几拍"；6/8 的一拍是附点四分音符，换算成 Transport 的四分音符速度
  setBpm(bpm) {
    this.bpm = bpm;
    Tone.Transport.bpm.rampTo(bpm * (this.meter.bpmScale ?? 1), 0.1);
  }
  setPattern(id) { this.pattern = PATTERNS[id]; }
  setMeter(id) {
    this.meter = METERS[id];
    this.step %= this.meter.steps;
    this.setBpm(this.bpm);
  }
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
    Tone.Draw.cancel(0);
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
    this.step = (step + 1) % this.meter.steps;

    const boundary = this.quantize === 'bar' ? step === 0 : this.meter.beats.includes(step);
    let changed = false;
    if (this.pending !== null && boundary) {
      this.current = this.pending;
      this.pending = null;
      this.voicing = this._voice(this.current, this.voicing);
      changed = true;
    }

    if (this.current !== null) {
      const chord = chordFor(this.key, this.current);
      const ev = this.pattern.meters[this.meter.name][step];
      // 换和弦那一刻若节奏型这一步没有低音，补一个低音+整和弦，让切换清晰可闻
      if (changed && !(ev && (ev.bass || ev.bassFifth))) {
        this._play(chord, { bass: true, notes: 'all', vel: 0.7, dur: '4n' }, time);
      } else if (ev) {
        this._play(chord, ev, time);
      }
    }

    const current = this.current;
    const pending = this.pending;
    const beat = this.meter.beats.indexOf(step);
    Tone.Draw.schedule(() => this.onStep?.({ step, beat, current, pending, changed }), time);
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
