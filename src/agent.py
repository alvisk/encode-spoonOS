"""Minimal agent scaffold wiring tool stubs into a ToolCallAgent."""

from spoon_ai.agent import ToolCallAgent

from .tools import (
    ActionDraftTool,
    ApprovalScanTool,
    FlagCounterpartyRiskTool,
    GetWalletSummaryTool,
    MultiWalletDiffTool,
    ScheduleMonitorTool,
    WalletValidityScoreTool,
)

# Placeholder prompt; replace with the tuned wallet system prompt.
WALLET_SYSTEM_PROMPT = """You are the Neo Wallet Guardian. Use tools to
analyze wallets on Neo N3, surface clear risk flags, avoid financial
advice, and keep outputs concise."""


def build_agent() -> ToolCallAgent:
    """Construct the ToolCallAgent with all available tools."""
    return ToolCallAgent(
        system_prompt=WALLET_SYSTEM_PROMPT,
        tools=[
            GetWalletSummaryTool(),
            WalletValidityScoreTool(),
            FlagCounterpartyRiskTool(),
            ScheduleMonitorTool(),
            MultiWalletDiffTool(),
            ApprovalScanTool(),
            ActionDraftTool(),
        ],
    )


if __name__ == "__main__":
    # Example manual smoke test (non-interactive); replace with CLI/HTTP entrypoint as needed.
    agent = build_agent()
    print("Agent initialized with tools:", [t.name for t in agent.tools])





