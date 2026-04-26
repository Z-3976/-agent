import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Bot,
  Building2,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Copy,
  Database,
  Dumbbell,
  FileText,
  History,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Mic,
  Monitor,
  Moon,
  MoreHorizontal,
  Package,
  Paperclip,
  PauseCircle,
  PencilLine,
  Plus,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Target,
  Upload,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';

type AppRole = 'user' | 'staff';
type View = 'home' | 'ai' | 'history' | 'profile' | 'staffHome' | 'knowledge' | 'records';
type ModuleKey = 'groupbuy' | 'video' | 'live' | 'product';
type MessageRole = 'user' | 'assistant';
type ThemeMode = 'light' | 'dark' | 'system';

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
  accountType?: 'phone' | 'email';
  createdAt?: string;
};

type AdminUserAccount = {
  id: string;
  account: string;
  name: string;
  createdAt: string;
  passwordStored: boolean;
};

type SpeechRecognitionCtor = new () => {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

const modules: Record<ModuleKey, { label: string; title: string; desc: string; icon: React.ReactNode }> = {
  groupbuy: {
    label: '团购',
    title: '团购运营 AI',
    desc: '门店诊断、套餐设计、上架表达和私域承接。',
    icon: <Target className="h-5 w-5" />,
  },
  video: {
    label: '短视频',
    title: '短视频内容 AI',
    desc: '输出选题、脚本、标题、封面文案和发布节奏。',
    icon: <Video className="h-5 w-5" />,
  },
  live: {
    label: '直播',
    title: '直播转化 AI',
    desc: '设计留人、互动、福利节奏和成交话术。',
    icon: <Radio className="h-5 w-5" />,
  },
  product: {
    label: '门店运营',
    title: '门店运营 AI',
    desc: '梳理人员架构、薪资定价、健身房模式和经营策略。',
    icon: <Package className="h-5 w-5" />,
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
  groupbuy: ['帮我做一个适合写字楼人群的 9.9 元团购套餐', '我的团购浏览多但转化少，帮我诊断', '设计团购购买后的私域承接 SOP'],
  video: ['给我写一个短视频脚本', '生成 7 天短视频选题', '把门店案例改成抖音脚本'],
  live: ['设计一场 60 分钟直播流程', '写直播开场 3 分钟留人话术', '用户说没时间训练怎么成交'],
  product: ['帮我梳理一套门店人员架构', '设计适合当前门店的薪资和提成模型', '分析健身房模式并给出运营优化建议'],
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

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

function getResolvedTheme(mode: ThemeMode, systemDark: boolean) {
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

function useSystemDark() {
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  return systemDark;
}

function useClickGlow() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const spark = document.createElement('span');
      spark.className = 'click-spark';
      spark.style.left = `${event.clientX}px`;
      spark.style.top = `${event.clientY}px`;
      document.body.appendChild(spark);
      window.setTimeout(() => spark.remove(), 450);
    }

    window.addEventListener('click', handleClick, true);
    return () => window.removeEventListener('click', handleClick, true);
  }, []);
}

