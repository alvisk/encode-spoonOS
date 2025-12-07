import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SPOONOS_API_URL = "https://encode-spoonos-production.up.railway.app";

export async function POST(request: NextRequest) {
  try {
    const parsedBody: unknown = await request.json().catch(() => null);
    const body =
      parsedBody && typeof parsedBody === "object" ? parsedBody : {};
    const paymentHeader = request.headers.get("X-PAYMENT") ?? "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (paymentHeader) {
      headers["X-PAYMENT"] = paymentHeader;
    }

    const response = await fetch(
      `${SPOONOS_API_URL}/x402/invoke/wallet-guardian`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }
    );

    const data: unknown = await response.json().catch(() => null);

    return NextResponse.json(data ?? { error: "Invalid response" }, { status: response.status });
  } catch (error) {
    console.error("[spoonos proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to SpoonOS API" },
      { status: 502 }
    );
  }
}
