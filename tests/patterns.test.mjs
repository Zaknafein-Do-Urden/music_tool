import assert from 'node:assert/strict';
import { METERS, PATTERNS } from '../js/patterns.js';

for (const [mid, meter] of Object.entries(METERS)) {
  assert.equal(meter.name, mid);
  assert.equal(meter.beats[0], 0, `${mid} 第一拍必须从第 0 步开始`);
  assert.ok(meter.beats.every((b) => b < meter.steps));

  for (const [pid, pattern] of Object.entries(PATTERNS)) {
    const steps = pattern.meters[mid];
    assert.ok(steps, `${pid} 缺少 ${mid} 的节奏型`);
    assert.ok(steps[0]?.bass, `${pid} ${mid} 第一步应弹低音`);
    for (const [s, ev] of Object.entries(steps)) {
      assert.ok(+s >= 0 && +s < meter.steps, `${pid} ${mid} 第 ${s} 步超出小节`);
      assert.ok(ev.notes === 'all' || ev.notes.every((i) => i >= 0 && i <= 3));
      assert.ok(ev.vel > 0 && ev.vel <= 1);
    }
  }
}

console.log('pattern tests passed');
