"""
Graph-based Multi-Agent Orchestration System for Wallet Guardian.

This module implements a computational graph that:
1. Eliminates redundant RPC calls through shared data cache
2. Orchestrates specialized agents in a DAG (Directed Acyclic Graph)
3. Ensures computational completeness without redundancy
4. Manages agent state and data flow efficiently
"""

from __future__ import annotations

import asyncio
import hashlib
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Callable, ClassVar, Dict, List, Optional, Set, Tuple
from collections import defaultdict

from spoon_ai.agents import SpoonReactAI
from spoon_ai.chat import ChatBot, Memory
from spoon_ai.tools import BaseTool, ToolManager

from .neo_client import NeoClient, NeoRPCError
from .common import (
    RiskLevel,
    compute_trust_score,
    get_risk_level_from_trust_score,
    DEFAULT_CACHE_TTL,
)


# =============================================================================
# SHARED DATA CACHE - Eliminates Redundant RPC Calls
# =============================================================================

class WalletDataCache:
    """
    Singleton cache for wallet data to prevent redundant blockchain queries.
    Uses TTL (Time-To-Live) to ensure data freshness.
    """
    _instance: Optional['WalletDataCache'] = None
    DEFAULT_TTL = 60  # 60 seconds default TTL
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._cache = {}  # Dict[str, Tuple[Any, float]]
            cls._instance._locks = defaultdict(asyncio.Lock)  # Dict[str, asyncio.Lock]
        return cls._instance
    
    def _make_key(self, operation: str, **params) -> str:
        """Create a unique cache key from operation and parameters."""
        param_str = "|".join(f"{k}={v}" for k, v in sorted(params.items()))
        return hashlib.md5(f"{operation}:{param_str}".encode()).hexdigest()
    
    def get(self, operation: str, ttl: int = DEFAULT_TTL, **params) -> Optional[Any]:
        """Get cached data if fresh, None otherwise."""
        key = self._make_key(operation, **params)
        if key in self._cache:
            data, timestamp = self._cache[key]
            if time.time() - timestamp < ttl:
                return data
            del self._cache[key]
        return None
    
    def set(self, operation: str, data: Any, **params) -> None:
        """Cache data with current timestamp."""
        key = self._make_key(operation, **params)
        self._cache[key] = (data, time.time())
    
    def invalidate(self, address: Optional[str] = None) -> None:
        """Invalidate cache entries (all or for specific address)."""
        if address:
            keys_to_remove = [k for k in self._cache if address in str(self._cache[k])]
            for k in keys_to_remove:
                del self._cache[k]
        else:
            self._cache.clear()
    
    def get_lock(self, key: str) -> asyncio.Lock:
        """Get a lock for concurrent access to same data."""
        return self._locks[key]


# =============================================================================
# UNIFIED DATA FETCHER - Single Source of Truth for Blockchain Data
# =============================================================================

class UnifiedDataFetcher:
    """
    Centralized data fetcher that all agents/tools use.
    Ensures each piece of data is fetched only once.
    """
    
    def __init__(self, neo_client: Optional[NeoClient] = None):
        self.neo_client = neo_client or NeoClient()
        self.cache = WalletDataCache()
    
    async def get_balances(self, address: str, ttl: int = 60) -> List[Dict[str, Any]]:
        """Fetch NEP-17 balances with caching."""
        cached = self.cache.get("balances", ttl=ttl, address=address)
        if cached is not None:
            return cached
        
        async with self.cache.get_lock(f"balances:{address}"):
            # Double-check after acquiring lock
            cached = self.cache.get("balances", ttl=ttl, address=address)
            if cached is not None:
                return cached
            
            try:
                balances = self.neo_client.get_nep17_balances(address)
                self.cache.set("balances", balances, address=address)
                return balances
            except NeoRPCError as e:
                raise e
    
    async def get_transfers(
        self, 
        address: str, 
        lookback_days: int = 30,
        ttl: int = 60
    ) -> Dict[str, Any]:
        """Fetch NEP-17 transfers with caching."""
        cached = self.cache.get("transfers", ttl=ttl, address=address, lookback=lookback_days)
        if cached is not None:
            return cached
        
        async with self.cache.get_lock(f"transfers:{address}:{lookback_days}"):
            cached = self.cache.get("transfers", ttl=ttl, address=address, lookback=lookback_days)
            if cached is not None:
                return cached
            
            now = int(time.time())
            start = now - lookback_days * 86400
            
            try:
                transfers = self.neo_client.get_nep17_transfers(address, start, now)
                self.cache.set("transfers", transfers, address=address, lookback=lookback_days)
                return transfers
            except NeoRPCError as e:
                raise e
    
    async def get_full_wallet_data(
        self, 
        address: str, 
        lookback_days: int = 30
    ) -> Dict[str, Any]:
        """Fetch all wallet data in parallel - single comprehensive fetch."""
        cached = self.cache.get("full_wallet", address=address, lookback=lookback_days)
        if cached is not None:
            return cached
        
        # Parallel fetch of balances and transfers
        balances_task = self.get_balances(address)
        transfers_task = self.get_transfers(address, lookback_days)
        
        balances, transfers = await asyncio.gather(balances_task, transfers_task)
        
        full_data = {
            "address": address,
            "lookback_days": lookback_days,
            "balances": balances,
            "transfers": transfers,
            "fetched_at": time.time(),
        }
        
        self.cache.set("full_wallet", full_data, address=address, lookback=lookback_days)
        return full_data


