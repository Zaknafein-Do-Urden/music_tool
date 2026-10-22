// 录音：人声（麦克风原始流）和伴奏（钢琴输出）分两轨同时录，结束后可调音量、对齐再混成 WAV。
// 戴耳机时两轨互不串音，效果最好；外放时人声轨里会混进伴奏。
import { encodeWav } from './wav.js';

const Tone = window.Tone;

export function pickMime() {
  const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
  return types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? '';
}

export function recordStream(stream, mimeType) {
  const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const done = new Promise((resolve) => { rec.onstop = () => resolve(new Blob(chunks, { type: rec.mimeType })); });
  rec.start(1000);
  return { rec, done };
}

// 人声比伴奏晚到的时间：歌手听到伴奏要经过输出延迟，人声进麦克风还有输入延迟
export function estimateVoiceDelay() {
  const raw = Tone.context.rawContext;
  const out = raw.outputLatency || raw.baseLatency || 0;
  return Math.min(0.3, Math.max(0, out + 0.02));
}

export class Recorder {
  constructor({ mic, source }) {
    this.mic = mic;
    this.source = source; // 伴奏的 Tone 节点
    this.active = null;
  }

  get recording() { return !!this.active; }

  async start() {
    if (!window.MediaRecorder) throw new Error('这个浏览器不支持录音');
    await this.mic.acquire('record');
    const dest = Tone.context.createMediaStreamDestination();
    this.source.connect(dest);
    const mime = pickMime();
    this.active = {
      dest,
      startedAt: performance.now(),
      voice: recordStream(this.mic.stream, mime),
      acc: recordStream(dest.stream, mime),
    };
  }

  // 返回 { voice: Blob, acc: Blob, seconds }
  async stop() {
    const a = this.active;
    this.active = null;
    a.voice.rec.stop();
    a.acc.rec.stop();
    const [voice, acc] = await Promise.all([a.voice.done, a.acc.done]);
    this.source.disconnect(a.dest);
    this.mic.release('record');
    return { voice, acc, seconds: (performance.now() - a.startedAt) / 1000 };
  }
}

// 解码两轨（只需一次），之后 mix 可反复调用
export async function decodeTake({ voice, acc }) {
  const ctx = new OfflineAudioContext(1, 1, 44100);
  const decode = async (blob) => ctx.decodeAudioData(await blob.arrayBuffer());
  const [v, a] = await Promise.all([decode(voice), decode(acc)]);
  return { voice: v, acc: a };
}

// voiceDelay 秒：人声整体提前多少（正数 = 剪掉人声开头这么长）
export async function mixTake({ voice, acc }, { voiceGain = 1, accGain = 0.8, voiceDelay = 0 } = {}) {
  const sr = acc.sampleRate;
  const length = Math.ceil(Math.max(acc.duration, voice.duration - voiceDelay) * sr);
  const ctx = new OfflineAudioContext(1, Math.max(1, length), sr);
  const add = (buffer, gain, when, offset) => {
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    src.buffer = buffer;
    g.gain.value = gain;
    src.connect(g).connect(ctx.destination);
    src.start(when, offset);
  };
  add(acc, accGain, 0, 0);
  if (voiceDelay >= 0) add(voice, voiceGain, 0, voiceDelay);
  else add(voice, voiceGain, -voiceDelay, 0);

  const out = (await ctx.startRendering()).getChannelData(0);
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i] *= 0.98 / peak;
  return new Blob([encodeWav(out, sr)], { type: 'audio/wav' });
}
