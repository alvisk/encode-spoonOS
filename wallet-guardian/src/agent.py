"""Minimal agent scaffold wiring tool stubs into a ToolCallAgent."""

import os
from typing import List

from spoon_ai.agents import ToolCallAgent
from spoon_ai.chat import ChatBot
from spoon_ai.tools import ToolManager, BaseTool

from .tools import (
    FlagCounterpartyRiskTool,
    GetWalletSummaryTool,
    WalletValidityScoreTool,
    ScheduleMonitorTool,
    MultiWalletDiffTool,
    ApprovalScanTool,
    ActionDraftTool,
)

# Agent name constant
AGENT_NAME = "wallet-guardian"

# Placeholder prompt; replace with the tuned wallet system prompt.
WALLET_SYSTEM_PROMPT = """You are the Neo Wallet Guardian, an AI agent for blockchain risk analysis on Neo N3.

When analyzing a wallet, use tools in this order:
1. get_wallet_summary - fetch raw data (balances, transfers)
2. wallet_validity_score - get quantitative risk score

Then synthesize findings into this format:

---
**Summary**: [One sentence overview]

**Key Findings**:
- [Bullet points of notable observations]

**Risk Assessment**: [Low/Medium/High]
[Brief justification]

**Recommendations**:
- [What the user should be aware of]
---

Be concise. Do not provide financial advice. Always use the available tools to gather data before responding."""


def get_tools() -> List[BaseTool]:
    """Get all available tools."""
    return [
        GetWalletSummaryTool(),
        WalletValidityScoreTool(),
        FlagCounterpartyRiskTool(),
        ScheduleMonitorTool(),
        MultiWalletDiffTool(),
        ApprovalScanTool(),
        ActionDraftTool(),
    ]


def build_agent() -> ToolCallAgent:
    """Construct the ToolCallAgent with all available tools."""
    import os
    
    tools = get_tools()
    tool_manager = ToolManager(tools)
    
    # Support multiple LLM providers
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    
    if gemini_key:
        llm = ChatBot(
            llm_provider="gemini",
            api_key=gemini_key,
            model_name="gemini-2.0-flash",
        )
    elif anthropic_key:
        llm = ChatBot(
            llm_provider="anthropic",
            api_key=anthropic_key,
        )
    elif openai_key:
        llm = ChatBot(
            llm_provider="openai",
            api_key=openai_key,
        )
    else:
        # Fallback - let ChatBot use defaults
        llm = ChatBot()
    
    agent = ToolCallAgent(
        system_prompt=WALLET_SYSTEM_PROMPT,
        llm=llm,
        avaliable_tools=tool_manager,  # Note: SDK has this typo
    )
    return agent


def register_agent() -> dict:
    """Return agent registration info for discovery endpoints."""
    tools = get_tools()
    return {
        "name": AGENT_NAME,
        "description": "AI-powered wallet analysis agent for Neo N3 blockchain",
        "tools": [t.name for t in tools],
        "version": "1.0.0",
    }





