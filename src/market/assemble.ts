import type { StockAgentConfig } from "../config.js";
import { classifyDegraded, classifyOkRetrieval, classifyUnavailable } from "../quality/classify.js";
import type { RetrievalProvenance } from "../quality/types.js";
import { TerminalClient } from "../terminal/client.js";
import type { TerminalClientError } from "../terminal/errors.js";
import type {
  AssetIntelligence,
  CompareObservation,
  DepthObservation,
  MarketIntelligenceReport,
  ObservationFailure,
  RetrievalFailureKind,
} from "./types.js";
import { ORDERING_METRIC } from "./types.js";
import { drilldownPolicyDescription, selectDrilldownRows } from "./drilldown.js";

const INDEPENDENT_PIN_DISCLAIMER =
  "Each Terminal execution POST is independently block-pinned. Compare and depth-threshold observations for the same symbol may disagree on blockNumber and must not be treated as one atomic same-block snapshot.";

function qualityFromClientError(
  sourceEndpoint: string,
  retrievedAt: string,
  error: TerminalClientError,
): RetrievalProvenance {
  if (error.kind === "DEGRADED" || error.errorCode === "VERIFICATION_DEGRADED") {
    return classifyDegraded({
      sourceEndpoint,
      retrievedAt,
      ...(error.httpStatus !== undefined ? { httpStatus: error.httpStatus } : {}),
      ...(error.errorCode !== undefined ? { errorCode: error.errorCode } : {}),
      reason: error.message,
    });
  }
  return classifyUnavailable({
    sourceEndpoint,
    retrievedAt,
    ...(error.httpStatus !== undefined ? { httpStatus: error.httpStatus } : {}),
    ...(error.errorCode !== undefined ? { errorCode: error.errorCode } : {}),
    reason: error.message,
  });
}

function failureKindFromError(error: TerminalClientError): RetrievalFailureKind {
  if (error.errorCode === "VERIFICATION_DEGRADED" || error.kind === "DEGRADED") {
    return "VERIFICATION_DEGRADED";
  }
  if (error.errorCode === "MISSING_TOKEN_DECIMALS") return "MISSING_TOKEN_DECIMALS";
  if (error.errorCode === "BLOCK_PIN_FAILURE") return "BLOCK_PIN_FAILURE";
  switch (error.kind) {
    case "TIMEOUT":
      return "TIMEOUT";
    case "NETWORK":
      return "NETWORK";
    case "HTTP":
      return "HTTP";
    case "MALFORMED_BODY":
      return "MALFORMED_BODY";
    case "SCHEMA":
      return "SCHEMA";
    default:
      return "OTHER";
  }
}

function observationFailureFromError(error: TerminalClientError): ObservationFailure {
  const failure: ObservationFailure = {
    kind: failureKindFromError(error),
    terminalErrorKind: error.kind,
    message: error.message,
  };
  if (error.errorCode !== undefined) {
    return { ...failure, errorCode: error.errorCode };
  }
  return failure;
}

function compareFromClientError(
  sourceEndpoint: string,
  retrievedAt: string,
  error: TerminalClientError,
): Extract<CompareObservation, { status: "UNAVAILABLE" }> {
  return {
    status: "UNAVAILABLE",
    quality: qualityFromClientError(sourceEndpoint, retrievedAt, error),
    failure: observationFailureFromError(error),
  };
}

function depthFromClientError(
  sourceEndpoint: string,
  retrievedAt: string,
  error: TerminalClientError,
): Extract<DepthObservation, { status: "UNAVAILABLE" }> {
  return {
    status: "UNAVAILABLE",
    quality: qualityFromClientError(sourceEndpoint, retrievedAt, error),
    failure: observationFailureFromError(error),
  };
}

