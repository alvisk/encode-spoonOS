# Wallet Guardian - SpoonOS Hackathon Submission

> AI-powered multi-chain wallet security agent built on SpoonOS with Neo N3 Oracle integration

---

## Quick Links

| Resource | Link |
|----------|------|
| Live API | https://encode-spoonos-production.up.railway.app |
| API Docs | https://encode-spoonos-production.up.railway.app/docs |
| Frontend | wallet-guardian-web (local) |

---

## Track: AI Agent with Web3

This project fits the **AI Agent with Web3** track:
- AI agent that **acts autonomously** on-chain (via Neo Oracle)
- **Multi-chain support** (Neo N3 + Ethereum)
- **x402 payment integration** for pay-per-invoke
- **Decision-making** via SpoonOS LLM with tool execution

---

## Key Differentiators

### 1. Neo Oracle Smart Contract (On-Chain Risk Scores)

**This is the killer feature.** We've built a Neo N3 smart contract that:
- Uses Neo's **native Oracle service** to fetch risk scores from our API
- Stores risk scores **on-chain** for trustless verification
- Allows **any dApp** to query wallet risk before transactions

```python
# contracts/wallet_risk_oracle.py - 242 lines of production Neo N3 code

@public
def request_risk_score(address: str) -> bool:
    """Triggers Oracle to fetch score from our API and store on-chain."""
    url = get_api_url() + address
    OracleContract.request(url, "$.score", 'oracle_callback', ...)
    return True

@public
def get_risk_score(address: str) -> int:
    """Query stored risk score - any dApp can call this."""
    return get_int(RISK_SCORE_PREFIX + to_bytes(address))

@public
def is_risky(address: str, threshold: int) -> bool:
    """Check if address is risky before allowing transaction."""
    score = get_risk_score(address)
    return score < threshold
```

**Use Case**: A Neo DEX can call `is_risky(sender, 60)` before allowing trades to protect users from interacting with flagged wallets.

**Files**: `contracts/wallet_risk_oracle.py`, `contracts/deploy.py`

---

### 2. AI-Powered Malicious Contract Detector

A comprehensive smart contract security scanner that:
- **Pattern matching**: 20+ regex patterns for honeypots, rug pulls, reentrancy
- **AI deep analysis**: Uses SpoonOS ChatBot to analyze source code
- **Known malicious DB**: 10+ historical exploits (The DAO, Cream, etc.)
- **Trusted contracts**: Whitelist for USDC, Uniswap, Aave, etc.

```python
# src/tools/malicious_contract_detector.py - 716 lines

class MaliciousContractDetectorTool(BaseTool):
    """
    Uses pattern matching AND AI-powered deep analysis to detect:
    - Honeypot patterns (can buy but not sell)
    - Rug pull mechanisms (owner can drain funds)
    - Fee manipulation (fees can be set to 100%)
    - Reentrancy vulnerabilities
    - Access control issues
    - Proxy upgrade risks
    - Self-destruct capabilities
    """
```

**API Endpoint**: `GET /api/v2/contract-scan/{address}?chain=sepolia`

**Example Response**:
```json
{
  "contract_address": "0x...",
  "verdict": {
    "is_malicious": true,
    "risk_score": 85,
    "risk_level": "CRITICAL",
    "confidence": 0.85
  },
  "detected_issues": [
    {
      "category": "honeypot",
      "pattern": "hidden_transfer_restriction",
      "severity": "CRITICAL",
      "explanation": "This contract contains hidden transfer restrictions...",
      "recommendation": "DO NOT interact with this contract."
    }
  ],
  "summary": "CRITICAL RISK: This contract exhibits honeypot patterns..."
}
```

**Files**: `src/tools/malicious_contract_detector.py`, `src/tools/known_malicious_contracts.py`

---

## SpoonOS Integration (Baseline Requirements)

### Requirement 1: Use Spoon to invoke LLM

```python
# src/agent.py:101-119
from spoon_ai.chat import ChatBot

def _get_llm() -> ChatBot:
    if openai_key:
        return ChatBot(
            llm_provider="openai",
            api_key=openai_key,
            model_name="gpt-4o-mini",
        )
    elif anthropic_key:
        return ChatBot(llm_provider="anthropic", ...)
    elif gemini_key:
        return ChatBot(llm_provider="gemini", ...)
```

**Agent invocation flow**: `User Query -> FastAPI -> ToolCallAgent -> SpoonOS ChatBot -> LLM -> Tool Execution -> Response`

### Requirement 2: Use at least one Tool from spoon-toolkit

All 8 tools inherit from `spoon_ai.tools.BaseTool`:

| Tool | Status | Description |
|------|--------|-------------|
| `get_wallet_summary` | Working | Fetches Neo N3/ETH balances & transfers |
| `wallet_validity_score` | Working | Computes 0-100 risk score |
| `flag_counterparty_risk` | Working | Labels counterparties using blocklists + graph |
| `malicious_contract_detector` | Working | AI-powered contract security scanner |
| `schedule_monitor` | Working | Adds wallets to real-time monitoring |
| `multi_wallet_diff` | Working | Portfolio analysis with parallel execution |
| `approval_scan` | Working | Scans for risky contract interactions |
| `action_draft` | Working | Generates safe, non-advisory messaging |

```python
# src/tools/get_wallet_summary.py
from spoon_ai.tools import BaseTool

class GetWalletSummaryTool(BaseTool):
    name: ClassVar[str] = "get_wallet_summary"
    description: ClassVar[str] = "Fetch wallet balances and recent transfers..."
    parameters: ClassVar[Dict[str, Any]] = {...}
    
    def call(self, address: str, lookback_days: int = 30):
        # Implementation
```

