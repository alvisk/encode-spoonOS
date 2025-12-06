"""Stub tool for counterparty risk labeling."""

from typing import List
from spoon_ai.tools import BaseTool


class FlagCounterpartyRiskTool(BaseTool):
    name = "flag_counterparty_risk"
    description = "Label counterparties with risk tags (blocklists, heuristics)."
    parameters = {
        "type": "object",
        "properties": {
            "address": {"type": "string", "description": "User wallet address"},
            "counterparties": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Addresses seen in recent transfers",
            },
        },
        "required": ["address", "counterparties"],
    }

    def call(self, address: str, counterparties: List[str]):
        # TODO: lookup labels/blocklists (local JSON or HTTP)
        # TODO: add heuristics (new token age, low liquidity, known scams)
        return {"results": {cp: {"tags": [], "score": 0.0} for cp in counterparties}}





