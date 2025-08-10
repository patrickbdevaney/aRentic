import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: Request) {
    try {
        const { listingId, txHash, amountUSD, email, walletAddress } = await request.json();

        if (!listingId || !txHash || !amountUSD || !walletAddress) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const { error } = await supabase.from("escrow_transactions").insert({
            listing_id: listingId,
            tx_hash: txHash,
            amount_usd: parseFloat(amountUSD),
            user_email: email || null,
            wallet_address: walletAddress,
            created_at: new Date().toISOString(),
        });

        if (error) {
            console.error("Supabase error:", error);
            return NextResponse.json({ error: "Failed to log transaction" }, { status: 500 });
        }

        return NextResponse.json({ success: true, txHash });
    } catch (error) {
        console.error("Escrow API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}