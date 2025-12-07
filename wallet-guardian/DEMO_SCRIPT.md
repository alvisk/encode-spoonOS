# Wallet Guardian - Demo Script

Use this script for your hackathon demo video or live presentation.

---

## Demo Overview (3-5 minutes)

1. **Intro** (30 sec): What Wallet Guardian does
2. **Neo Oracle Contract** (1 min): On-chain risk scores
3. **Malicious Contract Detector** (1.5 min): AI-powered security scanner
4. **SpoonOS Agent** (1 min): Multi-chain wallet analysis
5. **Closing** (30 sec): x402 payments, differentiators

---

## Setup

```bash
# Set your API URL (or use local)
export API_URL="https://encode-spoonos-production.up.railway.app"

# Or for local testing:
# export API_URL="http://localhost:8000"
```

---

## Demo 1: Neo Oracle Smart Contract

### Show the Contract Code
```bash
# Display the contract (highlight key functions)
cat contracts/wallet_risk_oracle.py | head -60
```

**Key talking points:**
- "This is a Neo N3 smart contract that uses Neo's native Oracle service"
- "Any dApp can call `is_risky()` to check a wallet before allowing transactions"
- "Risk scores are fetched from our API and stored permanently on-chain"

### Query Contract Info
```bash
curl -s "$API_URL/api/v2/contract/info" | jq .
```

**Expected output:**
```json
{
  "deployed": true,
  "contract_hash": "0x...",
  "network": "neo3-testnet",
  "methods": ["request_risk_score", "get_risk_score", "is_risky", ...]
}
```

### Query On-Chain Risk Score
```bash
curl -s "$API_URL/api/v2/contract/score/NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ" | jq .
```

**Key talking points:**
- "This queries the ACTUAL on-chain stored risk score"
- "Once stored, any smart contract can verify risk without external API calls"
- "Trustless, decentralized risk assessment"

---

## Demo 2: AI-Powered Malicious Contract Detector

### Scan a Known Malicious Contract (The DAO)
```bash
# The DAO - Famous reentrancy attack ($60M stolen in 2016)
curl -s "$API_URL/api/v2/contract-scan/0xbb9bc244d798123fde783fcc1c72d3bb8c189413?chain=ethereum" | jq .
```

**Expected output:**
```json
{
  "contract_address": "0xbb9bc244d798123fde783fcc1c72d3bb8c189413",
  "verdict": {
    "is_malicious": true,
    "risk_score": 100,
    "risk_level": "CRITICAL",
    "confidence": 1.0
  },
  "detected_issues": [{
    "category": "reentrancy",
    "pattern": "known_malicious",
    "severity": "CRITICAL",
    "explanation": "The DAO was exploited via a reentrancy vulnerability...",
    "evidence": "Exploit date: 2016-06-17"
  }],
  "summary": "CRITICAL: This is a KNOWN MALICIOUS contract (The DAO)..."
}
```

**Key talking points:**
- "We maintain a database of known exploited contracts"
- "The DAO hack was THE event that led to Ethereum Classic fork"
- "Instant detection with full context on what happened"

### Scan a Trusted Contract (USDC)
```bash
# USDC - Known safe stablecoin
curl -s "$API_URL/api/v2/contract-scan/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48?chain=ethereum" | jq .
```

**Expected output:**
```json
{
  "verdict": {
    "is_malicious": false,
    "risk_score": 10,
    "risk_level": "SAFE"
  },
  "summary": "This is a known trusted contract: USDC"
}
```

**Key talking points:**
- "We also whitelist major trusted contracts"
- "Reduces false positives for legitimate DeFi"

### List Known Malicious Contracts
```bash
curl -s "$API_URL/api/v2/contract-scan/known-malicious" | jq '.known_malicious[:3]'
```

**Expected output:**
```json
[
  {"name": "The DAO", "category": "reentrancy", "amount_stolen": "$60M"},
  {"name": "Cream Finance Attacker", "category": "reentrancy", "amount_stolen": "$18.8M"},
  ...
]
```

---

## Demo 3: SpoonOS Agent - Wallet Analysis

### Analyze a Neo N3 Wallet
```bash
curl -s -X POST "$API_URL/analyze" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ"}' | jq .
```

**Key talking points:**
- "This uses our SpoonOS ToolCallAgent"
- "The agent decides which tools to call based on your query"
- "Supports natural language - just ask what you want to know"

### Analyze an Ethereum Wallet
```bash
curl -s -X POST "$API_URL/api/v2/analyze/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045" | jq .
```

**Key talking points:**
- "Auto-detects chain from address format"
- "Neo addresses start with 'N', Ethereum with '0x'"
- "Same API, multi-chain support"

---

## Demo 4: Advanced Features (Optional)

