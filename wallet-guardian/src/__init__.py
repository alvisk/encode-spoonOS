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

# Advanced features
from .advanced_features import (
    # Real-time monitoring
    RealTimeMonitor,
    WalletEvent,
    WalletEventType,
    create_monitor,
    
    # Portfolio analysis
    PortfolioAnalyzer,
    PortfolioAnalysis,
    PortfolioWallet,
    analyze_portfolio,
    
    # Predictive risk
    PredictiveRiskAnalyzer,
    RiskTrend,
    predict_risk,
    
    # Relationship graph
    WalletRelationshipAnalyzer,
    RelationshipGraph,
    WalletNode,
    WalletEdge,
    build_relationship_graph,
    
    # Smart alerts
    SmartAlertSystem,
    Alert,
    AlertRule,
    AlertPriority,
    AlertType,
    create_alert_system,
)

# Voice Guardian - ElevenLabs integration
from .voice_guardian import (
    VoiceGuardian,
    VoiceAlertSystem,
    VoicePersona,
    AlertSeverity,
    VoiceConfig,
    ElevenLabsClient,
    get_voice_guardian,
    speak_alert,
    speak_inspection_result,
    speak_wallet_summary,
    audio_to_base64,
    create_audio_message,
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
    
    # Advanced Features - Real-time monitoring
    "RealTimeMonitor",
    "WalletEvent",
    "WalletEventType",
    "create_monitor",
    
    # Advanced Features - Portfolio analysis
    "PortfolioAnalyzer",
    "PortfolioAnalysis",
    "PortfolioWallet",
    "analyze_portfolio",
    
    # Advanced Features - Predictive risk
    "PredictiveRiskAnalyzer",
    "RiskTrend",
    "predict_risk",
    
    # Advanced Features - Relationship graph
    "WalletRelationshipAnalyzer",
    "RelationshipGraph",
    "WalletNode",
    "WalletEdge",
    "build_relationship_graph",
    
    # Advanced Features - Smart alerts
    "SmartAlertSystem",
    "Alert",
    "AlertRule",
    "AlertPriority",
    "AlertType",
    "create_alert_system",
    
    # Voice Guardian - ElevenLabs integration
    "VoiceGuardian",
    "VoiceAlertSystem",
    "VoicePersona",
    "AlertSeverity",
    "get_voice_guardian",
    "speak_alert",
    "speak_inspection_result",
    "speak_wallet_summary",
]





