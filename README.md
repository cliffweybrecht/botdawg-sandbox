# Stock Agent (Phase A)

Read-only market intelligence for Robinhood Chain tokenized stocks.

Stock Agent is the agent/orchestration plane. Robinhood Liquidity Terminal remains the data/truth plane. Phase A consumes Terminal HTTP APIs only.

## What Phase A does

Answers: "What is happening across tokenized stocks on Robinhood Chain right now?"

Reports assets, venues, verified execution observations, market snapshot prices, sampled depth evidence, price impact and gasEstimate fields when present, venue differences, data quality, and block provenance.
## Out of scope for Phase A

- No wallet or chain-write functionality
- No direct chain RPC from Stock Agent
- No profitability or trade recommendations
- Terminal repo is not modified
## Setup
Run `npm install` to install dependencies.
## Commands
`npm test`
