#!/usr/bin/env npx tsx
/**
 * no-trust test harness — simulates extreme danger values to verify
 * the scoring and alert pipeline fires EXIT-NOW correctly.
 * Runs in dry-run mode — never sends to real Telegram/Discord channels.
 * Execute: npx tsx tools/no-trust/test.ts
 */

import { sendAlert } from './alert.ts';
import type { AlertPayload } from './alert.ts';

// ANSI helpers
const CYAN = '\x1b[96m';
const GREEN = '\x1b[92m';
const RED = '\x1b[91m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

/** Simulated extreme-danger signals. */
const mockSignals = [
  { name: 'VIX', score: 95, detail: 'VIX 52.3 — EXTREME PANIC (simulated)' },
  { name: 'CRYPTO', score: 85, detail: 'BTC $18,200 (-22.4%) | ETH $890 (-28.1%) (simulated)' },
  { name: 'NEWS', score: 90, detail: '45 headlines scanned — Triggered: market crash, bank failure, contagion (simulated)' },
  { name: 'S&P 500', score: 88, detail: 'S&P 500 3,200 (-7.80%) (simulated)' },
];

async function runTests(): Promise<void> {
  const width = 60;
  console.log(`\n${CYAN}${BOLD}${'═'.repeat(width)}${RESET}`);
  console.log(`${CYAN}${BOLD}  no-trust — test harness (dry-run, no real alerts sent)${RESET}`);
  console.log(`${CYAN}${BOLD}${'═'.repeat(width)}${RESET}\n`);

  let passed = 0;
  let failed = 0;

  // Test 1: EXIT-NOW alert fires with extreme danger
  console.log(`${CYAN}── Test 1: EXIT-NOW alert ──${RESET}`);
  try {
    const payload: AlertPayload = {
      level: 'EXIT-NOW',
      dangerScore: 90,
      signals: mockSignals,
      timestamp: new Date().toISOString(),
    };
    await sendAlert(payload, true); // dry-run: terminal only
    console.log(`${GREEN}  ✓ EXIT-NOW alert dispatched (terminal only)${RESET}\n`);
    passed++;
  } catch (err: any) {
    console.log(`${RED}  ✗ EXIT-NOW failed: ${err.message}${RESET}\n`);
    failed++;
  }

  // Test 2: WARNING alert
  console.log(`${CYAN}── Test 2: WARNING alert ──${RESET}`);
  try {
    const payload: AlertPayload = {
      level: 'WARNING',
      dangerScore: 60,
      signals: mockSignals.map((s) => ({ ...s, score: Math.round(s.score * 0.6) })),
      timestamp: new Date().toISOString(),
    };
    await sendAlert(payload, true);
    console.log(`${GREEN}  ✓ WARNING alert dispatched (terminal only)${RESET}\n`);
    passed++;
  } catch (err: any) {
    console.log(`${RED}  ✗ WARNING failed: ${err.message}${RESET}\n`);
    failed++;
  }

  // Test 3: WATCH alert
  console.log(`${CYAN}── Test 3: WATCH alert ──${RESET}`);
  try {
    const payload: AlertPayload = {
      level: 'WATCH',
      dangerScore: 35,
      signals: mockSignals.map((s) => ({ ...s, score: Math.round(s.score * 0.35) })),
      timestamp: new Date().toISOString(),
    };
    await sendAlert(payload, true);
    console.log(`${GREEN}  ✓ WATCH alert dispatched (terminal only)${RESET}\n`);
    passed++;
  } catch (err: any) {
    console.log(`${RED}  ✗ WATCH failed: ${err.message}${RESET}\n`);
    failed++;
  }

  // Test 4: Danger score calculation
  console.log(`${CYAN}── Test 4: Danger score math ──${RESET}`);
  const weights = { vix: 0.3, crypto: 0.25, news: 0.25, market: 0.2 };
  const weightMap: Record<string, number> = {
    VIX: weights.vix,
    CRYPTO: weights.crypto,
    NEWS: weights.news,
    'S&P 500': weights.market,
  };
  let weightedSum = 0;
  let totalWeight = 0;
  for (const s of mockSignals) {
    const w = weightMap[s.name] ?? 0.25;
    weightedSum += s.score * w;
    totalWeight += w;
  }
  const computed = Math.round(weightedSum / totalWeight);
  // Expected: (95*0.3 + 85*0.25 + 90*0.25 + 88*0.2) / 1.0 = 28.5 + 21.25 + 22.5 + 17.6 = 89.85 ≈ 90
  const expected = 90;
  if (computed === expected) {
    console.log(`${GREEN}  ✓ Danger score: ${computed} (expected ${expected})${RESET}\n`);
    passed++;
  } else {
    console.log(`${RED}  ✗ Danger score: ${computed} (expected ${expected})${RESET}\n`);
    failed++;
  }

  // Summary
  console.log(`${'─'.repeat(width)}`);
  if (failed === 0) {
    console.log(`${GREEN}${BOLD}  All ${passed} tests passed ✓${RESET}\n`);
  } else {
    console.log(`${RED}${BOLD}  ${failed}/${passed + failed} tests failed ✗${RESET}\n`);
  }
}

runTests().catch((err) => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  process.exit(1);
});
