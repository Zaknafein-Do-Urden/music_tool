import { KEYS, DEGREES, chordFor } from './theory.js';
import { Engine, PATTERNS } from './engine.js';

const $ = (id) => document.getElementById(id);
const els = {
  key: $('key'), pattern: $('pattern'), quantize: $('quantize'),
  bpm: $('bpm'), bpmValue: $('bpm-value'), pads: $('pads'),
  beats: [...$('beats').children], status: $('status'), stop: $('stop'),
};

// 设置只存本机，读写失败（隐私模式等）就用默认值
const SETTINGS_KEY = 'music_tool.settings';
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {}; } catch { return {}; }
}
function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      key: els.key.value, pattern: els.pattern.value,
      quantize: els.quantize.value, bpm: els.bpm.value,
    }));
  } catch {}
}

const saved = loadSettings();
els.key.innerHTML = KEYS.map((k, i) => `<option value="${i}">${k.name} 大调</option>`).join('');
els.pattern.innerHTML = Object.entries(PATTERNS).map(([id, p]) => `<option value="${id}">${p.name}</option>`).join('');
els.key.value = saved.key ?? '0';
els.pattern.value = saved.pattern ?? 'block';
els.quantize.value = saved.quantize ?? 'beat';
els.bpm.value = saved.bpm ?? '80';
els.bpmValue.textContent = els.bpm.value;

const pads = DEGREES.map((d, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'pad' + (i === 0 ? ' tonic' : '');
  btn.disabled = true;
  btn.innerHTML = `<span class="degree">${d.label}</span><span class="name"></span><span class="hint">${d.hint}</span>`;
  // pointerdown 比 click 少约 100ms 延迟
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); engine.press(i); });
  els.pads.appendChild(btn);
  return btn;
});

function renderChordNames() {
  const key = KEYS[+els.key.value];
  pads.forEach((btn, i) => {
    const name = chordFor(key, i).name;
    btn.querySelector('.name').textContent = name;
    btn.setAttribute('aria-label', `${DEGREES[i].label} 级 ${name}`);
  });
}

function renderState({ step, current, pending }) {
  pads.forEach((btn, i) => {
    btn.classList.toggle('active', i === current);
    btn.classList.toggle('pending', i === pending);
  });
  if (step !== null && step !== undefined) {
    els.beats.forEach((b, i) => b.classList.toggle('on', step % 2 === 0 && i === step / 2));
  } else if (current === null) {
    els.beats.forEach((b) => b.classList.remove('on'));
  }
}

const engine = new Engine({
  onStep: renderState,
  onLoaded: () => {
    pads.forEach((b) => { b.disabled = false; });
    els.status.textContent = '点任意和弦开始；先从 1 开始试试';
  },
});
engine.setKey(KEYS[+els.key.value]);
engine.setPattern(els.pattern.value);
engine.setQuantize(els.quantize.value);
engine.setBpm(+els.bpm.value);
renderChordNames();

els.key.addEventListener('change', () => {
  engine.setKey(KEYS[+els.key.value]);
  renderChordNames();
  saveSettings();
});
els.pattern.addEventListener('change', () => { engine.setPattern(els.pattern.value); saveSettings(); });
els.quantize.addEventListener('change', () => { engine.setQuantize(els.quantize.value); saveSettings(); });
els.bpm.addEventListener('input', () => {
  els.bpmValue.textContent = els.bpm.value;
  engine.setBpm(+els.bpm.value);
  saveSettings();
});
els.stop.addEventListener('click', () => engine.stop());
