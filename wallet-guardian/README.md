# Neo Wallet Guardian (Assertion OS)

AI-powered wallet analysis agent for Neo N3 blockchain, built on SpoonOS.

> **Hackathon Status**: Early prototype. See [HACKATHON_REVIEW.md](./HACKATHON_REVIEW.md) for honest assessment and [TODO.md](./TODO.md) for improvement roadmap.

## What Works Now

| Feature | Status | Notes |
|---------|--------|-------|
| Neo N3 RPC Integration | Working | `getnep17balances`, `getnep17transfers` |
| Wallet Summary Tool | Working | Fetches balances, transfers, computes risk metrics |
| Validity Score Tool | Working | 0-100 score with deduction breakdown |
| FastAPI Server | Working | Health checks, analyze endpoint |
| Docker Deployment | Working | Ready for Railway/Render |
| Web UI Scanner | Working | Live wallet scanning with NeoLine |

### Not Yet Implemented
- x402 payment verification (mocked)
- Counterparty risk labeling
- Scheduled monitoring
- Multi-wallet comparison
- Approval scanning

---

## Quick Start

### 1. Setup Environment

```bash
cd wallet-guardian
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Copy and configure environment
cp env.example .env
```

### 2. Run the Server

```bash
python server.py
# API docs at http://localhost:8000/docs
```

### 3. Test the API

```bash
# Health check
curl http://localhost:8000/health

# Analyze a wallet (mock mode)
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", "use_mock": true}'

# Live mode (requires NEO_RPC_URL)
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq"}'
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | Wallet analysis (no payment required) |
| `/x402/invoke/{agent}` | POST | Invoke agent (x402 payment - not yet verified) |
| `/agents` | GET | List available agents |

---

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Client    │────▶│  FastAPI Server  │────▶│  Tool Executor  │
│             │     │                  │     │  (Direct calls) │
│             │◀────│                  │◀────│  - Neo RPC      │
│             │     │                  │     │  - Risk metrics │
└─────────────┘     └──────────────────┘     └─────────────────┘
```

**Note**: The server currently bypasses the SpoonOS ToolCallAgent and executes tools directly. This is a known limitation documented in [TODO.md](./TODO.md).

---

## Tools

| Tool | Status | Description |
|------|--------|-------------|
| `get_wallet_summary` | **Working** | Fetch balances/transfers, compute risk metrics |
| `wallet_validity_score` | **Working** | 0-100 validity score with deductions |
| `flag_counterparty_risk` | Stub | Returns empty results |
| `schedule_monitor` | Stub | Returns placeholder response |
| `multi_wallet_diff` | Stub | Returns empty comparison |
| `approval_scan` | Stub | Returns empty results |
| `action_draft` | Stub | Basic string formatting only |

---

## Risk Metrics Computed

The working tools calculate:

- **Concentration**: Percentage of holdings in single largest asset
- **Stablecoin Ratio**: Percentage of portfolio in stablecoins (USDT, USDC, etc.)
- **Counterparty Count**: Number of unique addresses interacted with
- **Risk Flags**: `high_concentration`, `low_stablecoin_buffer`, `inactive_or_new_wallet`

---

## CLI Usage

```bash
# With LLM configured
python -m src.cli "summarize wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq"

# Mock mode (no RPC calls)
python -m src.cli --mock "summarize wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq"
```

---

## Deployment

### Docker

```bash
docker build -t wallet-guardian .
docker run -p 8000:8000 --env-file .env wallet-guardian
```

### Environment Variables

```bash
# Required for live mode
NEO_RPC_URL=https://testnet1.neo.coz.io:443

# Optional (not yet implemented)
X402_RECEIVER_ADDRESS=0x...
X402_AGENT_PRIVATE_KEY=0x...
```

---

## Development

See [TODO.md](./TODO.md) for the prioritized improvement roadmap.

### Key Files

| File | Purpose |
|------|---------|
| `server.py` | FastAPI server with endpoints |
| `src/agent.py` | SpoonOS ToolCallAgent setup |
| `src/neo_client.py` | Neo N3 JSON-RPC client |
| `src/tools/get_wallet_summary.py` | Main analysis tool |
| `src/tools/wallet_validity_score.py` | Scoring tool |

---

## License

MIT
