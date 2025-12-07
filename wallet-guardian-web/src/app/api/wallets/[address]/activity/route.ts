import { NextResponse } from "next/server";

type ParamsPromise = { params: Promise<{ address: string }> };

// Known Neo N3 asset hashes
const ASSET_NAMES: Record<string, string> = {
  "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5": "NEO",
  "0xd2a4cff31913016155e38e474a2c06d08be276cf": "GAS",
};

type NeoTransfer = {
  txhash?: string;
  timestamp?: number;
  assethash?: string;
  transferaddress?: string | null;
  amount?: string | number;
  blockindex?: number;
  transfernotifyindex?: number;
};

type EtherscanTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  isError?: string;
};

type EtherscanTokenTx = {
  hash: string;
  timeStamp: string;
  from: string;
  to: string;
  value: string;
  tokenSymbol: string;
  tokenDecimal: string;
  contractAddress: string;
};

// Check if address is an Ethereum address (starts with 0x)
function isEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

async function rpcCall(method: string, params: unknown[], rpcUrl: string) {
  const body = {
    jsonrpc: "2.0",
    method,
    params,
    id: Date.now(),
  };
  const resp = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!resp.ok) {
    throw new Error(`rpc_http_${resp.status}`);
  }
  const json = (await resp.json()) as { result?: unknown; error?: unknown };
  if (json.error) {
    throw new Error(`rpc_error_${JSON.stringify(json.error)}`);
  }
  return json.result;
}

// Fetch Ethereum transaction activity using Etherscan API
async function fetchEthereumActivity(address: string) {
  const apiKey = process.env.ETHERSCAN_API_KEY ?? "";
  const baseUrl = "https://api.etherscan.io/api";
  const addressLower = address.toLowerCase();

  // Fetch ETH transactions
  const ethTxUrl = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${apiKey}`;
  const ethResp = await fetch(ethTxUrl, { cache: "no-store" });
  const ethData = (await ethResp.json()) as { status: string; result: EtherscanTx[] };

  // Fetch ERC-20 token transactions
  const tokenTxUrl = `${baseUrl}?module=account&action=tokentx&address=${address}&page=1&offset=50&sort=desc&apikey=${apiKey}`;
  const tokenResp = await fetch(tokenTxUrl, { cache: "no-store" });
  const tokenData = (await tokenResp.json()) as { status: string; result: EtherscanTokenTx[] };

  const activity: Array<{
    id: string;
    hash: string;
    type: string;
    tokenSymbol: string;
    amount: number;
    amountUSD: number;
    chain: string;
    timestamp: string;
  }> = [];

  // Process ETH transactions
  if (ethData.status === "1" && Array.isArray(ethData.result)) {
    for (const tx of ethData.result) {
      if (tx.isError === "1") continue; // Skip failed transactions

      const isReceive = tx.to.toLowerCase() === addressLower;
      const amount = Number(BigInt(tx.value)) / 1e18;

      if (amount > 0) {
        activity.push({
          id: `${tx.hash}-eth-${isReceive ? "receive" : "send"}`,
          hash: tx.hash,
          type: isReceive ? "receive" : "send",
          tokenSymbol: "ETH",
          amount,
          amountUSD: amount * 2000, // Rough ETH price estimate
          chain: "Ethereum",
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        });
      }
    }
  }

  // Process token transactions
  if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
    for (const tx of tokenData.result) {
      const isReceive = tx.to.toLowerCase() === addressLower;
      const decimals = parseInt(tx.tokenDecimal) || 18;
      const amount = Number(BigInt(tx.value)) / Math.pow(10, decimals);

      if (amount > 0) {
        activity.push({
          id: `${tx.hash}-${tx.contractAddress}-${isReceive ? "receive" : "send"}`,
          hash: tx.hash,
          type: isReceive ? "receive" : "send",
          tokenSymbol: tx.tokenSymbol,
          amount,
          amountUSD: amount, // Nominal value for tokens
          chain: "Ethereum",
          timestamp: new Date(parseInt(tx.timeStamp) * 1000).toISOString(),
        });
      }
    }
  }

  // Sort by timestamp descending and remove duplicates
  const seen = new Set<string>();
  return activity
    .filter((tx) => {
      if (seen.has(tx.id)) return false;
      seen.add(tx.id);
      return true;
    })
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

async function getNeoActivity(address: string) {
  const rpcUrl = process.env.NEO_RPC_URL ?? "http://seed3t5.neo.org:20332";
  // Neo RPC expects timestamps in milliseconds
  const now = Date.now();
  const start = now - 30 * 24 * 60 * 60 * 1000; // 30d window in ms

  const transfersResult = (await rpcCall(
    "getnep17transfers",
    [address, start, now],
    rpcUrl,
  )) as { sent?: NeoTransfer[]; received?: NeoTransfer[] };

  const normalize = (
    items: NeoTransfer[] | undefined,
    direction: "send" | "receive",
  ) =>
    (items ?? []).map((tx) => {
      const amtRaw =
        typeof tx.amount === "string"
          ? parseFloat(tx.amount)
          : tx.amount ?? 0;
      // Convert raw amount to display amount (NEO/GAS have 8 decimals)
      const displayAmount = amtRaw / 100_000_000;
      // Timestamp from Neo RPC is already in milliseconds
      const timestampMs = tx.timestamp ?? Date.now();
      // Create unique ID by combining txhash, direction, asset, and notify index
      const uniqueId = `${tx.txhash ?? "unknown"}-${direction}-${tx.assethash ?? ""}-${tx.transfernotifyindex ?? 0}`;
      return {
        id: uniqueId,
        hash: tx.txhash ?? "unknown",
        type: direction === "send" ? "send" : "receive",
        tokenSymbol: ASSET_NAMES[tx.assethash ?? ""] ?? tx.assethash ?? "NEP-17",
        amount: displayAmount,
        amountUSD: displayAmount, // nominal, no pricing
        chain: "Neo N3",
        timestamp: new Date(timestampMs).toISOString(),
      };
    });

  return [
    ...normalize(transfersResult.sent, "send"),
    ...normalize(transfersResult.received, "receive"),
  ].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

export async function GET(_request: Request, { params }: ParamsPromise) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);

  try {
    if (isEthereumAddress(decoded)) {
      // Ethereum address
      const activity = await fetchEthereumActivity(decoded);
      return NextResponse.json(activity);
    } else {
      // Neo N3 address
      const activity = await getNeoActivity(decoded);
      return NextResponse.json(activity);
    }
  } catch (err) {
    return NextResponse.json(
      {
        error: "live_activity_failed",
        detail: err instanceof Error ? err.message : "unknown_error",
      },
      { status: 502 },
    );
  }
}


