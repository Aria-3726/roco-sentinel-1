# 🛰️ Roco Kingdom: World — 海外舆情监控面板

洛克王国：世界 海外舆情实时监控 Dashboard，覆盖 YouTube / TikTok / Reddit / X / 海外媒体，支持英/日/泰/越/印尼语。

## 功能

- **50 条预加载验证数据** — 全部附原始链接
- **实时扫描** — 调用 Anthropic API + Web Search 搜索最新海外舆情
- **5 个议题追踪** — AI 自动识别核心争议
- **情绪分析** — 正面/中性/负面自动分类
- **每日增长图表** — 堆叠柱状图展示舆情变化
- **多平台筛选** — 按平台过滤动态流

## 部署到 Vercel

### 1. 推送到 GitHub

```bash
git init
git add .
git commit -m "init: roco sentinel"
git remote add origin https://github.com/你的用户名/roco-sentinel.git
git push -u origin main
```

### 2. 部署到 Vercel

1. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录
2. 点击 **"Add New Project"** → 选择 `roco-sentinel` 仓库
3. Framework Preset 选择 **Vite**
4. 点击 **Deploy**

### 3. 配置 API Key（启用扫描功能）

1. 进入 Vercel Dashboard → 你的项目 → **Settings** → **Environment Variables**
2. 添加：
   - Name: `ANTHROPIC_API_KEY`
   - Value: `sk-ant-xxxxx`（你的 Anthropic API Key）
3. 点击 Save → **Redeploy** 项目

### 4. 分享链接

部署完成后会得到一个 `https://roco-sentinel-xxx.vercel.app` 的链接，直接分享给任何人即可访问。

## 本地开发

```bash
npm install
npm run dev
```

需要扫描功能的话，创建 `.env` 文件：
```
ANTHROPIC_API_KEY=sk-ant-xxxxx
```

## 项目结构

```
roco-sentinel/
├── api/
│   └── scan.js          # Vercel Serverless Function (Anthropic API)
├── src/
│   ├── App.jsx          # 主面板组件
│   ├── data.js          # 50条预加载验证数据
│   └── main.jsx         # React 入口
├── index.html           # HTML 入口
├── package.json
├── vite.config.js
├── vercel.json          # Vercel 路由配置
└── .env.example         # 环境变量模板
```

## 技术栈

- **前端**: React 18 + Recharts + Vite
- **后端**: Vercel Serverless Functions
- **AI**: Anthropic Claude API + Web Search
- **持久化**: localStorage
