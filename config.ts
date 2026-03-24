/**
 * Shared config loader — merges tracked defaults with gitignored local secrets.
 * config.defaults.json is committed (thresholds, weights).
 * config.local.json is gitignored (tokens, credentials).
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Config {
  telegram_token: string | null;
  telegram_chat_id: string | null;
  discord_webhook: string | null;
  thresholds: {
    danger_score_exit: number;
    danger_score_warning: number;
    danger_score_watch: number;
  };
  check_interval_ms: number;
  signal_weights: {
    vix: number;
    crypto: number;
    news: number;
    market: number;
  };
}

/** Load config by merging defaults with local secrets. Reloads from disk each call. */
export function loadConfig(): Config {
  const defaultsPath = resolve(__dirname, 'config.defaults.json');
  const localPath = resolve(__dirname, 'config.local.json');

  const defaults = JSON.parse(readFileSync(defaultsPath, 'utf-8'));

  let local: Record<string, any> = {};
  if (existsSync(localPath)) {
    local = JSON.parse(readFileSync(localPath, 'utf-8'));
  }

  return {
    telegram_token: local.telegram_token ?? null,
    telegram_chat_id: local.telegram_chat_id ?? null,
    discord_webhook: local.discord_webhook ?? null,
    thresholds: { ...defaults.thresholds, ...local.thresholds },
    check_interval_ms: local.check_interval_ms ?? defaults.check_interval_ms,
    signal_weights: { ...defaults.signal_weights, ...local.signal_weights },
  };
}
