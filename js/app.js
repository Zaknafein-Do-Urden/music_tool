import { MODES, makeKey, chordFor, degreesFor } from './theory.js';
import { Engine, ENSEMBLES, METERS } from './engine.js';
import { DEFAULT_ENSEMBLE } from './ensembles.js';
import { Mic } from './mic.js';
import { midiName } from './pitch.js';
import { segmentNotes, estimateKey, framesHistogram } from './analysis.js';
import { suggestChords, ChordMemory } from './suggest.js';
import { Recorder, decodeTake, mixTake, estimateVoiceDelay } from './recorder.js';

const $ = (id) => document.getElementById(id);
const els = {
  key: $('key'), keyDown: $('key-down'), keyUp: $('key-up'), mode: $('mode'),
  pattern: $('pattern'), quantize: $('quantize'), meter: $('meter'),
  bpm: $('bpm'), bpmValue: $('bpm-value'), pads: $('pads'),
  beats: $('beats'), status: $('status'), stop: $('stop'),
};

// 设置只存本机，读写失败（隐私模式等）就用默认值
const SETTINGS_KEY = 'music_tool.settings';
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {}; } catch { return {}; }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(state)); } catch {}
}

const saved = loadSettings();

// 每个乐队各记一份：当前织体、常用织体（1–3 个，显示在主界面底部）、各乐器音量增减
function perEnsemble() {
  const patterns = {};
  const favorites = {};
  const volumes = {};
  for (const [eid, ens] of Object.entries(ENSEMBLES)) {
    // 旧版只有钢琴，pattern / favorites 直接存在顶层
    const oldPattern = eid === 'piano' && typeof saved.pattern === 'string' ? saved.pattern : null;
    const oldFavs = eid === 'piano' && Array.isArray(saved.favorites) ? saved.favorites : null;
    const p = saved.patterns?.[eid] ?? oldPattern;
    patterns[eid] = ens.textures[p] ? p : ens.defaultFavorites[0];
    const f = (saved.favorites?.[eid] ?? oldFavs ?? []).filter((id) => ens.textures[id]).slice(0, 3);
    favorites[eid] = f.length ? f : [...ens.defaultFavorites];
    volumes[eid] = { ...(saved.volumes?.[eid] ?? {}) };
  }
  return { patterns, favorites, volumes };
}

const state = {
  key: +(saved.key ?? 0), // 主音音级 0–11
  mode: MODES[saved.mode] ? saved.mode : 'major',
  ensemble: ENSEMBLES[saved.ensemble] ? saved.ensemble : DEFAULT_ENSEMBLE,
  ...perEnsemble(),
  fillEvery: [0, 4, 8].includes(saved.fillEvery) ? saved.fillEvery : 0,
  quantize: saved.quantize === 'bar' ? 'bar' : 'beat',
  meter: METERS[saved.meter] ? saved.meter : '4/4',
  bpm: +(saved.bpm ?? 80),
  headphones: !!saved.headphones,
};
const ens = () => ENSEMBLES[state.ensemble];
const curPattern = () => state.patterns[state.ensemble];
const curFavorites = () => state.favorites[state.ensemble];
const currentKey = () => makeKey(state.key, state.mode);

// 分段按钮：演奏中一下就能切，不用打开下拉框。pointerdown 比 click 反应更快
function segmented(container, options, get, onChange) {
  const buttons = options.map(([value, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (get() === value) return;
      onChange(value);
      render();
      saveSettings();
    });
    container.appendChild(b);
    return [value, b];
  });
  const render = () => buttons.forEach(([v, b]) => b.setAttribute('aria-pressed', String(v === get())));
  render();
  return render;
}

const pads = MODES.major.degrees.map((_, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pad' + (i === 0 ? ' tonic' : '');
  btn.disabled = true;
  btn.innerHTML = '<span class="degree"></span><span class="name"></span><span class="hint"></span>';
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    rememberPress(i);
    engine.press(i);
  });
  els.pads.appendChild(btn);
  return btn;
});

