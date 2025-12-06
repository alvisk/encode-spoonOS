# Neo Wallet Guardian (SpoonOS) – Plan & Implementation Notes

This project is currently a planning space for a SpoonOS hackathon build. The goal is to ship an AI Wallet Copilot (Neo Wallet Guardian) that runs as a SpoonOS agent, analyzes wallets on Neo N3, surfaces risks, and optionally generates shareable alerts.

## Outcomes to demo
- SpoonOS ToolCallAgent that calls a wallet-summary tool and produces user-facing risk insights.
- Neo N3 on-chain reads (balances, holdings concentration, recent TXs, counterparty risk) via RPC/Explorer.
- Optional add-ons for prize stacking: AIOZ caching layer, 4Everland hosting, XerpaAI content generation, Gata “safety alignment” positioning.

## Architecture sketch
- Agent runtime: SpoonOS `ToolCallAgent` with a domain-specific system prompt.
- Core tool: `GetWalletSummaryTool` (BaseTool) -> fetch + aggregate on-chain data for one address (chain defaults to Neo N3).
- Optional tools:
  - `GenerateRiskAlertTool` -> wraps XerpaAI to create short social posts from the summary.
  - `CacheLookupTool` / `CacheWriteTool` -> talk to AIOZ W3S to read/write cached summaries.
  - `FlagCounterpartyRiskTool` -> checks counterparties against labels/blocklists and simple heuristics (new tokens, low liquidity, known scams).
  - `ScheduleMonitorTool` -> schedules rechecks and sends alerts when balances/risks change.
  - `MultiWalletDiffTool` -> compares two wallets for diversification and overlap.
- Flow:
  1) Agent receives wallet address.
  2) Cache lookup (if enabled) -> return cached summary or continue.
  3) Fetch balances/positions/txs from Neo RPC/Explorer; compute risk metrics.
  4) Agent composes human-readable summary + risk flags.
  5) Optionally call XerpaAI tool to draft a tweet/blog blurb.
  6) Persist summary to cache (if enabled).

## Additional agent features to consider
- Counterparty labeling and threat intel: map addresses to known entities/exploits; highlight first-time interactions with low-trust contracts or tokens.
- Approval and spend simulation (where feasible): before suggesting an action, simulate token approval/spend to spot unlimited approvals or unexpected token flows.
- Multi-wallet diversification check: compare a user’s hot vs. cold wallets and flag over-concentration or duplicated risk.
- Scheduled watching and alerts: let users subscribe to address changes (large outflow, new token, dusting, risk score jump) via periodic tool calls.
- Anomaly signals: detect sudden volume spikes, new-contract interactions, or stablecoin drain patterns.
- Compliance/safety posture: optional screening against community blocklists; surface “use at your own risk” when data quality is low.

### Priority add-ons with stub pseudocode
- `FlagCounterpartyRiskTool` (threat intel):
  - Params: `address`, `counterparties[]`.
  - Logic: for each counterparty, query labels/blocklists (local JSON or HTTP), check token age/liquidity heuristics; return risk tags per address.
- `ScheduleMonitorTool` (alerts):
  - Params: `address`, `interval_minutes`, `conditions[]` (e.g., `large_outflow`, `new_token`, `risk_score_jump`).
  - Logic: create a scheduled job (cron/service) that re-runs `GetWalletSummaryTool`, diffs metrics, and pushes an alert payload to the agent output channel.
- `MultiWalletDiffTool` (diversification):
  - Params: `addresses[]`.
  - Logic: fetch summaries for each address, compute overlap of tokens/counterparties, flag concentration > threshold.
- `ApprovalScanTool` (allowance sanity):
  - Params: `address`.
  - Logic: fetch known approvals/allowances; flag unlimited approvals or approvals to unlabeled/low-trust contracts; suggest revoke list.
- `ActionDraftTool` (safe next-steps messaging):
  - Params: `summary`, `risk_flags`, optional `channel`.
  - Logic: generate user-facing actions (rotate funds, revoke approvals, reduce concentration) while avoiding financial advice wording.

## Current code scaffold (in repo)
- `src/agent.py`: builds `ToolCallAgent` with summary/risk tools wired.
- `src/cli.py`: tiny CLI to run one prompt against the agent.
- `src/tools/get_wallet_summary.py`: real Neo RPC fetch (balances + transfers) with basic risk heuristics.
- `src/tools/wallet_validity_score.py`: computes a 0-100 validity/risk score using balances/transfers.
- `src/tools/*`: stubs for counterparty risk, scheduling, multi-wallet diff, approvals, action drafting.
- `src/neo_client.py`: minimal JSON-RPC client using `getnep17balances` and `getnep17transfers`.
- `src/config.py`: env-driven RPC/API key accessors.

