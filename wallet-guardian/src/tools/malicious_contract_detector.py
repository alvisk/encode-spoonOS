"""
Malicious Contract Detector Tool

AI-powered analysis of Ethereum smart contracts to detect malicious patterns.
Uses pattern matching and LLM-based deep analysis to identify:
- Honeypots
- Rug pulls
- Fee manipulation
- Reentrancy vulnerabilities
- Access control issues
- And more

Returns detailed explanations of why a contract is flagged as malicious.
"""

import asyncio
import json
import os
import time
import threading
from typing import Any, ClassVar, Dict, List, Optional, Tuple
from dataclasses import dataclass

from spoon_ai.tools import BaseTool

from ..eth_client import EthClient, Chain, is_valid_eth_address

# Import from same package
from .known_malicious_contracts import (
    KNOWN_MALICIOUS_CONTRACTS,
    MALICIOUS_PATTERNS,
    TRUSTED_CONTRACTS,
    is_known_malicious,
    get_known_malicious_info,
    is_trusted_contract,
    get_trusted_contract_name,
    check_patterns,
    calculate_risk_score,
    get_risk_level,
    VulnerabilityCategory,
    Severity,
)


# =============================================================================
# CACHING FOR SCAN RESULTS
# =============================================================================

SCAN_CACHE_TTL = 3600  # 1 hour
_scan_cache: Dict[str, Tuple[Dict, float]] = {}
_scan_cache_lock = threading.Lock()


# =============================================================================
# AI ANALYSIS PROMPT
# =============================================================================

MALICIOUS_ANALYSIS_PROMPT = """You are an expert smart contract security auditor. Analyze this Solidity contract for malicious patterns and vulnerabilities.

CONTRACT SOURCE CODE:
```solidity
{source_code}
```

CONTRACT NAME: {contract_name}
CONTRACT ADDRESS: {address}

Analyze for these specific threats:

1. **HONEYPOT PATTERNS**: Can users buy but not sell? Hidden transfer restrictions?
2. **RUG PULL MECHANISMS**: Can owner mint unlimited tokens? Drain funds? Remove liquidity?
3. **FEE MANIPULATION**: Can fees be set arbitrarily high (e.g., 100%)? Hidden taxes?
4. **REENTRANCY**: External calls before state updates? Missing reentrancy guards?
5. **ACCESS CONTROL**: Is everything controlled by one address? Can ownership be renounced?
6. **PROXY RISKS**: Is this upgradeable? Can logic be changed maliciously?
7. **SELF-DESTRUCT**: Can the contract be destroyed, losing all funds?

For each issue found, explain:
- What the vulnerability IS in simple terms
- HOW it could be exploited
- What the IMPACT would be on users who interact with this contract

Return your analysis as valid JSON with this exact structure:
{{
  "is_malicious": true or false,
  "confidence": 0.0 to 1.0,
  "risk_score": 0 to 100 (100 = highest risk),
  "issues": [
    {{
      "category": "honeypot|rug_pull|fee_manipulation|reentrancy|access_control|proxy_risk|self_destruct",
      "pattern": "short_pattern_name",
      "severity": "CRITICAL|HIGH|MEDIUM|LOW",
      "function": "function_name or null",
      "line": line_number or null,
      "explanation": "Detailed explanation of what this vulnerability means and how it affects users. Be specific and clear.",
      "evidence": "The specific code snippet that demonstrates this issue",
      "recommendation": "What users should do or avoid"
    }}
  ],
  "summary": "A 1-2 sentence summary of the main risks. Be direct and clear about whether users should interact with this contract."
}}

IMPORTANT:
- Return ONLY valid JSON, no markdown or extra text
- Focus on the TOP 3 most severe issues only
- Be specific about WHY something is dangerous
- If the contract appears safe, set is_malicious to false and provide empty issues array
"""


# =============================================================================
# MALICIOUS CONTRACT DETECTOR TOOL
# =============================================================================

