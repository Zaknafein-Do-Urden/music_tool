# 即兴伴奏

边唱歌边点按钮切换和弦，钢琴伴奏自动按节奏循环。

## 用法

1. 选一个调（唱着舒服就行，不确定先用 C）、伴奏风格和速度。
2. 点任意和弦开始，伴奏会一直循环；再点别的和弦，会在下一拍（或下一小节）切换。
3. 不知道按什么：从 `1` 开始，套 `1 → 5 → 6m → 4` 循环；一句快唱完时按 `5`，下一句回到 `1`。

iPhone 上建议在 Safari 里"分享 → 添加到主屏幕"，用起来像 app。如果没声音，检查音量和静音键。

## 本地运行

```bash
python -m http.server 8000
```

然后打开 http://localhost:8000 。

## 部署到 GitHub Pages

1. 推送到 GitHub：`git push -u origin main`
2. 仓库 Settings → Pages → Source 选 "Deploy from a branch"，Branch 选 `main`、目录 `/ (root)`，保存。
3. 一两分钟后访问 `https://<用户名>.github.io/music_tool/`。之后每次推送到 main 都会自动更新。

后续路线见 [docs/ROADMAP.md](docs/ROADMAP.md)。
