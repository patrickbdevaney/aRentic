import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get("address");

    if (!address) {
        return NextResponse.json(
            { error: "Address is required" },
            { status: 400 }
        );
    }

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_STREET_VIEW_API_KEY || "AIzaSyBSmCs6gwqu7SRT6U6WFy2QMwabupYg234";
    const encodedAddress = encodeURIComponent(address);
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${encodedAddress}&key=${apiKey}`;

    try {
        const response = await fetch(streetViewUrl);

        if (!response.ok) {
            return NextResponse.json(
                { error: "Failed to fetch Street View image" },
                { status: response.status }
            );
        }

        // Get the image as a buffer
        const imageBuffer = await response.arrayBuffer();

        // Set appropriate headers for image response
        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                "Content-Type": "image/jpeg",
                "Cache-Control": "public, max-age=31536000",
            },
        });
    } catch (error) {
        console.error("Street View API error:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}