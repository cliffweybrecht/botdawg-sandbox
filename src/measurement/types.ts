import type { QualityLevel } from "../quality/types.js";
import type { MarketIntelligenceReport } from "../market/types.js";

/** Phase B V1 measures reference-mark divergence only. */
export type MeasurementStatus =
  | "INSUFFICIENT_DATA"
  | "NO_REFERENCE_DIVERGENCE"
  | "POSITIVE_REFERENCE_DIVERGENCE"
  | "NEGATIVE_REFERENCE_DIVERGENCE";

export type InsufficientReason =
  | "MISSING_RH_PRICE"
  | "MISSING_DEX_MEDIAN"
  | "INVALID_RH_PRICE"
  | "INVALID_DEX_MEDIAN"
  | "NON_FINITE_NUMBER"
  | "PHASE_A_REPORT_INVALID"
  | "STOCK_TOKEN_IN_GUARD_FAILED"
  | "PREMIUM_INCONSISTENT";

/**
 * abs(bps) <= absZeroToleranceBps → NO_REFERENCE_DIVERGENCE (inclusive).
 * Tolerance affects STATUS only — measured pct/bps/usd fields are never rewritten to zero by tolerance.
 *
 * premiumConsistencyAbsTolerancePct: max |Terminal premiumDiscountPct − computed pct|
 * before PREMIUM_INCONSISTENT + fail-closed INSUFFICIENT_DATA (when Terminal premium is present).
 */
export interface MeasurementPolicy {
  readonly absZeroToleranceBps: number;
  readonly premiumConsistencyAbsTolerancePct: number;
  readonly failClosedOnPremiumMismatch: boolean;
  readonly bpsScale: number;
  readonly usdScale: number;
  readonly pctScale: number;
}

export const DEFAULT_MEASUREMENT_POLICY: MeasurementPolicy = {
  absZeroToleranceBps: 0,
  premiumConsistencyAbsTolerancePct: 1e-6,
  failClosedOnPremiumMismatch: true,
  bpsScale: 4,
  usdScale: 8,
  pctScale: 8,
};

export const REFERENCE_PROVENANCE_DISCLAIMER =
  "Reference divergence compares Robinhood mark price to DexScreener aggregate (median) mark from independently retrieved market data. It is not atomic with Terminal execution compare observations.";

export const CANDIDATE_DIAGNOSTIC_DISCLAIMER =
  "Candidate execution fields are independently pinned Terminal compare diagnostics. They are not combined with reference-divergence arithmetic.";

export const TERMINOLOGY_DISCLAIMER =
  "Phase B V1 reports observed reference-mark divergence only. Values are observational evidence, not trading advice.";

export const PRICE_IMPACT_RULE =
  "Terminal amountOut already embodies the quoted execution result. priceImpactBps is diagnostic relative to pool spot and is not a reference-divergence cost.";

export const ECONOMIC_LIMITATION =
  "Current Terminal data does not support coherent executable cross-venue settlement economics in BotDawg Phase B V1: Robinhood price is reference/mark only, and candidate DEX diagnostics must not be combined with DexScreener/RH mark divergence. Execution-path measurement is deferred to a later milestone.";

export type PremiumConsistencyStatus = "MATCHED" | "MISMATCH" | "TERMINAL_PREMIUM_ABSENT";

export interface PremiumConsistency {
  readonly status: PremiumConsistencyStatus;
  readonly terminalPremiumDiscountPct: number | null;
  readonly computedDivergencePct: number | null;
  readonly absDeltaPct: number | null;
}

export interface ReferenceDivergenceMetrics {
  /** Authoritative: (dexMedian - RH) / RH * 100 from underlying prices */
  readonly referenceDivergencePct: number | null;
  /** Authoritative: referenceDivergencePct * 100 */
  readonly referenceDivergenceBps: number | null;
  /** dexMedianPriceUsd - robinhoodReferencePriceUsd (USD per share) */
  readonly referenceDivergenceUsdPerShare: number | null;
  /**
   * Explicit meaning: USD mark of one whole share at Robinhood reference
   * (= robinhoodReferencePriceUsd). Not an RH execution size.
   */
  readonly referenceNotionalUsdPerShare: number | null;
  readonly robinhoodReferencePriceUsd: number | null;
  readonly dexMedianPriceUsd: number | null;
  readonly premiumConsistency: PremiumConsistency;
}

export type StockTokenInGuard = "PASSED" | "FAILED" | "NOT_EVALUATED";

export interface CandidateExecutionDiagnostic {
  readonly available: boolean;
  readonly stockTokenInGuard: StockTokenInGuard;
  readonly tokenIn: string | null;
  readonly selectedTokenOut: string | null;
  readonly amountIn: string | null;
  readonly tokenInDecimals: number | null;
  readonly pairAddress: string | null;
  readonly amountOut: string | null;
  readonly priceImpactBps: number | null;
  readonly gasEstimate: string | null;
  readonly compareBlockNumber: string | null;
  readonly compareQuality: QualityLevel | "UNAVAILABLE_OR_MISSING";
  readonly disclaimer: string;
  readonly priceImpactRule: string;
}

export interface AssetOpportunityMeasurement {
  readonly contractAddress: string;
  readonly symbol: string;
  readonly status: MeasurementStatus;
  readonly reference: ReferenceDivergenceMetrics;
  readonly candidateExecution: CandidateExecutionDiagnostic;
  readonly marketQuality: QualityLevel;
  readonly referenceProvenanceDisclaimer: string;
  readonly insufficientReasons: readonly InsufficientReason[];
  readonly notes: readonly string[];
}

export interface OpportunityMeasurementReport {
  readonly phase: "B";
  readonly measurementFamily: "REFERENCE_DIVERGENCE";
  readonly generatedAt: string;
  readonly basedOnPhaseAGeneratedAt: string;
  readonly terminalBaseUrl: string;
  readonly policy: MeasurementPolicy;
  readonly assets: readonly AssetOpportunityMeasurement[];
  readonly terminologyDisclaimer: string;
  readonly economicLimitation: string;
}

export interface MeasureOpportunitiesInput {
  readonly report: MarketIntelligenceReport;
  readonly policy?: MeasurementPolicy;
  readonly now?: () => Date;
}
