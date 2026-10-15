import { MODES, makeKey, chordFor } from './theory.js';
import { Engine, PATTERNS, METERS } from './engine.js';

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
const state = {
  key: +(saved.key ?? 0), // 主音音级 0–11
  mode: MODES[saved.mode] ? saved.mode : 'major',
  pattern: PATTERNS[saved.pattern] ? saved.pattern : 'block',
  quantize: saved.quantize === 'bar' ? 'bar' : 'beat',
  meter: METERS[saved.meter] ? saved.meter : '4/4',
  bpm: +(saved.bpm ?? 80),
};
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
}

const pads = MODES.major.degrees.map((_, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pad' + (i === 0 ? ' tonic' : '');
  btn.disabled = true;
  btn.innerHTML = '<span class="degree"></span><span class="name"></span><span class="hint"></span>';
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); engine.press(i); });
  els.pads.appendChild(btn);
  return btn;
});

function renderKey() {
  const key = currentKey();
  const modeName = MODES[state.mode].name;
  els.key.innerHTML = Array.from({ length: 12 }, (_, t) =>
    `<option value="${t}">${makeKey(t, state.mode).name.replace(/m$/, '')} ${modeName}</option>`).join('');
  els.key.value = String(state.key);
  MODES[state.mode].degrees.forEach((d, i) => {
    const name = chordFor(key, i).name;
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
  saveSettings();
}

// 拍点指示：每拍一个圆点，第一拍（强拍）更亮
function renderBeats() {
  els.beats.innerHTML = '<i></i>'.repeat(METERS[state.meter].beats.length);
}

function renderState({ beat, current, pending }) {
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

const engine = new Engine({
  onStep: renderState,
  onLoaded: () => {
    pads.forEach((b) => { b.disabled = false; });
    els.status.textContent = '点任意和弦开始；先从 1 开始试试';
  },
});
engine.setKey(currentKey());
engine.setPattern(state.pattern);
engine.setQuantize(state.quantize);
engine.setMeter(state.meter);
engine.setBpm(state.bpm);

els.meter.innerHTML = Object.keys(METERS).map((id) => `<option value="${id}">${id}</option>`).join('');
els.meter.value = state.meter;
els.bpm.value = String(state.bpm);
els.bpmValue.textContent = els.bpm.value;
renderKey();
renderBeats();

segmented(els.mode, Object.entries(MODES).map(([id, m]) => [id, m.name]),
  () => state.mode, (m) => changeKey(state.key, m));
segmented(els.pattern, Object.entries(PATTERNS).map(([id, p]) => [id, p.name]),
  () => state.pattern, (p) => { state.pattern = p; engine.setPattern(p); });
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