function renderKey() {
  const key = currentKey();
  const modeName = MODES[state.mode].name;
  els.key.innerHTML = Array.from({ length: 12 }, (_, t) =>
    `<option value="${t}">${makeKey(t, state.mode).name.replace(/m$/, '')} ${modeName}</option>`).join('');
  els.key.value = String(state.key);
  // 中国风下按钮换成五声版和弦（如 Gsus2），级数和说明也跟着换
  const harmony = ENSEMBLES[state.ensemble].harmony ?? 'triad';
  degreesFor(state.mode, harmony).forEach((d, i) => {
    const name = chordFor(key, i, harmony).name;
    const btn = pads[i];
    btn.querySelector('.degree').textContent = d.label;
    btn.querySelector('.name').textContent = name;
    btn.querySelector('.hint').textContent = d.hint;
    btn.setAttribute('aria-label', `${d.label} 级 ${name}`);
  });
}

function changeKey(tonic, mode = state.mode) {
  state.key = ((tonic % 12) + 12) % 12;
  state.mode = mode;
  engine.setKey(currentKey());
  renderKey();
  renderMode();
  saveSettings();
}

// 拍点指示：每拍一个圆点，第一拍（强拍）更亮
function renderBeats() {
  els.beats.innerHTML = '<i></i>'.repeat(METERS[state.meter].beats.length);
}

function renderState({ beat, current, pending, fill }) {
  if (fill !== undefined) $('fill').setAttribute('aria-pressed', String(fill));
  pads.forEach((btn, i) => {
    btn.classList.toggle('active', i === current);
    btn.classList.toggle('pending', i === pending);
  });
  const dots = [...els.beats.children];
  if (beat >= 0) {
    dots.forEach((b, i) => b.classList.toggle('on', i === beat));
  } else if (current === null) {
    dots.forEach((b) => b.classList.remove('on'));
  }
}

let idleStatus = '正在加载音色…';
const engine = new Engine({ onStep: renderState });
engine.setKey(currentKey());
engine.setQuantize(state.quantize);
engine.setFillEvery(state.fillEvery);
engine.setMeter(state.meter);
engine.setBpm(state.bpm);

els.meter.innerHTML = Object.keys(METERS).map((id) => `<option value="${id}">${id}</option>`).join('');
els.meter.value = state.meter;
els.bpm.value = String(state.bpm);
els.bpmValue.textContent = els.bpm.value;
renderKey();
renderBeats();

// 定调结果也会改大小调，所以要能从外面刷新这组按钮
const renderMode = segmented(els.mode, Object.entries(MODES).map(([id, m]) => [id, m.name]),
  () => state.mode, (m) => changeKey(state.key, m));
let renderPatternBar = () => {};
function buildPatternBar() {
  els.pattern.innerHTML = '';
  renderPatternBar = segmented(els.pattern, curFavorites().map((id) => [id, ens().textures[id].name]),
    curPattern, setPattern);
}
function setPattern(id) {
  state.patterns[state.ensemble] = id;
  if (engine.ensembleId === state.ensemble) engine.setPattern(id);
  renderPatternBar();
  renderPatternList();
  saveSettings();
}
buildPatternBar();
segmented(els.quantize, [['beat', '下一拍'], ['bar', '下一小节']],
  () => state.quantize, (q) => { state.quantize = q; engine.setQuantize(q); });

els.keyDown.addEventListener('click', () => changeKey(state.key - 1));
els.keyUp.addEventListener('click', () => changeKey(state.key + 1));
els.key.addEventListener('change', () => changeKey(+els.key.value));
els.meter.addEventListener('change', () => {
  state.meter = els.meter.value;
  engine.setMeter(state.meter);
  renderBeats();
  saveSettings();
});
els.bpm.addEventListener('input', () => {
  state.bpm = +els.bpm.value;
  els.bpmValue.textContent = els.bpm.value;
  engine.setBpm(state.bpm);
  saveSettings();
});
els.stop.addEventListener('click', () => engine.stop());

