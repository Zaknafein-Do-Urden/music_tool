// 拍号、织体记号解析与编译（纯函数，可在 Node 下测试）。织体数据在 ensembles.js。
// 引擎每个十六分音符走一步；beats 为每拍起始步，用于"下一拍"换和弦和拍点指示。
import { ENSEMBLES } from './ensembles.js';

export const METERS = {
  '4/4': { name: '4/4', steps: 16, beats: [0, 4, 8, 12] },
  '3/4': { name: '3/4', steps: 12, beats: [0, 4, 8] },
  '2/4': { name: '2/4', steps: 8, beats: [0, 4] },
  // 6/8 按附点四分音符数拍（每小节 2 拍），速度也按附点四分算，所以 Transport 的四分音符速度 ×1.5
  '6/8': { name: '6/8', steps: 12, beats: [0, 6], bpmScale: 1.5 },
};

// 织体写法：每件乐器一小节一串记号，空格分隔，每个记号占一个八分音符（记号数 = 八分音符数）
// 或一个十六分音符（记号数 = 十六分音符数）。加花固定写十六分，靠右对齐到小节末。
//   .  不弹
// 弹和弦的乐器（keys）：
//   A  整个和弦   P  强力和弦（根音+五度+八度）   G  五声音阶刮奏（古筝）
//   数字  和弦音（0–2 由低到高，3 = 最低音高八度）或五声梯子（0 = 根音往上，0–9），看乐器的 noteSet
//   B  低音根音   F  低音五度   O  低音根音高八度
// 贝斯（bass）：B 根音  F 五度  O 高八度根音  N 六度
// 鼓（drums）：K 底鼓  S 军鼓  H 闭镲  Q 开镲  C 吊镲  T M L 高中低嗵鼓
// 开头可加（可叠加）：> 重音   - 轻弹   ! 短促/闷音   * 轮指（快速反复，琵琶）
// 力度按位置自动给：小节第一拍最重，其余拍次之，反拍更轻。
// 2/4 没写时：织体取 4/4 的前半小节，加花用 4/4 的（放得下的话）。

const TOKENS = {
  keys: { B: 'bass:root', F: 'bass:fifth', O: 'bass:octave', A: 'chord', P: 'power', G: 'gliss' },
  bass: { B: 'bass:root', F: 'bass:fifth', O: 'bass:octave', N: 'bass:sixth' },
  drums: { K: 'kick', S: 'snare', H: 'hat', Q: 'openhat', C: 'crash', T: 'tom1', M: 'tom2', L: 'tom3' },
};

// 解析一个记号 → { bass[], notes 'all'|数字[], power, gliss, drums[], accent, staccato, tremolo } 或 null（休止）
export function parseToken(tok, voice) {
  if (tok === '.') return null;
  const ev = { bass: [], notes: [], power: false, gliss: false, drums: [], accent: 0, staccato: false, tremolo: false };
  let i = 0;
  for (; i < tok.length && '>-!*'.includes(tok[i]); i++) {
    const m = tok[i];
    if (m === '>') ev.accent += 0.15;
    else if (m === '-') ev.accent -= 0.15;
    else if (m === '!') ev.staccato = true;
    else ev.tremolo = true;
  }
  const maxDigit = voice.noteSet === 'penta' ? 9 : 3;
  for (const c of tok.slice(i)) {
    const t = TOKENS[voice.type][c];
    if (t?.startsWith('bass:')) ev.bass.push(t.slice(5));
    else if (t === 'chord') ev.notes = 'all';
    else if (t === 'power') ev.power = true;
    else if (t === 'gliss') ev.gliss = true;
    else if (voice.type === 'drums' && t) ev.drums.push(t);
    else if (voice.type === 'keys' && /\d/.test(c) && +c <= maxDigit && ev.notes !== 'all') ev.notes.push(+c);
    else throw new Error(`看不懂的织体记号 "${tok}"（${voice.name}）`);
  }
  if (tok.length === i) throw new Error(`记号 "${tok}" 只有前缀`);
  return ev;
}

