"""Stub tool for scheduled wallet monitoring and alerts."""

from typing import ClassVar, List, Optional
from spoon_ai.tools import BaseTool


class ScheduleMonitorTool(BaseTool):
    name: ClassVar[str] = "schedule_monitor"
    description: ClassVar[str] = "Schedule wallet rechecks and emit alerts on changes."
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "address": {"type": "string"},
            "interval_minutes": {"type": "integer", "minimum": 1, "maximum": 1440},
            "conditions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "e.g. large_outflow,new_token,risk_score_jump",
            },
        },
        "required": ["address", "interval_minutes"],
    }

    async def execute(self, address: str, interval_minutes: int, conditions: Optional[List[str]] = None):
        """Execute the tool (required by BaseTool interface)."""
        return self.call(address=address, interval_minutes=interval_minutes, conditions=conditions)

    def call(self, address: str, interval_minutes: int, conditions: Optional[List[str]] = None):
        # TODO: register a job (cron/worker) to rerun GetWalletSummaryTool and diff
        # TODO: push alert payload to agent output channel
        return {
            "scheduled": True,
            "interval_minutes": interval_minutes,
            "conditions": conditions or [],
        }





