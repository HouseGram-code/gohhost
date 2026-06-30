import { promises as fs } from "node:fs";
import path from "node:path";

import * as docker from "./docker";

// ── Движок Goh Hosting ───────────────────────────────────────────────
// Управляет ботами как отдельными Docker-контейнерами.
// Если Docker недоступен (например, локальная разработка на Windows) —
// автоматически переключается в режим симуляции, чтобы UI работал везде.

// Путь к данным внутри контейнера web.
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
// Путь к данным НА ХОСТЕ (для bind-mount дочерних контейнеров; задаётся в compose).
const HOST_DATA_DIR = process.env.HOST_DATA_DIR || DATA_DIR;

const RAM_LIMIT_MB = 150; // лимит бесплатного тарифа
const CPU_LIMIT = 0.5; // доля ядра
const PIDS_LIMIT = 128;

export type BotStatus =
  | "running"
  | "stopped"
  | "starting"
  | "stopping"
  | "restarting"
  | "error";

export interface BotConfig {
  name: string;
  startupFile: string;
  token: string;
  autoRestart: boolean;
}

export interface BotState {
  status: BotStatus;
  uptimeSec: number;
  cpu: number;
  ram: number;
  ramLimit: number;
  diskMb: number;
  mode: "docker" | "simulated";
}

export interface BotFile {
  name: string;
  size: number;
  modified: string;
  kind: "code" | "json" | "text" | "file";
}

const DEFAULT_CONFIG: BotConfig = {
  name: "Мой первый бот",
  startupFile: "bot.py",
  token: "",
  autoRestart: true,
};

// Демонстрационный бот без зависимостей: сразу даёт живые логи и метрики.
const SAMPLE_BOT = `import time, os

print("Goh Hosting: бот запущен", flush=True)
token = os.environ.get("BOT_TOKEN", "")
print("Токен:", "задан" if token else "не задан (демо-режим)", flush=True)
print("Чтобы запустить реального Telegram-бота, замените этот файл", flush=True)

i = 0
while True:
    i += 1
    print(f"[heartbeat] тик {i} — бот работает 24/7", flush=True)
    time.sleep(3)
`;

// ── Пути ──────────────────────────────────────────────────────────────
function appDir(id: string) {
  return path.join(DATA_DIR, "apps", id);
}
function hostAppDir(id: string) {
  return path.posix.join(HOST_DATA_DIR.replace(/\\/g, "/"), "apps", id);
}
function configPath(id: string) {
  return path.join(DATA_DIR, "configs", `${id}.json`);
}
function containerName(id: string) {
  return `goh_bot_${id}`;
}

async function ensureDirs(id: string) {
  await fs.mkdir(appDir(id), { recursive: true });
  await fs.mkdir(path.dirname(configPath(id)), { recursive: true });
  // Засеваем пример бота при первом обращении.
  const files = await fs.readdir(appDir(id)).catch(() => [] as string[]);
  if (files.length === 0) {
    await fs.writeFile(path.join(appDir(id), "bot.py"), SAMPLE_BOT, "utf8");
  }
}

