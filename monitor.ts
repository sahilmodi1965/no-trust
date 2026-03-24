#!/usr/bin/env npx tsx
/**
 * no-trust monitor — main loop orchestrator.
 * Runs all signal fetchers in parallel, computes composite danger score,
 * and dispatches alerts when thresholds are crossed.
 * Zero npm dependencies. Execute: npx tsx tools/no-trust/monitor.ts
 */

import { loadConfig } from './config.ts';
import { fetchVIX } from './signals/vix.ts';
import { fetchCrypto } from './signals/crypto.ts';
import { fetchNews } from './signals/news.ts';
import { fetchMarket } from './signals/market.ts';
import { sendAlert } from './alert.ts';
import type { AlertLevel, AlertPayload } from './alert.ts';

// ANSI helpers
const CYAN = '\x1b[96m';
const YELLOW = '\x1b[93m';
const RED = '\x1b[91m';
const GREEN = '\x1b[92m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// Known signal names — throw on unrecognized names to catch typos
const KNOWN_SIGNALS = new Set(['VIX', 'CRYPTO', 'NEWS', 'S&P 500']);

/** Print the startup banner. */
function printBanner(): void {
  const width = 60;
  console.log(`${CYAN}${BOLD}${'═'.repeat(width)}${RESET}`);
  console.log(`${CYAN}${BOLD}  no-trust market exit monitor${RESET}`);
  console.log(`${CYAN}${BOLD}  Autonomy Level 1 — agent-in-terminal${RESET}`);
  console.log(`${CYAN}${BOLD}${'═'.repeat(width)}${RESET}`);
  console.log(`${DIM}  Zero dependencies. Free APIs only. Not financial advice.${RESET}`);
  console.log('');
}

/** Run one monitoring cycle — fetch all signals, score, and alert. */
async function runCycle(): Promise<void> {
  const config = loadConfig();
  const now = new Date().toISOString();

  console.log(`${CYAN}── scan ${now} ──${RESET}`);

  // Fetch all signals in parallel
  const signals = await Promise.all([
    fetchVIX(),
    fetchCrypto(),
    fetchNews(),
    fetchMarket(),
  ]);

  // Compute weighted danger score
  const weights = config.signal_weights;
  const weightMap: Record<string, number> = {
    VIX: weights.vix,
    CRYPTO: weights.crypto,
    NEWS: weights.news,
    'S&P 500': weights.market,
  };

  let totalWeight = 0;
  let weightedSum = 0;
  for (const s of signals) {
    if (!KNOWN_SIGNALS.has(s.name)) {
      throw new Error(`Unrecognized signal name "${s.name}" — check signal module exports`);
    }
    const w = weightMap[s.name]!;
    weightedSum += s.score * w;
    totalWeight += w;
  }

  const dangerScore = totalWeight > 0
    ? Math.round(weightedSum / totalWeight)
    : 0;

  // Determine alert level
  let level: AlertLevel;
  if (dangerScore >= config.thresholds.danger_score_exit) {
    level = 'EXIT-NOW';
  } else if (dangerScore >= config.thresholds.danger_score_warning) {
    level = 'WARNING';
  } else if (dangerScore >= config.thresholds.danger_score_watch) {
    level = 'WATCH';
  } else {
    // Below watch threshold — just print summary to terminal
    printQuietSummary(signals, dangerScore);
    return;
  }

  const payload: AlertPayload = {
    level,
    dangerScore,
    signals: signals.map((s) => ({
      name: s.name,
      score: s.score,
      detail: s.detail,
    })),
    timestamp: now,
  };

  await sendAlert(payload);
}

/** Print a quiet summary when nothing is triggered. */
function printQuietSummary(
  signals: { name: string; score: number; detail: string }[],
  dangerScore: number
): void {
  const color = dangerScore > 15 ? YELLOW : GREEN;
  console.log(`${color}  Danger: ${dangerScore}/100 — all clear${RESET}`);
  for (const s of signals) {
    console.log(`${DIM}    ${s.name.padEnd(10)} ${String(s.score).padStart(3)}/100  ${s.detail}${RESET}`);
  }
  console.log('');
}

/** Main entry point — banner + interval loop with clean shutdown. */
async function main(): Promise<void> {
  printBanner();

  const config = loadConfig();
  console.log(`${YELLOW}  Check interval: ${config.check_interval_ms / 1000}s${RESET}`);
  console.log(`${YELLOW}  Thresholds — EXIT: ${config.thresholds.danger_score_exit} | WARN: ${config.thresholds.danger_score_warning} | WATCH: ${config.thresholds.danger_score_watch}${RESET}`);
  console.log('');

  // Run first cycle immediately
  await runCycle();

  // Then loop
  const timer = setInterval(async () => {
    try {
      await runCycle();
    } catch (err: any) {
      console.error(`${RED}Cycle error: ${err.message}${RESET}`);
    }
  }, config.check_interval_ms);

  // Clean shutdown on SIGINT/SIGTERM
  const shutdown = () => {
    console.log(`\n${CYAN}  Shutting down monitor...${RESET}`);
    clearInterval(timer);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
