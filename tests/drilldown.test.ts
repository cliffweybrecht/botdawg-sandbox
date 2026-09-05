import { describe, it, expect } from 'vitest';
import { selectDrilldownRows } from '../src/market/drilldown.js';
import type { MarketLiquidityRow } from '../src/terminal/types.js';

function row(symbol: string, addr: string, liq: number | null): MarketLiquidityRow {
  return {
    asset: { symbol, name: symbol, contractAddress: addr, logoUrl: null },
    displayedLiquidityUsd: liq,
    usdGLiquidityUsd: null, poolCount: 1, dexCount: 1,
    observedVolume24h: null, buys24h: null, sells24h: null, largestPoolLiquidityUsd: null,
    top1ConcentrationPct: null, top3ConcentrationPct: null, top5ConcentrationPct: null,
    liquidityCoverageComplete: true, volume24hCoverageComplete: true,
    robinhoodReferencePriceUsd: null, dexLiquidityWeightedPriceUsd: null, dexMedianPriceUsd: null,
    premiumDiscountPct: null, priceDispersionPct: null, priceCoverageComplete: null,
  };
}

describe('selectDrilldownRows', () => {
  it('orders by displayedLiquidityUsd desc with nulls last and address tie-break', () => {
    const rows = [
      row('B', '0xbbb', 100),
      row('A', '0xaaa', null),
      row('C', '0xccc', 500),
      row('D', '0xddd', 500),
    ];
    const selected = selectDrilldownRows(rows, 3);
    expect(selected.map((r) => r.asset.symbol)).toEqual(['C', 'D', 'B']);
  });
  it('prefers contractAddress identity fields on rows', () => {
    const selected = selectDrilldownRows([row('NVDA', '0xdead', 1)], 1);
    expect(selected[0]?.asset.contractAddress).toBe('0xdead');
  });
});
