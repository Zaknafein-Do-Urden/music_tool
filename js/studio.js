// 录音室：点一下开始录、再点停止。录音存在本地（IndexedDB），录完自动画音高曲线、判断调和音域。
// 可以选一个伴奏文件，录音时从耳机放出来（人声轨里不会混进伴奏）。
import { Mic } from './mic.js';
import { pickMime, recordStream } from './recorder.js';
import { midiName } from './pitch.js';
import { segmentNotes, estimateKey } from './analysis.js';
import { MODES, makeKey } from './theory.js';
import { HOP, pitchFrameCount, trackPitch, cleanCurve, curveToFrames } from './pitchtrack.js';
import { drawCurve, curveRange } from './curve.js';
import * as store from './store.js';

const Tone = window.Tone;
const $ = (id) => document.getElementById(id);
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const LIVE_HOP = 0.04; // mic.js 每 40ms 一帧
const LIVE_SPAN = 6; // 录音时显示最近几秒的曲线
const ANALYSIS_SR = 16000;
const CONFIDENCE = { high: '大', mid: '一般', low: '小' };

function micError(e) {
  return e?.name === 'NotAllowedError'
    ? '没有麦克风权限：请在 Safari 的网站设置里允许麦克风'
    : `麦克风打不开：${e?.message ?? e}`;
}

const statusEl = $('status');
const idleStatus = '戴上耳机，点红色按钮开始录音';

// ---------- 耳机 ----------
const HP_KEY = 'music_tool.studio.headphones';
const mic = new Mic();
mic.headphones = localStorage.getItem(HP_KEY) !== '0';
const hpBtn = $('headphones');
const showHeadphones = () => hpBtn.setAttribute('aria-pressed', String(mic.headphones));
hpBtn.addEventListener('click', () => {
  mic.headphones = !mic.headphones;
  localStorage.setItem(HP_KEY, mic.headphones ? '1' : '0');
  showHeadphones();
  statusEl.textContent = mic.headphones ? '戴耳机：关掉回声消除，音质更好' : '外放：会尽量滤掉外放的声音，但音质差一些，也不适合放伴奏';
});
showHeadphones();

// ---------- 伴奏文件 ----------
let backing = null; // { name, blob, buffer }
const backingPick = $('backing-pick');
const backingClear = $('backing-clear');
const backingFile = $('backing-file');
const stripExt = (name) => name.replace(/\.[^.]+$/, '');

function showBacking() {
  backingPick.textContent = backing ? `🎵 ${stripExt(backing.name)}` : '🎵 选伴奏（可选）';
  backingPick.classList.toggle('has', !!backing);
  backingClear.hidden = !backing;
}
backingPick.addEventListener('click', () => backingFile.click());
backingFile.addEventListener('change', async () => {
  const f = backingFile.files[0];
  backingFile.value = '';
  if (!f) return;
  backing = { name: f.name, blob: f, buffer: null };
  showBacking();
  statusEl.textContent = '录音时会从耳机放这个伴奏，人声里不会录进伴奏';
  try { await store.setBacking(f); } catch (e) { statusEl.textContent = `伴奏没存下来（下次要重新选）：${e?.message ?? e}`; }
});
backingClear.addEventListener('click', async () => {
  backing = null;
  showBacking();
  await store.deleteMisc('backing');
});
async function backingBuffer() {
  backing.buffer ??= await Tone.context.rawContext.decodeAudioData(await backing.blob.arrayBuffer());
  return backing.buffer;
}

// ---------- 录音 ----------
const recBtn = $('record');
const liveCanvas = $('live-curve');
const liveNote = $('live-note');
const liveTime = $('live-time');
let rec = null; // { rec, done, startedAt, unsub, src, timer }
let live = [];
let liveRange = [55, 72];

function drawLive() {
  const t1 = Math.max(LIVE_SPAN, live.length * LIVE_HOP);
  drawCurve(liveCanvas, { curve: live, hop: LIVE_HOP, t0: t1 - LIVE_SPAN, t1, lo: liveRange[0], hi: liveRange[1] });
  if (rec) requestAnimationFrame(drawLive);
}

