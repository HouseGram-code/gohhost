"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bot, Loader2, LogIn, UserPlus } from "lucide-react";

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
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = React.useState<Mode>("login");
  const [nickname, setNickname] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "ngrok-skip-browser-warning": "true",
        },
        body: JSON.stringify({ nickname, password }),
      });
      const data = (await res.json()) as { user?: unknown; error?: string };
      if (!res.ok) {
        setError(data.error || "Ошибка");
        return;
      }
      router.push("/panel");
      router.refresh();
    } catch {
      setError("Сеть недоступна");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden p-6">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[40rem] w-[40rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <Link
        href="/"
        className="mb-8 flex items-center gap-2.5 text-lg font-semibold"
      >
        <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Bot className="size-5" />
        </span>
        Goh Hosting
      </Link>

      <Card className="w-full max-w-sm border-border/60 bg-card/70 backdrop-blur">
        <CardHeader>
          <div className="mb-2 inline-flex w-full gap-1 rounded-xl border border-border/60 bg-card/60 p-1">
            <button
              type="button"
              onClick={() => setMode("login")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                mode === "login"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LogIn className="size-4" />
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode("register")}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                mode === "register"
                  ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <UserPlus className="size-4" />
              Регистрация
            </button>
          </div>
          <CardTitle>
            {mode === "login" ? "С возвращением" : "Создать аккаунт"}
          </CardTitle>
          <CardDescription>
            {mode === "login"
              ? "Войдите по никнейму и паролю"
              : "Никнейм и пароль для входа на сайт"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nickname">Никнейм</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="myname"
                autoComplete="username"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </div>

            {error && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive duration-300 animate-in fade-in">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={busy} className="w-full">
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === "login" ? (
                <LogIn className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {mode === "login" ? "Войти" : "Зарегистрироваться"}
            </Button>
          </form>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Аккаунт также можно создать через Telegram-бота при создании сервера.
          </p>
        </CardContent>
      </Card>

      <Button asChild variant="ghost" size="sm" className="mt-6">
        <Link href="/">
          <ArrowLeft className="size-4" />
          На главную
        </Link>
      </Button>
    </div>
  );
}
