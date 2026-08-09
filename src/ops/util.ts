export type Level = "debug" | "info" | "warn" | "error";

const rank: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export class Logger {
  constructor(
    private level: Level,
    private ctx: string,
  ) {}

  private emit(level: Level, message: string, meta?: Record<string, unknown>): void {
    if (rank[level] < rank[this.level]) return;
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      level,
      ctx: this.ctx,
      message,
      ...(meta ?? {}),
    });
    if (level === "error") console.error(line);
    else console.log(line);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.emit("debug", message, meta);
  }
  info(message: string, meta?: Record<string, unknown>): void {
    this.emit("info", message, meta);
  }
  warn(message: string, meta?: Record<string, unknown>): void {
    this.emit("warn", message, meta);
  }
  error(message: string, meta?: Record<string, unknown>): void {
    this.emit("error", message, meta);
  }
}

export async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

export async function withRetry<T>(
  label: string,
  fn: () => Promise<T>,
  retries = 3,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= retries; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      if (i === retries) break;
      await sleep(200 * 2 ** i);
    }
  }
  throw new Error(`${label}: ${last instanceof Error ? last.message : String(last)}`);
}
