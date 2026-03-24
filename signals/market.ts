/**
 * Broad market signal — monitors S&P 500 for major drops.
 * Uses Yahoo Finance endpoint. Zero npm dependencies.
 */

import type { Signal } from './types.ts';

/** Fetch S&P 500 data and score based on daily move. */
export async function fetchMarket(): Promise<Signal> {
  const url =
    'https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?range=2d&interval=1d';

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'no-trust-monitor/1.0' },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance responded ${res.status}`);
    }

    const data = await res.json() as any;
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const currentPrice = meta?.regularMarketPrice ?? 0;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? 0;

    let changePct = 0;
    if (previousClose > 0) {
      changePct = ((currentPrice - previousClose) / previousClose) * 100;
    }

    const score = scoreMarketDrop(changePct);

    return {
      name: 'S&P 500',
      value: changePct,
      score,
      detail: `S&P 500 ${currentPrice.toLocaleString()} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`,
    };
  } catch (err: any) {
    return {
      name: 'S&P 500',
      value: 0,
      score: 0,
      detail: `⚠ fetch failed: ${err.message}`,
    };
  }
}

/** Map daily S&P 500 change to a 0-100 danger score. */
function scoreMarketDrop(changePct: number): number {
  if (changePct >= 0) return 0;

  const drop = Math.abs(changePct);
  if (drop < 1) return 10;      // minor dip
  if (drop < 2) return 25;      // notable
  if (drop < 3) return 45;      // significant
  if (drop < 5) return 65;      // major sell-off
  if (drop < 7) return 85;      // crash territory
  return 100;                    // circuit breaker territory
}
