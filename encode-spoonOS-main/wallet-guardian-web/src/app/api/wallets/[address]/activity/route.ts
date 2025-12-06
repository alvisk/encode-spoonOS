import { NextResponse } from "next/server";

import { mockActivityByAddress } from "~/lib/mockData";

type Params = { params: { address: string } };

export async function GET(_request: Request, { params }: Params) {
  const address = decodeURIComponent(params.address);
  const activity = mockActivityByAddress[address] ?? [];

  return NextResponse.json(activity);
}


