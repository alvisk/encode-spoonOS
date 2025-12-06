import { NextResponse } from "next/server";

type ParamsPromise = { params: Promise<{ address: string }> };

type NeoBalance = { amount: string | number; symbol?: string };

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

    try {
        const balancesResult = (await rpcCall(
            "getnep17balances",
            [decoded],
            rpcUrl,
        )) as { balance?: NeoBalance[] };

        const balances = balancesResult.balance ?? [];
        const totalAmount = balances.reduce((acc, b) => {
            const amt = typeof b.amount === "string" ? parseFloat(b.amount) : b.amount;
            return acc + (Number.isFinite(amt) ? amt : 0);
        }, 0);

        // Simple heuristic: lower balance => higher perceived risk score.
        const riskScore = Math.max(5, Math.min(95, 95 - Math.log10(totalAmount + 1) * 15));

        const response = {
            address: decoded,
            label: "NeoLine wallet",
            balanceUSD: totalAmount, // no pricing; treat as nominal
            riskScore: Math.round(riskScore),
            chains: ["Neo N3"],
            lastActive: new Date().toISOString(),
            tags: ["live-scan"],
            balances,
            mock: false,
        };

        return NextResponse.json(response);
    } catch (err) {
        return NextResponse.json(
            {
                error: "live_scan_failed",
                detail: err instanceof Error ? err.message : "unknown_error",
            },
            { status: 502 },
        );
    }
}