## Quickstart (CLI)
```bash
cd wallet-guardian
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export NEO_RPC_URL=https://testnet1.neo.coz.io:443  # or your RPC
python -m src.cli "summarize wallet NhY...abc"

# Offline / demo mode (uses fixture data)
python -m src.cli --mock "summarize wallet NhY...abc"
```

Config template: see `env.example`.

### What works now
- ToolCallAgent scaffold with real Neo RPC client.
- `get_wallet_summary` fetches balances/transfers and computes simple risk flags; supports `--mock`/`WALLET_GUARDIAN_USE_MOCK` for demos.
- `wallet_validity_score` wraps the summary and returns a 0–100 score with deductions.

### Immediate next steps
- Improve counterparty labeling (`FlagCounterpartyRiskTool`) using a local JSON blocklist/allowlist.
- Add unit tests for risk metrics and mocked summary.
- Capture a short terminal demo video using the CLI (mock and live).
- Refine system prompt and add a short “Submission Details” section for the hackathon form.

## Implementation plan (phased)
### Phase 0 – Repo setup
- Choose runtime (Python with SpoonOS SDK suggested); add `pyproject.toml`/`requirements.txt`.
- Install SpoonOS SDK and Neo client library (see research below).
- Add `.env.example` with keys: `NEO_RPC_URL`, `XERPA_API_KEY`, `AIOZ_API_KEY`, etc.

### Phase 1 – Core agent + tool wiring
- Define `GetWalletSummaryTool` extending `BaseTool` with JSON Schema for params: `address`, optional `chain` defaulting to `neo3`.
- Implement minimal agent entrypoint (CLI or HTTP) that runs `ToolCallAgent` with `WALLET_SYSTEM_PROMPT`.
- Add deterministic tests for the tool schema and agent wiring (e.g., dry-run with mocked tool responses).

### Phase 2 – Neo integration (must-have)
- Select library: evaluate `neo-mamba` (Python, N3 support) or direct JSON-RPC via `requests/httpx`.
- Required RPC/Explorer calls (map to tool internals):
  - `getnep17balances` or equivalent to list token balances.
  - `getnep17transfers` or transaction history endpoint to sample recent inflows/outflows.
  - `getapplicationlog` as needed for deeper decoding of interactions.
- Implement helpers:
  - `fetch_balances_from_chain(address: str) -> list[Balance]`
  - `fetch_transfers(address: str, lookback_days: int=30) -> list[Tx]`
  - `enrich_counterparties(transfers) -> scoring data`
  - `compute_risk_metrics(balances, transfers) -> {concentration, stablecoin_ratio, large_counterparty_flag, inactive_flag, new_token_flag}`
- Use testnet RPC for dev; allow RPC URL override via env.
- Add lightweight fixtures and offline snapshots for unit tests (do not rely on live RPC in CI).

### Phase 3 – XerpaAI content generation (prize differentiator)
- Implement `GenerateRiskAlertTool`:
  - Params: `summary`, `tone` (`alert|informative`), `channel` (`tweet|blog|dm`), optional `cta`.
  - Calls XerpaAI HTTP endpoint with API key in header; enforce short outputs and compliance (no financial advice).
- Agent flow: if user asks for “alert” or “post”, call this tool with the latest wallet summary and risk flags.

### Phase 4 – AIOZ caching (performance/resilience)
- Add `CacheLookupTool(address)` and `CacheWriteTool(address, summary)` using AIOZ W3S.
- Strategy: cache by address + chain + version; include TTL in metadata.
- On cache hit, return cached summary; still allow “force refresh”.

### Phase 5 – Delivery/hosting (4Everland)
- Build a minimal UI or CLI landing page and host static assets on 4Everland Web3 Hosting.
- Optionally expose the agent via a small HTTP service; front-end calls it via fetch.

## Research notes (current gaps to confirm)
- Neo N3 Python SDK: verify the preferred client (`neo-mamba` or official N3 JSON-RPC examples) and confirm method names for balances/transfers on mainnet/testnet.
- Public RPC endpoints and rate limits for Neo N3; identify at least one reliable testnet and mainnet URL.
- XerpaAI API specifics: endpoint path, auth header format, rate limits, and response schema.
- AIOZ W3S API: how to write/read small JSON blobs efficiently; auth model.
- 4Everland deploy workflow for static sites; build command expectations.

## Testing strategy
- Unit: mock tool calls; validate JSON schemas; risk metric calculations from fixed fixtures.
- Integration: smoke test against Neo testnet RPC with a known faucet address; snapshot key responses.
- Agent: end-to-end prompt that asks for a wallet summary; assert tool-call sequence and output shape.

## Milestones
- M1: Agent scaffolding + mocked tool (no chain I/O) – Day 1.
- M2: Live Neo balance/transfer fetch + risk metrics – Day 2.
- M3: XerpaAI alert tool + AIOZ cache (optional) – Day 3.
- M4: 4Everland-hosted UI/CLI bundle and final demo script – Day 3/4.