// ---------- 麦克风（定调、推荐、录音共用） ----------
const $$ = (sel, root = document) => root.querySelector(sel);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const keyLabel = (tonic, mode) => `${makeKey(tonic, mode).name.replace(/m$/, '')} ${MODES[mode].name}`;
const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;

const mic = new Mic();
mic.headphones = state.headphones;
const recent = []; // 最近 10 秒的音高帧
mic.onFrame((f) => {
  recent.push(f);
  while (recent.length && f.t - recent[0].t > 10) recent.shift();
  if (!recorder.recording) {
    els.status.textContent = f.midi !== null && f.clarity >= 0.8 ? `🎤 ${midiName(f.midi)}` : '🎤 …';
  }
});

function micError(e) {
  return e?.name === 'NotAllowedError'
    ? '没有麦克风权限：请在 Safari 的网站设置里允许麦克风'
    : `麦克风打不开：${e?.message ?? e}`;
}
function releaseMic(user) {
  mic.release(user);
  if (!mic.open) els.status.textContent = idleStatus;
}

// ---------- 阶段 3：实时推荐 ----------
const MEMORY_KEY = 'music_tool.memory';
const memory = new ChordMemory((() => { try { return JSON.parse(localStorage.getItem(MEMORY_KEY)) ?? []; } catch { return []; } })());
let suggestTimer = null;
let memorySaveTimer = null;

const recentHist = () => framesHistogram(recent, performance.now() / 1000, Math.max(1.5, engine.barSeconds()));

function renderSuggest(list) {
  const [a, b] = list;
  pads.forEach((btn, i) => {
    btn.classList.toggle('suggest', !!a && i === a.degree);
    btn.classList.toggle('suggest2', !!b && i === b.degree && b.score >= a.score * 0.75);
  });
}

// 用户按和弦时记下"刚才唱的旋律 → 按了哪个"，以后唱到相似旋律就推荐它
function rememberPress(degree) {
  if (!suggestTimer) return;
  const hist = recentHist();
  if (sum(hist) < 0.25) return;
  memory.record(currentKey(), hist, degree);
  clearTimeout(memorySaveTimer);
  memorySaveTimer = setTimeout(() => {
    try { localStorage.setItem(MEMORY_KEY, JSON.stringify(memory)); } catch {}
  }, 1000);
}

const suggestBtn = $('suggest-toggle');
suggestBtn.addEventListener('click', async () => {
  if (suggestTimer) {
    clearInterval(suggestTimer);
    suggestTimer = null;
    renderSuggest([]);
    suggestBtn.setAttribute('aria-pressed', 'false');
    releaseMic('suggest');
    return;
  }
  try {
    await mic.acquire('suggest');
  } catch (e) {
    els.status.textContent = micError(e);
    return;
  }
  suggestBtn.setAttribute('aria-pressed', 'true');
  suggestTimer = setInterval(() => {
    renderSuggest(suggestChords({
      key: currentKey(), hist: recentHist(), current: engine.current, memory, harmony: engine.harmony,
    }));
  }, 150);
});

// ---------- 耳机模式 ----------
const headphonesBtn = $('headphones');
headphonesBtn.setAttribute('aria-pressed', String(state.headphones));
headphonesBtn.addEventListener('click', async () => {
  if (recorder.recording) return;
  state.headphones = !state.headphones;
  headphonesBtn.setAttribute('aria-pressed', String(state.headphones));
  saveSettings();
  try { await mic.setHeadphones(state.headphones); } catch (e) { els.status.textContent = micError(e); }
});

// ---------- 阶段 2：哼几句定调 ----------
const detect = {
  dialog: $('detect-dialog'), start: $('detect-start'), apply: $('detect-apply'), close: $('detect-close'),
  note: $('detect-note'), seconds: $('detect-seconds'), progress: $('detect-progress'),
  result: $('detect-result'), key: $('detect-key'), detail: $('detect-detail'),
  frames: [], unsub: null, timer: null, est: null,
};
const CONFIDENCE = {
  high: '把握较大。',
  mid: '把握一般，多唱几句会更准。',
  low: '把握较小，建议多唱几句，尤其是乐句结尾的长音。',
};

