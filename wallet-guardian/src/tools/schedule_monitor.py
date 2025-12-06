"""Tool for scheduled wallet monitoring using RealTimeMonitor.

Integrates with the advanced_features RealTimeMonitor for efficient
cached monitoring with event streaming.
"""

import asyncio
from typing import ClassVar, List, Optional
from spoon_ai.tools import BaseTool

from ..advanced_features import RealTimeMonitor, SmartAlertSystem, AlertPriority


# Global monitor instance for persistent monitoring
_monitor: Optional[RealTimeMonitor] = None
_alert_system: Optional[SmartAlertSystem] = None


def get_monitor() -> RealTimeMonitor:
    global _monitor
    if _monitor is None:
        _monitor = RealTimeMonitor(poll_interval=60.0)
    return _monitor


def get_alert_system() -> SmartAlertSystem:
    global _alert_system
    if _alert_system is None:
        _alert_system = SmartAlertSystem()
    return _alert_system


class ScheduleMonitorTool(BaseTool):
    """Schedule wallet monitoring with configurable alerts."""
    
    name: ClassVar[str] = "schedule_monitor"
    description: ClassVar[str] = "Schedule wallet monitoring and emit alerts on changes like large outflows or risk score jumps."
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "address": {"type": "string", "description": "Neo N3 wallet address to monitor"},
            "interval_minutes": {
                "type": "integer", 
                "minimum": 1, 
                "maximum": 1440,
                "description": "Check interval in minutes"
            },
            "conditions": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Alert conditions: large_outflow, new_token, risk_score_jump, suspicious_activity",
            },
        },
        "required": ["address", "interval_minutes"],
    }

    async def execute(self, address: str, interval_minutes: int, conditions: Optional[List[str]] = None):
        monitor = get_monitor()
        alert_system = get_alert_system()
        
        # Update poll interval
        monitor.poll_interval = interval_minutes * 60
        
        # Add wallet to monitoring
        monitor.add_wallet(address, config={"conditions": conditions or []})
        
        # Create custom alert rules based on conditions
        if conditions:
            for condition in conditions:
                if condition == "large_outflow":
                    alert_system.create_custom_rule(
                        name=f"Large Outflow ({address[:8]}...)",
                        condition_expr="balance_change_percent < -20",
                        priority=AlertPriority.HIGH,
                        wallets=[address]
                    )
                elif condition == "risk_score_jump":
                    alert_system.create_custom_rule(
                        name=f"Risk Jump ({address[:8]}...)",
                        condition_expr="risk_score < 50",
                        priority=AlertPriority.HIGH,
                        wallets=[address]
                    )
                elif condition == "suspicious_activity":
                    # Already a default rule
                    pass
        
        return {
            "scheduled": True,
            "address": address,
            "interval_minutes": interval_minutes,
            "conditions": conditions or [],
            "monitored_wallets": list(monitor.monitored_wallets.keys()),
        }

    def call(self, address: str, interval_minutes: int, conditions: Optional[List[str]] = None):
        return asyncio.run(self.execute(address, interval_minutes, conditions))


class CheckMonitorTool(BaseTool):
    """Check monitored wallets for events."""
    
    name: ClassVar[str] = "check_monitor"
    description: ClassVar[str] = "Run one monitoring cycle and return any detected events."
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {},
        "required": [],
    }

    async def execute(self):
        monitor = get_monitor()
        events = await monitor.monitor_once()
        
        return {
            "events": [e.to_dict() for e in events],
            "event_count": len(events),
            "monitored_wallets": list(monitor.monitored_wallets.keys()),
        }

    def call(self):
        return asyncio.run(self.execute())





