// api/escrow/route.ts (Updated to handle userAddress from signer)

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const { listingId, txHash, amountUSD, email } = await req.json();
        const walletAddress = process.env.NEXT_PUBLIC_ESCROW_ADDRESS;

        const { data, error } = await supabase
            .from('deposits')
            .insert([
                {
                    listing_id: listingId,
                    amount: amountUSD,
                    user_email: email,
                    tx_hash: txHash,
                    escrow_address: walletAddress,
                    created_at: new Date().toISOString(),
                    status: 'pending',
                },
            ]);

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error('Error recording deposit:', error);
        return NextResponse.json(
            { success: false, error: String(error) },
            { status: 500 }
        );
    }
}