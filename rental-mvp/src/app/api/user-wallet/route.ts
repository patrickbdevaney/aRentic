// api/user-wallet/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(req: NextRequest) {
    try {
        const { email, walletAddress } = await req.json();
        if (!email || !walletAddress) {
            return NextResponse.json({ error: 'Email and wallet address are required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('users')
            .upsert(
                { email, wallet_address: walletAddress, created_at: new Date().toISOString() },
                { onConflict: 'email' }
            );

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error linking wallet:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const email = searchParams.get('email');
        if (!email) {
            return NextResponse.json({ error: 'Email is required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('users')
            .select('wallet_address')
            .eq('email', email)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ walletAddress: data.wallet_address });
    } catch (error) {
        console.error('Error fetching wallet address:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}