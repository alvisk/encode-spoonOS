"""
Malicious Contract Oracle Smart Contract for Neo N3

Uses Neo's Oracle service to fetch malicious contract analysis from
an external API and store the results on-chain.

This contract allows Neo smart contracts and users to query whether
an Ethereum contract is malicious before interacting with cross-chain
bridges or wrapped assets.

Storage Format (per contract address):
- risk score (0-100, higher = more risky)
- is_malicious flag (boolean)
- top 3 detected issues (pipe-separated string)
- summary explanation (max 200 chars)
- last update block

Oracle Response Format (compact):
SCORE:85|MAL:true|LEVEL:CRITICAL|I1:reentrancy|I2:rug_pull|I3:honeypot|SUM:Contract has reentrancy vulnerability...
"""

from boa3.sc.compiletime import public
from boa3.sc.contracts import OracleContract
from boa3.sc.runtime import check_witness, notify, script_container, calling_script_hash
from boa3.sc.storage import get_int, get_str, get_uint160, put_int, put_str, put_uint160
from boa3.sc.types import UInt160
from boa3.sc.utils import to_bytes, to_str
from boa3.builtin.interop.blockchain import current_index
from typing import Any


# =============================================================================
# Storage Keys
# =============================================================================

OWNER_KEY = b'owner'
API_URL_KEY = b'api_url'
TOTAL_SCANS_KEY = b'total_scans'

# Per-contract storage prefixes
RISK_SCORE_PREFIX = b'score_'      # score_{address} -> int (0-100)
IS_MALICIOUS_PREFIX = b'mal_'      # mal_{address} -> int (0 or 1)
ISSUES_PREFIX = b'issues_'         # issues_{address} -> str (pipe-separated)
SUMMARY_PREFIX = b'sum_'           # sum_{address} -> str (max 200 chars)
RISK_LEVEL_PREFIX = b'level_'      # level_{address} -> str (SAFE/LOW/MEDIUM/HIGH/CRITICAL)
LAST_UPDATE_PREFIX = b'update_'    # update_{address} -> int (block number)

# Default API URL for Ethereum Sepolia testnet scans
# The chain=sepolia parameter ensures we scan on the testnet
DEFAULT_API_URL = "https://wallet-guardian.example.com/api/v2/contract-scan/"

# Note: The actual API URL should be set after deployment using set_api_url()
# Example URL with testnet: https://your-server.com/api/v2/contract-scan/
# The contract appends: {address}?format=oracle&chain=sepolia

# GAS for Oracle response (0.5 GAS)
GAS_FOR_RESPONSE = 50000000


# =============================================================================
# Contract Deployment
# =============================================================================

@public
def _deploy(data: Any, update: bool):
    """Called when contract is deployed."""
    if not update:
        tx = script_container
        owner: UInt160 = tx.sender
        put_uint160(OWNER_KEY, owner)
        put_str(API_URL_KEY, DEFAULT_API_URL)
        put_int(TOTAL_SCANS_KEY, 0)


def _is_owner() -> bool:
    """Check if caller is the contract owner."""
    owner = get_uint160(OWNER_KEY)
    return check_witness(owner)


# =============================================================================
# String Parsing Helpers
# =============================================================================

def _parse_int(s: str) -> int:
    """Parse a string to integer."""
    result = 0
    negative = False
    start = 0
    
    if len(s) > 0 and s[0] == '-':
        negative = True
        start = 1
    
    for i in range(start, len(s)):
        c = s[i]
        if c == '0':
            result = result * 10 + 0
        elif c == '1':
            result = result * 10 + 1
        elif c == '2':
            result = result * 10 + 2
        elif c == '3':
            result = result * 10 + 3
        elif c == '4':
            result = result * 10 + 4
        elif c == '5':
            result = result * 10 + 5
        elif c == '6':
            result = result * 10 + 6
        elif c == '7':
            result = result * 10 + 7
        elif c == '8':
            result = result * 10 + 8
        elif c == '9':
            result = result * 10 + 9
        else:
            break  # Stop at non-digit
    
    if negative:
        result = -result
    
    return result


def _parse_bool(s: str) -> bool:
    """Parse a string to boolean."""
    return s == "true" or s == "True" or s == "1"


def _get_value_after_colon(part: str) -> str:
    """Extract value after colon in 'KEY:VALUE' format."""
    colon_pos = -1
    for i in range(len(part)):
        if part[i] == ':':
            colon_pos = i
            break
    
    if colon_pos >= 0 and colon_pos < len(part) - 1:
        return part[colon_pos + 1:]
    return ""


def _parse_score(response: str) -> int:
    """Extract score from Oracle response."""
    parts = response.split("|")
    for part in parts:
        if part.startswith("SCORE:"):
            return _parse_int(_get_value_after_colon(part))
    return 50


def _parse_is_malicious(response: str) -> bool:
    """Extract is_malicious from Oracle response."""
    parts = response.split("|")
    for part in parts:
        if part.startswith("MAL:"):
            return _parse_bool(_get_value_after_colon(part))
    return False


