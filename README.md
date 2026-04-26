# AI 健身房运营助手

用户端和工作者端分离的健身房运营 Agent 网站。前端使用 Vite + React，后端使用 Express，Agent 对话通过 OpenAI-compatible API 调用。

## 本地运行

1. 安装依赖：

```bash
npm install
```

2. 复制环境变量：

```bash
copy .env.example .env
```

3. 在 `.env` 填写：

```bash
LLM_API_KEY="你的模型 API Key"
LLM_BASE_URL="https://api.minimaxi.com/v1"
LLM_MODEL="MiniMax-M2.1"
```

4. 启动后端和前端：

```bash
npm run api
npm run dev
```

本地地址：

- 用户端：http://localhost:3000/user
- 工作者端：http://localhost:3000/staff
- API 健康检查：http://localhost:8788/api/health

## Vercel 部署

仓库已包含 `vercel.json` 和 `api/index.ts`，可以直接用 Vercel 部署前端和 API。

Vercel 项目环境变量需要配置：

```bash
LLM_API_KEY="你的模型 API Key"
LLM_BASE_URL="https://api.minimaxi.com/v1"
LLM_MODEL="MiniMax-M2.1"
```

前端线上默认请求同域 `/api/*`，不需要再配置 `VITE_API_URL`。

注意：当前账号注册数据在本地使用文件保存；Vercel Serverless 环境没有永久文件系统。正式商业上线时应接入数据库，例如 Vercel Postgres、Supabase 或 Neon。不要把 `.env` 上传到 GitHub，里面有模型密钥。
