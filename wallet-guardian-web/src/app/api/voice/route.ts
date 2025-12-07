import { type NextRequest, NextResponse } from "next/server";

// SpoonOS backend URL
const SPOONOS_API_URL = "https://encode-spoonos-production.up.railway.app";

type VoiceRequest = {
  type: "alert" | "summary" | "query";
  message: string;
  severity?: "info" | "warning" | "critical" | "emergency";
  address?: string;
  persona?: "professional" | "friendly" | "urgent" | "concise";
};

type VoiceStatusResponse = {
  enabled: boolean;
  api_configured: boolean;
  features: string[];
  subscription?: {
    tier: string;
    character_count: number;
    character_limit: number;
  };
  error?: string;
};

type VoiceAlertResponse = {
  success: boolean;
  audio_format: string;
  audio_data: string;
  message: string;
  severity: string;
};

/**
 * GET /api/voice - Check voice status
 */
export async function GET(): Promise<NextResponse<VoiceStatusResponse | { error: string }>> {
  try {
    const res = await fetch(`${SPOONOS_API_URL}/api/v2/voice/status`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Voice API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as VoiceStatusResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Voice status check failed:", error);
    return NextResponse.json(
      { error: "Failed to check voice status" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/voice - Generate voice audio
 * 
 * Body: {
 *   type: "alert" | "summary" | "query"
 *   message: string
 *   severity?: "info" | "warning" | "critical" | "emergency"
 *   address?: string
 *   persona?: "professional" | "friendly" | "urgent" | "concise"
 * }
 * 
 * Returns: {
 *   success: boolean
 *   audio_format: string
 *   audio_data: string (base64)
 *   message: string
 * }
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<VoiceAlertResponse | { error: string }>> {
  try {
    const body = (await request.json()) as VoiceRequest;
    const { type, message, severity = "info", address, persona = "professional" } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    let endpoint: string;
    let requestBody: Record<string, unknown>;

    switch (type) {
      case "alert":
        endpoint = `${SPOONOS_API_URL}/api/v2/voice/speak/alert`;
        requestBody = {
          message,
          severity,
          address,
        };
        break;

      case "summary":
        endpoint = `${SPOONOS_API_URL}/api/v2/voice/speak/summary`;
        requestBody = {
          address: address ?? "",
          include_balances: true,
          include_activity: true,
        };
        break;

      case "query":
        endpoint = `${SPOONOS_API_URL}/api/v2/voice/speak/query`;
        requestBody = {
          query: "",
          response: message,
          persona,
        };
        break;

      default:
        return NextResponse.json(
          { error: "Invalid voice type" },
          { status: 400 }
        );
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({})) as { detail?: string };
      return NextResponse.json(
        { error: errorData.detail ?? `Voice API error: ${res.status}` },
        { status: res.status }
      );
    }

    const data = (await res.json()) as VoiceAlertResponse;
    return NextResponse.json(data);
  } catch (error) {
    console.error("Voice generation failed:", error);
    return NextResponse.json(
      { error: "Failed to generate voice" },
      { status: 500 }
    );
  }
}
