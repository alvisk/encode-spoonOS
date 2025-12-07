"""
SpoonOS-native x402 Gateway Server for Neo Wallet Guardian Agent.

This server uses the SpoonOS x402 payment infrastructure to host the
Wallet Guardian agent with native payment support.

Usage:
    # Development
    python spoonos_server.py

    # Production
    uvicorn spoonos_server:app --host 0.0.0.0 --port 8000
"""

import os
import asyncio
from typing import Optional, AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel

import logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv(override=True)

# SpoonOS x402 payments
from spoon_ai.payments.app import create_paywalled_router
from spoon_ai.payments import X402PaymentService

# Import our agent
from src.agent import build_agent, AGENT_NAME, get_tools, register_agent

# =============================================================================
# Agent Factory for SpoonOS
# =============================================================================

# Cache the agent instance
_agent_cache = {}

# Accept both names for backwards compatibility
ACCEPTED_AGENT_NAMES = {"wallet-guardian", "assertion-os", AGENT_NAME}

async def wallet_guardian_agent_factory(agent_name: str):
    """Factory function that returns our Wallet Guardian agent."""
    if agent_name not in ACCEPTED_AGENT_NAMES:
        raise ValueError(f"Unknown agent: {agent_name}. Available: {list(ACCEPTED_AGENT_NAMES)}")
    
    # Use canonical name for caching
    if AGENT_NAME not in _agent_cache:
        _agent_cache[AGENT_NAME] = build_agent()
    
    return _agent_cache[AGENT_NAME]


# =============================================================================
# App Configuration
# =============================================================================

