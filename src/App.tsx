import React, { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Bot,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  Database,
  Dumbbell,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquare,
  Package,
  Paperclip,
  PauseCircle,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Upload,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';

type AppRole = 'user' | 'staff';
type View = 'home' | 'agent' | 'history' | 'profile' | 'staffHome' | 'knowledge' | 'records';
type ModuleKey = 'groupbuy' | 'video' | 'live' | 'product';
type MessageRole = 'user' | 'assistant';

type StoreProfile = {
  name: string;
  storeType: string;
  city: string;
  district: string;
  avgPrice: number;
  audience: string;
  goal: string;
};

type Message = {
  id: string;
  role: MessageRole;
  content: string;
  module: ModuleKey;
  createdAt: string;
  attachments?: string[];
};

type Conversation = {
  id: string;
  title: string;
  module: ModuleKey;
  updatedAt: string;
  messages: Message[];
};

type KnowledgeDoc = {
  id: string;
  title: string;
  category: string;
  module: ModuleKey;
  active: boolean;
  calls: number;
};

type AuthUser = {
  id: string;
  role: AppRole;
  account: string;
  name: string;
};


const modules: Record<ModuleKey, { label: string; title: string; icon: React.ReactNode; desc: string }> = {
  groupbuy: {
    label: '团购',
    title: '团购运营 Agent',
    icon: <Target className="h-5 w-5" />,
    desc: '门店诊断、套餐设计、上架表达和私域承接。',
  },
  video: {
    label: '短视频',
    title: '短视频内容 Agent',
    icon: <Video className="h-5 w-5" />,
    desc: '输出选题、脚本、标题、封面文案和发布节奏。',
  },
  live: {
    label: '直播',
    title: '直播转化 Agent',
    icon: <Radio className="h-5 w-5" />,
    desc: '设计留人、互动、福利节奏和成交话术。',
  },
  product: {
    label: '包装',
    title: '产品包装 Agent',
    icon: <Package className="h-5 w-5" />,
    desc: '优化商品标题、核心卖点、头图文案和详情页结构。',
  },
};

const defaultProfile: StoreProfile = {
  name: '未完善门店资料',
  storeType: '',
  city: '',
  district: '',
  avgPrice: 0,
  audience: '',
  goal: '',
};

const starterPrompts: Record<ModuleKey, string[]> = {
  groupbuy: ['帮我做一个适合写字楼人群的 9.9 元团购套餐', '我的团购浏览多转化少，帮我诊断', '设计团购购买后的私域承接 SOP'],
  video: ['给我写一个短视频脚本', '生成 7 天短视频选题', '把门店案例改成抖音脚本'],
  live: ['设计一场 60 分钟直播流程', '写直播开场 3 分钟留人话术', '用户说没时间训练怎么成交'],
  product: ['包装一个 21 天减脂挑战营', '给私教体验课写 10 个标题', '优化课程卖点适合团购平台'],
};

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function isPasswordValid(password: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{6,}$/.test(password);
}

function getPortalRole(): AppRole {
  return window.location.pathname.includes('/staff') || window.location.hash.includes('staff') ? 'staff' : 'user';
}

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function nowLabel() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function resetAppStorage() {
  localStorage.removeItem('fitness_profile');
  localStorage.removeItem('fitness_docs');
  localStorage.removeItem('fitness_conversations');
  localStorage.removeItem('fitness_user_user');
  localStorage.removeItem('fitness_user_staff');
}

function moduleClasses(active: boolean) {
  return active ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-950 hover:text-zinc-950';
}

async function apiRequest<T>(path: string, body?: unknown): Promise<T> {
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const response = await fetch(`${apiBase}/api${path}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) throw new Error(data.message || `接口请求失败：${response.status}`);
  return data as T;
}

async function apiRequestWithSignal<T>(path: string, body: unknown, signal: AbortSignal): Promise<T> {
  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const response = await fetch(`${apiBase}/api${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok) throw new Error(data.message || `接口请求失败：${response.status}`);
  return data as T;
}

function AuthPage({ role, onAuthed }: { role: AppRole; onAuthed: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [account, setAccount] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const roleTitle = role === 'staff' ? '工作者后台' : '用户后台';

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (mode === 'register' && !isPasswordValid(password)) {
      setError('密码至少 6 位，且必须同时包含英文和数字');
      return;
    }
    if (mode === 'register' && password !== passwordConfirm) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      const result = await apiRequest<{ user: AuthUser }>(
        mode === 'register' ? '/auth/register' : '/auth/login/password',
        mode === 'register'
          ? { role, account, name, password, passwordConfirm }
          : { role, account, password },
      );
      localStorage.setItem(`fitness_user_${role}`, JSON.stringify(result.user));
      onAuthed(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 p-6">
      <div className="mx-auto grid min-h-[calc(100vh-48px)] max-w-6xl overflow-hidden rounded-xl border border-zinc-200 bg-white lg:grid-cols-[1fr_440px]">
        <section className="flex flex-col justify-between bg-zinc-950 p-8 text-white">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-zinc-950">
              <Dumbbell className="h-7 w-7" />
            </div>
            <h1 className="mt-8 text-4xl font-black leading-tight">AI 健身房运营助手</h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-300">把门店资料、知识库和 Agent 对话结合起来，生成真实可落地的团购、短视频、直播和产品包装方案。</p>
          </div>
          <div className="grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
            <div className="rounded-lg border border-white/10 p-4">
              <ShieldCheck className="mb-3 h-5 w-5" />
              密码注册与登录
            </div>
            <div className="rounded-lg border border-white/10 p-4">
              <Users className="mb-3 h-5 w-5" />
              用户端与工作者端分离
            </div>
            <div className="rounded-lg border border-white/10 p-4">
              <Sparkles className="mb-3 h-5 w-5" />
              后端 Agent API 接入
            </div>
          </div>
        </section>

        <section className="flex items-center p-8">
          <form onSubmit={submit} className="w-full">
            <div className="mb-8">
              <div className="text-sm font-bold text-zinc-500">{role === 'staff' ? '工作者入口' : '用户门户'}</div>
              <h2 className="mt-2 text-3xl font-black text-zinc-950">{roleTitle}</h2>
            </div>
            <div className="mb-6 grid grid-cols-2 rounded-lg bg-zinc-100 p-1">
              <button type="button" onClick={() => setMode('login')} className={`rounded-md py-3 text-sm font-black ${mode === 'login' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}>
                登录
              </button>
              <button type="button" onClick={() => setMode('register')} className={`rounded-md py-3 text-sm font-black ${mode === 'register' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500'}`}>
                注册
              </button>
            </div>
            <div className="space-y-4">
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-zinc-600">名称</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} className="h-12 w-full rounded-lg border border-zinc-200 px-4 outline-none focus:border-zinc-950" placeholder="门店名或姓名" />
                </label>
              )}
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-zinc-600">手机号 / 邮箱</span>
                <input value={account} onChange={(event) => setAccount(event.target.value)} className="h-12 w-full rounded-lg border border-zinc-200 px-4 outline-none focus:border-zinc-950" placeholder="手机号或邮箱" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-zinc-600">密码</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="h-12 w-full rounded-lg border border-zinc-200 px-4 outline-none focus:border-zinc-950" placeholder="至少 6 位，包含英文和数字" />
              </label>
              {mode === 'register' && (
                <label className="block">
                  <span className="mb-2 block text-sm font-bold text-zinc-600">再次输入密码</span>
                  <input value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} type="password" className="h-12 w-full rounded-lg border border-zinc-200 px-4 outline-none focus:border-zinc-950" placeholder="确认密码" />
                </label>
              )}
            </div>
            {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}
            <button disabled={loading} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 font-black text-white disabled:bg-zinc-400">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              {mode === 'register' ? '注册并进入' : '登录'}
            </button>
            <div className="mt-5 flex justify-between text-sm">
              <a className="font-bold text-zinc-500 hover:text-zinc-950" href={role === 'staff' ? '/user' : '/staff'}>
                切换到{role === 'staff' ? '用户端' : '工作者端'}
              </a>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function TopBar({
  role,
  user,
  setView,
  onLogout,
  search,
  setSearch,
}: {
  role: AppRole;
  user: AuthUser | null;
  setView: (view: View) => void;
  onLogout: () => void;
  search: string;
  setSearch: (value: string) => void;
}) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-5">
      <div className="flex min-w-[280px] items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-950 text-white">
          <Dumbbell className="h-7 w-7" />
        </div>
        <div>
          <div className="text-xl font-black text-zinc-950">{role === 'staff' ? '工作者后台' : '用户后台'}</div>
          <div className="text-xs font-bold text-zinc-500">健身房运营助手 · {role === 'staff' ? '工作者端' : '门店使用端'}</div>
        </div>
      </div>
      <label className="relative mx-6 hidden w-full max-w-[520px] md:block">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-12 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-12 pr-4 outline-none focus:border-zinc-950 focus:bg-white"
          placeholder="搜索对话、历史记录或运营指令"
        />
      </label>
      <div className="flex items-center gap-2">
        <button onClick={() => setView('agent')} className="hidden rounded-lg bg-zinc-950 px-5 py-3 text-sm font-black text-white md:inline-flex">
          打开 Agent
        </button>
        <button onClick={onLogout} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-600 hover:border-zinc-950 hover:text-zinc-950">
          <LogOut className="h-4 w-4" />
          退出
        </button>
        <div className="hidden text-sm font-bold text-zinc-500 lg:block">{user?.name || user?.account}</div>
      </div>
    </header>
  );
}

function Sidebar({ role, view, setView }: { role: AppRole; view: View; setView: (view: View) => void }) {
  const items =
    role === 'staff'
      ? [
          { key: 'staffHome' as View, label: '工作台', icon: <LayoutDashboard className="h-5 w-5" /> },
          { key: 'knowledge' as View, label: '知识库', icon: <Database className="h-5 w-5" /> },
          { key: 'records' as View, label: '对话记录', icon: <FileText className="h-5 w-5" /> },
        ]
      : [
          { key: 'home' as View, label: '用户首页', icon: <LayoutDashboard className="h-5 w-5" /> },
          { key: 'agent' as View, label: 'Agent 对话', icon: <Bot className="h-5 w-5" /> },
          { key: 'history' as View, label: '我的历史', icon: <History className="h-5 w-5" /> },
          { key: 'profile' as View, label: '门店资料', icon: <Building2 className="h-5 w-5" /> },
        ];

  return (
    <aside className="flex h-[calc(100vh-64px)] w-[260px] shrink-0 flex-col border-r border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 p-4">
        <div className="rounded-lg bg-zinc-50 p-5">
          <div className="text-sm font-bold text-zinc-400">{role === 'staff' ? '运营工作台' : '用户门户'}</div>
          <div className="mt-2 text-2xl font-black text-zinc-950">{role === 'staff' ? '工作者后台' : '用户后台'}</div>
          <p className="mt-3 text-sm leading-6 text-zinc-500">{role === 'staff' ? '管理知识库、查看账号与对话记录。' : '使用 Agent 生成方案并管理门店资料。'}</p>
        </div>
      </div>
      <nav className="space-y-2 p-3">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={`flex w-full items-center gap-3 rounded-lg px-4 py-4 text-left font-black ${view === item.key ? 'bg-zinc-950 text-white' : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-950'}`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm font-bold text-zinc-500">{label}</div>
        <div className="text-zinc-400">{icon}</div>
      </div>
      <div className="mt-4 text-3xl font-black text-zinc-950">{value}</div>
    </div>
  );
}

function Home({
  profile,
  docs,
  conversations,
  setView,
  setModule,
}: {
  profile: StoreProfile;
  docs: KnowledgeDoc[];
  conversations: Conversation[];
  setView: (view: View) => void;
  setModule: (module: ModuleKey) => void;
}) {
  const assistantCount = conversations.flatMap((item) => item.messages).filter((message) => message.role === 'assistant' && message.content).length;
  return (
    <div className="space-y-6 p-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-zinc-950">今天从一个具体问题开始</h1>
            <p className="mt-2 max-w-2xl text-zinc-500">当前所有结果都会优先结合门店资料、启用知识库和你选择的 Agent 板块。</p>
          </div>
          <button onClick={() => setView('agent')} className="rounded-lg bg-zinc-950 px-5 py-3 font-black text-white">进入 Agent</button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="历史对话" value={String(conversations.length)} icon={<MessageSquare className="h-5 w-5" />} />
        <StatCard label="启用资料" value={String(docs.filter((doc) => doc.active).length)} icon={<Database className="h-5 w-5" />} />
        <StatCard label="本周产出" value={String(assistantCount)} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-black text-zinc-950">常用 Agent</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {(Object.keys(modules) as ModuleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setModule(key);
                  setView('agent');
                }}
                className="rounded-lg border border-zinc-200 p-4 text-left hover:border-zinc-950"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-950 text-white">{modules[key].icon}</div>
                <div className="font-black text-zinc-950">{modules[key].title}</div>
                <div className="mt-1 text-sm leading-6 text-zinc-500">{modules[key].desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-6">
          <h2 className="text-xl font-black text-zinc-950">门店资料</h2>
          <div className="mt-5 space-y-3 text-sm leading-7 text-zinc-600">
            <div><span className="font-black text-zinc-950">门店：</span>{profile.name}</div>
            <div><span className="font-black text-zinc-950">类型：</span>{profile.storeType}</div>
            <div><span className="font-black text-zinc-950">位置：</span>{profile.city}{profile.district}</div>
            <div><span className="font-black text-zinc-950">客单价：</span>{profile.avgPrice} 元</div>
          </div>
          <button onClick={() => setView('profile')} className="mt-5 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-700 hover:border-zinc-950 hover:text-zinc-950">完善门店资料</button>
        </div>
      </div>
    </div>
  );
}

function AgentWorkspace({
  profile,
  docs,
  conversations,
  setConversations,
  module,
  setModule,
  search,
  selectedConversationId,
}: {
  profile: StoreProfile;
  docs: KnowledgeDoc[];
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  module: ModuleKey;
  setModule: React.Dispatch<React.SetStateAction<ModuleKey>>;
  search: string;
  selectedConversationId: string;
}) {
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? '');
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const active = conversations.find((item) => item.id === activeId) ?? conversations[0];
  const messages = active?.messages ?? [];
  const activeDocs = docs.filter((doc) => doc.active && doc.module === module);
  const visibleConversations = conversations.filter((item) => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return true;
    return [item.title, modules[item.module].label, ...item.messages.map((message) => message.content)].join(' ').toLowerCase().includes(keyword);
  });

  useEffect(() => {
    if (!activeId && conversations[0]) setActiveId(conversations[0].id);
  }, [activeId, conversations]);

  useEffect(() => {
    if (selectedConversationId) setActiveId(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function newConversation(nextModule = module) {
    const next: Conversation = {
      id: id('conv'),
      title: `${modules[nextModule].label}新对话`,
      module: nextModule,
      updatedAt: '刚刚',
      messages: [],
    };
    setConversations((current) => [next, ...current]);
    setActiveId(next.id);
    setModule(nextModule);
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  }

  async function send(event?: FormEvent) {
    event?.preventDefault();
    const question = input.trim();
    if (!question || generating) return;

    let conversation = active;
    if (!conversation) {
      conversation = {
        id: id('conv'),
        title: question.slice(0, 24),
        module,
        updatedAt: '刚刚',
        messages: [],
      };
      setActiveId(conversation.id);
      setConversations((current) => [conversation as Conversation, ...current]);
    }

    const conversationId = conversation.id;
    const userMessage: Message = {
      id: id('msg'),
      role: 'user',
      module,
      content: question,
      attachments,
      createdAt: nowLabel(),
    };
    const assistantId = id('msg');
    const assistantMessage: Message = {
      id: assistantId,
      role: 'assistant',
      module,
      content: '',
      createdAt: nowLabel(),
    };

    setConversations((current) =>
      current.map((item) =>
        item.id === conversationId
          ? {
              ...item,
              title: item.messages.length ? item.title : question.slice(0, 24),
              module,
              updatedAt: '刚刚',
              messages: [...item.messages, userMessage, assistantMessage],
            }
          : item,
      ),
    );
    setInput('');
    setAttachments([]);
    setGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await apiRequestWithSignal<{ content: string }>('/agent/chat', {
        question,
        module,
        profile,
        docs: activeDocs,
        messages: messages.slice(-8),
      }, controller.signal);
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                messages: item.messages.map((message) => (message.id === assistantId ? { ...message, content: result.content } : message)),
              }
            : item,
        ),
      );
    } catch (err) {
      const content = err instanceof DOMException && err.name === 'AbortError' ? '已停止本次生成。' : err instanceof Error ? `API 调用失败：${err.message}` : 'API 调用失败，请检查后端配置。';
      setConversations((current) =>
        current.map((item) =>
          item.id === conversationId
            ? {
                ...item,
                messages: item.messages.map((message) => (message.id === assistantId ? { ...message, content } : message)),
              }
            : item,
        ),
      );
    } finally {
      abortRef.current = null;
      setGenerating(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-64px)] grid-cols-[340px_minmax(0,1fr)] overflow-hidden bg-white">
      <aside className="border-r border-zinc-200 bg-zinc-50">
        <div className="border-b border-zinc-200 p-5">
          <button onClick={() => newConversation()} className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 font-black text-white">
            <Plus className="h-5 w-5" />
            新建对话
          </button>
        </div>
        <div className="app-scrollbar h-[calc(100vh-145px)] overflow-y-scroll p-4">
          {visibleConversations.length === 0 && <div className="rounded-lg border border-dashed border-zinc-300 p-5 text-sm text-zinc-500">没有匹配的对话。</div>}
          {visibleConversations.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveId(item.id);
                setModule(item.module);
              }}
              className={`mb-3 w-full rounded-lg border p-4 text-left ${activeId === item.id ? 'border-zinc-950 bg-white shadow-sm' : 'border-transparent hover:bg-white'}`}
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-black text-zinc-500">{modules[item.module].label}</span>
                <span className="text-xs font-bold text-zinc-400">{item.updatedAt}</span>
              </div>
              <div className="truncate font-black text-zinc-950">{item.title}</div>
              <div className="mt-2 truncate text-sm text-zinc-500">{item.messages.at(-1)?.content || '还没有消息'}</div>
            </button>
          ))}
        </div>
      </aside>

      <main className="relative flex min-w-0 min-h-0 flex-col bg-zinc-50">
        <div className="border-b border-zinc-200 bg-white px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="text-zinc-950">{modules[module].icon}</div>
                <h1 className="text-2xl font-black text-zinc-950">{modules[module].title}</h1>
              </div>
              <p className="mt-1 text-sm text-zinc-500">{modules[module].desc}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(modules) as ModuleKey[]).map((key) => (
                <button key={key} onClick={() => (active?.messages.length ? newConversation(key) : setModule(key))} className={`rounded-lg border px-4 py-3 text-sm font-black ${moduleClasses(module === key)}`}>
                  {modules[key].label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="app-scrollbar min-h-0 flex-1 overflow-y-scroll px-6 py-8 pb-64">
          <div className="mx-auto max-w-4xl space-y-5">
            {messages.length === 0 ? (
              <div className="rounded-lg border border-zinc-200 bg-white p-6">
                <div className="mb-4 inline-flex rounded-lg bg-zinc-950 p-3 text-white">
                  <Sparkles className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-black text-zinc-950">问一个具体问题</h2>
                <p className="mt-2 text-sm text-zinc-500">Agent 会结合门店资料和启用知识库，并按当前板块输出结构化方案。</p>
                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {starterPrompts[module].map((prompt) => (
                    <button key={prompt} onClick={() => setInput(prompt)} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-left text-sm font-bold leading-6 text-zinc-700 hover:border-zinc-950 hover:bg-white">
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {message.role === 'assistant' && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}
                  <div className={`max-w-[760px] rounded-lg border p-5 shadow-sm ${message.role === 'user' ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 bg-white text-zinc-800'}`}>
                    <div className="mb-3 flex items-center justify-between gap-8">
                      <span className={`text-sm font-black ${message.role === 'user' ? 'text-zinc-300' : 'text-zinc-950'}`}>{message.role === 'user' ? '你' : modules[message.module].title}</span>
                      <span className="text-xs text-zinc-400">{message.createdAt}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7">{message.content || '正在调用 Agent API...'}</pre>
                    {message.attachments?.length ? <div className="mt-3 text-xs font-bold text-zinc-400">附件：{message.attachments.join('、')}</div> : null}
                    {message.role === 'assistant' && message.content && (
                      <button onClick={() => navigator.clipboard?.writeText(message.content)} className="mt-4 inline-flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-black text-zinc-500 hover:text-zinc-950">
                        <Copy className="h-4 w-4" />
                        复制
                      </button>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-white">
                      <UserRound className="h-5 w-5" />
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <form onSubmit={send} className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 p-5 backdrop-blur md:left-[340px]">
          <div className="mx-auto max-w-4xl rounded-lg border border-zinc-200 bg-white p-4 shadow-lg">
            {attachments.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <span key={file} className="inline-flex items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-600">
                    <Paperclip className="h-4 w-4" />
                    {file}
                    <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item !== file))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
              className="h-24 w-full resize-none p-3 text-sm outline-none"
              placeholder="描述你的问题，例如：帮我做一个适合写字楼人群的 9.9 元团购套餐..."
            />
            <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
              <div className="flex items-center gap-3 text-zinc-400">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    const files = event.currentTarget.files;
                    const names = files
                      ? Array.from({ length: Math.min(files.length, 3) }, (_, index) => files.item(index)?.name).filter(
                          (name): name is string => Boolean(name),
                        )
                      : [];
                    setAttachments(names);
                  }}
                />
                <button type="button" onClick={() => fileRef.current?.click()} className="p-2 hover:text-zinc-950" title="添加附件">
                  <Paperclip className="h-5 w-5" />
                </button>
                <span className="text-sm font-bold">最多 3 个附件，当前为文件名随消息保存</span>
              </div>
              {generating ? (
                <button type="button" onClick={stop} className="flex items-center gap-2 rounded-lg bg-zinc-950 px-5 py-3 font-black text-white">
                  <PauseCircle className="h-5 w-5" />
                  停止
                </button>
              ) : (
                <button disabled={!input.trim()} className="flex items-center gap-2 rounded-lg bg-zinc-950 px-5 py-3 font-black text-white disabled:bg-zinc-300">
                  <Send className="h-5 w-5" />
                  发送
                </button>
              )}
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function ProfilePage({ profile, setProfile }: { profile: StoreProfile; setProfile: React.Dispatch<React.SetStateAction<StoreProfile>> }) {
  const fields: Array<[keyof StoreProfile, string, string]> = [
    ['name', '门店名称', '例如：锋芒私教工作室'],
    ['storeType', '门店类型', '例如：精品私教工作室'],
    ['city', '城市', '例如：杭州'],
    ['district', '区县', '例如：滨江区'],
    ['audience', '目标客群', '描述目标用户'],
    ['goal', '业务目标', '描述当前目标'],
  ];

  return (
    <div className="p-6">
      <div className="rounded-lg border border-zinc-200 bg-white p-6">
        <h1 className="text-3xl font-black text-zinc-950">门店资料</h1>
        <p className="mt-2 text-zinc-500">这些资料会作为 Agent 的默认上下文。</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {fields.map(([key, label, placeholder]) => (
            <label key={key} className={key === 'audience' || key === 'goal' ? 'md:col-span-2' : ''}>
              <span className="mb-2 block text-sm font-bold text-zinc-700">{label}</span>
              {key === 'audience' || key === 'goal' ? (
                <textarea value={String(profile[key])} onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))} className="h-28 w-full resize-none rounded-lg border border-zinc-200 p-4 outline-none focus:border-zinc-950" placeholder={placeholder} />
              ) : (
                <input value={String(profile[key])} onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))} className="h-12 w-full rounded-lg border border-zinc-200 px-4 outline-none focus:border-zinc-950" placeholder={placeholder} />
              )}
            </label>
          ))}
          <label>
            <span className="mb-2 block text-sm font-bold text-zinc-700">平均客单价</span>
            <input value={profile.avgPrice} onChange={(event) => setProfile((current) => ({ ...current, avgPrice: Number(event.target.value) }))} type="number" className="h-12 w-full rounded-lg border border-zinc-200 px-4 outline-none focus:border-zinc-950" />
          </label>
        </div>
      </div>
    </div>
  );
}

function HistoryPage({ conversations, openConversation, search }: { conversations: Conversation[]; openConversation: (id: string, module: ModuleKey) => void; search: string }) {
  const keyword = search.trim().toLowerCase();
  const visible = conversations.filter((conversation) => !keyword || [conversation.title, modules[conversation.module].label, ...conversation.messages.map((message) => message.content)].join(' ').toLowerCase().includes(keyword));
  return (
    <div className="p-6">
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="border-b border-zinc-200 p-6">
          <h1 className="text-3xl font-black text-zinc-950">历史记录</h1>
          <p className="mt-2 text-zinc-500">所有 Agent 对话会保存在这里。</p>
        </div>
        {visible.length === 0 ? (
          <div className="p-10 text-center text-zinc-500">暂无历史记录。</div>
        ) : (
          visible.map((conversation) => (
            <button key={conversation.id} onClick={() => openConversation(conversation.id, conversation.module)} className="flex w-full items-center justify-between border-b border-zinc-100 p-5 text-left last:border-0 hover:bg-zinc-50">
              <div>
                <div className="text-lg font-black text-zinc-950">{conversation.title}</div>
                <div className="mt-1 text-sm text-zinc-500">{modules[conversation.module].label} · {conversation.updatedAt}</div>
              </div>
              <Clock3 className="h-5 w-5 text-zinc-300" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function StaffHome({ conversations }: { conversations: Conversation[] }) {
  const [stats, setStats] = useState<{ users: number; userAccounts: number; staffAccounts: number; activeSessions: number } | null>(null);
  const [error, setError] = useState('');

  async function loadStats() {
    setError('');
    try {
      setStats(await apiRequest<{ users: number; userAccounts: number; staffAccounts: number; activeSessions: number }>('/admin/stats'));
    } catch (err) {
      setError(err instanceof Error ? err.message : '统计接口请求失败');
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-6">
        <div>
          <h1 className="text-3xl font-black text-zinc-950">工作者后台</h1>
          <p className="mt-2 text-zinc-500">这里展示真实后端账号统计和本机对话记录。</p>
        </div>
        <button onClick={loadStats} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-600 hover:border-zinc-950 hover:text-zinc-950">
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div>}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="注册账号" value={String(stats?.users ?? 0)} icon={<Users className="h-5 w-5" />} />
        <StatCard label="用户账号" value={String(stats?.userAccounts ?? 0)} icon={<UserRound className="h-5 w-5" />} />
        <StatCard label="工作者账号" value={String(stats?.staffAccounts ?? 0)} icon={<ShieldCheck className="h-5 w-5" />} />
        <StatCard label="本机对话" value={String(conversations.length)} icon={<MessageSquare className="h-5 w-5" />} />
      </div>
    </div>
  );
}

function KnowledgePage({ docs, setDocs }: { docs: KnowledgeDoc[]; setDocs: React.Dispatch<React.SetStateAction<KnowledgeDoc[]>> }) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const nextDocs = Array.from({ length: files.length }, (_, index) => files.item(index)).filter(
      (file): file is File => Boolean(file),
    ).map((file) => ({
      id: id('doc'),
      title: file.name,
      category: '上传资料',
      module: 'groupbuy' as ModuleKey,
      active: true,
      calls: 0,
    }));
    setDocs((current) => [...nextDocs, ...current]);
  }

  return (
    <div className="p-6">
      <div className="rounded-lg border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-200 p-6">
          <div>
            <h1 className="text-3xl font-black text-zinc-950">知识库</h1>
            <p className="mt-2 text-zinc-500">启用的资料会传给 Agent API 作为上下文摘要。</p>
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.currentTarget.files)} />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-lg bg-zinc-950 px-5 py-3 font-black text-white">
            <Upload className="h-5 w-5" />
            上传资料
          </button>
        </div>
        <div className="divide-y divide-zinc-100">
          {docs.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className="font-black text-zinc-950">{doc.title}</div>
                <div className="mt-1 text-sm text-zinc-500">{doc.category} · {modules[doc.module].label} · 调用 {doc.calls} 次</div>
              </div>
              <div className="flex items-center gap-2">
                {(Object.keys(modules) as ModuleKey[]).map((key) => (
                  <button key={key} onClick={() => setDocs((current) => current.map((item) => (item.id === doc.id ? { ...item, module: key } : item)))} className={`rounded-md border px-3 py-2 text-xs font-black ${doc.module === key ? 'border-zinc-950 bg-zinc-950 text-white' : 'border-zinc-200 text-zinc-500'}`}>
                    {modules[key].label}
                  </button>
                ))}
                <button onClick={() => setDocs((current) => current.map((item) => (item.id === doc.id ? { ...item, active: !item.active } : item)))} className={`rounded-lg px-4 py-3 text-sm font-black ${doc.active ? 'bg-zinc-950 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                  {doc.active ? '已启用' : '未启用'}
                </button>
                <button onClick={() => setDocs((current) => current.filter((item) => item.id !== doc.id))} className="rounded-lg border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-500 hover:border-red-300 hover:text-red-600">
                  删除
                </button>
              </div>
            </div>
          ))}
          {docs.length === 0 && <div className="p-10 text-center text-zinc-500">暂无知识库资料。</div>}
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const [role] = useState<AppRole>(getPortalRole);
  const [fatalError, setFatalError] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => readStorage<AuthUser | null>(`fitness_user_${getPortalRole()}`, null));
  const [view, setView] = useState<View>(() => (getPortalRole() === 'staff' ? 'staffHome' : 'home'));
  const [module, setModule] = useState<ModuleKey>('groupbuy');
  const [search, setSearch] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [profile, setProfile] = useState<StoreProfile>(() => readStorage('fitness_profile', defaultProfile));
  const [docs, setDocs] = useState<KnowledgeDoc[]>(() =>
    readStorage('fitness_docs', [
      { id: 'doc_1', title: '团购套餐设计方法', category: '运营方法', module: 'groupbuy', active: true, calls: 0 },
      { id: 'doc_2', title: '短视频脚本结构', category: '内容模板', module: 'video', active: true, calls: 0 },
      { id: 'doc_3', title: '私教体验课承接 SOP', category: '转化流程', module: 'product', active: true, calls: 0 },
    ]),
  );
  const [conversations, setConversations] = useState<Conversation[]>(() => readStorage('fitness_conversations', []));

  useEffect(() => {
    localStorage.setItem('fitness_profile', JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem('fitness_docs', JSON.stringify(docs));
  }, [docs]);

  useEffect(() => {
    localStorage.setItem('fitness_conversations', JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    const handleError = () => setFatalError(true);
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleError);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleError);
    };
  }, []);

  if (fatalError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-100 p-6">
        <div className="w-full max-w-lg rounded-xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-black text-zinc-950">页面加载失败</h1>
          <p className="mt-3 text-sm leading-7 text-zinc-500">
            可能是旧缓存数据或页面状态异常。清理本地缓存后会重新打开当前入口。
          </p>
          <button
            onClick={() => {
              resetAppStorage();
              window.location.href = role === 'staff' ? '/staff' : '/user';
            }}
            className="mt-6 rounded-lg bg-zinc-950 px-5 py-3 font-black text-white"
          >
            清理缓存并重新进入
          </button>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage role={role} onAuthed={setUser} />;

  const effectiveRole = user.role === role ? role : user.role;

  function logout() {
    localStorage.removeItem(`fitness_user_${role}`);
    setUser(null);
  }

  function openConversation(nextId: string, nextModule: ModuleKey) {
    setSelectedConversationId(nextId);
    setModule(nextModule);
    setView('agent');
  }

  const content = (() => {
    if (effectiveRole === 'staff') {
      if (view === 'knowledge') return <KnowledgePage docs={docs} setDocs={setDocs} />;
      if (view === 'records') return <HistoryPage conversations={conversations} openConversation={openConversation} search={search} />;
      return <StaffHome conversations={conversations} />;
    }
    if (view === 'agent') return <AgentWorkspace profile={profile} docs={docs} conversations={conversations} setConversations={setConversations} module={module} setModule={setModule} search={search} selectedConversationId={selectedConversationId} />;
    if (view === 'history') return <HistoryPage conversations={conversations} openConversation={openConversation} search={search} />;
    if (view === 'profile') return <ProfilePage profile={profile} setProfile={setProfile} />;
    return <Home profile={profile} docs={docs} conversations={conversations} setView={setView} setModule={setModule} />;
  })();

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-950">
      <TopBar role={effectiveRole} user={user} setView={setView} onLogout={logout} search={search} setSearch={setSearch} />
      <div className="flex">
        <Sidebar role={effectiveRole} view={view} setView={setView} />
        <main className="min-w-0 flex-1">{content}</main>
      </div>
    </div>
  );
}

function App() {
  return <AppShell />;
}

export default App;
