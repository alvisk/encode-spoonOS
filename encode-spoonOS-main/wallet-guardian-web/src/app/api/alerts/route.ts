import { NextResponse } from "next/server";

import { mockAlerts } from "~/lib/mockData";

export async function GET() {
  return NextResponse.json(mockAlerts);
}