export async function assembleMarketIntelligenceReport(input: {
  config: StockAgentConfig;
  client?: TerminalClient;
  now?: () => Date;
}): Promise<MarketIntelligenceReport> {
  const nowFn = input.now ?? (() => new Date());
  const generatedAt = nowFn().toISOString();
  const client =
    input.client ??
    new TerminalClient({
      config: input.config,
      now: nowFn,
    });

  const marketRes = await client.getMarketLiquidity();
  if (!marketRes.ok) {
    const emptySnapshot = {
      refreshStartedAt: generatedAt,
      generatedAt,
      refreshDurationMs: 0,
      assetsRequested: 0,
      assetsSucceeded: 0,
      assetsFailed: 0,
      completeness: { complete: false, successPct: 0 },
      rows: [],
      failures: [],
      price: {
        available: false,
        generatedAt: null,
        symbolsMatched: 0,
        symbolsMissing: 0,
        missingSymbols: [],
        symbolsInvalid: 0,
        invalidSymbols: [],
        oldestQuoteGeneratedAt: null,
        newestQuoteGeneratedAt: null,
      },
    };
    const report: MarketIntelligenceReport = {
      phase: "A",
      generatedAt,
      terminalBaseUrl: input.config.terminalBaseUrl,
      drilldownPolicy: {
        description: drilldownPolicyDescription(input.config.drilldownLimit),
        limit: input.config.drilldownLimit,
        orderingMetric: ORDERING_METRIC,
        callsPriceEndpoint: false,
      },
      market: {
        snapshot: emptySnapshot,
        quality: qualityFromClientError(marketRes.sourceEndpoint, marketRes.retrievedAt, marketRes.error),
      },
      assets: [],
      independentPinDisclaimer: INDEPENDENT_PIN_DISCLAIMER,
    };
    return report;
  }

  const marketQuality = classifyOkRetrieval({
    sourceEndpoint: marketRes.sourceEndpoint,
    retrievedAt: marketRes.retrievedAt,
    sourceGeneratedAt: marketRes.data.snapshot.generatedAt,
    staleAfterMs: input.config.staleAfterMs,
    nowMs: nowFn().getTime(),
  });

  const selected = selectDrilldownRows(marketRes.data.snapshot.rows, input.config.drilldownLimit);
  const assets: AssetIntelligence[] = [];

  for (const row of selected) {
    const notes: string[] = [];
    const symbol = row.asset.symbol;
    const contractAddress = row.asset.contractAddress;

    const compareRes = await client.postExecutionCompare(symbol);
    let compare: CompareObservation;
    if (!compareRes.ok) {
      const failed = compareFromClientError(compareRes.sourceEndpoint, compareRes.retrievedAt, compareRes.error);
      compare = failed;
      notes.push(`compare_attempt_failed:${failed.failure.kind}`);
    } else if (compareRes.data.comparison.status === "BLOCK_PIN_FAILURE") {
      compare = {
        status: "UNAVAILABLE",
        dto: compareRes.data,
        quality: classifyUnavailable({
          sourceEndpoint: compareRes.sourceEndpoint,
          retrievedAt: compareRes.retrievedAt,
          reason: "BLOCK_PIN_FAILURE",
          errorCode: "BLOCK_PIN_FAILURE",
          httpStatus: compareRes.httpStatus,
        }),
        failure: {
          kind: "BLOCK_PIN_FAILURE",
          errorCode: "BLOCK_PIN_FAILURE",
          message: "Terminal compare returned BLOCK_PIN_FAILURE",
        },
      };
      notes.push("compare_block_pin_failure");
    } else {
      compare = {
        status: "AVAILABLE",
        dto: compareRes.data,
        quality: classifyOkRetrieval({
          sourceEndpoint: compareRes.sourceEndpoint,
          retrievedAt: compareRes.retrievedAt,
          blockNumber: compareRes.data.comparison.blockNumber,
          staleAfterMs: input.config.staleAfterMs,
          nowMs: nowFn().getTime(),
        }),
      };
      if (compareRes.data.selectedTokenOut === "NATIVE_ETH") {
        notes.push("selectedTokenOut=NATIVE_ETH");
      }
    }

    const depthRes = await client.postExecutionDepthThresholds(symbol);
    let depth: DepthObservation;
    if (!depthRes.ok) {
      const failed = depthFromClientError(depthRes.sourceEndpoint, depthRes.retrievedAt, depthRes.error);
      depth = failed;
      notes.push(`depth_attempt_failed:${failed.failure.kind}`);
    } else if (depthRes.data.result.status === "BLOCK_PIN_FAILURE") {
      depth = {
        status: "UNAVAILABLE",
        dto: depthRes.data,
        quality: classifyUnavailable({
          sourceEndpoint: depthRes.sourceEndpoint,
          retrievedAt: depthRes.retrievedAt,
          reason: "BLOCK_PIN_FAILURE",
          errorCode: "BLOCK_PIN_FAILURE",
          httpStatus: depthRes.httpStatus,
        }),
        failure: {
          kind: "BLOCK_PIN_FAILURE",
          errorCode: "BLOCK_PIN_FAILURE",
          message: "Terminal depth-thresholds returned BLOCK_PIN_FAILURE",
        },
      };
      notes.push("depth_block_pin_failure");
    } else {
      depth = {
        status: "AVAILABLE",
        dto: depthRes.data,
        quality: classifyOkRetrieval({
          sourceEndpoint: depthRes.sourceEndpoint,
          retrievedAt: depthRes.retrievedAt,
          blockNumber: depthRes.data.result.blockNumber,
          staleAfterMs: input.config.staleAfterMs,
          nowMs: nowFn().getTime(),
        }),
      };
      for (const pool of depthRes.data.result.pools) {
        for (const outcome of pool.outcomesByThreshold) {
          if (outcome.kind === "ANALYTICS_UNAVAILABLE") {
            notes.push(`sampled_depth_analytics_unavailable:${pool.pairAddress}@${outcome.thresholdBps}bps`);
          }
          if (outcome.upperRange?.kind === "GAPPED_CEILING") {
            notes.push(`sampled_depth_gapped_ceiling:${pool.pairAddress}@${outcome.thresholdBps}bps`);
          }
        }
      }
      if (
        compare.status === "AVAILABLE" &&
        depth.status === "AVAILABLE" &&
        compare.quality.blockNumber &&
        depth.quality.blockNumber &&
        compare.quality.blockNumber !== depth.quality.blockNumber
      ) {
        notes.push(
          `independent_block_pins:compare=${compare.quality.blockNumber};depth=${depth.quality.blockNumber}`,
        );
      }
    }

    assets.push({
      symbol,
      contractAddress,
      marketRow: row,
      compare,
      depth,
      notes,
    });
  }

  const marketBlock: MarketIntelligenceReport["market"] =
    marketRes.data.cache !== undefined
      ? {
          snapshot: marketRes.data.snapshot,
          quality: marketQuality,
          cache: marketRes.data.cache,
        }
      : {
          snapshot: marketRes.data.snapshot,
          quality: marketQuality,
        };

  return {
    phase: "A",
    generatedAt,
    terminalBaseUrl: input.config.terminalBaseUrl,
    drilldownPolicy: {
      description: drilldownPolicyDescription(input.config.drilldownLimit),
      limit: input.config.drilldownLimit,
      orderingMetric: ORDERING_METRIC,
      callsPriceEndpoint: false,
    },
    market: marketBlock,
    assets,
    independentPinDisclaimer: INDEPENDENT_PIN_DISCLAIMER,
  };
}
