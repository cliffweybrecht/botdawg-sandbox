import type { AssetIntelligence } from "../market/types.js";
import type { QualityLevel } from "../quality/types.js";
import { assertStockTokenIn, collectReferenceEligibilityFailures } from "./eligibility.js";
import {
  computeReferenceDivergenceFromPrices,
  isFiniteNumber,
  rationalToNumber,
  roundHalfAwayFromZero,
} from "./math.js";
import {
  CANDIDATE_DIAGNOSTIC_DISCLAIMER,
  DEFAULT_MEASUREMENT_POLICY,
  ECONOMIC_LIMITATION,
  PRICE_IMPACT_RULE,
  REFERENCE_PROVENANCE_DISCLAIMER,
  TERMINOLOGY_DISCLAIMER,
  type AssetOpportunityMeasurement,
  type CandidateExecutionDiagnostic,
  type MeasureOpportunitiesInput,
  type MeasurementPolicy,
  type MeasurementStatus,
  type OpportunityMeasurementReport,
  type PremiumConsistency,
  type ReferenceDivergenceMetrics,
  type StockTokenInGuard,
} from "./types.js";

function emptyCandidateDiagnostic(
  compareQuality: QualityLevel | "UNAVAILABLE_OR_MISSING",
  guard: StockTokenInGuard = "NOT_EVALUATED",
): CandidateExecutionDiagnostic {
  return {
    available: false,
    stockTokenInGuard: guard,
    tokenIn: null,
    selectedTokenOut: null,
    amountIn: null,
    tokenInDecimals: null,
    pairAddress: null,
    amountOut: null,
    priceImpactBps: null,
    gasEstimate: null,
    compareBlockNumber: null,
    compareQuality,
    disclaimer: CANDIDATE_DIAGNOSTIC_DISCLAIMER,
    priceImpactRule: PRICE_IMPACT_RULE,
  };
}

function buildCandidateDiagnostic(asset: AssetIntelligence): CandidateExecutionDiagnostic {
  const compare = asset.compare;
  if (compare.status !== "AVAILABLE") {
    return emptyCandidateDiagnostic("UNAVAILABLE_OR_MISSING");
  }
  if (compare.dto.comparison.status !== "OK") {
    return emptyCandidateDiagnostic(compare.quality.level);
  }

  const comparison = compare.dto.comparison;
  const tokenIn = comparison.tokenIn;
  const guard: StockTokenInGuard = assertStockTokenIn(tokenIn, asset.contractAddress)
    ? "PASSED"
    : "FAILED";

  const byAddr = new Map(comparison.candidates.map((c) => [c.pairAddress, c]));
  const order =
    comparison.ranking.bestCandidatePoolAddresses.length > 0
      ? comparison.ranking.bestCandidatePoolAddresses
      : comparison.ranking.rankedQuotedPoolAddresses;

  let pairAddress: string | null = null;
  let amountOut: string | null = null;
  let gasEstimate: string | null = null;
  let priceImpactBps: number | null = null;

  const take = (c: (typeof comparison.candidates)[number]): boolean => {
    if (c.status !== "QUOTED" || c.amountOut === undefined) return false;
    pairAddress = c.pairAddress;
    amountOut = c.amountOut;
    if (c.gasEstimate !== undefined) gasEstimate = c.gasEstimate;
    if (c.priceImpactBps) {
      priceImpactBps = rationalToNumber(
        c.priceImpactBps.numerator,
        c.priceImpactBps.denominator,
      );
    }
    return true;
  };

  for (const addr of order) {
    const c = byAddr.get(addr);
    if (c && take(c)) break;
  }
  if (pairAddress === null) {
    for (const c of comparison.candidates) {
      if (take(c)) break;
    }
  }

  return {
    available: true,
    stockTokenInGuard: guard,
    tokenIn,
    selectedTokenOut: compare.dto.selectedTokenOut,
    amountIn: comparison.amountIn,
    tokenInDecimals:
      comparison.tokenInDecimals !== undefined ? comparison.tokenInDecimals : null,
    pairAddress,
    amountOut,
    priceImpactBps,
    gasEstimate,
    compareBlockNumber: comparison.blockNumber,
    compareQuality: compare.quality.level,
    disclaimer: CANDIDATE_DIAGNOSTIC_DISCLAIMER,
    priceImpactRule: PRICE_IMPACT_RULE,
  };
}

/**
 * Inclusive: |bps| <= tolerance → NO_REFERENCE_DIVERGENCE.
 * Does not mutate measured divergence values.
 */
