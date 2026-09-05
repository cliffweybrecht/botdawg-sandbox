export { loadConfig, loadConfigForCli, normalizeBaseUrl } from "./config.js";
export type { StockAgentConfig } from "./config.js";
export { TerminalClient } from "./terminal/client.js";
export { TerminalClientError } from "./terminal/errors.js";
export { NATIVE_ETH } from "./terminal/types.js";
export type { AssetExecutableDepthDto, AssetExecutionComparisonDto, MarketLiquidityRow, MarketLiquiditySnapshot } from "./terminal/types.js";
export { assembleMarketIntelligenceReport } from "./market/assemble.js";
export { selectDrilldownRows, drilldownPolicyDescription } from "./market/drilldown.js";
export { formatReportHuman, assertNoForbiddenClaims } from "./market/format.js";
export type { MarketIntelligenceReport, AssetIntelligence, CompareObservation, DepthObservation, ObservationFailure, RetrievalFailureKind } from "./market/types.js";
export { ORDERING_METRIC } from "./market/types.js";
export type { RetrievalProvenance, QualityLevel } from "./quality/types.js";
export { classifyOkRetrieval, classifyDegraded, classifyUnavailable } from "./quality/classify.js";

export { measureOpportunities } from "./measurement/measure.js";
export { formatOpportunityMeasurementHuman, assertNoForbiddenPhaseBClaims } from "./measurement/format.js";
export {
  DEFAULT_MEASUREMENT_POLICY,
  REFERENCE_PROVENANCE_DISCLAIMER,
  CANDIDATE_DIAGNOSTIC_DISCLAIMER,
  TERMINOLOGY_DISCLAIMER,
  ECONOMIC_LIMITATION,
  PRICE_IMPACT_RULE,
} from "./measurement/types.js";
export type {
  OpportunityMeasurementReport,
  AssetOpportunityMeasurement,
  MeasurementPolicy,
  MeasurementStatus,
  ReferenceDivergenceMetrics,
  CandidateExecutionDiagnostic,
} from "./measurement/types.js";
export { assertStockTokenIn } from "./measurement/eligibility.js";
