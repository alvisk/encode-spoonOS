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
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    print(f"\nStarting server at http://{host}:{port}")
    print(f"API docs at http://{host}:{port}/docs\n")
    
    uvicorn.run(app, host=host, port=port)
