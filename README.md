# SpoonOS Hackathon - Wallet Guardian

AI-powered multi-chain wallet security agent built on **SpoonOS** with **Neo N3 Oracle** integration.

> **Track**: AI Agent with Web3  
> **Hackathon**: Encode x SpoonOS (December 2025)

## Live Demo
 

| Resource | URL |
|----------|-----|
| **Website** | https://assertion.vercel.app/ |
| **API** | https://encode-spoonos-production.up.railway.app |
| **Docs** | https://encode-spoonos-production.up.railway.app/docs |

### Quick Test

```bash
# Health check
curl https://encode-spoonos-production.up.railway.app/health

# Analyze a Neo N3 wallet
curl -X POST "https://encode-spoonos-production.up.railway.app/analyze?prompt=analyze%20wallet%20NLapRhQFQDDCjAht7mPScrFRb7pTNn4QzT"

# Get x402 payment requirements
curl https://encode-spoonos-production.up.railway.app/x402/requirements
```

## Features

- **AI-Powered Analysis**: Uses Gemini AI via SpoonOS ToolCallAgent for intelligent wallet risk assessment
- **Real Neo N3 Data**: Fetches live on-chain balances and transfers via Neo RPC
- **Malicious Contract Detection**: Scans Ethereum smart contracts for honeypots, rug pulls, and vulnerabilities
- **x402 Payments**: Native x402 payment gateway on Base Sepolia (0.01 USDC per request)
- **Neo Oracle Contract**: On-chain risk scores via Neo's native Oracle service
- **Voice Alerts**: ElevenLabs-powered audio notifications for critical security events

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  SpoonOS Agent   │────▶│  Neo N3 RPC     │
│  (Next.js)      │     │  (Railway)       │     │  (Testnet)      │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
              ┌──────────┐ ┌───────┐ ┌──────────┐
              │ Gemini   │ │ Neo   │ │ Ethereum │
              │ AI       │ │Oracle │ │ Scanner  │
              └──────────┘ └───────┘ └──────────┘
```

## Documentation

| Component | Description | Docs |
|-----------|-------------|------|
| **wallet-guardian** | Core SpoonOS agent - AI wallet analysis, Neo N3 integration, 8 custom tools | [README](./wallet-guardian/README.md) |
| **wallet-guardian-web** | Next.js frontend with brutalist UI design | [README](./wallet-guardian-web/README.md) |
| **workflow** | AIOZ compute offloading design document | [README](./workflow/README.md) |

## Quick Start

### Backend (SpoonOS Agent)

```bash
cd wallet-guardian
python -m venv venv312 --python=python3.12
source venv312/bin/activate
pip install -r requirements.txt
python spoonos_server.py
```

### Frontend (Next.js)

```bash
cd wallet-guardian-web
pnpm install
pnpm dev
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Agent Framework | SpoonOS (spoon-ai-sdk) |
| LLM | Gemini 2.0 Flash |
| Blockchain | Neo N3 (Testnet), Ethereum |
| Payments | x402 Protocol on Base Sepolia |
| Hosting | Railway |
| Frontend | Next.js, TailwindCSS |

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

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check and agent info |
| `/agents` | GET | List available agents |
| `/analyze` | POST | Free tier wallet analysis |
| `/x402/requirements` | GET | x402 payment requirements |
| `/x402/invoke/wallet-guardian` | POST | Paywalled analysis (requires X-PAYMENT header) |
| `/api/v2/contract-scan/{address}` | GET | Malicious contract scan |

See [wallet-guardian/README.md](./wallet-guardian/README.md) for full API documentation.

## License

MIT
