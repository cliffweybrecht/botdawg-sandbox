export type QualityLevel = "VERIFIED" | "DEGRADED" | "UNAVAILABLE" | "STALE";

/**
 * Provenance for one Terminal retrieval.
 * blockNumber is only set when the Terminal response itself supplied one.
 * Endpoints without block pins must leave blockNumber undefined — never fabricate.
 */
export interface RetrievalProvenance {
  readonly level: QualityLevel;
  readonly sourceEndpoint: string;
  readonly retrievedAt: string;
  readonly blockNumber?: string;
  readonly reason?: string;
  readonly httpStatus?: number;
  readonly errorCode?: string;
  /** Wall-clock ms age used when classifying STALE, if applicable. */
  readonly ageMs?: number;
}
