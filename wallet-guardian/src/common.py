"""
Common utilities, enums, and functions shared across Wallet Guardian modules.

This module provides a single source of truth for:
- Severity/Risk level enums
- Risk score calculation and level determination
- Shared constants and configurations
"""

from enum import Enum
from typing import Any, Dict, List, Tuple


# =============================================================================
# UNIFIED SEVERITY/RISK ENUMS
# =============================================================================

class RiskLevel(Enum):
    """
    Unified risk/severity level enum used across all modules.
    
    Used for:
    - Transaction suspicion levels
    - Contract risk levels  
    - Alert severities
    - Voice alert priorities
    """
    CLEAN = "clean"       # No issues detected
    LOW = "low"           # Minor concerns
    MEDIUM = "medium"     # Moderate risk
    HIGH = "high"         # Significant risk
    CRITICAL = "critical" # Severe risk - immediate attention needed

    @classmethod
    def from_score(cls, score: int, score_type: str = "trust") -> 'RiskLevel':
        """
        Convert a numeric score to a RiskLevel.
        
        Args:
            score: Numeric score (0-100)
            score_type: Either "trust" (higher=better) or "suspicion" (higher=worse)
            
        Returns:
            Corresponding RiskLevel
        """
        if score_type == "trust":
            # Trust score: 100 = perfect, 0 = worst
            if score >= 90:
                return cls.CLEAN
            elif score >= 70:
                return cls.LOW
            elif score >= 50:
                return cls.MEDIUM
            elif score >= 30:
                return cls.HIGH
            else:
                return cls.CRITICAL
        else:
            # Suspicion score: 0 = clean, 100 = worst
            if score == 0:
                return cls.CLEAN
            elif score < 20:
                return cls.LOW
            elif score < 50:
                return cls.MEDIUM
            elif score < 80:
                return cls.HIGH
            else:
                return cls.CRITICAL


# =============================================================================
# RISK SCORE CALCULATION
# =============================================================================

