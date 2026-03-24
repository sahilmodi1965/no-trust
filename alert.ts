/**
 * Alert dispatcher — sends danger alerts to Telegram, Discord, or terminal.
 * Reads tokens from config.local.json (gitignored). Gracefully skips unconfigured channels.
 * Zero npm dependencies — native fetch only.
 */

import { loadConfig } from './config.ts';

export type AlertLevel = 'WATCH' | 'WARNING' | 'EXIT-NOW';

export interface MacroData {
  name: string;
  flag: string;
  index: string;
  price: number;
  changePct: number;
  assessment: string;
}

export interface AlertPayload {
  level: AlertLevel;
  dangerScore: number;
  signals: { name: string; score: number; detail: string }[];
  timestamp: string;
  action?: string;
  macro?: MacroData[];
}

// ANSI color helpers
const RED = '\x1b[91m';
const GREEN = '\x1b[92m';
const YELLOW = '\x1b[93m';
const CYAN = '\x1b[96m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BG_RED = '\x1b[41m';

/** Format the full 6-hour briefing message for Telegram/Discord. */
function formatMessage(payload: AlertPayload): string {
  const header = payload.level === 'EXIT-NOW'
    ? '🚨 EXIT-NOW ALERT 🚨'
    : payload.level === 'WARNING'
      ? '⚠️ WARNING'
      : payload.dangerScore < 30
        ? '✅ ALL CLEAR'
        : '👀 WATCH';

  const lines = [
    `📊 no-trust — Market Brief`,
    `━━━━━━━━━━━━━━━━━━━━━━`,
    '',
    `${header}`,
    `Danger Score: ${payload.dangerScore}/100`,
  ];

  // Action headline
  if (payload.action) {
    lines.push(`💡 Action: ${payload.action}`);
  }

  lines.push('');

  // Macro analysis
  if (payload.macro && payload.macro.length > 0) {
    lines.push('🌍 Macro Analysis');
    lines.push('─────────────────');
    for (const m of payload.macro) {
      const sign = m.changePct >= 0 ? '+' : '';
      lines.push(`${m.flag} ${m.name}`);
      lines.push(`   ${m.index}: ${m.price > 0 ? m.price.toLocaleString() : 'N/A'} (${sign}${m.changePct.toFixed(2)}%)`);
      lines.push(`   ${m.assessment}`);
    }
    lines.push('');
  }

  // Signals
  lines.push('⚡ Signals');
  lines.push('─────────────────');
  for (const s of payload.signals) {
    const bar = s.score >= 75 ? '🔴' : s.score >= 50 ? '🟡' : s.score >= 25 ? '🟠' : '🟢';
    lines.push(`${bar} ${s.name}: ${s.score}/100 — ${s.detail}`);
  }

  lines.push('');
  lines.push(`⏱ ${new Date(payload.timestamp).toUTCString()}`);
  lines.push(`⚠️ Not financial advice`);

  return lines.join('\n');
}

/** Print a colorful terminal alert. */
function alertTerminal(payload: AlertPayload): void {
  const width = 60;
  const pad = (s: string) => s.padEnd(width);

  if (payload.level === 'EXIT-NOW') {
    console.log(`\n${BG_RED}${BOLD}${'═'.repeat(width)}${RESET}`);
    console.log(`${BG_RED}${BOLD}${pad('  🚨  EXIT-NOW  —  DANGER SCORE ' + payload.dangerScore + '/100')}${RESET}`);
    console.log(`${BG_RED}${BOLD}${'═'.repeat(width)}${RESET}`);
  } else if (payload.level === 'WARNING') {
    console.log(`\n${YELLOW}${BOLD}${'─'.repeat(width)}${RESET}`);
    console.log(`${YELLOW}${BOLD}  ⚠️  WARNING  —  Danger Score ${payload.dangerScore}/100${RESET}`);
    console.log(`${YELLOW}${BOLD}${'─'.repeat(width)}${RESET}`);
  } else {
    console.log(`\n${CYAN}${'─'.repeat(width)}${RESET}`);
    console.log(`${CYAN}  👀  WATCH  —  Danger Score ${payload.dangerScore}/100${RESET}`);
    console.log(`${CYAN}${'─'.repeat(width)}${RESET}`);
  }

  for (const s of payload.signals) {
    const color = s.score >= 75 ? RED : s.score >= 50 ? YELLOW : DIM;
    console.log(`${color}  ${s.name.padEnd(10)} ${String(s.score).padStart(3)}/100  ${s.detail}${RESET}`);
  }

  console.log('');
}

/** Send alert to Telegram Bot API (plain text, no parse_mode). */
async function alertTelegram(
  payload: AlertPayload,
  token: string,
  chatId: string
): Promise<void> {
  const text = formatMessage(payload);
  const url = `https://api.telegram.org/bot${token}/sendMessage`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (!res.ok) {
      console.error(`${YELLOW}Telegram alert failed: ${res.status}${RESET}`);
    }
  } catch (err: any) {
    console.error(`${YELLOW}Telegram alert error: ${err.message}${RESET}`);
  }
}

/** Send alert to Discord webhook. */
async function alertDiscord(
  payload: AlertPayload,
  webhookUrl: string
): Promise<void> {
  const content = formatMessage(payload);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!res.ok) {
      console.error(`${YELLOW}Discord alert failed: ${res.status}${RESET}`);
    }
  } catch (err: any) {
    console.error(`${YELLOW}Discord alert error: ${err.message}${RESET}`);
  }
}

/** Dispatch alert to all configured channels. Set dryRun=true to skip remote channels. */
export async function sendAlert(payload: AlertPayload, dryRun = false): Promise<void> {
  // Always print to terminal
  alertTerminal(payload);

  if (dryRun) return;

  const config = loadConfig();

  // Telegram — skip if token or chat ID not configured
  if (config.telegram_token && config.telegram_chat_id) {
    await alertTelegram(payload, config.telegram_token, config.telegram_chat_id);
    console.log(`${GREEN}  ✓ Telegram briefing sent${RESET}`);
  }

  // Discord — skip if webhook not configured
  if (config.discord_webhook) {
    await alertDiscord(payload, config.discord_webhook);
    console.log(`${GREEN}  ✓ Discord briefing sent${RESET}`);
  }
}
