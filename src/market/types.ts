import type { RetrievalProvenance } from "../quality/types.js";
import type {
  AssetExecutableDepthDto,
  AssetExecutionComparisonDto,
  MarketLiquidityRow,
  MarketLiquiditySnapshot,
} from "../terminal/types.js";
import type { TerminalErrorKind } from "../terminal/errors.js";

export const ORDERING_METRIC = "displayedLiquidityUsd" as const;

export interface DrilldownPolicy {
  readonly description: string;
  readonly limit: number;
  readonly orderingMetric: typeof ORDERING_METRIC;
  readonly callsPriceEndpoint: false;
}

/** Why a Terminal retrieval failed or is not fully usable. Machine-readable; notes are supplemental only. */
export type RetrievalFailureKind =
  | "VERIFICATION_DEGRADED"
  | "BLOCK_PIN_FAILURE"
  | "MISSING_TOKEN_DECIMALS"
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP"
  | "MALFORMED_BODY"
  | "SCHEMA"
  | "OTHER";

export interface ObservationFailure {
  readonly kind: RetrievalFailureKind;
  /** Terminal error.code when present (e.g. VERIFICATION_DEGRADED, MISSING_TOKEN_DECIMALS). */
  readonly errorCode?: string;
  readonly terminalErrorKind?: TerminalErrorKind;
  readonly message: string;
}

/**
 * Structured compare observation for one attempted Terminal retrieval.
 * Always present on a drilled asset after compare is attempted.
 */
export type CompareObservation =
  | {
      readonly status: "AVAILABLE";
      readonly dto: AssetExecutionComparisonDto;
      readonly quality: RetrievalProvenance;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly quality: RetrievalProvenance;
      readonly failure: ObservationFailure;
      /** Present when Terminal returned a DTO that is not usable as success (e.g. BLOCK_PIN_FAILURE body). */
      readonly dto?: AssetExecutionComparisonDto;
    };

/**
 * Structured depth observation for one attempted Terminal retrieval.
 * Always present on a drilled asset after depth is attempted.
 */
export type DepthObservation =
  | {
      readonly status: "AVAILABLE";
      readonly dto: AssetExecutableDepthDto;
      readonly quality: RetrievalProvenance;
    }
  | {
      readonly status: "UNAVAILABLE";
      readonly quality: RetrievalProvenance;
      readonly failure: ObservationFailure;
      readonly dto?: AssetExecutableDepthDto;
    };

export interface AssetIntelligence {
  readonly symbol: string;
  /** Canonical identity — prefer this over symbol. */
  readonly contractAddress: string;
  readonly marketRow: MarketLiquidityRow;
  /** Set whenever compare was attempted for this drilled asset. */
  readonly compare: CompareObservation;
  /** Set whenever depth-thresholds was attempted for this drilled asset. */
  readonly depth: DepthObservation;
  /** Supplemental human diagnostics only — never the canonical failure representation. */
  readonly notes: readonly string[];
}

export interface MarketIntelligenceReport {
  readonly phase: "A";
  readonly generatedAt: string;
  readonly terminalBaseUrl: string;
  readonly drilldownPolicy: DrilldownPolicy;
  readonly market: {
    readonly snapshot: MarketLiquiditySnapshot;
    readonly quality: RetrievalProvenance;
    readonly cache?: unknown;
  };
  readonly assets: readonly AssetIntelligence[];
  /**
   * Explicit statement: compare and depth for an asset are independently
   * pinned Terminal requests and must not be treated as one atomic snapshot.
   */
  readonly independentPinDisclaimer: string;
}
