"""Tool to compute a simple wallet validity/risk score on Neo N3."""

from typing import Any, ClassVar, Dict

from spoon_ai.tools import BaseTool

from .get_wallet_summary import (
    GetWalletSummaryTool,
    _compute_concentration,
    _stablecoin_ratio,
    _extract_counterparties,
)


class WalletValidityScoreTool(BaseTool):
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
        """Execute the tool (required by BaseTool interface)."""
        return self.call(address=address, lookback_days=lookback_days)

    def call(self, address: str, lookback_days: int = 30) -> Dict[str, Any]:
        summary_tool = GetWalletSummaryTool()
        summary = summary_tool.call(address=address, chain="neo3", lookback_days=lookback_days)
        if isinstance(summary, dict) and summary.get("error"):
            return {"error": summary["error"]}

        balances = summary.get("balances", [])
        transfers = summary.get("transfers", {}) or {}

        concentration = _compute_concentration(balances)
        stable_ratio = _stablecoin_ratio(balances)
        counterparties = _extract_counterparties(transfers)

        score = 100.0
        deductions = []

        # Concentration penalty
        if concentration > 0.8:
            penalty = 20
            deductions.append({"reason": "high_concentration", "penalty": penalty})
            score -= penalty
        elif concentration > 0.6:
            penalty = 10
            deductions.append({"reason": "moderate_concentration", "penalty": penalty})
            score -= penalty

        # Stablecoin buffer
        if stable_ratio < 0.05:
            penalty = 10
            deductions.append({"reason": "very_low_stablecoin_buffer", "penalty": penalty})
            score -= penalty
        elif stable_ratio < 0.1:
            penalty = 5
            deductions.append({"reason": "low_stablecoin_buffer", "penalty": penalty})
            score -= penalty

        # Activity / counterparty diversity
        if len(counterparties) == 0:
            penalty = 10
            deductions.append({"reason": "inactive_or_new_wallet", "penalty": penalty})
            score -= penalty
        elif len(counterparties) < 3:
            penalty = 5
            deductions.append({"reason": "low_counterparty_diversity", "penalty": penalty})
            score -= penalty

        # Carry over existing risk flags
        for flag in summary.get("risk_flags", []):
            deductions.append({"reason": flag, "penalty": 0})

        score = max(0.0, min(100.0, score))

        return {
            "address": address,
            "lookback_days": lookback_days,
            "score": score,
            "deductions": deductions,
            "metrics": {
                "concentration": concentration,
                "stablecoin_ratio": stable_ratio,
                "counterparty_count": len(counterparties),
            },
            "risk_flags": summary.get("risk_flags", []),
            "balances": balances,
            "transfers": transfers,
        }