def _parse_level(response: str) -> str:
    """Extract risk level from Oracle response."""
    parts = response.split("|")
    for part in parts:
        if part.startswith("LEVEL:"):
            return _get_value_after_colon(part)
    return "UNKNOWN"


def _parse_issues(response: str) -> str:
    """Extract issues from Oracle response."""
    parts = response.split("|")
    issues_list: list[str] = []
    
    for part in parts:
        if part.startswith("I1:") or part.startswith("I2:") or part.startswith("I3:"):
            issues_list.append(_get_value_after_colon(part))
    
    # Join issues with pipe (manual join since str.join not supported)
    if len(issues_list) > 0:
        issues_str = ""
        for i in range(len(issues_list)):
            if i > 0:
                issues_str = issues_str + "|"
            issues_str = issues_str + issues_list[i]
        return issues_str
    return ""


def _parse_summary(response: str) -> str:
    """Extract summary from Oracle response."""
    parts = response.split("|")
    for part in parts:
        if part.startswith("SUM:"):
            return _get_value_after_colon(part)
    return ""


# =============================================================================
# Admin Functions
# =============================================================================

@public
def set_api_url(new_url: str) -> bool:
    """Update the API URL (owner only)."""
    if not _is_owner():
        return False
    put_str(API_URL_KEY, new_url)
    notify(['APIURLUpdated', new_url])
    return True


@public
def get_api_url() -> str:
    """Get the current API URL."""
    url = get_str(API_URL_KEY)
    if len(url) == 0:
        return DEFAULT_API_URL
    return url


@public
def get_owner() -> UInt160:
    """Get the contract owner."""
    return get_uint160(OWNER_KEY)


@public
def get_total_scans() -> int:
    """Get total number of contract scans requested."""
    return get_int(TOTAL_SCANS_KEY)


# =============================================================================
# Oracle Functions
# =============================================================================

@public
def request_contract_scan(contract_address: str) -> bool:
    """
    Request malicious contract analysis via Oracle.
    
    The Oracle will call the external API and return the analysis results.
    Results are stored on-chain for future queries.
    
    Scans on Ethereum Sepolia testnet by default.
    
    Args:
        contract_address: Ethereum contract address (0x...)
        
    Returns:
        True if request was submitted successfully
    """
    # Build URL: baseurl + address + ?format=oracle&chain=sepolia
    # Uses Sepolia testnet for testnet compatibility
    base_url = get_api_url()
    url = base_url + contract_address + "?format=oracle&chain=sepolia"
    
    # Filter path to extract the oracle_response field from JSON
    filter_path = "$.oracle_response"
    
    # Store contract address in user_data for callback
    user_data = to_bytes(contract_address)
    
    # Submit Oracle request
    OracleContract.request(url, filter_path, 'oracle_callback', user_data, GAS_FOR_RESPONSE)
    
    # Increment total scans
    total = get_int(TOTAL_SCANS_KEY)
    put_int(TOTAL_SCANS_KEY, total + 1)
    
    notify(['ContractScanRequested', contract_address, url])
    return True


@public
def oracle_callback(url: str, user_data: bytes, code: int, result: bytes):
    """
    Callback from Oracle nodes with analysis results.
    
    Parses the compact format and stores results on-chain.
    """
    # Verify caller is Oracle
    if calling_script_hash != OracleContract.hash:
        raise Exception("Unauthorized: Only Oracle can call this")
    
    contract_address = to_str(user_data)
    
    # Handle Oracle errors
    if code != 0:
        notify(['OracleError', contract_address, code])
        return
    
    # Parse the response
    response_str = to_str(result)
    if len(response_str) == 0:
        notify(['OracleEmptyResponse', contract_address])
        return
    
    # Parse the compact format - extract each field individually
    score = _parse_score(response_str)
    is_mal = _parse_is_malicious(response_str)
    level = _parse_level(response_str)
    issues = _parse_issues(response_str)
    summary = _parse_summary(response_str)
    
    # Store results
    score_key = RISK_SCORE_PREFIX + to_bytes(contract_address)
    put_int(score_key, score)
    
    mal_key = IS_MALICIOUS_PREFIX + to_bytes(contract_address)
    put_int(mal_key, 1 if is_mal else 0)
    
    level_key = RISK_LEVEL_PREFIX + to_bytes(contract_address)
    put_str(level_key, level)
    
    issues_key = ISSUES_PREFIX + to_bytes(contract_address)
    put_str(issues_key, issues)
    
    # Truncate summary to 200 chars
    if len(summary) > 200:
        summary = summary[:197] + "..."
    summary_key = SUMMARY_PREFIX + to_bytes(contract_address)
    put_str(summary_key, summary)
    
    # Store update block
    update_key = LAST_UPDATE_PREFIX + to_bytes(contract_address)
    put_int(update_key, current_index)
    
    # Emit event
    notify([
        'ContractScanComplete',
        contract_address,
        score,
        is_mal,
        level
    ])


# =============================================================================
# Query Functions
# =============================================================================

