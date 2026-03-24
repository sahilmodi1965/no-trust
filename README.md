# no-trust — Market Exit Alert System

> **Autonomy Level 1** — agent-in-terminal

Open-source black swan detector that monitors free public APIs for market danger signals and alerts you when it's time to exit.

**⚠️ DISCLAIMER: This is not financial advice. This tool is for educational and informational purposes only. Always do your own research and consult a qualified financial advisor before making investment decisions.**

## What It Does

Runs a continuous monitoring loop that checks four signal sources every 5 minutes:

| Signal | Source | What It Measures |
|--------|--------|-----------------|
| **VIX** | Yahoo Finance | CBOE Volatility Index (fear gauge) |
| **Crypto** | CoinGecko | BTC/ETH price + 24h change |
| **News** | Google News RSS | Black swan keyword density in headlines |
| **Market** | Yahoo Finance | S&P 500 daily movement |

Each signal produces a danger score (0-100). These are combined into a weighted composite score that triggers alerts at three levels:

- **WATCH** (30+) — Something is off. Pay attention.
- **WARNING** (50+) — Multiple signals elevated. Review your positions.
- **EXIT-NOW** (75+) — Black swan conditions detected. Act now.

## Quickstart

```bash
# 1. Configure alert channels (optional — terminal alerts always work)
npx tsx tools/no-trust/setup.ts

# 2. Start the monitor
npx tsx tools/no-trust/monitor.ts

# 3. Test the alert pipeline with simulated data (dry-run, no real alerts sent)
npx tsx tools/no-trust/test.ts
```

## Requirements

- Node.js 18+ (for native `fetch`)
- Zero npm dependencies

## Configuration

Run the setup wizard to configure alert channels. Secrets are stored in `config.local.json` (gitignored). Defaults live in `config.defaults.json` (tracked).

### config.defaults.json (tracked)

```json
{
  "thresholds": {
    "danger_score_exit": 75,
    "danger_score_warning": 50,
    "danger_score_watch": 30
  },
  "check_interval_ms": 300000,
  "signal_weights": {
    "vix": 0.3,
    "crypto": 0.25,
    "news": 0.25,
    "market": 0.2
  }
}
```

### config.local.json (gitignored — created by setup wizard)

```json
{
  "telegram_token": "your-bot-token",
  "telegram_chat_id": "your-chat-id",
  "discord_webhook": "https://discord.com/api/webhooks/..."
}
```

Alert channels with `null` or missing tokens are silently skipped — the terminal always works.

## Architecture

```
tools/no-trust/
├── .gitignore               # Keeps config.local.json out of git
├── config.defaults.json     # Thresholds + weights (tracked)
├── config.ts                # Shared config loader (merges defaults + local)
├── monitor.ts               # Main loop — fetches, scores, alerts
├── alert.ts                 # Dispatch to Telegram / Discord / terminal
├── setup.ts                 # Interactive config wizard → config.local.json
├── test.ts                  # Simulation harness (dry-run, no real alerts)
├── signals/
│   ├── types.ts             # Shared Signal interface
│   ├── vix.ts               # VIX fetcher + scorer
│   ├── crypto.ts            # BTC/ETH fetcher + scorer
│   ├── news.ts              # Headline sentiment scorer
│   └── market.ts            # S&P 500 fetcher + scorer
└── README.md
```

## Signal Scoring

All signals return a uniform shape:

```typescript
interface Signal {
  name: string;
  value: number;
  score: number;
  detail: string;
}
```

Scores map to danger levels:
- **0-15**: Calm / normal
- **15-30**: Slightly elevated
- **30-50**: Notable — something happening
- **50-75**: Major concern
- **75-100**: Extreme / black swan territory

## Tuning Thresholds

- **Lower thresholds** = more sensitive, more alerts
- **Higher thresholds** = fewer false positives, risk missing fast moves
- Adjust `signal_weights` to prioritize signals you trust most
- The VIX signal carries the highest default weight (0.3) because it's the most established fear gauge
- Override any default in `config.local.json` — local values take precedence

## License

Part of [Sahil Agent OS](https://github.com/sahilmodi1965/Sahilclaudeopensource). MIT License.
