import { describe, it, expect } from "vitest";
import { NATIVE_ETH } from "../src/terminal/types.js";
import type { AssetIntelligence, MarketIntelligenceReport } from "../src/market/types.js";
import { measureOpportunities } from "../src/measurement/measure.js";
import {
  formatOpportunityMeasurementHuman,
  assertNoForbiddenPhaseBClaims,
} from "../src/measurement/format.js";
import { DEFAULT_MEASUREMENT_POLICY } from "../src/measurement/types.js";
import { assertStockTokenIn } from "../src/measurement/eligibility.js";
import type { RetrievalProvenance } from "../src/quality/types.js";

const ADDR = "0x1111111111111111111111111111111111111111";
const ADDR_UPPER = "0x1111111111111111111111111111111111111111".toUpperCase();
const POOL = "0xpool";
const OTHER = "0x2222222222222222222222222222222222222222";
const WETH = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";

function q(level: RetrievalProvenance["level"], block?: string): RetrievalProvenance {
  return {
    level,
    sourceEndpoint: "http://t/compare",
    retrievedAt: "2026-09-04T00:02:00.000Z",
    ...(block !== undefined ? { blockNumber: block } : {}),
  };
}

function marketRow(over: Partial<AssetIntelligence["marketRow"]> = {}) {
  return {
    asset: { symbol: "NVDA", name: "NVIDIA", contractAddress: ADDR, logoUrl: null },
    displayedLiquidityUsd: 1_000_000,
    usdGLiquidityUsd: 1_000_000,
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
    ...over,
  };
}

function compareAvailable(opts: {
  tokenIn?: string;
  block?: string;
  impactNum?: string;
  gasEstimate?: string;
  selectedTokenOut?: string;
  pairAddress?: string;
  amountOut?: string;
} = {}): AssetIntelligence["compare"] {
  const pair = opts.pairAddress ?? POOL;
  return {
    status: "AVAILABLE",
    quality: q("VERIFIED", opts.block ?? "100"),
    dto: {
      groups: [{ tokenOut: NATIVE_ETH, candidateCount: 1, v3Count: 0, v4Count: 1 }],
      selectedTokenOut: opts.selectedTokenOut ?? NATIVE_ETH,
      comparison: {
        status: "OK",
        blockNumber: opts.block ?? "100",
        fetchedAt: "2026-09-04T00:02:00.000Z",
        tokenIn: opts.tokenIn ?? ADDR,
        tokenOut: opts.selectedTokenOut ?? NATIVE_ETH,
        amountIn: "1000000",
        tokenInDecimals: 6,
        sharedAnalyticsStatus: "OK",
        candidates: [
          {
            pairAddress: pair,
            dexId: "uniswap",
            family: "UNISWAP_V4",
            status: "QUOTED",
            amountOut: opts.amountOut ?? "2000",
            analyticsStatus: "OK",
            gasEstimate: opts.gasEstimate ?? "21000",
            priceImpactBps: {
              numerator: opts.impactNum ?? "10",
              denominator: "1",
            },
          },
        ],
        ranking: {
          rankedQuotedPoolAddresses: [pair],
          bestCandidatePoolAddresses: [pair],
        },
      },
    },
  };
}

function compareUnavailable(): AssetIntelligence["compare"] {
  return {
    status: "UNAVAILABLE",
    quality: { ...q("UNAVAILABLE"), errorCode: "BLOCK_PIN_FAILURE" },
    failure: {
      kind: "BLOCK_PIN_FAILURE",
      errorCode: "BLOCK_PIN_FAILURE",
      message: "pin failed",
    },
    dto: {
      groups: [],
      selectedTokenOut: NATIVE_ETH,
      comparison: {
        status: "BLOCK_PIN_FAILURE",
        fetchedAt: "2026-09-04T00:02:00.000Z",
        tokenIn: ADDR,
        tokenOut: NATIVE_ETH,
        amountIn: "1",
      },
    },
  };
}

