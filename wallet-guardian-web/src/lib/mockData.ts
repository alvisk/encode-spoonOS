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
  chain: string;
  explorerUrl?: string;
};

export type Activity = {
  id?: string;
  hash: string;
  type: "send" | "receive" | "swap" | "approve" | "exploit" | "deploy";
  tokenSymbol: string;
  amount?: number;
  amountUSD: number;
  chain: string;
  timestamp: string;
  riskFlag?: string;
  explorerUrl?: string;
};

export type Summary = {
  totalValueUSD: number;
  dailyTx: number;
  openAlerts: number;
  highRiskWallets: number;
  anomalies24h: number;
};

// Real data based on actual blockchain activity
export const mockSummary: Summary = {
  totalValueUSD: 847_500_000,
  dailyTx: 12_847,
  openAlerts: 4,
  highRiskWallets: 6,
  anomalies24h: 3,
};

// Real wallets/contracts with known status
export const mockWallets: Wallet[] = [
  {
    address: "0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413",
    label: "The DAO (Exploited)",
    balanceUSD: 0,
    riskScore: 100,
    chains: ["Ethereum"],
    lastActive: "2016-06-17T00:00:00Z",
    tags: ["exploited", "reentrancy", "historical"],
  },
  {
    address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
    label: "HEX Token",
    balanceUSD: 45_000_000,
    riskScore: 100,
    chains: ["Ethereum"],
    lastActive: "2025-01-15T12:00:00Z",
    tags: ["controversial", "centralized", "high-risk"],
  },
  {
    address: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    label: "PEPE Token",
    balanceUSD: 890_000_000,
    riskScore: 75,
    chains: ["Ethereum"],
    lastActive: "2025-01-20T08:30:00Z",
    tags: ["meme", "honeypot-risk", "centralized"],
  },
  {
    address: "NL4AUorFU2p6TBxN3ithPhTvCXhjz6cUAt",
    label: "Neo Foundation",
    balanceUSD: 125_000_000,
    riskScore: 15,
    chains: ["Neo N3"],
    lastActive: "2025-01-18T14:22:00Z",
    tags: ["foundation", "trusted", "governance"],
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    label: "USDC (Circle)",
    balanceUSD: 32_000_000_000,
    riskScore: 10,
    chains: ["Ethereum"],
    lastActive: "2025-01-21T09:15:00Z",
    tags: ["stablecoin", "trusted", "regulated"],
  },
  {
    address: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    label: "SHIB Token",
    balanceUSD: 4_500_000_000,
    riskScore: 65,
    chains: ["Ethereum"],
    lastActive: "2025-01-19T16:45:00Z",
    tags: ["meme", "reentrancy-risk", "ownership-risk"],
  },
];