async function startRec() {
  recBtn.disabled = true;
  try {
    await mic.acquire('studio');
    let buffer = null;
    if (backing) {
      try { buffer = await backingBuffer(); } catch { throw new Error('伴奏文件打不开，换一个试试'); }
    }
    const r = recordStream(mic.stream, pickMime());
    live = [];
    liveRange = [55, 72];
    const unsub = mic.onFrame((f) => {
      const m = f.midi !== null && f.clarity >= 0.8 ? f.midi : NaN;
      live.push(m);
      liveNote.textContent = m === m ? midiName(m) : '—';
      if (m === m && (m < liveRange[0] + 2 || m > liveRange[1] - 2)) liveRange = curveRange(live, { pad: 3 });
    });
    let src = null;
    if (buffer) {
      const raw = Tone.context.rawContext;
      src = raw.createBufferSource();
      src.buffer = buffer;
      src.connect(raw.destination);
      src.start();
    }
    rec = { ...r, unsub, src, startedAt: performance.now() };
  } catch (e) {
    mic.release('studio');
    statusEl.textContent = e?.name ? micError(e) : (e?.message ?? String(e));
    return;
  } finally {
    recBtn.disabled = false;
  }
  recBtn.setAttribute('aria-pressed', 'true');
  recBtn.setAttribute('aria-label', '停止录音');
  hpBtn.disabled = backingPick.disabled = backingClear.disabled = true;
  statusEl.textContent = mic.headphones ? '录音中，再点一下停止' : '录音中（戴耳机效果更好）';
  const tick = () => { liveTime.textContent = fmtTime((performance.now() - rec.startedAt) / 1000); };
  tick();
  rec.timer = setInterval(tick, 250);
  requestAnimationFrame(drawLive);
}

