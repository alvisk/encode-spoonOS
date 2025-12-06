"""Minimal Neo N3 JSON-RPC client helpers."""

import json
import re
import time
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

from .config import get_neo_rpc_url


class NeoRPCError(RuntimeError):
    """Raised when RPC returns an error."""


class InvalidAddressError(ValueError):
    """Raised when an invalid address is provided."""


def detect_chain(address: str) -> str:
    """
    Detect which blockchain an address belongs to.
    
    Args:
        address: Wallet address string
        
    Returns:
        Chain identifier: "neo3", "ethereum", or "unknown"
    """
    # Neo N3 addresses start with 'N' and are 34 characters
    if address.startswith("N") and len(address) == 34:
        return "neo3"
    
    # Ethereum addresses start with '0x' and are 42 characters (0x + 40 hex)
    if address.startswith("0x") and len(address) == 42:
        if re.match(r"^0x[a-fA-F0-9]{40}$", address):
            return "ethereum"
    
    # Neo Legacy addresses start with 'A'
    if address.startswith("A") and len(address) == 34:
        return "neo_legacy"
    
    return "unknown"


def validate_neo_address_format(address: str) -> Tuple[bool, str]:
    """
    Validate Neo N3 address format locally (without RPC).
    
    Args:
        address: Address to validate
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if not address:
        return False, "Address is empty"
    
    if not address.startswith("N"):
        chain = detect_chain(address)
        if chain == "ethereum":
            return False, f"This is an Ethereum address (0x...). Neo Wallet Guardian only supports Neo N3 addresses (starting with 'N')"
        elif chain == "neo_legacy":
            return False, f"This appears to be a Neo Legacy address (starting with 'A'). Please use a Neo N3 address (starting with 'N')"
        else:
            return False, f"Invalid address format. Neo N3 addresses start with 'N' and are 34 characters long"
    
    if len(address) != 34:
        return False, f"Invalid Neo N3 address length: {len(address)} (expected 34)"
    
    # Basic Base58 character check
    base58_chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
    for char in address:
        if char not in base58_chars:
            return False, f"Invalid character '{char}' in address. Neo addresses use Base58 encoding"
    
    return True, ""


class NeoClient:
    def __init__(self, rpc_url: Optional[str] = None):
        self.rpc_url = rpc_url or get_neo_rpc_url()

    def _rpc(self, method: str, params: List[Any]) -> Any:
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
            raise NeoRPCError(parsed["error"])
        return parsed.get("result")

    def validate_address(self, address: str) -> Dict[str, Any]:
        """
        Validate a Neo N3 address using the RPC.
        
        Args:
            address: Address to validate
            
        Returns:
            Dict with 'address' and 'isvalid' keys
        """
        # First do local format check
        is_valid, error_msg = validate_neo_address_format(address)
        if not is_valid:
            return {
                "address": address,
                "isvalid": False,
                "error": error_msg,
                "chain": detect_chain(address),
            }
        
        # Then verify with RPC
        try:
            result = self._rpc("validateaddress", [address])
            result["chain"] = "neo3"
            return result
        except NeoRPCError as e:
            return {
                "address": address,
                "isvalid": False,
                "error": str(e),
                "chain": "neo3",
            }

    def get_nep17_balances(self, address: str) -> List[Dict[str, Any]]:
        """Return balances for an address."""
        result = self._rpc("getnep17balances", [address])
        return result.get("balance", [])

    def get_nep17_transfers(self, address: str, start_time: int, end_time: int) -> Dict[str, Any]:
        """Return transfers in/out for a time window."""
        return self._rpc("getnep17transfers", [address, start_time, end_time])

    def get_contract_state(self, contract_hash: str) -> Optional[Dict[str, Any]]:
        """
        Get smart contract state/info by script hash.
        
        Args:
            contract_hash: Contract script hash (with or without 0x prefix)
            
        Returns:
            Contract state dict or None if not found
        """
        try:
            # Ensure proper format
            if not contract_hash.startswith("0x"):
                contract_hash = "0x" + contract_hash
            return self._rpc("getcontractstate", [contract_hash])
        except NeoRPCError:
            return None

    def get_block_count(self) -> int:
        """Get current block height."""
        return self._rpc("getblockcount", [])

    def get_block(self, index_or_hash: Any, verbose: int = 1) -> Optional[Dict[str, Any]]:
        """Get block by index or hash."""
        try:
            return self._rpc("getblock", [index_or_hash, verbose])
        except NeoRPCError:
            return None

    def get_application_log(self, tx_hash: str) -> Optional[Dict[str, Any]]:
        """Get application log for a transaction (shows contract invocations)."""
        try:
            return self._rpc("getapplicationlog", [tx_hash])
        except NeoRPCError:
            return None

    def invoke_function(
        self, 
        contract_hash: str, 
        method: str, 
        params: List[Any] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Invoke a contract function (read-only, no state change).
        
        Args:
            contract_hash: Contract script hash
            method: Method name to invoke
            params: Parameters for the method
            
        Returns:
            Invocation result or None on error
        """
        try:
            if not contract_hash.startswith("0x"):
                contract_hash = "0x" + contract_hash
            return self._rpc("invokefunction", [contract_hash, method, params or []])
        except NeoRPCError:
            return None

    def get_storage(
        self,
        contract_hash: str,
        key: str
    ) -> Optional[str]:
        """
        Get storage value for a contract key.
        
        Args:
            contract_hash: Contract script hash
            key: Storage key (hex encoded)
            
        Returns:
            Storage value (hex encoded) or None if not found
        """
        try:
            if not contract_hash.startswith("0x"):
                contract_hash = "0x" + contract_hash
            return self._rpc("getstorage", [contract_hash, key])
        except NeoRPCError:
            return None


