# 热门视频 · 抖音/B站每日热榜（PWA）

一个可直接部署到线上的**手机 PWA 应用**：每天自动抓取 **抖音热榜前 20** 与 **哔哩哔哩热门视频前 10**，点击任意卡片即可**跳转到对应 App（抖音 / B站）**观看视频。

- 支持「添加到主屏幕 / 桌面」，像原生 App 一样全屏使用
- 支持离线打开（Service Worker 缓存应用外壳 + 本地缓存最近一次数据）
- 多数据源自动降级：在线接口 → 仓库每日快照 → 本地缓存
- 每天自动更新：GitHub Actions 定时抓取并提交快照（默认北京时间每天 06:00）

---

## ✨ 功能

| 平台 | 榜单 | 条数 | 点击行为 |
| --- | --- | --- | --- |
| 抖音 | 热点榜（话题/视频） | 前 20 | 跳转抖音 App 查看该话题下视频 |
| 哔哩哔哩 | 热门视频 | 前 10 | 跳转 B站 App 播放视频（带封面/UP主/播放/弹幕/时长） |

> 说明：抖音的公开数据源是「热点榜」（话题维度），这是各热榜 App 的通用做法；点击后会在抖音 App 内打开对应话题的视频流。

## 📁 目录结构

```
├── index.html              # 页面
├── style.css               # 样式（深色移动端优先）
├── app.js                  # 主逻辑（多数据源 + 降级 + 渲染）
├── manifest.webmanifest    # PWA 清单（添加到主屏幕）
├── sw.js                   # Service Worker（离线缓存）
├── lib/normalize.js        # 通用解析器（浏览器 & 快照脚本共用）
├── icons/                  # 应用图标（96/180/192/512 + favicon）
├── data/                   # 每日快照（由 Actions 自动更新）
│   ├── douyin.json
│   └── bilibili.json
├── scripts/
│   ├── fetch-snapshot.cjs  # 每日快照抓取脚本（Node 18+）
│   └── make-icons.mjs      # 图标生成脚本（可选，纯 Node 无依赖）
└── .github/workflows/
    └── daily-fetch.yml     # 每日自动抓取工作流
```

> 📖 想要 GitHub Pages 的保姆级详细步骤？见 [DEPLOY-GITHUB-PAGES.md](DEPLOY-GITHUB-PAGES.md)。

## 🚀 部署（任选一种，均免费）

### 方式一：GitHub Pages（推荐，自带每日自动抓取）

1. 在 GitHub 新建一个仓库（例如 `hot-video`），并把本目录所有文件推上去：

```bash
git init
git add .
git commit -m "init: 热门视频 PWA"
git branch -M main
git remote add origin https://github.com/<你的用户名>/hot-video.git
git push -u origin main
```

2. 打开仓库 **Settings → Pages**：Source 选择 `Deploy from a branch`，分支选 `main`，目录选 `/ (root)`，保存。

3. 首次推送时工作流会立即运行一次并生成每日快照；之后每天 **北京时间 06:00** 自动抓取并更新快照（可在仓库 **Actions** 页查看运行记录，也可手动点 `Run workflow`）。

4. 打开 `https://<你的用户名>.github.io/hot-video/` 即可使用；手机浏览器打开后按下方步骤添加到主屏幕。

### 方式二：Vercel / Netlify / Cloudflare Pages

- 直接把本目录推到一个 GitHub 仓库，然后在对应平台 **Import 该仓库** 即可；
- Vercel：Framework Preset 选 **Other**，无需构建命令，输出目录保持默认；
- Netlify：Build command 留空，Publish directory 填 `.`；
- Cloudflare Pages：直接连接仓库，构建命令留空。
- 如果不想用 GitHub Actions，删除 `.github` 目录即可，页面会直接实时请求在线接口（纯静态也能用）。

### 方式三：任意静态托管 / 自己的服务器

把整个目录上传到任意静态站点（如对象存储、Nginx 等）即可，无需后端。

## 📱 添加到主屏幕（当 App 用）

- **iPhone/iPad（Safari）**：打开页面 → 底部「分享」→「添加到主屏幕」。
- **Android（Chrome）**：打开页面 → 右上角「⋮」→「安装应用 / 添加到主屏幕」；满足条件时页面顶部还会出现「安装 App」按钮。
- **电脑（Chrome/Edge）**：地址栏右侧的「安装」图标。
- 安装后可全屏、可离线打开；点击卡片自动唤起对应 App。

## 🔌 数据源

| 榜单 | 数据源 | 说明 |
| --- | --- | --- |
| 抖音热榜 | [今日热榜 API (DailyHotApi)](https://github.com/imsyy/DailyHotApi) `api-hot.imsyy.top/douyin` | 60 分钟缓存，CORS 开放 |
| 抖音热榜（备） | vvhan `api.vvhan.com/api/hotlist/douyinHot` | 备源 |
| B站热门视频 | [今日热榜 API](https://github.com/imsyy/DailyHotApi) `api-hot.imsyy.top/bilibili`（B站热门榜） | 主源，含封面/UP主/播放等 |
| B站热门视频（备） | B站官方 `api.bilibili.com/x/web-interface/popular` | 官方接口 |

- 数据源地址集中在 `app.js` 的 `SOURCES` 与 `scripts/fetch-snapshot.cjs` 中，接口变动时改这两处即可。
- 本项目仅供个人学习交流，数据来自公开接口，版权归原平台所有，请勿用于商业用途。

## 🧪 本地预览

```bash
# 方式一（Node）
npx serve .

# 方式二（Python）
python -m http.server 8899
# 然后浏览器打开 http://localhost:8899
```

## ❓ 常见问题

- **点击卡片没有跳转到 App？** 请先安装对应的抖音 / B站 App；个别平台可能因为系统设置跳转到了网页，属正常现象。
- **B站封面不显示？** 封面图片在 HTTPS 页面下会自动升级为 HTTPS 地址；个别图床不支持时会显示默认占位图。
- **显示「在线接口不可用」？** 这是降级机制在正常工作——此时展示的是仓库每日快照；若快照也没有，检查网络后点击重试。