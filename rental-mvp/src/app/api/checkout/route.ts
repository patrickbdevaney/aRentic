// api/checkout/route.ts (Optional for alternative onramp, but kept as is)

import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    const { amount, walletAddress } = await req.json();
    const res = await fetch('https://api.commerce.coinbase.com/checkouts', {
        method: 'POST',
        headers: { 'X-CC-Api-Key': process.env.COINBASE_COMMERCE_API_KEY!, 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: 'Brokerage Fee Deposit',
            description: 'Deposit for rental escrow',
            pricing_type: 'fixed_price',
            local_price: { amount, currency: 'USD' },
            requested_info: ['email'],
            metadata: { walletAddress },
        }),
    });
    if (!res.ok) return NextResponse.json({ error: 'Failed to create checkout' }, { status: 500 });
    const { hosted_url } = await res.json();
    return NextResponse.json({ hostedUrl: hosted_url });
}