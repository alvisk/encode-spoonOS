"""
x402 Gateway Server for Neo Wallet Guardian Agent.

This server exposes the Wallet Guardian agent via HTTP endpoints with optional
x402 payment support on Base Sepolia.

Usage:
    # Development
    python server.py

    # Production
    uvicorn server:app --host 0.0.0.0 --port 8000
"""

import os
import json
import asyncio
from typing import Optional
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Load environment variables
load_dotenv(override=True)

# Import tools and agent config (not the agent itself to avoid LLM requirement)
from src.agent import register_agent, AGENT_NAME, get_tools


# =============================================================================
# Pydantic Models
# =============================================================================

class InvokeRequest(BaseModel):
    """Request body for agent invocation."""
    prompt: str
    use_mock: bool = False


class InvokeResponse(BaseModel):
    """Response from agent invocation."""
    agent: str
    prompt: str
    response: str
    tools_used: list[str] = []


class PaymentRequirements(BaseModel):
    """x402 payment requirements."""
    accepts: list[dict]
    network: str
    receiver: str
    amount: str
    asset: str


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    agent: str
    tools: list[str]
    x402_enabled: bool


# =============================================================================
# App Configuration
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events."""
    # Startup
    print(f"Starting Wallet Guardian x402 Gateway...")
    print(f"Agent: {AGENT_NAME}")
    print(f"Tools: {[t.name for t in get_tools()]}")
    
    x402_enabled = bool(os.getenv("X402_AGENT_PRIVATE_KEY"))
    print(f"x402 Payments: {'Enabled' if x402_enabled else 'Disabled (free mode)'}")
    
    if x402_enabled:
        print(f"Network: {os.getenv('X402_DEFAULT_NETWORK', 'base-sepolia')}")
        print(f"Price: {os.getenv('X402_DEFAULT_AMOUNT_USDC', '0.01')} USDC")
    
    yield
    
    # Shutdown
    print("Shutting down Wallet Guardian Gateway...")


app = FastAPI(
    title="Neo Wallet Guardian",
    description="AI-powered wallet analysis agent for Neo N3 with x402 payment support",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# Helper Functions
# =============================================================================

def get_x402_config() -> dict:
    """Get x402 configuration from environment."""
    receiver = os.getenv("X402_RECEIVER_ADDRESS", "")
    return {
        # Enable x402 if receiver address is configured (even without private key for demo)
        "enabled": bool(receiver),
        "network": os.getenv("X402_DEFAULT_NETWORK", "base-sepolia"),
        "asset": os.getenv("X402_DEFAULT_ASSET", "0x036CbD53842c5426634e7929541eC2318f3dCF7e"),
        "amount": os.getenv("X402_DEFAULT_AMOUNT_USDC", "0.01"),
        "receiver": receiver,
        "facilitator": os.getenv("X402_FACILITATOR_URL", "https://x402.org/facilitator"),
        "has_private_key": bool(os.getenv("X402_AGENT_PRIVATE_KEY")),
    }


def verify_payment(payment_header: Optional[str]) -> bool:
    """
    Verify x402 payment header.
    
    In production, this would verify the signature and check with the facilitator.
    For hackathon demo, we'll accept any non-empty header or skip if x402 is disabled.
    """
    config = get_x402_config()
    
    if not config["enabled"]:
        # x402 disabled - free mode
        return True
    
    if not payment_header:
        return False
    
    # TODO: Implement actual x402 verification
    # For now, accept any header for demo purposes
    return True


# =============================================================================
# Endpoints
# =============================================================================

@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint with health check."""
    config = get_x402_config()
    return HealthResponse(
        status="healthy",
        agent=AGENT_NAME,
        tools=[t.name for t in get_tools()],
        x402_enabled=config["enabled"],
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint."""
    config = get_x402_config()
    return HealthResponse(
        status="healthy",
        agent=AGENT_NAME,
        tools=[t.name for t in get_tools()],
        x402_enabled=config["enabled"],
    )


@app.get("/x402/requirements")
async def get_payment_requirements():
    """Return x402 payment requirements."""
    config = get_x402_config()
    
    if not config["enabled"]:
        return JSONResponse(
            content={
                "enabled": False,
                "message": "x402 payments not configured - free mode active"
            }
        )
    
    return {
        "enabled": True,
        "network": config["network"],
        "receiver": config["receiver"],
        "amount": config["amount"],
        "asset": config["asset"],
        "facilitator": config["facilitator"],
        "accepts": [
            {
                "scheme": "exact",
                "network": config["network"],
                "maxAmountRequired": config["amount"],
                "resource": f"/x402/invoke/{AGENT_NAME}",
                "payTo": config["receiver"],
                "asset": config["asset"],
            }
        ],
    }


@app.post("/x402/invoke/{agent_name}", response_model=InvokeResponse)
async def invoke_agent(
    agent_name: str,
    request: InvokeRequest,
    x_payment: Optional[str] = Header(None, alias="X-PAYMENT"),
):
    """
    Invoke the wallet guardian agent.
    
    If x402 is enabled, requires a valid X-PAYMENT header.
    """
    # Verify agent exists
    if agent_name != AGENT_NAME:
        raise HTTPException(
            status_code=404,
            detail=f"Agent '{agent_name}' not found. Available: {AGENT_NAME}"
        )
    
    # Check payment if x402 is enabled
    config = get_x402_config()
    if config["enabled"] and not verify_payment(x_payment):
        return JSONResponse(
            status_code=402,
            content={
                "error": "Payment Required",
                "requirements": {
                    "network": config["network"],
                    "amount": config["amount"],
                    "asset": config["asset"],
                    "payTo": config["receiver"],
                }
            },
            headers={
                "X-Payment-Required": "true",
            }
        )
    
    # Set mock mode if requested
    if request.use_mock:
        os.environ["WALLET_GUARDIAN_USE_MOCK"] = "true"
    
    try:
        # Call tools directly based on the prompt
        # In production with LLM configured, the agent would parse and execute appropriately
        tools_used = []
        response_text = ""
        
        # Simple prompt parsing for demo
        prompt_lower = request.prompt.lower()
        
        if "analyze" in prompt_lower or "summary" in prompt_lower or "summarize" in prompt_lower:
            # Extract address from prompt (simple parsing)
            words = request.prompt.split()
            address = None
            for i, word in enumerate(words):
                if word.lower() in ("wallet", "address") and i + 1 < len(words):
                    address = words[i + 1].strip("\"'")
                elif word.startswith("N") and len(word) > 30:
                    address = word.strip("\"'")
            
            if address:
                from src.tools import GetWalletSummaryTool, WalletValidityScoreTool
                
                summary_tool = GetWalletSummaryTool()
                score_tool = WalletValidityScoreTool()
                
                summary = summary_tool.call(address=address, use_mock=request.use_mock)
                score = score_tool.call(address=address)
                
                tools_used = ["get_wallet_summary", "wallet_validity_score"]
                response_text = json.dumps({
                    "summary": summary,
                    "validity_score": score,
                }, indent=2)
            else:
                response_text = "Please provide a wallet address to analyze. Example: 'analyze wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq'"
        
        elif "score" in prompt_lower or "validity" in prompt_lower:
            # Extract address
            words = request.prompt.split()
            address = None
            for word in words:
                if word.startswith("N") and len(word) > 30:
                    address = word.strip("\"'")
            
            if address:
                from src.tools import WalletValidityScoreTool
                score_tool = WalletValidityScoreTool()
                score = score_tool.call(address=address)
                tools_used = ["wallet_validity_score"]
                response_text = json.dumps(score, indent=2)
            else:
                response_text = "Please provide a wallet address. Example: 'score NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq'"
        
        else:
            # Default response
            response_text = f"""Neo Wallet Guardian Agent

Available commands:
- "analyze wallet <address>" - Get full wallet summary and risk analysis
- "score <address>" - Get validity score for a wallet
- "summarize <address>" - Get wallet balances and transfers

Example: "analyze wallet NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq"

Available tools: {[t.name for t in get_tools()]}
"""
        
        return InvokeResponse(
            agent=agent_name,
            prompt=request.prompt,
            response=response_text,
            tools_used=tools_used,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Agent execution failed: {str(e)}"
        )
    finally:
        # Reset mock mode
        if "WALLET_GUARDIAN_USE_MOCK" in os.environ:
            del os.environ["WALLET_GUARDIAN_USE_MOCK"]


@app.post("/analyze")
async def analyze_wallet_simple(request: InvokeRequest):
    """
    Simplified endpoint for wallet analysis (no x402 required).
    Useful for testing and demos.
    """
    # Redirect to the main invoke endpoint
    return await invoke_agent(AGENT_NAME, request)


@app.get("/agents")
async def list_agents():
    """List available agents."""
    return {
        "agents": [register_agent()]
    }


# =============================================================================
# Advanced Features API
# =============================================================================

class PortfolioRequest(BaseModel):
    """Request for portfolio analysis."""
    wallets: list[dict]  # [{"address": str, "label": str}]
    lookback_days: int = 30


class PredictRequest(BaseModel):
    """Request for risk prediction."""
    address: str
    lookback_days: int = 90
    forecast_days: int = 7


class GraphRequest(BaseModel):
    """Request for relationship graph."""
    addresses: list[str]
    depth: int = 2
    lookback_days: int = 30


class MonitorRequest(BaseModel):
    """Request to add/remove monitored wallet."""
    address: str
    action: str = "add"  # "add" or "remove"


class AlertRuleRequest(BaseModel):
    """Request to create custom alert rule."""
    name: str
    condition: str  # e.g., "risk_score < 50"
    priority: str = "medium"  # "low", "medium", "high", "critical"
    wallets: list[str] | None = None


# Global instances for stateful features
_monitor_instance = None
_alert_system_instance = None


def get_monitor():
    global _monitor_instance
    if _monitor_instance is None:
        from src.advanced_features import RealTimeMonitor
        _monitor_instance = RealTimeMonitor()
    return _monitor_instance


def get_alert_system():
    global _alert_system_instance
    if _alert_system_instance is None:
        from src.advanced_features import SmartAlertSystem
        _alert_system_instance = SmartAlertSystem()
    return _alert_system_instance


@app.post("/api/v2/analyze/{address}")
async def analyze_wallet_v2(address: str, lookback_days: int = 30):
    """
    Analyze a single wallet using the graph orchestrator.
    
    Returns comprehensive risk analysis with computation graph metrics.
    """
    try:
        from src.graph_orchestrator import analyze_wallet
        result = await analyze_wallet(address, lookback_days)
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/portfolio")
async def analyze_portfolio_endpoint(request: PortfolioRequest):
    """
    Analyze multiple wallets as a portfolio.
    
    Features:
    - Parallel analysis of all wallets
    - Weighted risk score aggregation
    - Cross-wallet activity detection
    - Diversification scoring
    """
    try:
        from src.advanced_features import analyze_portfolio, PortfolioWallet
        
        wallets = [
            {"address": w["address"], "label": w.get("label", "")}
            for w in request.wallets
        ]
        
        result = await analyze_portfolio(wallets)
        
        return JSONResponse(content={
            "total_value_usd": result.total_value_usd,
            "weighted_risk_score": result.weighted_risk_score,
            "risk_level": result.risk_level,
            "wallet_count": result.wallet_count,
            "highest_risk_wallet": result.highest_risk_wallet,
            "lowest_risk_wallet": result.lowest_risk_wallet,
            "diversification_score": result.diversification_score,
            "cross_wallet_activity": result.cross_wallet_activity,
            "individual_analyses": result.individual_analyses,
            "computation_time_ms": result.computation_time_ms,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/predict/{address}")
async def predict_risk_endpoint(address: str, request: PredictRequest = None):
    """
    Predict future risk score using time-series analysis.
    
    Features:
    - Historical risk trend analysis
    - Future score prediction
    - Confidence scoring
    - Risk factor identification
    """
    try:
        from src.advanced_features import predict_risk
        
        lookback = request.lookback_days if request else 90
        forecast = request.forecast_days if request else 7
        
        from src.advanced_features import PredictiveRiskAnalyzer
        analyzer = PredictiveRiskAnalyzer()
        result = await analyzer.analyze_trend(address, lookback, forecast)
        
        return JSONResponse(content={
            "current_score": result.current_score,
            "predicted_score": result.predicted_score,
            "trend_direction": result.trend_direction,
            "confidence": result.confidence,
            "forecast_days": result.forecast_days,
            "historical_scores": result.historical_scores,
            "risk_factors": result.risk_factors,
            "recommendation": result.recommendation,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/graph")
async def build_graph_endpoint(request: GraphRequest):
    """
    Build a wallet relationship graph.
    
    Features:
    - Multi-hop relationship exploration
    - Cluster detection
    - Central address identification
    - Suspicious relationship flagging
    """
    try:
        from src.advanced_features import build_relationship_graph
        
        result = await build_relationship_graph(
            request.addresses, 
            depth=request.depth
        )
        
        return JSONResponse(content={
            "nodes": [
                {
                    "address": n.address,
                    "label": n.label,
                    "risk_score": n.risk_score,
                    "total_volume": n.total_volume,
                    "is_monitored": n.is_monitored,
                    "node_type": n.node_type,
                }
                for n in result.nodes
            ],
            "edges": [
                {
                    "from": e.from_address,
                    "to": e.to_address,
                    "transaction_count": e.transaction_count,
                    "total_volume": e.total_volume,
                    "last_activity": e.last_activity,
                    "relationship_type": e.relationship_type,
                }
                for e in result.edges
            ],
            "clusters": result.clusters,
            "central_addresses": result.central_addresses,
            "suspicious_relationships": result.suspicious_relationships,
            "graph_density": result.graph_density,
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/monitor")
async def manage_monitor(request: MonitorRequest):
    """
    Add or remove a wallet from real-time monitoring.
    """
    monitor = get_monitor()
    
    if request.action == "add":
        monitor.add_wallet(request.address)
        return {"status": "added", "address": request.address}
    elif request.action == "remove":
        monitor.remove_wallet(request.address)
        return {"status": "removed", "address": request.address}
    else:
        raise HTTPException(status_code=400, detail="Invalid action. Use 'add' or 'remove'.")


@app.get("/api/v2/monitor/check")
async def check_monitored_wallets():
    """
    Run one monitoring cycle and return any events.
    """
    try:
        monitor = get_monitor()
        events = await monitor.monitor_once()
        return JSONResponse(content={
            "events": [e.to_dict() for e in events],
            "monitored_wallets": list(monitor.monitored_wallets.keys()),
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v2/alerts")
async def get_alerts(
    wallet: str = None,
    priority: str = None,
    unacknowledged_only: bool = False
):
    """
    Get triggered alerts with optional filters.
    """
    from src.advanced_features import AlertPriority
    
    alert_system = get_alert_system()
    
    priority_enum = None
    if priority:
        priority_map = {
            "low": AlertPriority.LOW,
            "medium": AlertPriority.MEDIUM,
            "high": AlertPriority.HIGH,
            "critical": AlertPriority.CRITICAL,
        }
        priority_enum = priority_map.get(priority.lower())
    
    alerts = alert_system.get_alerts(
        wallet=wallet,
        priority=priority_enum,
        unacknowledged_only=unacknowledged_only
    )
    
    return JSONResponse(content={
        "alerts": [
            {
                "id": a.id,
                "rule_id": a.rule_id,
                "alert_type": a.alert_type.value,
                "priority": a.priority.name.lower(),
                "wallet_address": a.wallet_address,
                "title": a.title,
                "description": a.description,
                "triggered_at": a.triggered_at,
                "acknowledged": a.acknowledged,
            }
            for a in alerts
        ],
        "total": len(alerts),
    })


@app.post("/api/v2/alerts/evaluate/{address}")
async def evaluate_alerts_for_wallet(address: str):
    """
    Evaluate all alert rules against a specific wallet.
    """
    try:
        alert_system = get_alert_system()
        alerts = await alert_system.evaluate_wallet(address)
        
        return JSONResponse(content={
            "triggered_alerts": [
                {
                    "id": a.id,
                    "title": a.title,
                    "priority": a.priority.name.lower(),
                    "description": a.description,
                }
                for a in alerts
            ],
            "count": len(alerts),
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/alerts/acknowledge/{alert_id}")
async def acknowledge_alert(alert_id: str):
    """
    Acknowledge an alert.
    """
    alert_system = get_alert_system()
    alert_system.acknowledge_alert(alert_id)
    return {"status": "acknowledged", "alert_id": alert_id}


@app.post("/api/v2/alerts/rules")
async def create_alert_rule(request: AlertRuleRequest):
    """
    Create a custom alert rule.
    
    Example conditions:
    - "risk_score < 50"
    - "balance_change_percent < -20"
    - "counterparty_count > 100"
    """
    from src.advanced_features import AlertPriority
    
    priority_map = {
        "low": AlertPriority.LOW,
        "medium": AlertPriority.MEDIUM,
        "high": AlertPriority.HIGH,
        "critical": AlertPriority.CRITICAL,
    }
    
    alert_system = get_alert_system()
    rule = alert_system.create_custom_rule(
        name=request.name,
        condition_expr=request.condition,
        priority=priority_map.get(request.priority.lower(), AlertPriority.MEDIUM),
        wallets=request.wallets
    )
    
    return {
        "rule_id": rule.id,
        "name": rule.name,
        "condition": request.condition,
        "priority": request.priority,
    }


@app.get("/api/v2/alerts/rules")
async def list_alert_rules():
    """
    List all alert rules.
    """
    alert_system = get_alert_system()
    return {
        "rules": [
            {
                "id": r.id,
                "name": r.name,
                "alert_type": r.alert_type.value,
                "priority": r.priority.name.lower(),
                "enabled": r.enabled,
                "cooldown_minutes": r.cooldown_minutes,
            }
            for r in alert_system.rules.values()
        ]
    }


# =============================================================================
# Voice Guardian API (ElevenLabs Integration)
# =============================================================================

class VoiceAlertRequest(BaseModel):
    """Request for voice alert."""
    message: str
    severity: str = "info"  # info, warning, critical, emergency
    address: str | None = None


class VoiceInspectionRequest(BaseModel):
    """Request for voice inspection result."""
    address: str
    lookback_days: int = 30


class VoiceSummaryRequest(BaseModel):
    """Request for voice wallet summary."""
    address: str
    include_balances: bool = True
    include_activity: bool = True


class VoiceQueryRequest(BaseModel):
    """Request for voice query response."""
    query: str
    response: str
    persona: str = "professional"  # professional, friendly, urgent, concise


# Global voice guardian instance
_voice_guardian_instance = None


def get_voice_guardian_instance():
    """Get or create global voice guardian instance."""
    global _voice_guardian_instance
    if _voice_guardian_instance is None:
        from src.voice_guardian import VoiceGuardian
        _voice_guardian_instance = VoiceGuardian()
    return _voice_guardian_instance


@app.get("/api/v2/voice/status")
async def voice_status():
    """
    Check voice guardian status and ElevenLabs API availability.
    """
    from src.config import get_elevenlabs_api_key
    
    api_key = get_elevenlabs_api_key()
    has_key = bool(api_key)
    
    result = {
        "enabled": has_key,
        "api_configured": has_key,
        "features": [
            "speak_alert",
            "speak_inspection",
            "speak_summary",
            "speak_portfolio",
            "speak_query",
            "stream_alert",
        ] if has_key else [],
    }
    
    # Try to get user info if API key is available
    if has_key:
        try:
            voice = get_voice_guardian_instance()
            user_info = await voice.client.get_user_info()
            result["subscription"] = {
                "tier": user_info.get("subscription", {}).get("tier", "unknown"),
                "character_count": user_info.get("subscription", {}).get("character_count", 0),
                "character_limit": user_info.get("subscription", {}).get("character_limit", 0),
            }
        except Exception as e:
            result["error"] = str(e)
    
    return result


@app.get("/api/v2/voice/voices")
async def list_voices():
    """
    List available ElevenLabs voices.
    """
    try:
        voice = get_voice_guardian_instance()
        voices = await voice.client.get_voices()
        return {
            "voices": [
                {
                    "voice_id": v.get("voice_id"),
                    "name": v.get("name"),
                    "category": v.get("category"),
                    "labels": v.get("labels", {}),
                }
                for v in voices
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/voice/speak/alert")
async def speak_alert_endpoint(request: VoiceAlertRequest):
    """
    Generate voice audio for an alert message.
    
    Returns base64-encoded MP3 audio.
    """
    from src.voice_guardian import AlertSeverity, audio_to_base64
    
    try:
        voice = get_voice_guardian_instance()
        
        severity_map = {
            "info": AlertSeverity.INFO,
            "warning": AlertSeverity.WARNING,
            "critical": AlertSeverity.CRITICAL,
            "emergency": AlertSeverity.EMERGENCY,
        }
        
        severity = severity_map.get(request.severity.lower(), AlertSeverity.INFO)
        audio = await voice.speak_alert(request.message, severity, request.address)
        
        return {
            "success": True,
            "audio_format": "mp3",
            "audio_data": audio_to_base64(audio),
            "message": request.message,
            "severity": request.severity,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/voice/speak/inspection")
async def speak_inspection_endpoint(request: VoiceInspectionRequest):
    """
    Analyze a wallet for suspicious activity and speak the results.
    
    Returns base64-encoded MP3 audio of the spoken inspection report.
    """
    from src.voice_guardian import audio_to_base64
    from src.SusInspector import SusInspector
    
    try:
        # Run inspection
        inspector = SusInspector()
        result = inspector.inspect_wallet(request.address, request.lookback_days)
        
        # Generate voice
        voice = get_voice_guardian_instance()
        audio = await voice.speak_suspicious_activity(result)
        
        return {
            "success": True,
            "audio_format": "mp3",
            "audio_data": audio_to_base64(audio),
            "inspection_result": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/voice/speak/summary")
async def speak_summary_endpoint(request: VoiceSummaryRequest):
    """
    Get wallet summary and speak it.
    
    Returns base64-encoded MP3 audio of the spoken wallet summary.
    """
    from src.voice_guardian import audio_to_base64
    from src.tools import GetWalletSummaryTool
    
    try:
        # Get summary
        summary_tool = GetWalletSummaryTool()
        summary = summary_tool.call(address=request.address)
        
        if isinstance(summary, dict) and summary.get("error"):
            raise HTTPException(status_code=400, detail=summary["error"])
        
        # Generate voice
        voice = get_voice_guardian_instance()
        audio = await voice.speak_wallet_summary(
            summary,
            include_balances=request.include_balances,
            include_activity=request.include_activity,
        )
        
        return {
            "success": True,
            "audio_format": "mp3",
            "audio_data": audio_to_base64(audio),
            "wallet_summary": summary,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/voice/speak/query")
async def speak_query_endpoint(request: VoiceQueryRequest):
    """
    Speak a response to a user query.
    
    Useful for making any text response audible.
    """
    from src.voice_guardian import VoicePersona, audio_to_base64
    
    try:
        persona_map = {
            "professional": VoicePersona.PROFESSIONAL,
            "friendly": VoicePersona.FRIENDLY,
            "urgent": VoicePersona.URGENT,
            "concise": VoicePersona.CONCISE,
        }
        
        persona = persona_map.get(request.persona.lower(), VoicePersona.PROFESSIONAL)
        
        voice = get_voice_guardian_instance()
        audio = await voice.speak_query_response(request.query, request.response, persona)
        
        return {
            "success": True,
            "audio_format": "mp3",
            "audio_data": audio_to_base64(audio),
            "persona": request.persona,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/voice/speak/portfolio")
async def speak_portfolio_endpoint(request: PortfolioRequest):
    """
    Analyze a portfolio and speak the briefing.
    
    Returns base64-encoded MP3 audio of the spoken portfolio analysis.
    """
    from src.voice_guardian import audio_to_base64
    from src.advanced_features import PortfolioAnalyzer, PortfolioWallet
    
    try:
        # Run portfolio analysis
        analyzer = PortfolioAnalyzer()
        wallets = [
            PortfolioWallet(address=w["address"], label=w.get("label", f"Wallet {i+1}"))
            for i, w in enumerate(request.wallets)
        ]
        result = await analyzer.analyze_portfolio(wallets, request.lookback_days)
        
        # Convert to dict for voice
        portfolio_dict = {
            "wallet_count": result.wallet_count,
            "weighted_risk_score": result.weighted_risk_score,
            "risk_level": result.risk_level,
            "diversification_score": result.diversification_score,
            "highest_risk_wallet": result.highest_risk_wallet,
            "lowest_risk_wallet": result.lowest_risk_wallet,
        }
        
        # Generate voice
        voice = get_voice_guardian_instance()
        audio = await voice.speak_portfolio_briefing(portfolio_dict)
        
        return {
            "success": True,
            "audio_format": "mp3",
            "audio_data": audio_to_base64(audio),
            "portfolio_analysis": portfolio_dict,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    print(f"\nStarting server at http://{host}:{port}")
    print(f"API docs at http://{host}:{port}/docs\n")
    
    uvicorn.run(app, host=host, port=port)
