import { NextResponse } from "next/server";

import { mockWallets } from "~/lib/mockData";

export async function GET() {
  return NextResponse.json(mockWallets);
}