export function classifyReferenceStatus(
  bps: number,
  absZeroToleranceBps: number,
): Exclude<MeasurementStatus, "INSUFFICIENT_DATA"> {
  if (Math.abs(bps) <= absZeroToleranceBps) return "NO_REFERENCE_DIVERGENCE";
  if (bps > 0) return "POSITIVE_REFERENCE_DIVERGENCE";
  return "NEGATIVE_REFERENCE_DIVERGENCE";
}

function checkPremiumConsistency(
  computedPct: number,
  terminalPremiumDiscountPct: number | null | undefined,
  policy: MeasurementPolicy,
): PremiumConsistency {
  if (!isFiniteNumber(terminalPremiumDiscountPct)) {
    return {
      status: "TERMINAL_PREMIUM_ABSENT",
      terminalPremiumDiscountPct: null,
      computedDivergencePct: computedPct,
      absDeltaPct: null,
    };
  }
  const absDeltaPct = Math.abs(terminalPremiumDiscountPct - computedPct);
  if (!isFiniteNumber(absDeltaPct)) {
    return {
      status: "MISMATCH",
      terminalPremiumDiscountPct,
      computedDivergencePct: computedPct,
      absDeltaPct: null,
    };
  }
  if (absDeltaPct > policy.premiumConsistencyAbsTolerancePct) {
    return {
      status: "MISMATCH",
      terminalPremiumDiscountPct,
      computedDivergencePct: computedPct,
      absDeltaPct,
    };
  }
  return {
    status: "MATCHED",
    terminalPremiumDiscountPct,
    computedDivergencePct: computedPct,
    absDeltaPct,
  };
}

function emptyReference(rh: number | null, dex: number | null): ReferenceDivergenceMetrics {
  return {
    referenceDivergencePct: null,
    referenceDivergenceBps: null,
    referenceDivergenceUsdPerShare: null,
    referenceNotionalUsdPerShare: null,
    robinhoodReferencePriceUsd: rh,
    dexMedianPriceUsd: dex,
    premiumConsistency: {
      status: "TERMINAL_PREMIUM_ABSENT",
      terminalPremiumDiscountPct: null,
      computedDivergencePct: null,
      absDeltaPct: null,
    },
  };
}

