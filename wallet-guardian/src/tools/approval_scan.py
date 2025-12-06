"""Tool for scanning token approvals and identifying risky allowances.

On Neo N3, tokens use NEP-17 standard which doesn't have traditional
allowance/approval mechanisms like ERC-20. However, we can detect:
1. Interactions with DeFi protocols that may have ongoing permissions
2. Smart contracts the wallet has interacted with
3. Delegated transaction patterns
"""

import asyncio
from typing import ClassVar, Dict, List, Any, Optional
from dataclasses import dataclass
from spoon_ai.tools import BaseTool

from ..neo_client import NeoClient
from ..SusInspector import SusInspector
import time


@dataclass
class ContractInteraction:
    """Represents an interaction with a smart contract."""
    contract_hash: str
    contract_name: Optional[str]
    interaction_count: int
    last_interaction: int  # timestamp
    total_value_transferred: int
    is_trusted: bool
    risk_level: str
    flags: List[str]


class ApprovalScanTool(BaseTool):
    """Scan for risky contract interactions and permissions on Neo N3."""
    
    name: ClassVar[str] = "approval_scan"
    description: ClassVar[str] = "Scan wallet for risky contract interactions, ongoing permissions, and flag suspicious protocols."
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "address": {
                "type": "string",
                "description": "Neo N3 wallet address to scan"
            },
            "lookback_days": {
                "type": "integer",
                "minimum": 1,
                "maximum": 365,
                "default": 90,
                "description": "Days to look back for interactions"
            }
        },
        "required": ["address"],
    }

    def __init__(self):
        super().__init__()
        self.neo_client = NeoClient()
        self.inspector = SusInspector()

    async def execute(self, address: str, lookback_days: int = 90) -> Dict[str, Any]:
        """Execute the approval scan."""
        return self.call(address, lookback_days)

    def call(self, address: str, lookback_days: int = 90) -> Dict[str, Any]:
        """
        Scan for contract interactions and identify potential risks.
        
        Returns:
            Dict with contract interactions, flags, and risk assessment
        """
        end_time = int(time.time())
        start_time = end_time - (lookback_days * 24 * 60 * 60)
        
        try:
            transfers = self.neo_client.get_nep17_transfers(address, start_time, end_time)
        except Exception as e:
            return {
                "address": address,
                "error": f"Failed to fetch transfers: {str(e)}",
                "interactions": [],
                "flags": [],
                "risk_summary": "Unable to scan"
            }
        
        # Collect all contract interactions
        contract_interactions: Dict[str, ContractInteraction] = {}
        
        all_transfers = transfers.get("sent", []) + transfers.get("received", [])
        
        for tx in all_transfers:
            contract_hash = tx.get("assethash", "").lower().replace("0x", "")
            if not contract_hash:
                continue
            
            # Get or create interaction record
            if contract_hash not in contract_interactions:
                # Analyze the contract
                is_trusted = contract_hash in self.inspector.TRUSTED_CONTRACTS
                contract_name = self.inspector.TRUSTED_CONTRACTS.get(contract_hash)
                
                # Get contract analysis for risk level
                analysis = self.inspector.analyze_contract(contract_hash)
                
                contract_interactions[contract_hash] = ContractInteraction(
                    contract_hash=contract_hash,
                    contract_name=contract_name,
                    interaction_count=0,
                    last_interaction=0,
                    total_value_transferred=0,
                    is_trusted=is_trusted,
                    risk_level=analysis.risk_level.value if analysis else "unknown",
                    flags=analysis.reasons if analysis else []
                )
            
            # Update interaction stats
            interaction = contract_interactions[contract_hash]
            interaction.interaction_count += 1
            
            tx_timestamp = tx.get("timestamp", 0)
            if tx_timestamp > interaction.last_interaction:
                interaction.last_interaction = tx_timestamp
            
            try:
                amount = int(tx.get("amount", "0"))
                interaction.total_value_transferred += abs(amount)
            except (ValueError, TypeError):
                pass
        
        # Identify flags and concerns
        flags: List[Dict[str, Any]] = []
        risky_interactions: List[Dict[str, Any]] = []
        
        for contract_hash, interaction in contract_interactions.items():
            interaction_dict = {
                "contract_hash": f"0x{contract_hash}",
                "contract_name": interaction.contract_name or "Unknown",
                "interaction_count": interaction.interaction_count,
                "last_interaction": interaction.last_interaction,
                "total_value": interaction.total_value_transferred,
                "is_trusted": interaction.is_trusted,
                "risk_level": interaction.risk_level,
            }
            
            # Flag risky contracts
            if not interaction.is_trusted:
                if interaction.risk_level in ["high", "critical"]:
                    flags.append({
                        "type": "risky_contract",
                        "severity": "high",
                        "contract": f"0x{contract_hash}",
                        "message": f"High-risk contract interaction detected: {interaction.contract_name or contract_hash[:16]}",
                        "reasons": interaction.flags[:3]
                    })
                    risky_interactions.append(interaction_dict)
                
                elif interaction.risk_level == "medium":
                    flags.append({
                        "type": "medium_risk_contract",
                        "severity": "medium",
                        "contract": f"0x{contract_hash}",
                        "message": f"Medium-risk contract: {interaction.contract_name or contract_hash[:16]}",
                        "reasons": interaction.flags[:2]
                    })
                    risky_interactions.append(interaction_dict)
                
                # Flag unknown contracts with high interaction count
                elif interaction.interaction_count > 10:
                    flags.append({
                        "type": "frequent_unknown_contract",
                        "severity": "low",
                        "contract": f"0x{contract_hash}",
                        "message": f"Frequent interactions ({interaction.interaction_count}) with unverified contract",
                    })
                    risky_interactions.append(interaction_dict)
        
        # Calculate overall risk
        high_risk_count = sum(1 for f in flags if f.get("severity") == "high")
        medium_risk_count = sum(1 for f in flags if f.get("severity") == "medium")
        
        if high_risk_count > 0:
            risk_summary = f"HIGH RISK: {high_risk_count} high-risk contract(s) detected"
        elif medium_risk_count > 0:
            risk_summary = f"MEDIUM RISK: {medium_risk_count} medium-risk contract(s) detected"
        elif flags:
            risk_summary = f"LOW RISK: {len(flags)} minor concern(s) detected"
        else:
            risk_summary = "CLEAN: No risky contract interactions detected"
        
        return {
            "address": address,
            "scan_period_days": lookback_days,
            "total_contracts_interacted": len(contract_interactions),
            "trusted_contracts": sum(1 for i in contract_interactions.values() if i.is_trusted),
            "untrusted_contracts": sum(1 for i in contract_interactions.values() if not i.is_trusted),
            "risky_interactions": risky_interactions,
            "flags": flags,
            "risk_summary": risk_summary,
            "recommendations": self._generate_recommendations(flags),
        }
    
    def _generate_recommendations(self, flags: List[Dict]) -> List[str]:
        """Generate actionable recommendations based on flags."""
        recommendations = []
        
        high_risk = [f for f in flags if f.get("severity") == "high"]
        medium_risk = [f for f in flags if f.get("severity") == "medium"]
        
        if high_risk:
            recommendations.append(
                "URGENT: Review your interactions with high-risk contracts. "
                "Consider transferring assets to a new wallet if compromised."
            )
        
        if medium_risk:
            recommendations.append(
                "Review your interactions with medium-risk contracts and verify "
                "they are legitimate projects you intended to use."
            )
        
        unknown_contracts = [f for f in flags if f.get("type") == "frequent_unknown_contract"]
        if unknown_contracts:
            recommendations.append(
                "Verify the legitimacy of frequently-used unverified contracts. "
                "Check if they are from reputable projects."
            )
        
        if not recommendations:
            recommendations.append(
                "Your wallet interactions appear safe. Continue practicing good "
                "security hygiene by verifying contracts before interacting."
            )
        
        return recommendations
