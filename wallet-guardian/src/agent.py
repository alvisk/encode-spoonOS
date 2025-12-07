"""
Wallet Guardian Agent - Unified Entry Point

This module provides backwards-compatible agent creation while using
the new graph-based multi-agent orchestrator under the hood.

For new code, prefer using:
    from wallet_guardian.src import analyze_wallet, query_guardian
    
Or the full orchestrator:
    from wallet_guardian.src import MultiAgentOrchestrator
"""

import os
import asyncio
from typing import List, Optional

from spoon_ai.agents import ToolCallAgent, SpoonReactAI
from spoon_ai.chat import ChatBot, Memory
from spoon_ai.tools import ToolManager, BaseTool

from .tools import (
    FlagCounterpartyRiskTool,
    GetWalletSummaryTool,
    WalletValidityScoreTool,
    ScheduleMonitorTool,
    MultiWalletDiffTool,
    ApprovalScanTool,
    ActionDraftTool,
    MaliciousContractDetectorTool,
)
from .graph_orchestrator import MultiAgentOrchestrator, analyze_wallet as graph_analyze


# Agent name constant
AGENT_NAME = "wallet-guardian"

# System prompt for the unified agent - comprehensive and structured
WALLET_SYSTEM_PROMPT = """You are the Neo Wallet Guardian, an AI agent for blockchain risk analysis on Neo N3.

Your capabilities include:
1. **Wallet Analysis**: Fetch and analyze wallet balances, transactions, and activity
2. **Risk Assessment**: Compute validity scores and identify risk factors
3. **Suspicious Activity**: Detect patterns like rapid transactions, dust attacks, scams
4. **Multi-Wallet**: Compare multiple wallets for diversification analysis
5. **Monitoring**: Set up alerts and scheduled checks

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

Guidelines:
- Use tools to gather data before making conclusions
- Flag suspicious activity clearly with severity levels
- Never provide financial advice
- Keep responses concise but informative

Available tools will help you analyze Neo N3 wallets comprehensively."""


def _create_tools_list() -> List[BaseTool]:
    """Create the standard tools list. Used by all agent builders."""
    return [
        GetWalletSummaryTool(),
        WalletValidityScoreTool(),
        FlagCounterpartyRiskTool(),
        ScheduleMonitorTool(),
        MultiWalletDiffTool(),
        ApprovalScanTool(),
        ActionDraftTool(),
        MaliciousContractDetectorTool(),
    ]


def _get_llm() -> ChatBot:
    """
    Get LLM with multi-provider support.
    
    Prioritizes providers in order: OpenAI > Anthropic > Gemini > Default
    """
    openai_key = os.getenv("OPENAI_API_KEY")
    anthropic_key = os.getenv("ANTHROPIC_API_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    
    if openai_key:
        return ChatBot(
            llm_provider="openai",
            api_key=openai_key,
            model_name="gpt-4o-mini",  # Cost-effective and reliable
        )
    elif anthropic_key:
        return ChatBot(
            llm_provider="anthropic",
            api_key=anthropic_key,
        )
    elif gemini_key:
        return ChatBot(
            llm_provider="gemini",
            api_key=gemini_key,
            model_name="gemini-2.0-flash",
        )
    else:
        # Fallback - let ChatBot use defaults
        return ChatBot()


def build_agent() -> ToolCallAgent:
    """
    Construct the ToolCallAgent with all available tools.
    
    This is the legacy interface. For better performance with caching
    and parallel execution, use MultiAgentOrchestrator instead.
    """
    tools = _create_tools_list()
    tool_manager = ToolManager(tools)
    llm = _get_llm()
    
    agent = ToolCallAgent(
        system_prompt=WALLET_SYSTEM_PROMPT,
        llm=llm,
        avaliable_tools=tool_manager,  # Note: SDK has this typo
    )
    return agent


def build_react_agent() -> SpoonReactAI:
    """
    Construct a SpoonReactAI agent with reasoning capabilities.
    
    This agent uses the ReAct pattern (Reasoning + Acting) for
    more complex multi-step analysis tasks.
    """
    tools = _create_tools_list()
    llm = _get_llm()
    
    agent = SpoonReactAI(
        name="WalletGuardian",
        description="Neo N3 Wallet Security Agent",
        system_prompt=WALLET_SYSTEM_PROMPT,
        llm=llm,
        memory=Memory(),
        avaliable_tools=ToolManager(tools),
        max_steps=10,
    )
    return agent


class WalletGuardian:
    """
    High-level Wallet Guardian interface.
    
    Uses the graph-based orchestrator for efficient, non-redundant analysis.
    """
    
    def __init__(self):
        self._orchestrator: Optional[MultiAgentOrchestrator] = None
    
    async def _get_orchestrator(self) -> MultiAgentOrchestrator:
        """Get or create the orchestrator."""
        if self._orchestrator is None:
            self._orchestrator = MultiAgentOrchestrator()
            await self._orchestrator.initialize()
        return self._orchestrator
    
    async def analyze(self, address: str, lookback_days: int = 30) -> dict:
        """
        Analyze a wallet using the computation graph.
        
        This method:
        - Caches blockchain data to avoid redundant RPC calls
        - Runs independent computations in parallel
        - Provides comprehensive risk analysis
        
        Args:
            address: Neo N3 wallet address
            lookback_days: Number of days to analyze
            
        Returns:
            Complete analysis including risk score, metrics, and patterns
        """
        orchestrator = await self._get_orchestrator()
        return await orchestrator.analyze_wallet(address, lookback_days)
    
    async def query(self, question: str) -> str:
        """
        Ask a natural language question about wallet analysis.
        
        Args:
            question: Your question about a wallet
            
        Returns:
            Agent response
        """
        orchestrator = await self._get_orchestrator()
        return await orchestrator.query(question)
    
    def analyze_sync(self, address: str, lookback_days: int = 30) -> dict:
        """Synchronous wrapper for analyze()."""
        return asyncio.run(self.analyze(address, lookback_days))
    
    async def shutdown(self):
        """Shutdown the orchestrator."""
        if self._orchestrator:
            await self._orchestrator.shutdown()
            self._orchestrator = None


# Convenience instance
_guardian: Optional[WalletGuardian] = None


def get_guardian() -> WalletGuardian:
    """Get the global WalletGuardian instance."""
    global _guardian
    if _guardian is None:
        _guardian = WalletGuardian()
    return _guardian


def get_tools() -> List[BaseTool]:
    """Get list of available tools for the agent."""
    return _create_tools_list()


def register_agent() -> dict:
    """Return agent registration info for discovery endpoints."""
    tools = get_tools()
    return {
        "name": AGENT_NAME,
        "description": "AI-powered wallet analysis agent for Neo N3 blockchain",
        "tools": [t.name for t in tools],
        "version": "2.0.0",
        "capabilities": [
            "wallet_analysis",
            "risk_assessment",
            "suspicious_activity_detection",
            "multi_wallet_comparison",
            "real_time_monitoring",
            "voice_alerts",
        ],
    }
