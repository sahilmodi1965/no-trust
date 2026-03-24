/**
 * News sentiment signal — scans headlines for black swan keywords.
 * Uses Google News RSS feed. Zero npm dependencies.
 */

import type { Signal } from './types.ts';

// Keywords weighted by severity (higher = scarier).
// Sorted longest-first so multi-word phrases match before their substrings —
// "market crash" (8) matches instead of both "market crash" (8) + "crash" (5) = 13.
const KEYWORDS: [string, number][] = [
  ['systemic collapse', 10],
  ['financial crisis', 9],
  ['sovereign default', 9],
  ['liquidity crisis', 8],
  ['market crash', 8],
  ['bank failure', 8],
  ['panic selling', 7],
  ['flash crash', 7],
  ['circuit breaker', 7],
  ['black swan', 10],
  ['credit downgrade', 6],
  ['bear market', 6],
  ['debt ceiling', 5],
  ['bank run', 9],
  ['contagion', 8],
  ['nuclear', 8],
  ['freefall', 7],
  ['meltdown', 7],
  ['recession', 6],
  ['invasion', 6],
  ['collapse', 6],
  ['sell-off', 5],
  ['default', 5],
  ['plunge', 5],
  ['crash', 5],
  ['war', 5],
];

/** Fetch Google News RSS for financial headlines, score by keyword density. */
export async function fetchNews(): Promise<Signal> {
  const url =
    'https://news.google.com/rss/search?q=stock+market+OR+financial+crisis+OR+economy&hl=en-US&gl=US&ceid=US:en';

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'no-trust-monitor/1.0' },
    });

    if (!res.ok) {
      throw new Error(`Google News responded ${res.status}`);
    }

    const xml = await res.text();

    // Extract titles from RSS XML without an XML parser
    const titles = extractTitles(xml);
    const { score, matchedKeywords } = scoreHeadlines(titles);

    const matchSummary =
      matchedKeywords.length > 0
        ? `Triggered: ${matchedKeywords.slice(0, 5).join(', ')}`
        : 'No danger keywords detected';

    return {
      name: 'NEWS',
      value: matchedKeywords.length,
      score,
      detail: `${titles.length} headlines scanned — ${matchSummary}`,
    };
  } catch (err: any) {
    return {
      name: 'NEWS',
      value: 0,
      score: 0,
      detail: `⚠ fetch failed: ${err.message}`,
    };
  }
}

/** Pull <title> contents from RSS XML via regex (avoids XML parser dep). */
function extractTitles(xml: string): string[] {
  const matches: string[] = [];
  const regex = /<title><!\[CDATA\[(.*?)\]\]>|<title>(.*?)<\/title>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const title = (match[1] ?? match[2] ?? '').trim();
    if (title && title !== 'Google News') {
      matches.push(title.toLowerCase());
    }
  }
  return matches;
}

/**
 * Score headlines by keyword matches, weighted by severity.
 * Matches longest keywords first and removes matched spans so that
 * substring keywords (e.g. "crash" inside "market crash") don't double-count.
 */
function scoreHeadlines(titles: string[]): {
  score: number;
  matchedKeywords: string[];
} {
  let totalWeight = 0;
  const matchedKeywords: string[] = [];

  for (let title of titles) {
    // KEYWORDS is pre-sorted longest-first so multi-word phrases take priority
    for (const [keyword, weight] of KEYWORDS) {
      if (title.includes(keyword)) {
        totalWeight += weight;
        // Remove matched span so substrings can't double-count
        title = title.replace(keyword, ' ');
        if (!matchedKeywords.includes(keyword)) {
          matchedKeywords.push(keyword);
        }
      }
    }
  }

  // Normalize: cap raw weight at 100 danger score
  // ~50 weight points = full danger (10 severe keyword hits across headlines)
  const score = Math.min(100, Math.round((totalWeight / 50) * 100));

  return { score, matchedKeywords };
}
