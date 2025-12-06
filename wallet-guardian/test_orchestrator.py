"""Test script for the graph orchestrator."""

import asyncio
import json
from src.graph_orchestrator import MultiAgentOrchestrator, UnifiedDataFetcher
from src.neo_client import NeoClient


async def test_mainnet():
    """Test with mainnet wallet."""
    # Use mainnet for more activity
    mainnet_client = NeoClient('https://mainnet1.neo.coz.io:443')
    fetcher = UnifiedDataFetcher(mainnet_client)
    
    orchestrator = MultiAgentOrchestrator()
    orchestrator.data_fetcher = fetcher
    orchestrator.graph_builder.data_fetcher = fetcher
    
    # Active address on mainnet
    address = 'NTTjRPzSCcTZhU9FBuCe4SV3VsRRwrUkKz'
    
    print(f'Analyzing MAINNET wallet: {address}')
    print('=' * 50)
    
    result = await orchestrator.analyze_wallet(address, lookback_days=7)
    
    print(f"Risk Score: {result.get('risk_score')}/100")
    print(f"Risk Level: {result.get('risk_level')}")
    print(f"Counterparties: {result.get('metrics', {}).get('counterparty_count')}")
    print(f"Concentration: {result.get('metrics', {}).get('concentration', 0):.2%}")
    print(f"Stablecoin Ratio: {result.get('metrics', {}).get('stablecoin_ratio', 0):.2%}")
    
    if result.get('deductions'):
        print(f"\nRisk Deductions:")
        for d in result['deductions']:
            print(f"  - {d.get('reason')}: -{d.get('penalty')} points")
    
    if result.get('suspicious_patterns'):
        print(f"\nSuspicious Patterns Found:")
        for p in result['suspicious_patterns']:
            print(f"  - {p.get('type')}: {p.get('detail', '')}")
    
    print(f"\nComputation Times:")
    for node, info in result.get('computation_graph', {}).items():
        print(f"  {info['name']}: {info['duration_ms']:.2f}ms")


async def test_testnet():
    """Test with testnet wallet."""
    from src.graph_orchestrator import analyze_wallet
    
    address = 'NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ'
    print(f'Analyzing TESTNET wallet: {address}')
    print('=' * 50)
    
    result = await analyze_wallet(address, lookback_days=30)
    print(json.dumps(result, indent=2, default=str))


async def test_caching():
    """Test that caching works (second call should be faster)."""
    from src.graph_orchestrator import analyze_wallet, WalletDataCache
    
    address = 'NikhQp1aAD1YFCiwknhM5LQQebj4464bCJ'
    
    print("First call (should hit RPC):")
    import time
    start = time.time()
    result1 = await analyze_wallet(address, lookback_days=30)
    print(f"  Duration: {(time.time() - start)*1000:.2f}ms")
    
    print("\nSecond call (should use cache):")
    start = time.time()
    result2 = await analyze_wallet(address, lookback_days=30)
    print(f"  Duration: {(time.time() - start)*1000:.2f}ms")
    
    print("\nCache is working!" if result1 == result2 else "Results differ!")


if __name__ == "__main__":
    print("=" * 60)
    print("WALLET GUARDIAN - GRAPH ORCHESTRATOR TEST")
    print("=" * 60)
    
    # Run testnet test
    print("\n[1] TESTNET TEST\n")
    asyncio.run(test_testnet())
    
    # Run caching test
    print("\n[2] CACHING TEST\n")
    asyncio.run(test_caching())
    
    # Run mainnet test
    print("\n[3] MAINNET TEST\n")
    asyncio.run(test_mainnet())
