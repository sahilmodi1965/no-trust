/**
 * Macroeconomic analysis — fetches US, China, and India market data.
 * Uses Yahoo Finance endpoints. Zero npm dependencies.
 */

interface MarketData {
  name: string;
  flag: string;
  index: string;
  price: number;
  changePct: number;
  assessment: string;
  action: string;
}

/** Fetch index data from Yahoo Finance. */
async function fetchIndex(symbol: string, indexName: string): Promise<{ price: number; changePct: number }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'no-trust-monitor/1.0' },
  });

  if (!res.ok) throw new Error(`${indexName}: Yahoo returned ${res.status}`);

  const data = await res.json() as any;
  const meta = data?.chart?.result?.[0]?.meta;
  const price = meta?.regularMarketPrice ?? 0;
  const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? 0;
  const changePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

  return { price, changePct };
}

/** Generate a one-line assessment based on market move. */
function assess(changePct: number, context: string): string {
  if (changePct <= -5) return `Severe sell-off. ${context}`;
  if (changePct <= -3) return `Sharp decline. ${context}`;
  if (changePct <= -1.5) return `Notable weakness. ${context}`;
  if (changePct <= -0.5) return `Mild pullback. ${context}`;
  if (changePct <= 0.5) return `Flat trading. ${context}`;
  if (changePct <= 1.5) return `Positive momentum. ${context}`;
  if (changePct <= 3) return `Strong rally. ${context}`;
  return `Surging. ${context}`;
}

/** Map per-market change to an individual action recommendation. */
function marketAction(changePct: number): string {
  if (changePct <= -5) return '🔴 SELL EVERYTHING';
  if (changePct <= -3) return '🟠 SELL A FEW THINGS';
  if (changePct <= -1) return '🟡 HOLD STEADY';
  if (changePct <= 1) return '🟡 HOLD STEADY';
  if (changePct <= 3) return '🟢 BUY SOMETHING';
  return '💚 BUY MORE';
}

/** Fetch macro data for US, China, and India. */
export async function fetchMacro(): Promise<MarketData[]> {
  const markets: MarketData[] = [];

  // US — S&P 500
  try {
    const us = await fetchIndex('^GSPC', 'S&P 500');
    markets.push({
      name: 'United States',
      flag: '🇺🇸',
      index: 'S&P 500',
      price: us.price,
      changePct: us.changePct,
      assessment: assess(us.changePct, 'Fed policy and earnings in focus.'),
      action: marketAction(us.changePct),
    });
  } catch {
    markets.push({ name: 'United States', flag: '🇺🇸', index: 'S&P 500', price: 0, changePct: 0, assessment: '⚠ Data unavailable', action: '🟡 HOLD STEADY' });
  }

  // China — Shanghai Composite
  try {
    const cn = await fetchIndex('000001.SS', 'Shanghai Composite');
    markets.push({
      name: 'China',
      flag: '🇨🇳',
      index: 'SSE Composite',
      price: cn.price,
      changePct: cn.changePct,
      assessment: assess(cn.changePct, 'Trade and property sector signals.'),
      action: marketAction(cn.changePct),
    });
  } catch {
    markets.push({ name: 'China', flag: '🇨🇳', index: 'SSE Composite', price: 0, changePct: 0, assessment: '⚠ Data unavailable', action: '🟡 HOLD STEADY' });
  }

  // India — NIFTY 50
  try {
    const ind = await fetchIndex('^NSEI', 'NIFTY 50');
    markets.push({
      name: 'India',
      flag: '🇮🇳',
      index: 'NIFTY 50',
      price: ind.price,
      changePct: ind.changePct,
      assessment: assess(ind.changePct, 'Domestic flows and rupee watch.'),
      action: marketAction(ind.changePct),
    });
  } catch {
    markets.push({ name: 'India', flag: '🇮🇳', index: 'NIFTY 50', price: 0, changePct: 0, assessment: '⚠ Data unavailable', action: '🟡 HOLD STEADY' });
  }

  return markets;
}
