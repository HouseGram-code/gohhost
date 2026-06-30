import {
  Activity,
  ArrowRight,
  Bot,
  Check,
  Cpu,
  Gauge,
  HardDrive,
  MemoryStick,
  Rocket,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

const features = [
  {
    icon: ShieldCheck,
    title: "Защита 24/7",
    description:
      "Постоянный мониторинг и защита от сбоев. Твой бот всегда под надёжным присмотром.",
  },
  {
    icon: Activity,
    title: "Работа 24/7",
    description:
      "Бот работает без выходных. Автоматический перезапуск, если что-то пойдёт не так.",
  },
  {
    icon: Zap,
    title: "Быстрый старт",
    description:
      "Запуск за пару кликов. Никакой сложной настройки серверов и консолей.",
  },
];

const planFeatures = [
  { icon: MemoryStick, text: "150 МБ оперативной памяти" },
  { icon: Bot, text: "1 Telegram-бот" },
  { icon: Activity, text: "Работа и защита 24/7" },
  { icon: Gauge, text: "Панель управления ботом" },
  { icon: HardDrive, text: "Хранилище для файлов бота" },
];

export default function Home() {
  // Если задан адрес рабочей панели (сервер) — кнопки ведут туда, иначе /panel.
  const panelUrl = process.env.NEXT_PUBLIC_PANEL_URL || "/panel";
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden scroll-smooth">
      {/* Декоративное свечение фона */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        <div className="absolute bottom-0 right-0 h-[28rem] w-[28rem] translate-x-1/3 translate-y-1/3 rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,transparent_0%,var(--background)_70%)]" />
      </div>

      {/* Шапка */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pb-5 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Bot className="size-5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold tracking-tight">
              Goh Hosting
            </span>
            <Badge variant="secondary" className="border-border/60">
              бета 1.0
            </Badge>
          </div>
        </div>
        <Button asChild variant="ghost" size="sm">
          <a href={panelUrl}>
            Панель управления
            <ArrowRight className="size-4" />
          </a>
        </Button>
      </header>

      {/* Hero */}
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col items-center px-6">
        <section className="flex flex-col items-center pt-16 pb-20 text-center sm:pt-24">
          <Badge
            variant="outline"
            className="mb-6 gap-1.5 border-primary/30 bg-primary/10 px-3 py-1 text-primary"
          >
            <Sparkles className="size-3.5" />
            Хостинг для Telegram-ботов
          </Badge>

          <h1 className="max-w-3xl text-balance text-5xl font-bold tracking-tight sm:text-6xl">
            Привет! Это{" "}
            <span className="bg-gradient-to-r from-white via-blue-200 to-primary bg-clip-text text-transparent">
              Goh Hosting
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-balance text-lg leading-relaxed text-muted-foreground">
            Быстрый и надёжный хостинг для твоих Telegram-ботов. Защита от сбоев
            и работа <span className="font-semibold text-foreground">24/7</span>{" "}
            — бот всегда онлайн, а ты занимаешься своими делами.
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="shadow-lg shadow-primary/30">
              <a href="#tariff">
                Посмотреть тариф
                <ArrowRight className="size-4" />
              </a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href={panelUrl}>
                <Rocket className="size-4" />
                Открыть панель
              </a>
            </Button>
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="size-4 text-success" />
              Бесплатный тариф
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-4 text-success" />
              Без карты
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-4 text-success" />
              Запуск за минуту
            </span>
          </div>
        </section>

        {/* Преимущества */}
        <section className="grid w-full gap-4 pb-8 sm:grid-cols-3">
          {features.map((feature) => (
            <Card
              key={feature.title}
              className="border-border/60 bg-card/60 backdrop-blur transition-colors hover:border-primary/40"
            >
              <CardHeader>
                <div className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/20">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle className="text-lg">{feature.title}</CardTitle>
                <CardDescription className="leading-relaxed">
                  {feature.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        {/* Тариф */}
        <section
          id="tariff"
          className="flex w-full scroll-mt-20 flex-col items-center py-20"
        >
          <Badge
            variant="outline"
            className="mb-4 border-primary/30 bg-primary/10 text-primary"
          >
            Тариф
          </Badge>
          <h2 className="text-balance text-center text-3xl font-bold tracking-tight sm:text-4xl">
            Начни бесплатно
          </h2>
          <p className="mt-3 max-w-xl text-balance text-center text-muted-foreground">
            Один бесплатный тариф с ограничениями беты. Идеально, чтобы запустить
            первого бота прямо сейчас.
          </p>

          <Card className="relative mt-10 w-full max-w-md overflow-hidden border-primary/40 bg-card/80 shadow-2xl shadow-primary/10 backdrop-blur">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">Бесплатный</CardTitle>
                <Badge variant="success">Beta</Badge>
              </div>
              <CardDescription>Для старта и небольших ботов</CardDescription>
              <div className="mt-4 flex items-end gap-1.5">
                <span className="text-5xl font-bold tracking-tight">0 ₽</span>
                <span className="mb-1.5 text-muted-foreground">/ месяц</span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <Separator />
              <ul className="flex flex-col gap-3">
                {planFeatures.map((item) => (
                  <li key={item.text} className="flex items-center gap-3">
                    <span className="flex size-7 items-center justify-center rounded-md bg-success/15 text-success">
                      <item.icon className="size-4" />
                    </span>
                    <span className="text-sm">{item.text}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground">
                <Cpu className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>
                  Лимит памяти на бету — 150 МБ. Этого хватает для большинства
                  ботов на aiogram, grammY и Telegraf.
                </span>
              </div>

              <Button
                asChild
                size="lg"
                className="w-full shadow-lg shadow-primary/30"
              >
                <a href={panelUrl}>
                  Взять бесплатно
                  <ArrowRight className="size-4" />
                </a>
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>

      {/* Подвал */}
      <footer className="mx-auto w-full max-w-6xl px-6 py-8">
        <Separator className="mb-6" />
        <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bot className="size-3.5" />
            </div>
            <span>Goh Hosting</span>
            <span className="text-muted-foreground/50">·</span>
            <span>бета 1.0</span>
          </div>
          <span>© 2026 Goh Hosting. Все права защищены.</span>
        </div>
      </footer>
    </div>
  );
}
