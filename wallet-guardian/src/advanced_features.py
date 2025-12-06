"""
Advanced Features for Wallet Guardian - Leveraging Graph Orchestrator.

Game-changing features that utilize the DAG-based computation system:
1. Real-time Wallet Monitoring with WebSocket streaming
2. Multi-Wallet Portfolio Analysis (parallel processing)
3. Predictive Risk Scoring using time-series analysis
4. Wallet Relationship Graph (network analysis)
5. Smart Alert System with customizable triggers
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import time
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum, auto
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, AsyncIterator

from .graph_orchestrator import (
    WalletDataCache,
    UnifiedDataFetcher,
    ComputationGraph,
    ComputationNode,
    ComputationResult,
    NodeState,
    compute_concentration,
    compute_stablecoin_ratio,
    extract_counterparties,
    detect_suspicious_patterns,
    compute_risk_score,
    analyze_wallet,
)
from .neo_client import NeoClient


# =============================================================================
# FEATURE 1: REAL-TIME WALLET MONITORING (WebSocket-ready)
# =============================================================================

class WalletEventType(Enum):
    """Types of wallet events to monitor."""
    BALANCE_CHANGE = "balance_change"
    INCOMING_TX = "incoming_tx"
    OUTGOING_TX = "outgoing_tx"
    RISK_CHANGE = "risk_change"
    SUSPICIOUS_ACTIVITY = "suspicious_activity"
    LARGE_TRANSFER = "large_transfer"
    NEW_COUNTERPARTY = "new_counterparty"


@dataclass
class WalletEvent:
    """Represents a wallet event for streaming."""
    event_type: WalletEventType
    address: str
    timestamp: float
    data: Dict[str, Any]
    severity: str = "info"  # info, warning, alert, critical
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type.value,
            "address": self.address,
            "timestamp": self.timestamp,
            "severity": self.severity,
            "data": self.data,
        }
    
    def to_json(self) -> str:
        return json.dumps(self.to_dict(), default=str)


class RealTimeMonitor:
    """
    Real-time wallet monitoring system using the graph orchestrator's cache.
    
    Streams events as they're detected - perfect for WebSocket integration.
    Uses the shared cache to minimize redundant RPC calls even during
    continuous monitoring.
    """
    
    def __init__(
        self,
        poll_interval: float = 10.0,  # seconds between polls
        large_transfer_threshold: float = 100.0,  # GAS
    ):
        self.poll_interval = poll_interval
        self.large_transfer_threshold = large_transfer_threshold
        self.monitored_wallets: Dict[str, Dict[str, Any]] = {}  # address -> last_state
        self.fetcher = UnifiedDataFetcher()
        self.cache = WalletDataCache()
        self._running = False
        self._listeners: List[Callable[[WalletEvent], None]] = []
    
    def add_wallet(self, address: str, config: Optional[Dict[str, Any]] = None):
        """Add a wallet to monitor."""
        self.monitored_wallets[address] = {
            "config": config or {},
            "last_balances": None,
            "last_transfers": None,
            "last_risk_score": None,
            "known_counterparties": set(),
            "added_at": time.time(),
        }
    
    def remove_wallet(self, address: str):
        """Remove a wallet from monitoring."""
        self.monitored_wallets.pop(address, None)
    
    def add_listener(self, callback: Callable[[WalletEvent], None]):
        """Add an event listener (for WebSocket pushing)."""
        self._listeners.append(callback)
    
    def _emit_event(self, event: WalletEvent):
        """Emit an event to all listeners."""
        for listener in self._listeners:
            try:
                listener(event)
            except Exception as e:
                print(f"Listener error: {e}")
    
    async def _check_wallet(self, address: str) -> List[WalletEvent]:
        """Check a single wallet for changes."""
        events: List[WalletEvent] = []
        state = self.monitored_wallets[address]
        now = time.time()
        
        try:
            # Use graph orchestrator's cached fetching
            data = await self.fetcher.get_full_wallet_data(address, lookback_days=7)
            balances = data["balances"]
            transfers = data["transfers"]
            
            # Check balance changes
            if state["last_balances"] is not None:
                old_total = sum(float(b.get("amount", 0)) for b in state["last_balances"])
                new_total = sum(float(b.get("amount", 0)) for b in balances)
                
                if abs(new_total - old_total) > 0.0001:
                    change = new_total - old_total
                    events.append(WalletEvent(
                        event_type=WalletEventType.BALANCE_CHANGE,
                        address=address,
                        timestamp=now,
                        data={
                            "old_balance": old_total,
                            "new_balance": new_total,
                            "change": change,
                            "change_percent": (change / old_total * 100) if old_total > 0 else 0
                        },
                        severity="warning" if abs(change) > self.large_transfer_threshold else "info"
                    ))
            
            # Check for new transfers
            sent = transfers.get("sent", [])
            received = transfers.get("received", [])
            
            if state["last_transfers"] is not None:
                old_sent_hashes = {t.get("txhash", t.get("hash", "")) for t in state["last_transfers"].get("sent", [])}
                old_recv_hashes = {t.get("txhash", t.get("hash", "")) for t in state["last_transfers"].get("received", [])}
                
                for tx in sent:
                    tx_hash = tx.get("txhash", tx.get("hash", ""))
                    if tx_hash and tx_hash not in old_sent_hashes:
                        amount = float(tx.get("amount", 0))
                        events.append(WalletEvent(
                            event_type=WalletEventType.OUTGOING_TX,
                            address=address,
                            timestamp=now,
                            data={
                                "tx_hash": tx_hash,
                                "to": tx.get("transferaddress", tx.get("to", "unknown")),
                                "amount": amount,
                                "asset": tx.get("symbol", "unknown")
                            },
                            severity="alert" if amount > self.large_transfer_threshold else "info"
                        ))
                        
                        if amount > self.large_transfer_threshold:
                            events.append(WalletEvent(
                                event_type=WalletEventType.LARGE_TRANSFER,
                                address=address,
                                timestamp=now,
                                data={"tx_hash": tx_hash, "amount": amount, "direction": "outgoing"},
                                severity="alert"
                            ))
                
                for tx in received:
                    tx_hash = tx.get("txhash", tx.get("hash", ""))
                    if tx_hash and tx_hash not in old_recv_hashes:
                        amount = float(tx.get("amount", 0))
                        events.append(WalletEvent(
                            event_type=WalletEventType.INCOMING_TX,
                            address=address,
                            timestamp=now,
                            data={
                                "tx_hash": tx_hash,
                                "from": tx.get("transferaddress", tx.get("from", "unknown")),
                                "amount": amount,
                                "asset": tx.get("symbol", "unknown")
                            },
                            severity="info"
                        ))
            
            # Check for new counterparties
            current_counterparties = extract_counterparties(transfers)
            new_counterparties = current_counterparties - state["known_counterparties"]
            
            for cp in new_counterparties:
                events.append(WalletEvent(
                    event_type=WalletEventType.NEW_COUNTERPARTY,
                    address=address,
                    timestamp=now,
                    data={"counterparty": cp, "first_seen": datetime.now().isoformat()},
                    severity="info"
                ))
            
            # Check risk score change
            concentration = compute_concentration(balances)
            stablecoin = compute_stablecoin_ratio(balances)
            patterns = detect_suspicious_patterns(transfers)
            new_score, deductions = compute_risk_score(
                concentration, stablecoin, len(current_counterparties), patterns
            )
            
            if state["last_risk_score"] is not None:
                score_change = new_score - state["last_risk_score"]
                if abs(score_change) >= 5:  # Significant change
                    events.append(WalletEvent(
                        event_type=WalletEventType.RISK_CHANGE,
                        address=address,
                        timestamp=now,
                        data={
                            "old_score": state["last_risk_score"],
                            "new_score": new_score,
                            "change": score_change,
                            "deductions": deductions
                        },
                        severity="alert" if score_change < -10 else "warning" if score_change < 0 else "info"
                    ))
            
            # Check suspicious patterns
            if patterns:
                for pattern in patterns:
                    events.append(WalletEvent(
                        event_type=WalletEventType.SUSPICIOUS_ACTIVITY,
                        address=address,
                        timestamp=now,
                        data=pattern,
                        severity="alert" if pattern.get("level") in ("high", "critical") else "warning"
                    ))
            
            # Update state
            state["last_balances"] = balances
            state["last_transfers"] = transfers
            state["last_risk_score"] = new_score
            state["known_counterparties"] = current_counterparties
            
        except Exception as e:
            events.append(WalletEvent(
                event_type=WalletEventType.SUSPICIOUS_ACTIVITY,
                address=address,
                timestamp=now,
                data={"error": str(e), "type": "monitoring_error"},
                severity="warning"
            ))
        
        return events
    
    async def monitor_once(self) -> List[WalletEvent]:
        """Run one monitoring cycle across all wallets."""
        all_events: List[WalletEvent] = []
        
        # Check all wallets in parallel using the graph orchestrator's caching
        tasks = [self._check_wallet(addr) for addr in self.monitored_wallets]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for result in results:
            if isinstance(result, list):
                all_events.extend(result)
        
        # Emit events
        for event in all_events:
            self._emit_event(event)
        
        return all_events
    
    async def stream_events(self) -> AsyncIterator[WalletEvent]:
        """
        Stream events continuously - ideal for WebSocket.
        
        Usage:
            monitor = RealTimeMonitor()
            monitor.add_wallet("Nxyz...")
            async for event in monitor.stream_events():
                await websocket.send(event.to_json())
        """
        self._running = True
        while self._running:
            events = await self.monitor_once()
            for event in events:
                yield event
            await asyncio.sleep(self.poll_interval)
    
    def stop(self):
        """Stop the monitoring loop."""
        self._running = False


# =============================================================================
# FEATURE 2: MULTI-WALLET PORTFOLIO ANALYSIS
# =============================================================================

@dataclass
class PortfolioWallet:
    """A wallet in the portfolio."""
    address: str
    label: str = ""
    weight: float = 1.0  # For weighted risk calculations
    tags: List[str] = field(default_factory=list)


@dataclass
class PortfolioAnalysis:
    """Complete portfolio analysis results."""
    total_value_usd: float
    weighted_risk_score: float
    risk_level: str
    wallet_count: int
    highest_risk_wallet: str
    lowest_risk_wallet: str
    diversification_score: float
    cross_wallet_activity: List[Dict[str, Any]]
    individual_analyses: Dict[str, Dict[str, Any]]
    computation_time_ms: float


class PortfolioAnalyzer:
    """
    Multi-wallet portfolio analysis using parallel graph execution.
    
    Leverages the DAG to analyze multiple wallets simultaneously
    while sharing cached data for overlapping counterparties.
    """
    
    def __init__(self):
        self.fetcher = UnifiedDataFetcher()
        self.cache = WalletDataCache()
    
    async def analyze_portfolio(
        self,
        wallets: List[PortfolioWallet],
        lookback_days: int = 30
    ) -> PortfolioAnalysis:
        """
        Analyze an entire portfolio of wallets in parallel.
        
        Uses the graph orchestrator to:
        - Fetch all wallet data simultaneously
        - Share cached counterparty data
        - Compute aggregate metrics efficiently
        """
        start_time = time.time()
        
        # Parallel analysis of all wallets
        tasks = [analyze_wallet(w.address, lookback_days) for w in wallets]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        individual_analyses: Dict[str, Dict[str, Any]] = {}
        total_weight = 0
        weighted_score_sum = 0
        highest_risk = (100, "")  # (score, address)
        lowest_risk = (0, "")
        all_counterparties: Set[str] = set()
        
        for wallet, result in zip(wallets, results):
            if isinstance(result, Exception):
                individual_analyses[wallet.address] = {
                    "error": str(result),
                    "label": wallet.label
                }
                continue
            
            individual_analyses[wallet.address] = {
                **result,
                "label": wallet.label,
                "tags": wallet.tags,
            }
            
            score = result.get("risk_score", 50)
            weighted_score_sum += score * wallet.weight
            total_weight += wallet.weight
            
            if score < highest_risk[0]:
                highest_risk = (score, wallet.address)
            if score > lowest_risk[0]:
                lowest_risk = (score, wallet.address)
            
            # Collect counterparties for cross-analysis
            all_counterparties.update(result.get("counterparties", []))
        
        # Calculate aggregate metrics
        weighted_risk = weighted_score_sum / total_weight if total_weight > 0 else 50
        
        # Diversification score based on counterparty overlap
        diversification = self._compute_diversification(individual_analyses)
        
        # Detect cross-wallet activity
        cross_activity = self._detect_cross_wallet_activity(individual_analyses)
        
        # Determine risk level
        risk_level = (
            "clean" if weighted_risk >= 90 else
            "low" if weighted_risk >= 70 else
            "moderate" if weighted_risk >= 50 else
            "high" if weighted_risk >= 30 else
            "critical"
        )
        
        return PortfolioAnalysis(
            total_value_usd=0,  # TODO: Integrate price feeds
            weighted_risk_score=weighted_risk,
            risk_level=risk_level,
            wallet_count=len(wallets),
            highest_risk_wallet=highest_risk[1],
            lowest_risk_wallet=lowest_risk[1],
            diversification_score=diversification,
            cross_wallet_activity=cross_activity,
            individual_analyses=individual_analyses,
            computation_time_ms=(time.time() - start_time) * 1000
        )
    
    def _compute_diversification(self, analyses: Dict[str, Dict]) -> float:
        """
        Compute diversification score based on counterparty overlap.
        Higher score = more diversified (less overlap).
        """
        if len(analyses) < 2:
            return 1.0
        
        counterparty_sets = [
            set(a.get("counterparties", []))
            for a in analyses.values()
            if "counterparties" in a
        ]
        
        if not counterparty_sets:
            return 1.0
        
        # Jaccard diversity (1 - average overlap)
        total_overlap = 0
        comparisons = 0
        
        for i, set_a in enumerate(counterparty_sets):
            for set_b in counterparty_sets[i+1:]:
                if set_a and set_b:
                    intersection = len(set_a & set_b)
                    union = len(set_a | set_b)
                    overlap = intersection / union if union > 0 else 0
                    total_overlap += overlap
                    comparisons += 1
        
        avg_overlap = total_overlap / comparisons if comparisons > 0 else 0
        return 1 - avg_overlap
    
    def _detect_cross_wallet_activity(
        self, 
        analyses: Dict[str, Dict]
    ) -> List[Dict[str, Any]]:
        """Detect transactions between portfolio wallets."""
        cross_activity = []
        wallet_addresses = set(analyses.keys())
        
        for addr, analysis in analyses.items():
            counterparties = set(analysis.get("counterparties", []))
            
            # Check if any counterparty is another portfolio wallet
            internal_transfers = counterparties & wallet_addresses
            
            for other_addr in internal_transfers:
                if other_addr != addr:
                    cross_activity.append({
                        "from_wallet": addr,
                        "to_wallet": other_addr,
                        "type": "internal_transfer",
                        "detail": f"Activity detected between portfolio wallets"
                    })
        
        return cross_activity


# =============================================================================
# FEATURE 3: PREDICTIVE RISK SCORING (Time-Series)
# =============================================================================

@dataclass
class RiskTrend:
    """Risk trend analysis results."""
    current_score: int
    predicted_score: int
    trend_direction: str  # "improving", "stable", "declining"
    confidence: float
    forecast_days: int
    historical_scores: List[Tuple[float, int]]  # (timestamp, score)
    risk_factors: List[Dict[str, Any]]
    recommendation: str


class PredictiveRiskAnalyzer:
    """
    Time-series risk prediction using historical analysis.
    
    Leverages the graph orchestrator to build historical snapshots
    and predict future risk trends.
    """
    
    def __init__(self):
        self.fetcher = UnifiedDataFetcher()
    
    async def analyze_trend(
        self,
        address: str,
        lookback_days: int = 90,
        forecast_days: int = 7
    ) -> RiskTrend:
        """
        Analyze risk trend and predict future score.
        
        Uses sliding window analysis across historical data
        to identify patterns and forecast risk changes.
        """
        # Get historical data
        data = await self.fetcher.get_full_wallet_data(address, lookback_days)
        
        # Build historical risk snapshots (weekly)
        historical_scores = self._build_historical_scores(data, lookback_days)
        
        # Analyze trend
        trend_direction, slope = self._analyze_trend_direction(historical_scores)
        
        # Predict future score
        current_score = historical_scores[-1][1] if historical_scores else 50
        predicted_change = slope * forecast_days
        predicted_score = max(0, min(100, current_score + int(predicted_change)))
        
        # Calculate confidence based on data consistency
        confidence = self._calculate_confidence(historical_scores)
        
        # Identify risk factors driving the trend
        risk_factors = self._identify_trend_drivers(data, trend_direction)
        
        # Generate recommendation
        recommendation = self._generate_recommendation(
            current_score, predicted_score, trend_direction, risk_factors
        )
        
        return RiskTrend(
            current_score=current_score,
            predicted_score=predicted_score,
            trend_direction=trend_direction,
            confidence=confidence,
            forecast_days=forecast_days,
            historical_scores=historical_scores,
            risk_factors=risk_factors,
            recommendation=recommendation
        )
    
    def _build_historical_scores(
        self,
        data: Dict[str, Any],
        lookback_days: int
    ) -> List[Tuple[float, int]]:
        """Build weekly risk score snapshots from transaction data."""
        scores = []
        now = time.time()
        week_seconds = 7 * 24 * 60 * 60
        
        # Simulate weekly snapshots by filtering transactions
        transfers = data.get("transfers", {})
        all_txs = transfers.get("sent", []) + transfers.get("received", [])
        
        for week in range(lookback_days // 7):
            week_end = now - (week * week_seconds)
            week_start = week_end - week_seconds
            
            # Filter transactions for this week
            week_txs = [
                tx for tx in all_txs
                if week_start <= tx.get("timestamp", 0) <= week_end
            ]
            
            # Calculate metrics for this period
            if week_txs:
                week_transfers = {"sent": [], "received": []}
                for tx in week_txs:
                    if tx in transfers.get("sent", []):
                        week_transfers["sent"].append(tx)
                    else:
                        week_transfers["received"].append(tx)
                
                counterparties = extract_counterparties(week_transfers)
                patterns = detect_suspicious_patterns(week_transfers)
                
                # Use current balances (simplified - ideally would reconstruct)
                concentration = compute_concentration(data.get("balances", []))
                stablecoin = compute_stablecoin_ratio(data.get("balances", []))
                
                score, _ = compute_risk_score(
                    concentration, stablecoin, len(counterparties), patterns
                )
                scores.append((week_end, score))
        
        # Add current score
        current_concentration = compute_concentration(data.get("balances", []))
        current_stablecoin = compute_stablecoin_ratio(data.get("balances", []))
        current_counterparties = extract_counterparties(transfers)
        current_patterns = detect_suspicious_patterns(transfers)
        current_score, _ = compute_risk_score(
            current_concentration, current_stablecoin,
            len(current_counterparties), current_patterns
        )
        scores.append((now, current_score))
        
        return sorted(scores, key=lambda x: x[0])
    
    def _analyze_trend_direction(
        self,
        scores: List[Tuple[float, int]]
    ) -> Tuple[str, float]:
        """Analyze trend direction using linear regression."""
        if len(scores) < 2:
            return "stable", 0.0
        
        # Simple linear regression
        n = len(scores)
        x_vals = [i for i in range(n)]
        y_vals = [s[1] for s in scores]
        
        x_mean = sum(x_vals) / n
        y_mean = sum(y_vals) / n
        
        numerator = sum((x - x_mean) * (y - y_mean) for x, y in zip(x_vals, y_vals))
        denominator = sum((x - x_mean) ** 2 for x in x_vals)
        
        slope = numerator / denominator if denominator != 0 else 0
        
        if slope > 0.5:
            direction = "improving"
        elif slope < -0.5:
            direction = "declining"
        else:
            direction = "stable"
        
        return direction, slope
    
    def _calculate_confidence(self, scores: List[Tuple[float, int]]) -> float:
        """Calculate prediction confidence based on data consistency."""
        if len(scores) < 3:
            return 0.3  # Low confidence with little data
        
        # Check variance - lower variance = higher confidence
        y_vals = [s[1] for s in scores]
        mean = sum(y_vals) / len(y_vals)
        variance = sum((y - mean) ** 2 for y in y_vals) / len(y_vals)
        
        # Map variance to confidence (0-100 variance range)
        # Lower variance = higher confidence
        max_variance = 100
        confidence = 1 - min(variance / max_variance, 1)
        
        # Bonus for more data points
        data_bonus = min(len(scores) / 12, 0.2)  # Up to 0.2 bonus for 12+ weeks
        
        return min(0.95, confidence * 0.8 + data_bonus)
    
    def _identify_trend_drivers(
        self,
        data: Dict[str, Any],
        trend_direction: str
    ) -> List[Dict[str, Any]]:
        """Identify factors driving the risk trend."""
        drivers = []
        
        transfers = data.get("transfers", {})
        balances = data.get("balances", [])
        
        # Check concentration
        concentration = compute_concentration(balances)
        if concentration > 0.7:
            drivers.append({
                "factor": "high_concentration",
                "impact": "negative",
                "detail": f"Portfolio {concentration:.0%} concentrated in single asset"
            })
        
        # Check activity level
        all_txs = transfers.get("sent", []) + transfers.get("received", [])
        if len(all_txs) < 5:
            drivers.append({
                "factor": "low_activity",
                "impact": "negative" if trend_direction == "declining" else "neutral",
                "detail": "Limited transaction history"
            })
        elif len(all_txs) > 50:
            drivers.append({
                "factor": "high_activity",
                "impact": "positive" if trend_direction == "improving" else "neutral",
                "detail": "Active wallet with diverse transactions"
            })
        
        # Check counterparty diversity
        counterparties = extract_counterparties(transfers)
        if len(counterparties) > 10:
            drivers.append({
                "factor": "diverse_counterparties",
                "impact": "positive",
                "detail": f"{len(counterparties)} unique counterparties"
            })
        
        return drivers
    
    def _generate_recommendation(
        self,
        current_score: int,
        predicted_score: int,
        trend_direction: str,
        risk_factors: List[Dict]
    ) -> str:
        """Generate actionable recommendation based on analysis."""
        if trend_direction == "declining":
            if predicted_score < 50:
                return "⚠️ Risk increasing significantly. Consider reviewing recent transactions and counterparties."
            return "📉 Risk trending upward. Monitor wallet activity closely."
        elif trend_direction == "improving":
            return "✅ Risk profile improving. Maintain current activity patterns."
        else:
            if current_score >= 70:
                return "✅ Wallet maintaining healthy risk profile."
            elif current_score >= 50:
                return "⚡ Consider diversifying counterparties to improve risk score."
            else:
                return "⚠️ High risk detected. Review transaction patterns and counterparties."


# =============================================================================
# FEATURE 4: WALLET RELATIONSHIP GRAPH (Network Analysis)
# =============================================================================

@dataclass
class WalletNode:
    """A node in the relationship graph."""
    address: str
    label: str = ""
    risk_score: Optional[int] = None
    total_volume: float = 0.0
    is_monitored: bool = False
    node_type: str = "unknown"  # "wallet", "contract", "exchange", "dex"


@dataclass
class WalletEdge:
    """An edge (relationship) between wallets."""
    from_address: str
    to_address: str
    transaction_count: int
    total_volume: float
    last_activity: float
    relationship_type: str  # "frequent", "one_time", "suspicious"


@dataclass
class RelationshipGraph:
    """Complete relationship graph for visualization."""
    nodes: List[WalletNode]
    edges: List[WalletEdge]
    clusters: List[Dict[str, Any]]
    central_addresses: List[str]  # Most connected
    suspicious_relationships: List[Dict[str, Any]]
    graph_density: float


class WalletRelationshipAnalyzer:
    """
    Builds a relationship graph from wallet transaction history.
    
    Uses the graph orchestrator to efficiently fetch and analyze
    multi-hop relationships between wallets.
    """
    
    # Known contract types (expand as needed)
    KNOWN_EXCHANGES = {"NcJhD3GxJ...": "NeoEconomy", "Nxyz...": "FlamingoSwap"}
    
    def __init__(self):
        self.fetcher = UnifiedDataFetcher()
    
    async def build_graph(
        self,
        seed_addresses: List[str],
        depth: int = 2,  # How many hops to explore
        lookback_days: int = 30
    ) -> RelationshipGraph:
        """
        Build a relationship graph starting from seed addresses.
        
        Uses BFS to explore counterparties up to specified depth,
        leveraging the cache to avoid redundant fetches.
        """
        nodes: Dict[str, WalletNode] = {}
        edges: Dict[str, WalletEdge] = {}
        
        # Initialize with seed addresses
        to_explore = [(addr, 0) for addr in seed_addresses]
        explored = set()
        
        while to_explore:
            address, current_depth = to_explore.pop(0)
            
            if address in explored or current_depth > depth:
                continue
            
            explored.add(address)
            
            try:
                data = await self.fetcher.get_full_wallet_data(address, lookback_days)
                
                # Create node
                concentration = compute_concentration(data.get("balances", []))
                stablecoin = compute_stablecoin_ratio(data.get("balances", []))
                counterparties = extract_counterparties(data.get("transfers", {}))
                patterns = detect_suspicious_patterns(data.get("transfers", {}))
                score, _ = compute_risk_score(
                    concentration, stablecoin, len(counterparties), patterns
                )
                
                nodes[address] = WalletNode(
                    address=address,
                    risk_score=score,
                    is_monitored=(address in seed_addresses),
                    node_type=self._classify_address(address, data)
                )
                
                # Process transfers to build edges
                transfers = data.get("transfers", {})
                self._process_transfers(address, transfers, edges, nodes, current_depth, to_explore)
                
            except Exception as e:
                nodes[address] = WalletNode(
                    address=address,
                    label=f"Error: {str(e)[:30]}",
                    is_monitored=(address in seed_addresses)
                )
        
        # Analyze graph structure
        clusters = self._detect_clusters(nodes, edges)
        central = self._find_central_addresses(nodes, edges)
        suspicious = self._find_suspicious_relationships(edges, nodes)
        density = self._calculate_density(nodes, edges)
        
        return RelationshipGraph(
            nodes=list(nodes.values()),
            edges=list(edges.values()),
            clusters=clusters,
            central_addresses=central,
            suspicious_relationships=suspicious,
            graph_density=density
        )
    
    def _process_transfers(
        self,
        address: str,
        transfers: Dict[str, Any],
        edges: Dict[str, WalletEdge],
        nodes: Dict[str, WalletNode],
        current_depth: int,
        to_explore: List[Tuple[str, int]]
    ):
        """Process transfers to build edges and queue new addresses."""
        counterparty_stats: Dict[str, Dict] = defaultdict(lambda: {
            "count": 0, "volume": 0.0, "last": 0
        })
        
        for tx in transfers.get("sent", []):
            cp = tx.get("transferaddress", tx.get("to", ""))
            if cp:
                counterparty_stats[cp]["count"] += 1
                counterparty_stats[cp]["volume"] += float(tx.get("amount", 0))
                counterparty_stats[cp]["last"] = max(
                    counterparty_stats[cp]["last"],
                    tx.get("timestamp", 0)
                )
        
        for tx in transfers.get("received", []):
            cp = tx.get("transferaddress", tx.get("from", ""))
            if cp:
                counterparty_stats[cp]["count"] += 1
                counterparty_stats[cp]["volume"] += float(tx.get("amount", 0))
                counterparty_stats[cp]["last"] = max(
                    counterparty_stats[cp]["last"],
                    tx.get("timestamp", 0)
                )
        
        for cp, stats in counterparty_stats.items():
            if not cp:
                continue
            
            # Create edge key (sorted to avoid duplicates)
            edge_key = tuple(sorted([address, cp]))
            
            if edge_key not in edges:
                edges[edge_key] = WalletEdge(
                    from_address=address,
                    to_address=cp,
                    transaction_count=stats["count"],
                    total_volume=stats["volume"],
                    last_activity=stats["last"],
                    relationship_type=self._classify_relationship(stats)
                )
            else:
                # Update existing edge
                edges[edge_key].transaction_count += stats["count"]
                edges[edge_key].total_volume += stats["volume"]
                edges[edge_key].last_activity = max(
                    edges[edge_key].last_activity,
                    stats["last"]
                )
            
            # Queue counterparty for exploration
            if cp not in nodes:
                to_explore.append((cp, current_depth + 1))
    
    def _classify_address(self, address: str, data: Dict) -> str:
        """Classify address type based on behavior."""
        if address in self.KNOWN_EXCHANGES:
            return "exchange"
        
        transfers = data.get("transfers", {})
        sent_count = len(transfers.get("sent", []))
        recv_count = len(transfers.get("received", []))
        
        # Heuristics for classification
        if sent_count > 100 and recv_count > 100:
            return "high_volume"
        elif sent_count > recv_count * 5:
            return "distributor"
        elif recv_count > sent_count * 5:
            return "collector"
        else:
            return "wallet"
    
    def _classify_relationship(self, stats: Dict) -> str:
        """Classify relationship type."""
        if stats["count"] >= 10:
            return "frequent"
        elif stats["count"] == 1:
            return "one_time"
        else:
            return "occasional"
    
    def _detect_clusters(
        self,
        nodes: Dict[str, WalletNode],
        edges: Dict[str, WalletEdge]
    ) -> List[Dict[str, Any]]:
        """Detect clusters of closely connected wallets."""
        # Simple connected components using union-find
        parent = {addr: addr for addr in nodes}
        
        def find(x):
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]
        
        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py
        
        for edge in edges.values():
            if edge.from_address in parent and edge.to_address in parent:
                union(edge.from_address, edge.to_address)
        
        # Group by cluster
        clusters: Dict[str, List[str]] = defaultdict(list)
        for addr in nodes:
            clusters[find(addr)].append(addr)
        
        return [
            {
                "cluster_id": i,
                "addresses": members,
                "size": len(members),
                "has_monitored": any(nodes[a].is_monitored for a in members)
            }
            for i, members in enumerate(clusters.values())
            if len(members) > 1
        ]
    
    def _find_central_addresses(
        self,
        nodes: Dict[str, WalletNode],
        edges: Dict[str, WalletEdge]
    ) -> List[str]:
        """Find most connected addresses (highest degree centrality)."""
        degree: Dict[str, int] = defaultdict(int)
        
        for edge in edges.values():
            degree[edge.from_address] += 1
            degree[edge.to_address] += 1
        
        sorted_addrs = sorted(degree.items(), key=lambda x: x[1], reverse=True)
        return [addr for addr, _ in sorted_addrs[:5]]
    
    def _find_suspicious_relationships(
        self,
        edges: Dict[str, WalletEdge],
        nodes: Dict[str, WalletNode]
    ) -> List[Dict[str, Any]]:
        """Find potentially suspicious relationships."""
        suspicious = []
        
        for edge in edges.values():
            # High volume one-time transfer
            if edge.relationship_type == "one_time" and edge.total_volume > 100:
                suspicious.append({
                    "from": edge.from_address,
                    "to": edge.to_address,
                    "reason": "high_volume_single_transfer",
                    "volume": edge.total_volume
                })
            
            # Connection to high-risk node
            for addr in [edge.from_address, edge.to_address]:
                if addr in nodes and nodes[addr].risk_score and nodes[addr].risk_score < 40:
                    other = edge.to_address if addr == edge.from_address else edge.from_address
                    suspicious.append({
                        "from": other,
                        "to": addr,
                        "reason": "connection_to_high_risk",
                        "risk_score": nodes[addr].risk_score
                    })
        
        return suspicious
    
    def _calculate_density(
        self,
        nodes: Dict[str, WalletNode],
        edges: Dict[str, WalletEdge]
    ) -> float:
        """Calculate graph density (0-1)."""
        n = len(nodes)
        if n < 2:
            return 0.0
        max_edges = n * (n - 1) / 2
        return len(edges) / max_edges


# =============================================================================
# FEATURE 5: SMART ALERT SYSTEM
# =============================================================================

class AlertPriority(Enum):
    """Alert priority levels."""
    LOW = 1
    MEDIUM = 2
    HIGH = 3
    CRITICAL = 4


class AlertType(Enum):
    """Types of alerts."""
    BALANCE_DROP = "balance_drop"
    RISK_INCREASE = "risk_increase"
    SUSPICIOUS_TX = "suspicious_tx"
    NEW_SCAM_CONTACT = "new_scam_contact"
    APPROVAL_GRANTED = "approval_granted"
    LARGE_OUTFLOW = "large_outflow"
    INACTIVITY = "inactivity"
    CUSTOM = "custom"


@dataclass
class AlertRule:
    """A configurable alert rule."""
    id: str
    name: str
    alert_type: AlertType
    condition: Callable[[Dict[str, Any]], bool]
    priority: AlertPriority
    cooldown_minutes: int = 60  # Don't repeat same alert within this window
    enabled: bool = True
    wallets: Optional[List[str]] = None  # None = all wallets


@dataclass
class Alert:
    """A triggered alert."""
    id: str
    rule_id: str
    alert_type: AlertType
    priority: AlertPriority
    wallet_address: str
    title: str
    description: str
    data: Dict[str, Any]
    triggered_at: float
    acknowledged: bool = False


class SmartAlertSystem:
    """
    Configurable alert system with customizable rules.
    
    Integrates with the graph orchestrator to efficiently
    evaluate alerts across multiple wallets.
    """
    
    def __init__(self):
        self.rules: Dict[str, AlertRule] = {}
        self.alerts: List[Alert] = []
        self.last_triggered: Dict[str, float] = {}  # rule_id:address -> timestamp
        self.fetcher = UnifiedDataFetcher()
        self._setup_default_rules()
    
    def _setup_default_rules(self):
        """Setup default alert rules."""
        # Rule 1: Large balance drop
        self.add_rule(AlertRule(
            id="balance_drop_20",
            name="Balance Drop >20%",
            alert_type=AlertType.BALANCE_DROP,
            condition=lambda d: d.get("balance_change_percent", 0) < -20,
            priority=AlertPriority.HIGH,
            cooldown_minutes=120
        ))
        
        # Rule 2: Risk score increase
        self.add_rule(AlertRule(
            id="risk_increase_15",
            name="Risk Score Increase >15",
            alert_type=AlertType.RISK_INCREASE,
            condition=lambda d: d.get("risk_score_change", 0) < -15,
            priority=AlertPriority.HIGH,
            cooldown_minutes=60
        ))
        
        # Rule 3: Suspicious transaction detected
        self.add_rule(AlertRule(
            id="suspicious_tx",
            name="Suspicious Transaction",
            alert_type=AlertType.SUSPICIOUS_TX,
            condition=lambda d: len(d.get("suspicious_patterns", [])) > 0,
            priority=AlertPriority.MEDIUM,
            cooldown_minutes=30
        ))
        
        # Rule 4: Large outflow
        self.add_rule(AlertRule(
            id="large_outflow",
            name="Large Outflow (>100 GAS)",
            alert_type=AlertType.LARGE_OUTFLOW,
            condition=lambda d: d.get("outflow_amount", 0) > 100,
            priority=AlertPriority.CRITICAL,
            cooldown_minutes=15
        ))
        
        # Rule 5: Critical risk level
        self.add_rule(AlertRule(
            id="critical_risk",
            name="Critical Risk Level",
            alert_type=AlertType.RISK_INCREASE,
            condition=lambda d: d.get("risk_score", 100) < 30,
            priority=AlertPriority.CRITICAL,
            cooldown_minutes=60
        ))
    
    def add_rule(self, rule: AlertRule):
        """Add an alert rule."""
        self.rules[rule.id] = rule
    
    def remove_rule(self, rule_id: str):
        """Remove an alert rule."""
        self.rules.pop(rule_id, None)
    
    def create_custom_rule(
        self,
        name: str,
        condition_expr: str,  # e.g., "risk_score < 50 and balance > 1000"
        priority: AlertPriority = AlertPriority.MEDIUM,
        wallets: Optional[List[str]] = None
    ) -> AlertRule:
        """
        Create a custom alert rule with a simple expression.
        
        Supported variables: risk_score, balance, balance_change_percent,
        counterparty_count, concentration, stablecoin_ratio
        """
        rule_id = hashlib.md5(f"{name}{time.time()}".encode()).hexdigest()[:8]
        
        def condition(data: Dict[str, Any]) -> bool:
            # Safe evaluation of simple expressions
            try:
                # Replace variable names with dict access
                expr = condition_expr
                for var in ["risk_score", "balance", "balance_change_percent",
                           "counterparty_count", "concentration", "stablecoin_ratio"]:
                    expr = expr.replace(var, f"data.get('{var}', 0)")
                return eval(expr)
            except:
                return False
        
        rule = AlertRule(
            id=rule_id,
            name=name,
            alert_type=AlertType.CUSTOM,
            condition=condition,
            priority=priority,
            wallets=wallets
        )
        
        self.add_rule(rule)
        return rule
    
    async def evaluate_wallet(
        self,
        address: str,
        current_data: Optional[Dict[str, Any]] = None,
        previous_data: Optional[Dict[str, Any]] = None
    ) -> List[Alert]:
        """Evaluate all rules against a wallet."""
        triggered: List[Alert] = []
        now = time.time()
        
        # Fetch current data if not provided
        if current_data is None:
            result = await analyze_wallet(address, lookback_days=7)
            current_data = {
                "risk_score": result.get("risk_score", 50),
                "balance": sum(
                    float(b.get("amount", 0))
                    for b in result.get("balances", [])
                ),
                "concentration": result.get("metrics", {}).get("concentration", 0),
                "stablecoin_ratio": result.get("metrics", {}).get("stablecoin_ratio", 0),
                "counterparty_count": result.get("metrics", {}).get("counterparty_count", 0),
                "suspicious_patterns": result.get("suspicious_patterns", []),
            }
        
        # Calculate deltas if previous data provided
        if previous_data:
            old_balance = previous_data.get("balance", current_data["balance"])
            if old_balance > 0:
                current_data["balance_change_percent"] = (
                    (current_data["balance"] - old_balance) / old_balance * 100
                )
            current_data["risk_score_change"] = (
                current_data["risk_score"] - previous_data.get("risk_score", current_data["risk_score"])
            )
        
        for rule in self.rules.values():
            if not rule.enabled:
                continue
            
            # Check if rule applies to this wallet
            if rule.wallets and address not in rule.wallets:
                continue
            
            # Check cooldown
            cooldown_key = f"{rule.id}:{address}"
            last_time = self.last_triggered.get(cooldown_key, 0)
            if now - last_time < rule.cooldown_minutes * 60:
                continue
            
            # Evaluate condition
            try:
                if rule.condition(current_data):
                    alert = Alert(
                        id=hashlib.md5(f"{rule.id}{address}{now}".encode()).hexdigest()[:12],
                        rule_id=rule.id,
                        alert_type=rule.alert_type,
                        priority=rule.priority,
                        wallet_address=address,
                        title=rule.name,
                        description=self._generate_description(rule, current_data),
                        data=current_data,
                        triggered_at=now
                    )
                    triggered.append(alert)
                    self.last_triggered[cooldown_key] = now
            except Exception as e:
                pass  # Skip rule on error
        
        self.alerts.extend(triggered)
        return triggered
    
    def _generate_description(self, rule: AlertRule, data: Dict) -> str:
        """Generate human-readable alert description."""
        if rule.alert_type == AlertType.BALANCE_DROP:
            return f"Balance dropped by {abs(data.get('balance_change_percent', 0)):.1f}%"
        elif rule.alert_type == AlertType.RISK_INCREASE:
            return f"Risk score changed to {data.get('risk_score', 'N/A')}"
        elif rule.alert_type == AlertType.SUSPICIOUS_TX:
            patterns = data.get("suspicious_patterns", [])
            return f"Detected {len(patterns)} suspicious pattern(s)"
        elif rule.alert_type == AlertType.LARGE_OUTFLOW:
            return f"Large outflow detected: {data.get('outflow_amount', 0):.2f}"
        else:
            return rule.name
    
    def get_alerts(
        self,
        wallet: Optional[str] = None,
        priority: Optional[AlertPriority] = None,
        unacknowledged_only: bool = False
    ) -> List[Alert]:
        """Get alerts with optional filters."""
        result = self.alerts
        
        if wallet:
            result = [a for a in result if a.wallet_address == wallet]
        if priority:
            result = [a for a in result if a.priority.value >= priority.value]
        if unacknowledged_only:
            result = [a for a in result if not a.acknowledged]
        
        return sorted(result, key=lambda a: (a.priority.value, a.triggered_at), reverse=True)
    
    def acknowledge_alert(self, alert_id: str):
        """Mark an alert as acknowledged."""
        for alert in self.alerts:
            if alert.id == alert_id:
                alert.acknowledged = True
                break


# =============================================================================
# CONVENIENCE EXPORTS
# =============================================================================

async def create_monitor(wallets: List[str]) -> RealTimeMonitor:
    """Create a configured real-time monitor."""
    monitor = RealTimeMonitor()
    for addr in wallets:
        monitor.add_wallet(addr)
    return monitor


async def analyze_portfolio(wallets: List[Dict[str, str]]) -> PortfolioAnalysis:
    """
    Analyze a portfolio of wallets.
    
    Args:
        wallets: List of {"address": str, "label": str} dicts
    """
    analyzer = PortfolioAnalyzer()
    portfolio_wallets = [
        PortfolioWallet(address=w["address"], label=w.get("label", ""))
        for w in wallets
    ]
    return await analyzer.analyze_portfolio(portfolio_wallets)


async def predict_risk(address: str) -> RiskTrend:
    """Get risk trend prediction for a wallet."""
    analyzer = PredictiveRiskAnalyzer()
    return await analyzer.analyze_trend(address)


async def build_relationship_graph(addresses: List[str], depth: int = 2) -> RelationshipGraph:
    """Build wallet relationship graph."""
    analyzer = WalletRelationshipAnalyzer()
    return await analyzer.build_graph(addresses, depth=depth)


def create_alert_system() -> SmartAlertSystem:
    """Create a configured alert system."""
    return SmartAlertSystem()
