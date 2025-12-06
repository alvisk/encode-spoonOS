"""Stub tool for comparing multiple wallets."""

from typing import List
from spoon_ai.tools import BaseTool


class MultiWalletDiffTool(BaseTool):
    name = "multi_wallet_diff"
    description = "Compare wallets for diversification/overlap."
    parameters = {
        "type": "object",
        "properties": {
            "addresses": {
                "type": "array",
                "items": {"type": "string"},
                "minItems": 2,
            }
        },
        "required": ["addresses"],
    }

    def call(self, addresses: List[str]):
        # TODO: call GetWalletSummaryTool per address (or inject summaries)
        # TODO: compute overlap of tokens/counterparties and concentration flags
        return {"addresses": addresses, "overlap": {}, "concentration_flags": []}