@public
def get_risk_score(contract_address: str) -> int:
    """
    Get the cached risk score for a contract.
    
    Returns:
        Risk score 0-100 (100 = highest risk), or -1 if not scanned yet
    """
    update_key = LAST_UPDATE_PREFIX + to_bytes(contract_address)
    if get_int(update_key) == 0:
        return -1  # Not scanned yet
    
    score_key = RISK_SCORE_PREFIX + to_bytes(contract_address)
    return get_int(score_key)


@public
def is_malicious(contract_address: str) -> bool:
    """
    Quick check if a contract is flagged as malicious.
    
    Returns:
        True if malicious, False if not scanned or not malicious
    """
    mal_key = IS_MALICIOUS_PREFIX + to_bytes(contract_address)
    return get_int(mal_key) == 1


@public
def get_risk_level(contract_address: str) -> str:
    """
    Get the risk level classification.
    
    Returns:
        "SAFE", "LOW", "MEDIUM", "HIGH", "CRITICAL", or "UNKNOWN"
    """
    update_key = LAST_UPDATE_PREFIX + to_bytes(contract_address)
    if get_int(update_key) == 0:
        return "UNKNOWN"
    
    level_key = RISK_LEVEL_PREFIX + to_bytes(contract_address)
    level = get_str(level_key)
    if len(level) == 0:
        return "UNKNOWN"
    return level


@public
def get_issues(contract_address: str) -> str:
    """
    Get detected malicious patterns (pipe-separated).
    
    Returns:
        String like "reentrancy|rug_pull|honeypot" or empty string
    """
    issues_key = ISSUES_PREFIX + to_bytes(contract_address)
    return get_str(issues_key)


@public
def get_summary(contract_address: str) -> str:
    """
    Get human-readable summary of why contract is dangerous.
    
    Returns:
        Summary string (max 200 chars) or empty string
    """
    summary_key = SUMMARY_PREFIX + to_bytes(contract_address)
    return get_str(summary_key)


@public
def get_last_update(contract_address: str) -> int:
    """
    Get block number when contract was last scanned.
    
    Returns:
        Block number or 0 if never scanned
    """
    update_key = LAST_UPDATE_PREFIX + to_bytes(contract_address)
    return get_int(update_key)


@public
def get_full_analysis(contract_address: str) -> dict:
    """
    Get complete analysis for a contract.
    
    Returns:
        Dict with all stored analysis data
    """
    update_key = LAST_UPDATE_PREFIX + to_bytes(contract_address)
    last_update = get_int(update_key)
    
    if last_update == 0:
        return {
            "contract_address": contract_address,
            "scanned": False,
            "message": "Contract has not been scanned yet. Call request_contract_scan() first."
        }
    
    return {
        "contract_address": contract_address,
        "scanned": True,
        "risk_score": get_risk_score(contract_address),
        "is_malicious": is_malicious(contract_address),
        "risk_level": get_risk_level(contract_address),
        "issues": get_issues(contract_address),
        "summary": get_summary(contract_address),
        "last_update_block": last_update,
    }


# =============================================================================
# Risk Check Function (for other contracts to use)
# =============================================================================

@public
def is_safe_to_interact(contract_address: str, max_risk_score: int) -> bool:
    """
    Check if it's safe to interact with a contract based on risk threshold.
    
    Useful for other Neo contracts to gate cross-chain interactions.
    
    Args:
        contract_address: Ethereum contract address
        max_risk_score: Maximum acceptable risk score (0-100)
        
    Returns:
        True if safe (score below threshold or not scanned), False if risky
    """
    score = get_risk_score(contract_address)
    
    # If not scanned, return True but caller should request scan first
    if score < 0:
        return True
    
    return score <= max_risk_score


# =============================================================================
# Manual Override (Admin)
# =============================================================================

@public
def set_contract_risk_manual(
    contract_address: str,
    risk_score: int,
    is_mal: bool,
    risk_level: str,
    issues: str,
    summary: str
) -> bool:
    """
    Manually set risk data for a contract (owner only).
    
    Useful for known scams not yet in the API database.
    """
    if not _is_owner():
        return False
    
    if risk_score < 0 or risk_score > 100:
        return False
    
    # Store all values
    score_key = RISK_SCORE_PREFIX + to_bytes(contract_address)
    put_int(score_key, risk_score)
    
    mal_key = IS_MALICIOUS_PREFIX + to_bytes(contract_address)
    put_int(mal_key, 1 if is_mal else 0)
    
    level_key = RISK_LEVEL_PREFIX + to_bytes(contract_address)
    put_str(level_key, risk_level)
    
    issues_key = ISSUES_PREFIX + to_bytes(contract_address)
    put_str(issues_key, issues)
    
    # Truncate summary
    if len(summary) > 200:
        summary = summary[:197] + "..."
    summary_key = SUMMARY_PREFIX + to_bytes(contract_address)
    put_str(summary_key, summary)
    
    # Store update block
    update_key = LAST_UPDATE_PREFIX + to_bytes(contract_address)
    put_int(update_key, current_index)
    
    notify(['ManualRiskSet', contract_address, risk_score, is_mal, risk_level])
    return True


@public
def verify() -> bool:
    """Verify the caller is the owner."""
    return _is_owner()