### Portfolio Analysis
```bash
curl -s -X POST "$API_URL/api/v2/portfolio" \
  -H "Content-Type: application/json" \
  -d '{
    "wallets": [
      {"address": "NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ", "label": "Treasury"},
      {"address": "NYxb4fSZVKAz8YsgaPK2WkT3KcAE9b3Vag", "label": "Operations"}
    ]
  }' | jq .
```

### Real-Time Monitoring
```bash
# Add wallet to monitoring
curl -s -X POST "$API_URL/api/v2/monitor" \
  -H "Content-Type: application/json" \
  -d '{"address": "NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ", "action": "add"}' | jq .

# Check for events
curl -s "$API_URL/api/v2/monitor/check" | jq .
```

---

## Demo 5: x402 Payment Flow (Optional)

### Show Payment Requirements
```bash
curl -s "$API_URL/x402/requirements" | jq .
```

**Expected output:**
```json
{
  "enabled": true,
  "network": "base-sepolia",
  "amount": "0.01",
  "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  "accepts": [...]
}
```

**Key talking points:**
- "x402 enables pay-per-invoke micropayments"
- "Users pay 0.01 USDC per analysis on Base Sepolia"
- "Seamless integration with SpoonOS payment SDK"

---

## Key Differentiators to Emphasize

1. **Neo Oracle Contract**
   - "First-of-its-kind: wallet risk scores stored ON-CHAIN via Oracle"
   - "Any Neo dApp can call `is_risky()` before transactions"
   - "Trustless, decentralized security infrastructure"

2. **AI-Powered Contract Scanner**
   - "20+ pattern detectors for honeypots, rug pulls, reentrancy"
   - "AI deep analysis via SpoonOS ChatBot"
   - "Human-readable explanations, not just scores"

3. **Full SpoonOS Integration**
   - "8 tools using BaseTool from spoon-ai-sdk"
   - "Multi-provider LLM support (OpenAI, Anthropic, Gemini)"
   - "ToolCallAgent for natural language queries"

4. **Multi-Chain Support**
   - "Neo N3 + Ethereum out of the box"
   - "Auto-detection from address format"
   - "Unified API for both chains"

---

## Common Questions & Answers

**Q: How does the Neo Oracle work?**
A: "When you call `request_risk_score(address)`, the contract triggers Neo's native Oracle service. The Oracle fetches our API response and stores the score on-chain. This is asynchronous - the callback happens when Oracle nodes reach consensus."

**Q: Why store risk scores on-chain?**
A: "Trust and composability. Any smart contract can verify wallet risk without trusting an external API. A DEX can reject trades from flagged wallets. A lending protocol can adjust collateral requirements. It's infrastructure for secure DeFi."

**Q: How accurate is the malicious contract detection?**
A: "For known exploits, 100% accurate - we have a database. For new contracts, we combine regex patterns (fast) with AI analysis (thorough). Pattern matching alone catches ~70% of common scams. AI adds context and catches novel attacks."

**Q: What SpoonOS components do you use?**
A: "ChatBot for LLM, BaseTool for all 8 tools, ToolManager for tool orchestration, ToolCallAgent for agent execution, and the x402 payment SDK for micropayments."

---

## Demo Video Script (3 minutes)

```
[0:00] "Hi, I'm presenting Wallet Guardian - an AI-powered wallet security agent built on SpoonOS."

[0:10] "The key innovation is our Neo Oracle smart contract. Let me show you."

[0:20] *Show contract code* "This contract uses Neo's native Oracle to fetch risk scores and store them on-chain."

[0:40] *Run contract query* "Any dApp can now call is_risky() to check a wallet before allowing transactions."

[1:00] "Second differentiator: AI-powered malicious contract detection."

[1:10] *Scan The DAO* "Here I'm scanning The DAO - the infamous $60M hack from 2016."

[1:30] *Show result* "We detect it instantly with full context on what happened and why it's dangerous."

[1:50] *Scan USDC* "We also whitelist trusted contracts to avoid false positives."

[2:10] "For wallet analysis, we use SpoonOS ToolCallAgent with 8 custom tools."

[2:20] *Run analyze* "Just ask in natural language - the agent decides which tools to use."

[2:40] "We support both Neo N3 and Ethereum with auto-detection."

[2:50] "In summary: Neo Oracle for on-chain risk, AI contract scanning, full SpoonOS integration, and multi-chain support."

[3:00] "Thank you!"
```

---

## Troubleshooting

**API returns 500?**
- Check if backend is running: `curl $API_URL/health`
- Check logs: `docker logs wallet-guardian`

**Neo RPC errors?**
- Testnet may be slow, try mainnet RPC
- Check `NEO_RPC_URL` environment variable

**Contract scan returns "not a contract"?**
- Address might be an EOA, not a contract
- Try a known contract address

---

Good luck with your demo!
