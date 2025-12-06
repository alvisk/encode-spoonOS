"""CLI for the Neo Wallet Guardian.

Provides command-line access to wallet analysis using the graph-based orchestrator.
"""

import argparse
import asyncio
import json
import os
import sys

from .agent import build_agent, WalletGuardian, get_guardian
from .graph_orchestrator import analyze_wallet, query_guardian


async def run_analysis(address: str, lookback_days: int = 30, output_format: str = "json"):
    """Run wallet analysis using the graph orchestrator."""
    result = await analyze_wallet(address, lookback_days)
    
    if output_format == "json":
        return json.dumps(result, indent=2, default=str)
    else:
        # Human-readable format
        lines = [
            f"Wallet Analysis: {address}",
            "=" * 50,
            f"Risk Score: {result.get('risk_score', 'N/A')}/100",
            f"Risk Level: {result.get('risk_level', 'N/A').upper()}",
            "",
            "Metrics:",
            f"  - Concentration: {result.get('metrics', {}).get('concentration', 0):.2%}",
            f"  - Stablecoin Ratio: {result.get('metrics', {}).get('stablecoin_ratio', 0):.2%}",
            f"  - Counterparties: {result.get('metrics', {}).get('counterparty_count', 0)}",
        ]
        
        if result.get('deductions'):
            lines.append("")
            lines.append("Risk Factors:")
            for d in result['deductions']:
                lines.append(f"  - {d.get('reason', 'unknown')}: -{d.get('penalty', 0)} points")
        
        if result.get('suspicious_patterns'):
            lines.append("")
            lines.append("Suspicious Patterns:")
            for p in result['suspicious_patterns']:
                lines.append(f"  - [{p.get('level', 'low').upper()}] {p.get('type', 'unknown')}")
        
        return "\n".join(lines)


async def run_query(query: str):
    """Run a natural language query."""
    return await query_guardian(query)


async def run_legacy_agent(prompt: str):
    """Run the legacy ToolCallAgent."""
    agent = build_agent()
    result = await agent.run(prompt)
    return result


def main():
    parser = argparse.ArgumentParser(
        description="Neo Wallet Guardian CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Analyze a wallet
  python -m wallet_guardian.src.cli --analyze NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ
  
  # Analyze with custom lookback period
  python -m wallet_guardian.src.cli --analyze NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ --days 7
  
  # Natural language query
  python -m wallet_guardian.src.cli --query "What is the risk level of wallet Nxyz...?"
  
  # Legacy agent mode (for backwards compatibility)
  python -m wallet_guardian.src.cli "summarize wallet NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ"
"""
    )
    
    parser.add_argument(
        "prompt", 
        nargs="*", 
        help="Legacy: Prompt to send to the agent"
    )
    parser.add_argument(
        "--analyze", "-a",
        metavar="ADDRESS",
        help="Analyze a wallet address using graph orchestrator"
    )
    parser.add_argument(
        "--query", "-q",
        metavar="QUESTION",
        help="Ask a natural language question"
    )
    parser.add_argument(
        "--days", "-d",
        type=int,
        default=30,
        help="Lookback period in days (default: 30)"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["json", "text"],
        default="json",
        help="Output format (default: json)"
    )
    parser.add_argument(
        "--mock",
        action="store_true",
        help="Use mock chain data (offline/demo)"
    )
    
    args = parser.parse_args()
    
    if args.mock:
        os.environ["WALLET_GUARDIAN_USE_MOCK"] = "true"
    
    if args.analyze:
        # Graph-based analysis
        result = asyncio.run(run_analysis(args.analyze, args.days, args.format))
        print(result)
    elif args.query:
        # Natural language query
        result = asyncio.run(run_query(args.query))
        print(result)
    elif args.prompt:
        # Legacy agent mode
        user_prompt = " ".join(args.prompt)
        result = asyncio.run(run_legacy_agent(user_prompt))
        print(result)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()