function detectAnalyze() {
  const notes = segmentNotes(detect.frames);
  const secs = sum(notes.map((n) => n.dur));
  detect.seconds.textContent = `${Math.round(secs)} 秒`;
  detect.progress.style.width = `${Math.min(100, (secs / 12) * 100)}%`;
  const est = estimateKey(notes);
  if (!est) return;
  detect.est = est;
  detect.key.textContent = keyLabel(est.best.tonic, est.best.mode);
  detect.detail.textContent = CONFIDENCE[est.confidence]
    + `也可以用 ${keyLabel(est.alt.tonic, est.alt.mode)}（和弦是同一组，只是哪个算"家"不同）。`
    + `你唱到的音域：${midiName(est.range.lo)}–${midiName(est.range.hi)}。`;
  detect.result.hidden = false;
  detect.apply.hidden = false;
}

function detectStop() {
  if (!detect.timer) return;
  clearInterval(detect.timer);
  detect.timer = null;
  detect.unsub();
  releaseMic('detect');
  detectAnalyze();
  detect.start.textContent = '重新开始';
  detect.note.textContent = '—';
}

$('detect-open').addEventListener('click', () => {
  detect.result.hidden = true;
  detect.apply.hidden = true;
  detect.start.textContent = '开始';
  detect.seconds.textContent = '0 秒';
  detect.progress.style.width = '0';
  detect.dialog.showModal();
});
detect.start.addEventListener('click', async () => {
  if (detect.timer) { detectStop(); return; }
  engine.stop(); // 伴奏会被麦克风收进去，定调时先停
  try {
    await mic.acquire('detect');
  } catch (e) {
    detect.key.textContent = '';
    detect.detail.textContent = micError(e);
    detect.result.hidden = false;
    return;
  }
  detect.frames = [];
  detect.est = null;
  detect.result.hidden = true;
  detect.apply.hidden = true;
  detect.unsub = mic.onFrame((f) => {
    detect.frames.push(f);
    detect.note.textContent = f.midi !== null && f.clarity >= 0.8 ? midiName(f.midi) : '…';
  });
  detect.timer = setInterval(detectAnalyze, 500);
  detect.start.textContent = '结束';
});
detect.apply.addEventListener('click', () => {
  if (detect.est) changeKey(detect.est.best.tonic, detect.est.best.mode);
  detect.dialog.close();
});
detect.close.addEventListener('click', () => detect.dialog.close());
detect.dialog.addEventListener('close', detectStop);

// ---------- 阶段 4：录音 ----------
const recorder = new Recorder({ mic, source: engine.output });
const takes = [];
let takeSeq = 0;
let recTimer = null;
const recBtn = $('record');
const takesList = $('takes-list');
const takesDialog = $('takes-dialog');

recBtn.addEventListener('click', async () => {
  if (recorder.recording) {
    clearInterval(recTimer);
    recBtn.setAttribute('aria-pressed', 'false');
    recBtn.textContent = '● 录音';
    headphonesBtn.disabled = false;
    const raw = await recorder.stop();
    els.status.textContent = idleStatus;
    addTake(raw);
    takesDialog.showModal();
    return;
  }
  try {
    await recorder.start();
  } catch (e) {
    els.status.textContent = micError(e);
    return;
  }
  headphonesBtn.disabled = true;
  recBtn.setAttribute('aria-pressed', 'true');
  const t0 = performance.now();
  const tick = () => {
    recBtn.textContent = `■ ${fmtTime((performance.now() - t0) / 1000)}`;
    els.status.textContent = state.headphones ? '录音中' : '录音中（戴耳机效果更好）';
  };
  tick();
  recTimer = setInterval(tick, 500);
});

