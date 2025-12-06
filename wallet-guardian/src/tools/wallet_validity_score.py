"""Tool to compute a simple wallet validity/risk score on Neo N3.

Uses the canonical compute_risk_score from graph_orchestrator to ensure
consistent scoring across the entire system.
"""

from typing import Any, ClassVar, Dict

from spoon_ai.tools import BaseTool

from .get_wallet_summary import GetWalletSummaryTool
from ..graph_orchestrator import (
    compute_concentration,
    compute_stablecoin_ratio,
    extract_counterparties,
    detect_suspicious_patterns,
    compute_risk_score,
)


class WalletValidityScoreTool(BaseTool):
    """Compute a validity/risk score using canonical functions."""
    
    name: ClassVar[str] = "wallet_validity_score"
    description: ClassVar[str] = (
        "Compute a 0-100 validity/risk score for a Neo N3 wallet using balances/transfers."
    )
    parameters: ClassVar[Dict[str, Any]] = {
        "type": "object",
        "properties": {
            "address": {"type": "string", "description": "Neo N3 address"},
            "lookback_days": {"type": "integer", "minimum": 1, "maximum": 90, "default": 30},
        },
        "required": ["address"],
    }

    async def execute(self, address: str, lookback_days: int = 30) -> Dict[str, Any]:
        return self.call(address, lookback_days)

    def call(self, address: str, lookback_days: int = 30) -> Dict[str, Any]:
        summary_tool = GetWalletSummaryTool()
        summary = summary_tool.call(address=address, chain="neo3", lookback_days=lookback_days)
        if isinstance(summary, dict) and summary.get("error"):
            return {"error": summary["error"]}

        balances = summary.get("balances", [])
        transfers = summary.get("transfers", {}) or {}

        # Use canonical functions from graph_orchestrator
        concentration = compute_concentration(balances)
        stable_ratio = compute_stablecoin_ratio(balances)
        counterparties = extract_counterparties(transfers)
        suspicious_patterns = detect_suspicious_patterns(transfers)

        # Use the canonical risk scoring function
        score, deductions = compute_risk_score(
            concentration,
            stable_ratio,
            len(counterparties),
            suspicious_patterns
        )

        # Determine risk level
        risk_level = (
            "clean" if score >= 90 else
            "low" if score >= 70 else
            "moderate" if score >= 50 else
            "high" if score >= 30 else
            "critical"
        )

        return {
            "address": address,
            "lookback_days": lookback_days,
            "score": score,
            "risk_level": risk_level,
            "deductions": deductions,
            "metrics": {
                "concentration": concentration,
                "stablecoin_ratio": stable_ratio,
                "counterparty_count": len(counterparties),
            },
            "suspicious_patterns": suspicious_patterns,
            "risk_flags": summary.get("risk_flags", []),
            "balances": balances,
            "transfers": transfers,
        }


