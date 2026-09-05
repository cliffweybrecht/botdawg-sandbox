import { z } from "zod";

/** Wire sentinel for Uniswap V4 native currency output group. */
export const NATIVE_ETH = "NATIVE_ETH" as const;

const rationalSchema = z.object({
  numerator: z.string(),
  denominator: z.string(),
});

const preconditionFailureSchema = z.object({
  code: z.string(),
  detail: z.string(),
});

export const marketLiquidityRowSchema = z.object({
  asset: z.object({
    symbol: z.string(),
    name: z.string(),
    contractAddress: z.string(),
    logoUrl: z.string().nullable(),
  }),
  displayedLiquidityUsd: z.number().nullable(),
  usdGLiquidityUsd: z.number().nullable(),
  poolCount: z.number(),
  dexCount: z.number(),
  observedVolume24h: z.number().nullable(),
  buys24h: z.number().nullable(),
  sells24h: z.number().nullable(),
  largestPoolLiquidityUsd: z.number().nullable(),
  top1ConcentrationPct: z.number().nullable(),
  top3ConcentrationPct: z.number().nullable(),
  top5ConcentrationPct: z.number().nullable(),
  liquidityCoverageComplete: z.boolean(),
  volume24hCoverageComplete: z.boolean(),
  robinhoodReferencePriceUsd: z.number().nullable(),
  dexLiquidityWeightedPriceUsd: z.number().nullable(),
  dexMedianPriceUsd: z.number().nullable(),
  premiumDiscountPct: z.number().nullable(),
  priceDispersionPct: z.number().nullable(),
  priceCoverageComplete: z.boolean().nullable(),
});

export const marketSnapshotFailureSchema = z.object({
  symbol: z.string(),
  contractAddress: z.string(),
  category: z.string(),
  message: z.string(),
});

export const marketPriceMetaSchema = z.object({
  available: z.boolean(),
  generatedAt: z.string().nullable(),
  symbolsMatched: z.number(),
  symbolsMissing: z.number(),
  missingSymbols: z.array(z.string()),
  symbolsInvalid: z.number(),
  invalidSymbols: z.array(z.string()),
  oldestQuoteGeneratedAt: z.string().nullable(),
  newestQuoteGeneratedAt: z.string().nullable(),
});

export const marketLiquiditySnapshotSchema = z.object({
  refreshStartedAt: z.string(),
  generatedAt: z.string(),
  refreshDurationMs: z.number(),
  assetsRequested: z.number(),
  assetsSucceeded: z.number(),
  assetsFailed: z.number(),
  completeness: z.object({
    complete: z.boolean(),
    successPct: z.number(),
  }),
  rows: z.array(marketLiquidityRowSchema),
  failures: z.array(marketSnapshotFailureSchema),
  price: marketPriceMetaSchema,
});

export const marketLiquidityResponseSchema = z.object({
  data: marketLiquiditySnapshotSchema,
  cache: z.unknown().optional(),
});

export const executionGroupSchema = z.object({
  tokenOut: z.string(),
  tokenOutSymbol: z.string().optional(),
  candidateCount: z.number(),
  v3Count: z.number(),
  v4Count: z.number(),
});

export const executionCandidateSchema = z.object({
  pairAddress: z.string(),
  dexId: z.string(),
  family: z.enum(["UNISWAP_V3", "UNISWAP_V4"]),
  status: z.string(),
  amountOut: z.string().optional(),
  executionPrice: rationalSchema.optional(),
  priceImpactBps: rationalSchema.optional(),
  analyticsStatus: z.string(),
  gasEstimate: z.string().optional(),
  hookDataCallerSupplied: z.boolean().optional(),
  preconditionFailure: preconditionFailureSchema.optional(),
});

export const executionComparisonOkSchema = z.object({
  status: z.literal("OK"),
  blockNumber: z.string(),
  fetchedAt: z.string(),
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.string(),
  tokenInDecimals: z.number().optional(),
  tokenOutDecimals: z.number().optional(),
  sharedAnalyticsStatus: z.string(),
  candidates: z.array(executionCandidateSchema),
  ranking: z.object({
    rankedQuotedPoolAddresses: z.array(z.string()),
    bestCandidatePoolAddresses: z.array(z.string()),
  }),
});

