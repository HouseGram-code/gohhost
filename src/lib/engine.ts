import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import * as docker from "./docker";

// ── Движок Goh Hosting (только реальный режим) ───────────────────────
// Запускает каждого бота в отдельном изолированном контейнере и держит
// его онлайн 24/7 (политика автоперезапуска). Без симуляции.
// Управление возможно только там, где доступен движок контейнеров
// (на сервере). Проверяется через available().

const DATA_DIR =
  process.env.DATA_DIR || path.join(os.tmpdir(), "goh-hosting-data");
// Путь к данным НА ХОСТЕ — для bind-mount дочерних контейнеров (из compose).
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
print("Токен:", "задан" if token else "не задан", flush=True)
print("Замените этот файл на код своего Telegram-бота", flush=True)

i = 0
while True:
    i += 1
    print(f"[heartbeat] тик {i} — бот работает 24/7", flush=True)
    time.sleep(3)
`;

// ── Доступность движка ───────────────────────────────────────────────
export async function available(): Promise<boolean> {
  return docker.isAvailable();
}

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
  try {
    await fs.mkdir(appDir(id), { recursive: true });
    await fs.mkdir(path.dirname(configPath(id)), { recursive: true });
    const files = await fs.readdir(appDir(id)).catch(() => [] as string[]);
    if (files.length === 0) {
      await fs.writeFile(path.join(appDir(id), "bot.py"), SAMPLE_BOT, "utf8");
    }
  } catch {
    /* ФС только для чтения — пропускаем (управление всё равно недоступно) */
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
  const entries = await fs
    .readdir(appDir(id), { withFileTypes: true })
    .catch(() => []);
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
    const entries = await fs
      .readdir(dir, { withFileTypes: true })
      .catch(() => []);
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

// ── Запуск контейнеров ───────────────────────────────────────────────
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
    autoRestart: cfg.autoRestart, // unless-stopped => бот живёт 24/7
    labels: { "goh.bot": id },
  });
  await docker.start(name);
}

export async function stop(id: string): Promise<void> {
  await docker.stop(containerName(id));
}

export async function restart(id: string): Promise<void> {
  const info = await docker.inspect(containerName(id));
  if (!info) await start(id);
  else await docker.restart(containerName(id));
}

export async function getState(id: string): Promise<BotState> {
  const diskMb = await dirSizeMb(id).catch(() => 0);

  const info = await docker.inspect(containerName(id)).catch(() => null);
  if (!info) {
    return {
      status: "stopped",
      uptimeSec: 0,
      cpu: 0,
      ram: 0,
      ramLimit: RAM_LIMIT_MB,
      diskMb,
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

  return { status, uptimeSec, cpu, ram, ramLimit: RAM_LIMIT_MB, diskMb };
}

export async function getLogs(id: string, tail = 200): Promise<string[]> {
  const raw = await docker.logs(containerName(id), tail).catch(() => "");
  if (!raw.trim()) return [];
  return raw.split(/\r?\n/).filter((l) => l.length > 0);
}
