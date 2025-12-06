"""Suspicious Transaction Inspector for Neo N3 wallets.

Uses transaction history to detect potentially suspicious activity patterns
such as rapid transfers, unusual amounts, known scam addresses, and
interactions with suspicious smart contracts.
"""

import time
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

from .neo_client import NeoClient, NeoRPCError
from .common import (
    RiskLevel,
    TRUSTED_CONTRACTS,
    KNOWN_SCAM_ADDRESSES,
    KNOWN_MALICIOUS_CONTRACTS,
    RAPID_TX_WINDOW_SECONDS,
    RAPID_TX_THRESHOLD,
    LARGE_TRANSFER_THRESHOLD_GAS,
    DUST_AMOUNT_THRESHOLD,
    NEW_CONTRACT_BLOCKS,
    normalize_contract_hash,
    get_token_name,
    compute_suspicion_score,
    get_risk_level_from_suspicion_score,
)

# Backwards compatibility aliases
SuspicionLevel = RiskLevel
ContractRiskLevel = RiskLevel


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
    contract_info: Optional[Dict[str, Any]] = None


@dataclass
class ContractAnalysis:
    """Analysis results for a smart contract."""
    contract_hash: str
    is_suspicious: bool
    risk_level: SuspicionLevel
    reasons: List[str] = field(default_factory=list)
    name: Optional[str] = None
    is_verified: bool = False
    update_counter: int = 0
    manifest_flags: List[str] = field(default_factory=list)


