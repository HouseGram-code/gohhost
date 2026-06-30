import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { hashPassword, verifyPassword } from "./auth";
import * as engine from "./engine";

// Хранилище аккаунтов и серверов (JSON-файлы в /data/accounts) + бизнес-логика.
// Единственный писатель — это веб-процесс (бот ходит через HTTP API),
// поэтому хватает сериализации записи внутри процесса.

const DATA_DIR =
  process.env.DATA_DIR || path.join(os.tmpdir(), "goh-hosting-data");
const DIR = path.join(DATA_DIR, "accounts");
const USERS_FILE = path.join(DIR, "users.json");
const SERVERS_FILE = path.join(DIR, "servers.json");

const FREE_SERVER_LIMIT = 1; // бесплатный тариф — 1 сервер на аккаунт

export interface User {
  id: string;
  telegramId: number | null;
  nickname: string;
  passwordHash: string;
  createdAt: string;
}

export interface Server {
  id: string;
  ownerId: string;
  name: string;
  tariff: string;
  createdAt: string;
}

export interface PublicServer {
  id: string;
  name: string;
  tariff: string;
  createdAt: string;
  status: string;
  cpu: number;
  ram: number;
  ramLimit: number;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

let chain: Promise<unknown> = Promise.resolve();
function lock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => {},
    () => {},
  );
  return run;
}

async function read<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}
async function write(file: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await fs.rename(tmp, file);
}

function newId(): string {
  return crypto.randomBytes(9).toString("hex");
}
function normNick(n: string): string {
  return n.trim().toLowerCase();
}

// ── Пользователи ─────────────────────────────────────────────────────
export async function getUserById(uid: string): Promise<User | null> {
  const users = await read<User[]>(USERS_FILE, []);
  return users.find((u) => u.id === uid) ?? null;
}
export async function getUserByNickname(n: string): Promise<User | null> {
  const users = await read<User[]>(USERS_FILE, []);
  return users.find((u) => u.nickname === normNick(n)) ?? null;
}
export async function getUserByTelegram(tid: number): Promise<User | null> {
  const users = await read<User[]>(USERS_FILE, []);
  return users.find((u) => u.telegramId === tid) ?? null;
}

export async function registerUser(opts: {
  nickname: string;
  password: string;
  telegramId?: number | null;
}): Promise<Result<User>> {
  const n = normNick(opts.nickname);
  if (n.length < 3)
    return { ok: false, error: "Никнейм слишком короткий (минимум 3 символа)" };
  if (!/^[a-z0-9_]+$/.test(n))
    return { ok: false, error: "Никнейм: только латиница, цифры и _" };
  if (opts.password.length < 4)
    return { ok: false, error: "Пароль слишком короткий (минимум 4 символа)" };

  return lock(async () => {
    const users = await read<User[]>(USERS_FILE, []);
    if (users.some((u) => u.nickname === n))
      return { ok: false as const, error: "Этот никнейм уже занят" };
    if (opts.telegramId && users.some((u) => u.telegramId === opts.telegramId))
      return { ok: false as const, error: "У вас уже есть аккаунт" };

    const user: User = {
      id: newId(),
      telegramId: opts.telegramId ?? null,
      nickname: n,
      passwordHash: hashPassword(opts.password),
      createdAt: new Date().toISOString(),
    };
    users.push(user);
    await write(USERS_FILE, users);
    return { ok: true as const, value: user };
  });
}

export async function login(
  nickname: string,
  password: string,
): Promise<User | null> {
  const user = await getUserByNickname(nickname);
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? user : null;
}

// ── Серверы ──────────────────────────────────────────────────────────
export async function getServer(serverId: string): Promise<Server | null> {
  const servers = await read<Server[]>(SERVERS_FILE, []);
  return servers.find((s) => s.id === serverId) ?? null;
}
export async function userOwnsServer(
  uid: string,
  serverId: string,
): Promise<boolean> {
  const s = await getServer(serverId);
  return !!s && s.ownerId === uid;
}
export async function listServersRaw(ownerId: string): Promise<Server[]> {
  const servers = await read<Server[]>(SERVERS_FILE, []);
  return servers.filter((s) => s.ownerId === ownerId);
}

export async function createServer(
  ownerId: string,
  name: string,
  tariff = "free",
): Promise<Result<Server>> {
  const nm = name.trim();
  if (nm.length < 2)
    return { ok: false, error: "Название сервера слишком короткое" };

  const created = await lock(async () => {
    const servers = await read<Server[]>(SERVERS_FILE, []);
    const mine = servers.filter((s) => s.ownerId === ownerId);
    if (
      tariff === "free" &&
      mine.filter((s) => s.tariff === "free").length >= FREE_SERVER_LIMIT
    )
      return {
        ok: false as const,
        error: "Бесплатный тариф можно использовать только один раз (1 сервер)",
      };

    const server: Server = {
      id: newId(),
      ownerId,
      name: nm,
      tariff,
      createdAt: new Date().toISOString(),
    };
    servers.push(server);
    await write(SERVERS_FILE, servers);
    return { ok: true as const, value: server };
  });

  // Засеваем конфиг/файлы движка под этот сервер (имя + пример bot.py).
  if (created.ok) {
    try {
      await engine.saveConfig(created.value.id, { name: nm });
    } catch {
      /* запись конфига не критична для создания записи сервера */
    }
  }
  return created;
}

export async function listServersWithStatus(
  ownerId: string,
): Promise<PublicServer[]> {
  const servers = await listServersRaw(ownerId);
  const out: PublicServer[] = [];
  for (const s of servers) {
    let status = "stopped";
    let cpu = 0;
    let ram = 0;
    let ramLimit = 150;
    try {
      const st = await engine.getState(s.id);
      status = st.status;
      cpu = st.cpu;
      ram = st.ram;
      ramLimit = st.ramLimit;
    } catch {
      /* движок недоступен — отдаём запись без живого статуса */
    }
    out.push({
      id: s.id,
      name: s.name,
      tariff: s.tariff,
      createdAt: s.createdAt,
      status,
      cpu,
      ram,
      ramLimit,
    });
  }
  return out;
}

export async function deleteServer(
  ownerId: string,
  serverId: string,
): Promise<boolean> {
  return lock(async () => {
    const servers = await read<Server[]>(SERVERS_FILE, []);
    const idx = servers.findIndex(
      (s) => s.id === serverId && s.ownerId === ownerId,
    );
    if (idx === -1) return false;
    servers.splice(idx, 1);
    await write(SERVERS_FILE, servers);
    return true;
  });
}
