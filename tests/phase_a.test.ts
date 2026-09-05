import { describe, it, expect, vi, afterEach } from "vitest";
import { TerminalClient } from "../src/terminal/client.js";
import { assembleMarketIntelligenceReport } from "../src/market/assemble.js";
import { formatReportHuman, assertNoForbiddenClaims } from "../src/market/format.js";
import { classifyOkRetrieval } from "../src/quality/classify.js";
import { NATIVE_ETH } from "../src/terminal/types.js";
import type { StockAgentConfig } from "../src/config.js";

const cfg: StockAgentConfig = {
  terminalBaseUrl: "http://terminal.test",
  httpTimeoutMs: 1000,
  drilldownLimit: 1,
  staleAfterMs: 60000,
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const marketBody = {
  data: {
    refreshStartedAt: "2026-09-04T00:00:00.000Z",
    generatedAt: "2026-09-04T00:01:00.000Z",
    refreshDurationMs: 1000,
    assetsRequested: 2,
    assetsSucceeded: 1,
    assetsFailed: 1,
    completeness: { complete: false, successPct: 50 },
    rows: [
      {
        asset: {
          symbol: "NVDA",
          name: "NVIDIA",
          contractAddress: "0x1111111111111111111111111111111111111111",
          logoUrl: null,
        },
        displayedLiquidityUsd: 1000000,
        usdGLiquidityUsd: 1000000,
        poolCount: 2,
        dexCount: 2,
        observedVolume24h: 1,
        buys24h: 1,
        sells24h: 1,
        largestPoolLiquidityUsd: 1,
        top1ConcentrationPct: 1,
        top3ConcentrationPct: 1,
        top5ConcentrationPct: 1,
        liquidityCoverageComplete: true,
        volume24hCoverageComplete: true,
        robinhoodReferencePriceUsd: 100,
        dexLiquidityWeightedPriceUsd: 101,
        dexMedianPriceUsd: 101,
        premiumDiscountPct: 1,
        priceDispersionPct: 0.1,
        priceCoverageComplete: true,
      },
    ],
    failures: [
      {
        symbol: "FAIL",
        contractAddress: "0x2222222222222222222222222222222222222222",
        category: "DEXSCREENER_TIMEOUT",
        message: "timeout",
      },
    ],
    price: {
      available: true,
      generatedAt: "2026-09-04T00:01:00.000Z",
      symbolsMatched: 1,
      symbolsMissing: 0,
      missingSymbols: [],
      symbolsInvalid: 0,
      invalidSymbols: [],
      oldestQuoteGeneratedAt: "2026-09-04T00:00:50.000Z",
      newestQuoteGeneratedAt: "2026-09-04T00:00:50.000Z",
    },
  },
};

const compareOk = {
  data: {
    groups: [{ tokenOut: NATIVE_ETH, candidateCount: 1, v3Count: 0, v4Count: 1 }],
    selectedTokenOut: NATIVE_ETH,
    comparison: {
      status: "OK" as const,
      blockNumber: "100",
      fetchedAt: "2026-09-04T00:02:00.000Z",
      tokenIn: "0x1111111111111111111111111111111111111111",
      tokenOut: NATIVE_ETH,
      amountIn: "1000000",
      sharedAnalyticsStatus: "OK",
      candidates: [
        {
          pairAddress: "0xpool",
          dexId: "uniswap",
          family: "UNISWAP_V4" as const,
          status: "QUOTED",
          amountOut: "2000",
          analyticsStatus: "OK",
          gasEstimate: "21000",
          priceImpactBps: { numerator: "1", denominator: "100" },
        },
      ],
      ranking: {
        rankedQuotedPoolAddresses: ["0xpool"],
        bestCandidatePoolAddresses: ["0xpool"],
      },
    },
  },
};

const depthOk = {
  data: {
    groups: [{ tokenOut: NATIVE_ETH, candidateCount: 1, v3Count: 0, v4Count: 1 }],
    selectedTokenOut: NATIVE_ETH,
    result: {
      status: "OK" as const,
      blockNumber: "101",
      fetchedAt: "2026-09-04T00:03:00.000Z",
      tokenIn: "0x1111111111111111111111111111111111111111",
      tokenOut: NATIVE_ETH,
      sharedAnalyticsStatus: "OK",
      ladderAmountsIn: ["1", "2"],
      thresholdsBps: [50, 100],
      pools: [
        {
          pairAddress: "0xpool",
          dexId: "uniswap",
          family: "UNISWAP_V4" as const,
          status: "EXECUTABLE" as const,
          ladder: [{ amountIn: "1", status: "QUOTED", analyticsStatus: "OK" }],
          outcomesByThreshold: [
            {
              thresholdBps: 50,
              kind: "WITHIN_THRESHOLD" as const,
              qualifyingAmountIn: "1",
              monotonicityObserved: true,
              upperRange: { kind: "GAPPED_CEILING", nextMeasuredAmountIn: "2" },
            },
            { thresholdBps: 100, kind: "ANALYTICS_UNAVAILABLE" as const },
          ],
        },
      ],
      bestVenueByThreshold: [{ thresholdBps: 50, poolAddresses: ["0xpool"] }],
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Phase A terminal client and assembly", () => {
  it("assembles healthy report with independent block pins and NATIVE_ETH", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/market/liquidity")) return jsonResponse(200, marketBody);
      if (u.includes("/execution/compare")) return jsonResponse(200, compareOk);
      if (u.includes("/execution/depth-thresholds")) return jsonResponse(200, depthOk);
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "no" } });
    });
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({
      config: cfg,
      client,
      now: () => new Date("2026-09-04T00:04:00.000Z"),
    });
    expect(report.phase).toBe("A");
    expect(report.assets).toHaveLength(1);
    const asset = report.assets[0]!;
    expect(asset.contractAddress).toBe("0x1111111111111111111111111111111111111111");
    expect(asset.compare.status).toBe("AVAILABLE");
    expect(asset.depth.status).toBe("AVAILABLE");
    if (asset.compare.status !== "AVAILABLE" || asset.depth.status !== "AVAILABLE") {
      throw new Error("expected AVAILABLE");
    }
    expect(asset.compare.dto.selectedTokenOut).toBe(NATIVE_ETH);
    expect(asset.compare.dto.selectedTokenOut).not.toBe("WETH");
    expect(asset.compare.quality.blockNumber).toBe("100");
    expect(asset.depth.quality.blockNumber).toBe("101");
    expect(asset.compare.quality.blockNumber).not.toBe(asset.depth.quality.blockNumber);
    expect(report.market.snapshot.failures).toHaveLength(1);
    expect(report.market.snapshot.completeness.complete).toBe(false);
    expect(asset.notes.some((n) => n.includes("independent_block_pins"))).toBe(true);
    expect(asset.notes.some((n) => n.includes("sampled_depth_gapped_ceiling"))).toBe(true);
    expect(asset.notes.some((n) => n.includes("sampled_depth_analytics_unavailable"))).toBe(true);
    expect(asset.notes.some((n) => n.includes("selectedTokenOut=NATIVE_ETH"))).toBe(true);
    const human = formatReportHuman(report);
    expect(human).toContain("compare status: AVAILABLE");
    expect(human).toContain("depth status: AVAILABLE");
    expect(human).toContain("sampled depth evidence (not continuous depth)");
    assertNoForbiddenClaims(human);
    assertNoForbiddenClaims(JSON.stringify(report));
    const blob = JSON.stringify(report);
    expect(blob).not.toMatch(/profitab|arbitrage|opportunityScore|continuousDepth|executableOpportunity/i);
  });

  it("maps 503 VERIFICATION_DEGRADED to structured UNAVAILABLE compare with DEGRADED quality", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/market/liquidity")) return jsonResponse(200, marketBody);
      if (u.includes("/execution/compare")) {
        return jsonResponse(503, { error: { code: "VERIFICATION_DEGRADED", message: "degraded" } });
      }
      if (u.includes("/execution/depth-thresholds")) return jsonResponse(200, depthOk);
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "no" } });
    });
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({
      config: cfg,
      client,
      now: () => new Date("2026-09-04T00:04:00.000Z"),
    });
    const asset = report.assets[0]!;
    expect(asset.compare.status).toBe("UNAVAILABLE");
    if (asset.compare.status !== "UNAVAILABLE") throw new Error("expected UNAVAILABLE");
    expect(asset.compare.quality.level).toBe("DEGRADED");
    expect(asset.compare.failure.kind).toBe("VERIFICATION_DEGRADED");
    expect(asset.compare.failure.errorCode).toBe("VERIFICATION_DEGRADED");
    expect(asset.compare.dto).toBeUndefined();
    expect(asset.depth.status).toBe("AVAILABLE");
    expect(asset.depth.quality.level).toBe("VERIFIED");
    const human = formatReportHuman(report);
    expect(human).toContain("compare status: UNAVAILABLE");
    expect(human).toContain("compare failure.kind: VERIFICATION_DEGRADED");
  });

  it("handles market timeout as UNAVAILABLE with empty assets", async () => {
    const fetchImpl = vi.fn(async () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      throw err;
    });
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({ config: cfg, client });
    expect(report.market.quality.level).toBe("UNAVAILABLE");
    expect(report.assets).toHaveLength(0);
  });

  it("treats malformed JSON as UNAVAILABLE", async () => {
    const fetchImpl = vi.fn(async () => new Response("not-json", { status: 200 }));
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({ config: cfg, client });
    expect(report.market.quality.level).toBe("UNAVAILABLE");
  });

  it("records BLOCK_PIN_FAILURE as structured UNAVAILABLE with dto retained", async () => {
    const comparePin = {
      data: {
        groups: [],
        selectedTokenOut: NATIVE_ETH,
        comparison: {
          status: "BLOCK_PIN_FAILURE" as const,
          fetchedAt: "2026-09-04T00:02:00.000Z",
          tokenIn: "0x1",
          tokenOut: NATIVE_ETH,
          amountIn: "1",
        },
      },
    };
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/market/liquidity")) return jsonResponse(200, marketBody);
      if (u.includes("/execution/compare")) return jsonResponse(200, comparePin);
      if (u.includes("/execution/depth-thresholds")) return jsonResponse(200, depthOk);
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "no" } });
    });
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({
      config: cfg,
      client,
      now: () => new Date("2026-09-04T00:04:00.000Z"),
    });
    const c = report.assets[0]!.compare;
    expect(c.status).toBe("UNAVAILABLE");
    if (c.status !== "UNAVAILABLE") throw new Error("expected UNAVAILABLE");
    expect(c.quality.level).toBe("UNAVAILABLE");
    expect(c.quality.blockNumber).toBeUndefined();
    expect(c.quality.errorCode).toBe("BLOCK_PIN_FAILURE");
    expect(c.failure.kind).toBe("BLOCK_PIN_FAILURE");
    expect(c.dto?.comparison.status).toBe("BLOCK_PIN_FAILURE");
    const human = formatReportHuman(report);
    expect(human).toContain("compare failure.kind: BLOCK_PIN_FAILURE");
  });

  it("classifies STALE when snapshot is old", () => {
    const q = classifyOkRetrieval({
      sourceEndpoint: "http://t/api/market/liquidity",
      retrievedAt: "2026-09-04T00:00:00.000Z",
      sourceGeneratedAt: "2026-09-04T00:00:00.000Z",
      staleAfterMs: 1000,
      nowMs: Date.parse("2026-09-04T00:10:00.000Z"),
    });
    expect(q.level).toBe("STALE");
    expect(q.blockNumber).toBeUndefined();
  });

  it("records MISSING_TOKEN_DECIMALS as structured UNAVAILABLE on both legs", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/market/liquidity")) return jsonResponse(200, marketBody);
      if (u.includes("/execution/compare")) {
        return jsonResponse(500, { error: { code: "MISSING_TOKEN_DECIMALS", message: "no decimals" } });
      }
      if (u.includes("/execution/depth-thresholds")) {
        return jsonResponse(500, { error: { code: "MISSING_TOKEN_DECIMALS", message: "no decimals" } });
      }
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "no" } });
    });
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({
      config: cfg,
      client,
      now: () => new Date("2026-09-04T00:04:00.000Z"),
    });
    const asset = report.assets[0]!;
    expect(asset.compare.status).toBe("UNAVAILABLE");
    expect(asset.depth.status).toBe("UNAVAILABLE");
    if (asset.compare.status !== "UNAVAILABLE" || asset.depth.status !== "UNAVAILABLE") {
      throw new Error("expected UNAVAILABLE");
    }
    expect(asset.compare.failure.kind).toBe("MISSING_TOKEN_DECIMALS");
    expect(asset.depth.failure.kind).toBe("MISSING_TOKEN_DECIMALS");
    expect(asset.compare.quality.level).toBe("UNAVAILABLE");
    expect(asset.notes.some((n) => n.includes("compare_attempt_failed:MISSING_TOKEN_DECIMALS"))).toBe(true);
    expect(asset.notes.some((n) => n.includes("depth_attempt_failed:MISSING_TOKEN_DECIMALS"))).toBe(true);
  });

  it("keeps structured depth UNAVAILABLE on timeout while market and compare succeed", async () => {
    let depthCalls = 0;
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/market/liquidity")) return jsonResponse(200, marketBody);
      if (u.includes("/execution/compare")) return jsonResponse(200, compareOk);
      if (u.includes("/execution/depth-thresholds")) {
        depthCalls += 1;
        const err = new Error("aborted");
        err.name = "AbortError";
        throw err;
      }
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "no" } });
    });
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({
      config: cfg,
      client,
      now: () => new Date("2026-09-04T00:04:00.000Z"),
    });
    expect(depthCalls).toBe(1);
    const asset = report.assets[0]!;
    expect(asset.compare.status).toBe("AVAILABLE");
    expect(asset.depth.status).toBe("UNAVAILABLE");
    if (asset.depth.status !== "UNAVAILABLE") throw new Error("expected UNAVAILABLE");
    expect(asset.depth.failure.kind).toBe("TIMEOUT");
    expect(asset.depth.quality.level).toBe("UNAVAILABLE");
  });

  it("keeps structured compare UNAVAILABLE on malformed compare body", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/market/liquidity")) return jsonResponse(200, marketBody);
      if (u.includes("/execution/compare")) return new Response("not-json", { status: 200 });
      if (u.includes("/execution/depth-thresholds")) return jsonResponse(200, depthOk);
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "no" } });
    });
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({
      config: cfg,
      client,
      now: () => new Date("2026-09-04T00:04:00.000Z"),
    });
    const asset = report.assets[0]!;
    expect(asset.compare.status).toBe("UNAVAILABLE");
    if (asset.compare.status !== "UNAVAILABLE") throw new Error("expected UNAVAILABLE");
    expect(asset.compare.failure.kind).toBe("MALFORMED_BODY");
    expect(asset.depth.status).toBe("AVAILABLE");
  });

  it("identifies assets by contractAddress and preserves partial market snapshot", async () => {
    const fetchImpl = vi.fn(async (url: string | URL) => {
      const u = String(url);
      if (u.endsWith("/api/market/liquidity")) return jsonResponse(200, marketBody);
      if (u.includes("/execution/compare")) return jsonResponse(200, compareOk);
      if (u.includes("/execution/depth-thresholds")) return jsonResponse(200, depthOk);
      return jsonResponse(404, { error: { code: "NOT_FOUND", message: "no" } });
    });
    const client = new TerminalClient({ config: cfg, fetchImpl: fetchImpl as unknown as typeof fetch });
    const report = await assembleMarketIntelligenceReport({
      config: cfg,
      client,
      now: () => new Date("2026-09-04T00:04:00.000Z"),
    });
    expect(report.assets[0]!.contractAddress).toBe(report.assets[0]!.marketRow.asset.contractAddress);
    expect(report.market.snapshot.assetsFailed).toBe(1);
    expect(report.market.snapshot.failures[0]?.contractAddress).toBe(
      "0x2222222222222222222222222222222222222222",
    );
  });
});
