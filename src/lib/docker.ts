import http from "node:http";

// Низкоуровневый клиент Docker Engine API через unix-сокет.
// Без внешних зависимостей: используем встроенный node:http с socketPath.

const SOCKET = process.env.DOCKER_SOCKET || "/var/run/docker.sock";

export type DockerResult = { status: number; body: string };

function request(
  method: string,
  path: string,
  body?: unknown,
): Promise<DockerResult> {
  return new Promise((resolve, reject) => {
    const data =
      body !== undefined ? Buffer.from(JSON.stringify(body)) : undefined;

    const req = http.request(
      {
        socketPath: SOCKET,
        method,
        path,
        // Длинный таймаут: первый старт может тянуть образ (pip/npm install внутри).
        timeout: 600_000,
        headers: {
          Host: "docker",
          Accept: "application/json",
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": data.length,
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c as Buffer));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            body: Buffer.concat(chunks).toString("utf8"),
          }),
        );
      },
    );

    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("docker socket timeout")));
    if (data) req.write(data);
    req.end();
  });
}

function parse<T>(res: DockerResult): T {
  return JSON.parse(res.body) as T;
}

/** Доступен ли Docker-демон (есть ли сокет и отвечает ли он). */
export async function isAvailable(): Promise<boolean> {
  try {
    const res = await request("GET", "/_ping");
    return res.status === 200;
  } catch {
    return false;
  }
}

export interface ContainerState {
  Status: string; // created | running | exited | ...
  Running: boolean;
  StartedAt: string;
  ExitCode: number;
}

export interface InspectResult {
  Id: string;
  State: ContainerState;
  Config: { Image: string };
}

/** Инспектирует контейнер по имени/id. null — если не найден. */
export async function inspect(name: string): Promise<InspectResult | null> {
  const res = await request("GET", `/containers/${name}/json`);
  if (res.status === 404) return null;
  if (res.status >= 400) throw new Error(`inspect failed: ${res.body}`);
  return parse<InspectResult>(res);
}

/** Скачивает образ, если его нет локально. */
export async function ensureImage(image: string): Promise<void> {
  // Проверяем наличие образа.
  const check = await request("GET", `/images/${encodeURIComponent(image)}/json`);
  if (check.status === 200) return;

  // Тянем образ (ответ стримится строками JSON до завершения).
  const [name, tag = "latest"] = image.split(":");
  const res = await request(
    "POST",
    `/images/create?fromImage=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`,
  );
  if (res.status >= 400) {
    throw new Error(`pull failed (${res.status}): ${res.body}`);
  }
  // ИСПРАВЛЕНИЕ: Docker Engine возвращает 200 и стримит построчный JSON,
  // даже если сама загрузка образа упала (например, образ не найден или нет
  // сети) — по HTTP-статусу это не видно, ошибка приходит внутри потока.
  // Без этой проверки ensureImage() «успешно» завершался, а следующий
  // create() падал с непонятным "No such image".
  const failedPull = res.body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line) as { error?: string };
      } catch {
        return null;
      }
    })
    .find((entry) => entry?.error);
  if (failedPull?.error) {
    throw new Error(`pull failed: ${failedPull.error}`);
  }
}

/** Выполняет команду внутри уже запущенного контейнера (аналог `docker exec`). */
export async function exec(
  name: string,
  cmd: string[],
): Promise<{ exitCode: number; output: string }> {
  const create = await request("POST", `/containers/${name}/exec`, {
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
    Tty: true,
  });
  if (create.status >= 400) {
    throw new Error(`exec create failed (${create.status}): ${create.body}`);
  }
  const { Id: execId } = parse<{ Id: string }>(create);

  // Tty:true => плоский текст в ответе, без мультиплексирования (как в logs()).
  const start = await request("POST", `/exec/${execId}/start`, {
    Detach: false,
    Tty: true,
  });
  if (start.status >= 400) {
    throw new Error(`exec start failed (${start.status}): ${start.body}`);
  }
  // eslint-disable-next-line no-control-regex
  const output = start.body.replace(/[\u0000-\u0008\u000b-\u001f]/g, "");

  let exitCode = 0;
  const inspect = await request("GET", `/exec/${execId}/json`);
  if (inspect.status < 400) {
    exitCode = parse<{ ExitCode: number | null }>(inspect).ExitCode ?? 0;
  }
  return { exitCode, output };
}

