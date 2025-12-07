# Wallet Guardian (Assertion OS)

AI-powered multi-chain wallet security agent built on **SpoonOS** with **Neo N3 Oracle** integration.

> **Track**: AI Agent with Web3  
> **Hackathon**: Encode x SpoonOS (December 2025)

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Live Demo](#live-demo)
- [Architecture](#architecture)
- [LLM Integration](#llm-integration)
- [Custom Tools](#custom-tools)
- [Neo N3 Oracle Contract](#neo-n3-oracle-contract)
- [Advanced Features](#advanced-features)
- [API Reference](#api-reference)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage Examples](#usage-examples)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

Wallet Guardian is a security-focused AI agent that provides real-time risk analysis for blockchain wallets and smart contracts. The system combines on-chain data analysis with LLM-powered intelligence to detect malicious patterns, assess wallet health, and provide actionable security insights.

### What It Does

- **Wallet Risk Analysis**: Computes trust scores (0-100) based on portfolio concentration, stablecoin ratios, counterparty diversity, and transaction patterns
- **Malicious Contract Detection**: Scans Ethereum smart contracts for honeypots, rug pulls, reentrancy vulnerabilities using 20+ regex patterns + AI deep analysis
- **Suspicious Activity Detection**: Identifies rapid transactions, dust attacks, large transfers, and interactions with known scam addresses
- **Multi-Chain Support**: Auto-detects and analyzes Neo N3 (N...) and Ethereum (0x...) addresses
- **Real-Time Monitoring**: WebSocket-ready event streaming with configurable alert thresholds
- **Voice Alerts**: ElevenLabs-powered audio notifications for critical security events

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Neo Oracle Contract** | On-chain risk scores via Neo's native Oracle service |
| **AI Contract Scanner** | Detects honeypots, rug pulls, reentrancy with detailed explanations |
| **Multi-Chain** | Supports Neo N3 and Ethereum with auto-detection |
| **SpoonOS Agent** | 8 custom tools powered by SpoonOS ToolCallAgent |
| **x402 Payments** | Pay-per-invoke micropayments on Base Sepolia |
| **Graph Orchestrator** | DAG-based computation with caching for efficient parallel execution |
| **Voice Guardian** | ElevenLabs TTS integration for audio alerts |
| **Smart Alerts** | Configurable rules with priority levels |
| **Portfolio Analysis** | Multi-wallet comparison and diversification scoring |
| **Predictive Analytics** | Time-series trend prediction for risk forecasting |

---

## Live Demo

| Resource | URL |
|----------|-----|
| **API** | https://encode-spoonos-production.up.railway.app |
| **Docs** | https://encode-spoonos-production.up.railway.app/docs |

### Quick Test

```bash
# Health check
curl https://encode-spoonos-production.up.railway.app/health

# Analyze a Neo N3 wallet
curl -X POST https://encode-spoonos-production.up.railway.app/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ"}'

# Scan a contract for malicious patterns (The DAO - famous hack)
curl "https://encode-spoonos-production.up.railway.app/api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413?chain=ethereum"

# Get x402 payment requirements
curl https://encode-spoonos-production.up.railway.app/x402/requirements
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Entry Points                                │
│    server.py (FastAPI)  │  cli.py  │  AgentManagement.py                │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         SpoonOS Agent Layer                              │
│  ┌─────────────────┐    ┌──────────────────┐    ┌────────────────────┐  │
│  │  ToolCallAgent  │    │   SpoonReactAI   │    │  WalletGuardian    │  │
│  │  (Function Call)│    │   (ReAct Pattern)│    │  (High-Level API)  │  │
│  └────────┬────────┘    └────────┬─────────┘    └─────────┬──────────┘  │
│           └──────────────────────┼────────────────────────┘             │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Graph Orchestrator                                │
│  ┌──────────────────┐   ┌────────────────────┐   ┌──────────────────┐   │
│  │ WalletDataCache  │──▶│ UnifiedDataFetcher │──▶│ ComputationGraph │   │
│  │  (TTL Caching)   │   │  (Parallel Fetch)  │   │   (DAG Execute)  │   │
│  └──────────────────┘   └────────────────────┘   └──────────────────┘   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              MultiAgentOrchestrator (Optional)                    │   │
│  │  COORDINATOR → DATA_ANALYST → RISK_ASSESSOR → PATTERN_DETECTOR   │   │
│  │                                    └──────────▶ REPORTER          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
┌──────────────────────┐ ┌──────────────────┐ ┌──────────────────────────┐
│     Tools (8)        │ │   SusInspector   │ │   Advanced Features      │
│ ├─ get_wallet_summary│ │ ├─ Rapid TX Det. │ │ ├─ RealTimeMonitor       │
│ ├─ wallet_validity   │ │ ├─ Dust Attack   │ │ ├─ PortfolioAnalyzer     │
│ ├─ counterparty_risk │ │ ├─ Large Transfer│ │ ├─ PredictiveRiskAnalyzer│
│ ├─ malicious_contract│ │ ├─ Honeypot Det. │ │ ├─ WalletRelationship    │
│ ├─ approval_scan     │ │ └─ Scam Address  │ │ └─ SmartAlertSystem      │
│ ├─ multi_wallet_diff │ └──────────────────┘ └──────────────────────────┘
│ ├─ schedule_monitor  │
│ └─ action_draft      │
└──────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Blockchain Clients                                │
│  ┌────────────────────────────┐    ┌─────────────────────────────────┐  │
│  │       NeoClient            │    │          EthClient              │  │
│  │ ├─ get_nep17_balances()   │    │ ├─ get_balance()                │  │
│  │ ├─ get_nep17_transfers()  │    │ ├─ get_transactions()           │  │
│  │ ├─ invoke_function()      │    │ ├─ get_contract_source_code()   │  │
│  │ └─ validate_address()     │    │ └─ compute_risk_score()         │  │
│  └────────────────────────────┘    └─────────────────────────────────┘  │
│                │                                   │                     │
│                ▼                                   ▼                     │
│        Neo N3 Testnet RPC               Etherscan / Blockscout API      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Agent → SpoonOS → LLM Flow

The system implements a complete agent invocation pipeline using SpoonOS's unified LLM protocol layer:

```
┌────────────────┐     ┌─────────────────────┐     ┌────────────────┐
│  User Request  │────▶│   SpoonOS Agent     │────▶│   LLM Provider │
│  (API/CLI)     │     │  (ToolCallAgent)    │     │ (OpenAI/etc.)  │
└────────────────┘     └──────────┬──────────┘     └────────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ Tool #1  │ │ Tool #2  │ │ Tool #N  │
              │ (Wallet) │ │ (Risk)   │ │ (Scan)   │
              └──────────┘ └──────────┘ └──────────┘
```

### Computation Graph

The DAG-based computation graph eliminates redundant RPC calls:

```
fetch_data (root node)
    │
    ├── concentration ────────────┐
    ├── stablecoin_ratio ─────────┼────▶ risk_score ────▶ final_report
    ├── counterparties ───────────┤
    └── suspicious_patterns ──────┘
```

---

## LLM Integration

### Multi-Provider Support via SpoonOS

The agent uses SpoonOS's `ChatBot` class for LLM invocation with automatic provider selection:

```python
# src/agent.py - LLM initialization via SpoonOS
from spoon_ai.chat import ChatBot, Memory
from spoon_ai.agents import ToolCallAgent, SpoonReactAI
from spoon_ai.tools import ToolManager, BaseTool

def _get_llm() -> ChatBot:
    """Multi-provider LLM support via SpoonOS unified protocol."""
    if os.getenv("OPENAI_API_KEY"):
        return ChatBot(
            llm_provider="openai",
            api_key=os.getenv("OPENAI_API_KEY"),
            model_name="gpt-4o-mini",
        )
    elif os.getenv("ANTHROPIC_API_KEY"):
        return ChatBot(
            llm_provider="anthropic",
            api_key=os.getenv("ANTHROPIC_API_KEY"),
        )
    elif os.getenv("GEMINI_API_KEY"):
        return ChatBot(
            llm_provider="gemini",
            api_key=os.getenv("GEMINI_API_KEY"),
            model_name="gemini-2.0-flash",
        )
    return ChatBot()  # Fallback to defaults
```

### Agent Construction

```python
# ToolCallAgent - Function calling pattern
def build_agent() -> ToolCallAgent:
    tools = [
        GetWalletSummaryTool(),
        WalletValidityScoreTool(),
        FlagCounterpartyRiskTool(),
        MaliciousContractDetectorTool(),
        ScheduleMonitorTool(),
        MultiWalletDiffTool(),
        ApprovalScanTool(),
        ActionDraftTool(),
    ]
    tool_manager = ToolManager(tools)
    llm = _get_llm()
    
    return ToolCallAgent(
        system_prompt=WALLET_SYSTEM_PROMPT,
        llm=llm,
        avaliable_tools=tool_manager,
    )

# SpoonReactAI - ReAct reasoning pattern
def build_react_agent() -> SpoonReactAI:
    return SpoonReactAI(
        name="WalletGuardian",
        description="Neo N3 Wallet Security Agent",
        system_prompt=WALLET_SYSTEM_PROMPT,
        llm=_get_llm(),
        memory=Memory(),
        avaliable_tools=ToolManager(tools),
        max_steps=10,
    )
```

---

## Custom Tools

All 8 tools are built using SpoonOS's `BaseTool` interface from `spoon_ai.tools`.

### Tool Design Pattern

```python
from spoon_ai.tools import BaseTool
from typing import ClassVar, Dict, Any

class CustomTool(BaseTool):
    # Tool metadata (used by LLM for function calling)
    name: ClassVar[str] = "tool_name"
    description: ClassVar[str] = "Description for LLM to understand when to use this tool"
    parameters: ClassVar[Dict[str, Any]] = {
        "type": "object",
        "properties": {
            "param1": {"type": "string", "description": "Parameter description"},
            "param2": {"type": "integer", "default": 30, "description": "Optional param"},
        },
        "required": ["param1"],
    }
    
    async def execute(self, param1: str, param2: int = 30) -> Dict[str, Any]:
        """Async execution (preferred for I/O operations)."""
        return self.call(param1, param2)
    
    def call(self, param1: str, param2: int = 30) -> Dict[str, Any]:
        """Synchronous execution with error handling."""
        try:
            # Tool logic here
            return {"result": "..."}
        except SomeError as e:
            return {"error": f"specific_error: {e}"}
        except Exception as e:
            return {"error": f"unexpected_error: {e}"}
```

### Implemented Tools

| Tool | Name | Description | Key Parameters |
|------|------|-------------|----------------|
| **GetWalletSummaryTool** | `get_wallet_summary` | Fetch balances and transfers | `address`, `chain` (auto/neo3/ethereum), `lookback_days` |
| **WalletValidityScoreTool** | `wallet_validity_score` | Compute 0-100 risk score | `address`, `lookback_days` |
| **FlagCounterpartyRiskTool** | `flag_counterparty_risk` | Label counterparties with risk tags | `address`, `counterparties[]`, `depth` |
| **MaliciousContractDetectorTool** | `malicious_contract_detector` | AI-powered contract scanner | `contract_address`, `chain`, `use_ai` |
| **ApprovalScanTool** | `approval_scan` | Scan for risky approvals | `address`, `lookback_days` |
| **MultiWalletDiffTool** | `multi_wallet_diff` | Portfolio comparison | `addresses[]`, `lookback_days` |
| **ScheduleMonitorTool** | `schedule_monitor` | Real-time monitoring | `address`, `interval_minutes`, `conditions[]` |
| **ActionDraftTool** | `action_draft` | Generate safe messaging | `summary`, `risk_flags[]`, `channel` |

### Tool Example: Malicious Contract Detector

```python
# src/tools/malicious_contract_detector.py
class MaliciousContractDetectorTool(BaseTool):
    name: ClassVar[str] = "malicious_contract_detector"
    description: ClassVar[str] = (
        "Analyze an Ethereum smart contract for malicious patterns like honeypots, "
        "rug pulls, and vulnerabilities. Returns detailed explanations."
    )
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "contract_address": {
                "type": "string",
                "description": "Ethereum contract address (0x...)"
            },
            "chain": {
                "type": "string",
                "enum": ["ethereum", "sepolia"],
                "default": "sepolia"
            },
            "use_ai": {
                "type": "boolean",
                "default": True,
                "description": "Use AI for deep analysis"
            }
        },
        "required": ["contract_address"],
    }
    
    def call(self, contract_address: str, chain: str = "sepolia", 
             force_refresh: bool = False, use_ai: bool = True) -> Dict[str, Any]:
        
        # 1. Check known malicious contracts database
        if is_known_malicious(contract_address):
            return self._create_known_malicious_result(contract_address, ...)
        
        # 2. Fetch contract source code
        source_info = self._eth_client.get_contract_source_code(contract_address)
        
        # 3. Run pattern matching (20+ regex patterns)
        pattern_issues = check_patterns(source_info["source_code"])
        
        # 4. Run AI analysis via SpoonOS ChatBot
        if use_ai:
            llm = ChatBot(llm_provider="openai", model_name="gpt-4o-mini", ...)
            ai_result = llm.chat(MALICIOUS_ANALYSIS_PROMPT.format(...))
            ai_issues = json.loads(ai_result)["issues"]
        
        # 5. Combine and score
        all_issues = self._combine_issues(pattern_issues, ai_issues)
        risk_score = calculate_risk_score(all_issues)
        
        return {
            "verdict": {
                "is_malicious": risk_score >= 60,
                "risk_score": risk_score,
                "risk_level": get_risk_level(risk_score),
            },
            "detected_issues": all_issues[:3],  # Top 3 issues
            "summary": "..."
        }
```

### Detection Patterns

The malicious contract detector checks for:

| Category | Patterns |
|----------|----------|
| **Honeypot** | `require(from == owner)`, `blacklist[sender]`, hidden transfer blocks |
| **Rug Pull** | `mint(owner, amount)`, `setFeePercent(100)`, liquidity removal |
| **Fee Manipulation** | Dynamic fees, `_taxFee` variables, fees > 10% |
| **Reentrancy** | External calls before state updates, missing guards |
| **Access Control** | Single owner, no renounce, `onlyOwner` critical functions |
| **Proxy Risks** | Upgradeable without timelock, `delegatecall` patterns |
| **Self-Destruct** | `selfdestruct` capability |

---

## Neo N3 Oracle Contract

### Smart Contract Overview

The Wallet Risk Oracle stores AI-computed risk scores on-chain via Neo's native Oracle service:

```python
# contracts/wallet_risk_oracle.py
from boa3.sc.contracts import OracleContract
from boa3.sc.compiletime import public

@public
def request_risk_score(address: str) -> bool:
    """Triggers Oracle to fetch score from Wallet Guardian API."""
    url = get_api_url() + address  # e.g., https://api.example.com/analyze/NXyz...
    filter_path = "$.score"
    OracleContract.request(url, filter_path, 'oracle_callback', user_data, GAS_FOR_RESPONSE)
    notify(['OracleRequest', address, url])
    return True

@public
def oracle_callback(url: str, user_data: bytes, code: int, result: bytes):
    """Called by Neo Oracle nodes with API response."""
    # Verify caller is the Oracle contract
    if calling_script_hash != OracleContract.hash:
        raise Exception("Unauthorized")
    
    address = to_str(user_data)
    score = _parse_int(to_str(result))
    
    # Store on-chain
    put_int(RISK_SCORE_PREFIX + to_bytes(address), score)
    put_int(LAST_UPDATE_PREFIX + to_bytes(address), current_index)
    
    notify(['RiskScoreUpdated', address, score, _get_risk_level(score)])

@public
def get_risk_score(address: str) -> int:
    """Query stored risk score. Returns -1 if not set."""
    update = get_int(LAST_UPDATE_PREFIX + to_bytes(address))
    if update == 0:
        return -1
    return get_int(RISK_SCORE_PREFIX + to_bytes(address))

@public
def is_risky(address: str, threshold: int) -> bool:
    """Check if address is risky. Any dApp can call this."""
    score = get_risk_score(address)
    return score < 0 or score < threshold
```

### Use Cases

1. **DEX Integration**: A Neo DEX calls `is_risky(sender, 60)` before allowing trades
2. **NFT Marketplace**: Check buyer risk before high-value sales
3. **DeFi Protocols**: Assess counterparty risk for lending pools

### Contract Deployment

```bash
cd contracts
python deploy.py --wif YOUR_WIF_KEY --network testnet
# Requires ~10 GAS on Neo N3 Testnet
```

---

## Advanced Features

### 1. Real-Time Monitoring

```python
from src.advanced_features import RealTimeMonitor, WalletEventType

monitor = RealTimeMonitor()

# Add wallet with custom thresholds
monitor.add_wallet("NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", {
    "balance_change_threshold": 100,
    "risk_score_threshold": 30,
})

# Stream events (WebSocket-ready)
async for event in monitor.stream_events():
    if event.event_type == WalletEventType.RISK_CHANGE:
        print(f"Risk changed: {event.old_value} -> {event.new_value}")
```

### 2. Portfolio Analysis

```python
from src.advanced_features import PortfolioAnalyzer, PortfolioWallet

analyzer = PortfolioAnalyzer()
wallets = [
    PortfolioWallet(address="NXV7...", label="Hot Wallet", weight=0.3),
    PortfolioWallet(address="NikhQp...", label="Cold Storage", weight=0.7),
]

result = await analyzer.analyze_portfolio(wallets, lookback_days=30)
# Returns: weighted_risk_score, diversification_score, cross_wallet_activity
```

### 3. Predictive Risk Analysis

```python
from src.advanced_features import PredictiveRiskAnalyzer

analyzer = PredictiveRiskAnalyzer()
trend = await analyzer.analyze_trend(
    address="NXV7...",
    lookback_days=90,
    forecast_days=7
)
# Returns: current_score, predicted_score, trend_direction, confidence
```

### 4. Wallet Relationship Graph

```python
from src.advanced_features import WalletRelationshipAnalyzer

analyzer = WalletRelationshipAnalyzer()
graph = await analyzer.build_graph(
    seed_addresses=["NXV7...", "NikhQp..."],
    depth=2,
    lookback_days=30
)
# Returns: nodes, edges, clusters, central_addresses, suspicious_relationships
```

### 5. Smart Alert System

```python
from src.advanced_features import SmartAlertSystem, AlertPriority

alert_system = SmartAlertSystem()

# Built-in rules: balance_drop, risk_increase, suspicious_tx, large_outflow

# Create custom rule
rule = alert_system.create_custom_rule(
    name="Whale Alert",
    condition_expr="balance_change_percent > 50",
    priority=AlertPriority.HIGH,
    wallets=["NXV7..."]
)

# Evaluate
alerts = await alert_system.evaluate_wallet("NXV7...")
```

### 6. Voice Guardian (ElevenLabs)

```python
from src.voice_guardian import VoiceGuardian, AlertSeverity

voice = VoiceGuardian()

# Speak alert
audio = await voice.speak_alert(
    message="Critical risk detected on wallet NXV7",
    severity=AlertSeverity.CRITICAL,
    address="NXV7..."
)

# Speak wallet summary
audio = await voice.speak_wallet_summary(summary_dict)

# Speak portfolio briefing
audio = await voice.speak_portfolio_briefing(portfolio_analysis)
```

---

## API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with agent info |
| `/agents` | GET | List available agents |
| `/analyze` | POST | Free wallet analysis via SpoonOS agent |
| `/x402/requirements` | GET | x402 payment requirements |
| `/x402/invoke/{agent}` | POST | Paid agent invocation |

### Wallet Analysis

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/analyze/{address}` | POST | Graph-based wallet analysis |
| `/api/v2/portfolio` | POST | Multi-wallet portfolio analysis |
| `/api/v2/predict/{address}` | POST | Risk prediction |
| `/api/v2/graph` | POST | Relationship graph builder |

### Contract Scanning

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/contract-scan/{address}` | GET | Malicious contract scan |
| `/api/v2/contract-scan/known-malicious` | GET | List known malicious contracts |

### Neo Oracle

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/contract/info` | GET | Deployed Oracle contract info |
| `/api/v2/contract/score/{address}` | GET | Query on-chain risk score |
| `/api/v2/contract/request-oracle/{address}` | POST | Request Oracle update |

### Monitoring & Alerts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/monitor` | POST | Add/remove monitored wallet |
| `/api/v2/monitor/check` | GET | Run monitoring cycle |
| `/api/v2/alerts` | GET | Get triggered alerts |
| `/api/v2/alerts/rules` | GET/POST | Manage alert rules |
| `/api/v2/alerts/evaluate/{address}` | POST | Evaluate rules for wallet |
| `/api/v2/alerts/acknowledge/{id}` | POST | Acknowledge alert |

### Voice (ElevenLabs)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/voice/status` | GET | Voice feature status |
| `/api/v2/voice/voices` | GET | List available voices |
| `/api/v2/voice/speak/alert` | POST | Generate alert audio |
| `/api/v2/voice/speak/summary` | POST | Generate summary audio |
| `/api/v2/voice/speak/portfolio` | POST | Generate portfolio audio |

---

## Installation

### Prerequisites

- Python 3.10+
- pip or poetry

### Setup

```bash
# Clone repository
git clone https://github.com/your-repo/wallet-guardian.git
cd wallet-guardian

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/Mac
# or
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt
```

### Dependencies

```
fastapi>=0.115.0
uvicorn[standard]>=0.30.0
spoon-ai-sdk>=0.3.4
python-dotenv>=1.0.0
httpx>=0.27.0
aiohttp>=3.9.0
pytest>=8.3.0
```

---

## Configuration

### Environment Variables

Create `.env` from `env.example`:

```bash
# LLM Provider (choose one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...

# Neo N3
NEO_RPC_URL=https://testnet1.neo.coz.io:443

# Ethereum (optional - uses public Etherscan/Blockscout)
# ETHERSCAN_API_KEY=...

# x402 Payments
X402_RECEIVER_ADDRESS=0x...
X402_DEFAULT_NETWORK=base-sepolia
X402_DEFAULT_ASSET=0x036CbD53842c5426634e7929541eC2318f3dCF7e
X402_DEFAULT_AMOUNT_USDC=0.01

# Voice (ElevenLabs)
ELEVENLABS_API_KEY=...
```

### Configuration File

```json
// config.json (auto-generated after contract deployment)
{
  "contract_hash": "0x...",
  "api_url": "https://encode-spoonos-production.up.railway.app/api/v2/analyze/"
}
```

---

## Usage Examples

### CLI

```bash
# Analyze a wallet
python -m src.cli --analyze NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq --days 30

# Natural language query
python -m src.cli --query "What is the risk level of wallet NXV7...?"

# Agent conversation mode
python -m src.cli "summarize wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq"

# Mock mode (offline/demo)
python -m src.cli --mock --analyze NXV7...

# Output as JSON
python -m src.cli --analyze NXV7... --format json
```

### Python API

```python
from src.agent import WalletGuardian, build_agent

# High-level API
guardian = WalletGuardian()
result = await guardian.analyze("NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", lookback_days=30)
print(f"Risk Score: {result['risk_score']}")
print(f"Risk Level: {result['risk_level']}")

# Natural language query
response = await guardian.query("Is wallet NXV7... safe to interact with?")

# Using SpoonOS agent directly
agent = build_agent()
response = await agent.run("analyze wallet NXV7... and check for suspicious activity")
```

### HTTP API

```python
import httpx

# Analyze wallet
response = httpx.post(
    "https://encode-spoonos-production.up.railway.app/analyze",
    json={"prompt": "analyze wallet NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ"}
)

# Scan contract
response = httpx.get(
    "https://encode-spoonos-production.up.railway.app/api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413",
    params={"chain": "ethereum", "use_ai": True}
)
```

---

## Project Structure

```
wallet-guardian/
├── contracts/
│   ├── wallet_risk_oracle.py      # Neo N3 Oracle smart contract
│   ├── malicious_contract_oracle.py  # Alternative Oracle for contract scanning
│   └── deploy.py                  # Deployment script
│
├── src/
│   ├── __init__.py
│   ├── agent.py                   # SpoonOS agent entry point
│   ├── cli.py                     # Command-line interface
│   ├── config.py                  # Configuration loader
│   ├── common.py                  # Shared utilities and constants
│   ├── graph_orchestrator.py      # DAG-based computation engine
│   ├── neo_client.py              # Neo N3 RPC client
│   ├── eth_client.py              # Ethereum/Blockscout client
│   ├── SusInspector.py            # Suspicious activity inspector
│   ├── advanced_features.py       # Portfolio, monitoring, alerts
│   ├── voice_guardian.py          # ElevenLabs voice integration
│   ├── AgentManagement.py         # Simplified management interface
│   │
│   └── tools/
│       ├── __init__.py
│       ├── get_wallet_summary.py      # Wallet data fetching
│       ├── wallet_validity_score.py   # Risk scoring
│       ├── counterparty_risk.py       # Counterparty analysis
│       ├── malicious_contract_detector.py  # AI contract scanner
│       ├── known_malicious_contracts.py    # Exploit database
│       ├── approval_scan.py           # Token approval checker
│       ├── multi_wallet_diff.py       # Portfolio comparison
│       ├── schedule_monitor.py        # Real-time monitoring
│       └── action_draft.py            # Safe message generator
│
├── server.py                      # FastAPI server
├── spoonos_server.py              # Alternative server entry
├── test_orchestrator.py           # Test script
├── requirements.txt               # Python dependencies
├── Dockerfile                     # Container build
├── config.json                    # Runtime config (auto-generated)
├── env.example                    # Environment template
└── README.md                      # This file
```

---

## Deployment

### Local Development

```bash
# Start server
python server.py
# or
uvicorn server:app --reload --host 0.0.0.0 --port 8000

# API docs at http://localhost:8000/docs
```

### Docker

```bash
# Build
docker build -t wallet-guardian .

# Run
docker run -p 8000:8000 --env-file .env wallet-guardian
```

### Railway (Production)

The live demo is deployed on Railway:

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway up
```

### Neo Contract Deployment

```bash
cd contracts

# Compile (requires neo3-boa)
python -c "from boa3.boa3 import Boa3; Boa3.compile_and_save('wallet_risk_oracle.py')"

# Deploy
python deploy.py --wif YOUR_WIF_KEY --network testnet

# Verify deployment
python deploy.py --verify --contract-hash 0x...
```

---

## Error Handling

All components implement consistent error handling:

```python
# Tool error pattern
def call(self, address: str) -> Dict[str, Any]:
    # Input validation
    if not address:
        return {"error": "Address is required"}
    
    try:
        result = self._analyze(address)
        return result
    except NeoRPCError as e:
        return {"error": f"rpc_error: {e}"}
    except InvalidAddressError as e:
        return {"error": f"invalid_address: {e}"}
    except ValueError as e:
        return {"error": f"validation_error: {e}"}
    except Exception as e:
        return {"error": f"unexpected_error: {e}"}
```

---

## Testing

```bash
# Run orchestrator tests
python test_orchestrator.py

# Test specific wallet
python -m src.cli --analyze NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq

# Test contract scanning
curl "http://localhost:8000/api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413?chain=ethereum"
```

---

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## License

MIT License - see LICENSE file for details.

---

## Acknowledgments

- **SpoonOS** - AI agent framework and LLM integration
- **Neo N3** - Oracle service and blockchain infrastructure
- **ElevenLabs** - Voice synthesis API
- **Encode Club** - Hackathon organization
