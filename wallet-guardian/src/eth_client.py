"""
Ethereum Client for Wallet Guardian

Uses public APIs (Etherscan, public RPCs) to fetch Ethereum wallet data.
No API key required for basic queries.
"""

import asyncio
import json
import os
import re
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class Chain(Enum):
    """Supported blockchain networks."""
    NEO3 = "neo3"
    ETHEREUM = "ethereum"
    ETHEREUM_SEPOLIA = "ethereum_sepolia"
    BASE = "base"
    BASE_SEPOLIA = "base_sepolia"
    UNKNOWN = "unknown"


# Public RPC endpoints (no API key needed)
PUBLIC_RPCS = {
    Chain.ETHEREUM: "https://eth.llamarpc.com",
    Chain.ETHEREUM_SEPOLIA: "https://rpc.sepolia.org",
    Chain.BASE: "https://mainnet.base.org",
    Chain.BASE_SEPOLIA: "https://sepolia.base.org",
}

# Blockscout APIs (free, no API key required)
BLOCKSCOUT_APIS = {
    Chain.ETHEREUM: "https://eth.blockscout.com/api",
    Chain.ETHEREUM_SEPOLIA: "https://eth-sepolia.blockscout.com/api",
    Chain.BASE: "https://base.blockscout.com/api",
    Chain.BASE_SEPOLIA: "https://base-sepolia.blockscout.com/api",
}

# Chain IDs
CHAIN_IDS = {
    Chain.ETHEREUM: 1,
    Chain.ETHEREUM_SEPOLIA: 11155111,
    Chain.BASE: 8453,
    Chain.BASE_SEPOLIA: 84532,
}


def detect_chain(address: str) -> Chain:
    """
    Detect which blockchain an address belongs to.
    
    Args:
        address: Wallet address string
        
    Returns:
        Chain enum value
    """
    if not address:
        return Chain.UNKNOWN
    
    # Neo N3 addresses start with 'N' and are 34 characters
    if address.startswith("N") and len(address) == 34:
        return Chain.NEO3
    
    # Ethereum/EVM addresses start with '0x' and are 42 characters
    if address.startswith("0x") and len(address) == 42:
        if re.match(r"^0x[a-fA-F0-9]{40}$", address):
            return Chain.ETHEREUM  # Default to mainnet, can be overridden
    
    return Chain.UNKNOWN


