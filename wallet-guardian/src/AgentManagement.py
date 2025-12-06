"""
Agent Management for Wallet Guardian using SpoonOS-AI.

This module provides a simplified interface to the graph-based multi-agent
orchestrator. It's designed for external integrations and web APIs.

Architecture:
- Uses MultiAgentOrchestrator for core functionality (no duplication)
- Provides mode-based configuration for different use cases
- Integrates SpoonOS toolkits for extended capabilities
"""

from typing import Dict, List, Optional, Any
import asyncio

from .graph_orchestrator import (
    MultiAgentOrchestrator,
    analyze_wallet,
    query_guardian,
    WalletDataCache,
)
from .SusInspector import SusInspector


class WalletGuardianManager:
    """
    Simplified management interface for the Wallet Guardian system.
    
    This class wraps the graph orchestrator and provides:
    - Easy initialization with different modes
    - Synchronous and asynchronous APIs
    - Integration with SpoonOS toolkits
    """
    
    MODES = {
        "full": "Complete analysis with all features",
        "quick": "Fast analysis with essential checks only",
        "defi": "DeFi-focused analysis with LP and lending metrics",
        "security": "Security-focused with emphasis on suspicious patterns",
    }
    
    def __init__(self, mode: str = "full"):
        """
        Initialize the manager.
        
        Args:
            mode: Operating mode - "full", "quick", "defi", or "security"
        """
        if mode not in self.MODES:
            raise ValueError(f"Invalid mode '{mode}'. Choose from: {list(self.MODES.keys())}")
        
        self.mode = mode
        self._orchestrator: Optional[MultiAgentOrchestrator] = None
        self._inspector = SusInspector()
        self._initialized = False
    
    async def initialize(self):
        """Initialize the orchestrator (call before first use)."""
        if self._initialized:
            return
        
        self._orchestrator = MultiAgentOrchestrator()
        await self._orchestrator.initialize()
        self._initialized = True
    
    async def analyze_wallet(
        self, 
        address: str, 
        lookback_days: int = 30,
        include_suspicious: bool = True
    ) -> Dict[str, Any]:
        """
        Analyze a wallet comprehensively.
        
        Args:
            address: Neo N3 wallet address
            lookback_days: Days to analyze
            include_suspicious: Include suspicious pattern detection
            
        Returns:
            Analysis results
        """
        await self.initialize()
        
        # Use the graph-based analysis
        result = await self._orchestrator.analyze_wallet(address, lookback_days)
        
        # Add suspicious activity analysis if requested
        if include_suspicious and self.mode in ("full", "security"):
            sus_result = self._inspector.inspect_wallet(address, lookback_days)
            result["suspicious_inspection"] = sus_result
        
        return result
    
    async def quick_check(self, address: str) -> Dict[str, Any]:
        """
        Perform a quick risk check (7-day lookback).
        
        Args:
            address: Wallet address
            
        Returns:
            Quick risk assessment
        """
        await self.initialize()
        return await self._orchestrator.analyze_wallet(address, lookback_days=7)
    
    async def query(self, question: str) -> str:
        """
        Ask a natural language question.
        
        Args:
            question: Your question
            
        Returns:
            Agent response
        """
        await self.initialize()
        return await self._orchestrator.query(question)
    
    def analyze_wallet_sync(self, address: str, lookback_days: int = 30) -> Dict[str, Any]:
        """Synchronous wrapper for analyze_wallet."""
        return asyncio.run(self.analyze_wallet(address, lookback_days))
    
    def quick_check_sync(self, address: str) -> Dict[str, Any]:
        """Synchronous wrapper for quick_check."""
        return asyncio.run(self.quick_check(address))
    
    def inspect_suspicious(self, address: str, lookback_days: int = 30) -> Dict[str, Any]:
        """
        Direct suspicious activity inspection (synchronous).
        
        Args:
            address: Wallet address
            lookback_days: Days to analyze
            
        Returns:
            Suspicious activity report
        """
        return self._inspector.inspect_wallet(address, lookback_days)
    
    def clear_cache(self, address: Optional[str] = None):
        """
        Clear the data cache.
        
        Args:
            address: Specific address to clear, or None for all
        """
        WalletDataCache().invalidate(address)
    
    async def shutdown(self):
        """Shutdown the manager and release resources."""
        if self._orchestrator:
            await self._orchestrator.shutdown()
        self._initialized = False
    
    @property
    def is_initialized(self) -> bool:
        """Check if manager is initialized."""
        return self._initialized


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def create_manager(mode: str = "full") -> WalletGuardianManager:
    """
    Create a new WalletGuardianManager.
    
    Args:
        mode: "full", "quick", "defi", or "security"
        
    Returns:
        Configured manager instance
    """
    return WalletGuardianManager(mode=mode)


async def quick_analyze(address: str) -> Dict[str, Any]:
    """
    Quick one-shot wallet analysis.
    
    Args:
        address: Wallet address
        
    Returns:
        Analysis results
    """
    return await analyze_wallet(address, lookback_days=30)


def quick_analyze_sync(address: str) -> Dict[str, Any]:
    """Synchronous quick analysis."""
    return asyncio.run(quick_analyze(address))


# =============================================================================
# CLI
# =============================================================================

if __name__ == "__main__":
    import sys
    import json
    
    async def main():
        if len(sys.argv) < 2:
            print("Usage: python -m wallet_guardian.src.AgentManagement <address> [mode]")
            print("Modes: full, quick, defi, security")
            return
        
        address = sys.argv[1]
        mode = sys.argv[2] if len(sys.argv) > 2 else "full"
        
        print(f"Analyzing wallet: {address}")
        print(f"Mode: {mode}")
        print("-" * 50)
        
        manager = create_manager(mode)
        result = await manager.analyze_wallet(address)
        
        print(json.dumps(result, indent=2, default=str))
        
        await manager.shutdown()
    
    asyncio.run(main())
