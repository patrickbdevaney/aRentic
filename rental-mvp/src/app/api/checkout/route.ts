import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const { amount, walletAddress } = await req.json();
        if (!amount || !walletAddress) {
            return NextResponse.json({ error: "Amount and walletAddress are required" }, { status: 400 });
        }

        const res = await fetch("https://api.commerce.coinbase.com/checkouts", {
            method: "POST",
            headers: {
                "X-CC-Api-Key": process.env.COINBASE_COMMERCE_API_KEY!,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                name: "Brokerage Fee Deposit",
                description: "Deposit USDC for rental escrow",
                pricing_type: "fixed_price",
                local_price: { amount, currency: "USD" },
                requested_info: ["email"],
                metadata: { walletAddress },
                cryptocurrency: "USDC", // Specify USDC as target
                redirect_url: `${process.env.NEXT_PUBLIC_BASE_URL}/funding-success`,
                cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/funding-cancel`,
            }),
        });

        if (!res.ok) {
            const errorData = await res.json();
            return NextResponse.json({ error: `Failed to create checkout: ${errorData.error?.message || "Unknown error"}` }, { status: res.status });
        }

        const { hosted_url } = await res.json();
        return NextResponse.json({ hostedUrl: hosted_url });
    } catch (error) {
        console.error("Checkout error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}