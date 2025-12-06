"""Minimal Neo N3 JSON-RPC client helpers."""

import json
import time
import urllib.request
from typing import Any, Dict, List, Optional

from .config import get_neo_rpc_url


class NeoRPCError(RuntimeError):
    """Raised when RPC returns an error."""


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


