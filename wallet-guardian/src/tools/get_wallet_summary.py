"""Tool to fetch and summarize wallet data on Neo N3.

This module uses shared computation functions from graph_orchestrator to prevent
redundant code. The UnifiedDataFetcher handles caching to avoid duplicate RPC calls.
"""

import asyncio
import os
import time
from typing import Any, ClassVar, Dict, List, Optional

from spoon_ai.tools import BaseTool

from ..neo_client import NeoClient, NeoRPCError


# =============================================================================
# SHARED COMPUTATION FUNCTIONS
# These are the canonical implementations - used by graph_orchestrator too
# =============================================================================

def _compute_concentration(balances: List[Dict[str, Any]]) -> float:
    """Compute portfolio concentration (0-1). Higher = more concentrated."""
    total = sum(float(b.get("amount", 0)) for b in balances)
    if total <= 0:
        return 0.0
    top = max((float(b.get("amount", 0)) for b in balances), default=0.0)
    return top / total


def _stablecoin_ratio(balances: List[Dict[str, Any]]) -> float:
    """Compute ratio of stablecoins in portfolio."""
    total = sum(float(b.get("amount", 0)) for b in balances)
    if total <= 0:
        return 0.0
    stable = sum(
        float(b.get("amount", 0))
        for b in balances
        if any(tag in (b.get("symbol") or "").upper() 
               for tag in ("USD", "USDT", "USDC", "DAI", "FDUSD", "CUSDT"))
    )
    return stable / total


def _extract_counterparties(transfers: Dict[str, Any]) -> List[str]:
    """Extract unique counterparty addresses from transfers."""
    cps = set()
    for direction in ("sent", "received"):
        for tx in transfers.get(direction, []):
            # Handle different field names
            addr = tx.get("transferaddress") or tx.get("to") or tx.get("from")
            if addr:
                cps.add(addr)
    return list(cps)


class GetWalletSummaryTool(BaseTool):
    name: ClassVar[str] = "get_wallet_summary"
    description: ClassVar[str] = "Fetch balances and transfers for a wallet on Neo N3 and compute simple risk metrics."
    parameters: ClassVar[Dict[str, Any]] = {
        "type": "object",
        "properties": {
            "address": {"type": "string", "description": "Neo N3 address (scripthash format)"},
            "chain": {"type": "string", "enum": ["neo3"], "default": "neo3"},
            "lookback_days": {"type": "integer", "minimum": 1, "maximum": 90, "default": 30},
        },
        "required": ["address"],
    }

    async def execute(self, address: str, chain: str = "neo3", lookback_days: int = 30, use_mock: bool = False):
        return self.call(address, chain, lookback_days, use_mock)

    def call(self, address: str, chain: str = "neo3", lookback_days: int = 30, use_mock: bool = False):
        if chain != "neo3":
            return {"error": "Only neo3 is supported in this prototype"}

        env_mock = os.environ.get("WALLET_GUARDIAN_USE_MOCK", "").lower() in ("1", "true", "yes", "on")
        if use_mock or env_mock:
            return _mock_summary(address=address, chain=chain, lookback_days=lookback_days)

        client = NeoClient()
        now = int(time.time())
        start = now - lookback_days * 86400

        try:
            balances = client.get_nep17_balances(address)
            transfers = client.get_nep17_transfers(address, start, now)
        except NeoRPCError as exc:
            return {"error": f"rpc_error: {exc}"}
        except Exception as exc:  # pragma: no cover - best effort guard
            return {"error": f"unexpected_error: {exc}"}

        concentration = _compute_concentration(balances)
        stable_ratio = _stablecoin_ratio(balances)
        counterparties = _extract_counterparties(transfers or {})

        risk_flags = []
        if concentration > 0.8:
            risk_flags.append("high_concentration")
        if stable_ratio < 0.1:
            risk_flags.append("low_stablecoin_buffer")
        if len(counterparties) == 0:
            risk_flags.append("inactive_or_new_wallet")

        summary = {
            "address": address,
            "chain": chain,
            "lookback_days": lookback_days,
            "balances": balances,
            "transfers": transfers,
            "metrics": {
                "concentration": concentration,
                "stablecoin_ratio": stable_ratio,
                "counterparty_count": len(counterparties),
            },
            "risk_flags": risk_flags,
            "counterparties": counterparties,
        }
        return summary


def _mock_summary(address: str, chain: str, lookback_days: int) -> Dict[str, Any]:
    """Deterministic fixture used for demos/offline runs."""
    balances = [
        {"asset": "hash_gas", "symbol": "GAS", "amount": 120.5},
        {"asset": "hash_neo", "symbol": "NEO", "amount": 50},
        {"asset": "hash_usdt", "symbol": "USDT", "amount": 15},
    ]
    transfers = {
        "sent": [
            {"to": "NRiskCounterparty1", "value": "10", "timestamp": 1710000000},
            {"to": "NTrustedDex", "value": "25", "timestamp": 1711000000},
        ],
        "received": [
            {"from": "NTrustedDex", "value": "30", "timestamp": 1710500000},
        ],
    }

    concentration = _compute_concentration(balances)
    stable_ratio = _stablecoin_ratio(balances)
    counterparties = _extract_counterparties(transfers)

    risk_flags = []
    if concentration > 0.8:
        risk_flags.append("high_concentration")
    if stable_ratio < 0.1:
        risk_flags.append("low_stablecoin_buffer")
    if len(counterparties) == 0:
        risk_flags.append("inactive_or_new_wallet")

    return {
        "address": address,
        "chain": chain,
        "lookback_days": lookback_days,
        "balances": balances,
        "transfers": transfers,
        "metrics": {
            "concentration": concentration,
            "stablecoin_ratio": stable_ratio,
            "counterparty_count": len(counterparties),
        },
        "risk_flags": risk_flags,
        "counterparties": counterparties,
        "mock": True,
    }


