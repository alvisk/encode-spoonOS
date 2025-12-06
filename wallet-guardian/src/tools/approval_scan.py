"""Stub tool for approvals/allowances scanning."""

from spoon_ai.tools import BaseTool


class ApprovalScanTool(BaseTool):
    name = "approval_scan"
    description = "Scan approvals/allowances and flag unlimited or risky approvals."
    parameters = {
        "type": "object",
        "properties": {"address": {"type": "string"}},
        "required": ["address"],
    }

    def call(self, address: str):
        # TODO: fetch approvals/allowances; flag unlimited or unlabeled contracts
        return {"approvals": [], "flags": []}