---

## Bonus Criteria

| Bonus | Status | Evidence |
|-------|--------|----------|
| **X402 Integration** | Implemented | `server.py:223-258` - Payment flow with 402 response |
| **Graph Technologies** | Implemented | `graph_orchestrator.py` - DAG-based computation graph |
| **Neo Technologies** | Implemented | Oracle contract, RPC client, NEP-17 support |

### Graph-Based Computation (graph_orchestrator.py - 1124 lines)

```
Computation Graph:
                    fetch_data (root)
                         |
        +----------------+----------------+
        v                v                v
  concentration  stablecoin_ratio  counterparties
        v                v                v
        +----------------+----------------+
                         v
                   risk_score
                         v
                   final_report
```

- **Eliminates redundant RPC calls** through shared cache
- **Parallel execution** of independent computations
- **TTL-based caching** with lock-based deduplication

---

## Technical Architecture

```
                                  +------------------+
                                  |   Neo N3 Oracle  |
                                  |    (On-Chain)    |
                                  +--------+---------+
                                           |
+-------------+     +------------------+   |   +------------------+
|   Frontend  |---->|  FastAPI Server  |<--+-->|   Neo N3 RPC     |
| (Next.js)   |     |  (Python)        |       |   (Testnet)      |
+-------------+     +--------+---------+       +------------------+
                             |
              +--------------+--------------+
              v              v              v
      +-------+------+ +-----+-----+ +------+------+
      | ToolCallAgent| | Graph     | | Multi-Agent |
      | (SpoonOS)    | | Orchestr. | | Orchestr.   |
      +--------------+ +-----------+ +-------------+
              |
    +---------+---------+---------+---------+
    v         v         v         v         v
+-------+ +-------+ +-------+ +-------+ +-------+
| Wallet| | Risk  | | Malici| | Count.| | Voice |
| Summ. | | Score | | Detect| | Risk  | | Alert |
+-------+ +-------+ +-------+ +-------+ +-------+
```

---

## API Endpoints

### Core Analysis
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/analyze` | POST | Free wallet analysis |
| `/x402/invoke/{agent}` | POST | Paid agent invocation |
| `/api/v2/analyze/{address}` | POST | Graph-based analysis |
| `/api/v2/contract-scan/{address}` | GET | Malicious contract scan |

### Neo Oracle Integration
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/contract/info` | GET | Get deployed contract info |
| `/api/v2/contract/score/{address}` | GET | Query on-chain risk score |
| `/api/v2/contract/request-oracle/{address}` | POST | Trigger Oracle request |

### Advanced Features
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/portfolio` | POST | Multi-wallet portfolio analysis |
| `/api/v2/predict/{address}` | POST | Risk trend prediction |
| `/api/v2/graph` | POST | Wallet relationship graph |
| `/api/v2/monitor` | POST | Real-time monitoring |
| `/api/v2/alerts` | GET | Alert management |

---

## Demo Scenarios

### Demo 1: Analyze Neo N3 Wallet
```bash
curl -X POST https://encode-spoonos-production.up.railway.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ"}'
```

### Demo 2: Scan Malicious Contract
```bash
# Scan The DAO (famous reentrancy exploit)
curl "https://encode-spoonos-production.up.railway.app/api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413?chain=ethereum"
```

### Demo 3: Query Neo Oracle Contract
```bash
# Get on-chain risk score (if deployed)
curl "https://encode-spoonos-production.up.railway.app/api/v2/contract/score/NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ"
```

---

## File Structure

```
wallet-guardian/
├── contracts/
│   ├── wallet_risk_oracle.py      # Neo N3 Oracle contract (242 lines)
│   ├── wallet_risk_oracle.nef     # Compiled contract
│   ├── wallet_risk_oracle.manifest.json
│   └── deploy.py                  # Deployment script
├── src/
│   ├── agent.py                   # SpoonOS agent setup (257 lines)
│   ├── graph_orchestrator.py      # DAG computation (1124 lines)
│   ├── neo_client.py              # Neo N3 RPC client
│   ├── eth_client.py              # Ethereum client (Blockscout)
│   ├── advanced_features.py       # Portfolio, monitoring, alerts
│   ├── voice_guardian.py          # ElevenLabs TTS integration
│   └── tools/
│       ├── get_wallet_summary.py
│       ├── wallet_validity_score.py
│       ├── counterparty_risk.py
│       ├── malicious_contract_detector.py  # 716 lines
│       ├── known_malicious_contracts.py    # 606 lines
│       └── ...
├── server.py                      # FastAPI server (1338 lines)
└── requirements.txt
```

---

## Scoring Self-Assessment

| Criteria | Score | Justification |
|----------|-------|---------------|
| **Idea** | 7/10 | Valid use case, Neo Oracle is innovative |
| **Technical Execution** | 8/10 | All 8 tools working, graph orchestrator, Neo contract |
| **Presentation** | 7/10 | Good UI, API docs, needs demo video |
| **Wow Factor** | 8/10 | Neo Oracle, AI contract scanner, multi-chain |
| **Overall** | **7.5/10** | Strong technical execution, unique Neo integration |

---

## What Makes This Submission Stand Out

1. **First-of-its-kind**: Neo Oracle-based wallet risk scoring on-chain
2. **Production-ready**: 1338-line server with 20+ endpoints
3. **Deep SpoonOS integration**: 8 tools, multi-provider LLM, agent orchestration
4. **Real security value**: Detects actual scam patterns with explanations
5. **Multi-chain**: Seamless Neo N3 + Ethereum support

---

## Team

Built for the Encode x SpoonOS Hackathon (December 2025)
