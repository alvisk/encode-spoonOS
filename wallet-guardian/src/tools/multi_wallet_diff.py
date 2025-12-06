"""Stub tool for comparing multiple wallets."""

from typing import ClassVar, List
from spoon_ai.tools import BaseTool


class MultiWalletDiffTool(BaseTool):
    name: ClassVar[str] = "multi_wallet_diff"
    description: ClassVar[str] = "Compare wallets for diversification/overlap."
    parameters: ClassVar[dict] = {
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

    async def execute(self, addresses: List[str]):
        return self.call(addresses)

    def call(self, addresses: List[str]):
        # TODO: call GetWalletSummaryTool per address (or inject summaries)
        # TODO: compute overlap of tokens/counterparties and concentration flags
        return {"addresses": addresses, "overlap": {}, "concentration_flags": []}