class MaliciousContractDetectorTool(BaseTool):
    """
    Analyze Ethereum smart contracts for malicious patterns.
    
    Uses pattern matching and AI-powered deep analysis to detect:
    - Honeypot patterns (can buy but not sell)
    - Rug pull mechanisms (owner can drain funds)
    - Fee manipulation (fees can be set to 100%)
    - Reentrancy vulnerabilities
    - Access control issues
    - Proxy upgrade risks
    - Self-destruct capabilities
    
    Returns detailed explanations of detected issues.
    Supports both Ethereum mainnet and Sepolia testnet.
    """
    
    name: ClassVar[str] = "malicious_contract_detector"
    description: ClassVar[str] = (
        "Analyze an Ethereum smart contract for malicious patterns like honeypots, "
        "rug pulls, and vulnerabilities. Returns detailed explanations of why a contract "
        "is dangerous. Use this to check if a contract is safe before interacting with it. "
        "Supports mainnet and Sepolia testnet."
    )
    parameters: ClassVar[dict] = {
        "type": "object",
        "properties": {
            "contract_address": {
                "type": "string",
                "description": "Ethereum contract address to analyze (0x...)"
            },
            "chain": {
                "type": "string",
                "description": "Chain to use: 'ethereum' (mainnet) or 'sepolia' (testnet)",
                "default": "sepolia",
                "enum": ["ethereum", "sepolia", "ethereum_sepolia"]
            },
            "force_refresh": {
                "type": "boolean",
                "description": "Bypass cache and force fresh analysis",
                "default": False
            },
            "use_ai": {
                "type": "boolean",
                "description": "Use AI for deep analysis (slower but more thorough)",
                "default": True
            }
        },
        "required": ["contract_address"],
    }
    
    # Default to Sepolia for testnet compatibility with Neo Oracle
    DEFAULT_CHAIN: ClassVar[Chain] = Chain.ETHEREUM_SEPOLIA
    
    def __init__(self, chain: Chain = None):
        """Initialize the detector with optional chain."""
        self._chain = chain or self.DEFAULT_CHAIN
        self._eth_client = EthClient(chain=self._chain)
        self._llm = None
    
    def _get_chain(self, chain_str: str = None) -> Chain:
        """Get Chain enum from string."""
        if not chain_str:
            return self._chain
        chain_lower = chain_str.lower()
        if chain_lower in ("sepolia", "ethereum_sepolia"):
            return Chain.ETHEREUM_SEPOLIA
        elif chain_lower in ("ethereum", "mainnet"):
            return Chain.ETHEREUM
        elif chain_lower == "base":
            return Chain.BASE
        elif chain_lower == "base_sepolia":
            return Chain.BASE_SEPOLIA
        return self._chain
    
    def _get_llm(self):
        """Get or create the LLM instance using the existing agent configuration."""
        if self._llm is None:
            try:
                from spoon_ai.chat import ChatBot
                
                openai_key = os.getenv("OPENAI_API_KEY")
                anthropic_key = os.getenv("ANTHROPIC_API_KEY")
                gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
                
                if openai_key:
                    self._llm = ChatBot(
                        llm_provider="openai",
                        api_key=openai_key,
                        model_name="gpt-4o-mini",
                    )
                elif anthropic_key:
                    self._llm = ChatBot(
                        llm_provider="anthropic",
                        api_key=anthropic_key,
                    )
                elif gemini_key:
                    self._llm = ChatBot(
                        llm_provider="gemini",
                        api_key=gemini_key,
                        model_name="gemini-2.0-flash",
                    )
                else:
                    self._llm = ChatBot()
            except Exception as e:
                print(f"Warning: Could not initialize LLM: {e}")
                self._llm = None
        
        return self._llm
    
    async def execute(
        self,
        contract_address: str,
        chain: str = "sepolia",
        force_refresh: bool = False,
        use_ai: bool = True,
    ) -> Dict[str, Any]:
        """
        Analyze a contract for malicious patterns.
        
        Args:
            contract_address: Ethereum contract address (0x...)
            chain: Chain to use - 'ethereum' or 'sepolia' (default)
            force_refresh: Bypass cache if True
            use_ai: Use AI for deep analysis (default True)
            
        Returns:
            Detailed analysis with explanations
        """
        return self.call(contract_address, chain, force_refresh, use_ai)
    
    def call(
        self,
        contract_address: str,
        chain: str = "sepolia",
        force_refresh: bool = False,
        use_ai: bool = True,
    ) -> Dict[str, Any]:
        """
        Synchronous analysis of a contract.
        
        Args:
            contract_address: Ethereum contract address (0x...)
            chain: Chain to use - 'ethereum' or 'sepolia' (default)
            force_refresh: Bypass cache if True
            use_ai: Use AI for deep analysis (default True)
            
        Returns:
            Detailed analysis with explanations
        """
        start_time = time.time()
        
        # Get the appropriate chain
        target_chain = self._get_chain(chain)
        self._eth_client = EthClient(chain=target_chain)
        chain_name = target_chain.value
        
        # Validate address
        is_valid, error = is_valid_eth_address(contract_address)
        if not is_valid:
            return {
                "error": f"Invalid address: {error}",
                "contract_address": contract_address,
            }
        
        address_lower = contract_address.lower()
        
        # Check cache
        if not force_refresh:
            with _scan_cache_lock:
                if address_lower in _scan_cache:
                    cached_result, timestamp = _scan_cache[address_lower]
                    if time.time() - timestamp < SCAN_CACHE_TTL:
                        cached_result["from_cache"] = True
                        return cached_result
        
        # Check if it's a known trusted contract
        if is_trusted_contract(address_lower):
            result = self._create_safe_result(
                contract_address,
                f"This is a known trusted contract: {get_trusted_contract_name(address_lower)}",
                start_time,
                chain_name,
            )
            self._cache_result(address_lower, result)
            return result
        
        # Check if it's a known malicious contract
        if is_known_malicious(address_lower):
            known_info = get_known_malicious_info(address_lower)
            result = self._create_known_malicious_result(contract_address, known_info, start_time, chain_name)
            self._cache_result(address_lower, result)
            return result
        
        # Check if it's actually a contract
        if not self._eth_client.is_contract(contract_address):
            return {
                "error": "Address is not a contract (EOA or empty)",
                "contract_address": contract_address,
                "chain": chain_name,
                "is_contract": False,
            }
        
        # Get contract source code
        source_info = self._eth_client.get_contract_source_code(contract_address)
        
        if not source_info or not source_info.get("is_verified"):
            # Contract not verified - higher risk
            result = self._create_unverified_result(contract_address, start_time, chain_name)
            self._cache_result(address_lower, result)
            return result
        
        # Run pattern matching
        source_code = source_info.get("source_code", "")
        pattern_issues = check_patterns(source_code)
        
        # Run AI analysis if enabled and source code available
        ai_issues = []
        ai_summary = ""
        if use_ai and source_code:
            ai_result = self._run_ai_analysis(
                source_code,
                source_info.get("contract_name", "Unknown"),
                contract_address,
            )
            if ai_result:
                ai_issues = ai_result.get("issues", [])
                ai_summary = ai_result.get("summary", "")
        
        # Combine and deduplicate issues
        all_issues = self._combine_issues(pattern_issues, ai_issues)
        
        # Sort by severity and take top 3
        severity_order = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3, "INFO": 4}
        all_issues.sort(key=lambda x: severity_order.get(x.get("severity", "LOW"), 4))
        top_issues = all_issues[:3]
        
        # Calculate risk score
        risk_score = calculate_risk_score(top_issues)
        risk_level = get_risk_level(risk_score)
        is_malicious = risk_score >= 60 or any(
            issue.get("severity") == "CRITICAL" for issue in top_issues
        )
        
        # Generate summary
        if ai_summary:
            summary = ai_summary
        elif top_issues:
            summary = self._generate_summary(top_issues, risk_level)
        else:
            summary = "No significant security issues detected. The contract appears relatively safe, but always exercise caution."
        
        # Build result
        result = {
            "contract_address": contract_address,
            "chain": chain_name,
            "is_verified": True,
            "contract_name": source_info.get("contract_name", "Unknown"),
            "compiler_version": source_info.get("compiler_version", ""),
            "is_proxy": source_info.get("proxy", False),
            "implementation": source_info.get("implementation", ""),
            
            "verdict": {
                "is_malicious": is_malicious,
                "risk_score": risk_score,
                "risk_level": risk_level,
                "confidence": 0.85 if use_ai else 0.65,
            },
            
            "detected_issues": top_issues,
            "total_issues_found": len(all_issues),
            
            "summary": summary,
            
            "metadata": {
                "analysis_time_ms": int((time.time() - start_time) * 1000),
                "ai_analysis_used": use_ai and bool(ai_issues),
                "pattern_matching_used": True,
                "source_code_available": True,
            },
            
            "from_cache": False,
        }
        
        # Cache the result
        self._cache_result(address_lower, result)
        
        return result
    
    def _run_ai_analysis(
        self,
        source_code: str,
        contract_name: str,
        address: str,
    ) -> Optional[Dict]:
        """Run AI-powered analysis on the source code."""
        llm = self._get_llm()
        if not llm:
            return None
        
        # Truncate source code if too long (keep first 15000 chars)
        max_code_length = 15000
        if len(source_code) > max_code_length:
            source_code = source_code[:max_code_length] + "\n// ... (truncated)"
        
        prompt = MALICIOUS_ANALYSIS_PROMPT.format(
            source_code=source_code,
            contract_name=contract_name,
            address=address,
        )
        
        try:
            # Use synchronous chat - try different method names as API may vary
            if hasattr(llm, 'chat'):
                response = llm.chat(prompt)
            elif hasattr(llm, 'generate'):
                response = llm.generate(prompt)
            elif hasattr(llm, 'complete'):
                response = llm.complete(prompt)
            elif hasattr(llm, '__call__'):
                response = llm(prompt)
            else:
                # Fallback: try async run in sync context
                import asyncio
                response = asyncio.get_event_loop().run_until_complete(llm.agenerate(prompt))
            
            # Extract JSON from response
            response_text = response if isinstance(response, str) else str(response)
            
            # Try to find JSON in the response
            json_start = response_text.find('{')
            json_end = response_text.rfind('}') + 1
            
            if json_start >= 0 and json_end > json_start:
                json_str = response_text[json_start:json_end]
                return json.loads(json_str)
            
            return None
            
        except Exception as e:
            print(f"AI analysis error: {e}")
            return None
    
    def _combine_issues(
        self,
        pattern_issues: List[Dict],
        ai_issues: List[Dict],
    ) -> List[Dict]:
        """Combine and deduplicate issues from pattern matching and AI."""
        combined = []
        seen_patterns = set()
        
        # Add AI issues first (usually more detailed)
        for issue in ai_issues:
            pattern_key = f"{issue.get('category')}:{issue.get('pattern')}"
            if pattern_key not in seen_patterns:
                seen_patterns.add(pattern_key)
                combined.append(issue)
        
        # Add pattern issues that weren't found by AI
        for issue in pattern_issues:
            pattern_key = f"{issue.get('category')}:{issue.get('pattern')}"
            if pattern_key not in seen_patterns:
                seen_patterns.add(pattern_key)
                combined.append(issue)
        
        return combined
    
    def _generate_summary(self, issues: List[Dict], risk_level: str) -> str:
        """Generate a summary based on detected issues."""
        if not issues:
            return "No significant security issues detected."
        
        critical_count = sum(1 for i in issues if i.get("severity") == "CRITICAL")
        high_count = sum(1 for i in issues if i.get("severity") == "HIGH")
        
        categories = set(i.get("category", "unknown") for i in issues)
        category_names = {
            "honeypot": "honeypot patterns",
            "rug_pull": "rug pull mechanisms",
            "fee_manipulation": "fee manipulation",
            "reentrancy": "reentrancy vulnerabilities",
            "access_control": "access control issues",
            "proxy_risk": "proxy upgrade risks",
            "self_destruct": "self-destruct capability",
        }
        
        detected: List[str] = [category_names.get(c, str(c)) for c in categories if c]
        detected_str = ", ".join(detected) if detected else "unknown issues"
        
        if risk_level == "CRITICAL":
            return f"CRITICAL RISK: This contract exhibits {detected_str}. DO NOT interact with this contract - you will likely lose your funds."
        elif risk_level == "HIGH":
            return f"HIGH RISK: Detected {detected_str}. Exercise extreme caution. The contract owner has significant control that could be abused."
        elif risk_level == "MEDIUM":
            return f"MEDIUM RISK: Found {detected_str}. Review carefully before interacting. Some centralization risks exist."
        else:
            return f"LOW RISK: Minor issues detected ({detected_str}). The contract appears relatively safe but always verify before large transactions."
    
    def _create_safe_result(
        self,
        address: str,
        message: str,
        start_time: float,
        chain_name: str = "ethereum_sepolia",
    ) -> Dict[str, Any]:
        """Create a result for a known safe contract."""
        return {
            "contract_address": address,
            "chain": chain_name,
            "is_verified": True,
            
            "verdict": {
                "is_malicious": False,
                "risk_score": 10,
                "risk_level": "SAFE",
                "confidence": 0.95,
            },
            
            "detected_issues": [],
            "total_issues_found": 0,
            
            "summary": message,
            
            "metadata": {
                "analysis_time_ms": int((time.time() - start_time) * 1000),
                "known_trusted": True,
            },
            
            "from_cache": False,
        }
    
    def _create_known_malicious_result(
        self,
        address: str,
        known_info,
        start_time: float,
        chain_name: str = "ethereum_sepolia",
    ) -> Dict[str, Any]:
        """Create a result for a known malicious contract."""
        return {
            "contract_address": address,
            "chain": chain_name,
            "is_verified": True,
            "contract_name": known_info.name,
            
            "verdict": {
                "is_malicious": True,
                "risk_score": 100,
                "risk_level": "CRITICAL",
                "confidence": 1.0,
            },
            
            "detected_issues": [
                {
                    "category": known_info.category.value,
                    "pattern": "known_malicious",
                    "severity": "CRITICAL",
                    "explanation": known_info.description,
                    "evidence": f"Exploit date: {known_info.exploit_date}" if known_info.exploit_date else "Known malicious contract",
                    "recommendation": "DO NOT interact with this contract under any circumstances.",
                }
            ],
            "total_issues_found": 1,
            
            "summary": f"CRITICAL: This is a KNOWN MALICIOUS contract ({known_info.name}). "
                       f"{known_info.description} "
                       f"{'Amount stolen: ' + known_info.amount_stolen if known_info.amount_stolen else ''} "
                       f"DO NOT INTERACT.",
            
            "metadata": {
                "analysis_time_ms": int((time.time() - start_time) * 1000),
                "known_malicious": True,
                "exploit_date": known_info.exploit_date,
                "amount_stolen": known_info.amount_stolen,
                "is_historical": known_info.is_historical,
            },
            
            "from_cache": False,
        }
    
    def _create_unverified_result(
        self,
        address: str,
        start_time: float,
        chain_name: str = "ethereum_sepolia",
    ) -> Dict[str, Any]:
        """Create a result for an unverified contract."""
        return {
            "contract_address": address,
            "chain": chain_name,
            "is_verified": False,
            
            "verdict": {
                "is_malicious": None,  # Unknown - can't verify
                "risk_score": 70,
                "risk_level": "HIGH",
                "confidence": 0.5,
            },
            
            "detected_issues": [
                {
                    "category": "access_control",
                    "pattern": "unverified_source",
                    "severity": "HIGH",
                    "explanation": "This contract's source code is NOT verified on Etherscan/Blockscout. "
                                   "This means we cannot analyze what the code actually does. "
                                   "Unverified contracts are high risk because they could contain any malicious code. "
                                   "Legitimate projects typically verify their contracts for transparency.",
                    "evidence": "Contract source code not published",
                    "recommendation": "Only interact with verified contracts. Ask the project team to verify their contract source code.",
                }
            ],
            "total_issues_found": 1,
            
            "summary": "HIGH RISK: Contract source code is NOT VERIFIED. Unable to analyze for malicious patterns. "
                       "Unverified contracts are inherently risky - proceed with extreme caution or avoid entirely.",
            
            "metadata": {
                "analysis_time_ms": int((time.time() - start_time) * 1000),
                "source_code_available": False,
            },
            
            "from_cache": False,
        }
    
    def _cache_result(self, address: str, result: Dict) -> None:
        """Cache a scan result."""
        with _scan_cache_lock:
            _scan_cache[address.lower()] = (result, time.time())


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

