import { NextResponse } from 'next/server';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { getDisplayImageUrl } from '@/lib/media-url';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface CustomerRow {
    id: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    mobile_number?: string;
    phoneNumber?: string;
    phone?: string;
    country_code?: string;
    avatar?: string;
    address?: string;
    password?: string;
    wallet_amount?: number | null;
}

interface ConvertRequestBody {
    customerId: string;
}

export async function POST(request: Request) {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
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

        const phoneNumber = c.phoneNumber || c.mobile_number || c.phone || '';
        const slug = [c.first_name, c.last_name]
            .filter(Boolean)
            .join('-')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '');

        const walletAmount =
            typeof c.wallet_amount === 'number' && Number.isFinite(c.wallet_amount)
                ? c.wallet_amount.toFixed(2)
                : undefined;

        const providerRow = {
            id: c.id,
            user_id: c.id,
            firstName: c.first_name || '',
            lastName: c.last_name || '',
            email: c.email || '',
            phoneNumber,
            countryCode: c.country_code || '+251',
            address: c.address || '',
            profileImage: getDisplayImageUrl(c.avatar) || '',
            password: c.password || '',
            slug,
            userType: 'Provider',
            active: true,
            activation_paid: false,
            verified_subcategory_ids: [],
            ...(walletAmount !== undefined ? { walletAmount } : {}),
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

        const { error: walletRetagError } = await supabaseAdmin
            .from('wallet_transaction')
            .update({ type: 'provider' })
            .eq('userId', customerId)
            .eq('type', 'customer');

        if (walletRetagError) {
            await supabaseAdmin.from('provider').delete().eq('id', customerId);
            return NextResponse.json(
                { error: walletRetagError.message || 'Failed to migrate customer wallet transactions' },
                { status: 500 }
            );
        }

        const { error: deleteCustomerError } = await supabaseAdmin
            .from('customer')
            .delete()
            .eq('id', customerId);

        if (deleteCustomerError) {
            await supabaseAdmin.from('provider').delete().eq('id', customerId);
            return NextResponse.json(
                { error: deleteCustomerError.message || 'Failed to remove customer record; provider creation was rolled back.' },
                { status: 500 }
            );
        }

        const customerName = [c.first_name, c.last_name].filter(Boolean).join(' ').trim() || c.email || customerId;
        await logAdminActivity({
            request,
            action: 'update',
            resource_type: 'customer',
            resource_id: customerId,
            summary: `Converted customer ${customerName} to provider`,
            metadata: { provider_id: customerId },
        });

        return NextResponse.json({ data: provider });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
