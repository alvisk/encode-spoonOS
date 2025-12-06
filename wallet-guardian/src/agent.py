"""Minimal agent scaffold wiring tool stubs into a ToolCallAgent."""

from spoon_ai.agents import ToolCallAgent
from spoon_ai.tools import ToolManager

from .tools import (
    ActionDraftTool,
    ApprovalScanTool,
    FlagCounterpartyRiskTool,
    GetWalletSummaryTool,
    MultiWalletDiffTool,
    ScheduleMonitorTool,
    WalletValidityScoreTool,
)

# Agent name for x402 gateway registration
AGENT_NAME = "wallet_guardian"

# Placeholder prompt; replace with the tuned wallet system prompt.
WALLET_SYSTEM_PROMPT = """You are the Neo Wallet Guardian, an AI agent specialized in analyzing 
cryptocurrency wallets on the Neo N3 blockchain.

Your capabilities:
- Fetch wallet balances and recent transfer history
- Calculate risk metrics (token concentration, stablecoin ratio, counterparty activity)
- Generate validity scores (0-100) with detailed risk breakdowns
- Flag potentially risky counterparty addresses
- Compare diversification across multiple wallets

Guidelines:
- Always use the available tools to gather data before making assessments
- Present findings in a clear, structured format
- Surface risk flags prominently but avoid giving financial advice
- Keep outputs concise and actionable
- When analyzing a wallet, start with get_wallet_summary, then wallet_validity_score

You do NOT provide financial advice. You only surface objective risk metrics and flags."""


def get_tools() -> list:
    """Return list of all available tools."""
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
    tools = get_tools()
    tool_manager = ToolManager(tools)
    return ToolCallAgent(
        name=AGENT_NAME,
        system_prompt=WALLET_SYSTEM_PROMPT,
        available_tools=tool_manager,
    )


# Global agent registry for x402 gateway
_agent_registry: dict[str, ToolCallAgent] = {}


def get_agent(name: str = AGENT_NAME) -> ToolCallAgent:
    """Get or create an agent instance by name."""
    if name not in _agent_registry:
        _agent_registry[name] = build_agent()
    return _agent_registry[name]


def register_agent() -> dict:
    """Return agent configuration for x402 gateway registration."""
    return {
        "name": AGENT_NAME,
        "description": "Neo N3 Wallet Guardian - AI-powered wallet analysis and risk assessment",
        "tools": [tool.name for tool in get_tools()],
        "system_prompt": WALLET_SYSTEM_PROMPT,
    }


if __name__ == "__main__":
    # Example manual smoke test (non-interactive); replace with CLI/HTTP entrypoint as needed.
    agent = build_agent()
    tools = get_tools()
    print("Agent initialized with tools:", [t.name for t in tools])