function measureAsset(
  asset: AssetIntelligence,
  marketQuality: QualityLevel,
  policy: MeasurementPolicy,
): AssetOpportunityMeasurement {
  const notes: string[] = [];
  const insufficientReasons = collectReferenceEligibilityFailures(asset);
  const candidateExecution = buildCandidateDiagnostic(asset);

  if (candidateExecution.stockTokenInGuard === "FAILED") {
    insufficientReasons.push("STOCK_TOKEN_IN_GUARD_FAILED");
    notes.push("stock_token_in_guard:FAILED");
  }
  if (candidateExecution.selectedTokenOut === "NATIVE_ETH") {
    notes.push("selectedTokenOut=NATIVE_ETH");
  }

  const row = asset.marketRow;
  const rhRaw = isFiniteNumber(row.robinhoodReferencePriceUsd)
    ? row.robinhoodReferencePriceUsd
    : null;
  const dexRaw = isFiniteNumber(row.dexMedianPriceUsd) ? row.dexMedianPriceUsd : null;

  const priceBlocked = insufficientReasons.some(
    (r) =>
      r === "MISSING_RH_PRICE" ||
      r === "MISSING_DEX_MEDIAN" ||
      r === "INVALID_RH_PRICE" ||
      r === "INVALID_DEX_MEDIAN",
  );

  if (priceBlocked) {
    return {
      contractAddress: asset.contractAddress,
      symbol: asset.symbol,
      status: "INSUFFICIENT_DATA",
      reference: emptyReference(rhRaw, dexRaw),
      candidateExecution,
      marketQuality,
      referenceProvenanceDisclaimer: REFERENCE_PROVENANCE_DISCLAIMER,
      insufficientReasons,
      notes,
    };
  }

  const computed = computeReferenceDivergenceFromPrices(rhRaw!, dexRaw!);
  if (computed === null) {
    return {
      contractAddress: asset.contractAddress,
      symbol: asset.symbol,
      status: "INSUFFICIENT_DATA",
      reference: emptyReference(rhRaw, dexRaw),
      candidateExecution,
      marketQuality,
      referenceProvenanceDisclaimer: REFERENCE_PROVENANCE_DISCLAIMER,
      insufficientReasons: [...insufficientReasons, "NON_FINITE_NUMBER"],
      notes,
    };
  }

  const premiumConsistency = checkPremiumConsistency(
    computed.pct,
    row.premiumDiscountPct,
    policy,
  );
  if (premiumConsistency.status === "MISMATCH") {
    notes.push(
      `premium_mismatch:terminal=${premiumConsistency.terminalPremiumDiscountPct};computed=${computed.pct};absDelta=${premiumConsistency.absDeltaPct}`,
    );
    if (policy.failClosedOnPremiumMismatch) {
      insufficientReasons.push("PREMIUM_INCONSISTENT");
      return {
        contractAddress: asset.contractAddress,
        symbol: asset.symbol,
        status: "INSUFFICIENT_DATA",
        reference: {
          referenceDivergencePct: null,
          referenceDivergenceBps: null,
          referenceDivergenceUsdPerShare: null,
          referenceNotionalUsdPerShare: roundHalfAwayFromZero(rhRaw!, policy.usdScale),
          robinhoodReferencePriceUsd: roundHalfAwayFromZero(rhRaw!, policy.usdScale),
          dexMedianPriceUsd: roundHalfAwayFromZero(dexRaw!, policy.usdScale),
          premiumConsistency,
        },
        candidateExecution,
        marketQuality,
        referenceProvenanceDisclaimer: REFERENCE_PROVENANCE_DISCLAIMER,
        insufficientReasons,
        notes,
      };
    }
  }

  const reference: ReferenceDivergenceMetrics = {
    referenceDivergencePct: roundHalfAwayFromZero(computed.pct, policy.pctScale),
    referenceDivergenceBps: roundHalfAwayFromZero(computed.bps, policy.bpsScale),
    referenceDivergenceUsdPerShare: roundHalfAwayFromZero(computed.usdPerShare, policy.usdScale),
    referenceNotionalUsdPerShare: roundHalfAwayFromZero(rhRaw!, policy.usdScale),
    robinhoodReferencePriceUsd: roundHalfAwayFromZero(rhRaw!, policy.usdScale),
    dexMedianPriceUsd: roundHalfAwayFromZero(dexRaw!, policy.usdScale),
    premiumConsistency: {
      ...premiumConsistency,
      computedDivergencePct: roundHalfAwayFromZero(computed.pct, policy.pctScale),
      absDeltaPct:
        premiumConsistency.absDeltaPct === null
          ? null
          : roundHalfAwayFromZero(premiumConsistency.absDeltaPct, policy.pctScale),
      terminalPremiumDiscountPct:
        premiumConsistency.terminalPremiumDiscountPct === null
          ? null
          : roundHalfAwayFromZero(premiumConsistency.terminalPremiumDiscountPct, policy.pctScale),
    },
  };

  const status = classifyReferenceStatus(
    reference.referenceDivergenceBps!,
    policy.absZeroToleranceBps,
  );

  return {
    contractAddress: asset.contractAddress,
    symbol: asset.symbol,
    status,
    reference,
    candidateExecution,
    marketQuality,
    referenceProvenanceDisclaimer: REFERENCE_PROVENANCE_DISCLAIMER,
    insufficientReasons,
    notes,
  };
}

export function measureOpportunities(input: MeasureOpportunitiesInput): OpportunityMeasurementReport {
  const policy = input.policy ?? DEFAULT_MEASUREMENT_POLICY;
  const nowFn = input.now ?? (() => new Date());
  const report = input.report;

  if (report.phase !== "A") {
    return {
      phase: "B",
      measurementFamily: "REFERENCE_DIVERGENCE",
      generatedAt: nowFn().toISOString(),
      basedOnPhaseAGeneratedAt: report.generatedAt,
      terminalBaseUrl: report.terminalBaseUrl,
      policy,
      assets: [],
      terminologyDisclaimer: TERMINOLOGY_DISCLAIMER,
      economicLimitation: ECONOMIC_LIMITATION,
    };
  }

  return {
    phase: "B",
    measurementFamily: "REFERENCE_DIVERGENCE",
    generatedAt: nowFn().toISOString(),
    basedOnPhaseAGeneratedAt: report.generatedAt,
    terminalBaseUrl: report.terminalBaseUrl,
    policy,
    assets: report.assets.map((asset) =>
      measureAsset(asset, report.market.quality.level, policy),
    ),
    terminologyDisclaimer: TERMINOLOGY_DISCLAIMER,
    economicLimitation: ECONOMIC_LIMITATION,
  };
}
