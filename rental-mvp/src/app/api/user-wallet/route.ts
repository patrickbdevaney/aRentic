import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    const { data, error } = await supabase.from("users").select("wallet_address").eq("email", email).single();
    if (error || !data) return NextResponse.json({ error: "User not found" }, { status: 404 });
    return NextResponse.json({ walletAddress: data.wallet_address });
}

export async function POST(req: NextRequest) {
    const { email, walletAddress, signature } = await req.json();
    if (!email || !walletAddress || !signature) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    const message = `Link wallet ${walletAddress} to ${email}`;
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    const { error } = await supabase
        .from("users")
        .upsert({ email, wallet_address: walletAddress, created_at: new Date().toISOString() }, { onConflict: "email" });
    if (error) return NextResponse.json({ error: String(error) }, { status: 500 });
    return NextResponse.json({ success: true });
}