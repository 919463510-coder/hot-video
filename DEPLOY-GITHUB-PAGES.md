# 部署指南（详细版）：GitHub Pages + 每日自动抓取

> 适合：想零成本部署到线上、并让「每天自动抓取」真正自动运行的你。
> 全程免费，只需要一个 GitHub 账号 + 电脑上装好 Git。

---

## 0. 准备工作

1. 注册 GitHub 账号：https://github.com/signup
2. 电脑安装 Git（Windows）：
   - 打开 https://git-scm.com/download/win 下载安装包
   - 安装时一路「Next」用默认选项即可
   - 安装完成后，打开 PowerShell，输入 `git --version`，能看到版本号说明安装成功
3. 确认项目文件夹完整：
   `C:\Users\Administrator\Documents\Codex\2026-08-07\20\outputs\hot-video-pwa`
   里面应包含 index.html、app.js、.github 等文件。

---

## 1. 在 GitHub 上创建仓库（空仓库）

1. 登录 github.com
2. 右上角 **+ → New repository**
3. 填写：
   - **Repository name**：`hot-video`（建议用英文小写，方便后面拼网址）
   - **Public / Private**：选 **Public**（免费版 GitHub Pages 只支持公开仓库）
   - 下面的 "Add a README file / Add .gitignore / Choose a license" **都不要勾选**，保持空仓库
4. 点 **Create repository**
5. 创建后你会看到一个带命令提示的空白页，先放着，后面要用里面的仓库地址

---

## 2. 本地把项目变成 Git 仓库并提交

打开 PowerShell，逐条执行（`#` 开头是注释，不用输入）：

```powershell
# 1) 进入项目目录
cd C:\Users\Administrator\Documents\Codex\2026-08-07\20\outputs\hot-video-pwa

# 2) 初始化 git 仓库，并把默认分支名改成 main
git init
git branch -M main

# 3) 设置你的身份（只在第一次需要；换成你的名字和邮箱）
git config user.name "你的名字"
git config user.email "你的邮箱@example.com"

# 4) 把所有文件加入版本管理
git add .

# 5) 确认 .github 工作流文件确实被加进来了（应能看到 .github/workflows/daily-fetch.yml）
git ls-files

# 6) 提交
git commit -m "init: 热门视频 PWA"
```

> 如果第 6 步报错提示需要先设置 user.name / user.email，说明第 3 步没生效，重跑第 3 步即可。

---

## 3. 连接远程仓库并推送

```powershell
# 把第 1 步那个页面里的仓库地址填进来（换成你的用户名）
git remote add origin https://github.com/你的用户名/hot-video.git

# 推送（-u 表示以后直接 git push 即可）
git push -u origin main
```

### 推送时登录（重点）
- 第一次推送会弹出 **GitHub 登录窗口**（Windows 凭据管理器）：用浏览器完成授权即可。
- 如果没有弹窗、而是让你输「用户名 + 密码」：
  - 用户名填你的 GitHub 用户名
  - **密码位置不能填登录密码**，要填 **Personal Access Token**（令牌）：
    1. GitHub 右上角头像 → **Settings** → 最下方 **Developer settings**
    2. **Personal access tokens → Tokens (classic) → Generate new token**
    3. Note 随便填（如 `push`），Expiration 选 90 天或 No expiration
    4. 勾选 **repo** 权限 → 拉到最下点 **Generate token**
    5. 复制生成的 token（只显示一次）→ 粘贴到密码框
- 推送成功后，刷新 GitHub 仓库页面，应能看到所有项目文件。

---

## 4. 开启 GitHub Pages

1. 进入你刚创建的仓库页面
2. 顶部 **Settings**（设置）
3. 左侧菜单选 **Pages**
4. 在 **Build and deployment** 区域：
   - **Source** 选 **Deploy from a branch**
   - **Branch** 选 **main**
   - **Folder** 选 **/ (root)**
5. 点 **Save**
6. 等待 1~3 分钟，页面会显示：
   `Your site is live at https://你的用户名.github.io/hot-video/`
   （点右侧 **Visit site** 可直接打开）

> 网址规律：`https://用户名.github.io/仓库名/`

---

## 5. 验证是否成功

1. 用手机或电脑打开上面的网址。
2. 预期看到：深色界面，「抖音热榜」默认显示 **20 条**、切到「B站热门」显示 **10 条**。
3. 手机上已安装抖音/B站的话，点击任意卡片应能**自动跳转到对应 App**。
4. 顺带确认自动抓取是否生效：
   - 仓库页面 → **Actions** 标签
   - 应该能看到「每日热门快照」工作流，且**首次推送时已自动运行过一次**（绿色 ✅）
   - 点进某次运行，能看到 `抓取每日热门快照` 步骤打印了「快照已写入」日志

---

## 6. 确认「每天自动抓取」自动运行

- 该工作流配置了定时任务：**每天 22:00 UTC = 北京时间次日 06:00** 自动抓取一次。
- 运行时会更新 `data/douyin.json` 和 `data/bilibili.json` 并提交，随后自动触发 Pages 重新部署，网站数据每天都是新的。
- 想立刻跑一次：仓库 **Actions → 每日热门快照 → Run workflow**。
- 即使某天接口抽风，网站也会自动降级展示「最近一次快照」，不会白屏。

---

## 7. 以后如何更新 / 维护

```powershell
cd C:\Users\Administrator\Documents\Codex\2026-08-07\20\outputs\hot-video-pwa
git add .
git commit -m "更新说明"
git push
```
- 推送后 Pages 会自动重新部署（等 1~2 分钟生效）。
- 想改榜单数据源：编辑 `app.js` 顶部的 `SOURCES` 和 `scripts/fetch-snapshot.cjs` 里的 `SOURCES`。

---

## 8. 常见问题排查

| 现象 | 解决办法 |
|---|---|
| 打开网址 404 | 确认 Settings → Pages 里 Branch 选了 main、Folder 选了 /(root)；仓库名与网址一致；等待 2 分钟再试 |
| 有页面但没数据 | 首次加载需联网；点右上角刷新按钮重试；或到 Actions 手动 Run workflow 生成快照 |
| push 报错「Authentication failed」 | 用 Personal Access Token 代替密码（见第 3 步） |
| 点击卡片不跳 App | 手机上先安装抖音 / B站 App；个别系统版本会打开网页版，属正常 |
| 想删除站点 | 仓库 Settings → 最底部 Danger Zone → Delete this repository |
| 想改网址 | 把仓库改名为 `你的用户名.github.io`（此时网址变成 `https://你的用户名.github.io/`），然后 Settings → Pages 里把 Branch 改成 main 即可 |