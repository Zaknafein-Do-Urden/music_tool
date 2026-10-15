# music_tool

手机上边唱边即兴伴奏的 Web app（PWA，目标 iPhone Safari）：点按钮切换和弦，钢琴伴奏按节奏型循环。

- **产品方向与后续阶段见 [docs/ROADMAP.md](docs/ROADMAP.md)**，开始新功能前先读，完成一个阶段后更新它。
- 纯静态站点，无构建步骤；部署到 GitHub Pages（见 README）。
- `js/theory.js` 纯乐理函数（可在 Node 下测试：`node tests/theory.test.mjs`）；`js/engine.js` Tone.js 音频与节奏；`js/app.js` 界面。
- Tone.js 14.8.49 从 jsDelivr 加载为全局 `window.Tone`；钢琴采样来自 tonejs.github.io（Salamander）。
- 用户不太懂乐理，界面和文案用级数（1 2m 3m 4 5 6m）和通俗说明。