class SusInspector:
    """Inspects Neo N3 wallet transactions for suspicious activity."""
    
    # Use shared constants from common module
    KNOWN_SCAM_ADDRESSES = KNOWN_SCAM_ADDRESSES
    KNOWN_MALICIOUS_CONTRACTS = KNOWN_MALICIOUS_CONTRACTS
    TRUSTED_CONTRACTS = TRUSTED_CONTRACTS
    
    # Suspicious contract name patterns (regex)
    SUSPICIOUS_NAME_PATTERNS = [
        r"(?i)airdrop",
        r"(?i)free.*token",
        r"(?i)claim.*reward",
        r"(?i)bonus",
        r"(?i)giveaway",
        r"(?i)double.*your",
        r"(?i)100x",
        r"(?i)moon",
        r"(?i)elon",
        r"(?i)safe.*moon",
        r"(?i)baby.*doge",
        r"(?i)shib",
        r"(?i)pump",
    ]
    
    # Suspicious method names that might indicate malicious intent
    SUSPICIOUS_METHODS = {
        "drain", "steal", "hack", "exploit", 
        "emergencyWithdraw", "rugPull", "ownerWithdraw",
        "setTaxTo100", "blacklistAll", "disableTransfer"
    }
    
    # Cache for contract analysis
    _contract_cache: Dict[str, ContractAnalysis] = {}

    def __init__(self, neo_client: Optional[NeoClient] = None):
        """Initialize the inspector with a Neo client."""
        self.neo_client = neo_client or NeoClient()
    
    def inspect_wallet(
        self, 
        address: str, 
        lookback_days: int = 30,
        check_contracts: bool = True
    ) -> Dict[str, Any]:
        """
        Inspect a wallet's transactions for suspicious activity.
        
        Args:
            address: Neo N3 wallet address to inspect
            lookback_days: Number of days to look back for transactions
            check_contracts: Whether to analyze interacted contracts
            
        Returns:
            Dictionary containing inspection results with flagged transactions
        """
        end_time = int(time.time())
        start_time = end_time - (lookback_days * 24 * 60 * 60)
        
        try:
            transfers = self.neo_client.get_nep17_transfers(address, start_time, end_time)
        except NeoRPCError as e:
            return {
                "address": address,
                "error": f"Failed to fetch transfers: {str(e)}",
                "suspicious_transactions": [],
                "suspicious_contracts": [],
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
        
        # Smart contract analysis
        suspicious_contracts: List[Dict[str, Any]] = []
        if check_contracts:
            contract_results = self._analyze_interacted_contracts(all_transfers)
            suspicious_contracts = contract_results["suspicious"]
            suspicious_txs.extend(contract_results["flagged_txs"])
        
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
                    "contract_info": tx.contract_info,
                }
                for tx in suspicious_txs
            ],
            "suspicious_contracts": suspicious_contracts,
            "risk_score": risk_score,
            "risk_level": self._get_risk_level(risk_score),
            "summary": self._generate_summary(suspicious_txs, risk_score, suspicious_contracts),
        }
    
    # =========================================================================
    # SMART CONTRACT ANALYSIS
    # =========================================================================
    
    def _analyze_interacted_contracts(
        self, 
        transfers: List[Dict]
    ) -> Dict[str, Any]:
        """
        Analyze all contracts the wallet has interacted with.
        
        Returns:
            Dict with 'suspicious' contracts list and 'flagged_txs' for suspicious interactions
        """
        # Collect unique contract hashes from transfers
        contract_hashes: Set[str] = set()
        for tx in transfers:
            asset_hash = tx.get("assethash", "")
            if asset_hash:
                # Normalize hash
                clean_hash = asset_hash.lower().replace("0x", "")
                contract_hashes.add(clean_hash)
        
        suspicious_contracts: List[Dict[str, Any]] = []
        flagged_txs: List[SuspiciousTransaction] = []
        
        for contract_hash in contract_hashes:
            analysis = self.analyze_contract(contract_hash)
            
            if analysis.is_suspicious:
                suspicious_contracts.append({
                    "contract_hash": contract_hash,
                    "name": analysis.name,
                    "risk_level": analysis.risk_level.value,
                    "reasons": analysis.reasons,
                    "is_verified": analysis.is_verified,
                    "update_counter": analysis.update_counter,
                })
                
                # Flag transactions involving this contract
                for tx in transfers:
                    tx_asset = tx.get("assethash", "").lower().replace("0x", "")
                    if tx_asset == contract_hash:
                        flagged_txs.append(SuspiciousTransaction(
                            tx_hash=tx.get("txhash", "unknown"),
                            timestamp=tx.get("timestamp", 0),
                            reason=f"Interaction with suspicious contract: {', '.join(analysis.reasons[:2])}",
                            level=analysis.risk_level,
                            amount=tx.get("amount"),
                            counterparty=tx.get("transferaddress"),
                            asset=analysis.name or contract_hash[:16],
                            contract_info={
                                "hash": contract_hash,
                                "reasons": analysis.reasons,
                            }
                        ))
        
        return {
            "suspicious": suspicious_contracts,
            "flagged_txs": flagged_txs,
        }
    
    def analyze_contract(self, contract_hash: str) -> ContractAnalysis:
        """
        Analyze a smart contract for suspicious characteristics.
        
        Args:
            contract_hash: Contract script hash (with or without 0x prefix)
            
        Returns:
            ContractAnalysis with risk assessment
        """
        # Normalize hash
        clean_hash = contract_hash.lower().replace("0x", "")
        
        # Check cache
        if clean_hash in self._contract_cache:
            return self._contract_cache[clean_hash]
        
        # Check if it's a known trusted contract
        if clean_hash in self.TRUSTED_CONTRACTS:
            analysis = ContractAnalysis(
                contract_hash=clean_hash,
                is_suspicious=False,
                risk_level=SuspicionLevel.LOW,
                name=self.TRUSTED_CONTRACTS[clean_hash],
                is_verified=True,
            )
            self._contract_cache[clean_hash] = analysis
            return analysis
        
        # Check if it's a known malicious contract
        if clean_hash in self.KNOWN_MALICIOUS_CONTRACTS:
            analysis = ContractAnalysis(
                contract_hash=clean_hash,
                is_suspicious=True,
                risk_level=SuspicionLevel.CRITICAL,
                reasons=["Known malicious contract"],
            )
            self._contract_cache[clean_hash] = analysis
            return analysis
        
        # Fetch contract state from blockchain
        reasons: List[str] = []
        risk_level = SuspicionLevel.LOW
        name = None
        is_verified = False
        update_counter = 0
        manifest_flags: List[str] = []
        
        try:
            contract_state = self.neo_client.get_contract_state(clean_hash)
            
            if contract_state is None:
                # Contract doesn't exist or was destroyed
                reasons.append("Contract not found or destroyed")
                risk_level = SuspicionLevel.HIGH
            else:
                # Extract contract info
                name = contract_state.get("manifest", {}).get("name", "Unknown")
                update_counter = contract_state.get("updatecounter", 0)
                
                # Check contract name for suspicious patterns
                if name:
                    for pattern in self.SUSPICIOUS_NAME_PATTERNS:
                        if re.search(pattern, name):
                            reasons.append(f"Suspicious name pattern: '{name}'")
                            risk_level = max(risk_level, SuspicionLevel.MEDIUM, key=lambda x: x.value)
                            break
                
                # Check update counter (frequently updated contracts may be suspicious)
                if update_counter > 10:
                    reasons.append(f"Frequently updated contract ({update_counter} updates)")
                    risk_level = max(risk_level, SuspicionLevel.MEDIUM, key=lambda x: x.value)
                
                # Analyze manifest for suspicious permissions/features
                manifest = contract_state.get("manifest", {})
                manifest_flags = self._analyze_manifest(manifest, reasons)
                
                # Check for suspicious methods in ABI
                abi = manifest.get("abi", {})
                methods = abi.get("methods", [])
                self._check_suspicious_methods(methods, reasons)
                
                # Check if contract has excessive permissions
                permissions = manifest.get("permissions", [])
                self._check_permissions(permissions, reasons)
                
                # Check contract age (new contracts are riskier)
                self._check_contract_age(contract_state, reasons)
                
        except Exception as e:
            reasons.append(f"Failed to analyze contract: {str(e)}")
            risk_level = SuspicionLevel.MEDIUM
        
        # Determine if suspicious based on reasons
        is_suspicious = len(reasons) > 0
        
        # Upgrade risk level based on number of red flags
        if len(reasons) >= 3:
            risk_level = SuspicionLevel.HIGH
        elif len(reasons) >= 5:
            risk_level = SuspicionLevel.CRITICAL
        
        analysis = ContractAnalysis(
            contract_hash=clean_hash,
            is_suspicious=is_suspicious,
            risk_level=risk_level,
            reasons=reasons,
            name=name,
            is_verified=is_verified,
            update_counter=update_counter,
            manifest_flags=manifest_flags,
        )
        
        # Cache the result
        self._contract_cache[clean_hash] = analysis
        
        return analysis
    
    def _analyze_manifest(
        self, 
        manifest: Dict[str, Any], 
        reasons: List[str]
    ) -> List[str]:
        """Analyze contract manifest for suspicious features."""
        flags: List[str] = []
        
        # Check supported standards
        supported_standards = manifest.get("supportedstandards", [])
        
        # No standards = potentially suspicious
        if not supported_standards:
            flags.append("no_standards")
            reasons.append("Contract declares no supported standards")
        
        # Check trusts - contracts that trust "*" (all) are dangerous
        trusts = manifest.get("trusts", [])
        if "*" in trusts or {"value": "*"} in trusts:
            flags.append("trusts_all")
            reasons.append("Contract trusts all other contracts (dangerous)")
        
        # Check extra data
        extra = manifest.get("extra")
        if extra is None:
            flags.append("no_metadata")
            # Not necessarily suspicious, just note it
        
        return flags
    
    def _check_suspicious_methods(
        self, 
        methods: List[Dict], 
        reasons: List[str]
    ) -> None:
        """Check ABI methods for suspicious names."""
        for method in methods:
            method_name = method.get("name", "").lower()
            
            # Check against known suspicious method names
            for sus_method in self.SUSPICIOUS_METHODS:
                if sus_method.lower() in method_name:
                    reasons.append(f"Suspicious method name: '{method.get('name')}'")
                    break
            
            # Check for hidden/obfuscated method names
            if len(method_name) == 1 or method_name.startswith("_"):
                if method_name not in ["_deploy", "_initialize"]:
                    reasons.append(f"Potentially obfuscated method: '{method.get('name')}'")
    
    def _check_permissions(
        self, 
        permissions: List[Dict], 
        reasons: List[str]
    ) -> None:
        """Check contract permissions for excessive access."""
        for perm in permissions:
            contract = perm.get("contract", "")
            methods = perm.get("methods", [])
            
            # Permission to call any contract with any method
            if contract == "*" and (methods == "*" or "*" in methods):
                reasons.append("Contract has unrestricted call permissions (can call any contract)")
    
    def _check_contract_age(
        self, 
        contract_state: Dict[str, Any], 
        reasons: List[str]
    ) -> None:
        """Check if contract is newly deployed (higher risk)."""
        try:
            # Get current block height
            current_block = self.neo_client.get_block_count()
            
            # NEF checksum or ID can sometimes indicate deployment info
            # For now, we'll use update counter as a proxy
            # A contract with 0 updates that's unknown is likely new
            update_counter = contract_state.get("updatecounter", 0)
            
            if update_counter == 0:
                # This is a brand new, never-updated contract
                # Higher risk if not in trusted list
                reasons.append("Newly deployed contract with no update history")
                
        except Exception:
            pass  # Skip age check on error

    def _check_suspicious_contracts(
        self,
        transfers: List[Dict]
    ) -> List[SuspiciousTransaction]:
        """
        Check transfers for interactions with suspicious smart contracts.
        
        Args:
            transfers: List of transfer records
            
        Returns:
            List of flagged suspicious transactions
        """
        suspicious = []
        checked_contracts: Set[str] = set()
        
        for tx in transfers:
            contract_hash = tx.get("assethash", "")
            if not contract_hash or contract_hash in checked_contracts:
                continue
                
            checked_contracts.add(contract_hash)
            clean_hash = contract_hash.lower().replace("0x", "")
            
            # Skip known trusted contracts
            if clean_hash in self.TRUSTED_CONTRACTS:
                continue
            
            # Analyze the contract
            analysis = self.analyze_contract(clean_hash)
            
            if analysis.is_suspicious:
                suspicious.append(SuspiciousTransaction(
                    tx_hash=tx.get("txhash", "unknown"),
                    timestamp=tx.get("timestamp", 0),
                    reason=f"Interaction with suspicious contract: {', '.join(analysis.reasons[:3])}",
                    level=analysis.risk_level,
                    counterparty=tx.get("transferaddress"),
                    asset=analysis.name or contract_hash[:16],
                    contract_info={
                        "hash": clean_hash,
                        "reasons": analysis.reasons,
                        "risk_level": analysis.risk_level.value,
                    }
                ))
        
        return suspicious

    def _check_honeypot_patterns(
        self,
        transfers: List[Dict],
        address: str
    ) -> List[SuspiciousTransaction]:
        """
        Detect potential honeypot/rug-pull patterns.
        
        Patterns:
        - One-way token flows (can receive but not send)
        - Sudden large liquidity removals
        - Tokens with suspicious transfer restrictions
        
        Args:
            transfers: List of transfer records
            address: The wallet address being inspected
            
        Returns:
            List of flagged suspicious transactions
        """
        suspicious = []
        
        # Group transfers by asset
        asset_flows: Dict[str, Dict[str, int]] = {}  # asset -> {received, sent}
        
        for tx in transfers:
            asset = tx.get("assethash", "unknown")
            if asset not in asset_flows:
                asset_flows[asset] = {"received": 0, "sent": 0}
            
            try:
                amount = int(tx.get("amount", "0"))
                transfer_addr = tx.get("transferaddress", "")
                
                # Determine if this is incoming or outgoing
                if transfer_addr and transfer_addr != address:
                    # This is a transfer TO us (incoming)
                    asset_flows[asset]["received"] += amount
                else:
                    # This is a transfer FROM us (outgoing)
                    asset_flows[asset]["sent"] += amount
            except (ValueError, TypeError):
                continue
        
        # Check for suspicious patterns
        for asset, flows in asset_flows.items():
            clean_hash = asset.lower().replace("0x", "")
            
            # Skip well-known assets
            if clean_hash in self.TRUSTED_CONTRACTS:
                continue
            
            received = flows["received"]
            sent = flows["sent"]
            
            # Pattern 1: Received tokens but unable to send any
            if received > 0 and sent == 0:
                # Check if contract has suspicious transfer restrictions
                analysis = self.analyze_contract(clean_hash)
                
                if analysis.is_suspicious:
                    suspicious.append(SuspiciousTransaction(
                        tx_hash="pattern_detection",
                        timestamp=int(time.time()),
                        reason=f"Potential honeypot: Received {received} tokens of asset {clean_hash[:16]} but no outgoing transfers detected",
                        level=SuspicionLevel.MEDIUM,
                        asset=analysis.name or clean_hash[:16],
                        contract_info={
                            "hash": clean_hash,
                            "pattern": "one_way_flow",
                            "received": received,
                            "sent": sent,
                        }
                    ))
        
        return suspicious

    def _identify_contract_type(
        self,
        contract_hash: str
    ) -> str:
        """
        Identify the type of smart contract.
        
        Args:
            contract_hash: Contract script hash
            
        Returns:
            Contract type string: 'token', 'nft', 'defi', 'nns', 'unknown'
        """
        clean_hash = contract_hash.lower().replace("0x", "")
        
        # Check known contracts first
        if clean_hash in self.TRUSTED_CONTRACTS:
            name = self.TRUSTED_CONTRACTS[clean_hash].lower()
            if "neo" in name or "gas" in name or "flm" in name or "ftw" in name:
                return "token"
            if "nns" in name:
                return "nns"
            if "burger" in name or "bneo" in name or "flamingo" in name:
                return "defi"
        
        # Try to identify by analyzing the contract
        try:
            contract_state = self.neo_client.get_contract_state(clean_hash)
            
            if contract_state:
                manifest = contract_state.get("manifest", {})
                supported_standards = manifest.get("supportedstandards", [])
                
                # NEP-17 is fungible token
                if "NEP-17" in supported_standards:
                    return "token"
                
                # NEP-11 is NFT
                if "NEP-11" in supported_standards:
                    return "nft"
                
                # Check methods for DeFi patterns
                abi = manifest.get("abi", {})
                methods = [m.get("name", "").lower() for m in abi.get("methods", [])]
                
                defi_indicators = ["swap", "stake", "unstake", "deposit", "withdraw", 
                                   "addliquidity", "removeliquidity", "claim", "harvest"]
                if any(ind in method for method in methods for ind in defi_indicators):
                    return "defi"
                
                # Check for NNS patterns
                nns_indicators = ["register", "setrecord", "resolve", "getrecords"]
                if any(ind in method for method in methods for ind in nns_indicators):
                    return "nns"
                    
        except Exception:
            pass
        
        return "unknown"

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
        for known_hash, name in self.TRUSTED_CONTRACTS.items():
            if known_hash.replace("0x", "") == asset_hash_lower:
                return name
        return get_token_name(asset_hash)
    
    def _calculate_risk_score(self, suspicious_txs: List[SuspiciousTransaction]) -> int:
        """Calculate overall risk score (0-100) based on suspicious transactions.
        
        Uses suspicion scoring: 0 = clean, 100 = worst.
        """
        # Convert SuspiciousTransaction objects to dicts for shared function
        items = [{"level": tx.level} for tx in suspicious_txs]
        return compute_suspicion_score(items, "level")
    
    def _get_risk_level(self, score: int) -> str:
        """Convert suspicion score to human-readable level."""
        return get_risk_level_from_suspicion_score(score)
    
    def _generate_summary(
        self, 
        suspicious_txs: List[SuspiciousTransaction], 
        risk_score: int,
        suspicious_contracts: Optional[List[Dict[str, Any]]] = None
    ) -> str:
        """Generate a human-readable summary of the inspection."""
        if not suspicious_txs and not suspicious_contracts:
            return "No suspicious activity detected. Wallet appears clean."
        
        critical = sum(1 for tx in suspicious_txs if tx.level == RiskLevel.CRITICAL)
        high = sum(1 for tx in suspicious_txs if tx.level == RiskLevel.HIGH)
        medium = sum(1 for tx in suspicious_txs if tx.level == RiskLevel.MEDIUM)
        low = sum(1 for tx in suspicious_txs if tx.level == RiskLevel.LOW)
        
        parts = []
        if critical:
            parts.append(f"{critical} critical")
        if high:
            parts.append(f"{high} high")
        if medium:
            parts.append(f"{medium} medium")
        if low:
            parts.append(f"{low} low")
        
        summary = f"Found {len(suspicious_txs)} suspicious indicators"
        if parts:
            summary += f" ({', '.join(parts)} severity)"
        if suspicious_contracts:
            summary += f" and {len(suspicious_contracts)} suspicious contracts"
        summary += f". Risk score: {risk_score}/100."
        
        return summary


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
