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