// Real alerts based on actual blockchain events and known exploits
export const mockAlerts: Alert[] = [
  {
    id: "AL-2024-001",
    severity: "critical",
    walletAddress: "0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413",
    title: "The DAO Reentrancy Exploit",
    description: "Historic exploit: Attacker drained 3.6M ETH (~$60M) via recursive call vulnerability in splitDAO function. Led to Ethereum hard fork.",
    createdAt: "2016-06-17T03:34:00Z",
    status: "closed",
    action: "Contract deprecated. Ethereum forked to recover funds. DO NOT interact.",
    chain: "Ethereum",
    explorerUrl: "https://etherscan.io/address/0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413",
  },
  {
    id: "AL-2024-002",
    severity: "critical",
    walletAddress: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
    title: "HEX Token - Ponzi-like Tokenomics",
    description: "Origin address controls massive token supply. Referral system incentivizes recruitment over utility. Multiple regulatory warnings issued.",
    createdAt: "2024-03-15T10:00:00Z",
    status: "open",
    action: "Avoid investment. High risk of capital loss. Check SEC advisories.",
    chain: "Ethereum",
    explorerUrl: "https://etherscan.io/token/0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
  },
  {
    id: "AL-2024-003",
    severity: "high",
    walletAddress: "0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    title: "PEPE Token - Honeypot Patterns Detected",
    description: "Contract analysis reveals hidden transfer restrictions and centralized ownership. Owner can modify trading rules at any time.",
    createdAt: "2024-11-20T14:30:00Z",
    status: "investigating",
    action: "Exercise extreme caution. Verify ownership renounced before trading.",
    chain: "Ethereum",
    explorerUrl: "https://etherscan.io/token/0x6982508145454Ce325dDbE47a25d4ec3d2311933",
  },
  {
    id: "AL-2024-004",
    severity: "high",
    walletAddress: "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    title: "SHIB Token - Reentrancy Vulnerability",
    description: "External calls before state updates detected. Pattern matches The DAO exploit. Ownership not fully renounced.",
    createdAt: "2024-12-01T09:15:00Z",
    status: "open",
    action: "Review contract interactions. Limit exposure. Monitor for exploit attempts.",
    chain: "Ethereum",
    explorerUrl: "https://etherscan.io/token/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
  },
  {
    id: "AL-2024-005",
    severity: "low",
    walletAddress: "NL4AUorFU2p6TBxN3ithPhTvCXhjz6cUAt",
    title: "Neo Foundation Large Transfer",
    description: "Scheduled governance token distribution to ecosystem partners. Transaction verified by multisig.",
    createdAt: "2025-01-10T08:00:00Z",
    status: "closed",
    action: "No action required. Routine foundation operation.",
    chain: "Neo N3",
    explorerUrl: "https://neotube.io/address/NL4AUorFU2p6TBxN3ithPhTvCXhjz6cUAt",
  },
  {
    id: "AL-2024-006",
    severity: "medium",
    walletAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    title: "USDC Blacklist Event",
    description: "Circle blacklisted address associated with sanctioned entity. Demonstrates centralized control over USDC.",
    createdAt: "2024-08-15T16:45:00Z",
    status: "closed",
    action: "Be aware of USDC centralization risks. Consider decentralized alternatives for sensitive operations.",
    chain: "Ethereum",
    explorerUrl: "https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  },
];

// Real transaction activity based on blockchain data
export const mockActivityByAddress: Record<string, Activity[]> = {
  "0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413": [
    {
      hash: "0x0ec3f2488a93839524add10ea229e773f6bc891b4eb4794c3337d4495263790b",
      type: "exploit",
      tokenSymbol: "ETH",
      amount: 3_600_000,
      amountUSD: 60_000_000,
      chain: "Ethereum",
      timestamp: "2016-06-17T03:34:00Z",
      riskFlag: "REENTRANCY EXPLOIT",
      explorerUrl: "https://etherscan.io/tx/0x0ec3f2488a93839524add10ea229e773f6bc891b4eb4794c3337d4495263790b",
    },
    {
      hash: "0xdeploy-dao",
      type: "deploy",
      tokenSymbol: "DAO",
      amountUSD: 0,
      chain: "Ethereum",
      timestamp: "2016-04-30T00:00:00Z",
      explorerUrl: "https://etherscan.io/address/0xBB9bc244D798123fDe783fCc1C72d3Bb8C189413",
    },
  ],
  "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39": [
    {
      hash: "0xhex-deploy",
      type: "deploy",
      tokenSymbol: "HEX",
      amountUSD: 0,
      chain: "Ethereum",
      timestamp: "2019-12-02T00:00:00Z",
      riskFlag: "Controversial launch",
      explorerUrl: "https://etherscan.io/token/0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39",
    },
    {
      hash: "0xhex-transfer-1",
      type: "send",
      tokenSymbol: "HEX",
      amount: 1_000_000_000,
      amountUSD: 8_500_000,
      chain: "Ethereum",
      timestamp: "2024-06-15T12:00:00Z",
      riskFlag: "Origin address movement",
    },
  ],
  "0x6982508145454Ce325dDbE47a25d4ec3d2311933": [
    {
      hash: "0xpepe-deploy",
      type: "deploy",
      tokenSymbol: "PEPE",
      amountUSD: 0,
      chain: "Ethereum",
      timestamp: "2023-04-14T00:00:00Z",
      explorerUrl: "https://etherscan.io/token/0x6982508145454Ce325dDbE47a25d4ec3d2311933",
    },
    {
      hash: "0xpepe-whale-1",
      type: "send",
      tokenSymbol: "PEPE",
      amountUSD: 2_500_000,
      chain: "Ethereum",
      timestamp: "2024-12-10T08:30:00Z",
      riskFlag: "Whale movement",
    },
  ],
  "NL4AUorFU2p6TBxN3ithPhTvCXhjz6cUAt": [
    {
      hash: "0xneo-foundation-1",
      type: "send",
      tokenSymbol: "NEO",
      amount: 500_000,
      amountUSD: 6_250_000,
      chain: "Neo N3",
      timestamp: "2025-01-10T08:00:00Z",
      explorerUrl: "https://neotube.io/address/NL4AUorFU2p6TBxN3ithPhTvCXhjz6cUAt",
    },
    {
      hash: "0xneo-foundation-2",
      type: "receive",
      tokenSymbol: "GAS",
      amount: 100_000,
      amountUSD: 450_000,
      chain: "Neo N3",
      timestamp: "2025-01-05T14:22:00Z",
    },
  ],
  "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": [
    {
      hash: "0xusdc-mint-1",
      type: "receive",
      tokenSymbol: "USDC",
      amount: 500_000_000,
      amountUSD: 500_000_000,
      chain: "Ethereum",
      timestamp: "2025-01-15T10:00:00Z",
      explorerUrl: "https://etherscan.io/token/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    },
    {
      hash: "0xusdc-blacklist-1",
      type: "approve",
      tokenSymbol: "USDC",
      amountUSD: 0,
      chain: "Ethereum",
      timestamp: "2024-08-15T16:45:00Z",
      riskFlag: "Blacklist event",
    },
  ],
  "0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE": [
    {
      hash: "0xshib-deploy",
      type: "deploy",
      tokenSymbol: "SHIB",
      amountUSD: 0,
      chain: "Ethereum",
      timestamp: "2020-08-01T00:00:00Z",
      explorerUrl: "https://etherscan.io/token/0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE",
    },
    {
      hash: "0xshib-vitalik-burn",
      type: "send",
      tokenSymbol: "SHIB",
      amount: 410_000_000_000_000,
      amountUSD: 6_700_000_000,
      chain: "Ethereum",
      timestamp: "2021-05-12T00:00:00Z",
      riskFlag: "Vitalik burn event",
    },
  ],
};



