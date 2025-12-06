# Package init for the SpoonOS agent prototype.

# Core clients
from .neo_client import NeoClient, NeoRPCError

# Suspicious transaction inspector
from .SusInspector import SusInspector, inspect_wallet_for_suspicious_activity, SuspicionLevel

# Graph-based multi-agent orchestrator (main entry point)
from .graph_orchestrator import (
    # Orchestrator
    MultiAgentOrchestrator,
    get_orchestrator,
    analyze_wallet,
    query_guardian,
    
    # Computation graph components
    ComputationGraph,
    ComputationNode,
    ComputationResult,
    NodeState,
    WalletAnalysisGraphBuilder,
    
    # Shared data infrastructure
    WalletDataCache,
    UnifiedDataFetcher,
    
    # Computation functions (canonical implementations)
    compute_concentration,
    compute_stablecoin_ratio,
    extract_counterparties,
    detect_suspicious_patterns,
    compute_risk_score,
)

__all__ = [
    # Clients
    "NeoClient",
    "NeoRPCError",
    
    # Inspector
    "SusInspector",
    "inspect_wallet_for_suspicious_activity",
    "SuspicionLevel",
    
    # Orchestrator
    "MultiAgentOrchestrator",
    "get_orchestrator",
    "analyze_wallet",
    "query_guardian",
    
    # Graph components
    "ComputationGraph",
    "ComputationNode", 
    "ComputationResult",
    "NodeState",
    "WalletAnalysisGraphBuilder",
    
    # Data infrastructure
    "WalletDataCache",
    "UnifiedDataFetcher",
    
    # Computation functions
    "compute_concentration",
    "compute_stablecoin_ratio",
    "extract_counterparties",
    "detect_suspicious_patterns",
    "compute_risk_score",
]





