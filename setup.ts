#!/usr/bin/env npx tsx
/**
 * no-trust setup wizard — interactive config for alert tokens.
 * Prompts for Telegram and Discord credentials, validates with test pings,
 * and writes to config.local.json (gitignored). Zero npm dependencies.
 * Execute: npx tsx tools/no-trust/setup.ts
 */

import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOCAL_CONFIG_PATH = resolve(__dirname, 'config.local.json');

// ANSI helpers
const CYAN = '\x1b[96m';
const YELLOW = '\x1b[93m';
const GREEN = '\x1b[92m';
const RED = '\x1b[91m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
});

/** Prompt the user for input, return their answer. */
function ask(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(`${CYAN}${question}${RESET} `, (answer) => {
      resolve(answer.trim());
    });
  });
}

/** Load existing local config or start fresh. */
function loadLocalConfig(): Record<string, any> {
  if (existsSync(LOCAL_CONFIG_PATH)) {
    const raw = readFileSync(LOCAL_CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  }
  return {};
}

/** Save local config (secrets only) to gitignored file. */
function saveLocalConfig(config: Record<string, any>): void {
  writeFileSync(LOCAL_CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/** Test Telegram token + chat ID by sending a test message. */
async function testTelegram(token: string, chatId: string): Promise<boolean> {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ no-trust alert system connected successfully!',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Test Discord webhook by sending a test message. */
async function testDiscord(webhookUrl: string): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '✅ no-trust alert system connected successfully!',
      }),
    });
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const width = 60;
  console.log(`\n${CYAN}${BOLD}${'═'.repeat(width)}${RESET}`);
  console.log(`${CYAN}${BOLD}  no-trust setup wizard${RESET}`);
  console.log(`${CYAN}${BOLD}${'═'.repeat(width)}${RESET}\n`);

  const config = loadLocalConfig();

  // --- Telegram ---
  console.log(`${YELLOW}${BOLD}── Telegram Setup ──${RESET}`);
  console.log(`${DIM}  Get a bot token from @BotFather on Telegram.${RESET}`);
  console.log(`${DIM}  Get your chat ID by messaging @userinfobot.${RESET}\n`);

  const telegramToken = await ask('Telegram Bot Token (or Enter to skip):');
  if (telegramToken) {
    const chatId = await ask('Telegram Chat ID:');
    if (chatId) {
      console.log(`${DIM}  Testing Telegram connection...${RESET}`);
      const ok = await testTelegram(telegramToken, chatId);
      if (ok) {
        console.log(`${GREEN}  ✓ Telegram connected!${RESET}\n`);
        config.telegram_token = telegramToken;
        config.telegram_chat_id = chatId;
      } else {
        console.log(`${RED}  ✗ Telegram test failed — token/chatID saved anyway. Check credentials.${RESET}\n`);
        config.telegram_token = telegramToken;
        config.telegram_chat_id = chatId;
      }
    }
  } else {
    console.log(`${DIM}  Skipped.${RESET}\n`);
  }

  // --- Discord ---
  console.log(`${YELLOW}${BOLD}── Discord Setup ──${RESET}`);
  console.log(`${DIM}  Create a webhook in your Discord channel settings.${RESET}\n`);

  const discordWebhook = await ask('Discord Webhook URL (or Enter to skip):');
  if (discordWebhook) {
    console.log(`${DIM}  Testing Discord connection...${RESET}`);
    const ok = await testDiscord(discordWebhook);
    if (ok) {
      console.log(`${GREEN}  ✓ Discord connected!${RESET}\n`);
      config.discord_webhook = discordWebhook;
    } else {
      console.log(`${RED}  ✗ Discord test failed — webhook saved anyway. Check URL.${RESET}\n`);
      config.discord_webhook = discordWebhook;
    }
  } else {
    console.log(`${DIM}  Skipped.${RESET}\n`);
  }

  // --- Save ---
  saveLocalConfig(config);
  console.log(`${GREEN}${BOLD}  Config saved to config.local.json (gitignored)${RESET}`);
  console.log(`${CYAN}  Run the monitor: npx tsx tools/no-trust/monitor.ts${RESET}\n`);

  rl.close();
}

main().catch((err) => {
  console.error(`${RED}Fatal: ${err.message}${RESET}`);
  rl.close();
  process.exit(1);
});
