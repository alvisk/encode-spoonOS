"""Tool for drafting safe, non-advisory action messages.

Generates tailored messaging based on wallet analysis results,
ensuring compliance with financial advice regulations.
"""

from typing import ClassVar, List, Optional, Dict, Any
from spoon_ai.tools import BaseTool


class ActionDraftTool(BaseTool):
    """Draft safe next-steps messaging based on wallet analysis (non-financial advice)."""
    
    name: ClassVar[str] = "action_draft"
    description: ClassVar[str] = "Draft safe, actionable messaging based on wallet analysis. Never provides financial advice."
    
    # Class-level constants (must be ClassVar to avoid Pydantic issues)
    CHANNEL_CONFIGS: ClassVar[Dict[str, Dict[str, Any]]] = {
        "console": {
            "max_length": 2000,
            "include_technical": True,
            "include_emojis": False,
            "format": "detailed",
        },
        "dm": {
            "max_length": 500,
            "include_technical": False,
            "include_emojis": True,
            "format": "conversational",
        },
        "email": {
            "max_length": 1000,
            "include_technical": True,
            "include_emojis": False,
            "format": "formal",
        },
        "tweet": {
            "max_length": 280,
            "include_technical": False,
            "include_emojis": True,
            "format": "brief",
        },
        "alert": {
            "max_length": 200,
            "include_technical": False,
            "include_emojis": True,
            "format": "urgent",
        },
    }

    RISK_HEADERS: ClassVar[Dict[str, tuple]] = {
        "low": ("All Clear", "Your wallet looks healthy"),
        "medium": ("Attention Recommended", "Some items need your attention"),
        "high": ("Action Suggested", "Important security considerations detected"),
        "critical": ("Urgent Review Needed", "Critical security concerns identified"),
    }

    DISCLAIMER: ClassVar[str] = (
        "This analysis is for informational purposes only and does not constitute "
        "financial, investment, or security advice. Always do your own research "
        "and consult qualified professionals before making decisions."
    )
    
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "Brief summary of the wallet analysis"
            },
            "risk_flags": {
                "type": "array",
                "items": {"type": "string"},
                "description": "List of identified risk factors"
            },
            "risk_level": {
                "type": "string",
                "enum": ["low", "medium", "high", "critical"],
                "description": "Overall risk level"
            },
            "channel": {
                "type": "string",
                "enum": ["console", "dm", "email", "tweet", "alert"],
                "default": "console",
                "description": "Target channel for the message"
            },
        },
        "required": ["summary", "risk_flags"],
    }



    async def execute(
        self, 
        summary: str, 
        risk_flags: List[str], 
        risk_level: str = "medium",
        channel: str = "console"
    ) -> Dict[str, Any]:
        """Execute the action draft."""
        return self.call(summary, risk_flags, risk_level, channel)

    def call(
        self, 
        summary: str, 
        risk_flags: List[str], 
        risk_level: str = "medium",
        channel: str = "console"
    ) -> Dict[str, Any]:
        """
        Draft an action message tailored to the channel and risk level.
        
        Returns:
            Dict with channel, message, and metadata
        """
        config = self.CHANNEL_CONFIGS.get(channel, self.CHANNEL_CONFIGS["console"])
        header, subheader = self.RISK_HEADERS.get(risk_level, self.RISK_HEADERS["medium"])
        
        # Build the message based on channel format
        if config["format"] == "brief":
            message = self._format_brief(summary, risk_flags, risk_level, config)
        elif config["format"] == "urgent":
            message = self._format_urgent(summary, risk_flags, risk_level, config)
        elif config["format"] == "conversational":
            message = self._format_conversational(summary, risk_flags, risk_level, config)
        elif config["format"] == "formal":
            message = self._format_formal(summary, risk_flags, risk_level, header, config)
        else:
            message = self._format_detailed(summary, risk_flags, risk_level, header, subheader, config)
        
        # Truncate if needed
        if len(message) > config["max_length"]:
            message = message[:config["max_length"] - 3] + "..."
        
        return {
            "channel": channel,
            "message": message,
            "risk_level": risk_level,
            "flags_count": len(risk_flags),
            "character_count": len(message),
            "max_length": config["max_length"],
            "actions": self._suggest_actions(risk_flags, risk_level),
        }

    def _format_brief(self, summary: str, flags: List[str], level: str, config: dict) -> str:
        """Format for tweet-length messages."""
        emoji = self._get_risk_emoji(level) if config["include_emojis"] else ""
        
        if level == "critical":
            return f"{emoji} WALLET ALERT: Critical risks detected. Review immediately. #Neo #Security"
        elif level == "high":
            return f"{emoji} Wallet check: {len(flags)} concerns found. Consider reviewing your security. #Neo"
        elif level == "medium":
            return f"{emoji} Wallet scan complete: Minor items to review. Your assets appear safe. #Neo"
        else:
            return f"{emoji} Wallet health check: All clear! No significant risks detected. #Neo"

    def _format_urgent(self, summary: str, flags: List[str], level: str, config: dict) -> str:
        """Format for urgent alert notifications."""
        emoji = self._get_risk_emoji(level) if config["include_emojis"] else ""
        
        if level in ["critical", "high"]:
            return f"{emoji} ALERT: {len(flags)} security issue(s) detected! Review now."
        else:
            return f"{emoji} Scan complete: {summary[:100]}"

    def _format_conversational(self, summary: str, flags: List[str], level: str, config: dict) -> str:
        """Format for DM-style conversational messages."""
        emoji = self._get_risk_emoji(level) if config["include_emojis"] else ""
        
        lines = [f"{emoji} Hey! I just scanned your wallet."]
        
        if level == "critical":
            lines.append("I found some serious concerns that need your attention right away:")
        elif level == "high":
            lines.append("Found a few things you should probably look at:")
        elif level == "medium":
            lines.append("Here's what I noticed:")
        else:
            lines.append("Good news - everything looks healthy!")
        
        if flags and level != "low":
            for flag in flags[:3]:
                lines.append(f"• {flag}")
            if len(flags) > 3:
                lines.append(f"...and {len(flags) - 3} more")
        
        if level in ["critical", "high"]:
            lines.append("\nWould recommend taking a closer look when you get a chance!")
        
        return "\n".join(lines)

    def _format_formal(self, summary: str, flags: List[str], level: str, header: str, config: dict) -> str:
        """Format for email-style formal messages."""
        lines = [
            f"Subject: Wallet Security Analysis - {header}",
            "",
            "Dear User,",
            "",
            f"Our automated security analysis has completed. {summary}",
            "",
        ]
        
        if flags:
            lines.append("Findings:")
            for i, flag in enumerate(flags[:5], 1):
                lines.append(f"{i}. {flag}")
            if len(flags) > 5:
                lines.append(f"   ...plus {len(flags) - 5} additional items")
            lines.append("")
        
        lines.extend([
            "Recommended Actions:",
            *[f"• {action}" for action in self._suggest_actions(flags, level)[:3]],
            "",
            "---",
            self.DISCLAIMER[:200],
        ])
        
        return "\n".join(lines)

    def _format_detailed(self, summary: str, flags: List[str], level: str, header: str, subheader: str, config: dict) -> str:
        """Format for detailed console output."""
        lines = [
            f"{'='*60}",
            f"ASSERTION OS ANALYSIS REPORT",
            f"{'='*60}",
            "",
            f"Status: {header.upper()}",
            f"Risk Level: {level.upper()}",
            "",
            f"Summary: {summary}",
            "",
        ]
        
        if flags:
            lines.append("Risk Factors Identified:")
            lines.append("-" * 40)
            for flag in flags:
                lines.append(f"  • {flag}")
            lines.append("")
        
        actions = self._suggest_actions(flags, level)
        if actions:
            lines.append("Suggested Actions:")
            lines.append("-" * 40)
            for action in actions:
                lines.append(f"  → {action}")
            lines.append("")
        
        lines.extend([
            "-" * 60,
            "DISCLAIMER:",
            self.DISCLAIMER,
            "-" * 60,
        ])
        
        return "\n".join(lines)

    def _get_risk_emoji(self, level: str) -> str:
        """Get appropriate emoji for risk level."""
        emojis = {
            "low": "✅",
            "medium": "⚠️",
            "high": "🚨",
            "critical": "🔴",
        }
        return emojis.get(level, "ℹ️")

    def _suggest_actions(self, flags: List[str], level: str) -> List[str]:
        """Generate safe, non-advisory action suggestions."""
        actions = []
        
        if level == "critical":
            actions.extend([
                "Review all flagged items immediately",
                "Consider consulting a blockchain security expert",
                "Verify the legitimacy of recent contract interactions",
                "Check for unauthorized access to your wallet",
            ])
        elif level == "high":
            actions.extend([
                "Review the identified risk factors",
                "Verify recent transactions are intentional",
                "Consider diversifying assets if concentrated",
            ])
        elif level == "medium":
            actions.extend([
                "Review flagged items at your convenience",
                "Monitor wallet activity regularly",
            ])
        else:
            actions.extend([
                "Continue monitoring wallet health periodically",
                "Keep private keys secure",
            ])
        
        # Add flag-specific suggestions
        flag_text = " ".join(flags).lower()
        
        if "scam" in flag_text or "malicious" in flag_text:
            actions.insert(0, "Avoid further interaction with flagged addresses")
        
        if "concentration" in flag_text:
            actions.append("Consider reviewing asset distribution")
        
        if "suspicious" in flag_text:
            actions.append("Verify the source of suspicious transactions")
        
        return actions[:5]  # Limit to 5 actions