function depthUnavailable(): AssetIntelligence["depth"] {
  return {
    status: "UNAVAILABLE",
    quality: q("UNAVAILABLE"),
    failure: { kind: "TIMEOUT", message: "timeout" },
  };
}

function asset(over: Partial<AssetIntelligence> & {
  compare: AssetIntelligence["compare"];
}): AssetIntelligence {
  return {
    symbol: "NVDA",
    contractAddress: ADDR,
    marketRow: marketRow(),
    notes: [],
    depth: depthUnavailable(),
    ...over,
  };
}

function phaseA(assets: AssetIntelligence[]): MarketIntelligenceReport {
  return {
    phase: "A",
    generatedAt: "2026-09-04T00:04:00.000Z",
    terminalBaseUrl: "http://terminal.test",
    drilldownPolicy: {
      description: "top",
      limit: 1,
      orderingMetric: "displayedLiquidityUsd",
      callsPriceEndpoint: false,
    },
    market: {
      snapshot: {
        refreshStartedAt: "2026-09-04T00:00:00.000Z",
        generatedAt: "2026-09-04T00:01:00.000Z",
        refreshDurationMs: 1,
        assetsRequested: 1,
        assetsSucceeded: 1,
        assetsFailed: 0,
        completeness: { complete: true, successPct: 100 },
        rows: [marketRow()],
        failures: [],
        price: {
          available: true,
          generatedAt: "2026-09-04T00:01:00.000Z",
          symbolsMatched: 1,
          symbolsMissing: 0,
          missingSymbols: [],
          symbolsInvalid: 0,
          invalidSymbols: [],
          oldestQuoteGeneratedAt: null,
          newestQuoteGeneratedAt: null,
        },
      },
      quality: q("VERIFIED"),
    },
    assets,
    independentPinDisclaimer: "independent pins",
  };
}

