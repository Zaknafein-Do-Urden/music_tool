# music_tool

手机上边唱边即兴伴奏的 Web app（PWA，目标 iPhone Safari）：点按钮切换和弦，钢琴伴奏按节奏型循环。

- **产品方向与后续阶段见 [docs/ROADMAP.md](docs/ROADMAP.md)**，开始新功能前先读，完成一个阶段后更新它。
- 纯静态站点，无构建步骤；部署到 GitHub Pages（见 README）。
- 纯函数模块（Node 下可测，跑全部测试：`for t in tests/*.test.mjs; do node $t; done`）：
  `js/theory.js` 乐理；`js/ensembles.js` 乐队（乐器、织体、加花数据）；`js/patterns.js` 拍号、织体记号解析（写法见文件顶部）；`js/pitch.js` YIN 音高检测；`js/analysis.js` 分音符、判断调；`js/suggest.js` 和弦推荐与历史记忆；`js/wav.js` WAV 编码。
- 浏览器模块：`js/engine.js` Tone.js 多乐器伴奏（按乐队加载采样）；`js/mic.js` 麦克风（定调/推荐/录音共用，按使用者计数开关）；`js/recorder.js` 两轨录音与混音；`js/app.js` 界面。
- 浏览器里测麦克风功能：用振荡器 + `MediaStreamDestination` 替换 `navigator.mediaDevices.getUserMedia` 模拟唱歌。
- Tone.js 14.8.49 从 jsDelivr 加载为全局 `window.Tone`；采样：钢琴 Salamander、鼓 acoustic-kit（都在 tonejs.github.io）、其他乐器 FluidR3 GM（gleitz.github.io/midi-js-soundfonts，CC BY 3.0，设置页有署名）。
- 用户不太懂乐理，界面和文案用级数（大调 1 2m 3m 4 5 6m，小调 1m 3 4m 5 6 7；中国风五声化后为 1 2sus 3m7 4 5sus 6m / 1m 3 4sus 5m7 6 7sus）和通俗说明。
- 演奏中要用的控件做成按钮，不用下拉框。
- 改完、测试通过后直接提交并 `git push origin main`，不用问用户。