# =============================================================================
# COMPUTATION GRAPH - DAG-based Agent Orchestration
# =============================================================================

class NodeState(Enum):
    """State of a computation node."""
    PENDING = auto()
    RUNNING = auto()
    COMPLETED = auto()
    FAILED = auto()
    SKIPPED = auto()


@dataclass
class ComputationResult:
    """Result from a computation node."""
    node_id: str
    state: NodeState
    data: Any = None
    error: Optional[str] = None
    duration_ms: float = 0.0
    dependencies_used: List[str] = field(default_factory=list)


@dataclass 
class ComputationNode:
    """
    A node in the computation graph representing a discrete analysis task.
    """
    id: str
    name: str
    compute_fn: Callable
    dependencies: Set[str] = field(default_factory=set)
    state: NodeState = NodeState.PENDING
    result: Optional[ComputationResult] = None
    required: bool = True  # If False, can be skipped on failure
    
    def __hash__(self):
        return hash(self.id)


class ComputationGraph:
    """
    Directed Acyclic Graph for orchestrating wallet analysis computations.
    
    Ensures:
    - No redundant computations
    - Proper dependency ordering
    - Parallel execution where possible
    - Graceful failure handling
    """
    
    def __init__(self):
        self.nodes: Dict[str, ComputationNode] = {}
        self.results: Dict[str, ComputationResult] = {}
        self._topo_order: Optional[List[str]] = None
    
    def add_node(
        self,
        node_id: str,
        name: str,
        compute_fn: Callable,
        dependencies: Optional[Set[str]] = None,
        required: bool = True
    ) -> 'ComputationGraph':
        """Add a computation node to the graph."""
        self.nodes[node_id] = ComputationNode(
            id=node_id,
            name=name,
            compute_fn=compute_fn,
            dependencies=dependencies or set(),
            required=required
        )
        self._topo_order = None  # Invalidate cached order
        return self
    
    def _validate_dag(self) -> bool:
        """Validate that the graph is a valid DAG (no cycles)."""
        visited = set()
        rec_stack = set()
        
        def has_cycle(node_id: str) -> bool:
            visited.add(node_id)
            rec_stack.add(node_id)
            
            for dep in self.nodes.get(node_id, ComputationNode("", "", lambda: None)).dependencies:
                if dep not in self.nodes:
                    continue
                if dep not in visited:
                    if has_cycle(dep):
                        return True
                elif dep in rec_stack:
                    return True
            
            rec_stack.remove(node_id)
            return False
        
        for node_id in self.nodes:
            if node_id not in visited:
                if has_cycle(node_id):
                    return False
        return True
    
    def _topological_sort(self) -> List[str]:
        """Get nodes in topological order for execution."""
        if self._topo_order is not None:
            return self._topo_order
        
        if not self._validate_dag():
            raise ValueError("Graph contains cycles - not a valid DAG")
        
        visited = set()
        order = []
        
        def visit(node_id: str):
            if node_id in visited:
                return
            visited.add(node_id)
            
            node = self.nodes.get(node_id)
            if node:
                for dep in node.dependencies:
                    visit(dep)
                order.append(node_id)
        
        for node_id in self.nodes:
            visit(node_id)
        
        self._topo_order = order
        return order
    
    def get_parallel_batches(self) -> List[List[str]]:
        """
        Group nodes into batches that can be executed in parallel.
        Returns list of batches, where each batch contains nodes
        whose dependencies are all in previous batches.
        """
        topo_order = self._topological_sort()
        completed = set()
        batches = []
        remaining = set(topo_order)
        
        while remaining:
            # Find all nodes whose dependencies are completed
            batch = []
            for node_id in remaining:
                node = self.nodes[node_id]
                if node.dependencies.issubset(completed):
                    batch.append(node_id)
            
            if not batch:
                raise ValueError("Unable to resolve dependencies - possible cycle")
            
            batches.append(batch)
            completed.update(batch)
            remaining -= set(batch)
        
        return batches
    
    async def execute(self, context: Dict[str, Any]) -> Dict[str, ComputationResult]:
        """
        Execute the computation graph with maximum parallelism.
        
        Args:
            context: Shared context dict passed to all compute functions
            
        Returns:
            Dict mapping node_id to ComputationResult
        """
        batches = self.get_parallel_batches()
        
        for batch in batches:
            # Execute all nodes in batch in parallel
            tasks = []
            for node_id in batch:
                node = self.nodes[node_id]
                tasks.append(self._execute_node(node, context))
            
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Process results
            for node_id, result in zip(batch, results):
                if isinstance(result, Exception):
                    self.results[node_id] = ComputationResult(
                        node_id=node_id,
                        state=NodeState.FAILED,
                        error=str(result)
                    )
                    if self.nodes[node_id].required:
                        # Stop execution if required node fails
                        return self.results
                else:
                    self.results[node_id] = result
        
        return self.results
    
    async def _execute_node(
        self, 
        node: ComputationNode, 
        context: Dict[str, Any]
    ) -> ComputationResult:
        """Execute a single computation node."""
        start_time = time.time()
        
        # Gather dependency results
        dep_results = {
            dep_id: self.results.get(dep_id)
            for dep_id in node.dependencies
        }
        
        # Check if any required dependency failed
        for dep_id, dep_result in dep_results.items():
            if dep_result and dep_result.state == NodeState.FAILED:
                if self.nodes[dep_id].required:
                    return ComputationResult(
                        node_id=node.id,
                        state=NodeState.SKIPPED,
                        error=f"Dependency {dep_id} failed"
                    )
        
        try:
            # Execute computation
            if asyncio.iscoroutinefunction(node.compute_fn):
                data = await node.compute_fn(context, dep_results)
            else:
                data = node.compute_fn(context, dep_results)
            
            duration = (time.time() - start_time) * 1000
            
            return ComputationResult(
                node_id=node.id,
                state=NodeState.COMPLETED,
                data=data,
                duration_ms=duration,
                dependencies_used=list(node.dependencies)
            )
        except Exception as e:
            return ComputationResult(
                node_id=node.id,
                state=NodeState.FAILED,
                error=str(e),
                duration_ms=(time.time() - start_time) * 1000
            )


