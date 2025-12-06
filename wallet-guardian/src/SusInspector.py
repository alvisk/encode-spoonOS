"""Suspicious Transaction Inspector for Neo N3 wallets.

Uses transaction history to detect potentially suspicious activity patterns
such as rapid transfers, unusual amounts, known scam addresses, etc.
"""

import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from enum import Enum

from .neo_client import NeoClient, NeoRPCError


class SuspicionLevel(Enum):
    """Severity level for suspicious activity."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class SuspiciousTransaction:
    """Represents a flagged suspicious transaction."""
    tx_hash: str
    timestamp: int
    reason: str
    level: SuspicionLevel
    amount: Optional[str] = None
    counterparty: Optional[str] = None
    asset: Optional[str] = None


class SusInspector:
    """Inspects Neo N3 wallet transactions for suspicious activity."""
    
    # Known suspicious/scam addresses (example list - should be updated regularly)
    KNOWN_SCAM_ADDRESSES: set = {
        # Add known scam addresses here
        # "NScamAddress1...",
    }
    
    # Known contract hashes for major tokens
    KNOWN_TOKENS = {
        "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5": "NEO",
        "0xd2a4cff31913016155e38e474a2c06d08be276cf": "GAS",
        "0xf0151f528127276b9301cb43c386fa343e41a20a": "FLM",
        "0x48c40d4666f93408be1bef038b6722404d9a4c2a": "NNS",
    }
    
    # Thresholds for suspicious activity detection
    RAPID_TX_WINDOW_SECONDS = 300  # 5 minutes
    RAPID_TX_THRESHOLD = 10  # More than 10 txs in 5 min is suspicious
    LARGE_TRANSFER_THRESHOLD_GAS = 1000  # Large GAS transfer threshold
    DUST_AMOUNT_THRESHOLD = 0.0001  # Very small amounts may be dust attacks

    def __init__(self, neo_client: Optional[NeoClient] = None):
        """Initialize the inspector with a Neo client."""
        self.neo_client = neo_client or NeoClient()
    
    def inspect_wallet(
        self, 
        address: str, 
        lookback_days: int = 30
    ) -> Dict[str, Any]:
        """
        Inspect a wallet's transactions for suspicious activity.
        
        Args:
            address: Neo N3 wallet address to inspect
            lookback_days: Number of days to look back for transactions
            
        Returns:
            Dictionary containing inspection results with flagged transactions
        """
        end_time = int(time.time())  # Current time in seconds (Neo uses seconds)
        start_time = end_time - (lookback_days * 24 * 60 * 60)
        
        try:
            transfers = self.neo_client.get_nep17_transfers(address, start_time, end_time)
        except NeoRPCError as e:
            return {
                "address": address,
                "error": f"Failed to fetch transfers: {str(e)}",
                "suspicious_transactions": [],
                "risk_score": 0,
            }
        
        sent = transfers.get("sent", [])
        received = transfers.get("received", [])
        all_transfers = sent + received
        
        suspicious_txs: List[SuspiciousTransaction] = []
        
        # Run all detection checks
        suspicious_txs.extend(self._check_known_scam_addresses(all_transfers, address))
        suspicious_txs.extend(self._check_rapid_transactions(all_transfers))
        suspicious_txs.extend(self._check_large_transfers(sent, "sent"))
        suspicious_txs.extend(self._check_dust_attacks(received))
        suspicious_txs.extend(self._check_unusual_patterns(all_transfers, address))
        
        # Calculate overall risk score
        risk_score = self._calculate_risk_score(suspicious_txs)
        
        return {
            "address": address,
            "inspection_period_days": lookback_days,
            "total_transactions_analyzed": len(all_transfers),
            "suspicious_transactions": [
                {
                    "tx_hash": tx.tx_hash,
                    "timestamp": tx.timestamp,
                    "reason": tx.reason,
                    "level": tx.level.value,
                    "amount": tx.amount,
                    "counterparty": tx.counterparty,
                    "asset": tx.asset,
                }
                for tx in suspicious_txs
            ],
            "risk_score": risk_score,
            "risk_level": self._get_risk_level(risk_score),
            "summary": self._generate_summary(suspicious_txs, risk_score),
        }
    
    def _check_known_scam_addresses(
        self, 
        transfers: List[Dict], 
        user_address: str
    ) -> List[SuspiciousTransaction]:
        """Check if any transactions involve known scam addresses."""
        suspicious = []
        
        for tx in transfers:
            counterparty = tx.get("transferaddress", "")
            if counterparty in self.KNOWN_SCAM_ADDRESSES:
                suspicious.append(SuspiciousTransaction(
                    tx_hash=tx.get("txhash", "unknown"),
                    timestamp=tx.get("timestamp", 0),
                    reason="Transaction with known scam/flagged address",
                    level=SuspicionLevel.CRITICAL,
                    counterparty=counterparty,
                    amount=tx.get("amount"),
                    asset=self._get_token_name(tx.get("assethash", "")),
                ))
        
        return suspicious
    
    def _check_rapid_transactions(
        self, 
        transfers: List[Dict]
    ) -> List[SuspiciousTransaction]:
        """Detect rapid-fire transactions that may indicate automated attacks."""
        suspicious = []
        
        if len(transfers) < self.RAPID_TX_THRESHOLD:
            return suspicious
        
        # Sort by timestamp
        sorted_transfers = sorted(transfers, key=lambda x: x.get("timestamp", 0))
        
        # Sliding window check
        for i in range(len(sorted_transfers) - self.RAPID_TX_THRESHOLD + 1):
            window = sorted_transfers[i:i + self.RAPID_TX_THRESHOLD]
            time_diff = window[-1].get("timestamp", 0) - window[0].get("timestamp", 0)
            
            if time_diff <= self.RAPID_TX_WINDOW_SECONDS:  # Both in seconds now
                # Flag the transactions in this window
                suspicious.append(SuspiciousTransaction(
                    tx_hash=window[0].get("txhash", "unknown"),
                    timestamp=window[0].get("timestamp", 0),
                    reason=f"Rapid transaction burst: {self.RAPID_TX_THRESHOLD}+ txs in {self.RAPID_TX_WINDOW_SECONDS}s",
                    level=SuspicionLevel.MEDIUM,
                ))
                break  # Only flag once per wallet
        
        return suspicious
    
    def _check_large_transfers(
        self, 
        transfers: List[Dict],
        direction: str
    ) -> List[SuspiciousTransaction]:
        """Flag unusually large transfers."""
        suspicious = []
        
        for tx in transfers:
            asset_hash = tx.get("assethash", "")
            amount_raw = tx.get("amount", "0")
            
            try:
                # GAS has 8 decimals
                if "d2a4cff31913016155e38e474a2c06d08be276cf" in asset_hash.lower():
                    amount = int(amount_raw) / 10**8
                    if amount >= self.LARGE_TRANSFER_THRESHOLD_GAS:
                        suspicious.append(SuspiciousTransaction(
                            tx_hash=tx.get("txhash", "unknown"),
                            timestamp=tx.get("timestamp", 0),
                            reason=f"Large GAS transfer ({direction}): {amount:.2f} GAS",
                            level=SuspicionLevel.LOW,
                            amount=str(amount),
                            counterparty=tx.get("transferaddress"),
                            asset="GAS",
                        ))
            except (ValueError, TypeError):
                continue
        
        return suspicious
    
    def _check_dust_attacks(
        self, 
        received: List[Dict]
    ) -> List[SuspiciousTransaction]:
        """Detect potential dust attacks (very small incoming amounts)."""
        suspicious = []
        dust_count = 0
        
        for tx in received:
            try:
                amount_raw = int(tx.get("amount", "0"))
                # Check for very small amounts (potential dust)
                if 0 < amount_raw < 1000:  # Less than 0.00001 for 8 decimal tokens
                    dust_count += 1
                    if dust_count <= 3:  # Only flag first few
                        suspicious.append(SuspiciousTransaction(
                            tx_hash=tx.get("txhash", "unknown"),
                            timestamp=tx.get("timestamp", 0),
                            reason="Potential dust attack: extremely small incoming amount",
                            level=SuspicionLevel.LOW,
                            amount=tx.get("amount"),
                            counterparty=tx.get("transferaddress"),
                            asset=self._get_token_name(tx.get("assethash", "")),
                        ))
            except (ValueError, TypeError):
                continue
        
        if dust_count > 5:
            suspicious.append(SuspiciousTransaction(
                tx_hash="multiple",
                timestamp=int(time.time() * 1000),
                reason=f"Multiple dust transactions detected: {dust_count} total",
                level=SuspicionLevel.MEDIUM,
            ))
        
        return suspicious
    
    def _check_unusual_patterns(
        self, 
        transfers: List[Dict],
        user_address: str
    ) -> List[SuspiciousTransaction]:
        """Detect unusual transaction patterns."""
        suspicious = []
        
        # Check for circular transfers (same address sending and receiving)
        counterparties = {}
        for tx in transfers:
            cp = tx.get("transferaddress", "")
            if cp:
                counterparties[cp] = counterparties.get(cp, 0) + 1
        
        # Flag addresses with excessive back-and-forth
        for cp, count in counterparties.items():
            if count > 20:  # More than 20 txs with same address
                suspicious.append(SuspiciousTransaction(
                    tx_hash="pattern",
                    timestamp=int(time.time() * 1000),
                    reason=f"Unusual activity pattern: {count} transactions with single address",
                    level=SuspicionLevel.MEDIUM,
                    counterparty=cp,
                ))
        
        return suspicious
    
    def _get_token_name(self, asset_hash: str) -> str:
        """Get human-readable token name from asset hash."""
        asset_hash_lower = asset_hash.lower().replace("0x", "")
        for known_hash, name in self.KNOWN_TOKENS.items():
            if known_hash.replace("0x", "") == asset_hash_lower:
                return name
        return asset_hash[:16] + "..." if len(asset_hash) > 16 else asset_hash
    
    def _calculate_risk_score(self, suspicious_txs: List[SuspiciousTransaction]) -> int:
        """Calculate overall risk score (0-100) based on suspicious transactions."""
        if not suspicious_txs:
            return 0
        
        score = 0
        level_weights = {
            SuspicionLevel.LOW: 5,
            SuspicionLevel.MEDIUM: 15,
            SuspicionLevel.HIGH: 30,
            SuspicionLevel.CRITICAL: 50,
        }
        
        for tx in suspicious_txs:
            score += level_weights.get(tx.level, 5)
        
        return min(score, 100)  # Cap at 100
    
    def _get_risk_level(self, score: int) -> str:
        """Convert risk score to human-readable level."""
        if score == 0:
            return "clean"
        elif score < 20:
            return "low"
        elif score < 50:
            return "moderate"
        elif score < 80:
            return "high"
        else:
            return "critical"
    
    def _generate_summary(
        self, 
        suspicious_txs: List[SuspiciousTransaction], 
        risk_score: int
    ) -> str:
        """Generate a human-readable summary of the inspection."""
        if not suspicious_txs:
            return "No suspicious activity detected. Wallet appears clean."
        
        critical = sum(1 for tx in suspicious_txs if tx.level == SuspicionLevel.CRITICAL)
        high = sum(1 for tx in suspicious_txs if tx.level == SuspicionLevel.HIGH)
        medium = sum(1 for tx in suspicious_txs if tx.level == SuspicionLevel.MEDIUM)
        low = sum(1 for tx in suspicious_txs if tx.level == SuspicionLevel.LOW)
        
        parts = []
        if critical:
            parts.append(f"{critical} critical")
        if high:
            parts.append(f"{high} high")
        if medium:
            parts.append(f"{medium} medium")
        if low:
            parts.append(f"{low} low")
        
        return f"Found {len(suspicious_txs)} suspicious indicators ({', '.join(parts)} severity). Risk score: {risk_score}/100."


# Convenience function for quick inspection
def inspect_wallet_for_suspicious_activity(
    address: str, 
    lookback_days: int = 30
) -> Dict[str, Any]:
    """
    Quick inspection of a wallet for suspicious activity.
    
    Args:
        address: Neo N3 wallet address
        lookback_days: Days to look back (default 30)
        
    Returns:
        Inspection results dictionary
    """
    inspector = SusInspector()
    return inspector.inspect_wallet(address, lookback_days)
