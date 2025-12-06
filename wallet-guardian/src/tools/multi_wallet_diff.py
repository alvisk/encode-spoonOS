"""Tool for comparing multiple wallets using PortfolioAnalyzer.

Uses the advanced_features PortfolioAnalyzer for efficient parallel analysis
with shared caching across wallets.
"""

import asyncio
from typing import ClassVar, List
from spoon_ai.tools import BaseTool

from ..advanced_features import PortfolioAnalyzer, PortfolioWallet


class MultiWalletDiffTool(BaseTool):
    """Compare wallets for diversification and overlap using portfolio analysis."""
    
    name: ClassVar[str] = "multi_wallet_diff"
    description: ClassVar[str] = "Compare wallets for diversification/overlap using parallel portfolio analysis."
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "addresses": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
                "description": "List of Neo N3 wallet addresses to compare"
            },
            "lookback_days": {
                "type": "integer",
                "minimum": 1,
                "maximum": 90,
                "default": 30
            }
        },
        "required": ["addresses"],
    }

    async def execute(self, addresses: List[str], lookback_days: int = 30):
        analyzer = PortfolioAnalyzer()
        wallets = [PortfolioWallet(address=addr, label=f"Wallet {i+1}") 
                   for i, addr in enumerate(addresses)]
        
        result = await analyzer.analyze_portfolio(wallets, lookback_days)
        
        return {
            "addresses": addresses,
            "wallet_count": result.wallet_count,
            "weighted_risk_score": result.weighted_risk_score,
            "risk_level": result.risk_level,
            "diversification_score": result.diversification_score,
            "cross_wallet_activity": result.cross_wallet_activity,
            "highest_risk_wallet": result.highest_risk_wallet,
            "lowest_risk_wallet": result.lowest_risk_wallet,
            "individual_analyses": result.individual_analyses,
            "computation_time_ms": result.computation_time_ms,
        }

    def call(self, addresses: List[str], lookback_days: int = 30):
        return asyncio.run(self.execute(addresses, lookback_days))