def is_valid_eth_address(address: str) -> Tuple[bool, str]:
    """
    Validate Ethereum address format.
    
    Args:
        address: Address to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not address:
        return False, "Address is empty"
    
    if not address.startswith("0x"):
        return False, "Ethereum addresses must start with '0x'"
    
    if len(address) != 42:
        return False, f"Invalid address length: {len(address)} (expected 42)"
    
    if not re.match(r"^0x[a-fA-F0-9]{40}$", address):
        return False, "Address contains invalid characters"
    
    return True, ""


@dataclass
class EthBalance:
    """Ethereum balance info."""
    address: str
    balance_wei: int
    balance_eth: float
    
    
@dataclass
class EthTransaction:
    """Ethereum transaction info."""
    hash: str
    from_address: str
    to_address: str
    value_wei: int
    value_eth: float
    timestamp: int
    block_number: int
    is_error: bool
    gas_used: int
    gas_price: int


class EthClient:
    """
    Ethereum client using public APIs.
    
    Supports multiple EVM chains (Ethereum, Base, etc.)
    """
    
    def __init__(self, chain: Chain = Chain.ETHEREUM, api_key: Optional[str] = None):
        """
        Initialize Ethereum client.
        
        Args:
            chain: Target chain (default: Ethereum mainnet)
            api_key: Optional Etherscan API key for higher rate limits
        """
        self.chain = chain
        self.api_key = api_key or os.getenv("ETHERSCAN_API_KEY", "")
        self.rpc_url = PUBLIC_RPCS.get(chain, PUBLIC_RPCS[Chain.ETHEREUM])
        self.explorer_api = BLOCKSCOUT_APIS.get(chain, BLOCKSCOUT_APIS[Chain.ETHEREUM])
        self.chain_id = CHAIN_IDS.get(chain, 1)
    
    def _explorer_request(self, params: Dict[str, str]) -> Any:
        """Make request to block explorer API (Blockscout)."""
        if self.api_key:
            params["apikey"] = self.api_key
        
        query = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{self.explorer_api}?{query}"
        
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "WalletGuardian/1.0"},
            method="GET",
        )
        
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        
        if data.get("status") == "0" and data.get("message") != "No transactions found":
            error_msg = data.get("result", data.get("message", "Unknown error"))
            # Rate limit is common, don't raise
            if "rate limit" in str(error_msg).lower():
                return None
            raise RuntimeError(f"Explorer API error: {error_msg}")
        
        return data.get("result")
    
    def _rpc_request(self, method: str, params: List[Any]) -> Any:
        """Make JSON-RPC request to Ethereum node."""
        payload = {
            "jsonrpc": "2.0",
            "method": method,
            "params": params,
            "id": int(time.time()),
        }
        
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.rpc_url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        
        with urllib.request.urlopen(req, timeout=15) as resp:
            parsed = json.loads(resp.read().decode("utf-8"))
        
        if "error" in parsed:
            raise RuntimeError(f"RPC error: {parsed['error']}")
        
        return parsed.get("result")
    
    def get_balance(self, address: str) -> EthBalance:
        """
        Get ETH balance for an address.
        
        Args:
            address: Ethereum address (0x...)
            
        Returns:
            EthBalance with wei and ETH amounts
        """
        # Validate address
        is_valid, error = is_valid_eth_address(address)
        if not is_valid:
            raise ValueError(error)
        
        # Use RPC for balance (more reliable)
        result = self._rpc_request("eth_getBalance", [address, "latest"])
        balance_wei = int(result, 16)
        balance_eth = balance_wei / 1e18
        
        return EthBalance(
            address=address,
            balance_wei=balance_wei,
            balance_eth=balance_eth,
        )
    
    def get_transactions(
        self, 
        address: str, 
        start_block: int = 0,
        end_block: int = 99999999,
        limit: int = 100,
    ) -> List[EthTransaction]:
        """
        Get transaction history for an address.
        
        Args:
            address: Ethereum address
            start_block: Starting block number
            end_block: Ending block number
            limit: Max transactions to return
            
        Returns:
            List of EthTransaction objects
        """
        is_valid, error = is_valid_eth_address(address)
        if not is_valid:
            raise ValueError(error)
        
        result = self._explorer_request({
            "module": "account",
            "action": "txlist",
            "address": address,
            "startblock": str(start_block),
            "endblock": str(end_block),
            "page": "1",
            "offset": str(limit),
            "sort": "desc",
        })
        
        if not result or isinstance(result, str):
            return []
        
        transactions = []
        for tx in result:
            try:
                value_wei = int(tx.get("value", 0))
                transactions.append(EthTransaction(
                    hash=tx.get("hash", ""),
                    from_address=tx.get("from", ""),
                    to_address=tx.get("to", ""),
                    value_wei=value_wei,
                    value_eth=value_wei / 1e18,
                    timestamp=int(tx.get("timeStamp", 0)),
                    block_number=int(tx.get("blockNumber", 0)),
                    is_error=tx.get("isError", "0") == "1",
                    gas_used=int(tx.get("gasUsed", 0)),
                    gas_price=int(tx.get("gasPrice", 0)),
                ))
            except (ValueError, KeyError):
                continue
        
        return transactions
    
    def get_token_transfers(
        self,
        address: str,
        contract_address: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """
        Get ERC-20 token transfers for an address.
        
        Args:
            address: Ethereum address
            contract_address: Optional specific token contract
            limit: Max transfers to return
            
        Returns:
            List of token transfer dicts
        """
        is_valid, error = is_valid_eth_address(address)
        if not is_valid:
            raise ValueError(error)
        
        params = {
            "module": "account",
            "action": "tokentx",
            "address": address,
            "page": "1",
            "offset": str(limit),
            "sort": "desc",
        }
        
        if contract_address:
            params["contractaddress"] = contract_address
        
        result = self._explorer_request(params)
        
        if not result or isinstance(result, str):
            return []
        
        return result
    
    def get_token_balances(self, address: str) -> List[Dict[str, Any]]:
        """
        Get all ERC-20 token balances for an address.
        
        Note: This requires an API key for most explorers.
        Falls back to getting recent token transfers.
        
        Args:
            address: Ethereum address
            
        Returns:
            List of token balance dicts
        """
        # Get recent token transfers to find tokens
        transfers = self.get_token_transfers(address, limit=50)
        
        # Extract unique tokens
        tokens = {}
        for tx in transfers:
            contract = tx.get("contractAddress", "")
            if contract and contract not in tokens:
                tokens[contract] = {
                    "contract": contract,
                    "symbol": tx.get("tokenSymbol", "???"),
                    "name": tx.get("tokenName", "Unknown"),
                    "decimals": int(tx.get("tokenDecimal", 18)),
                }
        
        return list(tokens.values())
    
    def get_wallet_summary(self, address: str) -> Dict[str, Any]:
        """
        Get comprehensive wallet summary.
        
        Args:
            address: Ethereum address
            
        Returns:
            Dict with balance, transactions, tokens
        """
        is_valid, error = is_valid_eth_address(address)
        if not is_valid:
            return {"error": error, "address": address}
        
        # Get balance
        try:
            balance = self.get_balance(address)
        except Exception as e:
            balance = EthBalance(address=address, balance_wei=0, balance_eth=0)
        
        # Get recent transactions
        try:
            transactions = self.get_transactions(address, limit=50)
        except Exception:
            transactions = []
        
        # Get token info
        try:
            tokens = self.get_token_balances(address)
        except Exception:
            tokens = []
        
        # Analyze transactions
        total_sent = 0
        total_received = 0
        unique_counterparties = set()
        failed_txs = 0
        
        for tx in transactions:
            if tx.from_address.lower() == address.lower():
                total_sent += tx.value_eth
            else:
                total_received += tx.value_eth
            
            counterparty = tx.to_address if tx.from_address.lower() == address.lower() else tx.from_address
            if counterparty:
                unique_counterparties.add(counterparty.lower())
            
            if tx.is_error:
                failed_txs += 1
        
        return {
            "address": address,
            "chain": self.chain.value,
            "balance": {
                "eth": balance.balance_eth,
                "wei": balance.balance_wei,
            },
            "transactions": {
                "count": len(transactions),
                "total_sent_eth": total_sent,
                "total_received_eth": total_received,
                "failed_count": failed_txs,
                "unique_counterparties": len(unique_counterparties),
            },
            "tokens": {
                "count": len(tokens),
                "list": tokens[:10],  # Top 10 tokens
            },
            "recent_transactions": [
                {
                    "hash": tx.hash,
                    "from": tx.from_address,
                    "to": tx.to_address,
                    "value_eth": tx.value_eth,
                    "timestamp": tx.timestamp,
                    "is_error": tx.is_error,
                }
                for tx in transactions[:10]
            ],
        }
    
    def compute_risk_score(self, address: str) -> Dict[str, Any]:
        """
        Compute a risk score for an Ethereum wallet.
        
        Args:
            address: Ethereum address
            
        Returns:
            Dict with risk score and factors
        """
        summary = self.get_wallet_summary(address)
        
        if "error" in summary:
            return summary
        
        score = 100
        deductions = []
        
        # Check transaction count (low activity = higher risk)
        tx_count = summary["transactions"]["count"]
        if tx_count < 5:
            score -= 20
            deductions.append({"reason": "Low transaction history", "points": -20})
        elif tx_count < 20:
            score -= 10
            deductions.append({"reason": "Limited transaction history", "points": -10})
        
        # Check for failed transactions
        failed = summary["transactions"]["failed_count"]
        if failed > 5:
            score -= 15
            deductions.append({"reason": f"High failed transaction count ({failed})", "points": -15})
        elif failed > 0:
            score -= 5
            deductions.append({"reason": f"Some failed transactions ({failed})", "points": -5})
        
        # Check balance
        balance = summary["balance"]["eth"]
        if balance < 0.001:
            score -= 10
            deductions.append({"reason": "Very low balance", "points": -10})
        
        # Check counterparty diversity
        counterparties = summary["transactions"]["unique_counterparties"]
        if counterparties < 3:
            score -= 10
            deductions.append({"reason": "Low counterparty diversity", "points": -10})
        
        # Determine risk level
        if score >= 80:
            risk_level = "LOW"
        elif score >= 60:
            risk_level = "MEDIUM"
        elif score >= 40:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"
        
        return {
            "address": address,
            "chain": self.chain.value,
            "score": max(0, score),
            "risk_level": risk_level,
            "deductions": deductions,
            "summary": summary,
        }


# Convenience functions
def get_eth_client(chain: Chain = Chain.ETHEREUM) -> EthClient:
    """Get an Ethereum client for the specified chain."""
    return EthClient(chain=chain)


def analyze_eth_wallet(address: str, chain: Chain = Chain.ETHEREUM) -> Dict[str, Any]:
    """
    Analyze an Ethereum wallet.
    
    Args:
        address: Ethereum address (0x...)
        chain: Target chain
        
    Returns:
        Risk analysis dict
    """
    client = get_eth_client(chain)
    return client.compute_risk_score(address)
