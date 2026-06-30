"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  AtSign,
  Bot,
  Check,
  Clock,
  Cpu,
  File as FileIcon,
  FileCode,
  FileJson,
  FileText,
  Folder,
  HardDrive,
  Loader2,
  MemoryStick,
  Pencil,
  Play,
  Plus,
  RotateCw,
  Save,
  Server,
  Settings,
  Square,
  Terminal,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const BOT_ID = "demo";
const PANEL_URL = process.env.NEXT_PUBLIC_PANEL_URL || "";

type BotStatus =
  | "running"
  | "stopped"
  | "starting"
  | "stopping"
  | "restarting"
  | "error";
type TabId = "console" | "files" | "settings";
type Action = "start" | "stop" | "restart";

interface BotState {
  status: BotStatus;
  uptimeSec: number;
  cpu: number;
  ram: number;
  ramLimit: number;
  diskMb: number;
}
interface BotConfig {
  name: string;
  startupFile: string;
  autoRestart: boolean;
  token: string;
  tokenSet: boolean;
}
interface BotFile {
  name: string;
  size: number;
  modified: string;
  kind: "code" | "json" | "text" | "file";
}

const statusMeta: Record<
  BotStatus,
  { label: string; dot: string; text: string; pulse: boolean }
> = {
  running: { label: "Онлайн", dot: "bg-success", text: "text-success", pulse: true },
  stopped: { label: "Оффлайн", dot: "bg-muted-foreground", text: "text-muted-foreground", pulse: false },
  starting: { label: "Запуск…", dot: "bg-warning", text: "text-warning", pulse: true },
  stopping: { label: "Остановка…", dot: "bg-warning", text: "text-warning", pulse: true },
  restarting: { label: "Перезагрузка…", dot: "bg-warning", text: "text-warning", pulse: true },
  error: { label: "Ошибка", dot: "bg-destructive", text: "text-destructive", pulse: false },
};

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "console", label: "Управление", icon: Terminal },
  { id: "files", label: "Файлы", icon: Folder },
  { id: "settings", label: "Настройки", icon: Settings },
];

const fileIcons: Record<BotFile["kind"], LucideIcon> = {
  code: FileCode,
  json: FileJson,
  text: FileText,
  file: FileIcon,
};