function useThemeTokens(isDark: boolean) {
  return useMemo(
    () => ({
      page: isDark ? 'bg-zinc-950 text-zinc-100' : 'bg-[#f5f7fb] text-zinc-950',
      surface: isDark ? 'border-zinc-800 bg-zinc-900 text-zinc-100' : 'border-zinc-200 bg-white text-zinc-950',
      surfaceAlt: isDark ? 'border-zinc-800 bg-zinc-950/60' : 'border-zinc-200 bg-[#f8fafc]',
      muted: isDark ? 'text-zinc-400' : 'text-zinc-500',
      strong: isDark ? 'text-zinc-50' : 'text-zinc-950',
      soft: isDark ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500',
      input: isDark
        ? 'border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600'
        : 'border-zinc-200 bg-[#eef3fb] text-zinc-950 placeholder:text-zinc-400 focus:border-zinc-950',
      accent: 'bg-zinc-950 text-white',
      ghost: isDark ? 'border-zinc-800 text-zinc-300 hover:border-zinc-700 hover:bg-zinc-800' : 'border-zinc-200 text-zinc-600 hover:border-zinc-950 hover:bg-white hover:text-zinc-950',
      nav: isDark ? 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100' : 'text-zinc-500 hover:bg-white hover:text-zinc-950',
      navActive: isDark ? 'bg-white text-zinc-950' : 'bg-zinc-950 text-white',
      bubbleUser: 'border-zinc-950 bg-zinc-950 text-white',
      bubbleAi: isDark ? 'border-zinc-800 bg-zinc-900 text-zinc-100' : 'border-zinc-200 bg-white text-zinc-800',
    }),
    [isDark],
  );
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

function AuthPage({
  role,
  onAuthed,
  ui,
}: {
  role: AppRole;
  onAuthed: (user: AuthUser) => void;
  ui: ReturnType<typeof useThemeTokens>;
}) {
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
    <div className={cx('min-h-screen p-6', ui.page)}>
      <div className={cx('mx-auto grid min-h-[calc(100vh-48px)] max-w-7xl overflow-hidden rounded-[28px] border shadow-[0_24px_80px_rgba(15,23,42,0.08)] lg:grid-cols-[1.08fr_0.92fr]', ui.surface)}>
        <section className="relative overflow-hidden bg-zinc-950 p-8 text-white">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_38%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.22),transparent_34%)]" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-zinc-950 shadow-sm">
                <Dumbbell className="h-8 w-8" />
              </div>
              <div className="mt-8">
                <div className="text-sm font-bold uppercase tracking-[0.24em] text-zinc-400">AI Fitness Ops</div>
                <h1 className="mt-4 text-4xl font-black leading-tight">AI健身房运营助手</h1>
                <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-300">
                  把门店资料、知识库和 AI 对话连接起来，生成真正可落地的团购、短视频、直播和门店运营方案。
                </p>
              </div>
            </div>
            <div className="grid gap-3 text-sm text-zinc-300 md:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <ShieldCheck className="mb-3 h-5 w-5" />
                密码注册与登录
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <Users className="mb-3 h-5 w-5" />
                用户端与工作者端分离
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <Sparkles className="mb-3 h-5 w-5" />
                后端 AI 接口接入
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center p-8 lg:p-10">
          <form onSubmit={submit} className="w-full">
            <div className="mb-8">
              <div className={cx('text-sm font-bold', ui.muted)}>{role === 'staff' ? '工作者入口' : '用户门户'}</div>
              <h2 className={cx('mt-2 text-3xl font-black', ui.strong)}>{roleTitle}</h2>
            </div>
            <div className={cx('mb-6 grid grid-cols-2 rounded-2xl p-1', ui.surfaceAlt)}>
              <button type="button" onClick={() => setMode('login')} className={cx('rounded-[14px] py-3 text-sm font-black transition-all', mode === 'login' ? 'bg-white text-zinc-950 shadow-sm' : ui.muted)}>
                登录
              </button>
              <button type="button" onClick={() => setMode('register')} className={cx('rounded-[14px] py-3 text-sm font-black transition-all', mode === 'register' ? 'bg-white text-zinc-950 shadow-sm' : ui.muted)}>
                注册
              </button>
            </div>
            <div className="space-y-4">
              {mode === 'register' && (
                <label className="block">
                  <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>名称</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)} placeholder="门店名或你的名称" />
                </label>
              )}
              <label className="block">
                <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>手机号 / 邮箱</span>
                <input value={account} onChange={(event) => setAccount(event.target.value)} className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)} placeholder="手机号或邮箱" />
              </label>
              <label className="block">
                <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>密码</span>
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)} placeholder="至少 6 位，包含英文和数字" />
              </label>
              {mode === 'register' && (
                <label className="block">
                  <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>再次输入密码</span>
                  <input value={passwordConfirm} onChange={(event) => setPasswordConfirm(event.target.value)} type="password" className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)} placeholder="确认密码" />
                </label>
              )}
            </div>
            {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-600">{error}</div>}
            <button disabled={loading} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 font-black text-white disabled:bg-zinc-400">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              {mode === 'register' ? '注册并进入' : '登录'}
            </button>
            <div className="mt-5 flex justify-between text-sm">
              <a className={cx('font-bold transition-colors', ui.muted, 'hover:text-zinc-950')} href={role === 'staff' ? '/user' : '/staff'}>
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
  onLogout,
  onOpenAccount,
  view,
  setView,
  module,
  setModule,
  conversations,
  onOpenConversation,
  onNewConversation,
  themeMode,
  setThemeMode,
  ui,
}: {
  role: AppRole;
  onLogout: () => void;
  onOpenAccount: () => void;
  view: View;
  setView: (view: View) => void;
  module: ModuleKey;
  setModule: React.Dispatch<React.SetStateAction<ModuleKey>>;
  conversations: Conversation[];
  onOpenConversation: (id: string, module: ModuleKey) => void;
  onNewConversation: () => void;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  ui: ReturnType<typeof useThemeTokens>;
}) {
  const [themeOpen, setThemeOpen] = useState(false);
  const [mobileModuleOpen, setMobileModuleOpen] = useState(false);
  const [mobileHeaderOpen, setMobileHeaderOpen] = useState(false);
  const themeLabel = themeMode === 'light' ? '浅色模式' : themeMode === 'dark' ? '深色模式' : '跟随系统';

  const themeOptions: Array<{ key: ThemeMode; label: string; icon: React.ReactNode }> = [
    { key: 'light', label: '浅色模式', icon: <Sun className="h-5 w-5" /> },
    { key: 'dark', label: '深色模式', icon: <Moon className="h-5 w-5" /> },
    { key: 'system', label: '跟随系统', icon: <Monitor className="h-5 w-5" /> },
  ];
  const recentConversations = conversations.slice(0, 5);

  return (
    <header className={cx('sticky top-0 z-40 border-b px-4 py-3 backdrop-blur-xl md:px-5 md:py-4', ui.surface)}>
      <div className="hidden items-center gap-4 md:flex">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
            <Dumbbell className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <div className={cx('truncate text-[17px] font-black', ui.strong)}>AI健身房运营助手</div>
            <div className={cx('truncate text-[12px] font-bold', ui.muted)}>{role === 'staff' ? '工作者后台 · 运营管理端' : '用户后台 · 门店使用端'}</div>
          </div>
        </div>
        {role === 'user' ? (
          <div className="mx-auto w-full max-w-[500px]">
            <div className="grid grid-cols-4 gap-3">
              {(Object.keys(modules) as ModuleKey[]).map((key) => (
                <div key={key} className="group relative">
                  <button
                    onClick={() => {
                      setModule(key);
                      setView('ai');
                    }}
                    className={cx(
                      'w-full rounded-full border px-0 py-2.5 text-center text-[13px] font-black transition-all',
                      view === 'ai' && module === key ? 'border-zinc-950 bg-zinc-950 text-white' : ui.ghost,
                    )}
                  >
                    {modules[key].label}
                  </button>
                  <div className={cx('pointer-events-none absolute left-1/2 top-[calc(100%+10px)] z-50 hidden w-44 -translate-x-1/2 rounded-2xl border px-3 py-2 text-center text-[12px] leading-5 shadow-xl group-hover:block', ui.surface)}>
                    {modules[key].desc}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : <div className="mx-auto" />}
        <div className="ml-auto flex items-center gap-2">
          <button className={cx('flex h-12 w-12 items-center justify-center rounded-full border transition-all', ui.ghost)} title="提醒">
            <Bell className="h-5 w-5" />
          </button>
          <div className="relative">
            <button onClick={() => setThemeOpen((current) => !current)} className={cx('flex h-12 items-center gap-2 rounded-full border px-4 transition-all', ui.ghost)} title={themeLabel}>
              {themeMode === 'dark' ? <Moon className="h-5 w-5" /> : themeMode === 'system' ? <Monitor className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              <ChevronDown className="h-4 w-4" />
            </button>
            {themeOpen && (
              <div className={cx('absolute right-0 top-14 w-56 rounded-3xl border p-2 shadow-2xl', ui.surface)}>
                {themeOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setThemeMode(option.key);
                      setThemeOpen(false);
                    }}
                    className={cx('flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all', themeMode === option.key ? 'bg-indigo-50 text-indigo-600' : ui.nav)}
                  >
                    <span className="flex items-center gap-3">
                      {option.icon}
                      {option.label}
                    </span>
                    {themeMode === option.key ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={onLogout} className={cx('flex h-12 items-center gap-2 rounded-full border px-4 text-sm font-black transition-all', ui.ghost)}>
            <LogOut className="h-4 w-4" />
            退出
          </button>
        </div>
      </div>

      <div className="md:hidden">
        <div className="flex items-center justify-between gap-3">
          {role === 'user' ? (
            <button onClick={() => setMobileModuleOpen((current) => !current)} className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all', ui.ghost)}>
              <Menu className="h-5 w-5" />
            </button>
          ) : (
            <div className="h-11 w-11 shrink-0" />
          )}
          <button onClick={() => setMobileHeaderOpen((current) => !current)} className="min-w-0 flex-1 text-center">
            <div className={cx('truncate text-[18px] font-black', ui.strong)}>AI健身房运营助手</div>
            <div className={cx('truncate text-[11px] font-bold', ui.muted)}>{role === 'staff' ? '工作者端' : '用户端'}</div>
          </button>
          <button onClick={() => setMobileHeaderOpen((current) => !current)} className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition-all', ui.ghost)}>
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        {role === 'user' ? (
          <div
            className={cx(
              'overflow-hidden transition-all duration-300 ease-out',
              mobileModuleOpen ? 'mt-3 max-h-[520px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none',
            )}
          >
            <div className={cx('rounded-[24px] border p-3 shadow-sm', ui.surface)}>
              <button
                onClick={() => {
                  onNewConversation();
                  setMobileModuleOpen(false);
                }}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-black text-white"
              >
                <Plus className="h-4 w-4" />
                新建对话
              </button>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(Object.keys(modules) as ModuleKey[]).map((key) => (
                  <button
                    key={key}
                    onClick={() => {
                      setModule(key);
                      setView('ai');
                      setMobileModuleOpen(false);
                    }}
                    title={modules[key].desc}
                    className={cx(
                      'rounded-full border px-0 py-2.5 text-center text-[13px] font-black transition-all',
                      view === 'ai' && module === key ? 'border-zinc-950 bg-zinc-950 text-white' : ui.ghost,
                    )}
                  >
                    {modules[key].label}
                  </button>
                ))}
              </div>
              <div className="mt-4 border-t pt-3">
                <div className={cx('mb-2 text-[12px] font-bold uppercase tracking-[0.18em]', ui.muted)}>最近对话</div>
                <div className="space-y-2">
                  {recentConversations.length === 0 ? (
                    <div className={cx('rounded-[18px] border border-dashed px-4 py-3 text-sm', ui.muted)}>还没有历史记录</div>
                  ) : (
                    recentConversations.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => {
                          onOpenConversation(item.id, item.module);
                          setMobileModuleOpen(false);
                        }}
                        className={cx('w-full rounded-[18px] border px-4 py-3 text-left transition-all', ui.surfaceAlt)}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className={cx('rounded-full px-3 py-1 text-[11px] font-black', ui.soft)}>{modules[item.module].label}</span>
                          <span className={cx('text-[11px] font-bold', ui.muted)}>{item.updatedAt}</span>
                        </div>
                        <div className={cx('mt-2 truncate text-sm font-black', ui.strong)}>{item.title}</div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div
          className={cx(
            'overflow-hidden transition-all duration-300 ease-out',
            mobileHeaderOpen ? 'mt-3 max-h-[420px] opacity-100 translate-y-0' : 'max-h-0 opacity-0 -translate-y-2 pointer-events-none',
          )}
        >
          <div className={cx('rounded-[24px] border p-3 shadow-sm', ui.surface)}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                <Dumbbell className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className={cx('truncate text-[15px] font-black', ui.strong)}>AI健身房运营助手</div>
                <div className={cx('truncate text-[11px] font-bold', ui.muted)}>{role === 'staff' ? '工作者后台 · 运营管理端' : '用户后台 · 门店使用端'}</div>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button className={cx('flex h-11 items-center justify-center rounded-full border transition-all', ui.ghost)}>
                <Bell className="h-5 w-5" />
              </button>
              <button onClick={() => setThemeOpen((current) => !current)} className={cx('flex h-11 items-center justify-center gap-2 rounded-full border transition-all', ui.ghost)}>
                {themeMode === 'dark' ? <Moon className="h-5 w-5" /> : themeMode === 'system' ? <Monitor className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                <ChevronDown className="h-4 w-4" />
              </button>
              <button onClick={onOpenAccount} className={cx('flex h-11 items-center justify-center gap-2 rounded-full border text-sm font-black transition-all', ui.ghost)}>
                <Settings2 className="h-4 w-4" />
                设置
              </button>
              <button onClick={onLogout} className={cx('flex h-11 items-center justify-center gap-2 rounded-full border text-sm font-black transition-all', ui.ghost)}>
                <LogOut className="h-4 w-4" />
                退出
              </button>
            </div>
            <div
              className={cx(
                'overflow-hidden transition-all duration-300 ease-out',
                themeOpen ? 'mt-3 max-h-64 opacity-100' : 'max-h-0 opacity-0 pointer-events-none',
              )}
            >
              <div className={cx('rounded-[20px] border p-2', ui.surfaceAlt)}>
                {themeOptions.map((option) => (
                  <button
                    key={option.key}
                    onClick={() => {
                      setThemeMode(option.key);
                      setThemeOpen(false);
                    }}
                    className={cx('flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left text-sm font-bold transition-all', themeMode === option.key ? 'bg-indigo-50 text-indigo-600' : ui.nav)}
                  >
                    <span className="flex items-center gap-3">
                      {option.icon}
                      {option.label}
                    </span>
                    {themeMode === option.key ? <CheckCircle2 className="h-4 w-4" /> : null}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

function Sidebar({
  role,
  user,
  view,
  setView,
  onOpenAccount,
  ui,
}: {
  role: AppRole;
  user: AuthUser;
  view: View;
  setView: (view: View) => void;
  onOpenAccount: () => void;
  ui: ReturnType<typeof useThemeTokens>;
}) {
  const items =
    role === 'staff'
      ? [
          { key: 'staffHome' as View, label: '工作台', icon: <LayoutDashboard className="h-5 w-5" /> },
          { key: 'knowledge' as View, label: '知识库', icon: <Database className="h-5 w-5" /> },
          { key: 'records' as View, label: '对话记录', icon: <FileText className="h-5 w-5" /> },
        ]
      : [
          { key: 'home' as View, label: '用户首页', icon: <LayoutDashboard className="h-5 w-5" /> },
          { key: 'ai' as View, label: 'AI 对话', icon: <Bot className="h-5 w-5" /> },
          { key: 'history' as View, label: '我的历史', icon: <History className="h-5 w-5" /> },
          { key: 'profile' as View, label: '门店资料', icon: <Building2 className="h-5 w-5" /> },
        ];

  return (
    <aside className={cx(role === 'user' && view === 'ai' ? 'hidden' : 'hidden h-[calc(100vh-96px)] w-[208px] shrink-0 border-r xl:flex xl:flex-col', ui.surface)}>
      <nav className="space-y-1.5 px-3 pt-4 pb-4">
        {items.map((item) => (
          <button
            key={item.key}
            onClick={() => setView(item.key)}
            className={cx('flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-black transition-all', view === item.key ? ui.navActive : ui.nav)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </nav>
      <div className="mt-auto p-3">
        <button onClick={onOpenAccount} className={cx('flex w-full items-center gap-3 rounded-[20px] border px-3 py-3 transition-all', ui.ghost)}>
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-white">
            {(user.name || user.account).slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 text-left">
            <div className={cx('truncate text-sm font-black', ui.strong)}>{user.name || '未命名用户'}</div>
            <div className={cx('truncate text-xs', ui.muted)}>{user.account}</div>
          </div>
        </button>
      </div>
    </aside>
  );
}

function StatCard({
  label,
  value,
  icon,
  ui,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  ui: ReturnType<typeof useThemeTokens>;
}) {
  return (
    <div className={cx('rounded-[24px] border p-5 shadow-sm', ui.surface)}>
      <div className="flex items-center justify-between">
        <div className={cx('text-sm font-bold', ui.muted)}>{label}</div>
        <div className={ui.muted}>{icon}</div>
      </div>
      <div className={cx('mt-4 text-3xl font-black', ui.strong)}>{value}</div>
    </div>
  );
}

function Home({
  profile,
  docs,
  conversations,
  setView,
  setModule,
  ui,
}: {
  profile: StoreProfile;
  docs: KnowledgeDoc[];
  conversations: Conversation[];
  setView: (view: View) => void;
  setModule: (module: ModuleKey) => void;
  ui: ReturnType<typeof useThemeTokens>;
}) {
  const aiCount = conversations.flatMap((item) => item.messages).filter((message) => message.role === 'assistant' && message.content).length;

  return (
    <div className="space-y-5 p-5">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard label="历史对话" value={String(conversations.length)} icon={<MessageSquare className="h-5 w-5" />} ui={ui} />
        <StatCard label="启用资料" value={String(docs.filter((doc) => doc.active).length)} icon={<Database className="h-5 w-5" />} ui={ui} />
        <StatCard label="本周输出" value={String(aiCount)} icon={<Sparkles className="h-5 w-5" />} ui={ui} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <section className={cx('rounded-[28px] border p-6 shadow-sm', ui.surface)}>
          <div className="flex items-center justify-between">
            <h2 className={cx('text-xl font-black', ui.strong)}>常用 AI 模块</h2>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {(Object.keys(modules) as ModuleKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  setModule(key);
                  setView('ai');
                }}
                className={cx('group rounded-[24px] border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg', ui.surfaceAlt)}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                  {modules[key].icon}
                </div>
                <div className={cx('font-black', ui.strong)}>{modules[key].title}</div>
                <div className={cx('mt-2 text-sm leading-6', ui.muted)}>{modules[key].desc}</div>
              </button>
            ))}
          </div>
        </section>

        <section className={cx('rounded-[28px] border p-6 shadow-sm', ui.surface)}>
          <h2 className={cx('text-xl font-black', ui.strong)}>门店资料</h2>
          <div className={cx('mt-5 space-y-3 text-sm leading-7', ui.muted)}>
            <div><span className={cx('font-black', ui.strong)}>门店：</span>{profile.name}</div>
            <div><span className={cx('font-black', ui.strong)}>类型：</span>{profile.storeType || '待补充'}</div>
            <div><span className={cx('font-black', ui.strong)}>位置：</span>{profile.city || '待补充'} {profile.district || ''}</div>
            <div><span className={cx('font-black', ui.strong)}>客单价：</span>{profile.avgPrice || 0} 元</div>
          </div>
          <button onClick={() => setView('profile')} className={cx('mt-5 rounded-full border px-4 py-3 text-sm font-black transition-all', ui.ghost)}>
            完善门店资料
          </button>
        </section>
      </div>
    </div>
  );
}

function AIWorkspace({
  profile,
  docs,
  conversations,
  setConversations,
  module,
  setModule,
  selectedConversationId,
  newConversationNonce,
  user,
  setView,
  onOpenAccount,
  ui,
}: {
  profile: StoreProfile;
  docs: KnowledgeDoc[];
  conversations: Conversation[];
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  module: ModuleKey;
  setModule: React.Dispatch<React.SetStateAction<ModuleKey>>;
  selectedConversationId: string;
  newConversationNonce: number;
  user: AuthUser;
  setView: (view: View) => void;
  onOpenAccount: () => void;
  ui: ReturnType<typeof useThemeTokens>;
}) {
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? '');
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [listening, setListening] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const speechRef = useRef<InstanceType<SpeechRecognitionCtor> | null>(null);
  const mountedRef = useRef(false);
  const active = conversations.find((item) => item.id === activeId);
  const messages = active?.messages ?? [];
  const activeDocs = docs.filter((doc) => doc.active && doc.module === module);
  const visibleConversations = conversations;
  const navItems = [
    { key: 'home' as View, label: '用户首页', icon: <LayoutDashboard className="h-5 w-5" /> },
    { key: 'ai' as View, label: 'AI 对话', icon: <Bot className="h-5 w-5" /> },
    { key: 'history' as View, label: '我的历史', icon: <History className="h-5 w-5" /> },
    { key: 'profile' as View, label: '门店资料', icon: <Building2 className="h-5 w-5" /> },
  ];

  useEffect(() => {
    if (selectedConversationId) setActiveId(selectedConversationId);
  }, [selectedConversationId]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    newConversation();
  }, [newConversationNonce]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: messages.length > 1 ? 'smooth' : 'auto',
      block: 'end',
    });
  }, [messages.length, generating, activeId]);

  function newConversation(nextModule = module) {
    setActiveId('');
    setInput('');
    setAttachments([]);
    setModule(nextModule);
  }

  function stop() {
    abortRef.current?.abort();
    abortRef.current = null;
    setGenerating(false);
  }

  function toggleVoice() {
    const api = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = api.SpeechRecognition || api.webkitSpeechRecognition;

    if (!Ctor) {
      window.alert('当前浏览器暂不支持语音识别');
      return;
    }

    if (listening && speechRef.current) {
      speechRef.current.stop();
      return;
    }

    const recognition = new Ctor();
    speechRef.current = recognition;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'zh-CN';
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript || '')
        .join('')
        .trim();

      if (!transcript) return;
      setInput((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      setListening(false);
    };
    recognition.onend = () => {
      setListening(false);
      speechRef.current = null;
    };
    setListening(true);
    recognition.start();
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
      const result = await apiRequestWithSignal<{ content: string }>('/agent/chat-v2', {
        question: `${question}\n\n补充要求：必须结合门店资料回答；只说确定的信息；输出简短、干练、可执行；优先用 3 到 5 条短句，不要空话，不要幻想。`,
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
      const content =
        err instanceof DOMException && err.name === 'AbortError'
          ? '已停止本次生成。'
          : err instanceof Error
            ? `AI 接口调用失败：${err.message}`
            : 'AI 接口调用失败，请检查后端配置。';

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
    <div className="grid h-[calc(100dvh-80px)] min-h-0 grid-cols-1 overflow-hidden md:h-[calc(100dvh-88px)] xl:grid-cols-[320px_minmax(0,1fr)]">
      <aside className={cx('hidden h-full min-h-0 overflow-hidden border-r xl:grid xl:grid-rows-[auto_minmax(0,1fr)_auto]', ui.surface)}>
        <div className="space-y-1.5 px-3 pt-4 pb-2">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setView(item.key)}
              className={cx('flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-[14px] font-black transition-all', item.key === 'ai' ? ui.navActive : ui.nav)}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
        <div className="min-h-0 px-3 pb-3">
          <div className={cx('flex h-full min-h-0 flex-col rounded-[24px] border p-4 shadow-sm', ui.surfaceAlt)}>
            <button onClick={() => newConversation()} className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-black text-white">
              <Plus className="h-4 w-4" />
              新建对话
            </button>
            <div className="app-scrollbar mt-4 min-h-0 flex-1 overflow-y-auto pr-1 pb-2">
          {visibleConversations.length === 0 ? (
                <div className={cx('rounded-[24px] border border-dashed p-5 text-sm', ui.muted)}>还没有历史对话。</div>
          ) : (
            visibleConversations.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveId(item.id);
                  setModule(item.module);
                }}
                className={cx('mb-3 w-full rounded-[24px] border p-4 text-left shadow-sm transition-all', activeId === item.id ? ui.surface : ui.surfaceAlt, 'hover:-translate-y-0.5 hover:shadow-md')}
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className={cx('rounded-full px-3 py-1 text-xs font-black', ui.soft)}>{modules[item.module].label}</span>
                  <span className={cx('text-xs font-bold', ui.muted)}>{item.updatedAt}</span>
                </div>
                <div className={cx('truncate text-base font-black', ui.strong)}>{item.title}</div>
                <div className={cx('mt-2 line-clamp-2 text-sm leading-6', ui.muted)}>{item.messages.at(-1)?.content || '还没有消息'}</div>
              </button>
            ))
          )}
            </div>
          </div>
        </div>
        <div className="shrink-0 p-3 pt-0">
          <button onClick={onOpenAccount} className={cx('flex w-full items-center gap-3 rounded-[20px] border px-3 py-3 transition-all', ui.ghost)}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-white">
              {(user.name || user.account).slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 text-left">
              <div className={cx('truncate text-sm font-black', ui.strong)}>{user.name || '未命名用户'}</div>
              <div className={cx('truncate text-xs', ui.muted)}>{user.account}</div>
            </div>
          </button>
        </div>
      </aside>

      <main className="relative flex min-h-0 min-w-0 flex-col">
        <div className="app-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-36 md:px-6 md:py-5 md:pb-40">
          <div className="mx-auto max-w-5xl space-y-4">
            {messages.length === 0 ? (
              <div className="pt-2">
                <div className="grid gap-3 md:grid-cols-2">
                  {starterPrompts[module].map((prompt) => (
                    <button key={prompt} onClick={() => setInput(prompt)} className={cx('rounded-[22px] border p-4 text-left text-[13px] font-bold leading-6 transition-all hover:-translate-y-0.5 hover:shadow-md', ui.surfaceAlt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div key={message.id} className={cx('flex gap-3', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {message.role === 'assistant' ? (
                    <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                      <Bot className="h-5 w-5" />
                    </div>
                  ) : null}
                  <div className={cx('max-w-[520px] rounded-[26px] border p-4 shadow-sm', message.role === 'user' ? ui.bubbleUser : ui.bubbleAi)}>
                    <div className="mb-3 flex items-center justify-between gap-8">
                      <span className={cx('text-sm font-black', message.role === 'user' ? 'text-zinc-300' : ui.strong)}>{message.role === 'user' ? '你' : modules[message.module].title}</span>
                      <span className="text-xs text-zinc-400">{message.createdAt}</span>
                    </div>
                    <pre className="whitespace-pre-wrap break-words font-sans text-[13px] leading-6">{message.content || '收到，正在思考中'}</pre>
                    {message.attachments?.length ? <div className="mt-3 text-xs font-bold text-zinc-400">附件：{message.attachments.join('、')}</div> : null}
                    {message.role === 'assistant' && message.content ? (
                      <button onClick={() => navigator.clipboard?.writeText(message.content)} className={cx('mt-4 inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black transition-all', ui.soft)}>
                        <Copy className="h-4 w-4" />
                        复制
                      </button>
                    ) : null}
                  </div>
                  {message.role === 'user' ? (
                    <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-950 text-white shadow-sm">
                      <UserRound className="h-5 w-5" />
                    </div>
                  ) : null}
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={send} className="sticky bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 md:px-6 md:pb-5">
          <div className="mx-auto w-full max-w-[420px] sm:max-w-[560px] md:max-w-[720px]">
            {attachments.length > 0 ? (
              <div className="mb-2 flex flex-wrap gap-2">
                {attachments.map((file) => (
                  <span key={file} className={cx('inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-bold shadow-sm', ui.soft)}>
                    <Paperclip className="h-4 w-4" />
                    {file}
                    <button type="button" onClick={() => setAttachments((current) => current.filter((item) => item !== file))}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className={cx('rounded-[28px] border bg-white/92 p-3 shadow-[0_18px_42px_rgba(15,23,42,0.10)] backdrop-blur-xl', ui.surface)}>
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send();
                  }
                }}
                className={cx('h-14 sm:h-16 w-full resize-none rounded-[22px] border-0 bg-transparent px-3 py-3 text-[13px] leading-6 outline-none transition-all shadow-none', ui.input)}
              placeholder="描述你的问题，例如：帮我做一个适合写字楼人群的 9.9 元团购套餐……"
              />

              <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
                <button type="button" onClick={() => fileRef.current?.click()} className={cx('flex h-11 items-center justify-center rounded-full border transition-all', ui.ghost)} title="添加附件">
                  <Paperclip className="h-5 w-5" />
                </button>
                <button type="button" onClick={toggleVoice} className={cx('flex h-11 items-center justify-center rounded-full border transition-all', listening ? 'border-zinc-950 bg-zinc-950 text-white' : ui.ghost)} title="语音识别">
                  <Mic className="h-5 w-5" />
                </button>
                {generating ? (
                  <button type="button" onClick={stop} className="flex h-11 items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-white">
                    <PauseCircle className="h-5 w-5" />
                  </button>
                ) : (
                  <button disabled={!input.trim()} className="flex h-11 items-center justify-center rounded-full bg-zinc-950 text-sm font-black text-white disabled:bg-zinc-300">
                    <Send className="h-5 w-5" />
                  </button>
                )}
              </div>

              <div className="mt-3 hidden items-center justify-between gap-3 sm:flex">
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
                <div className={cx('flex items-center gap-3 text-sm font-bold', ui.muted)}>
                  <button type="button" onClick={() => fileRef.current?.click()} className={cx('flex h-10 w-10 items-center justify-center rounded-full border transition-all', ui.ghost)} title="添加附件">
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={toggleVoice} className={cx('flex h-10 w-10 items-center justify-center rounded-full border transition-all', listening ? 'border-zinc-950 bg-zinc-950 text-white' : ui.ghost)} title="语音识别">
                    <Mic className="h-5 w-5" />
                  </button>
                  <span className="truncate text-[12px]">最多 3 个附件，当前为文件名随消息保存</span>
                </div>
                {generating ? (
                  <button type="button" onClick={stop} className="flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white">
                    <PauseCircle className="h-5 w-5" />
                    停止
                  </button>
                ) : (
                  <button disabled={!input.trim()} className="flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:bg-zinc-300">
                    <Send className="h-5 w-5" />
                    发送
                  </button>
                )}
              </div>

            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function ProfilePage({
  profile,
  setProfile,
  ui,
}: {
  profile: StoreProfile;
  setProfile: React.Dispatch<React.SetStateAction<StoreProfile>>;
  ui: ReturnType<typeof useThemeTokens>;
}) {
  const fields: Array<[keyof StoreProfile, string, string]> = [
    ['name', '门店名称', '例如：锋芒私教工作室'],
    ['storeType', '门店类型', '例如：精品私教工作室'],
    ['city', '城市', '例如：杭州'],
    ['district', '区域', '例如：滨江区'],
    ['audience', '目标客群', '描述你的核心用户'],
    ['goal', '业务目标', '描述当前最想解决的问题'],
  ];

  return (
    <div className="p-6">
      <div className={cx('rounded-[28px] border p-6 shadow-sm', ui.surface)}>
        <h1 className={cx('text-3xl font-black', ui.strong)}>门店资料</h1>
        <p className={cx('mt-2 text-sm leading-7', ui.muted)}>这些资料会作为 AI 的默认上下文，影响后续方案生成。</p>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {fields.map(([key, label, placeholder]) => (
            <label key={key} className={key === 'audience' || key === 'goal' ? 'md:col-span-2' : ''}>
              <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>{label}</span>
              {key === 'audience' || key === 'goal' ? (
                <textarea
                  value={String(profile[key])}
                  onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                  className={cx('h-28 w-full resize-none rounded-[24px] border p-4 outline-none transition-all', ui.input)}
                  placeholder={placeholder}
                />
              ) : (
                <input
                  value={String(profile[key])}
                  onChange={(event) => setProfile((current) => ({ ...current, [key]: event.target.value }))}
                  className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)}
                  placeholder={placeholder}
                />
              )}
            </label>
          ))}
          <label>
            <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>平均客单价</span>
            <input
              value={profile.avgPrice}
              onChange={(event) => setProfile((current) => ({ ...current, avgPrice: Number(event.target.value) }))}
              type="number"
              className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function HistoryPage({
  conversations,
  openConversation,
  search,
  ui,
}: {
  conversations: Conversation[];
  openConversation: (id: string, module: ModuleKey) => void;
  search: string;
  ui: ReturnType<typeof useThemeTokens>;
}) {
  const keyword = search.trim().toLowerCase();
  const visible = conversations.filter((conversation) => !keyword || [conversation.title, modules[conversation.module].label, ...conversation.messages.map((message) => message.content)].join(' ').toLowerCase().includes(keyword));
  return (
    <div className="p-6">
      <div className={cx('rounded-[28px] border shadow-sm', ui.surface)}>
        <div className="border-b border-zinc-200 p-6 dark:border-zinc-800">
          <h1 className={cx('text-3xl font-black', ui.strong)}>历史记录</h1>
          <p className={cx('mt-2 text-sm leading-7', ui.muted)}>所有 AI 对话都会保存在这里。</p>
        </div>
        {visible.length === 0 ? (
          <div className={cx('p-10 text-center text-sm', ui.muted)}>暂无历史记录。</div>
        ) : (
          visible.map((conversation) => (
            <button key={conversation.id} onClick={() => openConversation(conversation.id, conversation.module)} className={cx('flex w-full items-center justify-between border-b p-5 text-left transition-all last:border-0 hover:opacity-90', ui.surface)}>
              <div>
                <div className={cx('text-lg font-black', ui.strong)}>{conversation.title}</div>
                <div className={cx('mt-1 text-sm', ui.muted)}>{modules[conversation.module].label} · {conversation.updatedAt}</div>
              </div>
              <Clock3 className={cx('h-5 w-5', ui.muted)} />
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function StaffHome({
  conversations,
  ui,
}: {
  conversations: Conversation[];
  ui: ReturnType<typeof useThemeTokens>;
}) {
  const [stats, setStats] = useState<{ users: number; userAccounts: number; staffAccounts: number; activeSessions: number } | null>(null);
  const [userAccounts, setUserAccounts] = useState<AdminUserAccount[]>([]);
  const [error, setError] = useState('');

  async function loadStats() {
    setError('');
    try {
      const [statsResult, userAccountsResult] = await Promise.all([
        apiRequest<{ users: number; userAccounts: number; staffAccounts: number; activeSessions: number }>('/admin/stats'),
        apiRequest<AdminUserAccount[]>('/admin/users'),
      ]);
      setStats(statsResult);
      setUserAccounts(userAccountsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : '统计接口请求失败');
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <div className="space-y-6 p-6">
      <div className={cx('flex items-center justify-between rounded-[28px] border p-6 shadow-sm', ui.surface)}>
        <div>
          <h1 className={cx('text-3xl font-black', ui.strong)}>工作者后台</h1>
          <p className={cx('mt-2 text-sm leading-7', ui.muted)}>这里展示真实账号统计和本机对话记录。</p>
        </div>
        <button onClick={loadStats} className={cx('flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-black transition-all', ui.ghost)}>
          <RefreshCw className="h-4 w-4" />
          刷新
        </button>
      </div>
      {error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-600">{error}</div> : null}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="注册账号" value={String(stats?.users ?? 0)} icon={<Users className="h-5 w-5" />} ui={ui} />
        <StatCard label="用户账号" value={String(stats?.userAccounts ?? 0)} icon={<UserRound className="h-5 w-5" />} ui={ui} />
        <StatCard label="工作者账号" value={String(stats?.staffAccounts ?? 0)} icon={<ShieldCheck className="h-5 w-5" />} ui={ui} />
        <StatCard label="本机对话" value={String(conversations.length)} icon={<MessageSquare className="h-5 w-5" />} ui={ui} />
      </div>
      <div className={cx('rounded-[28px] border shadow-sm', ui.surface)}>
        <div className="flex items-center justify-between border-b border-zinc-200 p-6 dark:border-zinc-800">
          <div>
            <h2 className={cx('text-2xl font-black', ui.strong)}>已注册用户</h2>
            <p className={cx('mt-2 text-sm leading-7', ui.muted)}>用户注册的账号信息保存在工作者端，可在这里查看。</p>
          </div>
          <div className={cx('rounded-full px-4 py-2 text-sm font-black', ui.soft)}>
            {userAccounts.length} 个账号
          </div>
        </div>
        {userAccounts.length === 0 ? (
          <div className={cx('p-8 text-sm', ui.muted)}>当前还没有用户注册记录。</div>
        ) : (
          <div className="app-scrollbar overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-6 py-4 font-black">账号</th>
                  <th className="px-6 py-4 font-black">名称</th>
                  <th className="px-6 py-4 font-black">注册时间</th>
                  <th className="px-6 py-4 font-black">密码状态</th>
                </tr>
              </thead>
              <tbody>
                {userAccounts.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                    <td className="px-6 py-4 font-semibold">{item.account}</td>
                    <td className="px-6 py-4">{item.name}</td>
                    <td className="px-6 py-4">{new Date(item.createdAt).toLocaleString('zh-CN')}</td>
                    <td className="px-6 py-4">
                      <span className={cx('rounded-full px-3 py-1 text-xs font-black', item.passwordStored ? 'bg-zinc-950 text-white' : ui.soft)}>
                        {item.passwordStored ? '已保存密码' : '未保存密码'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KnowledgePage({
  docs,
  setDocs,
  ui,
}: {
  docs: KnowledgeDoc[];
  setDocs: React.Dispatch<React.SetStateAction<KnowledgeDoc[]>>;
  ui: ReturnType<typeof useThemeTokens>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const nextDocs = Array.from({ length: files.length }, (_, index) => files.item(index))
      .filter((file): file is File => Boolean(file))
      .map((file) => ({
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
      <div className={cx('rounded-[28px] border shadow-sm', ui.surface)}>
        <div className="flex items-center justify-between border-b border-zinc-200 p-6 dark:border-zinc-800">
          <div>
            <h1 className={cx('text-3xl font-black', ui.strong)}>知识库</h1>
            <p className={cx('mt-2 text-sm leading-7', ui.muted)}>启用的资料会传给 AI 作为上下文摘要。</p>
          </div>
          <input ref={fileRef} type="file" multiple className="hidden" onChange={(event) => addFiles(event.currentTarget.files)} />
          <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white">
            <Upload className="h-5 w-5" />
            上传资料
          </button>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {docs.map((doc) => (
            <div key={doc.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
              <div>
                <div className={cx('font-black', ui.strong)}>{doc.title}</div>
                <div className={cx('mt-1 text-sm', ui.muted)}>{doc.category} · {modules[doc.module].label} · 调用 {doc.calls} 次</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {(Object.keys(modules) as ModuleKey[]).map((key) => (
                  <button key={key} onClick={() => setDocs((current) => current.map((item) => (item.id === doc.id ? { ...item, module: key } : item)))} className={cx('rounded-full border px-3 py-2 text-xs font-black transition-all', doc.module === key ? 'border-zinc-950 bg-zinc-950 text-white' : ui.ghost)}>
                    {modules[key].label}
                  </button>
                ))}
                <button onClick={() => setDocs((current) => current.map((item) => (item.id === doc.id ? { ...item, active: !item.active } : item)))} className={cx('rounded-full px-4 py-3 text-sm font-black transition-all', doc.active ? 'bg-zinc-950 text-white' : ui.soft)}>
                  {doc.active ? '已启用' : '未启用'}
                </button>
                <button onClick={() => setDocs((current) => current.filter((item) => item.id !== doc.id))} className="rounded-full border border-zinc-200 px-4 py-3 text-sm font-black text-zinc-500 transition-all hover:border-red-300 hover:text-red-600">
                  删除
                </button>
              </div>
            </div>
          ))}
          {docs.length === 0 ? <div className={cx('p-10 text-center text-sm', ui.muted)}>暂无知识库资料。</div> : null}
        </div>
      </div>
    </div>
  );
}

function AccountSettingsModal({
  open,
  user,
  role,
  ui,
  onClose,
  onUpdated,
}: {
  open: boolean;
  user: AuthUser;
  role: AppRole;
  ui: ReturnType<typeof useThemeTokens>;
  onClose: () => void;
  onUpdated: (user: AuthUser) => void;
}) {
  const [name, setName] = useState(user.name);
  const [account, setAccount] = useState(user.account);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(user.name);
    setAccount(user.account);
  }, [user]);

  if (!open) return null;

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setSavingProfile(true);
    try {
      const result = await apiRequest<{ user: AuthUser }>('/account/update-profile', {
        role,
        currentAccount: user.account,
        account,
        name,
      });
      localStorage.setItem(`fitness_user_${role}`, JSON.stringify(result.user));
      onUpdated(result.user);
      setMessage('账户资料已更新。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setSavingProfile(false);
    }
  }

  async function savePassword(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    if (!isPasswordValid(newPassword)) {
      setError('新密码至少 6 位，且必须同时包含英文和数字');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }
    setSavingPassword(true);
    try {
      await apiRequest('/account/update-password', {
        role,
        account: user.account,
        currentPassword,
        newPassword,
        newPasswordConfirm: confirmPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('密码已更新。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码更新失败');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/55 p-4 backdrop-blur-sm">
      <div className={cx('w-full max-w-3xl rounded-[32px] border shadow-2xl', ui.surface)}>
        <div className="flex items-center justify-between border-b border-zinc-200 p-6 dark:border-zinc-800">
          <div>
            <div className={cx('text-sm font-bold uppercase tracking-[0.18em]', ui.muted)}>Account</div>
            <h2 className={cx('mt-2 text-2xl font-black', ui.strong)}>账户设置</h2>
          </div>
          <button onClick={onClose} className={cx('flex h-10 w-10 items-center justify-center rounded-full border transition-all', ui.ghost)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-0 lg:grid-cols-[1fr_1fr]">
          <form onSubmit={saveProfile} className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <PencilLine className="h-5 w-5" />
              <h3 className={cx('text-lg font-black', ui.strong)}>资料信息</h3>
            </div>
            <label className="block">
              <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>名称</span>
              <input value={name} onChange={(event) => setName(event.target.value)} className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)} />
            </label>
            <label className="block">
              <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>邮箱 / 手机号</span>
              <div className="relative">
                <Mail className={cx('absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2', ui.muted)} />
                <input value={account} onChange={(event) => setAccount(event.target.value)} className={cx('h-12 w-full rounded-2xl border pl-11 pr-4 outline-none transition-all', ui.input)} />
              </div>
            </label>
            <button disabled={savingProfile} className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:bg-zinc-400">
              {savingProfile ? '保存中...' : '保存资料'}
            </button>
          </form>
          <form onSubmit={savePassword} className="space-y-4 border-t border-zinc-200 p-6 dark:border-zinc-800 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              <h3 className={cx('text-lg font-black', ui.strong)}>安全设置</h3>
            </div>
            <label className="block">
              <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>当前密码</span>
              <input value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} type="password" className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)} />
            </label>
            <label className="block">
              <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>新密码</span>
              <input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)} placeholder="至少 6 位，包含英文和数字" />
            </label>
            <label className="block">
              <span className={cx('mb-2 block text-sm font-bold', ui.muted)}>确认新密码</span>
              <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type="password" className={cx('h-12 w-full rounded-2xl border px-4 outline-none transition-all', ui.input)} />
            </label>
            <button disabled={savingPassword} className="rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white disabled:bg-zinc-400">
              {savingPassword ? '更新中...' : '更新密码'}
            </button>
          </form>
        </div>
        {(message || error) ? (
          <div className="px-6 pb-6">
            <div className={cx('rounded-2xl border px-4 py-3 text-sm font-bold', error ? 'border-red-200 bg-red-50 text-red-600' : 'border-emerald-200 bg-emerald-50 text-emerald-600')}>
              {error || message}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function AppShell() {
  useClickGlow();
  const systemDark = useSystemDark();
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => readStorage<ThemeMode>('fitness_theme_mode', 'system'));
  const [role] = useState<AppRole>(getPortalRole);
  const [fatalError, setFatalError] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(() => readStorage<AuthUser | null>(`fitness_user_${getPortalRole()}`, null));
  const [view, setView] = useState<View>(() => (getPortalRole() === 'staff' ? 'staffHome' : 'home'));
  const [module, setModule] = useState<ModuleKey>('groupbuy');
  const [search, setSearch] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [newConversationNonce, setNewConversationNonce] = useState(0);
  const [accountOpen, setAccountOpen] = useState(false);
  const [profile, setProfile] = useState<StoreProfile>(() => readStorage('fitness_profile', defaultProfile));
  const [docs, setDocs] = useState<KnowledgeDoc[]>(() =>
    readStorage('fitness_docs', [
      { id: 'doc_1', title: '团购套餐设计方法', category: '运营方法', module: 'groupbuy', active: true, calls: 0 },
      { id: 'doc_2', title: '短视频脚本结构', category: '内容模板', module: 'video', active: true, calls: 0 },
      { id: 'doc_3', title: '私教体验课承接 SOP', category: '转化流程', module: 'product', active: true, calls: 0 },
    ]),
  );
  const [conversations, setConversations] = useState<Conversation[]>(() => readStorage('fitness_conversations', []));

  const resolvedTheme = getResolvedTheme(themeMode, systemDark);
  const ui = useThemeTokens(resolvedTheme === 'dark');

  useEffect(() => {
    localStorage.setItem('fitness_theme_mode', JSON.stringify(themeMode));
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.title = 'AI健身房运营助手';
  }, [resolvedTheme]);

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
      <div className={cx('flex min-h-screen items-center justify-center p-6', ui.page)}>
        <div className={cx('w-full max-w-lg rounded-[32px] border p-8 text-center shadow-sm', ui.surface)}>
          <h1 className={cx('text-2xl font-black', ui.strong)}>页面加载失败</h1>
          <p className={cx('mt-3 text-sm leading-7', ui.muted)}>可能是旧缓存数据或页面状态异常。清理本地缓存后会重新打开当前入口。</p>
          <button
            onClick={() => {
              resetAppStorage();
              window.location.href = role === 'staff' ? '/staff' : '/user';
            }}
            className="mt-6 rounded-full bg-zinc-950 px-5 py-3 text-sm font-black text-white"
          >
            清理缓存并重新进入
          </button>
        </div>
      </div>
    );
  }

  if (!user) return <AuthPage role={role} onAuthed={setUser} ui={ui} />;

  const effectiveRole = user.role === role ? role : user.role;

  function logout() {
    localStorage.removeItem(`fitness_user_${role}`);
    setUser(null);
  }

  function openConversation(nextId: string, nextModule: ModuleKey) {
    setSelectedConversationId(nextId);
    setModule(nextModule);
    setView('ai');
  }

  function submitSearch() {
    const keyword = search.trim().toLowerCase();
    setView('ai');
    if (!keyword) return;

    const hit = conversations.find((item) =>
      [item.title, modules[item.module].label, ...item.messages.map((message) => message.content)]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );

    if (hit) {
      setSelectedConversationId(hit.id);
      setModule(hit.module);
    }
  }

  const content = (() => {
    if (effectiveRole === 'staff') {
      if (view === 'knowledge') return <KnowledgePage docs={docs} setDocs={setDocs} ui={ui} />;
      if (view === 'records') return <HistoryPage conversations={conversations} openConversation={openConversation} search={search} ui={ui} />;
      return <StaffHome conversations={conversations} ui={ui} />;
    }

    if (view === 'ai') {
      return (
        <AIWorkspace
          profile={profile}
          docs={docs}
          conversations={conversations}
          setConversations={setConversations}
          module={module}
          setModule={setModule}
          selectedConversationId={selectedConversationId}
          newConversationNonce={newConversationNonce}
          user={user}
          setView={setView}
          onOpenAccount={() => setAccountOpen(true)}
          ui={ui}
        />
      );
    }

    if (view === 'history') return <HistoryPage conversations={conversations} openConversation={openConversation} search={search} ui={ui} />;
    if (view === 'profile') return <ProfilePage profile={profile} setProfile={setProfile} ui={ui} />;
    return <Home profile={profile} docs={docs} conversations={conversations} setView={setView} setModule={setModule} ui={ui} />;
  })();

  return (
    <div className={cx('min-h-screen overflow-x-hidden', ui.page)}>
      <TopBar
        role={effectiveRole}
        onLogout={logout}
        onOpenAccount={() => setAccountOpen(true)}
        view={view}
        setView={setView}
        module={module}
        setModule={setModule}
        conversations={conversations}
        onOpenConversation={openConversation}
        onNewConversation={() => {
          setSelectedConversationId('');
          setView('ai');
          setNewConversationNonce((current) => current + 1);
        }}
        themeMode={themeMode}
        setThemeMode={setThemeMode}
        ui={ui}
      />
      <div className="flex min-h-0">
        <Sidebar role={effectiveRole} user={user} view={view} setView={setView} onOpenAccount={() => setAccountOpen(true)} ui={ui} />
        <main className="min-w-0 flex-1">{content}</main>
      </div>
      <AccountSettingsModal open={accountOpen} user={user} role={role} ui={ui} onClose={() => setAccountOpen(false)} onUpdated={setUser} />
    </div>
  );
}

function App() {
  return <AppShell />;
}

export default App;
