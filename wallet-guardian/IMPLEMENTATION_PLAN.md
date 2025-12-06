# Wallet Guardian - Novelty Implementation Plan

> Making Wallet Guardian a genuinely novel hackathon submission

---

## Problem Summary

Based on [HACKATHON_REVIEW.md](./HACKATHON_REVIEW.md), the key issues are:

| Issue | Severity | Impact |
|-------|----------|--------|
| **Not novel** - Similar tools exist (Chainalysis, Arkham) | Critical | Low innovation score |
| **LLM bypassed** - Server uses regex, not SpoonOS agent | Critical | Defeats the "AI agent" claim |
| **5/7 tools are stubs** | High | Core features incomplete |
| **x402 payment is fake** | High | Key selling point doesn't work |

---

## Strategy: Three Differentiators

1. **True AI Agent Orchestration** - Fix the agent bypass, enable real LLM reasoning
2. **Behavioral Pattern Detection** - Novel heuristics not found in existing tools  
3. **Working x402 Integration** - One of the first working payment demos

---

## Reference Documentation

### x402 Protocol
- **Landing Page**: https://x402.org
- **Documentation**: https://x402.gitbook.io/x402
- **Quickstart for Sellers**: https://x402.gitbook.io/x402/getting-started/quickstart-for-sellers
- **GitHub Repository**: https://github.com/coinbase/x402
- **Python SDK**: https://github.com/coinbase/x402/tree/main/python/x402
- **Protocol Spec**: https://github.com/coinbase/x402/blob/main/specs

### Neo N3 Blockchain
- **RPC API Reference**: https://docs.neo.org/docs/n3/reference/rpc/api.html
- **getnep17balances**: https://docs.neo.org/docs/n3/reference/rpc/getnep17balances.html
- **getnep17transfers**: https://docs.neo.org/docs/n3/reference/rpc/getnep17transfers.html
- **getcontractstate**: https://docs.neo.org/docs/n3/reference/rpc/getcontractstate.html
- **NEP-17 Standard**: https://docs.neo.org/docs/n3/develop/write/nep17.html

### SpoonOS / spoon-ai
- **PyPI Package**: https://pypi.org/project/spoon-ai/
- **BaseTool Pattern**: Used in `src/tools/*.py`
- **ToolCallAgent**: Used in `src/agent.py`

---

## Phase 1: Fix the Agent Bypass

**Priority**: Critical  
**Estimated Time**: 2-3 hours

### Problem

`server.py:253-318` does manual regex parsing instead of using SpoonOS `ToolCallAgent`:

```python
# Current: bypasses agent entirely
if "analyze" in prompt_lower or "summary" in prompt_lower:
    summary_tool = GetWalletSummaryTool()
    summary = summary_tool.call(address=address)
```

### Tasks

#### 1.1 Fix typo in `agent.py:40`

```python
# Before
agent = ToolCallAgent(
    avaliable_tools=tool_manager,  # TYPO
)

# After  
agent = ToolCallAgent(
    available_tools=tool_manager,  # FIXED
)
```

#### 1.2 Modify `server.py` to use actual agent

```python
from src.agent import build_agent

# At startup
agent = build_agent()

# In invoke endpoint
async def invoke_agent(...):
    result = await agent.run(request.prompt)
    return InvokeResponse(
        agent=agent_name,
        prompt=request.prompt,
        response=result.content,
        tools_used=result.tools_called,
    )
```

#### 1.3 Add reasoning trace to API response

```python
class InvokeResponse(BaseModel):
    agent: str
    prompt: str
    response: str
    tools_used: list[str] = []
    reasoning_trace: list[str] = []  # NEW: Show LLM decision-making
```

### Dependencies

- LLM API key (OpenAI/Anthropic) must be configured
- SpoonOS `ToolCallAgent` must support async execution

---

## Phase 2: Behavioral Pattern Detection (Novel Feature)

**Priority**: High  
**Estimated Time**: 3-4 hours

### Why This Is Novel

Existing tools (Chainalysis, Arkham) focus on:
- Address labeling (exchange, mixer, etc.)
- Transaction tracing
- Static risk scores

**Wallet Guardian's differentiator**: Behavioral pattern detection that identifies *what the wallet is doing*, not just *who it is*.

### New Tool: `detect_wallet_patterns`

