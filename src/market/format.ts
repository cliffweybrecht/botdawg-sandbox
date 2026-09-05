import type { CompareObservation, DepthObservation, MarketIntelligenceReport } from "./types.js";

const FORBIDDEN = [
  "arbitrage",
  "profitable opportunity",
  "executable opportunity",
] as const;

export function assertNoForbiddenClaims(text: string): void {
  const lower = text.toLowerCase();
  for (const word of FORBIDDEN) {
    if (lower.includes(word)) {
      throw new Error(`Phase A output must not contain forbidden claim language: ${word}`);
    }
  }
}

function formatCompare(c: CompareObservation, lines: string[]): void {
  lines.push(`  compare status: ${c.status}`);
  lines.push(`  compare quality: ${c.quality.level}`);
  lines.push(`  compare endpoint: ${c.quality.sourceEndpoint}`);
  lines.push(`  compare retrievedAt: ${c.quality.retrievedAt}`);
  if (c.quality.blockNumber) lines.push(`  compare blockNumber: ${c.quality.blockNumber}`);
  if (c.quality.reason) lines.push(`  compare reason: ${c.quality.reason}`);
  if (c.quality.errorCode) lines.push(`  compare errorCode: ${c.quality.errorCode}`);
  if (c.status === "UNAVAILABLE") {
    lines.push(`  compare failure.kind: ${c.failure.kind}`);
    lines.push(`  compare failure.message: ${c.failure.message}`);
    if (c.failure.errorCode) lines.push(`  compare failure.errorCode: ${c.failure.errorCode}`);
    if (c.dto) {
      lines.push(`  compare dto.selectedTokenOut: ${c.dto.selectedTokenOut}`);
      lines.push(`  compare dto.comparison.status: ${c.dto.comparison.status}`);
    }
    return;
  }
  lines.push(`  selectedTokenOut: ${c.dto.selectedTokenOut}`);
  if (c.dto.comparison.status === "OK") {
    lines.push(`  amountIn: ${c.dto.comparison.amountIn}`);
    lines.push(`  sharedAnalyticsStatus: ${c.dto.comparison.sharedAnalyticsStatus}`);
    lines.push(
      `  bestCandidatePoolAddresses: ${c.dto.comparison.ranking.bestCandidatePoolAddresses.join(", ") || "(none)"}`,
    );
    for (const cand of c.dto.comparison.candidates) {
      lines.push(
        `    venue ${cand.dexId} ${cand.family} ${cand.pairAddress} status=${cand.status} amountOut=${cand.amountOut ?? "n/a"} impactBps=${cand.priceImpactBps ? `${cand.priceImpactBps.numerator}/${cand.priceImpactBps.denominator}` : "n/a"} gasEstimate=${cand.gasEstimate ?? "n/a"} analytics=${cand.analyticsStatus}`,
      );
    }
  } else {
    lines.push(`  compare dto status: BLOCK_PIN_FAILURE`);
  }
}

function formatDepth(d: DepthObservation, lines: string[]): void {
  lines.push(`  depth status: ${d.status}`);
  lines.push(`  depth quality: ${d.quality.level}`);
  lines.push(`  depth endpoint: ${d.quality.sourceEndpoint}`);
  lines.push(`  depth retrievedAt: ${d.quality.retrievedAt}`);
  if (d.quality.blockNumber) lines.push(`  depth blockNumber: ${d.quality.blockNumber}`);
  if (d.quality.reason) lines.push(`  depth reason: ${d.quality.reason}`);
  if (d.quality.errorCode) lines.push(`  depth errorCode: ${d.quality.errorCode}`);
  if (d.status === "UNAVAILABLE") {
    lines.push(`  depth failure.kind: ${d.failure.kind}`);
    lines.push(`  depth failure.message: ${d.failure.message}`);
    if (d.failure.errorCode) lines.push(`  depth failure.errorCode: ${d.failure.errorCode}`);
    if (d.dto) {
      lines.push(`  depth dto.selectedTokenOut: ${d.dto.selectedTokenOut}`);
      lines.push(`  depth dto.result.status: ${d.dto.result.status}`);
    }
    return;
  }
  lines.push(`  depth selectedTokenOut: ${d.dto.selectedTokenOut}`);
  if (d.dto.result.status === "OK") {
    lines.push(`  sampled ladderAmountsIn: ${d.dto.result.ladderAmountsIn.join(", ")}`);
    lines.push(`  thresholdsBps: ${d.dto.result.thresholdsBps.join(", ")}`);
    lines.push("  sampled depth evidence (not continuous depth):");
    for (const pool of d.dto.result.pools) {
      lines.push(`    pool ${pool.dexId} ${pool.family} ${pool.pairAddress} status=${pool.status}`);
      for (const o of pool.outcomesByThreshold) {
        const bits = [`${o.thresholdBps}bps`, o.kind];
        if (o.qualifyingAmountIn) bits.push(`qualifyingAmountIn=${o.qualifyingAmountIn}`);
        if (o.monotonicityObserved !== undefined) bits.push(`monotonicityObserved=${o.monotonicityObserved}`);
        if (o.upperRange) bits.push(`upperRange=${o.upperRange.kind}`);
        if (o.smallestMeasuredAmountIn) bits.push(`smallestMeasured=${o.smallestMeasuredAmountIn}`);
        lines.push(`      - ${bits.join(" ")}`);
      }
    }
  } else {
    lines.push(`  depth dto status: BLOCK_PIN_FAILURE`);
  }
}

