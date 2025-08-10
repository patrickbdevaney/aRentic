import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const city = searchParams.get('city');
    const state = searchParams.get('state');
    const neighborhood = searchParams.get('neighborhood') || '';
    const bedrooms = searchParams.get('bedsMin') || '0';
    const bathrooms = searchParams.get('bathrooms') || '';
    const minPrice = searchParams.get('minPrice') || '';
    const maxPrice = searchParams.get('maxPrice') || '';
    const homeType = searchParams.get('home_type') || 'Apartment';

    console.log('API Route Hit: /api/rentcast', req.url, { city, state, neighborhood, bedrooms, bathrooms, minPrice, maxPrice, homeType });

    if (!city || !state) {
        console.error('Missing city or state parameter');
        return NextResponse.json({ error: 'Missing required parameters: city and state' }, { status: 400 });
    }

    if (!process.env.RENTCAST_API_KEY) {
        console.error('Missing RENTCAST_API_KEY');
        return NextResponse.json({ error: 'Server configuration error: RentCast API key is not configured.' }, { status: 500 });
    }

    const params = new URLSearchParams({
        city: city.trim(),
        state: state.trim(),
        ...(neighborhood && { neighborhood: neighborhood.trim() }),
        bedrooms: bedrooms,
        ...(bathrooms && { bathrooms: bathrooms }),
        propertyType: homeType,
        status: 'Active',
        limit: '200',
    });

    const url = `https://api.rentcast.io/v1/listings/rental/long-term?${params}`;
    console.log('RentCast API Request URL:', url);

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'X-Api-Key': process.env.RENTCAST_API_KEY,
                'Accept': 'application/json',
            },
        });

        console.log('RentCast API Response Status:', response.status, response.statusText);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('RentCast API Error:', errorText);
            return NextResponse.json({ error: `RentCast API error: ${response.status} - ${errorText}` }, { status: response.status });
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            console.error('Invalid RentCast API response: Expected JSON, received:', contentType);
            return NextResponse.json({ error: 'Invalid response from RentCast API: Expected JSON.' }, { status: 500 });
        }

        const data = await response.json();
        let listings = data.map((prop: any) => ({
            id: prop.id || 'unknown-id',
            address: prop.formattedAddress || 'Unknown Address',
            price: prop.price || 0,
            bedrooms: prop.bedrooms || 0,
            bathrooms: prop.bathrooms || 0,
            propertyType: prop.propertyType || homeType,
            description: prop.description || 'No description available.',
            livingArea: prop.squareFootage || 0,
            detailUrl: prop.listingAgent?.website || '#',
            agent: {
                name: prop.listingAgent?.name || 'Unknown Agent',
                email: prop.listingAgent?.email || '',
                phone: prop.listingAgent?.phone || '',
            },
        }));

        // Filter for listings with agent email and sort by priority
        listings = listings
            .filter((prop: any) => prop.agent.email && prop.agent.email.trim() !== '')
            .sort((a: any, b: any) => {
                const aHasAll = a.agent.name && a.agent.email && a.agent.phone && a.detailUrl !== '#';
                const bHasAll = b.agent.name && b.agent.email && b.agent.phone && b.detailUrl !== '#';
                if (aHasAll && !bHasAll) return -1;
                if (!aHasAll && bHasAll) return 1;
                const aHasPhone = a.agent.name && a.agent.email && a.agent.phone;
                const bHasPhone = b.agent.name && b.agent.email && b.agent.phone;
                if (aHasPhone && !bHasPhone) return -1;
                if (!aHasPhone && bHasPhone) return 1;
                return 0; // Both have name and email, maintain order
            });

        // Additional filtering by price range
        if (minPrice) {
            listings = listings.filter((prop: any) => prop.price >= parseFloat(minPrice));
        }
        if (maxPrice) {
            listings = listings.filter((prop: any) => prop.price <= parseFloat(maxPrice));
        }

        // Additional filtering by neighborhood (case-insensitive)
        if (neighborhood) {
            listings = listings.filter((prop: any) =>
                prop.address.toLowerCase().includes(neighborhood.toLowerCase())
            );
        }

        // Log final filtered listings
        console.log('Filtered RentCast Listings:', listings);

        if (listings.length === 0) {
            console.warn('No listings found after filtering');
            return NextResponse.json({ props: [] });
        }

        return NextResponse.json({ props: listings });
    } catch (error) {
        console.error('RentCast API Proxy Error:', error);
        return NextResponse.json({ error: 'Failed to fetch data from RentCast API. Please try again later.' }, { status: 500 });
    }
}