```python
# wallet-guardian/src/tools/pattern_detection.py

class DetectWalletPatternsTool(BaseTool):
    name: ClassVar[str] = "detect_wallet_patterns"
    description: ClassVar[str] = """
    Detect behavioral patterns in wallet activity:
    - Accumulation: Building position (inflows >> outflows)
    - Distribution: Possible dump (many small outflows after large inflow)
    - Dormant Whale: High balance, minimal activity, sudden movement
    - Wash Trading: Circular transfers between related addresses
    """
```

### Pattern Detection Algorithms

| Pattern | Detection Logic | Risk Signal |
|---------|-----------------|-------------|
| **Accumulation** | `received_total > 3 * sent_total` over 30 days | Whale building position |
| **Distribution** | Many small outflows after single large inflow | Potential dump incoming |
| **Dormant Whale** | Balance > threshold, activity < 3 txns in 90 days | Market-moving event possible |
| **Wash Trading** | A->B->C->A circular pattern | Suspicious/manipulation |
| **Bridge Pattern** | Transfers to known bridge contracts | Cross-chain movement |

### Implementation

```python
def _detect_accumulation(transfers: dict) -> Optional[dict]:
    sent_total = sum(float(tx.get("value", 0)) for tx in transfers.get("sent", []))
    received_total = sum(float(tx.get("value", 0)) for tx in transfers.get("received", []))
    
    if received_total > 0 and sent_total / received_total < 0.33:
        return {
            "pattern": "accumulation",
            "confidence": min(0.9, received_total / (sent_total + 1)),
            "description": f"Accumulating: received {received_total}, sent {sent_total}",
            "risk_level": "watch"
        }
    return None

def _detect_distribution(transfers: dict) -> Optional[dict]:
    sent = transfers.get("sent", [])
    received = transfers.get("received", [])
    
    if len(sent) > 5 and len(received) <= 2:
        avg_sent = sum(float(tx.get("value", 0)) for tx in sent) / len(sent)
        max_received = max((float(tx.get("value", 0)) for tx in received), default=0)
        
        if max_received > avg_sent * 10:
            return {
                "pattern": "distribution", 
                "confidence": 0.8,
                "description": "Large inflow -> many small outflows (possible distribution)",
                "risk_level": "high"
            }
    return None

def _detect_dormant_whale(transfers: dict, balances: list) -> Optional[dict]:
    total_balance = sum(float(b.get("amount", 0)) for b in balances)
    all_transfers = transfers.get("sent", []) + transfers.get("received", [])
    
    if len(all_transfers) <= 3 and total_balance > 10000:
        return {
            "pattern": "dormant_whale",
            "confidence": 0.85,
            "description": f"High balance ({total_balance}) with minimal activity",
            "risk_level": "watch"
        }
    return None
```

### Files to Create/Modify

| File | Action |
|------|--------|
| `src/tools/pattern_detection.py` | **Create** - New pattern detection tool |
| `src/tools/__init__.py` | **Modify** - Export new tool |
| `src/agent.py` | **Modify** - Register new tool, update system prompt |

---

## Phase 3: Real x402 Payment Verification

**Priority**: High  
**Estimated Time**: 3-4 hours