def compute_trust_score(
    concentration: float,
    stablecoin_ratio: float,
    counterparty_count: int,
    suspicious_patterns: List[Dict]
) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Compute a trust score (100 = perfect, 0 = worst).
    
    This is the canonical risk scoring function used throughout the system.
    
    Args:
        concentration: Portfolio concentration (0-1, lower is better)
        stablecoin_ratio: Ratio of stablecoins (0-1)
        counterparty_count: Number of unique counterparties
        suspicious_patterns: List of detected suspicious patterns
        
    Returns:
        Tuple of (score, list of deductions with reasons)
    """
    score = 100
    deductions = []
    
    # Concentration penalty (high concentration = higher risk)
    if concentration > 0.8:
        penalty = 20
        deductions.append({"reason": "high_concentration", "penalty": penalty})
        score -= penalty
    elif concentration > 0.6:
        penalty = 10
        deductions.append({"reason": "moderate_concentration", "penalty": penalty})
        score -= penalty
    
    # Stablecoin buffer check
    if stablecoin_ratio < 0.05:
        penalty = 10
        deductions.append({"reason": "very_low_stablecoin_buffer", "penalty": penalty})
        score -= penalty
    elif stablecoin_ratio < 0.1:
        penalty = 5
        deductions.append({"reason": "low_stablecoin_buffer", "penalty": penalty})
        score -= penalty
    
    # Activity/diversity check
    if counterparty_count == 0:
        penalty = 10
        deductions.append({"reason": "inactive_or_new_wallet", "penalty": penalty})
        score -= penalty
    elif counterparty_count < 3:
        penalty = 5
        deductions.append({"reason": "low_counterparty_diversity", "penalty": penalty})
        score -= penalty
    
    # Suspicious patterns penalties
    for pattern in suspicious_patterns:
        level = pattern.get("level", "low")
        if level == "critical":
            penalty = 30
        elif level == "high":
            penalty = 20
        elif level == "medium":
            penalty = 10
        else:
            penalty = 5
        deductions.append({
            "reason": pattern.get("type", "suspicious_pattern"),
            "penalty": penalty,
            "detail": pattern
        })
        score -= penalty
    
    return max(0, min(100, score)), deductions


def compute_suspicion_score(suspicious_items: List[Dict], level_key: str = "level") -> int:
    """
    Compute a suspicion score (0 = clean, 100 = worst).
    
    This is the inverse of trust score - used when counting up risk factors.
    
    Args:
        suspicious_items: List of suspicious items with severity levels
        level_key: Key in dict that contains the RiskLevel or level string
        
    Returns:
        Score from 0 to 100
    """
    if not suspicious_items:
        return 0
    
    score = 0
    level_weights = {
        "low": 5,
        "medium": 15,
        "high": 30,
        "critical": 50,
        RiskLevel.LOW: 5,
        RiskLevel.MEDIUM: 15,
        RiskLevel.HIGH: 30,
        RiskLevel.CRITICAL: 50,
    }
    
    for item in suspicious_items:
        level = item.get(level_key, "low")
        # Handle both string and enum levels
        if hasattr(level, 'value'):
            level = level.value
        score += level_weights.get(level, 5)
    
    return min(score, 100)


def get_risk_level_from_trust_score(score: int) -> str:
    """Convert trust score to human-readable risk level string."""
    return RiskLevel.from_score(score, "trust").value


def get_risk_level_from_suspicion_score(score: int) -> str:
    """Convert suspicion score to human-readable risk level string."""
    return RiskLevel.from_score(score, "suspicion").value


# =============================================================================
# KNOWN CONTRACTS AND ADDRESSES
# =============================================================================

# Known legitimate/trusted Neo N3 contracts
TRUSTED_CONTRACTS: Dict[str, str] = {
    "ef4073a0f2b305a38ec4050e4d3d28bc40ea63f5": "NEO",
    "d2a4cff31913016155e38e474a2c06d08be276cf": "GAS",
    "f0151f528127276b9301cb43c386fa343e41a20a": "FLM (Flamingo)",
    "48c40d4666f93408be1bef038b6722404d9a4c2a": "NNS",
    "1a4e258bd51d16e8f699870cc40e3f7f8cb8f2c7": "fUSDT (Flamingo)",
    "9b049f1283515eef1d3f6ac610e1595ed25ca3e9": "NeoBurger",
    "f46719e2d16bf50cddcef9d4bbfece901f73cbb6": "bNEO",
    "cd48b160c1bbc9d74997b803b9a7ad50a4bef020": "Forthewin (FTW)",
    "1005fc3fa9c8e7cc28f02e7f43fe96de2d6832ed": "NeoCompiler Eco",
}

# Known scam/malicious addresses (regularly updated)
KNOWN_SCAM_ADDRESSES = set()

# Known malicious contract hashes
KNOWN_MALICIOUS_CONTRACTS = set()


# =============================================================================
# SHARED CONSTANTS
# =============================================================================

# Detection thresholds
RAPID_TX_WINDOW_SECONDS = 300  # 5 minutes
RAPID_TX_THRESHOLD = 10
LARGE_TRANSFER_THRESHOLD_GAS = 1000
DUST_AMOUNT_THRESHOLD = 0.0001
NEW_CONTRACT_BLOCKS = 50000  # ~7 days on Neo N3

# Cache TTL defaults
DEFAULT_CACHE_TTL = 60  # 60 seconds


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def normalize_contract_hash(hash_str: str) -> str:
    """Normalize a contract hash to lowercase without 0x prefix."""
    return hash_str.lower().replace("0x", "")


def get_token_name(asset_hash: str) -> str:
    """Get human-readable token name from asset hash."""
    normalized = normalize_contract_hash(asset_hash)
    if normalized in TRUSTED_CONTRACTS:
        return TRUSTED_CONTRACTS[normalized]
    return asset_hash[:16] + "..." if len(asset_hash) > 16 else asset_hash
