"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Bot,
  Cpu,
  Loader2,
  LogOut,
  MemoryStick,
  Plus,
  Server,
  Settings2,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ServerItem {
  id: string;
  name: string;
  tariff: string;
  status: string;
  cpu: number;
  ram: number;
  ramLimit: number;
  createdAt: string;
}

const statusMeta: Record<string, { label: string; dot: string; text: string }> = {
  running: { label: "Онлайн", dot: "bg-success", text: "text-success" },
  stopped: { label: "Оффлайн", dot: "bg-muted-foreground", text: "text-muted-foreground" },
  error: { label: "Ошибка", dot: "bg-destructive", text: "text-destructive" },
};

async function api<T = unknown>(path: string, init?: RequestInit): Promise<Response & { data: T }> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "ngrok-skip-browser-warning": "true",
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T;
  return Object.assign(res, { data });
}

export default function Dashboard() {
  const router = useRouter();
  const [nickname, setNickname] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [servers, setServers] = React.useState<ServerItem[]>([]);
  const [name, setName] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState("");

  const loadServers = React.useCallback(async () => {
    const res = await api<{ servers?: ServerItem[] }>("/api/servers");
    if (res.status === 401) {
      router.push("/login");
      return false;
    }
    if (Array.isArray(res.data.servers)) setServers(res.data.servers);
    return true;
  }, [router]);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      const me = await api<{ user?: { nickname: string } | null }>("/api/auth/me");
      if (!alive) return;
      if (!me.data.user) {
        router.push("/login");
        return;
      }
      setNickname(me.data.user.nickname);
      await loadServers();
      setLoading(false);
    })();
    const t = window.setInterval(loadServers, 3000);
    return () => {
      alive = false;
      window.clearInterval(t);
    };
  }, [router, loadServers]);

  const createServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError("");
    const res = await api<{ server?: ServerItem; error?: string }>("/api/servers", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!res.ok) {
      setError(res.data.error || "Не удалось создать сервер");
      return;
    }
    setName("");
    await loadServers();
  };

  const remove = async (id: string) => {
    await api(`/api/servers/${id}`, { method: "DELETE" });
    await loadServers();
  };

  const logout = async () => {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const hasFree = servers.some((s) => s.tariff === "free");

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2 className="size-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Bot className="size-5" />
            </span>
            <span className="font-semibold">Goh Hosting</span>
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              @{nickname}
            </span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" />
              Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Мои серверы</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Запускай и управляй своими Telegram-ботами 24/7.
        </p>

        {/* Создание сервера */}
        <Card className="mt-6 border-border/60 bg-card/60 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="size-4 text-primary" />
              Создать сервер
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasFree ? (
              <p className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                Бесплатный тариф уже использован (1 сервер). Это всё, что
                доступно на бете.
              </p>
            ) : (
              <form onSubmit={createServer} className="flex flex-col gap-3 sm:flex-row">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Название сервера, напр. «Мой бот»"
                  className="flex-1"
                />
                <Button type="submit" disabled={creating} className="shrink-0">
                  {creating ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Создать (бесплатно)
                </Button>
              </form>
            )}
            {error && (
              <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Список серверов */}
        <div className="mt-6 flex flex-col gap-3">
          {servers.length === 0 && (
            <div className="rounded-xl border border-dashed border-border/60 px-4 py-12 text-center text-sm text-muted-foreground">
              У вас пока нет серверов. Создайте первый выше или через
              Telegram-бота.
            </div>
          )}
          {servers.map((s) => {
            const meta = statusMeta[s.status] ?? statusMeta.stopped;
            return (
              <Card
                key={s.id}
                className="border-border/60 bg-card/60 backdrop-blur transition-colors hover:border-primary/40"
              >
                <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                      <Server className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-semibold">{s.name}</span>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-2 py-0.5 text-xs font-medium",
                            meta.text,
                          )}
                        >
                          <span className={cn("size-1.5 rounded-full", meta.dot)} />
                          {meta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="rounded bg-muted px-1.5 py-0.5">
                          Бесплатный
                        </span>
                        <span className="flex items-center gap-1">
                          <Cpu className="size-3" />
                          {s.cpu.toFixed(1)}%
                        </span>
                        <span className="flex items-center gap-1">
                          <MemoryStick className="size-3" />
                          {s.ram}/{s.ramLimit} МБ
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button asChild size="sm">
                      <Link href={`/panel/${s.id}`}>
                        <Settings2 className="size-4" />
                        Управление
                        <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 text-muted-foreground hover:text-destructive"
                      aria-label="Удалить сервер"
                      onClick={() => remove(s.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}
