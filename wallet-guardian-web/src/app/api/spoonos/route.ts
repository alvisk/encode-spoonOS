import { NextRequest, NextResponse } from "next/server";

const SPOONOS_API_URL = "https://encode-spoonos-production.up.railway.app";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
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

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("[spoonos proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to connect to SpoonOS API" },
      { status: 502 }
    );
  }
}
