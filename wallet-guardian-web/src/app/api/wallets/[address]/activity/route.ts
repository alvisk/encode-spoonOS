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

export async function GET(_request: Request, { params }: ParamsPromise) {
  const { address } = await params;
  const decoded = decodeURIComponent(address);

  const rpcUrl =
    process.env.NEO_RPC_URL ?? "http://seed3t5.neo.org:20332";
  // Neo RPC expects timestamps in milliseconds
  const now = Date.now();
  const start = now - 30 * 24 * 60 * 60 * 1000; // 30d window in ms

  try {
    const transfersResult = (await rpcCall(
      "getnep17transfers",
      [decoded, start, now],
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

    const activity = [
      ...normalize(transfersResult.sent, "send"),
      ...normalize(transfersResult.received, "receive"),
    ].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));

    return NextResponse.json(activity);
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


