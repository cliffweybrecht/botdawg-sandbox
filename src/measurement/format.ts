import type { OpportunityMeasurementReport } from "./types.js";
import type { CandidateExecutionDiagnostic } from "./types.js";

const FORBIDDEN = [
  "arbitrage",
  "profitable opportunity",
  "executable opportunity",
  "guaranteed profit",
  "risk-free",
  "recommendation",
  "should buy",
  "should sell",
  "buy now",
  "sell now",
  "net observed edge",
  "netobservededge",
  "positive_net_observed_edge",
  "knowncostusd",
  "residualafterknowncosts",
] as const;

export function assertNoForbiddenPhaseBClaims(text: string): void {
  const lower = text.toLowerCase().replace(/\s+/g, " ");
  for (const word of FORBIDDEN) {
    if (lower.includes(word)) {
      throw new Error(`Phase B output must not contain forbidden claim language: ${word}`);
    }
  }
}

function formatCandidate(d: CandidateExecutionDiagnostic, lines: string[]): void {
  lines.push("  candidateExecution (diagnostic only; separate from reference divergence):");
  lines.push(`    available: ${d.available}`);
  lines.push(`    stockTokenInGuard: ${d.stockTokenInGuard}`);
  lines.push(`    tokenIn: ${d.tokenIn}`);
  lines.push(`    selectedTokenOut: ${d.selectedTokenOut}`);
  lines.push(`    amountIn: ${d.amountIn}`);
  lines.push(`    tokenInDecimals: ${d.tokenInDecimals}`);
  lines.push(`    pairAddress: ${d.pairAddress}`);
  lines.push(`    amountOut: ${d.amountOut}`);
  lines.push(`    priceImpactBps (spot diagnostic): ${d.priceImpactBps}`);
  lines.push(`    gasEstimate (gas units): ${d.gasEstimate}`);
  lines.push(`    compareBlockNumber: ${d.compareBlockNumber}`);
  lines.push(`    compareQuality: ${d.compareQuality}`);
  lines.push(`    note: ${d.disclaimer}`);
  lines.push(`    priceImpactRule: ${d.priceImpactRule}`);
}

export function formatOpportunityMeasurementHuman(report: OpportunityMeasurementReport): string {
  const lines: string[] = [];
  lines.push("Stock Agent Phase B — Reference Divergence Report");
  lines.push(`Generated (agent clock): ${report.generatedAt}`);
  lines.push(`Based on Phase A generatedAt: ${report.basedOnPhaseAGeneratedAt}`);
  lines.push(`Terminal: ${report.terminalBaseUrl}`);
  lines.push(`Measurement family: ${report.measurementFamily}`);
  lines.push("");
  lines.push("Disclaimer:");
  lines.push(report.terminologyDisclaimer);
  lines.push("");
  lines.push("Economic limitation:");
  lines.push(report.economicLimitation);
  lines.push("");
  lines.push(`Assets (${report.assets.length})`);

  for (const a of report.assets) {
    lines.push("");
    lines.push(`Asset ${a.symbol}`);
    lines.push(`  contractAddress: ${a.contractAddress}`);
    lines.push(`  status: ${a.status}`);
    lines.push(`  marketQuality: ${a.marketQuality}`);
    lines.push(`  provenance: ${a.referenceProvenanceDisclaimer}`);
    lines.push(`  robinhoodReferencePriceUsd: ${a.reference.robinhoodReferencePriceUsd}`);
    lines.push(`  dexMedianPriceUsd: ${a.reference.dexMedianPriceUsd}`);
    lines.push(`  referenceDivergencePct: ${a.reference.referenceDivergencePct}`);
    lines.push(`  referenceDivergenceBps: ${a.reference.referenceDivergenceBps}`);
    lines.push(`  referenceDivergenceUsdPerShare: ${a.reference.referenceDivergenceUsdPerShare}`);
    lines.push(`  referenceNotionalUsdPerShare (RH mark of 1 share): ${a.reference.referenceNotionalUsdPerShare}`);
    lines.push(`  premiumConsistency: ${a.reference.premiumConsistency.status}`);
    if (a.reference.premiumConsistency.terminalPremiumDiscountPct !== null) {
      lines.push(`  terminalPremiumDiscountPct: ${a.reference.premiumConsistency.terminalPremiumDiscountPct}`);
    }
    if (a.insufficientReasons.length) {
      lines.push(`  insufficientReasons: ${a.insufficientReasons.join(", ")}`);
    }
    formatCandidate(a.candidateExecution, lines);
    if (a.notes.length) {
      lines.push("  notes:");
      for (const n of a.notes) lines.push(`    - ${n}`);
    }
  }

  const text = lines.join("\n") + "\n";
  assertNoForbiddenPhaseBClaims(text);
  return text;
}