### Reference
- [x402 Quickstart for Sellers](https://x402.gitbook.io/x402/getting-started/quickstart-for-sellers)
- [x402 Protocol Flow](https://github.com/coinbase/x402#v1-protocol-sequencing)
- [Facilitator API](https://github.com/coinbase/x402#facilitator-types--interface)

### Current State

```python
# server.py:130-148 - FAKE
def verify_payment(payment_header: Optional[str]) -> bool:
    # TODO: Implement actual x402 verification
    return True  # Always accepts
```

### x402 Protocol Flow

Per the [x402 spec](https://github.com/coinbase/x402#v1-protocol-sequencing):

```
1. Client -> Server: Request without payment
2. Server -> Client: 402 Payment Required + PaymentRequirements
3. Client: Signs payment payload
4. Client -> Server: Request with X-PAYMENT header
5. Server -> Facilitator: POST /verify
6. Facilitator -> Server: {isValid: true/false}
7. Server: Execute request
8. Server -> Facilitator: POST /settle
9. Server -> Client: Response + X-PAYMENT-RESPONSE header
```

### Implementation

#### Install dependencies

```bash
pip install x402 httpx
```

Add to `requirements.txt`:
```
x402>=0.1.0
httpx>=0.25.0
```

#### Implement verification (per [Facilitator API](https://github.com/coinbase/x402#facilitator-types--interface))

```python
# server.py

import httpx

FACILITATOR_URL = os.getenv("X402_FACILITATOR_URL", "https://x402.org/facilitator")

async def verify_payment_with_facilitator(
    payment_header: str,
    payment_requirements: dict
) -> tuple[bool, Optional[str]]:
    """
    Verify payment with x402 facilitator.
    
    POST /verify per https://github.com/coinbase/x402#facilitator-types--interface
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{FACILITATOR_URL}/verify",
            json={
                "x402Version": 1,
                "paymentHeader": payment_header,
                "paymentRequirements": payment_requirements,
            },
            timeout=30.0
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("isValid", False), data.get("invalidReason")
        return False, f"Facilitator error: {response.status_code}"

async def settle_payment_with_facilitator(
    payment_header: str,
    payment_requirements: dict
) -> tuple[bool, Optional[str], Optional[str]]:
    """
    Settle payment after successful execution.
    
    POST /settle per https://github.com/coinbase/x402#facilitator-types--interface
    """
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{FACILITATOR_URL}/settle",
            json={
                "x402Version": 1,
                "paymentHeader": payment_header,
                "paymentRequirements": payment_requirements,
            },
            timeout=60.0
        )
        
        if response.status_code == 200:
            data = response.json()
            return data.get("success"), data.get("txHash"), data.get("error")
        return False, None, f"Settlement error: {response.status_code}"
```

#### Update invoke endpoint (per [PaymentRequirements schema](https://github.com/coinbase/x402#data-types))

```python
@app.post("/x402/invoke/{agent_name}")
async def invoke_agent(
    agent_name: str,
    request: InvokeRequest,
    x_payment: Optional[str] = Header(None, alias="X-PAYMENT"),
):
    config = get_x402_config()
    
    if config["enabled"] and not x_payment:
        # Return proper 402 response per x402 spec
        return JSONResponse(
            status_code=402,
            content={
                "x402Version": 1,
                "accepts": [{
                    "scheme": "exact",
                    "network": config["network"],
                    "maxAmountRequired": config["amount"],
                    "resource": f"/x402/invoke/{agent_name}",
                    "description": "Neo Wallet Guardian analysis",
                    "payTo": config["receiver"],
                    "asset": config["asset"],
                    "maxTimeoutSeconds": 60,
                }],
            }
        )
    
    if config["enabled"]:
        requirements = {
            "scheme": "exact",
            "network": config["network"],
            "maxAmountRequired": config["amount"],
            "payTo": config["receiver"],
            "asset": config["asset"],
        }
        is_valid, error = await verify_payment_with_facilitator(x_payment, requirements)
        if not is_valid:
            return JSONResponse(status_code=402, content={"error": error})
    
    # Execute agent
    result = await agent.run(request.prompt)
    
    # Settle payment
    if config["enabled"]:
        success, tx_hash, _ = await settle_payment_with_facilitator(x_payment, requirements)
    
    return InvokeResponse(...)
```

### Test Configuration (Base Sepolia)

Per [x402 Network Support](https://x402.gitbook.io/x402/core-concepts/network-and-token-support):

```bash
# .env
X402_RECEIVER_ADDRESS=0xYourTestnetAddress
X402_DEFAULT_NETWORK=base-sepolia
X402_DEFAULT_ASSET=0x036CbD53842c5426634e7929541eC2318f3dCF7e  # USDC on Base Sepolia
X402_FACILITATOR_URL=https://x402.org/facilitator
```

---

## Phase 4: Implement Stub Tools

**Priority**: Medium  
**Estimated Time**: 4-5 hours

### 4.1 `flag_counterparty_risk`

```python
# Use local blocklist + heuristics
BLOCKLIST = {
    "NKnownScammer1...": {"tags": ["scam"], "score": 0.95},
}
SAFELIST = {
    "NFlamingoSwap...": {"tags": ["dex", "verified"], "score": 0.1},
}

def call(self, address: str, counterparties: List[str]):
    results = {}
    for cp in counterparties:
        if cp in BLOCKLIST:
            results[cp] = BLOCKLIST[cp]
        elif cp in SAFELIST:
            results[cp] = SAFELIST[cp]
        else:
            results[cp] = {"tags": ["unknown"], "score": 0.5}
    return {"results": results}
```

### 4.2 `multi_wallet_diff`

Uses [getnep17balances](https://docs.neo.org/docs/n3/reference/rpc/getnep17balances.html) and [getnep17transfers](https://docs.neo.org/docs/n3/reference/rpc/getnep17transfers.html):

```python
def call(self, addresses: List[str]):
    client = NeoClient()
    wallet_data = {}
    
    for addr in addresses:
        balances = client.get_nep17_balances(addr)
        transfers = client.get_nep17_transfers(addr, start, end)
        wallet_data[addr] = {
            "assets": set(b.get("assethash") for b in balances),
            "counterparties": _extract_counterparties(transfers)
        }
    
    # Find common counterparties across all wallets
    all_cps = [w["counterparties"] for w in wallet_data.values()]
    common = set.intersection(*all_cps) if all_cps else set()
    
    return {
        "addresses": addresses,
        "overlap": {"common_counterparties": list(common)},
    }
```

### 4.3 `approval_scan`

Uses [getcontractstate](https://docs.neo.org/docs/n3/reference/rpc/getcontractstate.html) to check contract ABIs:

```python
def call(self, address: str):
    # NEP-17 doesn't have standard approvals like ERC-20
    # but we can check contract interactions
    client = NeoClient()
    balances = client.get_nep17_balances(address)
    
    approvals = []
    for balance in balances:
        contract = balance.get("assethash")
        state = client._rpc("getcontractstate", [contract])
        # Check if contract has approval-like functions
        abi = state.get("manifest", {}).get("abi", {})
        if "approve" in str(abi) or "allowance" in str(abi):
            approvals.append({"contract": contract, "has_approvals": True})
    
    return {"approvals": approvals, "flags": []}
```

---

## Phase 5: LLM-Generated Risk Narratives

**Priority**: Medium  
**Estimated Time**: 1-2 hours

### Enhanced System Prompt

```python
WALLET_SYSTEM_PROMPT = """You are the Neo Wallet Guardian, an AI agent for blockchain risk analysis.

When analyzing a wallet, use tools in this order:
1. get_wallet_summary - fetch raw data
2. detect_wallet_patterns - identify behavioral patterns
3. wallet_validity_score - get quantitative score

Then synthesize findings into this format:

---
**Summary**: [One sentence overview]

**Key Findings**:
- [Bullet points of notable observations]

**Risk Assessment**: [Low/Medium/High] 
[Brief justification]

**Patterns Detected**:
- [Any behavioral patterns found]

**Recommendations**:
- [What the user should be aware of]
---

Be concise. Do not provide financial advice."""
```

---

## Timeline Summary

| Phase | Description | Hours | Priority |
|-------|-------------|-------|----------|
| 1 | Fix agent bypass | 2-3 | **Critical** |
| 2 | Behavioral patterns | 3-4 | **High** |
| 3 | x402 verification | 3-4 | **High** |
| 4 | Implement stub tools | 4-5 | Medium |
| 5 | Risk narratives | 1-2 | Medium |

**Total**: 13-18 hours

---

## Recommended Minimum Viable Demo

If time is limited, focus on:

1. **Phase 1** - Fix agent bypass (required to claim "AI agent")
2. **Phase 2** - Pattern detection (main novelty differentiator)
3. **Phase 5** - Risk narratives (impressive demo output)

This gives you a working AI agent with novel pattern detection in ~7 hours.

---

## Files Changed Summary

| File | Action | Phase |
|------|--------|-------|
| `src/agent.py` | Modify (fix typo, update prompt) | 1, 5 |
| `server.py` | Modify (use agent, add x402) | 1, 3 |
| `src/tools/pattern_detection.py` | **Create** | 2 |
| `src/tools/__init__.py` | Modify (export new tool) | 2 |
| `src/tools/counterparty_risk.py` | Modify (implement) | 4 |
| `src/tools/multi_wallet_diff.py` | Modify (implement) | 4 |
| `src/tools/approval_scan.py` | Modify (implement) | 4 |
| `requirements.txt` | Modify (add httpx) | 3 |

---

## Open Questions

Before implementation:

1. **LLM Provider**: Which LLM API is configured with SpoonOS? (OpenAI/Anthropic)
2. **x402 Testing**: Test on Base Sepolia testnet, or demo-only?
3. **Web Frontend**: Update to show patterns and narratives?
4. **Unit Tests**: Required, or demo-only?

---

## Additional Resources

### x402 Examples
- [Express Server Example](https://github.com/coinbase/x402/tree/main/examples/typescript/servers/express)
- [FastAPI Example](https://github.com/coinbase/x402/tree/main/examples/python/servers/fastapi)
- [Advanced Example](https://github.com/coinbase/x402/tree/main/examples/typescript/servers/advanced)

### Neo N3 Tools
- [Neo RPC Postman Collection](https://docs.neo.org/RpcServer.postman_collection.json)
- [Neo Testnet Faucet](https://neowish.ngd.network/)
- [NeoLine Wallet](https://neoline.io/)
