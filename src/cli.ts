import { loadConfigForCli } from "./config.js";
import { assembleMarketIntelligenceReport } from "./market/assemble.js";
import { assertNoForbiddenClaims, formatReportHuman } from "./market/format.js";

function parseArgs(argv: string[]): { json: boolean; limit?: number } {
  let json = false;
  let limit: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--json") json = true;
    else if (a === "--limit") {
      const raw = argv[++i];
      if (!raw) throw new Error("limit requires a value");
      limit = Number(raw);
    } else {
      throw new Error("Unknown argument: " + a);
    }
  }
  return limit === undefined ? { json } : { json, limit };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const overrides = args.limit !== undefined ? { drilldownLimit: args.limit } : {};
  const config = loadConfigForCli(process.env, overrides);
  const report = await assembleMarketIntelligenceReport({ config });
  if (args.json) {
    const text = JSON.stringify(report, null, 2);
    assertNoForbiddenClaims(text);
    console.log(text);
  } else {
    process.stdout.write(formatReportHuman(report));
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
