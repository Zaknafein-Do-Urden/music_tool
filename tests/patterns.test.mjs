import assert from 'node:assert/strict';
import { METERS, compileTexture, compileFill, parseToken, textureVoices } from '../js/patterns.js';
import { ENSEMBLES } from '../js/ensembles.js';
import { makeKey, pentaLadder, powerChord } from '../js/theory.js';

for (const [mid, meter] of Object.entries(METERS)) {
  assert.equal(meter.name, mid);
  assert.equal(meter.beats[0], 0, `${mid} 第一拍必须从第 0 步开始`);
  assert.ok(meter.beats.every((b) => b < meter.steps));
}

// 每个乐队 × 每个织体 × 每个拍号都能编译，时长不出小节；加花也能编译
for (const [eid, ens] of Object.entries(ENSEMBLES)) {
  const texIds = Object.keys(ens.textures);
  assert.ok(texIds.length >= 6, `${ens.name} 织体要够多`);
  assert.equal(ens.defaultFavorites.length, 3);
  ens.defaultFavorites.forEach((id) => assert.ok(ens.textures[id], `${ens.name} 默认常用 ${id} 不存在`));
  assert.ok(ens.credits?.length, `${ens.name} 要写音色来源`);
  for (const mode of ['major', 'minor']) {
    const progs = ens.progressions?.[mode] ?? [];
    assert.ok(progs.length >= 3, `${ens.name} ${mode} 常用走向至少 3 个`);
    for (const p of progs) assert.ok(p.name && p.steps.length >= 3 && p.steps.every((i) => Number.isInteger(i) && i >= 0 && i < 6));
  }
  for (const v of Object.values(ens.voices)) {
    if (v.onChange) parseToken(v.onChange, v);
  }

  for (const tid of texIds) {
    const tex = ens.textures[tid];
    assert.ok(tex.name && tex.desc, `${eid}/${tid} 要有名字和说明`);
    for (const [mid, meter] of Object.entries(METERS)) {
      const { voices } = compileTexture(eid, tid, mid);
      const first = Object.values(voices).some((evs) => evs[0]);
      assert.ok(first, `${ens.name}/${tex.name} ${mid} 第一步应该有声音`);
      for (const [vid, evs] of Object.entries(voices)) {
        for (const [s, ev] of Object.entries(evs)) {
          const step = +s;
          assert.ok(step >= 0 && step < meter.steps);
          assert.ok(ev.vel > 0 && ev.vel <= 1);
          assert.ok(ev.dur >= 1 && step + ev.dur <= meter.steps, `${tex.name}/${vid} ${mid} 第 ${s} 步时长`);
        }
      }
      const fill = compileFill(eid, tid, mid);
      assert.ok(fill.start >= 0 && fill.start < meter.steps, `${tex.name} ${mid} 加花起点 ${fill.start}`);
      for (const vid of Object.keys(fill.voices)) assert.ok(textureVoices(eid, tid).includes(vid), '只给在弹的乐器加花');
      for (const evs of Object.values(fill.voices)) {
        for (const s of Object.keys(evs)) assert.ok(+s >= fill.start && +s < meter.steps);
      }
    }
  }
}

// 八分音符写法展开成十六分步
assert.deepEqual(Object.keys(compileTexture('piano', 'block', '4/4').voices.piano).map(Number), [0, 4, 8, 12]);
assert.equal(Object.keys(compileTexture('piano', 'flow16', '4/4').voices.piano).length, 16);
assert.deepEqual(Object.keys(compileTexture('piano', 'block', '2/4').voices.piano).map(Number), [0, 4]);
// 力度：第一拍 > 其他拍 > 反拍
const rock = compileTexture('piano', 'rock', '4/4').voices.piano;
assert.ok(rock[0].vel > rock[4].vel && rock[4].vel > rock[2].vel);
// 跨步：根音响到五度那一步
const stride = compileTexture('piano', 'stride', '4/4').voices.piano;
assert.deepEqual(stride[0].bass, ['root']);
assert.deepEqual(stride[8].bass, ['fifth']);
assert.equal(stride[0].bassDur, 8);

// 鼓、贝斯、修饰符
const band = compileTexture('band', 'rock8', '4/4').voices;
assert.deepEqual(band.drums[0].drums, ['kick', 'hat']);
assert.deepEqual(band.drums[4].drums, ['snare', 'hat']);
assert.ok(band.guitar[2].staccato && band.guitar[2].power);
assert.deepEqual(compileTexture('band', 'shuffle', '4/4').voices.bass[8].bass, ['sixth']);
assert.equal(compileTexture('band', 'shuffle', '4/4').swing, 1);
assert.equal(compileTexture('band', 'shuffle', '6/8').swing, 0, '6/8 不加摇摆');
assert.ok(compileTexture('chinese', 'tremolo', '4/4').voices.pipa[0].tremolo);
assert.ok(compileTexture('chinese', 'gliss', '4/4').voices.guzheng[0].gliss);
assert.throws(() => parseToken('K', ENSEMBLES.piano.voices.piano), '钢琴不认鼓记号');
assert.throws(() => parseToken('5', ENSEMBLES.piano.voices.piano), '和弦音数字最多到 3');
assert.doesNotThrow(() => parseToken('9', ENSEMBLES.chinese.voices.guzheng), '五声梯子可以到 9');

// 加花：靠右对齐；钢琴 4/4 最后一拍（第 12 步起）；乐队 4/4 最后两拍
assert.equal(compileFill('piano', 'block', '4/4').start, 12);
assert.equal(compileFill('band', 'rock8', '4/4').start, 8);
assert.deepEqual(Object.keys(compileFill('band', 'rock8', '4/4').voices).sort(), ['bass', 'drums', 'guitar']);
assert.deepEqual(Object.keys(compileFill('band', 'pop16', '4/4').voices).sort(), ['bass', 'clean', 'drums']);
assert.equal(compileFill('band', 'rock8', '2/4').start, 0, '2/4 放得下就整小节加花');
assert.equal(compileFill('chinese', 'flow', '6/8').start, 6);

// 五声梯子、强力和弦
const C = makeKey(0, 'major');
assert.deepEqual(pentaLadder(C, 0, 55, 6), [60, 62, 64, 67, 69, 72]);
assert.deepEqual(pentaLadder(C, 5, 55, 4), [67, 69, 72, 74], '4 级根音 F 不在五声里，从它上面最近的五声音开始');
assert.deepEqual(pentaLadder(makeKey(9, 'minor'), 9, 55, 5), [57, 60, 62, 64, 67]);
assert.deepEqual(powerChord(7, 40), [43, 50, 55]);

console.log('pattern tests passed');