export const executionComparisonBlockPinFailureSchema = z.object({
  status: z.literal("BLOCK_PIN_FAILURE"),
  fetchedAt: z.string(),
  tokenIn: z.string(),
  tokenOut: z.string(),
  amountIn: z.string(),
});

export const assetExecutionComparisonDtoSchema = z.object({
  groups: z.array(executionGroupSchema),
  selectedTokenOut: z.string(),
  comparison: z.union([executionComparisonOkSchema, executionComparisonBlockPinFailureSchema]),
});

export const assetExecutionComparisonResponseSchema = z.object({
  data: assetExecutionComparisonDtoSchema,
});

export const upperRangeSchema = z.object({
  kind: z.string(),
  nextMeasuredAmountIn: z.string().optional(),
});

export const depthThresholdOutcomeSchema = z.object({
  thresholdBps: z.number(),
  kind: z.enum([
    "WITHIN_THRESHOLD",
    "EXCEEDED_AT_SMALLEST_SAMPLE",
    "NO_QUOTED_SAMPLES",
    "ANALYTICS_UNAVAILABLE",
  ]),
  qualifyingAmountIn: z.string().optional(),
  monotonicityObserved: z.boolean().optional(),
  upperRange: upperRangeSchema.optional(),
  smallestMeasuredAmountIn: z.string().optional(),
});

export const depthThresholdCellSchema = z.object({
  amountIn: z.string(),
  status: z.string(),
  amountOut: z.string().optional(),
  priceImpactBps: rationalSchema.optional(),
  analyticsStatus: z.string(),
  gasEstimate: z.string().optional(),
  preconditionFailure: preconditionFailureSchema.optional(),
});

export const depthThresholdPoolResultSchema = z.object({
  pairAddress: z.string(),
  dexId: z.string(),
  family: z.enum(["UNISWAP_V3", "UNISWAP_V4"]),
  hookDataCallerSupplied: z.boolean().optional(),
  status: z.enum(["EXECUTABLE", "PRECONDITION_FAILED"]),
  preconditionFailure: preconditionFailureSchema.optional(),
  ladder: z.array(depthThresholdCellSchema),
  outcomesByThreshold: z.array(depthThresholdOutcomeSchema),
});

export const depthThresholdsOkSchema = z.object({
  status: z.literal("OK"),
  blockNumber: z.string(),
  fetchedAt: z.string(),
  tokenIn: z.string(),
  tokenOut: z.string(),
  tokenInDecimals: z.number().optional(),
  tokenOutDecimals: z.number().optional(),
  sharedAnalyticsStatus: z.string(),
  ladderAmountsIn: z.array(z.string()),
  thresholdsBps: z.array(z.number()),
  pools: z.array(depthThresholdPoolResultSchema),
  bestVenueByThreshold: z.array(
    z.object({
      thresholdBps: z.number(),
      poolAddresses: z.array(z.string()),
    }),
  ),
});

export const depthThresholdsBlockPinFailureSchema = z.object({
  status: z.literal("BLOCK_PIN_FAILURE"),
  fetchedAt: z.string(),
  tokenIn: z.string(),
  tokenOut: z.string(),
});

export const assetExecutableDepthDtoSchema = z.object({
  groups: z.array(executionGroupSchema),
  selectedTokenOut: z.string(),
  result: z.union([depthThresholdsOkSchema, depthThresholdsBlockPinFailureSchema]),
});

export const assetExecutableDepthResponseSchema = z.object({
  data: assetExecutableDepthDtoSchema,
});

export const terminalErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type MarketLiquiditySnapshot = z.infer<typeof marketLiquiditySnapshotSchema>;
export type MarketLiquidityRow = z.infer<typeof marketLiquidityRowSchema>;
export type AssetExecutionComparisonDto = z.infer<typeof assetExecutionComparisonDtoSchema>;
export type AssetExecutableDepthDto = z.infer<typeof assetExecutableDepthDtoSchema>;