# =============================================================================
# SPECIALIZED ANALYSIS FUNCTIONS (Used by Graph Nodes)
# =============================================================================

def compute_concentration(balances: List[Dict[str, Any]]) -> float:
    """Compute portfolio concentration (0-1)."""
    total = sum(float(b.get("amount", 0)) for b in balances)
    if total <= 0:
        return 0.0
    top = max((float(b.get("amount", 0)) for b in balances), default=0.0)
    return top / total


def compute_stablecoin_ratio(balances: List[Dict[str, Any]]) -> float:
    """Compute stablecoin ratio in portfolio."""
    total = sum(float(b.get("amount", 0)) for b in balances)
    if total <= 0:
        return 0.0
    stable = sum(
        float(b.get("amount", 0))
        for b in balances
        if any(tag in (b.get("symbol") or "").upper() 
               for tag in ("USD", "USDT", "USDC", "DAI", "FDUSD"))
    )
    return stable / total


def extract_counterparties(transfers: Dict[str, Any]) -> Set[str]:
    """Extract unique counterparty addresses from transfers."""
    counterparties = set()
    for direction in ("sent", "received"):
        for tx in transfers.get(direction, []):
            addr = tx.get("transferaddress") or tx.get("to") or tx.get("from")
            if addr:
                counterparties.add(addr)
    return counterparties


