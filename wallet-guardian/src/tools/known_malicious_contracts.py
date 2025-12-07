"""
Known Malicious Contracts Database

This module contains:
1. Known malicious contract addresses on Ethereum mainnet
2. Pattern definitions for detecting malicious code
3. Human-readable explanations for each vulnerability type
4. Risk scoring weights
"""

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Optional, Set
import re


class VulnerabilityCategory(Enum):
    """Categories of smart contract vulnerabilities."""
    HONEYPOT = "honeypot"
    RUG_PULL = "rug_pull"
    FEE_MANIPULATION = "fee_manipulation"
    REENTRANCY = "reentrancy"
    ACCESS_CONTROL = "access_control"
    PROXY_RISK = "proxy_risk"
    SELF_DESTRUCT = "self_destruct"
    EXTERNAL_CALL_RISK = "external_call_risk"


class Severity(Enum):
    """Severity levels for detected issues."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"
    INFO = "INFO"


@dataclass
class KnownMaliciousContract:
    """Information about a known malicious contract."""
    address: str
    name: str
    category: VulnerabilityCategory
    exploit_date: Optional[str]
    description: str
    amount_stolen: Optional[str]
    is_historical: bool = True


@dataclass
class MaliciousPattern:
    """Definition of a malicious code pattern."""
    name: str
    category: VulnerabilityCategory
    severity: Severity
    regex_patterns: List[str]
    explanation_template: str
    recommendation: str


# =============================================================================
# KNOWN MALICIOUS CONTRACTS (Ethereum Mainnet)
# =============================================================================

KNOWN_MALICIOUS_CONTRACTS: Dict[str, KnownMaliciousContract] = {
    # The DAO - Famous reentrancy attack (2016)
    "0xbb9bc244d798123fde783fcc1c72d3bb8c189413": KnownMaliciousContract(
        address="0xbb9bc244d798123fde783fcc1c72d3bb8c189413",
        name="The DAO",
        category=VulnerabilityCategory.REENTRANCY,
        exploit_date="2016-06-17",
        description="The DAO was exploited via a reentrancy vulnerability in the splitDAO function. "
                    "The attacker recursively called the withdraw function before balance updates, "
                    "draining 3.6 million ETH (~$60M at the time).",
        amount_stolen="$60M (3.6M ETH)",
        is_historical=True,
    ),
    
    # The DAO Attacker Contract
    "0xc0ee9db1a9e07ca63e4ff0d5fb6f86bf68d47b89": KnownMaliciousContract(
        address="0xc0ee9db1a9e07ca63e4ff0d5fb6f86bf68d47b89",
        name="The DAO Attacker",
        category=VulnerabilityCategory.REENTRANCY,
        exploit_date="2016-06-17",
        description="This contract was used to exploit The DAO's reentrancy vulnerability.",
        amount_stolen="$60M",
        is_historical=True,
    ),
    
    # Fei Protocol Attacker (2022)
    "0x32075bad9050d4767018084f0cb87b3182d36c45": KnownMaliciousContract(
        address="0x32075bad9050d4767018084f0cb87b3182d36c45",
        name="Fei Protocol Attacker",
        category=VulnerabilityCategory.REENTRANCY,
        exploit_date="2022-04-30",
        description="Exploited Fei Protocol via reentrancy in the Rari Capital Fuse pools.",
        amount_stolen="$80M",
        is_historical=True,
    ),
    
    # Cream Finance Attacker (2021)
    "0x2e95b91fa678b47660aba811b74a28ca1f4ed111": KnownMaliciousContract(
        address="0x2e95b91fa678b47660aba811b74a28ca1f4ed111",
        name="Cream Finance Attacker",
        category=VulnerabilityCategory.REENTRANCY,
        exploit_date="2021-08-30",
        description="Exploited Cream Finance AMP token reentrancy vulnerability.",
        amount_stolen="$18.8M",
        is_historical=True,
    ),
    
    # Jaypeggers Attacker (2022)
    "0xed42cb11b9d03c807ed1ba9c2ed1d3ba5bf37340": KnownMaliciousContract(
        address="0xed42cb11b9d03c807ed1ba9c2ed1d3ba5bf37340",
        name="Jaypeggers Attacker",
        category=VulnerabilityCategory.REENTRANCY,
        exploit_date="2022-12-29",
        description="Exploited Jaypeggers NFT contract via reentrancy.",
        amount_stolen="$15K",
        is_historical=True,
    ),
    
    # Revest Finance Attacker (2022)
    "0xb480ac726528d1c195cd3bb32f19c92e8d928519": KnownMaliciousContract(
        address="0xb480ac726528d1c195cd3bb32f19c92e8d928519",
        name="Revest Finance Attacker",
        category=VulnerabilityCategory.REENTRANCY,
        exploit_date="2022-03-27",
        description="Exploited Revest Finance via reentrancy in FNFT minting.",
        amount_stolen="$2M",
        is_historical=True,
    ),
    
    # HEX Token (Controversial - high centralization risk)
    "0x2b591e99afe9f32eaa6214f7b7629768c40eeb39": KnownMaliciousContract(
        address="0x2b591e99afe9f32eaa6214f7b7629768c40eeb39",
        name="HEX Token",
        category=VulnerabilityCategory.ACCESS_CONTROL,
        exploit_date=None,
        description="HEX has been criticized for ponzi-like tokenomics and extreme centralization. "
                    "The origin address controls significant supply and the referral system "
                    "incentivizes recruitment over utility.",
        amount_stolen=None,
        is_historical=False,
    ),
    
    # Grim Finance Attacker (2021)
    "0xb08ccb39741d746dd1818641900f182448eb5e41": KnownMaliciousContract(
        address="0xb08ccb39741d746dd1818641900f182448eb5e41",
        name="Grim Finance Attacker",
        category=VulnerabilityCategory.REENTRANCY,
        exploit_date="2021-12-18",
        description="Exploited Grim Finance vault via reentrancy in deposit function.",
        amount_stolen="$30M",
        is_historical=True,
    ),
    
    # Visor Finance Attacker (2021)
    "0x10c509aa9ab291c76c45414e7cdbd375e1d5ace8": KnownMaliciousContract(
        address="0x10c509aa9ab291c76c45414e7cdbd375e1d5ace8",
        name="Visor Finance Attacker",
        category=VulnerabilityCategory.REENTRANCY,
        exploit_date="2021-12-21",
        description="Exploited Visor Finance via reentrancy vulnerability.",
        amount_stolen="$8.2M",
        is_historical=True,
    ),
}

# Set of all known malicious addresses (lowercase for fast lookup)
KNOWN_MALICIOUS_ADDRESSES: Set[str] = {
    addr.lower() for addr in KNOWN_MALICIOUS_CONTRACTS.keys()
}


# =============================================================================
# MALICIOUS PATTERN DEFINITIONS
# =============================================================================

MALICIOUS_PATTERNS: List[MaliciousPattern] = [
    # ----- HONEYPOT PATTERNS -----
    MaliciousPattern(
        name="hidden_transfer_restriction",
        category=VulnerabilityCategory.HONEYPOT,
        severity=Severity.CRITICAL,
        regex_patterns=[
            r"function\s+_?transfer.*require\s*\(\s*(?:msg\.sender|_?from)\s*==\s*(?:owner|_owner|admin)",
            r"function\s+_?transfer.*if\s*\(\s*(?:msg\.sender|_?from)\s*!=\s*(?:owner|_owner|admin).*revert",
            r"mapping.*(?:blacklist|blocked|banned).*function\s+transfer",
        ],
        explanation_template="This contract contains hidden transfer restrictions that only allow the owner to transfer tokens. "
                            "You can buy tokens, but when you try to sell or transfer them, the transaction will fail. "
                            "This is a classic honeypot pattern designed to trap your funds.",
        recommendation="DO NOT interact with this contract. If you already hold tokens, they are likely stuck forever.",
    ),
    
    MaliciousPattern(
        name="hidden_max_transaction",
        category=VulnerabilityCategory.HONEYPOT,
        severity=Severity.HIGH,
        regex_patterns=[
            r"(?:_?maxTx|maxTransaction|maxSell).*=\s*\d+\s*;.*function\s+transfer",
            r"require\s*\(\s*amount\s*<=\s*(?:_?maxTx|maxTransaction)",
            r"if\s*\(\s*(?:!isExcluded|!excluded).*&&.*amount\s*>\s*max",
        ],
        explanation_template="The contract has a hidden maximum transaction limit that applies only to regular users. "
                            "The owner can transfer unlimited amounts while your transactions will fail or be severely limited. "
                            "This prevents you from selling your full position.",
        recommendation="Avoid this token. Check if there's a maxTxAmount and who is excluded from it.",
    ),
    
    MaliciousPattern(
        name="auto_blacklist",
        category=VulnerabilityCategory.HONEYPOT,
        severity=Severity.CRITICAL,
        regex_patterns=[
            r"function\s+_?transfer.*(?:blacklist|blocked)\[(?:to|_to|recipient)\]\s*=\s*true",
            r"(?:blacklist|blocked)\[msg\.sender\]\s*=\s*true.*(?:buy|swap)",
        ],
        explanation_template="This contract automatically adds buyers to a blacklist, preventing them from ever selling. "
                            "The blacklist is applied silently during the buy transaction. "
                            "Only the owner can remove addresses from the blacklist.",
        recommendation="This is a confirmed honeypot. DO NOT BUY. Your tokens will be permanently stuck.",
    ),
    
    # ----- RUG PULL PATTERNS -----
    MaliciousPattern(
        name="unlimited_minting",
        category=VulnerabilityCategory.RUG_PULL,
        severity=Severity.CRITICAL,
        regex_patterns=[
            r"function\s+mint\s*\([^)]*\)\s*(?:public|external)\s+(?:onlyOwner|onlyRole)",
            r"function\s+_?mint\s*\([^)]*\)(?:(?!require|assert|if\s*\(\s*totalSupply).)*onlyOwner",
            r"function\s+(?:owner)?Mint.*\{\s*_mint\s*\(",
        ],
        explanation_template="The contract owner can mint unlimited tokens at any time. "
                            "This means the owner could create billions of new tokens and dump them on the market, "
                            "diluting your holdings to effectively zero value. "
                            "There is no supply cap or minting limit enforced.",
        recommendation="Never invest in tokens where the owner has unlimited minting power. "
                       "Check if minting is disabled or if there's a hard supply cap.",
    ),
    
    MaliciousPattern(
        name="owner_drain_function",
        category=VulnerabilityCategory.RUG_PULL,
        severity=Severity.CRITICAL,
        regex_patterns=[
            r"function\s+(?:withdraw|drain|emergencyWithdraw|rescue).*(?:onlyOwner|onlyAdmin).*(?:\.transfer|\.send|\.call)",
            r"(?:payable\(owner\)|owner\)\.transfer).*address\(this\)\.balance",
            r"function\s+withdraw.*\{\s*(?:payable\()?(?:owner|_owner|msg\.sender)(?:\))?\.(?:transfer|call)",
        ],
        explanation_template="The contract contains a function that allows the owner to withdraw ALL funds from the contract. "
                            "This includes any ETH or tokens you've deposited, swapped, or used for liquidity. "
                            "The owner can execute this at any time without warning, leaving you with nothing.",
        recommendation="Check if liquidity is locked in a third-party locker. "
                       "Avoid contracts where the owner can withdraw arbitrary funds.",
    ),
    
    MaliciousPattern(
        name="removable_liquidity",
        category=VulnerabilityCategory.RUG_PULL,
        severity=Severity.HIGH,
        regex_patterns=[
            r"function\s+removeLiquidity.*(?:onlyOwner|onlyAdmin)",
            r"IUniswapV2Router.*removeLiquidity.*(?:owner|admin)",
            r"function\s+(?:rug|pull|exit).*(?:onlyOwner|onlyAdmin)",
        ],
        explanation_template="The contract allows the owner to remove liquidity without any timelock or restrictions. "
                            "This means the owner can pull all liquidity from the trading pool at any time, "
                            "making your tokens impossible to sell (no buyers) and crashing the price to zero.",
        recommendation="Verify that LP tokens are locked in a reputable locker like Unicrypt or Team.Finance. "
                       "Check the lock duration - short locks are still risky.",
    ),
    
    MaliciousPattern(
        name="pause_mechanism",
        category=VulnerabilityCategory.RUG_PULL,
        severity=Severity.HIGH,
        regex_patterns=[
            r"function\s+(?:pause|stop|freeze|halt).*(?:onlyOwner|onlyAdmin)",
            r"modifier\s+whenNotPaused.*require\s*\(\s*!paused",
            r"bool\s+(?:public\s+)?paused.*function\s+transfer.*require\s*\(\s*!paused",
        ],
        explanation_template="The contract can be paused by the owner, freezing all transfers except their own. "
                            "This allows the owner to dump their tokens while everyone else is unable to sell. "
                            "Pause mechanisms without timelocks or multi-sig requirements are extremely dangerous.",
        recommendation="Check if there's a timelock on pause functionality. "
                       "Prefer contracts with multi-sig or DAO governance for pause functions.",
    ),
    
    # ----- FEE MANIPULATION -----
    MaliciousPattern(
        name="unlimited_fee_setter",
        category=VulnerabilityCategory.FEE_MANIPULATION,
        severity=Severity.CRITICAL,
        regex_patterns=[
            r"function\s+set(?:Tax|Fee|Sell|Buy).*(?:onlyOwner|onlyAdmin)(?:(?!require|assert|<=\s*\d{1,2}).)*\{",
            r"(?:_?(?:tax|fee|sell|buy)(?:Fee|Tax)?)\s*=\s*(?:_?new(?:Tax|Fee)|_?(?:tax|fee))(?:(?!<=|<|require).)*;",
        ],
        explanation_template="The contract allows the owner to set transaction fees without any maximum limit. "
                            "The fee could be set to 99% or even 100%, meaning any transfer you make "
                            "would lose almost all tokens to fees. This is effectively a way to steal your tokens.",
        recommendation="Only interact with tokens that have hardcoded maximum fees (typically 10-15% max). "
                       "Check the contract for require statements limiting fee values.",
    ),
    
    MaliciousPattern(
        name="hidden_sell_tax",
        category=VulnerabilityCategory.FEE_MANIPULATION,
        severity=Severity.HIGH,
        regex_patterns=[
            r"(?:sell(?:Tax|Fee)|_?taxOnSell)\s*=\s*(\d{2,3})",
            r"if\s*\(\s*(?:to|recipient)\s*==\s*(?:pair|uniswap|pancake).*(?:tax|fee)\s*=\s*\d{2,}",
        ],
        explanation_template="This token has a hidden or extremely high sell tax. "
                            "When you try to sell, you'll lose a significant portion (often 20-99%) to fees. "
                            "The buy tax may appear normal, but selling is where you get trapped.",
        recommendation="Always check both buy AND sell taxes before trading. "
                       "Use a token scanner tool to detect hidden fees.",
    ),
    
    # ----- REENTRANCY -----
    MaliciousPattern(
        name="external_call_before_state_update",
        category=VulnerabilityCategory.REENTRANCY,
        severity=Severity.CRITICAL,
        regex_patterns=[
            r"\.call\{value:.*\}.*\n.*(?:balances?|amounts?)\[.*\]\s*=",
            r"\.transfer\(.*\).*\n.*(?:balances?|amounts?)\[.*\]\s*(?:-=|=)",
            r"(?:payable\(.*\)\.)?(?:call|transfer|send)\(.*\)(?:(?!nonReentrant|ReentrancyGuard).)*\n.*=\s*0",
        ],
        explanation_template="This contract makes external calls (sending ETH or calling other contracts) "
                            "BEFORE updating its internal state (like balances). "
                            "An attacker can exploit this by re-entering the function during the external call, "
                            "withdrawing funds multiple times before the balance is set to zero. "
                            "This is the exact vulnerability that caused The DAO hack ($60M stolen in 2016).",
        recommendation="DO NOT deposit funds into this contract. It is vulnerable to reentrancy attacks. "
                       "Legitimate contracts use the Checks-Effects-Interactions pattern or ReentrancyGuard.",
    ),
    
    MaliciousPattern(
        name="missing_reentrancy_guard",
        category=VulnerabilityCategory.REENTRANCY,
        severity=Severity.HIGH,
        regex_patterns=[
            r"function\s+(?:withdraw|claim|redeem).*(?:external|public)(?:(?!nonReentrant|ReentrancyGuard|_status).)*\{[^}]*\.call\{",
        ],
        explanation_template="Critical functions that handle value transfers are missing reentrancy protection. "
                            "Without a nonReentrant modifier or ReentrancyGuard, attackers can potentially "
                            "call these functions recursively to drain funds.",
        recommendation="This contract should be audited before use. "
                       "Look for OpenZeppelin's ReentrancyGuard or similar protection.",
    ),
    
    # ----- ACCESS CONTROL -----
    MaliciousPattern(
        name="centralized_ownership",
        category=VulnerabilityCategory.ACCESS_CONTROL,
        severity=Severity.MEDIUM,
        regex_patterns=[
            r"(?:onlyOwner|onlyAdmin)(?:(?!renounceOwnership|transferOwnership|timelock|multisig).)*\{",
            r"require\s*\(\s*msg\.sender\s*==\s*(?:owner|admin|_owner)",
        ],
        explanation_template="All critical functions are controlled by a single owner address. "
                            "If this address is compromised, malicious, or loses their keys, "
                            "the entire contract and all user funds are at risk. "
                            "There is no multi-signature requirement or governance mechanism.",
        recommendation="Check if ownership has been renounced or transferred to a multi-sig/DAO. "
                       "Centralized control is a significant trust assumption.",
    ),
    
    MaliciousPattern(
        name="no_renounce_ownership",
        category=VulnerabilityCategory.ACCESS_CONTROL,
        severity=Severity.MEDIUM,
        regex_patterns=[
            r"(?:Ownable|owner)(?:(?!renounceOwnership).)*$",
        ],
        explanation_template="The contract inherits ownership but does not include or has removed "
                            "the ability to renounce ownership. This means centralization risks "
                            "exist permanently - the owner will always have control.",
        recommendation="For truly decentralized tokens, ownership should be renounceable. "
                       "Check if renounceOwnership has been called on-chain.",
    ),
    
    # ----- PROXY RISKS -----
    MaliciousPattern(
        name="upgradeable_proxy",
        category=VulnerabilityCategory.PROXY_RISK,
        severity=Severity.HIGH,
        regex_patterns=[
            r"delegatecall\s*\(",
            r"function\s+upgrade.*(?:onlyOwner|onlyAdmin)",
            r"(?:implementation|_implementation)\s*=",
            r"TransparentUpgradeableProxy|UUPSUpgradeable|BeaconProxy",
        ],
        explanation_template="This is an upgradeable proxy contract. The actual logic can be changed "
                            "by the owner at any time WITHOUT your consent. "
                            "The current code might look safe, but it could be upgraded to a malicious version "
                            "that drains all funds or introduces backdoors.",
        recommendation="For upgradeable contracts, verify there's a timelock (24-48h minimum) on upgrades. "
                       "Check who controls the upgrade mechanism - preferably a multi-sig or DAO.",
    ),
    
    # ----- SELF-DESTRUCT -----
    MaliciousPattern(
        name="self_destruct",
        category=VulnerabilityCategory.SELF_DESTRUCT,
        severity=Severity.CRITICAL,
        regex_patterns=[
            r"selfdestruct\s*\(",
            r"suicide\s*\(",
        ],
        explanation_template="The contract contains a self-destruct function that can destroy the contract "
                            "and send all remaining ETH to a specified address (usually the owner). "
                            "If executed, all tokens in the contract become permanently inaccessible, "
                            "and any contract functionality is lost forever.",
        recommendation="Avoid contracts with selfdestruct unless there's a very clear, legitimate use case "
                       "and the function is protected by a timelock and multi-sig.",
    ),
    
    # ----- EXTERNAL CALL RISKS -----
    MaliciousPattern(
        name="unchecked_external_call",
        category=VulnerabilityCategory.EXTERNAL_CALL_RISK,
        severity=Severity.MEDIUM,
        regex_patterns=[
            r"\.call\{.*\}\(.*\)(?:(?!require|if|success).)*;",
            r"\.send\(.*\)(?:(?!require|if).)*;",
        ],
        explanation_template="The contract makes external calls without checking if they succeed. "
                            "Failed transfers could go unnoticed, leading to accounting errors "
                            "and potential loss of funds.",
        recommendation="External calls should always check return values. "
                       "This may indicate rushed or amateur development.",
    ),
    
    MaliciousPattern(
        name="arbitrary_external_call",
        category=VulnerabilityCategory.EXTERNAL_CALL_RISK,
        severity=Severity.CRITICAL,
        regex_patterns=[
            r"function\s+execute.*\.call\{.*\}\(.*\).*(?:onlyOwner|onlyAdmin)",
            r"function\s+(?:call|execute|run).*address.*\.call\(",
        ],
        explanation_template="The contract allows the owner to make arbitrary external calls to any address. "
                            "This is extremely dangerous as it enables the owner to: "
                            "1) Transfer any tokens held by the contract, "
                            "2) Interact with malicious contracts, "
                            "3) Execute any action as the contract itself.",
        recommendation="This is a critical red flag. The owner has complete control. "
                       "Only use if you fully trust the owner's identity and intentions.",
    ),
]


# =============================================================================
# RISK SCORING WEIGHTS
# =============================================================================

SEVERITY_WEIGHTS: Dict[Severity, int] = {
    Severity.CRITICAL: 40,
    Severity.HIGH: 25,
    Severity.MEDIUM: 15,
    Severity.LOW: 8,
    Severity.INFO: 3,
}

CATEGORY_WEIGHTS: Dict[VulnerabilityCategory, float] = {
    VulnerabilityCategory.HONEYPOT: 1.2,      # Extra penalty for honeypots
    VulnerabilityCategory.RUG_PULL: 1.2,      # Extra penalty for rug pulls
    VulnerabilityCategory.FEE_MANIPULATION: 1.1,
    VulnerabilityCategory.REENTRANCY: 1.3,    # Highest - can drain everything
    VulnerabilityCategory.ACCESS_CONTROL: 0.9,
    VulnerabilityCategory.PROXY_RISK: 1.0,
    VulnerabilityCategory.SELF_DESTRUCT: 1.1,
    VulnerabilityCategory.EXTERNAL_CALL_RISK: 0.9,
}


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def is_known_malicious(address: str) -> bool:
    """Check if an address is in the known malicious database."""
    return address.lower() in KNOWN_MALICIOUS_ADDRESSES


def get_known_malicious_info(address: str) -> Optional[KnownMaliciousContract]:
    """Get information about a known malicious contract."""
    return KNOWN_MALICIOUS_CONTRACTS.get(address.lower())


def check_patterns(source_code: str) -> List[Dict]:
    """
    Check source code against all malicious patterns.
    
    Returns a list of detected issues with explanations.
    """
    detected = []
    
    for pattern in MALICIOUS_PATTERNS:
        for regex in pattern.regex_patterns:
            try:
                matches = re.findall(regex, source_code, re.IGNORECASE | re.MULTILINE | re.DOTALL)
                if matches:
                    # Find the specific line(s) where pattern was found
                    lines = source_code.split('\n')
                    evidence_lines = []
                    for i, line in enumerate(lines):
                        if re.search(regex, line, re.IGNORECASE):
                            evidence_lines.append(f"Line {i+1}: {line.strip()}")
                    
                    detected.append({
                        "pattern": pattern.name,
                        "category": pattern.category.value,
                        "severity": pattern.severity.value,
                        "explanation": pattern.explanation_template,
                        "recommendation": pattern.recommendation,
                        "evidence": evidence_lines[:3] if evidence_lines else [str(matches[0])[:200]],
                        "match_count": len(matches),
                    })
                    break  # Only report each pattern once
            except re.error:
                continue  # Skip invalid regex
    
    return detected


def calculate_risk_score(detected_issues: List[Dict]) -> int:
    """
    Calculate overall risk score based on detected issues.
    
    Returns a score from 0-100 where 100 is highest risk.
    """
    if not detected_issues:
        return 0
    
    total_score = 0
    
    for issue in detected_issues:
        severity = Severity(issue.get("severity", "MEDIUM"))
        category = VulnerabilityCategory(issue.get("category", "access_control"))
        
        base_score = SEVERITY_WEIGHTS.get(severity, 10)
        multiplier = CATEGORY_WEIGHTS.get(category, 1.0)
        
        total_score += base_score * multiplier
    
    # Cap at 100
    return min(int(total_score), 100)


def get_risk_level(score: int) -> str:
    """Convert risk score to human-readable level."""
    if score >= 80:
        return "CRITICAL"
    elif score >= 60:
        return "HIGH"
    elif score >= 40:
        return "MEDIUM"
    elif score >= 20:
        return "LOW"
    else:
        return "SAFE"


# =============================================================================
# SAFE / TRUSTED CONTRACTS (For comparison and false positive reduction)
# =============================================================================

TRUSTED_CONTRACTS: Dict[str, str] = {
    # Major Stablecoins
    "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
    "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
    "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
    
    # Major DeFi
    "0x7a250d5630b4cf539739df2c5dacb4c659f2488d": "Uniswap V2 Router",
    "0xe592427a0aece92de3edee1f18e0157c05861564": "Uniswap V3 Router",
    "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45": "Uniswap V3 Router 2",
    "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f": "SushiSwap Router",
    
    # Major Tokens
    "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
    "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
    "0x514910771af9ca656af840dff83e8264ecf986ca": "LINK",
    "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
    "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9": "AAVE",
    
    # Lending
    "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9": "Aave V2 Pool",
    "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2": "Aave V3 Pool",
}

def is_trusted_contract(address: str) -> bool:
    """Check if an address is a known trusted contract."""
    return address.lower() in TRUSTED_CONTRACTS


def get_trusted_contract_name(address: str) -> Optional[str]:
    """Get the name of a trusted contract."""
    return TRUSTED_CONTRACTS.get(address.lower())
