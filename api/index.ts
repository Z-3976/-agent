import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';

dotenv.config();

type AppRole = 'user' | 'staff';
type ModuleKey = 'groupbuy' | 'video' | 'live' | 'product';
type UserRecord = {
  id: string;
  role: AppRole;
  phone?: string;
  account?: string;
  accountType?: 'phone' | 'email';
  name: string;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
};
type SmsCodeRecord = {
  phone: string;
  role: AppRole;
  codeHash: string;
  codeSalt: string;
  expiresAt: string;
  used: boolean;
};
type Database = {
  users: UserRecord[];
  smsCodes: SmsCodeRecord[];
  sessions: Array<{ tokenHash: string; userId: string; expiresAt: string }>;
};
type AgentChatRequest = {
  question?: string;
  module?: ModuleKey;
  profile?: Record<string, unknown>;
  docs?: Array<Record<string, unknown>>;
  messages?: Array<{ role?: 'user' | 'assistant'; content?: string }>;
};

type ChatProviderConfig = {
  name: 'openai' | 'minimax';
  apiKey: string;
  baseUrl: string;
  model: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.VERCEL ? path.join(os.tmpdir(), 'fitness-ai-data') : path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');
const app = express();
const port = Number(process.env.API_PORT ?? 8788);

app.use(express.json());

app.get('/', (_request, response) => {
  response.redirect(302, 'http://localhost:3000/user');
});

app.get('/api-home', (_request, response) => {
  response.type('html').send(`<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>健身房运营助手 API</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f7fb; color: #111827; }
      .wrap { max-width: 820px; margin: 48px auto; padding: 0 20px; }
      .card { background: #fff; border: 1px solid #e5e7eb; border-radius: 18px; padding: 28px; box-shadow: 0 10px 30px rgba(15, 23, 42, 0.06); }
      h1 { margin: 0 0 10px; font-size: 32px; }
      p { line-height: 1.7; color: #4b5563; }
      .grid { display: grid; gap: 14px; margin-top: 22px; }
      .btn { display: inline-block; text-decoration: none; background: #0f766e; color: #fff; padding: 12px 16px; border-radius: 12px; font-weight: 700; }
      .btn.secondary { background: #111827; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 6px; color: #111827; }
      ul { color: #4b5563; line-height: 1.8; padding-left: 20px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>健身房运营助手 API 已启动</h1>
        <p>你当前打开的是后端接口端口 <span class="mono">8788</span>，不是前端页面端口，所以之前会看到 Error。</p>
        <div class="grid">
          <a class="btn" href="http://localhost:3000/user">打开用户端页面</a>
          <a class="btn" href="http://localhost:3000/staff">打开工作人员端页面</a>
          <a class="btn secondary" href="/api/health">查看 API 健康检查</a>
        </div>
        <ul>
          <li>前端页面：<span class="mono">http://localhost:3000</span></li>
          <li>后端 API：<span class="mono">http://localhost:8788/api/*</span></li>
          <li>当前登录接口：注册 + 密码登录</li>
        </ul>
      </div>
    </div>
  </body>
</html>`);
});

async function readDb(): Promise<Database> {
  try {
    const raw = await fs.readFile(dbPath, 'utf8');
    return JSON.parse(raw) as Database;
  } catch {
    return { users: [], smsCodes: [], sessions: [] };
  }
}

async function writeDb(db: Database) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dbPath, JSON.stringify(db, null, 2), 'utf8');
}

function hashSecret(secret: string, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(secret, salt, 64).toString('hex');
  return { hash, salt };
}