def detect_suspicious_patterns(transfers: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Detect suspicious transaction patterns."""
    suspicious = []
    all_txs = transfers.get("sent", []) + transfers.get("received", [])
    
    # Check rapid transactions
    if len(all_txs) >= 10:
        sorted_txs = sorted(all_txs, key=lambda x: x.get("timestamp", 0))
        for i in range(len(sorted_txs) - 9):
            window = sorted_txs[i:i+10]
            time_diff = window[-1].get("timestamp", 0) - window[0].get("timestamp", 0)
            if time_diff <= 300:  # 5 minutes
                suspicious.append({
                    "type": "rapid_transactions",
                    "level": "medium",
                    "detail": f"10+ transactions in {time_diff}s"
                })
                break
    
    # Check counterparty concentration
    cp_counts = defaultdict(int)
    for tx in all_txs:
        addr = tx.get("transferaddress", "")
        if addr:
            cp_counts[addr] += 1
    
    for addr, count in cp_counts.items():
        if count > 20:
            suspicious.append({
                "type": "concentrated_activity",
                "level": "medium",
                "counterparty": addr,
                "count": count
            })
    
    return suspicious


def compute_risk_score(
    concentration: float,
    stablecoin_ratio: float,
    counterparty_count: int,
    suspicious_patterns: List[Dict]
) -> Tuple[int, List[Dict[str, Any]]]:
    """
    Compute unified trust score and deductions.
    
    Delegates to the canonical compute_trust_score in common.py.
    Returns: Tuple of (score 0-100 where 100=best, deductions list)
    """
    return compute_trust_score(concentration, stablecoin_ratio, counterparty_count, suspicious_patterns)


# =============================================================================
# WALLET ANALYSIS GRAPH BUILDER
# =============================================================================

class WalletAnalysisGraphBuilder:
    """
    Builds a computation graph for comprehensive wallet analysis.
    Ensures no redundant computations.
    """
    
    def __init__(self, data_fetcher: UnifiedDataFetcher):
        self.data_fetcher = data_fetcher
    
    def build_graph(self, address: str, lookback_days: int = 30) -> ComputationGraph:
        """Build the complete wallet analysis computation graph."""
        graph = ComputationGraph()
        
        # Node 1: Fetch wallet data (root node - no dependencies)
        async def fetch_data(ctx, deps):
            return await self.data_fetcher.get_full_wallet_data(
                ctx["address"], 
                ctx["lookback_days"]
            )
        
        graph.add_node(
            "fetch_data",
            "Fetch Wallet Data",
            fetch_data,
            dependencies=set()
        )
        
        # Node 2: Compute concentration
        def calc_concentration(ctx, deps):
            data = deps["fetch_data"].data
            return compute_concentration(data["balances"])
        
        graph.add_node(
            "concentration",
            "Compute Concentration",
            calc_concentration,
            dependencies={"fetch_data"}
        )
        
        # Node 3: Compute stablecoin ratio
        def calc_stablecoin(ctx, deps):
            data = deps["fetch_data"].data
            return compute_stablecoin_ratio(data["balances"])
        
        graph.add_node(
            "stablecoin_ratio",
            "Compute Stablecoin Ratio",
            calc_stablecoin,
            dependencies={"fetch_data"}
        )
        
        # Node 4: Extract counterparties
        def calc_counterparties(ctx, deps):
            data = deps["fetch_data"].data
            return extract_counterparties(data["transfers"])
        
        graph.add_node(
            "counterparties",
            "Extract Counterparties",
            calc_counterparties,
            dependencies={"fetch_data"}
        )
        
        # Node 5: Detect suspicious patterns
        def calc_suspicious(ctx, deps):
            data = deps["fetch_data"].data
            return detect_suspicious_patterns(data["transfers"])
        
        graph.add_node(
            "suspicious_patterns",
            "Detect Suspicious Patterns",
            calc_suspicious,
            dependencies={"fetch_data"}
        )
        
        # Node 6: Compute risk score (depends on metrics nodes)
        def calc_risk(ctx, deps):
            return compute_risk_score(
                deps["concentration"].data,
                deps["stablecoin_ratio"].data,
                len(deps["counterparties"].data),
                deps["suspicious_patterns"].data
            )
        
        graph.add_node(
            "risk_score",
            "Compute Risk Score",
            calc_risk,
            dependencies={"concentration", "stablecoin_ratio", "counterparties", "suspicious_patterns"}
        )
        
        # Node 7: Generate final report
        def generate_report(ctx, deps):
            data = deps["fetch_data"].data
            score, deductions = deps["risk_score"].data
            
            # Use the shared risk level function
            risk_level = get_risk_level_from_trust_score(score)
            
            return {
                "address": ctx["address"],
                "chain": "neo3",
                "lookback_days": ctx["lookback_days"],
                "balances": data["balances"],
                "transfers": data["transfers"],
                "metrics": {
                    "concentration": deps["concentration"].data,
                    "stablecoin_ratio": deps["stablecoin_ratio"].data,
                    "counterparty_count": len(deps["counterparties"].data),
                },
                "counterparties": list(deps["counterparties"].data),
                "suspicious_patterns": deps["suspicious_patterns"].data,
                "risk_score": score,
                "risk_level": risk_level,
                "deductions": deductions,
                "computation_graph": {
                    node_id: {
                        "name": graph.nodes[node_id].name,
                        "duration_ms": deps.get(node_id, ComputationResult(node_id, NodeState.PENDING)).duration_ms
                    }
                    for node_id in graph.nodes
                    if node_id in deps
                }
            }
        
        graph.add_node(
            "final_report",
            "Generate Final Report",
            generate_report,
            dependencies={"fetch_data", "concentration", "stablecoin_ratio", 
                         "counterparties", "suspicious_patterns", "risk_score"}
        )
        
        return graph


# =============================================================================
# MULTI-AGENT GRAPH ORCHESTRATOR
# =============================================================================

class AgentRole(Enum):
    """Specialized agent roles."""
    COORDINATOR = "coordinator"
    DATA_ANALYST = "data_analyst"
    RISK_ASSESSOR = "risk_assessor"
    PATTERN_DETECTOR = "pattern_detector"
    REPORTER = "reporter"


@dataclass
class AgentNode:
    """An agent in the multi-agent graph."""
    role: AgentRole
    agent: Optional[SpoonReactAI]
    capabilities: Set[str]
    dependencies: Set[AgentRole] = field(default_factory=set)


# =============================================================================
# TOOL DEFINITIONS (Defined at module level for Pydantic compatibility)
# =============================================================================

class FetchWalletDataTool(BaseTool):
    """Tool to fetch wallet data using shared fetcher."""
    name: ClassVar[str] = "fetch_wallet_data"
    description: ClassVar[str] = "Fetch complete wallet data (balances + transfers)"
    parameters: ClassVar[Dict[str, Any]] = {
        "type": "object",
        "properties": {
            "address": {"type": "string", "description": "Neo N3 wallet address"},
            "lookback_days": {"type": "integer", "default": 30, "description": "Days to look back"}
        },
        "required": ["address"]
    }
    
    _fetcher: Optional[UnifiedDataFetcher] = None
    
    def set_fetcher(self, fetcher: UnifiedDataFetcher):
        self._fetcher = fetcher
    
    async def execute(self, address: str, lookback_days: int = 30):
        if self._fetcher is None:
            self._fetcher = UnifiedDataFetcher()
        return await self._fetcher.get_full_wallet_data(address, lookback_days)
    
    def call(self, address: str, lookback_days: int = 30):
        import asyncio
        try:
            loop = asyncio.get_running_loop()
            return loop.run_until_complete(self.execute(address, lookback_days))
        except RuntimeError:
            return asyncio.run(self.execute(address, lookback_days))


class ComputeRiskScoreTool(BaseTool):
    """Tool to compute risk score from wallet metrics."""
    name: ClassVar[str] = "compute_risk_score"
    description: ClassVar[str] = "Compute risk score from wallet metrics"
    parameters: ClassVar[Dict[str, Any]] = {
        "type": "object",
        "properties": {
            "concentration": {"type": "number", "description": "Portfolio concentration 0-1"},
            "stablecoin_ratio": {"type": "number", "description": "Stablecoin ratio 0-1"},
            "counterparty_count": {"type": "integer", "description": "Number of unique counterparties"},
            "suspicious_patterns": {"type": "array", "items": {"type": "object"}, "default": []}
        },
        "required": ["concentration", "stablecoin_ratio", "counterparty_count"]
    }
    
    async def execute(self, concentration: float, stablecoin_ratio: float,
                    counterparty_count: int, suspicious_patterns: list = None):
        return compute_risk_score(
            concentration, stablecoin_ratio, 
            counterparty_count, suspicious_patterns or []
        )
    
    def call(self, concentration: float, stablecoin_ratio: float,
            counterparty_count: int, suspicious_patterns: list = None):
        return compute_risk_score(
            concentration, stablecoin_ratio,
            counterparty_count, suspicious_patterns or []
        )


class DetectPatternsTool(BaseTool):
    """Tool to detect suspicious patterns in transfers."""
    name: ClassVar[str] = "detect_patterns"
    description: ClassVar[str] = "Detect suspicious patterns in transfers"
    parameters: ClassVar[Dict[str, Any]] = {
        "type": "object",
        "properties": {
            "transfers": {"type": "object", "description": "Transfer data with sent/received arrays"}
        },
        "required": ["transfers"]
    }
    
    async def execute(self, transfers: dict):
        return detect_suspicious_patterns(transfers)
    
    def call(self, transfers: dict):
        return detect_suspicious_patterns(transfers)


class MultiAgentOrchestrator:
    """
    Graph-based orchestrator for multiple specialized agents.
    
    Architecture:
    ```
                    ┌─────────────────┐
                    │   COORDINATOR   │
                    │  (Routes tasks) │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌─────────────┐ ┌──────────────┐
    │ DATA_ANALYST  │ │RISK_ASSESSOR│ │PATTERN_DETECT│
    │ (Fetch/Parse) │ │  (Scoring)  │ │ (Suspicious) │
    └───────┬───────┘ └──────┬──────┘ └──────┬───────┘
            │                │                │
            └────────────────┼────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │    REPORTER     │
                    │(Final Summary)  │
                    └─────────────────┘
    ```
    """
    
    def __init__(self, use_agents: bool = False):
        self.agents: Dict[AgentRole, AgentNode] = {}
        self.data_fetcher = UnifiedDataFetcher()
        self.graph_builder = WalletAnalysisGraphBuilder(self.data_fetcher)
        self._initialized = False
        self._use_agents = use_agents  # Only create agents if explicitly requested
    
    async def initialize(self):
        """Initialize the orchestrator (and optionally agents)."""
        if self._initialized:
            return
        
        if self._use_agents:
            # Create specialized agents only if requested
            self._create_coordinator()
            self._create_data_analyst()
            self._create_risk_assessor()
            self._create_pattern_detector()
            self._create_reporter()
            
            # Initialize all agents
            for agent_node in self.agents.values():
                if agent_node.agent:
                    await agent_node.agent.initialize()
        
        self._initialized = True
    
    def _create_coordinator(self):
        """Create the coordinator agent."""
        prompt = """You are the Wallet Guardian Coordinator. Your job is to:
1. Understand user queries about wallet analysis
2. Route tasks to appropriate specialist agents
3. Aggregate results into coherent responses
4. Never perform analysis yourself - delegate to specialists

Available specialists:
- DATA_ANALYST: Fetches and parses blockchain data
- RISK_ASSESSOR: Computes risk scores and validity metrics  
- PATTERN_DETECTOR: Identifies suspicious patterns
- REPORTER: Generates final reports

Always respond with which specialist(s) should handle the task."""

        agent = SpoonReactAI(
            name="Coordinator",
            description="Routes and coordinates analysis tasks",
            system_prompt=prompt,
            llm=ChatBot(),
            memory=Memory(),
            avaliable_tools=ToolManager([]),
            max_steps=3,
        )
        
        self.agents[AgentRole.COORDINATOR] = AgentNode(
            role=AgentRole.COORDINATOR,
            agent=agent,
            capabilities={"routing", "aggregation"},
            dependencies=set()
        )
    
    def _create_data_analyst(self):
        """Create the data analyst agent."""
        prompt = """You are the Data Analyst for Wallet Guardian. Your job is to:
1. Fetch wallet balances and transaction history
2. Parse and normalize blockchain data
3. Extract key metrics (balances, transfers, counterparties)
4. Provide clean data to other agents

Use the provided tools to fetch data. Never fabricate data."""

        # Use module-level tool class
        fetch_tool = FetchWalletDataTool()
        fetch_tool.set_fetcher(self.data_fetcher)
        
        agent = SpoonReactAI(
            name="DataAnalyst",
            description="Fetches and parses wallet data",
            system_prompt=prompt,
            llm=ChatBot(),
            memory=Memory(),
            avaliable_tools=ToolManager([fetch_tool]),
            max_steps=5,
        )
        
        self.agents[AgentRole.DATA_ANALYST] = AgentNode(
            role=AgentRole.DATA_ANALYST,
            agent=agent,
            capabilities={"fetch_balances", "fetch_transfers", "parse_data"},
            dependencies={AgentRole.COORDINATOR}
        )
    
    def _create_risk_assessor(self):
        """Create the risk assessor agent."""
        prompt = """You are the Risk Assessor for Wallet Guardian. Your job is to:
1. Analyze wallet metrics (concentration, stablecoin ratio, diversity)
2. Compute risk scores (0-100)
3. Identify risk factors and deductions
4. Provide clear risk level assessments

You receive pre-processed data - focus on risk analysis only.
Risk levels: clean (90+), low (70-89), moderate (50-69), high (30-49), critical (<30)"""

        agent = SpoonReactAI(
            name="RiskAssessor",
            description="Computes risk scores and assessments",
            system_prompt=prompt,
            llm=ChatBot(),
            memory=Memory(),
            avaliable_tools=ToolManager([ComputeRiskScoreTool()]),
            max_steps=3,
        )
        
        self.agents[AgentRole.RISK_ASSESSOR] = AgentNode(
            role=AgentRole.RISK_ASSESSOR,
            agent=agent,
            capabilities={"risk_scoring", "validity_assessment"},
            dependencies={AgentRole.DATA_ANALYST}
        )
    
    def _create_pattern_detector(self):
        """Create the pattern detector agent."""
        prompt = """You are the Pattern Detector for Wallet Guardian. Your job is to:
1. Analyze transaction patterns for suspicious activity
2. Detect rapid transaction bursts (potential bot activity)
3. Identify concentrated counterparty interactions
4. Flag potential dust attacks or scam interactions

Focus on patterns, not individual transaction values."""

        agent = SpoonReactAI(
            name="PatternDetector",
            description="Detects suspicious transaction patterns",
            system_prompt=prompt,
            llm=ChatBot(),
            memory=Memory(),
            avaliable_tools=ToolManager([DetectPatternsTool()]),
            max_steps=3,
        )
        
        self.agents[AgentRole.PATTERN_DETECTOR] = AgentNode(
            role=AgentRole.PATTERN_DETECTOR,
            agent=agent,
            capabilities={"pattern_detection", "suspicious_activity"},
            dependencies={AgentRole.DATA_ANALYST}
        )
    
    def _create_reporter(self):
        """Create the reporter agent."""
        prompt = """You are the Reporter for Wallet Guardian. Your job is to:
1. Aggregate analysis results from all specialists
2. Generate clear, concise summaries
3. Provide actionable insights (not financial advice)
4. Format output for different channels (console, DM, email)

Always include: address, risk score, risk level, key findings.
Never give specific financial recommendations."""

        agent = SpoonReactAI(
            name="Reporter",
            description="Generates final analysis reports",
            system_prompt=prompt,
            llm=ChatBot(),
            memory=Memory(),
            avaliable_tools=ToolManager([]),
            max_steps=3,
        )
        
        self.agents[AgentRole.REPORTER] = AgentNode(
            role=AgentRole.REPORTER,
            agent=agent,
            capabilities={"report_generation", "summarization"},
            dependencies={AgentRole.RISK_ASSESSOR, AgentRole.PATTERN_DETECTOR}
        )
    
    async def analyze_wallet(
        self, 
        address: str, 
        lookback_days: int = 30,
        use_graph: bool = True
    ) -> Dict[str, Any]:
        """
        Run comprehensive wallet analysis using the computation graph.
        
        Args:
            address: Wallet address to analyze
            lookback_days: Number of days to analyze
            use_graph: Use computation graph (True) or sequential (False)
            
        Returns:
            Complete analysis results
        """
        await self.initialize()
        
        if use_graph:
            # Build and execute computation graph
            graph = self.graph_builder.build_graph(address, lookback_days)
            context = {"address": address, "lookback_days": lookback_days}
            
            results = await graph.execute(context)
            
            # Get final report
            if "final_report" in results and results["final_report"].state == NodeState.COMPLETED:
                return results["final_report"].data
            else:
                # Return partial results on failure
                return {
                    "address": address,
                    "error": "Analysis incomplete",
                    "partial_results": {
                        k: {"state": v.state.name, "data": v.data, "error": v.error}
                        for k, v in results.items()
                    }
                }
        else:
            # Sequential execution (fallback)
            data = await self.data_fetcher.get_full_wallet_data(address, lookback_days)
            concentration = compute_concentration(data["balances"])
            stablecoin = compute_stablecoin_ratio(data["balances"])
            counterparties = extract_counterparties(data["transfers"])
            patterns = detect_suspicious_patterns(data["transfers"])
            score, deductions = compute_risk_score(
                concentration, stablecoin, len(counterparties), patterns
            )
            
            return {
                "address": address,
                "risk_score": score,
                "risk_level": get_risk_level_from_trust_score(score),
                "metrics": {
                    "concentration": concentration,
                    "stablecoin_ratio": stablecoin,
                    "counterparty_count": len(counterparties)
                },
                "deductions": deductions,
                "suspicious_patterns": patterns
            }
    
    async def query(self, user_query: str) -> str:
        """
        Handle a natural language query by routing to appropriate agents.
        
        Args:
            user_query: User's question or command
            
        Returns:
            Agent response
        """
        await self.initialize()
        
        # Use coordinator to route the query
        coordinator = self.agents[AgentRole.COORDINATOR].agent
        routing_result = await coordinator.run(user_query)
        
        return routing_result
    
    async def shutdown(self):
        """Gracefully shutdown all agents."""
        for agent_node in self.agents.values():
            await agent_node.agent.shutdown()
        self._initialized = False


# =============================================================================
# CONVENIENCE FUNCTIONS
# =============================================================================

_orchestrator: Optional[MultiAgentOrchestrator] = None


async def get_orchestrator() -> MultiAgentOrchestrator:
    """Get or create the global orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = MultiAgentOrchestrator()
    return _orchestrator


async def analyze_wallet(address: str, lookback_days: int = 30) -> Dict[str, Any]:
    """
    Quick wallet analysis using the graph-based orchestrator.
    
    Args:
        address: Neo N3 wallet address
        lookback_days: Days to analyze
        
    Returns:
        Analysis results
    """
    orchestrator = await get_orchestrator()
    return await orchestrator.analyze_wallet(address, lookback_days)


async def query_guardian(query: str) -> str:
    """
    Send a natural language query to the Wallet Guardian.
    
    Args:
        query: User question
        
    Returns:
        Agent response
    """
    orchestrator = await get_orchestrator()
    return await orchestrator.query(query)


# =============================================================================
# CLI ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import sys
    
    async def main():
        if len(sys.argv) < 2:
            print("Usage: python -m wallet_guardian.src.graph_orchestrator <address> [lookback_days]")
            print("       python -m wallet_guardian.src.graph_orchestrator --query 'your question'")
            return
        
        if sys.argv[1] == "--query":
            query = " ".join(sys.argv[2:])
            result = await query_guardian(query)
            print(result)
        else:
            address = sys.argv[1]
            lookback_days = int(sys.argv[2]) if len(sys.argv) > 2 else 30
            
            print(f"Analyzing wallet: {address}")
            print(f"Lookback period: {lookback_days} days")
            print("-" * 50)
            
            result = await analyze_wallet(address, lookback_days)
            
            import json
            print(json.dumps(result, indent=2, default=str))
    
    asyncio.run(main())
