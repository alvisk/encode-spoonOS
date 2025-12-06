"""Tool to fetch and summarize wallet data on Neo N3 and Ethereum.

This module uses shared computation functions from graph_orchestrator to prevent
redundant code. The UnifiedDataFetcher handles caching to avoid duplicate RPC calls.
Supports auto-detection of chain based on address format.
"""

import asyncio
import os
import time
from typing import Any, ClassVar, Dict, List, Optional

from spoon_ai.tools import BaseTool

from ..neo_client import NeoClient, NeoRPCError
from ..eth_client import EthClient, Chain, detect_chain, is_valid_eth_address
from ..graph_orchestrator import (
    compute_concentration,
    compute_stablecoin_ratio,
    extract_counterparties,
    WalletDataCache,
)


class GetWalletSummaryTool(BaseTool):
    """Fetch balances and transfers for a wallet on Neo N3 or Ethereum with risk metrics."""
    
    name: ClassVar[str] = "get_wallet_summary"
    description: ClassVar[str] = "Fetch balances and transfers for a wallet on Neo N3 or Ethereum. Auto-detects chain from address format (N... = Neo, 0x... = Ethereum)."
    parameters: ClassVar[Dict[str, Any]] = {
        "type": "object",
        "properties": {
            "address": {"type": "string", "description": "Wallet address (Neo N3 starting with 'N' or Ethereum starting with '0x')"},
            "chain": {"type": "string", "enum": ["neo3", "ethereum", "auto"], "default": "auto", "description": "Blockchain network. Use 'auto' to detect from address format."},
            "lookback_days": {"type": "integer", "minimum": 1, "maximum": 90, "default": 30},
        },
        "required": ["address"],
    }

    async def execute(self, address: str, chain: str = "auto", lookback_days: int = 30, use_mock: bool = False):
        return self.call(address, chain, lookback_days, use_mock)

    def call(self, address: str, chain: str = "auto", lookback_days: int = 30, use_mock: bool = False):
        # Auto-detect chain from address format
        if chain == "auto":
            detected = detect_chain(address)
            if detected == Chain.NEO3:
                chain = "neo3"
            elif detected == Chain.ETHEREUM:
                chain = "ethereum"
            else:
                return {"error": f"Could not detect chain for address: {address}. Please specify chain parameter."}
        
        # Route to appropriate handler
        if chain == "ethereum":
            return self._get_ethereum_summary(address, lookback_days, use_mock)
        elif chain == "neo3":
            return self._get_neo_summary(address, lookback_days, use_mock)
        else:
            return {"error": f"Unsupported chain: {chain}. Use 'neo3' or 'ethereum'."}
    
    def _get_ethereum_summary(self, address: str, lookback_days: int, use_mock: bool) -> Dict[str, Any]:
        """Get Ethereum wallet summary."""
        if use_mock:
            return _mock_eth_summary(address, lookback_days)
        
        try:
            client = EthClient(chain=Chain.ETHEREUM)
            summary = client.get_wallet_summary(address)
            
            if "error" in summary:
                return summary
            
            # Add risk flags
            risk_flags = []
            if summary["transactions"]["count"] < 5:
                risk_flags.append("low_activity")
            if summary["transactions"]["failed_count"] > 5:
                risk_flags.append("high_failed_transactions")
            if summary["balance"]["eth"] < 0.001:
                risk_flags.append("very_low_balance")
            
            summary["risk_flags"] = risk_flags
            summary["lookback_days"] = lookback_days
            return summary
            
        except Exception as e:
            return {"error": f"ethereum_error: {str(e)}", "address": address}
    
    def _get_neo_summary(self, address: str, lookback_days: int, use_mock: bool) -> Dict[str, Any]:
        """Get Neo N3 wallet summary (original implementation)."""

        env_mock = os.environ.get("WALLET_GUARDIAN_USE_MOCK", "").lower() in ("1", "true", "yes", "on")
        if use_mock or env_mock:
            return _mock_neo_summary(address=address, lookback_days=lookback_days)

        # Check cache first
        cache = WalletDataCache()
        cached = cache.get("wallet_summary", address=address, lookback=lookback_days)
        if cached is not None:
            return cached

        client = NeoClient()
        now = int(time.time())
        start = now - lookback_days * 86400

        try:
            balances = client.get_nep17_balances(address)
            transfers = client.get_nep17_transfers(address, start, now)
        except NeoRPCError as exc:
            return {"error": f"rpc_error: {exc}"}
        except Exception as exc:
            return {"error": f"unexpected_error: {exc}"}

        # Use canonical functions from graph_orchestrator
        concentration = compute_concentration(balances)
        stable_ratio = compute_stablecoin_ratio(balances)
        counterparties = extract_counterparties(transfers or {})

        risk_flags = []
        if concentration > 0.8:
            risk_flags.append("high_concentration")
        if stable_ratio < 0.1:
            risk_flags.append("low_stablecoin_buffer")
        if len(counterparties) == 0:
            risk_flags.append("inactive_or_new_wallet")

        summary = {
            "address": address,
            "chain": "neo3",
            "lookback_days": lookback_days,
            "balances": balances,
            "transfers": transfers,
            "metrics": {
                "concentration": concentration,
                "stablecoin_ratio": stable_ratio,
                "counterparty_count": len(counterparties),
            },
            "risk_flags": risk_flags,
            "counterparties": list(counterparties),
        }
        
        # Cache the result
        cache.set("wallet_summary", summary, address=address, lookback=lookback_days)
        
        return summary


def _mock_neo_summary(address: str, lookback_days: int) -> Dict[str, Any]:
    """Deterministic fixture for Neo N3 demos/offline runs."""
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

    # Use canonical functions
    concentration = compute_concentration(balances)
    stable_ratio = compute_stablecoin_ratio(balances)
    counterparties = extract_counterparties(transfers)

    risk_flags = []
    if concentration > 0.8:
        risk_flags.append("high_concentration")
    if stable_ratio < 0.1:
        risk_flags.append("low_stablecoin_buffer")
    if len(counterparties) == 0:
        risk_flags.append("inactive_or_new_wallet")

    return {
        "address": address,
        "chain": "neo3",
        "lookback_days": lookback_days,
        "balances": balances,
        "transfers": transfers,
        "metrics": {
            "concentration": concentration,
            "stablecoin_ratio": stable_ratio,
            "counterparty_count": len(counterparties),
        },
        "risk_flags": risk_flags,
        "counterparties": list(counterparties),
        "mock": True,
    }


def _mock_eth_summary(address: str, lookback_days: int) -> Dict[str, Any]:
    """Deterministic fixture for Ethereum demos/offline runs."""
    return {
        "address": address,
        "chain": "ethereum",
        "lookback_days": lookback_days,
        "balance": {
            "eth": 2.5,
            "wei": 2500000000000000000,
        },
        "transactions": {
            "count": 45,
            "total_sent_eth": 10.5,
            "total_received_eth": 13.0,
            "failed_count": 1,
            "unique_counterparties": 12,
        },
        "tokens": {
            "count": 3,
            "list": [
                {"contract": "0xdac17f958d2ee523a2206206994597c13d831ec7", "symbol": "USDT", "name": "Tether USD", "decimals": 6},
                {"contract": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", "symbol": "USDC", "name": "USD Coin", "decimals": 6},
            ],
        },
        "recent_transactions": [
            {"hash": "0xabc123...", "from": address, "to": "0x742d35Cc6634C0532925a3b844Bc9e7595f1", "value_eth": 0.5, "timestamp": 1710000000, "is_error": False},
        ],
        "risk_flags": [],
        "mock": True,
    }



