import type { StockAgentConfig } from "../config.js";
import { TerminalClientError } from "./errors.js";
import {
  assetExecutableDepthResponseSchema,
  assetExecutionComparisonResponseSchema,
  marketLiquidityResponseSchema,
  terminalErrorBodySchema,
  type AssetExecutableDepthDto,
  type AssetExecutionComparisonDto,
  type MarketLiquiditySnapshot,
} from "./types.js";

export interface TerminalClientOptions {
  readonly config: StockAgentConfig;
  readonly fetchImpl?: typeof fetch;
  readonly now?: () => Date;
}

export interface TerminalOk<T> {
  readonly ok: true;
  readonly data: T;
  readonly retrievedAt: string;
  readonly sourceEndpoint: string;
  readonly httpStatus: number;
}

export interface TerminalFail {
  readonly ok: false;
  readonly error: TerminalClientError;
  readonly retrievedAt: string;
  readonly sourceEndpoint: string;
}

export type TerminalResult<T> = TerminalOk<T> | TerminalFail;

type MarketLiquidityResult = {
  snapshot: MarketLiquiditySnapshot;
  cache?: unknown;
};

export class TerminalClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;

  constructor(options: TerminalClientOptions) {
    this.baseUrl = options.config.terminalBaseUrl;
    this.timeoutMs = options.config.httpTimeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date());
  }

  async getMarketLiquidity(): Promise<TerminalResult<MarketLiquidityResult>> {
    const sourceEndpoint = `${this.baseUrl}/api/market/liquidity`;
    return this.requestJson({
      sourceEndpoint,
      method: "GET",
      schema: marketLiquidityResponseSchema,
      map: (body) => {
        const result: MarketLiquidityResult = { snapshot: body.data };
        if (body.cache !== undefined) result.cache = body.cache;
        return result;
      },
    });
  }

  async postExecutionCompare(symbol: string): Promise<TerminalResult<AssetExecutionComparisonDto>> {
    const sourceEndpoint = `${this.baseUrl}/api/assets/${encodeURIComponent(symbol)}/execution/compare`;
    return this.requestJson({
      sourceEndpoint,
      method: "POST",
      body: {},
      schema: assetExecutionComparisonResponseSchema,
      map: (body) => body.data,
    });
  }

  async postExecutionDepthThresholds(symbol: string): Promise<TerminalResult<AssetExecutableDepthDto>> {
    const sourceEndpoint = `${this.baseUrl}/api/assets/${encodeURIComponent(symbol)}/execution/depth-thresholds`;
    return this.requestJson({
      sourceEndpoint,
      method: "POST",
      body: {},
      schema: assetExecutableDepthResponseSchema,
      map: (body) => body.data,
    });
  }

  private async requestJson<TSchema, TOut>(input: {
    sourceEndpoint: string;
    method: "GET" | "POST";
    body?: unknown;
    schema: { safeParse: (data: unknown) => { success: true; data: TSchema } | { success: false; error: unknown } };
    map: (data: TSchema) => TOut;
  }): Promise<TerminalResult<TOut>> {
    const retrievedAt = this.now().toISOString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const init: RequestInit = {
        method: input.method,
        signal: controller.signal,
        headers: { Accept: "application/json" },
      };
      if (input.method === "POST") {
        init.headers = { ...init.headers, "Content-Type": "application/json" };
        init.body = JSON.stringify(input.body ?? {});
      }
      const res = await this.fetchImpl(input.sourceEndpoint, init);
      const text = await res.text();
      let json: unknown;
      try {
        json = text.trim() === "" ? undefined : JSON.parse(text);
      } catch (cause) {
        return {
          ok: false,
          retrievedAt,
          sourceEndpoint: input.sourceEndpoint,
          error: new TerminalClientError({
            kind: "MALFORMED_BODY",
            message: `Terminal returned non-JSON body (HTTP ${res.status})`,
            sourceEndpoint: input.sourceEndpoint,
            httpStatus: res.status,
            cause,
          }),
        };
      }

      if (!res.ok) {
        const parsedErr = terminalErrorBodySchema.safeParse(json);
        const errorCode = parsedErr.success ? parsedErr.data.error.code : undefined;
        const message = parsedErr.success
          ? parsedErr.data.error.message
          : `Terminal HTTP ${res.status}`;
        const kind = res.status === 503 || errorCode === "VERIFICATION_DEGRADED" ? "DEGRADED" : "HTTP";
        return {
          ok: false,
          retrievedAt,
          sourceEndpoint: input.sourceEndpoint,
          error: new TerminalClientError({
            kind,
            message,
            sourceEndpoint: input.sourceEndpoint,
            httpStatus: res.status,
            ...(errorCode !== undefined ? { errorCode } : {}),
          }),
        };
      }

      const parsed = input.schema.safeParse(json);
      if (!parsed.success) {
        return {
          ok: false,
          retrievedAt,
          sourceEndpoint: input.sourceEndpoint,
          error: new TerminalClientError({
            kind: "SCHEMA",
            message: "Terminal response failed Stock Agent wire-schema validation",
            sourceEndpoint: input.sourceEndpoint,
            httpStatus: res.status,
            cause: parsed.error,
          }),
        };
      }

      return {
        ok: true,
        data: input.map(parsed.data),
        retrievedAt,
        sourceEndpoint: input.sourceEndpoint,
        httpStatus: res.status,
      };
    } catch (cause) {
      const isAbort =
        (cause instanceof Error && cause.name === "AbortError") ||
        (typeof cause === "object" && cause !== null && "name" in cause && (cause as { name: string }).name === "AbortError");
      return {
        ok: false,
        retrievedAt,
        sourceEndpoint: input.sourceEndpoint,
        error: new TerminalClientError({
          kind: isAbort ? "TIMEOUT" : "NETWORK",
          message: isAbort
            ? `Terminal request timed out after ${this.timeoutMs}ms`
            : `Terminal network error: ${cause instanceof Error ? cause.message : String(cause)}`,
          sourceEndpoint: input.sourceEndpoint,
          cause,
        }),
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