async function stopRec() {
  const r = rec;
  rec = null;
  clearInterval(r.timer);
  r.unsub();
  r.rec.stop();
  try { r.src?.stop(); } catch {}
  const seconds = (performance.now() - r.startedAt) / 1000;
  recBtn.disabled = true;
  const blob = await r.done;
  mic.release('studio');
  recBtn.disabled = false;
  recBtn.setAttribute('aria-pressed', 'false');
  recBtn.setAttribute('aria-label', '开始录音');
  hpBtn.disabled = backingPick.disabled = backingClear.disabled = false;
  liveNote.textContent = '—';
  if (!blob.size) {
    statusEl.textContent = '没录到声音，再试一次';
    return;
  }
  const d = new Date();
  const name = `录音 ${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  try {
    const id = await store.addTake({ name, created: Date.now(), seconds, mime: blob.type, backing: backing?.name ?? null }, blob);
    store.requestPersist();
    statusEl.textContent = '已保存，正在分析音高…';
    await renderList();
    await analyze(id, blob);
    statusEl.textContent = idleStatus;
  } catch (e) {
    statusEl.textContent = `保存失败：${e?.message ?? e}`;
  }
}

recBtn.addEventListener('click', () => (rec ? stopRec() : startRec()));

// ---------- 分析：整段音高曲线、调、音域 ----------
const progress = new Map(); // id → 0–1

// 解码成 16kHz 单声道。decodeAudioData 会重采样到 context 的采样率；不支持 16kHz 时自己按整数倍抽取
async function decodeMono(blob, sr) {
  let audio;
  try {
    audio = await new OfflineAudioContext(1, 1, sr).decodeAudioData(await blob.arrayBuffer());
  } catch {
    audio = await new OfflineAudioContext(1, 1, 44100).decodeAudioData(await blob.arrayBuffer());
  }
  const n = audio.length;
  const mono = new Float32Array(n);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < n; i++) mono[i] += ch[i] / audio.numberOfChannels;
  }
  const f = Math.max(1, Math.round(audio.sampleRate / sr));
  if (f === 1) return { data: mono, sampleRate: audio.sampleRate };
  const out = new Float32Array(Math.floor(n / f));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let k = 0; k < f; k++) s += mono[i * f + k];
    out[i] = s / f;
  }
  return { data: out, sampleRate: audio.sampleRate / f };
}

async function analyze(id, blob) {
  progress.set(id, 0);
  showInfo(id);
  try {
    const { data, sampleRate } = await decodeMono(blob, ANALYSIS_SR);
    const n = pitchFrameCount(data.length, sampleRate);
    const midi = new Float32Array(n), clarity = new Float32Array(n);
    for (let i = 0; i < n; i += 150) {
      trackPitch(data, sampleRate, { from: i, to: i + 150, midi, clarity });
      progress.set(id, i / n);
      showInfo(id);
      await new Promise((r) => setTimeout(r)); // 让出主线程，界面不卡
    }
    const curve = cleanCurve(midi, clarity);
    const notes = segmentNotes(curveToFrames(curve));
    const est = estimateKey(notes, { minSeconds: 3 });
    const midis = notes.map((x) => x.midi);
    await store.updateTake(id, {
      analysis: {
        hop: HOP,
        curve,
        key: est && { tonic: est.best.tonic, mode: est.best.mode, confidence: est.confidence },
        range: notes.length ? { lo: Math.min(...midis), hi: Math.max(...midis) } : null,
      },
    });
  } catch (e) {
    await store.updateTake(id, { analysisError: String(e?.message ?? e) });
  }
  progress.delete(id);
  await renderList();
}

const keyName = (k) => {
  const key = makeKey(k.tonic, k.mode);
  return `${key.name.replace(/m$/, '')} ${MODES[k.mode].name}`;
};

function summary(t) {
  if (progress.has(t.id)) return `分析音高… ${Math.round(progress.get(t.id) * 100)}%`;
  if (t.analysisError) return `分析失败：${t.analysisError}`;
  const a = t.analysis;
  if (!a) return '等待分析…';
  const parts = [a.key ? `${keyName(a.key)}（把握${CONFIDENCE[a.key.confidence]}）` : '唱得太短，判断不出调'];
  if (a.range) parts.push(`音域 ${midiName(a.range.lo)}–${midiName(a.range.hi)}`);
  return parts.join(' · ');
}

// ---------- 录音列表 ----------
const listEl = $('takes');
let takes = [];

function showInfo(id) {
  const t = takes.find((x) => x.id === id);
  const el = listEl.querySelector(`[data-id="${id}"] .info`);
  if (t && el) el.textContent = summary(t);
}

async function renderList() {
  takes = await store.listTakes();
  $('count').textContent = takes.length ? `（${takes.length}）` : '';
  if (!takes.length) {
    listEl.innerHTML = '<p class="empty">还没有录音</p>';
    return;
  }
  listEl.replaceChildren(...takes.map((t) => {
    const el = document.createElement('div');
    el.className = 'take';
    el.dataset.id = t.id;
    el.innerHTML = `
      <div class="title"><button class="name" type="button" data-act="rename"></button><span>${fmtTime(t.seconds)}</span></div>
      <div class="info"></div>
      <div class="row">
        <button type="button" data-act="del">删除</button>
        <button type="button" data-act="save">保存/分享</button>
        <button type="button" data-act="open" class="primary">▶ 听·看曲线</button>
      </div>`;
    el.querySelector('.name').textContent = `${t.name} ✎`;
    el.querySelector('.info').textContent = summary(t);
    return el;
  }));
}

const ext = (type) => (type.includes('mp4') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm');
const blobCache = new Map(); // 第二次点"保存"时不用再读数据库，分享还在用户点击的时效内

async function saveTake(t) {
  const blob = blobCache.get(t.id) ?? await store.getAudio(t.id);
  blobCache.set(t.id, blob);
  const file = new File([blob], `${t.name.replace(/[\\/:*?"<>|]/g, '-')}.${ext(blob.type)}`, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
    } catch (e) {
      if (e?.name === 'NotAllowedError') statusEl.textContent = '再点一次"保存/分享"';
    }
    return;
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

listEl.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = +btn.closest('.take').dataset.id;
  const t = takes.find((x) => x.id === id);
  if (!t) return;
  switch (btn.dataset.act) {
    case 'rename': {
      const name = prompt('录音名字', t.name)?.trim();
      if (name) { await store.updateTake(id, { name }); await renderList(); }
      break;
    }
    case 'del':
      if (confirm(`删除"${t.name}"？删除后找不回来。`)) {
        await store.deleteTake(id);
        blobCache.delete(id);
        await renderList();
      }
      break;
    case 'save':
      await saveTake(t);
      break;
    case 'open':
      await openDetail(id);
      break;
  }
});

// ---------- 回放和音高曲线 ----------
const detailEl = $('detail');
const dCanvas = $('d-curve');
const dAudio = $('d-audio');
let detail = null; // { take, url, range, span, raf, drag }

function viewWindow(d, cursor) {
  const dur = d.take.seconds;
  const span = Math.min(8, Math.max(1, dur));
  const t0 = Math.min(Math.max(0, cursor - span / 3), Math.max(0, dur - span));
  return [t0, t0 + span];
}

function drawDetail() {
  if (!detail) return;
  const a = detail.take.analysis;
  const cursor = dAudio.currentTime || 0;
  const [t0, t1] = viewWindow(detail, cursor);
  drawCurve(dCanvas, {
    curve: a?.curve ?? [], hop: a?.hop ?? HOP, t0, t1,
    lo: detail.range[0], hi: detail.range[1], key: a?.key ?? null, cursor,
  });
  detail.raf = requestAnimationFrame(drawDetail);
}

async function openDetail(id) {
  const take = await store.getTake(id);
  const blob = blobCache.get(id) ?? await store.getAudio(id);
  blobCache.set(id, blob);
  const url = URL.createObjectURL(blob);
  detail = { take, url, range: curveRange(take.analysis?.curve ?? []), drag: null };
  dAudio.src = url;
  $('d-name').textContent = take.name;
  const when = new Date(take.created).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  $('d-info').textContent = [when, fmtTime(take.seconds), summary(take), take.backing ? `伴奏：${stripExt(take.backing)}` : ''].filter(Boolean).join(' · ');
  detailEl.showModal();
  drawDetail();
}

// 拖动曲线 = 前后移动播放位置
dCanvas.addEventListener('pointerdown', (e) => {
  if (!detail) return;
  dCanvas.setPointerCapture(e.pointerId);
  detail.drag = { x: e.clientX, time: dAudio.currentTime || 0 };
});
dCanvas.addEventListener('pointermove', (e) => {
  if (!detail?.drag) return;
  const [t0, t1] = viewWindow(detail, detail.drag.time);
  const t = detail.drag.time - ((e.clientX - detail.drag.x) / dCanvas.clientWidth) * (t1 - t0);
  dAudio.currentTime = Math.min(Math.max(0, t), detail.take.seconds);
});
const endDrag = () => { if (detail) detail.drag = null; };
dCanvas.addEventListener('pointerup', endDrag);
dCanvas.addEventListener('pointercancel', endDrag);

$('d-close').addEventListener('click', () => detailEl.close());
detailEl.addEventListener('close', () => {
  dAudio.pause();
  if (detail) {
    cancelAnimationFrame(detail.raf);
    URL.revokeObjectURL(detail.url);
  }
  detail = null;
  dAudio.removeAttribute('src');
});
detailEl.addEventListener('click', (e) => {
  if (e.target !== detailEl) return;
  const r = detailEl.getBoundingClientRect();
  const inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  if (!inside) detailEl.close();
});

// ---------- 启动 ----------
(async () => {
  showBacking();
  drawLive();
  try {
    const b = await store.getBacking();
    if (b) { backing = { ...b, buffer: null }; showBacking(); }
    await renderList();
    // 上次分析到一半就关了页面的，接着分析
    for (const t of takes.filter((x) => !x.analysis && !x.analysisError)) await analyze(t.id, await store.getAudio(t.id));
  } catch (e) {
    statusEl.textContent = `本地存储打不开：${e?.message ?? e}`;
  }
})();
