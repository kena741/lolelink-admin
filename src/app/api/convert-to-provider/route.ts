import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface CustomerRow {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    mobile_number?: string;
    phone?: string;
    country_code?: string;
    avatar?: string;
    address?: string;
    password?: string;
    provider_id?: string;
}

interface ConvertRequestBody {
    customerId: string;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as ConvertRequestBody;
        const { customerId } = body;

        if (!customerId) {
            return NextResponse.json(
                { error: 'customerId is required' },
                { status: 400 }
            );
        }

        const { data: customer, error: customerError } = await supabaseAdmin
            .from('customer')
            .select('*')
            .eq('id', customerId)
            .single();

        if (customerError || !customer) {
            return NextResponse.json(
                { error: customerError?.message || 'Customer not found' },
                { status: 404 }
            );
        }

        const c = customer as CustomerRow;

        const { data: existingProvider } = await supabaseAdmin
            .from('provider')
            .select('id')
            .eq('id', customerId)
            .maybeSingle();

        if (existingProvider) {
            return NextResponse.json(
                { error: 'This customer already has a provider account' },
                { status: 409 }
            );
        }

        const phoneNumber = c.mobile_number || c.phone || '';
        const slug = [c.first_name, c.last_name]
            .filter(Boolean)
            .join('-')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '');

        const providerRow = {
            id: c.id,
            user_id: c.id,
            firstName: c.first_name || '',
            lastName: c.last_name || '',
            email: c.email || '',
            phoneNumber,
            countryCode: c.country_code || '+251',
            address: c.address || '',
            profileImage: c.avatar || '',
            password: c.password || '',
            slug,
            userType: 'Provider',
            active: true,
            activation_paid: false,
            verified_subcategory_ids: [],
        };

        const { data: provider, error: insertError } = await supabaseAdmin
            .from('provider')
            .insert(providerRow)
            .select('*')
            .single();

        if (insertError) {
            return NextResponse.json(
                { error: insertError.message || 'Failed to create provider' },
                { status: 500 }
            );
        }

        await supabaseAdmin
            .from('customer')
            .update({ provider_id: c.id })
            .eq('id', customerId);

        return NextResponse.json({ data: provider });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
