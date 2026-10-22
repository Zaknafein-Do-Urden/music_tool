// 伴奏引擎：多件乐器（见 ensembles.js）按十六分音符步进演奏织体（见 patterns.js）。
// 点按钮不是"播一下"，而是排队一个和弦，在下一拍/下一小节切换；节奏由 Transport 保证。
import { chordFor, voiceChord, bassNote, powerChord, pentaLadder } from './theory.js';
import { METERS, compileTexture, compileFill, parseToken, textureVoices } from './patterns.js';
import { ENSEMBLES } from './ensembles.js';

export { METERS, ENSEMBLES };

const Tone = window.Tone;
const midiToNote = (m) => Tone.Frequency(m, 'midi').toNote();

// ---------- 音色来源 ----------
const SALAMANDER = 'https://tonejs.github.io/audio/salamander/';
const FLUID = 'https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/';
const DRUM_KIT = 'https://tonejs.github.io/audio/drum-samples/acoustic-kit/';
// 鼓采样借用 Sampler 的音高槽位，一个音高一个鼓
const DRUM_NOTES = { kick: 'C1', snare: 'D1', hat: 'F#1', tom1: 'A1', tom2: 'G1', tom3: 'F1' };

// 每八度只取 C D# F# A 四个采样，其余音由 Sampler 移调补齐，省流量
function samplerOptions(source) {
  const urls = {};
  if (source.kind === 'salamander') {
    for (let o = 1; o <= 6; o++) for (const n of ['C', 'D#', 'F#', 'A']) urls[`${n}${o}`] = `${n.replace('#', 's')}${o}.mp3`;
    urls.C7 = 'C7.mp3';
    return { urls, baseUrl: SALAMANDER, release: 1.2 };
  }
  if (source.kind === 'fluid') {
    const [lo, hi] = source.octaves;
    const flat = { C: 'C', 'D#': 'Eb', 'F#': 'Gb', A: 'A' };
    for (let o = lo; o <= hi; o++) for (const n of Object.keys(flat)) urls[`${n}${o}`] = `${flat[n]}${o}.mp3`;
    return { urls, baseUrl: `${FLUID}${source.name}-mp3/`, release: 1 };
  }
  const files = { kick: 'kick', snare: 'snare', hat: 'hihat', tom1: 'tom1', tom2: 'tom2', tom3: 'tom3' };
  for (const [d, note] of Object.entries(DRUM_NOTES)) urls[note] = `${files[d]}.mp3`;
  return { urls, baseUrl: DRUM_KIT, release: 1 };
}

function loadSampler(options) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('音色下载超时，请检查网络')), 45000);
    const s = new Tone.Sampler({
      ...options,
      onload: () => { clearTimeout(timer); resolve(s); },
      onerror: (e) => { clearTimeout(timer); reject(e); },
    });
  });
}

// 镲和开镲没有现成采样，用高通滤波的白噪声合成
function noiseHit(decay, cutoff, out) {
  const filter = new Tone.Filter(cutoff, 'highpass').connect(out);
  return new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay, sustain: 0, release: 0.1 } }).connect(filter);
}

// 一个乐队的全部发声部件：乐器 → 各自音量 → 乐队总线 →（混响）→ 引擎总输出
async function buildRig(ensembleId, output) {
  const ens = ENSEMBLES[ensembleId];
  const bus = new Tone.Gain();
  if (ens.reverb) {
    const reverb = new Tone.Reverb({ decay: ens.reverb.decay, wet: ens.reverb.wet });
    await reverb.generate();
    bus.chain(reverb, output);
  } else {
    bus.connect(output);
  }
  const voices = {};
  await Promise.all(Object.entries(ens.voices).map(async ([vid, cfg]) => {
    const vol = new Tone.Volume(cfg.volume).connect(bus);
    const inst = await loadSampler(samplerOptions(cfg.source));
    inst.connect(vol);
    const v = { cfg, vol, inst, voicing: null };
    if (cfg.onChange) v.onChange = { ...parseToken(cfg.onChange, cfg), vel: 0.7, dur: 4, bassDur: 4 };
    if (cfg.type === 'drums') {
      v.crash = noiseHit(1.4, 5000, vol);
      v.crash.volume.value = -10;
      v.openhat = noiseHit(0.28, 8000, vol);
      v.openhat.volume.value = -16;
    }
    voices[vid] = v;
  }));
  return { id: ensembleId, voices };
}

