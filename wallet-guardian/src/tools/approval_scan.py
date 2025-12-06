"""Stub tool for approvals/allowances scanning."""

from typing import ClassVar
from spoon_ai.tools import BaseTool


class ApprovalScanTool(BaseTool):
    name: ClassVar[str] = "approval_scan"
    description: ClassVar[str] = "Scan approvals/allowances and flag unlimited or risky approvals."
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {"address": {"type": "string"}},
        "required": ["address"],
    }

    def call(self, address: str):
        # TODO: fetch approvals/allowances; flag unlimited or unlabeled contracts
        return {"approvals": [], "flags": []}