def scan_contract(
    address: str,
    chain: str = "sepolia",
    force_refresh: bool = False,
    use_ai: bool = True,
) -> Dict[str, Any]:
    """
    Scan a contract for malicious patterns.
    
    Args:
        address: Ethereum contract address (0x...)
        chain: Chain to use - 'ethereum' or 'sepolia' (default)
        force_refresh: Bypass cache if True
        use_ai: Use AI for deep analysis
        
    Returns:
        Analysis result with detailed explanations
    """
    detector = MaliciousContractDetectorTool()
    return detector.call(address, chain, force_refresh, use_ai)


def format_for_oracle(result: Dict[str, Any]) -> str:
    """
    Format scan result for Neo Oracle (compact format).
    
    Format: SCORE:85|MAL:true|LEVEL:CRITICAL|I1:pattern1|I2:pattern2|I3:pattern3|SUM:summary
    
    Args:
        result: Full scan result
        
    Returns:
        Compact string for Oracle response
    """
    verdict = result.get("verdict", {})
    score = verdict.get("risk_score", 0)
    is_mal = "true" if verdict.get("is_malicious") else "false"
    level = verdict.get("risk_level", "UNKNOWN")
    
    issues = result.get("detected_issues", [])
    issue_strs = []
    for i, issue in enumerate(issues[:3], 1):
        pattern = issue.get("pattern", "unknown")[:20]  # Limit length
        issue_strs.append(f"I{i}:{pattern}")
    
    summary = result.get("summary", "")[:150]  # Limit summary length
    # Remove pipe characters from summary to avoid parsing issues
    summary = summary.replace("|", ";")
    
    parts = [
        f"SCORE:{score}",
        f"MAL:{is_mal}",
        f"LEVEL:{level}",
    ]
    parts.extend(issue_strs)
    parts.append(f"SUM:{summary}")
    
    return "|".join(parts)


def clear_scan_cache() -> None:
    """Clear the scan result cache."""
    global _scan_cache
    with _scan_cache_lock:
        _scan_cache.clear()
