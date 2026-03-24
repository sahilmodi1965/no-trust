/**
 * VIX signal fetcher — measures market fear via the CBOE Volatility Index.
 * Uses Yahoo Finance CSV endpoint. Zero npm dependencies.
 */

import type { Signal } from './types.ts';

/** Fetch current VIX value from Yahoo Finance and score the panic level. */
export async function fetchVIX(): Promise<Signal> {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1d&interval=1d';

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'no-trust-monitor/1.0' },
    });

    if (!res.ok) {
      throw new Error(`Yahoo Finance responded ${res.status}`);
    }

    const data = await res.json() as any;
    const meta = data?.chart?.result?.[0]?.meta;
    const vixValue = meta?.regularMarketPrice ?? meta?.previousClose ?? 0;

    return {
      name: 'VIX',
      value: vixValue,
      score: scoreVIX(vixValue),
      detail: describeVIX(vixValue),
    };
  } catch (err: any) {
    // Graceful degradation — return unknown state, never crash the monitor
    return {
      name: 'VIX',
      value: -1,
      score: 0,
      detail: `⚠ fetch failed: ${err.message}`,
    };
  }
}

/** Map VIX value to a 0-100 danger score. */
function scoreVIX(vix: number): number {
  if (vix <= 0) return 0;
  if (vix < 15) return 5;       // calm
  if (vix < 20) return 15;      // normal
  if (vix < 25) return 30;      // elevated
  if (vix < 30) return 50;      // high
  if (vix < 40) return 75;      // panic
  if (vix < 50) return 90;      // extreme panic
  return 100;                    // black swan territory
}

/** Human-readable VIX description. */
function describeVIX(vix: number): string {
  if (vix <= 0) return 'No data';
  if (vix < 20) return `VIX ${vix.toFixed(1)} — markets calm`;
  if (vix < 30) return `VIX ${vix.toFixed(1)} — elevated fear`;
  if (vix < 40) return `VIX ${vix.toFixed(1)} — HIGH FEAR`;
  return `VIX ${vix.toFixed(1)} — EXTREME PANIC`;
}
