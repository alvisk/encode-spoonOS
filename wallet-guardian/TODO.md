# Wallet Guardian - Improvement Roadmap

Prioritized tasks to improve hackathon submission quality.

---

## Priority 1: Critical Fixes (1-2 hours)

These will significantly impact judge perception.

### 1.1 Remove/Hide Stub Tools from API
**File**: `server.py`, `src/agent.py`

Currently `/agents` exposes 7 tools but 5 are stubs. Options:
- [ ] Remove stub tools from `build_agent()` tool list
- [ ] Or add `is_stub: bool` field and filter from API response
- [ ] Update `/agents` endpoint to only show working tools

### 1.2 Actually Use SpoonOS ToolCallAgent
**File**: `server.py:253-318`

Current code does manual regex parsing instead of using the agent:
```python
# BAD: Manual parsing
if "analyze" in prompt_lower:
    # direct tool calls
```

Fix:
- [ ] Import and use `build_agent()` from `src/agent.py`
- [ ] Call `agent.run(prompt)` instead of manual parsing
- [ ] Handle async properly with `asyncio.run()`

### 1.3 Add Basic Unit Tests
**File**: Create `tests/test_tools.py`

- [ ] Test `_compute_concentration()` with fixed fixtures
- [ ] Test `_stablecoin_ratio()` with edge cases
- [ ] Test `_extract_counterparties()` 
- [ ] Test `GetWalletSummaryTool` with mock mode
- [ ] Test `WalletValidityScoreTool` scoring logic

### 1.4 Replace Mock Data in Web Frontend
**Files**: `wallet-guardian-web/src/app/page.tsx`, `wallet-guardian-web/src/lib/mockData.ts`

- [ ] Call actual backend `/analyze` endpoint instead of mock data
- [ ] Or clearly label dashboard as "Demo Data" in UI
- [ ] Connect alerts to actual analysis results

---

## Priority 2: Complete One More Tool (1-2 hours)

Implement `flag_counterparty_risk` with a basic blocklist.

### 2.1 Create Blocklist Data
**File**: Create `src/data/blocklist.json`

```json
{
  "known_scams": ["NScamAddress1", "NScamAddress2"],
  "known_exchanges": ["NBinance...", "NCoinbase..."],
  "flagged_contracts": ["NRiskyContract..."]
}
```

### 2.2 Implement Counterparty Risk Tool
**File**: `src/tools/counterparty_risk.py`

- [ ] Load blocklist JSON on init
- [ ] Check each counterparty against lists
- [ ] Return risk tags: `known_scam`, `known_exchange`, `unlabeled`, `first_interaction`
- [ ] Add basic heuristics (new address detection)

---

## Priority 3: Fix Code Quality Issues (30 min)

### 3.1 Fix Import Errors in server.py
**File**: `server.py:31`

```python
# Current (broken):
from src.agent import register_agent, AGENT_NAME, get_tools

# These functions don't exist - need to add them to agent.py
```

- [ ] Add `AGENT_NAME = "wallet_guardian"` to agent.py
- [ ] Add `get_tools()` function to agent.py
- [ ] Add `register_agent()` function or remove from import

### 3.2 Fix Typo in agent.py
**File**: `src/agent.py:40`

```python
# Current (typo):
avaliable_tools=tool_manager

# Fix:
available_tools=tool_manager
```

### 3.3 Add Type Annotations
**File**: `src/tools/wallet_validity_score.py`

- [ ] Add proper type guards for `balances` and `transfers`
- [ ] Handle case where summary returns error dict

---

## Priority 4: Presentation Polish (30 min)

### 4.1 Create Demo Video Script

1. Show health check: `curl /health`
2. Analyze real wallet with live RPC
3. Show web UI wallet scanner
4. Explain risk metrics computed

### 4.2 Update Architecture Diagram

Current diagram claims "SpoonOS" but we bypass it. Either:
- [ ] Fix code to use SpoonOS properly (Priority 1.2)
- [ ] Or update diagram to show actual architecture

### 4.3 Remove Unimplemented Prize Claims

Remove references to:
- [ ] AIOZ caching (not implemented)
- [ ] 4Everland hosting (not implemented) 
- [ ] XerpaAI content generation (not implemented)
- [ ] Gata safety alignment (not implemented)

---

## Priority 5: Nice to Have (if time permits)

### 5.1 Implement x402 Payment Verification
**File**: `server.py:130-148`

- [ ] Actually verify payment signatures
- [ ] Check with x402 facilitator
- [ ] Return proper 402 response with requirements

### 5.2 Add More Risk Metrics

- [ ] Transaction frequency anomaly detection
- [ ] Time-based patterns (weekend activity, etc.)
- [ ] Token age heuristics

### 5.3 Connect Web Frontend to Real Backend

- [ ] Deploy backend to Railway/Render
- [ ] Update frontend API calls to use deployed backend
- [ ] Handle CORS properly

---

## Task Checklist Summary

| Priority | Task | Time Est. | Impact |
|----------|------|-----------|--------|
| P1.1 | Hide stub tools from API | 15 min | High |
| P1.2 | Use SpoonOS agent properly | 45 min | High |
| P1.3 | Add unit tests | 30 min | High |
| P1.4 | Fix mock data in web | 30 min | Medium |
| P2.1 | Create blocklist data | 15 min | Medium |
| P2.2 | Implement counterparty tool | 45 min | Medium |
| P3.1 | Fix import errors | 10 min | High |
| P3.2 | Fix typo | 2 min | Low |
| P3.3 | Add type annotations | 15 min | Low |
| P4.1 | Create demo script | 20 min | High |
| P4.2 | Update architecture diagram | 10 min | Medium |
| P4.3 | Remove unimplemented claims | 10 min | High |

**Estimated total time for P1-P3**: ~3.5 hours
**Minimum viable improvements (P1 only)**: ~2 hours

---

## Quick Win Commands

```bash
# Run the server
cd wallet-guardian && python server.py

# Test working endpoint
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq", "use_mock": true}'

# Run tests (after creating them)
pytest tests/ -v
```
