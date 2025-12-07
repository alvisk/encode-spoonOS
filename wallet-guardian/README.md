# Wallet Guardian (Assertion OS)

AI-powered multi-chain wallet security agent built on **SpoonOS** with **Neo N3 Oracle** integration.

> **Track**: AI Agent with Web3  
> **Hackathon**: Encode x SpoonOS (December 2025)

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Neo Oracle Contract** | On-chain risk scores via Neo's native Oracle service |
| **AI Contract Scanner** | Detects honeypots, rug pulls, reentrancy with explanations |
| **Multi-Chain** | Supports Neo N3 and Ethereum (auto-detection) |
| **SpoonOS Agent** | 8 tools powered by SpoonOS ToolCallAgent |
| **x402 Payments** | Pay-per-invoke micropayments on Base Sepolia |
| **Graph Orchestrator** | DAG-based computation with caching |

---

## Live Demo

| Resource | URL |
|----------|-----|
| **API** | https://encode-spoonos-production.up.railway.app |
| **Docs** | https://encode-spoonos-production.up.railway.app/docs |

### Quick Test

```bash
# Analyze a Neo N3 wallet
curl -X POST https://encode-spoonos-production.up.railway.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ"}'

# Scan a contract for malicious patterns (The DAO - famous hack)
curl "https://encode-spoonos-production.up.railway.app/api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413?chain=ethereum"
```

---

## Differentiators

### 1. Neo Oracle Smart Contract

We've built a Neo N3 smart contract that uses Neo's **native Oracle** to fetch and store wallet risk scores on-chain:

```python
# contracts/wallet_risk_oracle.py

@public
def request_risk_score(address: str) -> bool:
    """Triggers Oracle to fetch score from API and store on-chain."""
    OracleContract.request(url, "$.score", 'oracle_callback', ...)

@public  
def is_risky(address: str, threshold: int) -> bool:
    """Any dApp can call this before allowing transactions."""
    return get_risk_score(address) < threshold
```

**Use Case**: A Neo DEX calls `is_risky(sender, 60)` before trades to protect users.

### 2. AI-Powered Malicious Contract Detector

Comprehensive security scanner with:
- **20+ regex patterns** for honeypots, rug pulls, reentrancy
- **AI deep analysis** via SpoonOS ChatBot
- **10+ known exploits** database (The DAO, Cream Finance, etc.)
- **Detailed explanations** of why contracts are dangerous

```bash
# Example: Scan The DAO contract
curl "/api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413"

# Returns:
{
  "verdict": {
    "is_malicious": true,
    "risk_score": 100,
    "risk_level": "CRITICAL"
  },
  "summary": "CRITICAL: This is a KNOWN MALICIOUS contract (The DAO). 
              Exploited via reentrancy vulnerability in splitDAO function..."
}
```

---

## SpoonOS Integration

### Requirement 1: LLM via SpoonOS

```python
from spoon_ai.chat import ChatBot

llm = ChatBot(
    llm_provider="openai",  # or anthropic, gemini
    api_key=api_key,
    model_name="gpt-4o-mini",
)
```

### Requirement 2: Tools from spoon-toolkit

All 8 tools inherit from `spoon_ai.tools.BaseTool`:

| Tool | Status | Description |
|------|--------|-------------|
| `get_wallet_summary` | Working | Fetches Neo N3/ETH balances & transfers |
| `wallet_validity_score` | Working | Computes 0-100 risk score |
| `flag_counterparty_risk` | Working | Labels counterparties with risk tags |
| `malicious_contract_detector` | Working | AI-powered contract security scanner |
| `schedule_monitor` | Working | Real-time wallet monitoring |
| `multi_wallet_diff` | Working | Portfolio comparison |
| `approval_scan` | Working | Scans risky approvals |
| `action_draft` | Working | Generates safe messaging |

---

## Local Development

### Setup

```bash
cd wallet-guardian
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure environment
cp env.example .env
# Add your API keys: OPENAI_API_KEY, NEO_RPC_URL, etc.
```

### Run Server

```bash
python server.py
# API docs at http://localhost:8000/docs
```

### Run Tests

```bash
# Analyze a wallet
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq"}'

# Scan a contract
curl "http://localhost:8000/api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413?chain=ethereum"
```

---

## API Endpoints

### Core Analysis
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | Free wallet analysis (SpoonOS agent) |
| `/x402/invoke/{agent}` | POST | Paid invocation (x402) |
| `/api/v2/analyze/{address}` | POST | Graph-based analysis |
| `/api/v2/contract-scan/{address}` | GET | Malicious contract scan |

### Neo Oracle
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/contract/info` | GET | Deployed contract info |
| `/api/v2/contract/score/{address}` | GET | Query on-chain risk score |

### Advanced
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/portfolio` | POST | Multi-wallet analysis |
| `/api/v2/predict/{address}` | POST | Risk prediction |
| `/api/v2/graph` | POST | Relationship graph |
| `/api/v2/monitor` | POST | Real-time monitoring |
| `/api/v2/alerts` | GET | Alert management |

---

## Architecture

```
+-------------+     +------------------+     +------------------+
|   Frontend  |---->|  FastAPI Server  |---->|   Neo N3 RPC     |
| (Next.js)   |     |  + SpoonOS Agent |     |   + Oracle       |
+-------------+     +--------+---------+     +------------------+
                             |
              +--------------+--------------+
              v              v              v
        +---------+    +---------+    +---------+
        | Wallet  |    | Contract|    | Graph   |
        | Tools   |    | Scanner |    | Orch.   |
        +---------+    +---------+    +---------+
```

---

## Files

```
wallet-guardian/
├── contracts/
│   ├── wallet_risk_oracle.py      # Neo N3 Oracle contract
│   └── deploy.py                  # Deployment script
├── src/
│   ├── agent.py                   # SpoonOS agent
│   ├── graph_orchestrator.py      # DAG computation
│   ├── neo_client.py              # Neo N3 RPC
│   ├── eth_client.py              # Ethereum/Blockscout
│   └── tools/
│       ├── malicious_contract_detector.py
│       ├── known_malicious_contracts.py
│       └── ...
├── server.py                      # FastAPI server
└── HACKATHON_REVIEW.md            # Detailed submission docs
```

---

## Deployment

### Docker

```bash
docker build -t wallet-guardian .
docker run -p 8000:8000 --env-file .env wallet-guardian
```

### Neo Contract Deployment

```bash
cd contracts
python deploy.py --wif YOUR_WIF_KEY
# Requires ~10 GAS on Neo N3 Testnet
```

---

## License

MIT