export function formatReportHuman(report: MarketIntelligenceReport): string {
  const lines: string[] = [];
  lines.push("Stock Agent Phase A — Market Intelligence Report");
  lines.push(`Generated (agent clock): ${report.generatedAt}`);
  lines.push(`Terminal: ${report.terminalBaseUrl}`);
  lines.push(`Ordering metric: ${report.drilldownPolicy.orderingMetric}`);
  lines.push(`Drill-down limit: ${report.drilldownPolicy.limit}`);
  lines.push(`Drill-down policy: ${report.drilldownPolicy.description}`);
  lines.push("");
  lines.push("Disclaimer:");
  lines.push(report.independentPinDisclaimer);
  lines.push("");
  lines.push("Market snapshot");
  lines.push(`  quality: ${report.market.quality.level}`);
  lines.push(`  source: ${report.market.quality.sourceEndpoint}`);
  lines.push(`  retrievedAt: ${report.market.quality.retrievedAt}`);
  if (report.market.quality.reason) lines.push(`  reason: ${report.market.quality.reason}`);
  lines.push(`  snapshot.generatedAt: ${report.market.snapshot.generatedAt}`);
  lines.push(
    `  assets: requested=${report.market.snapshot.assetsRequested} succeeded=${report.market.snapshot.assetsSucceeded} failed=${report.market.snapshot.assetsFailed}`,
  );
  lines.push(
    `  completeness: complete=${report.market.snapshot.completeness.complete} successPct=${report.market.snapshot.completeness.successPct}`,
  );
  lines.push(`  price.meta.available: ${report.market.snapshot.price.available}`);
  if (report.market.snapshot.failures.length > 0) {
    lines.push(`  partial failures (${report.market.snapshot.failures.length}):`);
    for (const f of report.market.snapshot.failures) {
      lines.push(`    - ${f.symbol} ${f.contractAddress} [${f.category}] ${f.message}`);
    }
  }
  lines.push("");
  lines.push(`Drilled assets (${report.assets.length})`);
  for (const asset of report.assets) {
    lines.push("");
    lines.push(`Asset ${asset.symbol}`);
    lines.push(`  contractAddress: ${asset.contractAddress}`);
    lines.push(`  displayedLiquidityUsd: ${asset.marketRow.displayedLiquidityUsd}`);
    lines.push(`  dexMedianPriceUsd: ${asset.marketRow.dexMedianPriceUsd}`);
    lines.push(`  robinhoodReferencePriceUsd: ${asset.marketRow.robinhoodReferencePriceUsd}`);
    lines.push(`  premiumDiscountPct (headline from market snapshot): ${asset.marketRow.premiumDiscountPct}`);
    lines.push(`  pools/dexes: ${asset.marketRow.poolCount}/${asset.marketRow.dexCount}`);
    formatCompare(asset.compare, lines);
    formatDepth(asset.depth, lines);
    if (asset.notes.length) {
      lines.push(`  notes:`);
      for (const n of asset.notes) lines.push(`    - ${n}`);
    }
  }

  const text = lines.join("\n") + "\n";
  assertNoForbiddenClaims(text);
  return text;
}
