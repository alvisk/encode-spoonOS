import { NextResponse } from "next/server";

import { mockWallets } from "~/lib/mockData";

type Params = { params: { address: string } };

export async function GET(_request: Request, { params }: Params) {
  const address = decodeURIComponent(params.address);
  const wallet = mockWallets.find((w) => w.address === address);

  if (!wallet) {
    return NextResponse.json(
      { error: `Wallet ${address} not found` },
      { status: 404 },
    );
  }

  return NextResponse.json(wallet);
}


