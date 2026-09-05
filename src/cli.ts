import { loadConfigForCli } from "./config.js";
import { assembleMarketIntelligenceReport } from "./market/assemble.js";
import { assertNoForbiddenClaims, formatReportHuman } from "./market/format.js";
import { measureOpportunities } from "./measurement/measure.js";
import {
  assertNoForbiddenPhaseBClaims,
  formatOpportunityMeasurementHuman,
} from "./measurement/format.js";

function parseArgs(argv: string[]): { json: boolean; limit?: number; phase: "A" | "B" } {
  let json = false;
  let limit: number | undefined;
  let phase: "A" | "B" = "A";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") json = true;
    else if (a === "--limit") {
      const raw = argv[++i];
      if (!raw) throw new Error("limit requires a value");
      limit = Number(raw);
    } else if (a === "--phase") {
      const raw = argv[++i];
      if (raw !== "A" && raw !== "B" && raw !== "a" && raw !== "b") {
        throw new Error("phase must be A or B");
      }
      phase = raw.toUpperCase() as "A" | "B";
    } else if (a === "--measure") {
      phase = "B";
    } else {
      throw new Error("Unknown argument: " + a);
    }
  }
  return limit === undefined ? { json, phase } : { json, limit, phase };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const overrides = args.limit !== undefined ? { drilldownLimit: args.limit } : {};
  const config = loadConfigForCli(process.env, overrides);
  const phaseA = await assembleMarketIntelligenceReport({ config });

  if (args.phase === "A") {
    if (args.json) {
      const text = JSON.stringify(phaseA, null, 2);
      assertNoForbiddenClaims(text);
      console.log(text);
    } else {
      process.stdout.write(formatReportHuman(phaseA));
    }
    return;
  }

  const phaseB = measureOpportunities({ report: phaseA });
  if (args.json) {
    const text = JSON.stringify(phaseB, null, 2);
    assertNoForbiddenPhaseBClaims(text);
    console.log(text);
  } else {
    process.stdout.write(formatOpportunityMeasurementHuman(phaseB));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