function addTake(raw) {
  const take = {
    id: ++takeSeq, decoded: null, blob: null, url: null,
    voiceGain: 1, accGain: 0.8, delay: estimateVoiceDelay(),
  };
  takes.unshift(take);
  $('takes-count').textContent = takes.length;

  const el = document.createElement('div');
  el.className = 'take';
  el.innerHTML = `
    <div class="title"><span>录音 ${take.id}</span><span>${fmtTime(raw.seconds)}</span></div>
    <div class="state">混音中…</div>
    <audio controls preload="auto" hidden></audio>
    <label>人声<input type="range" data-k="voiceGain" min="0" max="1.5" step="0.05" value="${take.voiceGain}"><span></span></label>
    <label>伴奏<input type="range" data-k="accGain" min="0" max="1.5" step="0.05" value="${take.accGain}"><span></span></label>
    <label>人声对齐<input type="range" data-k="delay" min="-0.1" max="0.3" step="0.01" value="${take.delay}"><span></span></label>
    <div class="row"><button type="button" data-act="del">删除</button><button type="button" data-act="save">保存/分享</button></div>`;
  takesList.prepend(el);

  const audio = $$('audio', el);
  const stateEl = $$('.state', el);
  const showValues = () => el.querySelectorAll('input').forEach((inp) => {
    const v = +inp.value;
    inp.nextElementSibling.textContent = inp.dataset.k === 'delay' ? `${Math.round(v * 1000)}ms` : `${Math.round(v * 100)}%`;
  });
  let remixTimer = null;
  const remix = async () => {
    try {
      take.decoded ??= await decodeTake(raw);
      take.blob = await mixTake(take.decoded, { voiceGain: take.voiceGain, accGain: take.accGain, voiceDelay: take.delay });
      if (take.url) URL.revokeObjectURL(take.url);
      take.url = URL.createObjectURL(take.blob);
      audio.src = take.url;
      audio.hidden = false;
      stateEl.textContent = '';
    } catch (e) {
      stateEl.textContent = `混音失败：${e?.message ?? e}`;
    }
  };
  el.querySelectorAll('input').forEach((inp) => inp.addEventListener('input', () => {
    take[inp.dataset.k] = +inp.value;
    showValues();
    clearTimeout(remixTimer);
    stateEl.textContent = '混音中…';
    remixTimer = setTimeout(remix, 400);
  }));
  $$('[data-act=del]', el).addEventListener('click', () => {
    if (take.url) URL.revokeObjectURL(take.url);
    takes.splice(takes.indexOf(take), 1);
    $('takes-count').textContent = takes.length;
    el.remove();
  });
  $$('[data-act=save]', el).addEventListener('click', async () => {
    if (!take.blob) return;
    const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
    const file = new File([take.blob], `即兴伴奏-${stamp}.wav`, { type: 'audio/wav' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file] }); } catch {}
      return;
    }
    const a = document.createElement('a');
    a.href = take.url;
    a.download = file.name;
    a.click();
  });
  showValues();
  remix();
}

$('takes-open').addEventListener('click', () => takesDialog.showModal());
$('takes-close').addEventListener('click', () => takesDialog.close());

// ---------- 设置页：全部织体，选 3 个常用 ----------
const settingsDialog = $('settings-dialog');
const patternList = $('pattern-list');
const patternHint = $('pattern-hint');
const PATTERN_HINT = patternHint.textContent;
let hintTimer = null;

function renderPatternList() {
  patternList.innerHTML = '';
  for (const [id, p] of Object.entries(ens().textures)) {
    const row = document.createElement('div');
    row.className = 'prow' + (id === curPattern() ? ' current' : '');
    const fav = curFavorites().includes(id);
    row.innerHTML = `<button type="button" class="pick">${p.name}<small>${p.desc}</small></button>`
      + `<button type="button" class="star" aria-pressed="${fav}" aria-label="${fav ? '取消常用' : '设为常用'}">★</button>`;
    row.querySelector('.pick').addEventListener('click', () => setPattern(id));
    row.querySelector('.star').addEventListener('click', () => toggleFavorite(id));
    patternList.appendChild(row);
  }
}

function warn(text) {
  patternHint.textContent = text;
  patternHint.classList.add('warn');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => {
    patternHint.textContent = PATTERN_HINT;
    patternHint.classList.remove('warn');
  }, 2500);
}

