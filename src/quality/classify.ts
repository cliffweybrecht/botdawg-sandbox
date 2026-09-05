import type { RetrievalProvenance, QualityLevel } from "./types.js";

export interface ClassifyOkInput {
  readonly sourceEndpoint: string;
  readonly retrievedAt: string;
  readonly blockNumber?: string;
  /** Optional Terminal snapshot/generated timestamp for age checks. */
  readonly sourceGeneratedAt?: string;
  readonly staleAfterMs: number;
  readonly nowMs?: number;
}

export function classifyOkRetrieval(input: ClassifyOkInput): RetrievalProvenance {
  const now = input.nowMs ?? Date.now();
  const retrievedMs = Date.parse(input.retrievedAt);
  const ages: number[] = [];
  if (Number.isFinite(retrievedMs)) ages.push(now - retrievedMs);
  if (input.sourceGeneratedAt) {
    const g = Date.parse(input.sourceGeneratedAt);
    if (Number.isFinite(g)) ages.push(now - g);
  }
  const ageMs = ages.length > 0 ? Math.max(...ages) : undefined;
  if (ageMs !== undefined && ageMs > input.staleAfterMs) {
    return {
      level: "STALE",
      sourceEndpoint: input.sourceEndpoint,
      retrievedAt: input.retrievedAt,
      ...(input.blockNumber !== undefined ? { blockNumber: input.blockNumber } : {}),
      reason: "response_or_snapshot_older_than_stale_threshold",
      ageMs,
    };
  }
  const level: QualityLevel = "VERIFIED";
  return {
    level,
    sourceEndpoint: input.sourceEndpoint,
    retrievedAt: input.retrievedAt,
    ...(input.blockNumber !== undefined ? { blockNumber: input.blockNumber } : {}),
    ...(ageMs !== undefined ? { ageMs } : {}),
  };
}

export function classifyDegraded(input: {
  sourceEndpoint: string;
  retrievedAt: string;
  httpStatus?: number;
  errorCode?: string;
  reason?: string;
}): RetrievalProvenance {
  return {
    level: "DEGRADED",
    sourceEndpoint: input.sourceEndpoint,
    retrievedAt: input.retrievedAt,
    ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus } : {}),
    ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
    reason: input.reason ?? input.errorCode ?? "degraded",
  };
}

export function classifyUnavailable(input: {
  sourceEndpoint: string;
  retrievedAt: string;
  httpStatus?: number;
  errorCode?: string;
  reason: string;
}): RetrievalProvenance {
  return {
    level: "UNAVAILABLE",
    sourceEndpoint: input.sourceEndpoint,
    retrievedAt: input.retrievedAt,
    ...(input.httpStatus !== undefined ? { httpStatus: input.httpStatus } : {}),
    ...(input.errorCode !== undefined ? { errorCode: input.errorCode } : {}),
    reason: input.reason,
  };
}
