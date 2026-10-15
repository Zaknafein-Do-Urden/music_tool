// 麦克风：定调、实时推荐、录音共用一个输入流，按使用者计数开关。
// 打开后每 40ms 做一次音高检测，把帧 { t, midi, clarity } 发给订阅者。
import { yin, freqToMidi } from './pitch.js';

const Tone = window.Tone;

function setAudioSession(type) {
  // iOS 17+：playback 不受静音键影响；开麦时必须切到 play-and-record
  try { if (navigator.audioSession) navigator.audioSession.type = type; } catch {}
}

export class Mic {
  constructor() {
    this.users = new Set();
    this.listeners = new Set();
    this.headphones = false; // 戴耳机时关掉回声消除，音质更好；外放时打开，尽量滤掉伴奏
    this.stream = null;
  }

  get open() { return !!this.stream; }

  async acquire(user) {
    this.users.add(user);
    if (!this.stream) await this._open();
  }

  release(user) {
    this.users.delete(user);
    if (!this.users.size) this._close();
  }

  onFrame(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  async setHeadphones(on) {
    this.headphones = on;
    if (this.stream) {
      this._close();
      await this._open();
    }
  }

  async _open() {
    await Tone.start();
    setAudioSession('play-and-record');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: !this.headphones, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      this.users.clear();
      setAudioSession('playback');
      throw e;
    }
    this.source = Tone.context.createMediaStreamSource(this.stream);
    this.analyser = new Tone.Analyser({ type: 'waveform', size: 2048 });
    Tone.connect(this.source, this.analyser);
    this.timer = setInterval(() => this._poll(), 40);
  }

  _close() {
    if (!this.stream) return;
    clearInterval(this.timer);
    this.stream.getTracks().forEach((t) => t.stop());
    this.source.disconnect();
    this.analyser.dispose();
    this.stream = null;
    setAudioSession('playback');
  }

  _poll() {
    const r = yin(this.analyser.getValue(), Tone.context.sampleRate);
    const frame = { t: performance.now() / 1000, midi: r ? freqToMidi(r.freq) : null, clarity: r ? r.clarity : 0 };
    this.listeners.forEach((fn) => fn(frame));
  }
}
