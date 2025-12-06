# Neo Wallet Guardian - SpoonOS Agent

AI-powered wallet security analysis for Neo N3 blockchain, built on SpoonOS with x402 payment support.

## Live Demo

**SpoonOS API:** https://encode-spoonos-production.up.railway.app

### Quick Test

```bash
# Health Check
curl https://encode-spoonos-production.up.railway.app/health

# Analyze a Neo N3 Wallet (Real blockchain data)
curl -X POST "https://encode-spoonos-production.up.railway.app/analyze?prompt=analyze%20wallet%20NLapRhQFQDDCjAht7mPScrFRb7pTNn4QzT"

# x402 Payment Requirements
curl https://encode-spoonos-production.up.railway.app/x402/requirements

# x402 Paywalled Endpoint (requires payment)
curl -X POST https://encode-spoonos-production.up.railway.app/x402/invoke/wallet-guardian \
  -H "Content-Type: application/json" \
  -d '{"prompt": "analyze wallet NLapRhQFQDDCjAht7mPScrFRb7pTNn4QzT"}'
```

## Features

- **AI-Powered Analysis**: Uses Gemini AI via SpoonOS ToolCallAgent for intelligent wallet risk assessment
- **Real Neo N3 Data**: Fetches live on-chain balances and transfers via Neo RPC
- **x402 Payments**: Native x402 payment gateway on Base Sepolia (0.01 USDC per request)
- **Risk Scoring**: Computes validity scores based on concentration, stablecoin ratio, counterparty diversity

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and agent info |
| `/agents` | GET | List available agents |
| `/analyze` | POST | Free tier wallet analysis |
| `/x402/requirements` | GET | x402 payment requirements |
| `/x402/invoke/wallet-guardian` | POST | Paywalled analysis (requires X-PAYMENT header) |

## Projects

### `wallet-guardian/`
Neo Wallet Guardian SpoonOS agent. The core AI agent that analyzes Neo N3 wallets.

```bash
cd wallet-guardian
python -m venv venv312 --python=python3.12
source venv312/bin/activate
pip install -r requirements.txt
python spoonos_server.py
```

### `wallet-guardian-web/`
Next.js frontend with brutalist UI design. Integrates with the live SpoonOS API.

```bash
cd wallet-guardian-web
pnpm install
pnpm dev
```

## Tech Stack

- **Agent Framework**: SpoonOS (spoon-ai-sdk)
- **LLM**: Gemini 2.0 Flash
- **Blockchain**: Neo N3 (Testnet)
- **Payments**: x402 Protocol on Base Sepolia
- **Hosting**: Railway
- **Frontend**: Next.js, TailwindCSS

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Frontend      │────▶│  SpoonOS Agent   │────▶│  Neo N3 RPC │
│  (Next.js)      │     │  (Railway)       │     │  (Testnet)  │
└─────────────────┘     └──────────────────┘     └─────────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │  Gemini AI   │
                        │  (Analysis)  │
                        └──────────────┘
```

## Environment Variables

```bash
# Required
GEMINI_API_KEY=your-gemini-key

# x402 Configuration
X402_RECEIVER_ADDRESS=0x...
X402_DEFAULT_NETWORK=base-sepolia
X402_DEFAULT_ASSET=0x036CbD53842c5426634e7929541eC2318f3dCF7e
X402_DEFAULT_AMOUNT_USDC=0.01

# Neo RPC
NEO_RPC_URL=https://testnet1.neo.coz.io:443
```

## License

MIT
