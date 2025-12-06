"""Minimal agent scaffold wiring tool stubs into a ToolCallAgent."""

from spoon_ai.agents import ToolCallAgent
from spoon_ai.chat import ChatBot
from spoon_ai.tools import ToolManager

from .tools import (
    FlagCounterpartyRiskTool,
    GetWalletSummaryTool,
    WalletValidityScoreTool,
    ScheduleMonitorTool,
    MultiWalletDiffTool,
    ApprovalScanTool,
    ActionDraftTool,
)

# Placeholder prompt; replace with the tuned wallet system prompt.
WALLET_SYSTEM_PROMPT = """You are the Neo Wallet Guardian. Use tools to
analyze wallets on Neo N3, surface clear risk flags, avoid financial
advice, and keep outputs concise."""


def build_agent() -> ToolCallAgent:
    """Construct the ToolCallAgent with all available tools."""
    tools = [
        GetWalletSummaryTool(),
        WalletValidityScoreTool(),
        FlagCounterpartyRiskTool(),
        ScheduleMonitorTool(),
        MultiWalletDiffTool(),
        ApprovalScanTool(),
        ActionDraftTool(),
    ]
    tool_manager = ToolManager(tools)
    llm = ChatBot()
    
    agent = ToolCallAgent(
        system_prompt=WALLET_SYSTEM_PROMPT,
        llm=llm,
        avaliable_tools=tool_manager,
    )
    return agent