function verifySecret(secret: string, hash: string, salt: string) {
  const current = crypto.scryptSync(secret, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  return stored.length === current.length && crypto.timingSafeEqual(stored, current);
}

function normalizeRole(role: unknown): AppRole | null {
  return role === 'staff' || role === 'user' ? role : null;
}

function assertPhone(phone: unknown): string | null {
  if (typeof phone !== 'string') return null;
  const normalized = phone.trim();
  return /^1\d{10}$/.test(normalized) ? normalized : null;
}

function normalizeAccount(account: unknown): { account: string; accountType: 'phone' | 'email' } | null {
  if (typeof account !== 'string') return null;
  const normalized = account.trim().toLowerCase();
  if (/^1\d{10}$/.test(normalized)) {
    return { account: normalized, accountType: 'phone' };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return { account: normalized, accountType: 'email' };
  }
  return null;
}

function getUserAccount(user: UserRecord) {
  return user.account ?? user.phone ?? '';
}

function publicUser(user: UserRecord) {
  return {
    id: user.id,
    role: user.role,
    account: getUserAccount(user),
    accountType: user.accountType ?? (user.phone ? 'phone' : 'email'),
    phone: user.phone,
    name: user.name,
    createdAt: user.createdAt,
  };
}

function createSession(db: Database, user: UserRecord) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  db.sessions = db.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now());
  db.sessions.push({
    tokenHash,
    userId: user.id,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  });
  return token;
}

function isPasswordValid(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password);
}

