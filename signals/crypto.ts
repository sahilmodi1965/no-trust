/**
 * Crypto signal fetcher — monitors BTC and ETH for sudden drops.
 * Uses CoinGecko free API. Zero npm dependencies.
 */

import type { Signal } from './types.ts';

interface CoinGeckoPrice {
  [coin: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

/** Fetch BTC/ETH prices and 24h change, score based on drop severity. */
export async function fetchCrypto(): Promise<Signal> {
  const url =
    'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true';

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'no-trust-monitor/1.0' },
    });

    if (!res.ok) {
      throw new Error(`CoinGecko responded ${res.status}`);
    }

    const data: CoinGeckoPrice = await res.json() as CoinGeckoPrice;

    const btcPrice = data.bitcoin?.usd ?? 0;
    const btcChange = data.bitcoin?.usd_24h_change ?? 0;
    const ethPrice = data.ethereum?.usd ?? 0;
    const ethChange = data.ethereum?.usd_24h_change ?? 0;

    // Use the worse of the two drops as the primary signal
    const worstDrop = Math.min(btcChange, ethChange);
    const score = scoreCryptoDrop(worstDrop);

    const detail = [
      `BTC $${btcPrice.toLocaleString()} (${btcChange >= 0 ? '+' : ''}${btcChange.toFixed(1)}%)`,
      `ETH $${ethPrice.toLocaleString()} (${ethChange >= 0 ? '+' : ''}${ethChange.toFixed(1)}%)`,
    ].join(' | ');

    return {
      name: 'CRYPTO',
      value: worstDrop,
      score,
      detail,
    };
  } catch (err: any) {
    return {
      name: 'CRYPTO',
      value: 0,
      score: 0,
      detail: `⚠ fetch failed: ${err.message}`,
    };
  }
}

/** Map 24h percentage drop to a 0-100 danger score. */
function scoreCryptoDrop(changePct: number): number {
  // Positive change = no danger
  if (changePct >= 0) return 0;

  const drop = Math.abs(changePct);
  if (drop < 3) return 10;      // normal volatility
  if (drop < 5) return 25;      // notable
  if (drop < 8) return 45;      // significant
  if (drop < 12) return 65;     // major sell-off
  if (drop < 20) return 85;     // crash
  return 100;                    // black swan
}
