import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { clearCustomerDeleteBlockers } from '@/lib/customer-delete-cleanup';
import { getDisplayImageUrl } from '@/lib/media-url';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { readAuthUserId } from '@/lib/wallet-transaction-user';

export const runtime = 'nodejs';

interface CustomerRow {
    id: string;
    user_id?: string | null;
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
    const auth = await requireAdminPermission(request, 'customers:write');
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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

        const customerAuthUserId = readAuthUserId(c.user_id);
        if (!customerAuthUserId) {
            return NextResponse.json(
                { error: 'Customer is not linked to an auth account and cannot be converted' },
                { status: 400 }
            );
        }

        const phoneNumber = c.phoneNumber || c.mobile_number || c.phone || '';
        const rawSlug = [c.first_name, c.last_name]
            .filter(Boolean)
            .join('-')
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-+|-+$/g, '');
        const baseSlug = rawSlug || `provider-${customerId.toLowerCase().slice(0, 8)}`;

        const walletAmount =
            typeof c.wallet_amount === 'number' && Number.isFinite(c.wallet_amount)
                ? c.wallet_amount.toFixed(2)
                : undefined;

        let provider: Record<string, unknown> | null = null;

        for (let attempt = 0; attempt < 25; attempt += 1) {
            const slugCandidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
            const providerRow = {
                id: c.id,
                user_id: customerAuthUserId,
                firstName: c.first_name || '',
                lastName: c.last_name || '',
                email: c.email || '',
                phoneNumber,
                countryCode: c.country_code || '+251',
                address: c.address || '',
                profileImage: getDisplayImageUrl(c.avatar) || '',
                password: c.password || '',
                slug: slugCandidate,
                userType: 'Provider',
                active: true,
                activation_paid: false,
                verified_subcategory_ids: [],
                ...(walletAmount !== undefined ? { walletAmount } : {}),
            };

            const { data: insertedProvider, error: insertError } = await supabaseAdmin
                .from('provider')
                .insert(providerRow)
                .select('*')
                .single();

            if (!insertError && insertedProvider) {
                provider = insertedProvider as Record<string, unknown>;
                break;
            }

            const isSlugConflict =
                insertError?.code === '23505' &&
                insertError.message.toLowerCase().includes('provider_slug_unique_idx');
            if (!isSlugConflict) {
                return NextResponse.json(
                    { error: insertError?.message || 'Failed to create provider' },
                    { status: 500 }
                );
            }
        }

        if (!provider) {
            return NextResponse.json(
                { error: 'Could not generate a unique provider slug for this customer' },
                { status: 409 }
            );
        }

        const walletUserIds = Array.from(new Set([customerAuthUserId, customerId]));
        const { error: walletRetagError } = await supabaseAdmin
            .from('wallet_transaction')
            .update({ type: 'provider', userId: customerAuthUserId })
            .in('userId', walletUserIds)
            .eq('type', 'customer');

        if (walletRetagError) {
            await supabaseAdmin.from('provider').delete().eq('id', customerId);
            return NextResponse.json(
                { error: walletRetagError.message || 'Failed to migrate customer wallet transactions' },
                { status: 500 }
            );
        }

        const cleanup = await clearCustomerDeleteBlockers(supabaseAdmin, customerId);
        if (!cleanup.ok) {
            await supabaseAdmin.from('provider').delete().eq('id', customerId);
            return NextResponse.json({ error: cleanup.error }, { status: 500 });
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