function getChatProviders(): ChatProviderConfig[] {
  const providers: ChatProviderConfig[] = [];

  if (process.env.OPENAI_API_KEY) {
    providers.push({
      name: 'openai',
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: (process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1').replace(/\/$/, ''),
      model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    });
  }

  if (process.env.LLM_API_KEY) {
    providers.push({
      name: 'minimax',
      apiKey: process.env.LLM_API_KEY,
      baseUrl: (process.env.LLM_BASE_URL ?? 'https://api.minimaxi.com/v1').replace(/\/$/, ''),
      model: process.env.LLM_MODEL ?? 'MiniMax-M2.1',
    });
  }

  return providers;
}

async function sendSmsCode(phone: string, code: string) {
  const provider = process.env.SMS_PROVIDER;
  if (!provider) {
    throw new Error('SMS_PROVIDER_NOT_CONFIGURED');
  }

  if (provider === 'webhook') {
    const endpoint = process.env.SMS_WEBHOOK_URL;
    const token = process.env.SMS_WEBHOOK_TOKEN;
    if (!endpoint) throw new Error('SMS_WEBHOOK_URL_NOT_CONFIGURED');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        phone,
        code,
        scene: 'fitness_ai_auth',
        message: `您的健身房运营助手验证码是 ${code}，5 分钟内有效。`,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SMS_WEBHOOK_FAILED:${response.status}:${body.slice(0, 160)}`);
    }
    return;
  }

  throw new Error(`SMS_PROVIDER_UNSUPPORTED:${provider}`);
}

app.get('/api/health', (_request, response) => {
  const providers = getChatProviders();
  response.json({
    ok: true,
    smsConfigured: Boolean(process.env.SMS_PROVIDER),
    llmConfigured: providers.length > 0,
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY),
    minimaxConfigured: Boolean(process.env.LLM_API_KEY),
    llmBaseUrl: process.env.LLM_BASE_URL ?? 'https://api.minimaxi.com/v1',
    llmModel: process.env.LLM_MODEL ?? 'MiniMax-M2.1',
    openaiBaseUrl: process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1',
    openaiModel: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
    activeProviders: providers.map((provider) => provider.name),
    provider: process.env.SMS_PROVIDER ?? null,
  });
});

app.get('/api/admin/stats', async (_request, response) => {
  const db = await readDb();
  response.json({
    users: db.users.length,
    userAccounts: db.users.filter((user) => user.role === 'user').length,
    staffAccounts: db.users.filter((user) => user.role === 'staff').length,
    activeSessions: db.sessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now()).length,
  });
});

app.post('/api/agent/chat-v2', async (request, response) => {
  const providers = getChatProviders();
  const body = request.body as AgentChatRequest;
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const module = body.module ?? 'groupbuy';

  if (providers.length === 0) return response.status(500).json({ message: '未配置可用的 AI 密钥' });
  if (!question) return response.status(400).json({ message: '问题不能为空' });

  const moduleName: Record<ModuleKey, string> = {
    groupbuy: '团购运营',
    video: '短视频内容',
    live: '直播转化',
    product: '产品包装',
  };
  const profile = body.profile ?? {};
  const docs = Array.isArray(body.docs) ? body.docs : [];
  const history = Array.isArray(body.messages) ? body.messages.slice(-8) : [];
  const messages = [
    {
      role: 'system',
      content:
        '你是健身房门店运营 AI。必须基于门店资料和知识库输出可执行方案，避免泛泛而谈。用中文回答，结构清晰，适合直接复制给门店运营人员。不要输出思考过程、think 标签或内部推理。',
    },
    {
      role: 'user',
      content: [
        `当前模块：${moduleName[module]}`,
        `门店资料：${JSON.stringify(profile)}`,
        `启用知识库：${JSON.stringify(docs)}`,
        `最近对话：${JSON.stringify(history)}`,
        `用户问题：${question}`,
      ].join('\n\n'),
    },
  ];

  const errors: string[] = [];
  for (const provider of providers) {
    try {
      const upstream = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${provider.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: provider.model,
          temperature: 0.35,
          messages,
        }),
      });

      const data = (await upstream.json().catch(() => ({}))) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
        message?: string;
      };

      if (!upstream.ok) {
        errors.push(`${provider.name}:${data.error?.message || data.message || upstream.status}`);
        continue;
      }

      const content = data.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
      if (content) {
        return response.json({ content, provider: provider.name, model: provider.model });
      }

      errors.push(`${provider.name}:empty_response`);
    } catch (error) {
      errors.push(`${provider.name}:${error instanceof Error ? error.message : 'request_failed'}`);
    }
  }

  response.status(502).json({ message: `AI 接口请求失败：${errors.join(' | ')}` });
});

app.post('/api/agent/chat-legacy', async (request, response) => {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = (process.env.LLM_BASE_URL ?? 'https://api.minimaxi.com/v1').replace(/\/$/, '');
  const model = process.env.LLM_MODEL ?? 'MiniMax-M2.1';
  const body = request.body as AgentChatRequest;
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const module = body.module ?? 'groupbuy';

  if (!apiKey) return response.status(500).json({ message: 'LLM_API_KEY 未配置' });
  if (!question) return response.status(400).json({ message: '问题不能为空' });

  const moduleName: Record<ModuleKey, string> = {
    groupbuy: '团购运营',
    video: '短视频内容',
    live: '直播转化',
    product: '产品包装',
  };
  const profile = body.profile ?? {};
  const docs = Array.isArray(body.docs) ? body.docs : [];
  const history = Array.isArray(body.messages) ? body.messages.slice(-8) : [];

  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        {
          role: 'system',
          content:
            '你是健身房门店运营 Agent。必须基于门店资料和知识库输出可执行方案，避免泛泛而谈。用中文回答，结构清晰，适合直接复制给门店运营人员。不要输出思考过程、think 标签或内部推理。',
        },
        {
          role: 'user',
          content: [
            `当前板块：${moduleName[module]}`,
            `门店资料：${JSON.stringify(profile)}`,
            `启用知识库：${JSON.stringify(docs)}`,
            `最近对话：${JSON.stringify(history)}`,
            `用户问题：${question}`,
          ].join('\n\n'),
        },
      ],
    }),
  });

  const data = (await upstream.json().catch(() => ({}))) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
    message?: string;
  };

  if (!upstream.ok) {
    return response.status(502).json({ message: data.error?.message || data.message || `模型接口请求失败：${upstream.status}` });
  }

  const content = data.choices?.[0]?.message?.content?.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  if (!content) return response.status(502).json({ message: '模型接口没有返回内容' });

  response.json({ content });
});

app.post('/api/auth/register', async (request, response) => {
  const role = normalizeRole(request.body.role);
  const accountInfo = normalizeAccount(request.body.account ?? request.body.phone);
  const phone = accountInfo?.account ?? '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  const passwordConfirm = typeof request.body.passwordConfirm === 'string' ? request.body.passwordConfirm : '';
  const name =
    typeof request.body.name === 'string' && request.body.name.trim() ? request.body.name.trim() : accountInfo?.account ?? '';

  if (!role || !accountInfo) return response.status(400).json({ message: '请输入正确的手机号或邮箱' });
  if (!isPasswordValid(password)) return response.status(400).json({ message: '密码至少 6 位，且必须同时包含英文和数字' });
  if (password !== passwordConfirm) return response.status(400).json({ message: '两次输入的密码不一致' });

  const db = await readDb();
  const exists = db.users.some((user) => user.role === role && getUserAccount(user) === accountInfo.account);
  if (exists) return response.status(409).json({ message: '该账号已注册，请直接登录' });

  const passwordSecret = hashSecret(password);
  const user: UserRecord = {
    id: crypto.randomUUID(),
    role,
    account: accountInfo.account,
    accountType: accountInfo.accountType,
    phone: accountInfo.accountType === 'phone' ? accountInfo.account : undefined,
    name,
    passwordHash: passwordSecret.hash,
    passwordSalt: passwordSecret.salt,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await writeDb(db);

  response.json({ user: publicUser(user) });
});

app.post('/api/auth/login/password', async (request, response) => {
  const role = normalizeRole(request.body.role);
  const accountInfo = normalizeAccount(request.body.account ?? request.body.phone);
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  if (!role || !accountInfo || !password) return response.status(400).json({ message: '请输入正确的账号和密码' });

  const db = await readDb();
  const user = db.users.find((item) => item.role === role && getUserAccount(item) === accountInfo.account);
  if (!user) return response.status(404).json({ message: '该账号尚未注册，请先注册账号' });
  if (!verifySecret(password, user.passwordHash, user.passwordSalt)) {
    return response.status(401).json({ message: '密码错误' });
  }

  const token = createSession(db, user);
  await writeDb(db);
  response.json({ token, user: publicUser(user) });
});

app.post('/api/account/update-profile', async (request, response) => {
  const role = normalizeRole(request.body.role);
  const currentAccountInfo = normalizeAccount(request.body.currentAccount);
  const nextAccountInfo = normalizeAccount(request.body.account);
  const name = typeof request.body.name === 'string' ? request.body.name.trim() : '';

  if (!role || !currentAccountInfo || !nextAccountInfo || !name) {
    return response.status(400).json({ message: '请填写完整的账户资料' });
  }

  const db = await readDb();
  const user = db.users.find((item) => item.role === role && getUserAccount(item) === currentAccountInfo.account);
  if (!user) return response.status(404).json({ message: '当前账号不存在，请重新登录' });

  const duplicate = db.users.some((item) => item.id !== user.id && item.role === role && getUserAccount(item) === nextAccountInfo.account);
  if (duplicate) return response.status(409).json({ message: '该账号已被使用，请更换后再试' });

  user.name = name;
  user.account = nextAccountInfo.account;
  user.accountType = nextAccountInfo.accountType;
  user.phone = nextAccountInfo.accountType === 'phone' ? nextAccountInfo.account : undefined;
  await writeDb(db);

  response.json({ user: publicUser(user) });
});

app.post('/api/account/update-password', async (request, response) => {
  const role = normalizeRole(request.body.role);
  const accountInfo = normalizeAccount(request.body.account);
  const currentPassword = typeof request.body.currentPassword === 'string' ? request.body.currentPassword : '';
  const newPassword = typeof request.body.newPassword === 'string' ? request.body.newPassword : '';
  const newPasswordConfirm = typeof request.body.newPasswordConfirm === 'string' ? request.body.newPasswordConfirm : '';

  if (!role || !accountInfo || !currentPassword || !newPassword) {
    return response.status(400).json({ message: '请填写完整的密码信息' });
  }

  if (!isPasswordValid(newPassword)) {
    return response.status(400).json({ message: '密码至少 6 位，且必须同时包含英文和数字' });
  }

  if (newPassword !== newPasswordConfirm) {
    return response.status(400).json({ message: '两次输入的新密码不一致' });
  }

  const db = await readDb();
  const user = db.users.find((item) => item.role === role && getUserAccount(item) === accountInfo.account);
  if (!user) return response.status(404).json({ message: '当前账号不存在，请重新登录' });

  if (!verifySecret(currentPassword, user.passwordHash, user.passwordSalt)) {
    return response.status(401).json({ message: '当前密码错误' });
  }

  const passwordSecret = hashSecret(newPassword);
  user.passwordHash = passwordSecret.hash;
  user.passwordSalt = passwordSecret.salt;
  await writeDb(db);

  response.json({ success: true });
});

app.post('/api/auth/register-legacy', async (request, response) => {
  const role = normalizeRole(request.body.role);
  const accountInfo = normalizeAccount(request.body.account ?? request.body.phone);
  const phone = accountInfo?.account ?? '';
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  const passwordConfirm = typeof request.body.passwordConfirm === 'string' ? request.body.passwordConfirm : password;
  const name =
    typeof request.body.name === 'string' && request.body.name.trim() ? request.body.name.trim() : accountInfo?.account ?? '';

  if (!role || !phone) return response.status(400).json({ message: '角色或手机号不正确' });
  if (!isPasswordValid(password)) return response.status(400).json({ message: '密码至少 6 位，且必须同时包含英文和数字' });

  const db = await readDb();
  const exists = db.users.some((user) => user.role === role && user.phone === phone);
  if (exists) return response.status(409).json({ message: '该手机号已注册，请直接登录' });

  const passwordSecret = hashSecret(password);
  const user: UserRecord = {
    id: crypto.randomUUID(),
    role,
    phone,
    name,
    passwordHash: passwordSecret.hash,
    passwordSalt: passwordSecret.salt,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  await writeDb(db);

  response.json({ user: publicUser(user) });
});

app.post('/api/auth/send-code', async (request, response) => {
  const role = normalizeRole(request.body.role);
  const phone = assertPhone(request.body.phone);
  if (!role || !phone) return response.status(400).json({ message: '角色或手机号不正确' });

  const db = await readDb();
  const user = db.users.find((item) => item.role === role && item.phone === phone);
  if (!user) return response.status(404).json({ message: '该手机号尚未注册，请先注册账号' });

  const code = String(Math.floor(100000 + Math.random() * 900000));
  await sendSmsCode(phone, code);
  const secret = hashSecret(code);
  db.smsCodes = db.smsCodes.filter((item) => new Date(item.expiresAt).getTime() > Date.now() && !item.used);
  db.smsCodes.push({
    phone,
    role,
    codeHash: secret.hash,
    codeSalt: secret.salt,
    expiresAt: new Date(Date.now() + 1000 * 60 * 5).toISOString(),
    used: false,
  });
  await writeDb(db);

  response.json({ message: '验证码已发送' });
});

app.post('/api/auth/login/code', async (request, response) => {
  const role = normalizeRole(request.body.role);
  const phone = assertPhone(request.body.phone);
  const code = typeof request.body.code === 'string' ? request.body.code.trim() : '';
  if (!role || !phone || !/^\d{6}$/.test(code)) return response.status(400).json({ message: '登录信息不完整' });

  const db = await readDb();
  const user = db.users.find((item) => item.role === role && item.phone === phone);
  if (!user) return response.status(404).json({ message: '该手机号尚未注册，请先注册账号' });

  const matchedCode = [...db.smsCodes]
    .reverse()
    .find((item) => item.role === role && item.phone === phone && !item.used && new Date(item.expiresAt).getTime() > Date.now());
  if (!matchedCode || !verifySecret(code, matchedCode.codeHash, matchedCode.codeSalt)) {
    return response.status(401).json({ message: '验证码错误或已过期' });
  }

  matchedCode.used = true;
  const token = createSession(db, user);
  await writeDb(db);
  response.json({ token, user: publicUser(user) });
});

app.post('/api/auth/login/password-legacy', async (request, response) => {
  const role = normalizeRole(request.body.role);
  const phone = assertPhone(request.body.phone);
  const password = typeof request.body.password === 'string' ? request.body.password : '';
  if (!role || !phone || !password) return response.status(400).json({ message: '登录信息不完整' });

  const db = await readDb();
  const user = db.users.find((item) => item.role === role && item.phone === phone);
  if (!user) return response.status(404).json({ message: '该手机号尚未注册，请先注册账号' });
  if (!verifySecret(password, user.passwordHash, user.passwordSalt)) {
    return response.status(401).json({ message: '密码错误' });
  }

  const token = createSession(db, user);
  await writeDb(db);
  response.json({ token, user: publicUser(user) });
});

if (!process.env.VERCEL) {
  app.listen(port, '0.0.0.0', () => {
    console.log(`API server listening on http://localhost:${port}`);
  });
}

export default app;
