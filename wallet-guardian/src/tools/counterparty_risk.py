"""Tool for counterparty risk analysis using relationship graph.

Uses the WalletRelationshipAnalyzer for efficient network analysis
with caching.
"""

import asyncio
from typing import ClassVar, List
from spoon_ai.tools import BaseTool

from ..advanced_features import WalletRelationshipAnalyzer
from ..SusInspector import SusInspector


class FlagCounterpartyRiskTool(BaseTool):
    """Analyze counterparty risk using relationship graph and known scam lists."""
    
    name: ClassVar[str] = "flag_counterparty_risk"
    description: ClassVar[str] = "Label counterparties with risk tags using relationship analysis and blocklists."
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "address": {"type": "string", "description": "User wallet address"},
            "counterparties": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Addresses seen in recent transfers",
            },
            "depth": {
                "type": "integer",
                "minimum": 1,
                "maximum": 3,
                "default": 1,
                "description": "How many hops to explore for relationship analysis"
            }
        },
        "required": ["address", "counterparties"],
    }

    async def execute(self, address: str, counterparties: List[str], depth: int = 1):
        # Build relationship graph for the user wallet
        analyzer = WalletRelationshipAnalyzer()
        inspector = SusInspector()
        
        results = {}
        
        # Check each counterparty
        for cp in counterparties:
            tags = []
            score = 0.0
            
            # Check against known scam addresses
            if cp in inspector.KNOWN_SCAM_ADDRESSES:
                tags.append("known_scam")
                score = 1.0  # Maximum risk
            
            # Check if it's a known token contract
            if cp in inspector.TRUSTED_CONTRACTS:
                tags.append(f"token_{inspector.TRUSTED_CONTRACTS[cp]}")
                score = max(score, 0.1)  # Low risk for known tokens
            
            results[cp] = {
                "tags": tags,
                "score": score,
                "address_type": "unknown" if not tags else ("scam" if "known_scam" in tags else "token")
            }
        
        # If depth > 1, do deeper relationship analysis
        if depth > 1 and counterparties:
            try:
                graph = await analyzer.build_graph([address] + counterparties[:5], depth=depth)
                
                # Add relationship info
                for cp in counterparties:
                    if cp in results:
                        # Find suspicious relationships involving this counterparty
                        suspicious = [
                            s for s in graph.suspicious_relationships 
                            if s.get("from") == cp or s.get("to") == cp
                        ]
                        if suspicious:
                            results[cp]["tags"].append("suspicious_connections")
                            results[cp]["score"] = max(results[cp]["score"], 0.5)
                        
                        # Check if it's a central node
                        if cp in graph.central_addresses:
                            results[cp]["tags"].append("high_connectivity")
            except Exception:
                pass  # Graph analysis is optional enhancement
        
        return {
            "address": address,
            "results": results,
            "total_counterparties": len(counterparties),
            "flagged_count": sum(1 for r in results.values() if r["tags"]),
        }

    def call(self, address: str, counterparties: List[str], depth: int = 1):
        return asyncio.run(self.execute(address, counterparties, depth))





