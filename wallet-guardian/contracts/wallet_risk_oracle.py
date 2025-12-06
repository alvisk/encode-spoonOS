"""
Wallet Risk Oracle Smart Contract for Neo N3

Uses Neo's Oracle service to fetch wallet risk scores from external APIs.
"""

from boa3.sc.compiletime import public
from boa3.sc.contracts import OracleContract
from boa3.sc.runtime import check_witness, notify, script_container, calling_script_hash
from boa3.sc.storage import get_int, get_str, get_uint160, put_int, put_str, put_uint160
from boa3.sc.types import UInt160
from boa3.sc.utils import to_bytes, to_str
from boa3.builtin.interop.blockchain import current_index
from typing import Any


# Storage Keys
OWNER_KEY = b'owner'
RISK_SCORE_PREFIX = b'risk_'
LAST_UPDATE_PREFIX = b'update_'
API_URL_KEY = b'api_url'
TOTAL_REQUESTS_KEY = b'total_requests'

DEFAULT_API_URL = "https://wallet-guardian.example.com/api/v2/analyze/"
GAS_FOR_RESPONSE = 100000000  # 1 GAS


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
        put_int(TOTAL_REQUESTS_KEY, 0)


def _is_owner() -> bool:
    """Check if caller is the contract owner."""
    owner = get_uint160(OWNER_KEY)
    return check_witness(owner)


def _get_risk_level(score: int) -> str:
    """Convert score to risk level."""
    if score >= 80:
        return "LOW"
    if score >= 60:
        return "MEDIUM"
    if score >= 40:
        return "HIGH"
    return "CRITICAL"


def _parse_int(s: str) -> int:
    """Parse a string to integer without using ord()."""
    result = 0
    for c in s:
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
    return result


# =============================================================================
# Admin Functions
# =============================================================================

@public
def set_api_url(new_url: str) -> bool:
    """Update the API URL (owner only)."""
    if not _is_owner():
        return False
    put_str(API_URL_KEY, new_url)
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


# =============================================================================
# Oracle Functions
# =============================================================================

@public
def request_risk_score(address: str) -> bool:
    """Request a risk score via Oracle."""
    base_url = get_api_url()
    url = base_url + address
    filter_path = "$.score"
    user_data = to_bytes(address)
    
    OracleContract.request(url, filter_path, 'oracle_callback', user_data, GAS_FOR_RESPONSE)
    
    total = get_int(TOTAL_REQUESTS_KEY)
    put_int(TOTAL_REQUESTS_KEY, total + 1)
    
    notify(['OracleRequest', address, url])
    return True


@public
def oracle_callback(url: str, user_data: bytes, code: int, result: bytes):
    """Callback from Oracle nodes."""
    # Verify caller is Oracle
    if calling_script_hash != OracleContract.hash:
        raise Exception("Unauthorized")
    
    address = to_str(user_data)
    
    if code != 0:
        notify(['OracleError', address, code])
        return
    
    # Parse score - default to 50
    score = 50
    if len(result) > 0:
        score_str = to_str(result)
        if len(score_str) > 0:
            temp_score = _parse_int(score_str)
            if temp_score > 0:
                score = temp_score
    
    if score > 100:
        score = 100
    
    # Store score
    score_key = RISK_SCORE_PREFIX + to_bytes(address)
    put_int(score_key, score)

    # Store update block
    update_key = LAST_UPDATE_PREFIX + to_bytes(address)
    put_int(update_key, current_index)
    
    # Emit event
    risk_level = _get_risk_level(score)
    notify(['RiskScoreUpdated', address, score, risk_level])


# =============================================================================
# Query Functions
# =============================================================================

@public
def get_risk_score(address: str) -> int:
    """Get stored risk score. Returns -1 if not set."""
    score_key = RISK_SCORE_PREFIX + to_bytes(address)
    update_key = LAST_UPDATE_PREFIX + to_bytes(address)
    
    update = get_int(update_key)
    if update == 0:
        return -1
    
    return get_int(score_key)


@public
def get_last_update(address: str) -> int:
    """Get block when score was last updated."""
    update_key = LAST_UPDATE_PREFIX + to_bytes(address)
    return get_int(update_key)


@public
def is_risky(address: str, threshold: int) -> bool:
    """Check if address is risky (score < threshold)."""
    score = get_risk_score(address)
    if score < 0:
        return True
    return score < threshold


@public
def get_total_requests() -> int:
    """Get total Oracle requests made."""
    return get_int(TOTAL_REQUESTS_KEY)


# =============================================================================
# Manual Score Update (Admin)
# =============================================================================

@public
def set_risk_score_manual(address: str, score: int) -> bool:
    """Manually set a risk score (owner only)."""
    if not _is_owner():
        return False
    
    if score < 0 or score > 100:
        return False
    
    score_key = RISK_SCORE_PREFIX + to_bytes(address)
    put_int(score_key, score)
    
    update_key = LAST_UPDATE_PREFIX + to_bytes(address)
    put_int(update_key, current_index)
    
    risk_level = _get_risk_level(score)
    notify(['RiskScoreUpdated', address, score, risk_level])
    
    return True


@public
def verify() -> bool:
    """Verify the caller is the owner."""
    return _is_owner()