const hasNotes = (e) => e.notes === 'all' || e.notes.length > 0 || e.power || e.gliss;

// 一串记号 → { 十六分步: 事件 }。offset 为第一个记号所在的步（加花靠右对齐用）
function compileGrid(grid, meter, voice, { sixteenths = false, offset = 0 } = {}) {
  const toks = grid.trim().split(/\s+/);
  let scale;
  if (sixteenths) scale = 1;
  else if (toks.length === meter.steps) scale = 1;
  else if (toks.length * 2 === meter.steps) scale = 2;
  else throw new Error(`${voice.name} ${meter.name} 记号数 ${toks.length} 不对`);
  if (offset + toks.length * scale > meter.steps) throw new Error(`${voice.name} ${meter.name} 超出小节`);

  const events = {};
  toks.forEach((tok, i) => {
    const ev = parseToken(tok, voice);
    if (!ev) return;
    const step = offset + i * scale;
    const base = step === 0 ? 0.78 : meter.beats.includes(step) ? 0.62 : step % 2 === 0 ? 0.5 : 0.42;
    ev.vel = Math.min(1, Math.max(0.15, base + ev.accent));
    delete ev.accent;
    events[step] = ev;
  });

  // 时长：和弦音响到下一次弹和弦音，低音响到下一个低音；最后一个延到小节末
  const steps = Object.keys(events).map(Number);
  const until = (from, has) => (steps.find((s) => s > from && has(events[s])) ?? meter.steps) - from;
  for (const s of steps) {
    const ev = events[s];
    ev.dur = until(s, hasNotes);
    ev.bassDur = until(s, (e) => e.bass.length > 0);
  }
  return events;
}

function textureGrid(grids, meterId, what) {
  if (grids[meterId]) return grids[meterId];
  if (meterId === '2/4' && grids['4/4']) {
    const toks = grids['4/4'].trim().split(/\s+/);
    return toks.slice(0, toks.length / 2).join(' ');
  }
  throw new Error(`${what} 缺少 ${meterId}`);
}

// 织体 → { swing, voices: { 乐器: { 步: 事件 } } }
export function compileTexture(ensembleId, textureId, meterId) {
  const ens = ENSEMBLES[ensembleId];
  const tex = ens.textures[textureId];
  const meter = METERS[meterId];
  const voices = {};
  for (const [vid, grids] of Object.entries(tex.parts)) {
    const voice = ens.voices[vid];
    if (!voice) throw new Error(`${tex.name} 用了不存在的乐器 ${vid}`);
    voices[vid] = compileGrid(textureGrid(grids, meterId, `${tex.name}/${voice.name}`), meter, voice);
  }
  // 6/8 本身就是三拍子律动，不再加摇摆
  const swing = meterId === '6/8' ? 0 : (tex.swing ?? 0);
  return { swing, voices };
}

// 加花 → { start 起始步, voices }。只给这个织体里在弹的乐器加花
export function compileFill(ensembleId, textureId, meterId) {
  const ens = ENSEMBLES[ensembleId];
  const tex = ens.textures[textureId];
  const meter = METERS[meterId];
  const fills = tex.fills ?? ens.fills ?? {};
  const voices = {};
  let start = meter.steps;
  for (const [vid, grids] of Object.entries(fills)) {
    if (!tex.parts[vid]) continue;
    let toks = (grids[meterId] ?? grids['4/4']).trim().split(/\s+/);
    if (toks.length > meter.steps) toks = toks.slice(-meter.steps);
    const offset = meter.steps - toks.length;
    voices[vid] = compileGrid(toks.join(' '), meter, ens.voices[vid], { sixteenths: true, offset });
    start = Math.min(start, offset);
  }
  return { start, voices };
}

// 一个织体用到了哪些乐器
export const textureVoices = (ensembleId, textureId) => Object.keys(ENSEMBLES[ensembleId].textures[textureId].parts);
