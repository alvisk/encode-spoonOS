"""Stub tool for drafting safe, non-advisory actions."""

from typing import ClassVar, List
from spoon_ai.tools import BaseTool


class ActionDraftTool(BaseTool):
    name: ClassVar[str] = "action_draft"
    description: ClassVar[str] = "Draft safe next-steps messaging (non-financial advice)."
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "risk_flags": {"type": "array", "items": {"type": "string"}},
            "channel": {
                "type": "string",
                "enum": ["console", "dm", "email", "tweet"],
                "default": "console",
            },
        },
        "required": ["summary", "risk_flags"],
    }

    async def execute(self, summary: str, risk_flags: List[str], channel: str = "console"):
        """Execute the tool (required by BaseTool interface)."""
        return self.call(summary=summary, risk_flags=risk_flags, channel=channel)

    def call(self, summary: str, risk_flags: List[str], channel: str = "console"):
        # TODO: tailor tone/length per channel; avoid financial advice wording
        return {
            "channel": channel,
            "message": f"Summary: {summary}\nRisks: {', '.join(risk_flags)}",
        }





