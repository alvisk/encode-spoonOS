# Wallet Guardian Web

Next.js frontend for the Wallet Guardian SpoonOS agent with a brutalist UI design.

## Features

- **Wallet Dashboard**: Real-time wallet analysis with risk scores and transaction history
- **Voice Announcements**: Audio alerts for security events (via ElevenLabs)
- **Payment Flow**: x402 payment integration for premium analysis
- **Multi-Chain Support**: Auto-detects Neo N3 and Ethereum addresses

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS with brutalist design system
- **Web3**: wagmi + viem for wallet connections
- **UI Components**: shadcn/ui

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
pnpm build
```

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes (alerts, spoonos, summary, voice, wallets)
│   ├── about/            # About page
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Home page
├── components/
│   ├── presentation/     # Animated sections, feature cards, flow diagrams
│   ├── ui/               # shadcn/ui components
│   ├── PaymentFlow.tsx   # x402 payment integration
│   ├── WalletProvider.tsx
│   └── WalletToolsDashboard.tsx
├── hooks/
│   └── useVoiceAnnouncements.ts
├── lib/
│   ├── mockData.ts       # Demo data
│   ├── utils.ts          # Utility functions
│   └── wagmi.ts          # Web3 configuration
└── styles/
    └── globals.css
```

## API Routes

| Route | Description |
|-------|-------------|
| `/api/wallets` | List wallets |
| `/api/wallets/[address]` | Get wallet details |
| `/api/wallets/[address]/activity` | Get wallet activity |
| `/api/summary` | Get wallet summary |
| `/api/alerts` | Get security alerts |
| `/api/voice` | Voice announcement generation |
| `/api/spoonos` | Proxy to SpoonOS agent |

## Environment Variables

Create a `.env.local` file:

```bash
# SpoonOS API
NEXT_PUBLIC_SPOONOS_API_URL=https://encode-spoonos-production.up.railway.app

# Optional: ElevenLabs for voice
ELEVENLABS_API_KEY=...
```

## License

MIT
