import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");
    if (!address) return NextResponse.json({ error: "Address required" }, { status: 400 });
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_STREET_VIEW_API_KEY || "AIzaSyBSmCs6gwqu7SRT6U6WFy2QMwabupYg234";
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${encodeURIComponent(address)}&key=${apiKey}`;
    try {
        const response = await fetch(streetViewUrl);
        if (!response.ok) return NextResponse.json({ error: "Failed to fetch image" }, { status: response.status });
        const imageBuffer = await response.arrayBuffer();
        return new NextResponse(imageBuffer, {
            status: 200,
            headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000" },
        });
    } catch (error) {
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}