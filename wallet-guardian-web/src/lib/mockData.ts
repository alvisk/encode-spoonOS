export type Wallet = {
  address: string;
  label: string;
  balanceUSD: number;
  riskScore: number; // 0 - 100
  chains: string[];
  lastActive: string;
  tags: string[];
};

export type Alert = {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  walletAddress: string;
  title: string;
  description: string;
  createdAt: string;
  status: "open" | "investigating" | "closed";
  action: string;
};

export type Activity = {
  id?: string;
  hash: string;
  type: "send" | "receive" | "swap" | "approve";
  tokenSymbol: string;
  amount?: number;
  amountUSD: number;
  chain: string;
  timestamp: string;
  riskFlag?: string;
};

export type Summary = {
  totalValueUSD: number;
  dailyTx: number;
  openAlerts: number;
  highRiskWallets: number;
  anomalies24h: number;
};

export const mockSummary: Summary = {
  totalValueUSD: 3_280_000,
  dailyTx: 182,
  openAlerts: 5,
  highRiskWallets: 3,
  anomalies24h: 7,
};

export const mockWallets: Wallet[] = [
  {
    address: "0x12F3...a4B9",
    label: "Treasury cold wallet",
    balanceUSD: 1_250_400,
    riskScore: 12,
    chains: ["Ethereum", "Arbitrum"],
    lastActive: "2025-02-02T15:20:00Z",
    tags: ["treasury", "multisig"],
  },
  {
    address: "0x98Ac...93d1",
    label: "Ops hot wallet",
    balanceUSD: 428_300,
    riskScore: 42,
    chains: ["Ethereum", "Base"],
    lastActive: "2025-02-03T10:05:00Z",
    tags: ["ops", "hot"],
  },
  {
    address: "bc1q8...kj4p",
    label: "BTC trading desk",
    balanceUSD: 1_601_300,
    riskScore: 28,
    chains: ["Bitcoin"],
    lastActive: "2025-02-03T07:55:00Z",
    tags: ["trading", "desk"],
  },
];

export const mockAlerts: Alert[] = [
  {
    id: "AL-1738",
    severity: "critical",
    walletAddress: "0x98Ac...93d1",
    title: "Unusual outflow spike",
    description: "3x increase vs 7d baseline. Top recipient flagged on Etherscan.",
    createdAt: "2025-02-03T09:30:00Z",
    status: "investigating",
    action: "Pause automation and require multisig for transfers > $25k.",
  },
  {
    id: "AL-1737",
    severity: "high",
    walletAddress: "0x12F3...a4B9",
    title: "New spender approval",
    description: "USDC allowance granted to unknown contract (Base).",
    createdAt: "2025-02-02T18:10:00Z",
    status: "open",
    action: "Revoke approval and rotate signer.",
  },
  {
    id: "AL-1736",
    severity: "medium",
    walletAddress: "bc1q8...kj4p",
    title: "Destination in recent sanctions list",
    description: "Outgoing to address added to OFAC watchlist 24h ago.",
    createdAt: "2025-02-02T11:42:00Z",
    status: "open",
    action: "Hold settlement until compliance review is complete.",
  },
  {
    id: "AL-1735",
    severity: "low",
    walletAddress: "0x12F3...a4B9",
    title: "Dormant wallet activity",
    description: "First movement after 90 days of inactivity.",
    createdAt: "2025-02-01T07:55:00Z",
    status: "closed",
    action: "Noted. No further action.",
  },
];

export const mockActivityByAddress: Record<string, Activity[]> = {
  "0x12F3...a4B9": [
    {
      hash: "0xabc123",
      type: "approve",
      tokenSymbol: "USDC",
      amountUSD: 50_000,
      chain: "Base",
      timestamp: "2025-02-02T18:05:00Z",
      riskFlag: "New spender",
    },
    {
      hash: "0xdef456",
      type: "send",
      tokenSymbol: "ETH",
      amountUSD: 120_000,
      chain: "Ethereum",
      timestamp: "2025-02-01T07:50:00Z",
    },
  ],
  "0x98Ac...93d1": [
    {
      hash: "0x987aaa",
      type: "send",
      tokenSymbol: "USDC",
      amountUSD: 35_000,
      chain: "Ethereum",
      timestamp: "2025-02-03T09:20:00Z",
      riskFlag: "Recipient flagged",
    },
    {
      hash: "0x987aab",
      type: "send",
      tokenSymbol: "ETH",
      amountUSD: 18_500,
      chain: "Base",
      timestamp: "2025-02-03T08:58:00Z",
    },
    {
      hash: "0x987aac",
      type: "receive",
      tokenSymbol: "USDC",
      amountUSD: 12_300,
      chain: "Ethereum",
      timestamp: "2025-02-02T19:10:00Z",
    },
  ],
  "bc1q8...kj4p": [
    {
      hash: "0xbbbb01",
      type: "send",
      tokenSymbol: "BTC",
      amountUSD: 250_000,
      chain: "Bitcoin",
      timestamp: "2025-02-02T11:35:00Z",
      riskFlag: "OFAC proximity",
    },
    {
      hash: "0xbbbb02",
      type: "receive",
      tokenSymbol: "BTC",
      amountUSD: 150_000,
      chain: "Bitcoin",
      timestamp: "2025-02-01T15:12:00Z",
    },
  ],
};