function fmtUptime(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h} ч ${m} м`;
  if (m > 0) return `${m} м ${sec} с`;
  return `${sec} с`;
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/bots/${BOT_ID}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return (await res.json()) as T;
}

export default function PanelPage() {
  const [state, setState] = React.useState<BotState | null>(null);
  const [config, setConfig] = React.useState<BotConfig | null>(null);
  const [logs, setLogs] = React.useState<string[]>([]);
  const [tab, setTab] = React.useState<TabId>("console");
  const [busy, setBusy] = React.useState<Action | null>(null);
  const [available, setAvailable] = React.useState<boolean | null>(null);

  const [files, setFiles] = React.useState<BotFile[]>([]);
  const [editing, setEditing] = React.useState<{
    name: string;
    content: string;
    isNew: boolean;
  } | null>(null);
  const [savingFile, setSavingFile] = React.useState(false);

  const [form, setForm] = React.useState({
    name: "",
    startupFile: "",
    autoRestart: true,
    token: "",
  });
  const [formReady, setFormReady] = React.useState(false);
  const [savingSettings, setSavingSettings] = React.useState(false);
  const [savedSettings, setSavedSettings] = React.useState(false);

  const logRef = React.useRef<HTMLDivElement>(null);

  const refreshState = React.useCallback(async () => {
    const d = await api<{
      available?: boolean;
      state?: BotState;
      config?: BotConfig;
    }>("");
    if (d.available === false) {
      setAvailable(false);
      return;
    }
    setAvailable(true);
    if (d.state) setState(d.state);
    if (d.config) setConfig(d.config);
  }, []);

  const refreshLogs = React.useCallback(async () => {
    const d = await api<{ lines?: string[] }>("/logs?tail=300");
    if (Array.isArray(d.lines)) setLogs(d.lines);
  }, []);

  const loadFiles = React.useCallback(async () => {
    const d = await api<{ files?: BotFile[] }>("/files");
    if (Array.isArray(d.files)) setFiles(d.files);
  }, []);

  // Первичная загрузка + поллинг каждые 2с.
  React.useEffect(() => {
    refreshState();
    refreshLogs();
    loadFiles();
    const t = window.setInterval(() => {
      refreshState();
      refreshLogs();
    }, 2000);
    return () => window.clearInterval(t);
  }, [refreshState, refreshLogs, loadFiles]);

  // Инициализация формы настроек из конфига (один раз).
  React.useEffect(() => {
    if (config && !formReady) {
      setForm({
        name: config.name,
        startupFile: config.startupFile,
        autoRestart: config.autoRestart,
        token: "",
      });
      setFormReady(true);
    }
  }, [config, formReady]);

  // Автоскролл консоли.
  React.useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const doAction = async (action: Action) => {
    setBusy(action);
    try {
      const d = await api<{ state?: BotState }>("/action", {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      if (d.state) setState(d.state);
      await refreshLogs();
    } catch {
      /* poll подхватит актуальное состояние */
    } finally {
      setBusy(null);
    }
  };

  const openFile = async (name: string) => {
    const d = await api<{ content?: string }>(
      `/files?name=${encodeURIComponent(name)}`,
    );
    setEditing({ name, content: d.content ?? "", isNew: false });
  };
  const saveFile = async () => {
    if (!editing || !editing.name.trim()) return;
    setSavingFile(true);
    try {
      await api("/files", {
        method: "POST",
        body: JSON.stringify({ name: editing.name, content: editing.content }),
      });
      await loadFiles();
      setEditing(null);
    } finally {
      setSavingFile(false);
    }
  };
  const removeFile = async (name: string) => {
    await api(`/files?name=${encodeURIComponent(name)}`, { method: "DELETE" });
    await loadFiles();
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const d = await api<{ config?: BotConfig }>("", {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      if (d.config) setConfig(d.config);
      setForm((f) => ({ ...f, token: "" }));
      setSavedSettings(true);
      window.setTimeout(() => setSavedSettings(false), 2500);
    } finally {
      setSavingSettings(false);
    }
  };

  const transitional: BotStatus | null = busy
    ? (({ start: "starting", stop: "stopping", restart: "restarting" } as const)[
        busy
      ] as BotStatus)
    : null;
  const status: BotStatus = transitional ?? state?.status ?? "stopped";
  const meta = statusMeta[status];
  const running = status === "running";
  const isBusy = busy !== null;

  if (available === false) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <Card className="w-full max-w-md border-border/60 bg-card/60 text-center backdrop-blur">
          <CardHeader className="items-center gap-2">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-warning/15 text-warning">
              <Server className="size-6" />
            </div>
            <CardTitle>Панель работает на сервере</CardTitle>
            <CardDescription>
              Реальный запуск ботов идёт на сервере хостинга. Здесь движок
              недоступен. Откройте рабочую панель по адресу вашего сервера.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {PANEL_URL && (
              <Button asChild size="lg" className="w-full">
                <a href={PANEL_URL}>
                  Открыть рабочую панель
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            )}
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href="/">На главную</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="size-7 animate-spin text-primary" />
          <span className="text-sm">Загрузка панели…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      {/* Верхняя панель */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon" className="size-9 shrink-0">
              <Link href="/" aria-label="На главную">
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-semibold">
                  {config?.name ?? "Бот"}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5 text-xs font-medium transition-colors",
                    meta.text,
                  )}
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      meta.dot,
                      meta.pulse && "animate-pulse",
                    )}
                  />
                  {meta.label}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Goh Hosting · бета 1.0
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant="success"
              icon={Play}
              label="Запустить"
              loading={busy === "start"}
              disabled={running || isBusy}
              onClick={() => doAction("start")}
            />
            <ActionButton
              variant="secondary"
              icon={RotateCw}
              label="Перезагрузить"
              loading={busy === "restart"}
              disabled={!running || isBusy}
              onClick={() => doAction("restart")}
            />
            <ActionButton
              variant="destructive"
              icon={Square}
              label="Остановить"
              loading={busy === "stop"}
              disabled={!running || isBusy}
              onClick={() => doAction("stop")}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row">
        {/* Сайдбар */}
        <aside className="lg:w-72 lg:shrink-0">
          <Card className="border-border/60 bg-card/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-base">Состояние сервера</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div className="flex flex-col gap-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <AtSign className="size-4" />
                    Адрес
                  </span>
                  <span className="truncate font-medium">@goh_demo_bot</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="size-4" />
                    Аптайм
                  </span>
                  <span className="font-medium tabular-nums">
                    {running ? fmtUptime(state.uptimeSec) : "—"}
                  </span>
                </div>
              </div>

              <Separator />

              <UsageStat
                icon={Cpu}
                label="Процессор"
                value={`${state.cpu.toFixed(1)} %`}
                percent={Math.min(100, state.cpu)}
                barClass="bg-primary"
              />
              <UsageStat
                icon={MemoryStick}
                label="Память"
                value={`${state.ram} / ${state.ramLimit} МБ`}
                percent={(state.ram / state.ramLimit) * 100}
                barClass="bg-success"
              />
              <UsageStat
                icon={HardDrive}
                label="Диск"
                value={`${state.diskMb} МБ / 1 ГБ`}
                percent={(state.diskMb / 1024) * 100}
                barClass="bg-warning"
              />
            </CardContent>
          </Card>
        </aside>

        {/* Контент */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 inline-flex w-full gap-1 rounded-xl border border-border/60 bg-card/60 p-1 backdrop-blur sm:w-auto">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all sm:flex-none",
                  tab === t.id
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <t.icon className="size-4" />
                {t.label}
              </button>
            ))}
          </div>

          {/* Управление / консоль */}
          {tab === "console" && (
            <Card
              key="console"
              className="border-border/60 bg-card/60 backdrop-blur duration-300 animate-in fade-in slide-in-from-bottom-2"
            >
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Terminal className="size-4 text-primary" />
                  Консоль
                </CardTitle>
                <span className={cn("text-xs font-medium", meta.text)}>
                  {meta.label}
                </span>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {isBusy && (
                  <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary duration-300 animate-in fade-in">
                    <Loader2 className="size-4 animate-spin" />
                    {busy === "start" &&
                      "Запуск бота… (первый раз занимает чуть дольше)"}
                    {busy === "stop" && "Остановка бота…"}
                    {busy === "restart" && "Перезагрузка бота…"}
                  </div>
                )}
                <div
                  ref={logRef}
                  className="h-80 overflow-y-auto rounded-lg border border-border/60 bg-[#080b14] p-4 font-mono text-xs leading-relaxed"
                >
                  {logs.length === 0 && (
                    <div className="text-muted-foreground">
                      Логи пусты. Нажмите «Запустить», чтобы поднять бота.
                    </div>
                  )}
                  {logs.map((line, i) => (
                    <div
                      key={`${i}-${line.slice(0, 12)}`}
                      className={cn(
                        "whitespace-pre-wrap break-words duration-300 animate-in fade-in",
                        /✓|успешно|запущен/i.test(line) && "text-success",
                        /→|heartbeat|тик/i.test(line) && "text-primary",
                        /error|ошибка|traceback|exception/i.test(line) &&
                          "text-destructive",
                      )}
                    >
                      {line}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Логи обновляются автоматически каждые 2 секунды.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Файлы */}
          {tab === "files" && (
            <Card
              key="files"
              className="border-border/60 bg-card/60 backdrop-blur duration-300 animate-in fade-in slide-in-from-bottom-2"
            >
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Folder className="size-4 text-primary" />
                    Файлы бота
                  </CardTitle>
                  <CardDescription>
                    Код бота. Файл запуска задаётся в «Настройках».
                  </CardDescription>
                </div>
                {!editing && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setEditing({ name: "", content: "", isNew: true })
                    }
                  >
                    <Plus className="size-4" />
                    Новый файл
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {editing ? (
                  <div className="flex flex-col gap-3 duration-300 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <Input
                        value={editing.name}
                        onChange={(e) =>
                          setEditing({ ...editing, name: e.target.value })
                        }
                        placeholder="имя_файла.py"
                        disabled={!editing.isNew}
                        className="font-mono"
                      />
                    </div>
                    <textarea
                      value={editing.content}
                      onChange={(e) =>
                        setEditing({ ...editing, content: e.target.value })
                      }
                      spellCheck={false}
                      className="h-80 w-full resize-none rounded-lg border border-border/60 bg-[#080b14] p-4 font-mono text-xs leading-relaxed text-foreground outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      placeholder="# код вашего бота"
                    />
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        onClick={() => setEditing(null)}
                        disabled={savingFile}
                      >
                        <X className="size-4" />
                        Отмена
                      </Button>
                      <Button onClick={saveFile} disabled={savingFile}>
                        {savingFile ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        Сохранить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border/60">
                    <div className="flex items-center gap-3 border-b border-border/60 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
                      <span className="flex-1">Имя</span>
                      <span className="w-20 text-right">Размер</span>
                      <span className="w-16 text-right">Действия</span>
                    </div>
                    {files.length === 0 && (
                      <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                        Файлов нет.
                      </div>
                    )}
                    {files.map((f) => {
                      const Icon = fileIcons[f.kind];
                      return (
                        <div
                          key={f.name}
                          className="flex items-center gap-3 border-b border-border/40 px-4 py-2.5 transition-colors last:border-0 hover:bg-muted/30"
                        >
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              f.kind === "code"
                                ? "text-blue-400"
                                : "text-muted-foreground",
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => openFile(f.name)}
                            className="flex-1 truncate text-left text-sm hover:text-primary hover:underline"
                          >
                            {f.name}
                          </button>
                          <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                            {fmtSize(f.size)}
                          </span>
                          <div className="flex w-16 justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              aria-label={`Редактировать ${f.name}`}
                              onClick={() => openFile(f.name)}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 text-muted-foreground hover:text-destructive"
                              aria-label={`Удалить ${f.name}`}
                              onClick={() => removeFile(f.name)}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Настройки */}
          {tab === "settings" && (
            <Card
              key="settings"
              className="border-border/60 bg-card/60 backdrop-blur duration-300 animate-in fade-in slide-in-from-bottom-2"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="size-4 text-primary" />
                  Настройки запуска
                </CardTitle>
                <CardDescription>
                  Файл запуска, токен Telegram и автоперезапуск.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={saveSettings} className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="name">Имя сервера</Label>
                    <Input
                      id="name"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      placeholder="Мой первый бот"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="startupFile">Запускаемый файл</Label>
                    <Input
                      id="startupFile"
                      value={form.startupFile}
                      onChange={(e) =>
                        setForm({ ...form, startupFile: e.target.value })
                      }
                      placeholder="bot.py"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Файл, который движок запустит при старте бота.{" "}
                      <span className="font-mono text-foreground">.py</span> →
                      Python,{" "}
                      <span className="font-mono text-foreground">.js</span> →
                      Node.js. Если есть{" "}
                      <span className="font-mono text-foreground">
                        requirements.txt
                      </span>{" "}
                      / <span className="font-mono text-foreground">package.json</span>{" "}
                      — зависимости поставятся автоматически.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="token">Токен Telegram-бота</Label>
                    <Input
                      id="token"
                      type="password"
                      value={form.token}
                      onChange={(e) =>
                        setForm({ ...form, token: e.target.value })
                      }
                      placeholder={
                        config?.tokenSet
                          ? "Токен сохранён — введите новый, чтобы заменить"
                          : "123456:ABC-DEF... от @BotFather"
                      }
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Передаётся боту как переменная{" "}
                      <span className="font-mono text-foreground">BOT_TOKEN</span>.
                      Хранится на сервере, в ответах API маскируется.
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Автоперезапуск при сбое</p>
                      <p className="text-xs text-muted-foreground">
                        Бот сам поднимется, если упадёт.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.autoRestart}
                      onClick={() =>
                        setForm({ ...form, autoRestart: !form.autoRestart })
                      }
                      className={cn(
                        "relative h-6 w-11 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                        form.autoRestart ? "bg-primary" : "bg-muted",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white transition-transform",
                          form.autoRestart && "translate-x-5",
                        )}
                      />
                    </button>
                  </div>

                  <Separator />

                  <div className="flex items-center justify-end gap-3">
                    {savedSettings && (
                      <span className="flex items-center gap-1.5 text-sm text-success duration-300 animate-in fade-in">
                        <Check className="size-4" />
                        Сохранено
                      </span>
                    )}
                    <Button type="submit" disabled={savingSettings}>
                      {savingSettings ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Save className="size-4" />
                      )}
                      Сохранить
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </div>
  );
}

function ActionButton({
  variant,
  icon: Icon,
  label,
  loading,
  disabled,
  onClick,
}: {
  variant: "success" | "secondary" | "destructive";
  icon: LucideIcon;
  label: string;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button variant={variant} size="sm" onClick={onClick} disabled={disabled}>
      {loading ? <Loader2 className="size-4 animate-spin" /> : <Icon className="size-4" />}
      {label}
    </Button>
  );
}

function UsageStat({
  icon: Icon,
  label,
  value,
  percent,
  barClass,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  percent: number;
  barClass: string;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="size-4" />
          {label}
        </span>
        <span className="font-medium tabular-nums">{value}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-700", barClass)}
          style={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
        />
      </div>
    </div>
  );
}