export class Engine {
  constructor({ onStep }) {
    this.onStep = onStep;
    // 各乐队 → 混音总线 → 限幅器 → 扬声器；录音从限幅器后接，几件乐器叠加也不会爆音
    this.mix = new Tone.Gain();
    this.output = new Tone.Limiter(-1).toDestination();
    this.mix.connect(this.output);
    this.rigs = {}; // 已加载的乐队（Promise），切回来不用重新下载
    this.rig = null;
    this.ensembleId = null;
    this.textureId = null;
    this.key = null;
    this.meter = METERS['4/4'];
    this.bpm = 80;
    this.quantize = 'beat'; // 'beat' | 'bar'
    this.current = null; // 当前级数索引
    this.pending = null; // 排队中的级数索引
    this.step = 0;
    this.bar = -1;
    this.started = false;
    this.fillEvery = 0; // 0 = 不自动加花；4 / 8 = 每几小节
    this.fillThisBar = false;
    this.fillNext = false;

    // 界面更新走 Tone.Draw（requestAnimationFrame）。默认晚于 0.25s 的更新会被丢弃，
    // 手机一卡顿和弦高亮就不同步；每次更新都带完整状态，晚到也照样画
    Tone.Draw.expiration = 2;

    Tone.Transport.bpm.value = 80;
    Tone.Transport.swingSubdivision = '8n';
    Tone.Transport.scheduleRepeat((time) => this._tick(time), '16n');
  }

  // 切换乐队：先停伴奏，没下载过就下载（可能要几秒）。同时只认最后一次请求
  async setEnsemble(id, textureId) {
    this.stop();
    this.loadingId = id;
    if (!this.rigs[id]) this.rigs[id] = buildRig(id, this.mix);
    let rig;
    try {
      rig = await this.rigs[id];
    } catch (e) {
      delete this.rigs[id];
      throw e;
    }
    if (this.loadingId !== id) return false;
    this.rig = rig;
    this.ensembleId = id;
    this.textureId = textureId;
    this._compile();
    this._revoice();
    return true;
  }

  get ready() { return !!this.rig; }

  setKey(key) {
    this.key = key;
    this._revoice();
  }
  // bpm 指"每分钟几拍"；6/8 的一拍是附点四分音符，换算成 Transport 的四分音符速度
  setBpm(bpm) {
    this.bpm = bpm;
    Tone.Transport.bpm.rampTo(bpm * (this.meter.bpmScale ?? 1), 0.1);
  }
  setPattern(id) {
    this.textureId = id;
    this._compile();
  }
  setMeter(id) {
    this.meter = METERS[id];
    this._compile();
    this.step %= this.meter.steps;
    this.setBpm(this.bpm);
  }
  setQuantize(q) { this.quantize = q; }
  setFillEvery(n) { this.fillEvery = n; }

  // 音量：相对乐器默认音量的增减（dB），-24 及以下静音
  setVolume(voiceId, offsetDb) {
    const v = this.rig?.voices[voiceId];
    if (v) v.vol.volume.value = offsetDb <= -24 ? -Infinity : v.cfg.volume + offsetDb;
  }

  // 手动加花：这一小节的加花还没开始就这小节加，否则下一小节
  requestFill() {
    if (!this.playing || !this.fill) return false;
    if (this.step <= this.fill.start && !this.fillThisBar) this.fillThisBar = true;
    else this.fillNext = true;
    return true;
  }

