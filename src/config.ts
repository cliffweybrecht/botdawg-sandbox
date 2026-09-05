export interface StockAgentConfig {
  readonly terminalBaseUrl: string;
  readonly httpTimeoutMs: number;
  readonly drilldownLimit: number;
  readonly staleAfterMs: number;
}

function requirePositiveInt(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer (got ${JSON.stringify(raw)})`);
  }
  return n;
}

export function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): StockAgentConfig {
  const base = env.STOCK_AGENT_TERMINAL_BASE_URL?.trim();
  if (!base) {
    throw new Error("STOCK_AGENT_TERMINAL_BASE_URL is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(base);
  } catch {
    throw new Error(`STOCK_AGENT_TERMINAL_BASE_URL is not a valid URL: ${base}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("STOCK_AGENT_TERMINAL_BASE_URL must be http or https");
  }
  return {
    terminalBaseUrl: normalizeBaseUrl(base),
    httpTimeoutMs: requirePositiveInt(env.STOCK_AGENT_HTTP_TIMEOUT_MS, 15_000, "STOCK_AGENT_HTTP_TIMEOUT_MS"),
    drilldownLimit: requirePositiveInt(env.STOCK_AGENT_DRILLDOWN_LIMIT, 5, "STOCK_AGENT_DRILLDOWN_LIMIT"),
    staleAfterMs: requirePositiveInt(env.STOCK_AGENT_STALE_AFTER_MS, 60_000, "STOCK_AGENT_STALE_AFTER_MS"),
  };
}

export function loadConfigForCli(
  env: NodeJS.ProcessEnv,
  overrides: { drilldownLimit?: number } = {},
): StockAgentConfig {
  const cfg = loadConfig(env);
  if (overrides.drilldownLimit !== undefined) {
    if (!Number.isInteger(overrides.drilldownLimit) || overrides.drilldownLimit <= 0) {
      throw new Error("--limit must be a positive integer");
    }
    return { ...cfg, drilldownLimit: overrides.drilldownLimit };
  }
  return cfg;
}
