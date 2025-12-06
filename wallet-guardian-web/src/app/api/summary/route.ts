import { NextResponse } from "next/server";

import { mockSummary } from "~/lib/mockData";

export async function GET() {
  return NextResponse.json(mockSummary);
}