// ── Конфиг ────────────────────────────────────────────────────────────
export async function getConfig(id: string): Promise<BotConfig> {
  await ensureDirs(id);
  try {
    const raw = await fs.readFile(configPath(id), "utf8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(
  id: string,
  patch: Partial<BotConfig>,
): Promise<BotConfig> {
  const current = await getConfig(id);
  const next = { ...current, ...patch };
  await fs.writeFile(configPath(id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

// ── Файлы ─────────────────────────────────────────────────────────────
function fileKind(name: string): BotFile["kind"] {
  if (/\.(py|js|mjs|ts|sh)$/i.test(name)) return "code";
  if (/\.json$/i.test(name)) return "json";
  if (/\.(txt|env|md|cfg|ini|yml|yaml)$/i.test(name)) return "text";
  return "file";
}

// Защита от выхода за пределы директории бота.
function safeJoin(id: string, name: string): string {
  const base = appDir(id);
  const target = path.resolve(base, name);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error("invalid path");
  }
  return target;
}

export async function listFiles(id: string): Promise<BotFile[]> {
  await ensureDirs(id);
  const entries = await fs.readdir(appDir(id), { withFileTypes: true });
  const out: BotFile[] = [];
  for (const e of entries) {
    const full = path.join(appDir(id), e.name);
    const st = await fs.stat(full).catch(() => null);
    out.push({
      name: e.name,
      size: st?.size ?? 0,
      modified: st ? st.mtime.toISOString() : "",
      kind: e.isDirectory() ? "file" : fileKind(e.name),
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function readFile(id: string, name: string): Promise<string> {
  return fs.readFile(safeJoin(id, name), "utf8");
}

export async function writeFile(
  id: string,
  name: string,
  content: string,
): Promise<void> {
  if (!name.trim()) throw new Error("empty name");
  await ensureDirs(id);
  await fs.writeFile(safeJoin(id, name), content, "utf8");
}

export async function deleteFile(id: string, name: string): Promise<void> {
  await fs.rm(safeJoin(id, name), { force: true, recursive: true });
}

async function dirSizeMb(id: string): Promise<number> {
  let total = 0;
  const walk = async (dir: string) => {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else {
        const st = await fs.stat(full).catch(() => null);
        if (st) total += st.size;
      }
    }
  };
  await walk(appDir(id));
  return Math.round(total / (1024 * 1024));
}

// ── Симуляция (когда Docker недоступен) ──────────────────────────────
interface SimState {
  status: BotStatus;
  startedAt: number;
  logs: string[];
}
const sim = new Map<string, SimState>();
function getSim(id: string): SimState {
  let s = sim.get(id);
  if (!s) {
    s = {
      status: "stopped",
      startedAt: 0,
      logs: [
        "Goh Hosting — консоль управления ботом",
        "Демо-режим (движок недоступен локально). На сервере бот запускается в изолированном окружении.",
      ],
    };
    sim.set(id, s);
  }
  return s;
}
function simLog(s: SimState, line: string) {
  const t = new Date().toLocaleTimeString("ru-RU", { hour12: false });
  s.logs.push(`[${t}] ${line}`);
  if (s.logs.length > 300) s.logs = s.logs.slice(-300);
}

// ── Определение режима ───────────────────────────────────────────────
let dockerMode: boolean | null = null;
async function useDocker(): Promise<boolean> {
  if (dockerMode === null) dockerMode = await docker.isAvailable();
  return dockerMode;
}

function imageForFile(file: string): string {
  if (/\.(js|mjs|ts)$/i.test(file)) return "node:22-alpine";
  return "python:3.12-slim";
}

function startCommand(file: string): string[] {
  const f = file.replace(/'/g, "");
  if (/\.(js|mjs)$/i.test(f)) {
    return [
      "sh",
      "-c",
      `if [ -f package.json ]; then npm install --no-audit --no-fund; fi; exec node ${f}`,
    ];
  }
  if (/\.ts$/i.test(f)) {
    return ["sh", "-c", `npm install -g tsx >/dev/null 2>&1; exec npx tsx ${f}`];
  }
  return [
    "sh",
    "-c",
    `if [ -f requirements.txt ]; then pip install --no-cache-dir -r requirements.txt; fi; exec python -u ${f}`,
  ];
}

// ── Жизненный цикл ───────────────────────────────────────────────────
export async function start(id: string): Promise<void> {
  const cfg = await getConfig(id);
  await ensureDirs(id);

  if (!(await useDocker())) {
    const s = getSim(id);
    s.status = "running";
    s.startedAt = Date.now();
    simLog(s, "→ Запуск (симуляция)…");
    simLog(s, `Команда: ${startCommand(cfg.startupFile).slice(-1)[0]}`);
    simLog(s, "✓ Бот «запущен» в режиме симуляции.");
    return;
  }

  const name = containerName(id);
  await docker.remove(name).catch(() => {});
  const image = imageForFile(cfg.startupFile);
  await docker.ensureImage(image);
  await docker.create(name, {
    image,
    cmd: startCommand(cfg.startupFile),
    env: [`BOT_TOKEN=${cfg.token}`, `TELEGRAM_TOKEN=${cfg.token}`],
    workingDir: "/app",
    binds: [`${hostAppDir(id)}:/app`],
    memoryMb: RAM_LIMIT_MB,
    nanoCpus: Math.round(CPU_LIMIT * 1e9),
    pidsLimit: PIDS_LIMIT,
    autoRestart: cfg.autoRestart,
    labels: { "goh.bot": id },
  });
  await docker.start(name);
}

export async function stop(id: string): Promise<void> {
  if (!(await useDocker())) {
    const s = getSim(id);
    s.status = "stopped";
    simLog(s, "✓ Бот остановлен (симуляция).");
    return;
  }
  await docker.stop(containerName(id));
}

export async function restart(id: string): Promise<void> {
  if (!(await useDocker())) {
    const s = getSim(id);
    s.status = "running";
    s.startedAt = Date.now();
    simLog(s, "✓ Бот перезагружен (симуляция).");
    return;
  }
  // Если контейнера ещё нет — создаём через start, иначе перезапускаем.
  const info = await docker.inspect(containerName(id));
  if (!info) await start(id);
  else await docker.restart(containerName(id));
}

export async function getState(id: string): Promise<BotState> {
  const diskMb = await dirSizeMb(id).catch(() => 0);

  if (!(await useDocker())) {
    const s = getSim(id);
    const running = s.status === "running";
    return {
      status: s.status,
      uptimeSec: running ? Math.floor((Date.now() - s.startedAt) / 1000) : 0,
      cpu: running ? Math.round((Math.random() * 6 + 2) * 10) / 10 : 0,
      ram: running ? Math.round(Math.random() * 35 + 60) : 0,
      ramLimit: RAM_LIMIT_MB,
      diskMb,
      mode: "simulated",
    };
  }

  const info = await docker.inspect(containerName(id)).catch(() => null);
  if (!info) {
    return {
      status: "stopped",
      uptimeSec: 0,
      cpu: 0,
      ram: 0,
      ramLimit: RAM_LIMIT_MB,
      diskMb,
      mode: "docker",
    };
  }

  const running = info.State.Running;
  let status: BotStatus = running ? "running" : "stopped";
  if (!running && info.State.ExitCode !== 0 && info.State.Status === "exited") {
    status = "error";
  }

  let cpu = 0;
  let ram = 0;
  let uptimeSec = 0;
  if (running) {
    uptimeSec = Math.max(
      0,
      Math.floor((Date.now() - new Date(info.State.StartedAt).getTime()) / 1000),
    );
    const st = await docker.stats(containerName(id)).catch(() => null);
    if (st) {
      cpu = st.cpuPercent;
      ram = st.memMb;
    }
  }

  return {
    status,
    uptimeSec,
    cpu,
    ram,
    ramLimit: RAM_LIMIT_MB,
    diskMb,
    mode: "docker",
  };
}

export async function getLogs(id: string, tail = 200): Promise<string[]> {
  if (!(await useDocker())) {
    const s = getSim(id);
    // В симуляции добавляем «тик», если запущен, чтобы лог жил.
    if (s.status === "running") {
      const ticks = Math.floor((Date.now() - s.startedAt) / 3000);
      const last = s.logs[s.logs.length - 1] || "";
      if (!last.includes(`тик ${ticks}`) && ticks > 0) {
        simLog(s, `[heartbeat] тик ${ticks} — бот работает 24/7`);
      }
    }
    return s.logs.slice(-tail);
  }

  const raw = await docker.logs(containerName(id), tail).catch(() => "");
  if (!raw.trim()) return [];
  return raw.split(/\r?\n/).filter((l) => l.length > 0);
}