describe("Phase B V1 reference divergence — final adversarial", () => {
  it("derives divergence from RH and DEX prices (not Terminal premium)", () => {
    const report = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable(),
          marketRow: marketRow({
            robinhoodReferencePriceUsd: 50,
            dexMedianPriceUsd: 55,
            premiumDiscountPct: 999, // deliberately wrong; failClosed would fire — set matching for this test
          }),
        }),
      ]),
      policy: { ...DEFAULT_MEASUREMENT_POLICY, failClosedOnPremiumMismatch: false },
    });
    const a = report.assets[0]!;
    expect(a.reference.referenceDivergencePct).toBeCloseTo(10, 8);
    expect(a.reference.referenceDivergenceBps).toBeCloseTo(1000, 4);
    expect(a.reference.referenceDivergenceUsdPerShare).toBeCloseTo(5, 8);
    expect(a.reference.premiumConsistency.status).toBe("MISMATCH");
    expect(a.status).toBe("POSITIVE_REFERENCE_DIVERGENCE");
  });

  it("fail-closed when Terminal premium conflicts with price-derived pct", () => {
    const report = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable(),
          marketRow: marketRow({
            robinhoodReferencePriceUsd: 100,
            dexMedianPriceUsd: 101,
            premiumDiscountPct: 50, // should be ~1
          }),
        }),
      ]),
    });
    const a = report.assets[0]!;
    expect(a.status).toBe("INSUFFICIENT_DATA");
    expect(a.insufficientReasons).toContain("PREMIUM_INCONSISTENT");
    expect(a.reference.premiumConsistency.status).toBe("MISMATCH");
    expect(a.reference.referenceDivergencePct).toBeNull();
  });

  it("matched Terminal premium is OK", () => {
    const report = measureOpportunities({
      report: phaseA([asset({ compare: compareAvailable() })]),
    });
    expect(report.assets[0]!.reference.premiumConsistency.status).toBe("MATCHED");
    expect(report.assets[0]!.status).toBe("POSITIVE_REFERENCE_DIVERGENCE");
  });

  it("absent Terminal premium still measures from prices", () => {
    const report = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable(),
          marketRow: marketRow({ premiumDiscountPct: null }),
        }),
      ]),
    });
    expect(report.assets[0]!.reference.premiumConsistency.status).toBe("TERMINAL_PREMIUM_ABSENT");
    expect(report.assets[0]!.status).toBe("POSITIVE_REFERENCE_DIVERGENCE");
    expect(report.assets[0]!.reference.referenceDivergenceBps).toBe(100);
  });

  it("numeric fail-closed: RH 0, RH negative, DEX <= 0", () => {
    for (const row of [
      marketRow({ robinhoodReferencePriceUsd: 0 }),
      marketRow({ robinhoodReferencePriceUsd: -1 }),
      marketRow({ dexMedianPriceUsd: 0 }),
      marketRow({ dexMedianPriceUsd: -2 }),
      marketRow({ robinhoodReferencePriceUsd: Number.NaN }),
      marketRow({ dexMedianPriceUsd: Number.POSITIVE_INFINITY }),
    ]) {
      const report = measureOpportunities({
        report: phaseA([asset({ compare: compareAvailable(), marketRow: row })]),
      });
      expect(report.assets[0]!.status).toBe("INSUFFICIENT_DATA");
      expect(report.assets[0]!.reference.referenceDivergenceBps).toBeNull();
    }
  });

  it("zero and tolerance: status only; measured bps unchanged", () => {
    const zero = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable(),
          marketRow: marketRow({
            robinhoodReferencePriceUsd: 100,
            dexMedianPriceUsd: 100,
            premiumDiscountPct: 0,
          }),
        }),
      ]),
    });
    expect(zero.assets[0]!.status).toBe("NO_REFERENCE_DIVERGENCE");
    expect(zero.assets[0]!.reference.referenceDivergenceBps).toBe(0);

    const tiny = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable(),
          marketRow: marketRow({
            robinhoodReferencePriceUsd: 100,
            dexMedianPriceUsd: 100.01,
            premiumDiscountPct: 0.01,
          }),
        }),
      ]),
      policy: { ...DEFAULT_MEASUREMENT_POLICY, absZeroToleranceBps: 2 },
    });
    // 0.01% => 1 bps <= 2
    expect(tiny.assets[0]!.status).toBe("NO_REFERENCE_DIVERGENCE");
    expect(tiny.assets[0]!.reference.referenceDivergenceBps).toBeCloseTo(1, 4);

    const justAbove = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable(),
          marketRow: marketRow({
            robinhoodReferencePriceUsd: 100,
            dexMedianPriceUsd: 100.021,
            premiumDiscountPct: 0.021,
          }),
        }),
      ]),
      policy: { ...DEFAULT_MEASUREMENT_POLICY, absZeroToleranceBps: 2 },
    });
    expect(justAbove.assets[0]!.status).toBe("POSITIVE_REFERENCE_DIVERGENCE");
  });

  it("negative reference divergence signed correctly", () => {
    const report = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable(),
          marketRow: marketRow({
            robinhoodReferencePriceUsd: 100,
            dexMedianPriceUsd: 99,
            premiumDiscountPct: -1,
          }),
        }),
      ]),
    });
    expect(report.assets[0]!.status).toBe("NEGATIVE_REFERENCE_DIVERGENCE");
    expect(report.assets[0]!.reference.referenceDivergenceUsdPerShare).toBe(-1);
  });

  it("metamorphic: candidate diagnostics cannot change reference fields or status", () => {
    const baseMarket = marketRow();
    const a = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable({
            impactNum: "1",
            gasEstimate: "1",
            amountOut: "1",
            pairAddress: "0xaaa",
            selectedTokenOut: NATIVE_ETH,
          }),
          marketRow: baseMarket,
        }),
      ]),
    });
    const b = measureOpportunities({
      report: phaseA([
        asset({
          compare: compareAvailable({
            impactNum: "9999",
            gasEstimate: "99999999",
            amountOut: "888888",
            pairAddress: "0xbbb",
            selectedTokenOut: WETH,
            block: "999",
          }),
          marketRow: baseMarket,
        }),
      ]),
    });
    expect(a.assets[0]!.status).toBe(b.assets[0]!.status);
    expect(a.assets[0]!.reference.referenceDivergenceBps).toBe(
      b.assets[0]!.reference.referenceDivergenceBps,
    );
    expect(a.assets[0]!.reference.referenceDivergencePct).toBe(
      b.assets[0]!.reference.referenceDivergencePct,
    );
    expect(a.assets[0]!.candidateExecution.gasEstimate).not.toBe(
      b.assets[0]!.candidateExecution.gasEstimate,
    );
    expect(a.assets[0]!.candidateExecution.selectedTokenOut).not.toBe(
      b.assets[0]!.candidateExecution.selectedTokenOut,
    );
  });

  it("UNAVAILABLE retained dto does not populate candidate diagnostic", () => {
    const report = measureOpportunities({
      report: phaseA([asset({ compare: compareUnavailable() })]),
    });
    const a = report.assets[0]!;
    expect(a.candidateExecution.available).toBe(false);
    expect(a.candidateExecution.amountOut).toBeNull();
    expect(a.candidateExecution.gasEstimate).toBeNull();
    expect(a.status).toBe("POSITIVE_REFERENCE_DIVERGENCE");
  });

  it("token identity guard: casing ok; different/WETH/NATIVE fail", () => {
    expect(assertStockTokenIn(ADDR, ADDR)).toBe(true);
    expect(assertStockTokenIn(ADDR_UPPER, ADDR)).toBe(true);
    expect(assertStockTokenIn(OTHER, ADDR)).toBe(false);
    expect(assertStockTokenIn(WETH, ADDR)).toBe(false);
    expect(assertStockTokenIn(NATIVE_ETH, ADDR)).toBe(false);

    const bad = measureOpportunities({
      report: phaseA([asset({ compare: compareAvailable({ tokenIn: WETH }) })]),
    });
    expect(bad.assets[0]!.candidateExecution.stockTokenInGuard).toBe("FAILED");
    expect(bad.assets[0]!.insufficientReasons).toContain("STOCK_TOKEN_IN_GUARD_FAILED");
    expect(bad.assets[0]!.status).toBe("POSITIVE_REFERENCE_DIVERGENCE");
  });

  it("provenance stays non-atomic; equal blocks do not merge sources", () => {
    const report = measureOpportunities({
      report: phaseA([asset({ compare: compareAvailable({ block: "100" }) })]),
    });
    expect(report.assets[0]!.referenceProvenanceDisclaimer).toMatch(/not atomic/i);
    expect(report.assets[0]!.candidateExecution.disclaimer).toMatch(/not combined/i);
    expect(report.assets[0]!.candidateExecution.compareBlockNumber).toBe("100");
  });

  it("formatter/JSON terminology and economic limitation", () => {
    const report = measureOpportunities({
      report: phaseA([asset({ compare: compareAvailable() })]),
    });
    const human = formatOpportunityMeasurementHuman(report);
    assertNoForbiddenPhaseBClaims(human);
    assertNoForbiddenPhaseBClaims(JSON.stringify(report));
    expect(human).toContain("Reference Divergence");
    expect(human).toContain("diagnostic only");
    expect(JSON.stringify(report)).not.toMatch(/POSITIVE_NET_OBSERVED_EDGE|netObservedEdgeUsd|knownCostUsd/);
  });

  it("NATIVE_ETH remains distinct from WETH in diagnostics", () => {
    const report = measureOpportunities({
      report: phaseA([
        asset({ compare: compareAvailable({ selectedTokenOut: NATIVE_ETH }) }),
      ]),
    });
    expect(report.assets[0]!.candidateExecution.selectedTokenOut).toBe(NATIVE_ETH);
    expect(String(report.assets[0]!.candidateExecution.selectedTokenOut)).not.toBe("WETH");
  });
});
