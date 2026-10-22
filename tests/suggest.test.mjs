import assert from 'node:assert/strict';
import { makeKey } from '../js/theory.js';
import { suggestChords, chordFit, ChordMemory, TRANSITIONS, PENTA_TRANSITIONS } from '../js/suggest.js';

const hist = (weights) => {
  const h = new Array(12).fill(0);
  for (const [pc, w] of Object.entries(weights)) h[pc] = w;
  return h;
};
const C = makeKey(0, 'major');
const Am = makeKey(9, 'minor');

for (const rows of Object.values(TRANSITIONS)) {
  assert.equal(rows.length, 6);
  rows.forEach((r) => assert.ok(Math.abs(r.reduce((s, x) => s + x, 0) - 1) < 1e-9));
}

// 唱 C E G → 推荐 1（C）
assert.equal(suggestChords({ key: C, hist: hist({ 0: 1, 4: 1, 7: 1 }) })[0].degree, 0);
// 唱 G B D → 推荐 5（G）
assert.equal(suggestChords({ key: C, hist: hist({ 7: 1, 11: 1, 2: 1 }) })[0].degree, 4);
// 唱 F A → 4（F）比 2m（Dm）更契合（F A C 两个音都是 F 的和弦音，根音加分）
assert.equal(suggestChords({ key: C, hist: hist({ 5: 1, 9: 1 }) })[0].degree, 3);
// A 小调唱 E G# B → 5（E）
assert.equal(suggestChords({ key: Am, hist: hist({ 4: 1, 8: 1, 11: 1 }) })[0].degree, 3);

// 唱得太少不推荐
assert.deepEqual(suggestChords({ key: C, hist: hist({ 0: 0.1 }) }), []);

// 旋律模棱两可时，和弦走向习惯起作用：唱 C、G（1 级和 6m 都不是满分），当前在 5 → 回 1
const amb = hist({ 0: 1, 7: 0.3 });
assert.equal(suggestChords({ key: C, hist: amb, current: 4 })[0].degree, 0);

// 历史记忆：在 C 调唱 E 之后用户按了 4（F）；换到 G 调唱同样位置的音（B）也应想起来
const mem = new ChordMemory();
for (let i = 0; i < 3; i++) mem.record(C, hist({ 4: 1, 0: 0.2 }), 3);
const G = makeKey(7, 'major');
const recalled = mem.recall(G, hist({ 11: 1, 7: 0.2 }));
assert.ok(recalled && recalled[3] === 1, '换调后应能想起 4');
assert.equal(mem.recall(C, hist({ 2: 1, 5: 1 })), null, '不相似的旋律不应有记忆');
assert.equal(mem.recall(Am, hist({ 4: 1, 0: 0.2 })), null, '大调记忆不用于小调');

// 记忆能扭转结果：只看旋律，E 音不太推荐 F；有了"上次这里按了 F"的记忆，F 进前两名
const eOnly = hist({ 4: 1, 0: 0.2 });
const rank = (list, d) => list.findIndex((x) => x.degree === d);
assert.ok(rank(suggestChords({ key: C, hist: eOnly, current: 0 }), 3) >= 2);
assert.ok(rank(suggestChords({ key: C, hist: eOnly, current: 0, memory: mem }), 3) <= 1, '有记忆时 4 应进前两名');

// 记忆可存可取
const restored = new ChordMemory(JSON.parse(JSON.stringify(mem)));
assert.equal(restored.entries.length, 3);
assert.equal(chordFit(C, hist({})).every((x) => x === 0), true);

// 中国风：转移表每行和为 1；唱 G A D → 推荐 5sus（Gsus2），普通模式下 A 不是 G 的和弦音
for (const rows of Object.values(PENTA_TRANSITIONS)) rows.forEach((r) => assert.ok(Math.abs(r.reduce((s, x) => s + x, 0) - 1) < 1e-9));
assert.equal(suggestChords({ key: C, hist: hist({ 7: 1, 9: 1, 2: 1 }), harmony: 'penta' })[0].degree, 4);
// F6：唱 A C D（F 不唱）也该想到 4 级
assert.equal(suggestChords({ key: C, hist: hist({ 9: 1, 0: 0.5, 2: 1 }), harmony: 'penta' })[0].degree, 3);
// 中国风下 5 之后不那么急着回 1
assert.ok(PENTA_TRANSITIONS.major[4][0] < TRANSITIONS.major[4][0]);

console.log('suggest tests passed');