app = FastAPI(
    title="Neo Wallet Guardian (SpoonOS)",
    description="AI-powered wallet analysis agent for Neo N3 with SpoonOS x402 payment support",
    version="1.0.0",
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
# Health & Discovery Endpoints
# =============================================================================

@app.get("/")
async def root():
    """Root endpoint with health check."""
    return {
        "status": "healthy",
        "agent": AGENT_NAME,
        "tools": [t.name for t in get_tools()],
        "x402_enabled": bool(os.getenv("X402_RECEIVER_ADDRESS")),
        "powered_by": "SpoonOS",
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return await root()


@app.get("/agents")
async def list_agents():
    """List available agents."""
    return {
        "agents": [register_agent()]
    }


# =============================================================================
# SpoonOS x402 Paywalled Router
# =============================================================================

# Create x402 payment service if configured
payment_service = None
if os.getenv("X402_RECEIVER_ADDRESS"):
    try:
        payment_service = X402PaymentService()
        print(f"x402 Payment Service initialized")
        print(f"  Receiver: {os.getenv('X402_RECEIVER_ADDRESS')}")
        print(f"  Network: {os.getenv('X402_DEFAULT_NETWORK', 'base-sepolia')}")
        print(f"  Amount: {os.getenv('X402_DEFAULT_AMOUNT_USDC', '0.01')} USDC")
    except Exception as e:
        print(f"Warning: Could not initialize x402 payment service: {e}")
        payment_service = None

# Create the paywalled router using SpoonOS infrastructure
x402_router = create_paywalled_router(
    service=payment_service,
    agent_factory=wallet_guardian_agent_factory,
    payment_message="Payment required to use Wallet Guardian agent",
)

# Mount the x402 router (no prefix - router already has /x402 paths)
app.include_router(x402_router, tags=["x402"])


# =============================================================================
# Free Tier Endpoint (for testing)
# =============================================================================

@app.post("/analyze")
async def analyze_wallet_free(prompt: str, use_mock: bool = False):
    """
    Free endpoint for wallet analysis (no x402 required).
    Useful for testing and demos.
    """
    if use_mock:
        os.environ["WALLET_GUARDIAN_USE_MOCK"] = "true"
    
    try:
        agent = await wallet_guardian_agent_factory(AGENT_NAME)
        result = await agent.run(prompt)
        
        # Reset agent state
        agent.current_step = 0
        if hasattr(agent, 'memory') and hasattr(agent.memory, 'clear'):
            agent.memory.clear()
        
        return {
            "agent": AGENT_NAME,
            "prompt": prompt,
            "response": result,
        }
    finally:
        if "WALLET_GUARDIAN_USE_MOCK" in os.environ:
            del os.environ["WALLET_GUARDIAN_USE_MOCK"]


async def stream_agent_response(prompt: str) -> AsyncGenerator[str, None]:
    """
    Stream the agent response with progress updates.
    Yields Server-Sent Events (SSE) formatted data.
    
    Note: Since the underlying SDK doesn't support true token streaming,
    we run the agent to completion while sending keepalive/progress messages,
    then stream the result word by word for a better user experience.
    """
    try:
        agent = await wallet_guardian_agent_factory(AGENT_NAME)
        
        # Send initial status
        yield "data: Analyzing wallet...\n\n"
        
        # Run agent in background task so we can send keepalives
        result_holder = {"result": None, "error": None, "done": False}
        
        async def run_agent():
            try:
                result_holder["result"] = await agent.run(prompt)
            except Exception as e:
                result_holder["error"] = e
            finally:
                result_holder["done"] = True
        
        # Start the agent task
        agent_task = asyncio.create_task(run_agent())
        
        # Send keepalive pings every 5 seconds while waiting
        progress_messages = [
            "Fetching blockchain data...",
            "Analyzing transactions...",
            "Computing risk score...",
            "Generating report...",
        ]
        msg_index = 0
        
        while not result_holder["done"]:
            await asyncio.sleep(5)
            if not result_holder["done"]:
                # Send progress update to keep connection alive
                msg = progress_messages[msg_index % len(progress_messages)]
                yield f"data: {msg}\n\n"
                msg_index += 1
        
        # Wait for task to fully complete
        await agent_task
        
        # Check for errors
        if result_holder["error"]:
            raise result_holder["error"]
        
        result = result_holder["result"]
        
        # Reset agent state
        agent.current_step = 0
        if hasattr(agent, 'memory') and hasattr(agent.memory, 'clear'):
            agent.memory.clear()
        
        # Clear the progress messages and stream the actual result
        yield "data: [CLEAR]\n\n"
        await asyncio.sleep(0.02)
        
        # Stream the result word by word for a typing effect
        if result:
            words = result.split(' ')
            for i, word in enumerate(words):
                # Add space before word (except first)
                if i > 0:
                    yield f"data:  \n\n"
                yield f"data: {word}\n\n"
                # Small delay between words for typing effect
                await asyncio.sleep(0.01)
        
        # Send done event
        yield "data: [DONE]\n\n"
        
    except Exception as e:
        logger.error(f"Streaming error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        yield f"data: [ERROR] {str(e)}\n\n"


@app.post("/analyze/stream")
async def analyze_wallet_stream(prompt: str, use_mock: bool = False):
    """
    Streaming endpoint for wallet analysis.
    Returns Server-Sent Events (SSE) stream of tokens.
    """
    if use_mock:
        os.environ["WALLET_GUARDIAN_USE_MOCK"] = "true"
    
    try:
        return StreamingResponse(
            stream_agent_response(prompt),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # Disable nginx buffering
            }
        )
    finally:
        if "WALLET_GUARDIAN_USE_MOCK" in os.environ:
            del os.environ["WALLET_GUARDIAN_USE_MOCK"]


# =============================================================================
# Contract Scan Endpoints (for Neo Oracle)
# =============================================================================

class ContractScanRequest(BaseModel):
    """Request for contract scanning."""
    contract_address: str
    chain: str = "ethereum"
    force_refresh: bool = False
    use_ai: bool = True


@app.get("/api/v2/contract-scan/{address}")
async def scan_contract_for_malicious_patterns(
    address: str,
    chain: str = "ethereum",
    format: str = "json",
    force_refresh: bool = False,
    use_ai: bool = True,
):
    """
    Scan an Ethereum smart contract for malicious patterns.
    
    This endpoint is designed to be called by the Neo Oracle to analyze
    Ethereum contracts for security issues.
    
    Args:
        address: Ethereum contract address (0x...)
        chain: Chain to scan - "ethereum" (mainnet) or "sepolia" (testnet)
        format: Response format - "json" for full response, "oracle" for Neo Oracle compact format
        force_refresh: Bypass cache and force fresh analysis
        use_ai: Use AI for deep analysis (slower but more thorough)
    """
    try:
        from src.tools.malicious_contract_detector import (
            MaliciousContractDetectorTool,
            format_for_oracle,
        )
        
        detector = MaliciousContractDetectorTool()
        result = detector.call(
            contract_address=address,
            chain=chain,
            force_refresh=force_refresh,
            use_ai=use_ai,
        )
        
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        
        if format.lower() == "oracle":
            oracle_response = format_for_oracle(result)
            return JSONResponse(content={
                "oracle_response": oracle_response,
                "address": address,
            })
        else:
            return JSONResponse(content=result)
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v2/contract-scan")
async def scan_contract_post(request: ContractScanRequest):
    """POST version of contract scan."""
    return await scan_contract_for_malicious_patterns(
        address=request.contract_address,
        chain=request.chain,
        force_refresh=request.force_refresh,
        use_ai=request.use_ai,
    )


@app.get("/api/v2/contract-scan/known-malicious")
async def list_known_malicious_contracts():
    """List all known malicious contracts in the database."""
    try:
        from src.tools.known_malicious_contracts import KNOWN_MALICIOUS_CONTRACTS
        return JSONResponse(content={
            "count": len(KNOWN_MALICIOUS_CONTRACTS),
            "contracts": [
                {
                    "address": addr,
                    "name": info.get("name"),
                    "category": info.get("category"),
                }
                for addr, info in KNOWN_MALICIOUS_CONTRACTS.items()
            ]
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Main
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    
    print(f"\n{'='*60}")
    print(f"  Neo Wallet Guardian - SpoonOS x402 Gateway")
    print(f"{'='*60}")
    print(f"  Server: http://{host}:{port}")
    print(f"  API Docs: http://{host}:{port}/docs")
    print(f"  Agent: {AGENT_NAME}")
    print(f"  Tools: {[t.name for t in get_tools()]}")
    print(f"{'='*60}\n")
    
    uvicorn.run(app, host=host, port=port)