export interface CreateOptions {
  image: string;
  cmd: string[];
  env: string[];
  workingDir: string;
  binds: string[];
  memoryMb: number;
  nanoCpus: number;
  pidsLimit: number;
  autoRestart: boolean;
  labels: Record<string, string>;
}

/** Создаёт контейнер с жёсткой изоляцией. Возвращает id. */
export async function create(name: string, o: CreateOptions): Promise<string> {
  const config = {
    Image: o.image,
    Cmd: o.cmd,
    Env: o.env,
    WorkingDir: o.workingDir,
    Tty: true, // плоские логи без мультиплексирования
    Labels: o.labels,
    HostConfig: {
      Binds: o.binds,
      Memory: o.memoryMb * 1024 * 1024,
      MemorySwap: o.memoryMb * 1024 * 1024, // без доп. swap
      NanoCpus: o.nanoCpus,
      PidsLimit: o.pidsLimit,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      RestartPolicy: { Name: o.autoRestart ? "unless-stopped" : "no" },
    },
  };

  const res = await request(
    "POST",
    `/containers/create?name=${encodeURIComponent(name)}`,
    config,
  );
  if (res.status >= 400) {
    throw new Error(`create failed (${res.status}): ${res.body}`);
  }
  return parse<{ Id: string }>(res).Id;
}

export async function start(name: string): Promise<void> {
  const res = await request("POST", `/containers/${name}/start`);
  if (res.status >= 400 && res.status !== 304) {
    throw new Error(`start failed (${res.status}): ${res.body}`);
  }
}

export async function stop(name: string, timeoutSec = 5): Promise<void> {
  const res = await request("POST", `/containers/${name}/stop?t=${timeoutSec}`);
  if (res.status >= 400 && res.status !== 304 && res.status !== 404) {
    throw new Error(`stop failed (${res.status}): ${res.body}`);
  }
}

export async function restart(name: string, timeoutSec = 5): Promise<void> {
  const res = await request(
    "POST",
    `/containers/${name}/restart?t=${timeoutSec}`,
  );
  if (res.status >= 400 && res.status !== 404) {
    throw new Error(`restart failed (${res.status}): ${res.body}`);
  }
}

export async function remove(name: string): Promise<void> {
  const res = await request("DELETE", `/containers/${name}?force=true&v=true`);
  if (res.status >= 400 && res.status !== 404) {
    throw new Error(`remove failed (${res.status}): ${res.body}`);
  }
}

export async function logs(name: string, tail = 200): Promise<string> {
  const res = await request(
    "GET",
    `/containers/${name}/logs?stdout=true&stderr=true&tail=${tail}`,
  );
  if (res.status === 404) return "";
  if (res.status >= 400) throw new Error(`logs failed: ${res.body}`);
  // Tty:true => плоский текст. Чистим управляющие байты на всякий случай.
  // eslint-disable-next-line no-control-regex
  return res.body.replace(/[\u0000-\u0008\u000b-\u001f]/g, "");
}

export interface DockerStats {
  cpu_stats: CpuStats;
  precpu_stats: CpuStats;
  memory_stats: { usage?: number; limit?: number; stats?: { cache?: number } };
}

interface CpuStats {
  cpu_usage: { total_usage: number };
  system_cpu_usage?: number;
  online_cpus?: number;
}

export async function stats(
  name: string,
): Promise<{ cpuPercent: number; memMb: number } | null> {
  const res = await request("GET", `/containers/${name}/stats?stream=false`);
  if (res.status === 404 || res.status >= 400) return null;
  let s: DockerStats;
  try {
    s = parse<DockerStats>(res);
  } catch {
    return null;
  }

  const cpuDelta =
    s.cpu_stats.cpu_usage.total_usage - s.precpu_stats.cpu_usage.total_usage;
  const sysDelta =
    (s.cpu_stats.system_cpu_usage ?? 0) -
    (s.precpu_stats.system_cpu_usage ?? 0);
  const cpus = s.cpu_stats.online_cpus ?? 1;
  let cpuPercent = 0;
  if (cpuDelta > 0 && sysDelta > 0) {
    cpuPercent = (cpuDelta / sysDelta) * cpus * 100;
  }

  const cache = s.memory_stats.stats?.cache ?? 0;
  const usage = Math.max(0, (s.memory_stats.usage ?? 0) - cache);
  const memMb = usage / (1024 * 1024);

  return {
    cpuPercent: Math.round(cpuPercent * 10) / 10,
    memMb: Math.round(memMb),
  };
}