function toggleFavorite(id) {
  const favs = curFavorites();
  if (favs.includes(id)) {
    if (favs.length === 1) { warn('至少留一个常用织体'); return; }
    state.favorites[state.ensemble] = favs.filter((f) => f !== id);
  } else {
    if (favs.length >= 3) { warn('最多 3 个常用，先点掉一个 ★'); return; }
    // 按完整列表的顺序排，主界面按钮位置稳定
    const order = Object.keys(ens().textures);
    state.favorites[state.ensemble] = [...favs, id].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  }
  buildPatternBar();
  renderPatternList();
  saveSettings();
}

$('settings-open').addEventListener('click', () => {
  renderPatternList();
  renderVolumes();
  settingsDialog.showModal();
});
$('settings-close').addEventListener('click', () => settingsDialog.close());

// ---------- 乐队切换 ----------
const ensembleStatus = $('ensemble-status');
let renderEnsembleSeg = () => {};

async function switchEnsemble(id) {
  state.ensemble = id;
  saveSettings();
  renderEnsembleSeg();
  renderKey();
  buildPatternBar();
  renderPatternList();
  renderVolumes();
  pads.forEach((b) => { b.disabled = true; });
  const loading = `正在加载${ens().name}音色…（第一次要下载，稍等几秒）`;
  idleStatus = loading;
  els.status.textContent = loading;
  ensembleStatus.textContent = loading;
  try {
    if (!(await engine.setEnsemble(id, curPattern()))) return; // 加载期间又换了别的乐队
  } catch (e) {
    const msg = `${ENSEMBLES[id].name}音色加载失败（${e?.message ?? e}），检查网络后再点一次乐队`;
    idleStatus = msg;
    els.status.textContent = msg;
    ensembleStatus.textContent = msg;
    return;
  }
  for (const [vid, db] of Object.entries(state.volumes[id])) engine.setVolume(vid, db);
  pads.forEach((b) => { b.disabled = false; });
  idleStatus = '点任意和弦开始；先从左上角的"家"开始试试';
  if (!mic.open) els.status.textContent = idleStatus;
  ensembleStatus.textContent = `${ens().name}：${Object.values(ens().voices).map((v) => v.name).join('、')}`;
}

renderEnsembleSeg = segmented($('ensemble'), Object.entries(ENSEMBLES).map(([id, e]) => [id, e.name]),
  () => state.ensemble, (id) => switchEnsemble(id));

// ---------- 音量 ----------
const volumesEl = $('volumes');
const dbLabel = (db) => (db <= -24 ? '静音' : db > 0 ? `+${db}` : String(db));
function renderVolumes() {
  volumesEl.innerHTML = '';
  for (const [vid, v] of Object.entries(ens().voices)) {
    const db = state.volumes[state.ensemble][vid] ?? 0;
    const label = document.createElement('label');
    label.innerHTML = `${v.name}<input type="range" min="-24" max="6" step="1" value="${db}"><span>${dbLabel(db)}</span>`;
    const input = label.querySelector('input');
    input.addEventListener('input', () => {
      const val = +input.value;
      state.volumes[state.ensemble][vid] = val;
      label.querySelector('span').textContent = dbLabel(val);
      if (engine.ensembleId === state.ensemble) engine.setVolume(vid, val);
      saveSettings();
    });
    volumesEl.appendChild(label);
  }
}

// ---------- 加花 ----------
const fillBtn = $('fill');
fillBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  if (engine.requestFill()) fillBtn.setAttribute('aria-pressed', 'true');
  else els.status.textContent = '先点一个和弦开始伴奏，再按加花';
});
segmented($('fill-every'), [[0, '关'], [4, '每 4 小节'], [8, '每 8 小节']],
  () => state.fillEvery, (n) => { state.fillEvery = n; engine.setFillEvery(n); });

// ---------- 音色来源（CC BY 要求署名） ----------
$('credits').innerHTML = [...new Set(Object.values(ENSEMBLES).flatMap((e) => e.credits))]
  .map((c) => `<li>${c}</li>`).join('');

switchEnsemble(state.ensemble);