  // 用户点了某个和弦按钮
  async press(degree) {
    if (!this.rig) return;
    if (!this.started) {
      await Tone.start();
      // iOS 17+：让网页音频不受静音键影响
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch {}
      this.started = true;
    }
    if (Tone.Transport.state !== 'started') {
      this.current = degree;
      this.pending = null;
      this._revoice();
      this.step = 0;
      this.bar = -1;
      this.fillThisBar = false;
      this.fillNext = false;
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
    for (const v of Object.values(this.rig?.voices ?? {})) v.inst.releaseAll();
    this.current = null;
    this.pending = null;
    this.step = 0;
    this.fillThisBar = false;
    this.fillNext = false;
    this.onStep?.({ step: null, current: null, pending: null, fill: false });
  }

  get playing() { return Tone.Transport.state === 'started'; }

  // 一个十六分音符多少秒（Transport 的 bpm 是四分音符速度）
  stepSeconds() { return 15 / Tone.Transport.bpm.value; }
  barSeconds() { return this.meter.steps * this.stepSeconds(); }

  _compile() {
    if (!this.ensembleId || !this.textureId) return;
    this.compiled = compileTexture(this.ensembleId, this.textureId, this.meter.name);
    this.fill = compileFill(this.ensembleId, this.textureId, this.meter.name);
    this.active = textureVoices(this.ensembleId, this.textureId);
    Tone.Transport.swing = this.compiled.swing;
  }

  // 换和弦/换调后，每件弹和弦的乐器各自选最顺的转位
  _revoice() {
    if (!this.rig || this.current === null || !this.key) return;
    const { pcs } = chordFor(this.key, this.current);
    for (const v of Object.values(this.rig.voices)) {
      if (v.cfg.chordRange) v.voicing = voiceChord(pcs, v.voicing, ...v.cfg.chordRange);
    }
  }

  _tick(time) {
    const step = this.step;
    this.step = (step + 1) % this.meter.steps;

    // 小节开头：上一小节加过花就敲一下镲，再决定这一小节要不要加花
    let crash = false;
    if (step === 0) {
      this.bar++;
      crash = this.fillThisBar;
      this.fillThisBar = this.fillNext || (this.fillEvery > 0 && (this.bar + 1) % this.fillEvery === 0);
      this.fillNext = false;
    }

    const boundary = this.quantize === 'bar' ? step === 0 : this.meter.beats.includes(step);
    let changed = false;
    if (this.pending !== null && boundary) {
      this.current = this.pending;
      this.pending = null;
      this._revoice();
      changed = true;
    }

    const inFill = this.fillThisBar && step >= this.fill.start;
    if (this.current !== null && this.rig) {
      const chord = chordFor(this.key, this.current);
      for (const vid of this.active) {
        const v = this.rig.voices[vid];
        const fillEvents = inFill && this.fill.voices[vid];
        let ev = fillEvents ? fillEvents[step] : this.compiled.voices[vid][step];
        // 换和弦那一刻若这件乐器这一步没弹低音，补一下，让切换清晰可闻
        if (changed && v.onChange && !ev?.bass.length) ev = v.onChange;
        if (ev) this._play(v, chord, ev, time);
        if (crash && v.cfg.type === 'drums') v.crash.triggerAttackRelease(1.5, time, 0.8);
      }
    }

    const current = this.current;
    const pending = this.pending;
    const beat = this.meter.beats.indexOf(step);
    const fill = this.fillThisBar || this.fillNext;
    Tone.Draw.schedule(() => this.onStep?.({ step, beat, current, pending, changed, fill }), time);
  }

  _play(v, chord, ev, time) {
    const { cfg, inst } = v;
    const sec = this.stepSeconds();

    if (cfg.type === 'drums') {
      for (const d of ev.drums) {
        if (d === 'crash') v.crash.triggerAttackRelease(1.5, time, ev.vel);
        else if (d === 'openhat') v.openhat.triggerAttackRelease(0.3, time, ev.vel);
        else inst.triggerAttackRelease(DRUM_NOTES[d], 0.5, time, d === 'hat' ? ev.vel * 0.6 : ev.vel);
      }
      return;
    }

    // 低音
    const lo = cfg.bassRange?.[0] ?? 40;
    const bass = ev.bass.map((b) => {
      if (b === 'fifth') return bassNote((chord.root + 7) % 12, lo);
      if (b === 'sixth') return bassNote((chord.root + 9) % 12, lo);
      return bassNote(chord.root, lo) + (b === 'octave' ? 12 : 0);
    });
    if (bass.length) {
      inst.triggerAttackRelease(bass.map(midiToNote), (ev.staccato ? 0.6 : ev.bassDur) * sec, time, Math.min(1, ev.vel + 0.05));
    }

    // 和弦音 / 五声梯子 / 强力和弦
    let notes = [];
    if (ev.notes === 'all') notes = [...v.voicing];
    else if (ev.notes.length && cfg.noteSet === 'penta') {
      const ladder = pentaLadder(this.key, chord.root, cfg.ladderFrom, 10);
      notes = ev.notes.map((i) => ladder[i]);
    } else if (ev.notes.length) {
      const ext = [...v.voicing, v.voicing[0] + 12];
      notes = ev.notes.map((i) => ext[i]);
    }
    if (ev.power) notes.push(...powerChord(chord.root, cfg.powerFrom ?? 40));

    if (notes.length && ev.tremolo) {
      // 轮指：按三十二分音符反复弹，强弱交替
      const n = Math.max(2, Math.round(ev.dur * 2));
      for (let k = 0; k < n; k++) {
        inst.triggerAttackRelease(notes.map(midiToNote), sec * 0.6, time + k * sec * 0.5, ev.vel * (k % 2 ? 0.7 : 0.9));
      }
    } else if (notes.length) {
      inst.triggerAttackRelease(notes.map(midiToNote), (ev.staccato ? 0.6 : ev.dur) * sec, time, ev.vel);
    }

    // 刮奏：沿五声梯子从根音一路扫上去
    if (ev.gliss) {
      const ladder = pentaLadder(this.key, chord.root, cfg.ladderFrom ?? 55, 10);
      const span = Math.min(0.35, ev.dur * sec * 0.8);
      ladder.forEach((m, i) => {
        const at = (i * span) / ladder.length;
        inst.triggerAttackRelease(midiToNote(m), Math.max(0.3, ev.dur * sec - at), time + at, ev.vel * (0.55 + (0.45 * i) / ladder.length));
      });
    }
  }
}
