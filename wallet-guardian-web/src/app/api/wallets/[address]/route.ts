import { NextResponse } from "next/server";

type ParamsPromise = { params: Promise<{ address: string }> };

type NeoBalance = { amount: string | number; symbol?: string };

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

// Fetch Ethereum wallet balance using Etherscan API
async function fetchEthereumBalance(address: string) {
    const apiKey = process.env.ETHERSCAN_API_KEY ?? "";
    const baseUrl = "https://api.etherscan.io/api";

    // Fetch ETH balance
    const ethBalanceUrl = `${baseUrl}?module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`;
    const ethResp = await fetch(ethBalanceUrl, { cache: "no-store" });
    const ethData = (await ethResp.json()) as { status: string; result: string };

    const ethBalanceWei = ethData.status === "1" ? BigInt(ethData.result) : BigInt(0);
    const ethBalance = Number(ethBalanceWei) / 1e18;

    // Fetch token balances using tokentx (get unique tokens from recent transfers)
    const tokenTxUrl = `${baseUrl}?module=account&action=tokentx&address=${address}&page=1&offset=100&sort=desc&apikey=${apiKey}`;
    const tokenResp = await fetch(tokenTxUrl, { cache: "no-store" });
    const tokenData = (await tokenResp.json()) as {
        status: string;
        result: Array<{
            contractAddress: string;
            tokenSymbol: string;
            tokenDecimal: string;
        }>;
    };

    // Get unique token contracts
    const uniqueTokens = new Map<string, { symbol: string; decimals: number }>();
    if (tokenData.status === "1" && Array.isArray(tokenData.result)) {
        for (const tx of tokenData.result) {
            if (!uniqueTokens.has(tx.contractAddress)) {
                uniqueTokens.set(tx.contractAddress, {
                    symbol: tx.tokenSymbol,
                    decimals: parseInt(tx.tokenDecimal) || 18,
                });
            }
        }
    }

    // Fetch balance for each token
    const tokenBalances: Array<{ symbol: string; amount: number; contract: string }> = [];
    for (const [contract, info] of uniqueTokens) {
        const balanceUrl = `${baseUrl}?module=account&action=tokenbalance&contractaddress=${contract}&address=${address}&tag=latest&apikey=${apiKey}`;
        const balResp = await fetch(balanceUrl, { cache: "no-store" });
        const balData = (await balResp.json()) as { status: string; result: string };

        if (balData.status === "1" && balData.result !== "0") {
            const rawBalance = BigInt(balData.result);
            const balance = Number(rawBalance) / Math.pow(10, info.decimals);
            if (balance > 0) {
                tokenBalances.push({
                    symbol: info.symbol,
                    amount: balance,
                    contract,
                });
            }
        }
    }

    return {
        ethBalance,
        tokenBalances,
    };
}

async function getNeoBalance(address: string) {
    const rpcUrl = process.env.NEO_RPC_URL ?? "http://seed3t5.neo.org:20332";

    const balancesResult = (await rpcCall(
        "getnep17balances",
        [address],
        rpcUrl,
    )) as { balance?: NeoBalance[] };

    const balances = balancesResult.balance ?? [];
    const totalAmount = balances.reduce((acc, b) => {
        const amt = typeof b.amount === "string" ? parseFloat(b.amount) : b.amount;
        return acc + (Number.isFinite(amt) ? amt : 0);
    }, 0);

    return { balances, totalAmount };
}

export async function GET(_request: Request, { params }: ParamsPromise) {
    const { address } = await params;
    const decoded = decodeURIComponent(address);

    try {
        if (isEthereumAddress(decoded)) {
            // Ethereum address
            const { ethBalance, tokenBalances } = await fetchEthereumBalance(decoded);

            // Estimate total USD value (ETH price ~$2000 for estimation, tokens at face value)
            const ethPrice = 2000; // Rough ETH price estimate
            const totalUSD = ethBalance * ethPrice + tokenBalances.reduce((acc, t) => acc + t.amount, 0);

            // Simple heuristic: lower balance => higher perceived risk score.
            const riskScore = Math.max(5, Math.min(95, 95 - Math.log10(totalUSD + 1) * 15));

            const balances = [
                { symbol: "ETH", amount: ethBalance },
                ...tokenBalances.map((t) => ({ symbol: t.symbol, amount: t.amount })),
            ].filter((b) => b.amount > 0);

            const response = {
                address: decoded,
                label: "Ethereum wallet",
                balanceUSD: totalUSD,
                riskScore: Math.round(riskScore),
                chains: ["Ethereum"],
                lastActive: new Date().toISOString(),
                tags: ["live-scan"],
                balances,
                mock: false,
            };

            return NextResponse.json(response);
        } else {
            // Neo N3 address
            const { balances, totalAmount } = await getNeoBalance(decoded);

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
        }
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


