import assert from 'node:assert/strict';
import { METERS, PATTERNS, DEFAULT_FAVORITES, compilePattern } from '../js/patterns.js';

assert.ok(Object.keys(PATTERNS).length >= 10, '织体要够多');
assert.equal(DEFAULT_FAVORITES.length, 3);
DEFAULT_FAVORITES.forEach((id) => assert.ok(PATTERNS[id]));

for (const [mid, meter] of Object.entries(METERS)) {
  assert.equal(meter.name, mid);
  assert.equal(meter.beats[0], 0, `${mid} 第一拍必须从第 0 步开始`);
  assert.ok(meter.beats.every((b) => b < meter.steps));

  for (const [pid, pattern] of Object.entries(PATTERNS)) {
    assert.ok(pattern.name && pattern.desc, `${pid} 要有名字和说明`);
    const events = compilePattern(pid, mid);
    const steps = Object.keys(events).map(Number);
    assert.ok(events[0]?.bass.length, `${pid} ${mid} 第一步应弹低音`);
    for (const s of steps) {
      const ev = events[s];
      assert.ok(s >= 0 && s < meter.steps, `${pid} ${mid} 第 ${s} 步超出小节`);
      assert.ok(ev.notes === 'all' || ev.notes.every((i) => i >= 0 && i <= 3));
      assert.ok(ev.vel > 0 && ev.vel <= 1);
      assert.ok(ev.dur >= 1 && s + ev.dur <= meter.steps, `${pid} ${mid} 第 ${s} 步时长 ${ev.dur}`);
      assert.ok(ev.bassDur >= 1 && s + ev.bassDur <= meter.steps);
    }
  }
}

// 八分音符写法展开成十六分步：柱式 4/4 在 0 4 8 12 步
assert.deepEqual(Object.keys(compilePattern('block', '4/4')).map(Number), [0, 4, 8, 12]);
// 十六分写法逐步对应
assert.equal(Object.keys(compilePattern('flow16', '4/4')).length, 16);
// 2/4 取 4/4 前半小节
assert.deepEqual(Object.keys(compilePattern('block', '2/4')).map(Number), [0, 4]);
// 力度：小节第一拍 > 其他拍 > 反拍；重音、轻弹记号生效
const rock = compilePattern('rock', '4/4');
assert.ok(rock[0].vel > rock[4].vel && rock[4].vel > rock[2].vel);
const block = compilePattern('block', '4/4');
assert.ok(block[4].vel < compilePattern('block', '4/4')[8].vel, '-A 应比同位置更轻');
// 低音种类与时长：跨步 B . A . F . A . → 低音根音响到五度那一步
const stride = compilePattern('stride', '4/4');
assert.deepEqual(stride[0].bass, ['root']);
assert.deepEqual(stride[8].bass, ['fifth']);
assert.equal(stride[0].bassDur, 8);
assert.deepEqual(compilePattern('heavy', '4/4')[0].bass, ['root', 'octave']);
// 长音：整小节
assert.equal(compilePattern('pad', '3/4')[0].dur, 12);

assert.throws(() => compilePattern('block', '5/4'));

console.log('pattern tests passed');
