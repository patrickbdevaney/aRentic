import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function POST(req: NextRequest) {
    try {
        const { listingId, txHash, amountUSD, email, walletAddress, signature } = await req.json();
        if (!listingId || !txHash || !amountUSD || !email || !walletAddress || !signature) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Verify signature
        const message = `Deposit ${amountUSD} USDC for listing ${listingId} from ${walletAddress}`;
        const recoveredAddress = ethers.verifyMessage(message, signature);
        if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
            return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }

        // Verify transaction
        const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC_URL || "https://mainnet.base.org");
        const receipt = await provider.getTransactionReceipt(txHash);
        if (!receipt || receipt.status !== 1) {
            return NextResponse.json({ error: "Transaction not confirmed or failed" }, { status: 400 });
        }

        // Upsert user
        const { error: userError } = await supabase
            .from("users")
            .upsert({ email, wallet_address: walletAddress, created_at: new Date().toISOString() }, { onConflict: "email" });

        if (userError) throw userError;

        // Insert deposit
        const { data, error } = await supabase
            .from("deposits")
            .insert([
                {
                    listing_id: listingId,
                    amount: amountUSD,
                    user_email: email,
                    wallet_address: walletAddress,
                    tx_hash: txHash,
                    escrow_address: process.env.NEXT_PUBLIC_ESCROW_ADDRESS,
                    created_at: new Date().toISOString(),
                    status: "confirmed",
                },
            ]);

        if (error) throw error;

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Error recording deposit:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}