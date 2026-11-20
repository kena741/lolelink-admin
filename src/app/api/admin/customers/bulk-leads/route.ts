import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import {
    normalizeLocalEthiopianPhone,
    phoneLoginEmail,
} from '@/lib/customer-phone-login';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface LeadBody {
    first_name?: string;
    last_name?: string | null;
    phone?: string;
    signup_source?: string | null;
    address?: string | null;
    admin_note?: string | null;
}

interface CreateBody {
    leads?: LeadBody[];
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'customers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const admin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as CreateBody;
        const leads = Array.isArray(body.leads) ? body.leads : [];
        if (leads.length === 0) {
            return NextResponse.json({ error: 'leads array is required' }, { status: 400 });
        }
        if (leads.length > 100) {
            return NextResponse.json({ error: 'At most 100 leads per request' }, { status: 400 });
        }

        const created: Record<string, unknown>[] = [];
        const failed: { index: number; phone?: string; error: string }[] = [];

        for (let index = 0; index < leads.length; index += 1) {
            const lead = leads[index];
            const firstName = (lead.first_name ?? '').trim();
            const lastName = (lead.last_name ?? '').trim() || null;
            const phoneRaw = (lead.phone ?? '').trim();
            const signupSource = (lead.signup_source ?? '').trim() || null;
            const address = (lead.address ?? '').trim() || null;
            const adminNote = (lead.admin_note ?? '').trim() || null;

            if (!firstName) {
                failed.push({ index, error: 'first_name is required' });
                continue;
            }
            if (!phoneRaw) {
                failed.push({ index, error: 'phone is required' });
                continue;
            }

            const localPhone = normalizeLocalEthiopianPhone(phoneRaw);
            if (!localPhone) {
                failed.push({ index, phone: phoneRaw, error: 'Invalid Ethiopian phone number' });
                continue;
            }

            const { data: existingByPhone } = await admin
                .from('customer')
                .select('id')
                .or(`phone.eq.${localPhone},phone.eq.0${localPhone}`)
                .maybeSingle();
            if (existingByPhone) {
                failed.push({
                    index,
                    phone: localPhone,
                    error: 'A customer with this phone already exists',
                });
                continue;
            }

            // No Auth/SMS — synthetic id, user_id null. Email is phone-derived for
            // uniqueness/schema only (lead is not registered until Auth exists).
            const email = phoneLoginEmail(localPhone);
            const { data: existingByEmail } = await admin
                .from('customer')
                .select('id')
                .ilike('email', email)
                .maybeSingle();
            if (existingByEmail) {
                failed.push({
                    index,
                    phone: localPhone,
                    error: 'A customer with this phone/email already exists',
                });
                continue;
            }

            const id = crypto.randomUUID();
            const { data: row, error } = await admin
                .from('customer')
                .insert({
                    id,
                    user_id: null,
                    first_name: firstName,
                    last_name: lastName,
                    email,
                    phone: localPhone,
                    country_code: '+251',
                    wallet_amount: 0,
                    signup_source: signupSource,
                    address,
                    admin_note: adminNote,
                })
                .select(
                    'id, user_id, first_name, last_name, email, phone, country_code, signup_source, address, admin_note, created_at'
                )
                .single();

            if (error || !row) {
                failed.push({
                    index,
                    phone: localPhone,
                    error: error?.message || 'Failed to create lead',
                });
                continue;
            }

            created.push(row as Record<string, unknown>);
        }

        if (created.length > 0) {
            await logAdminActivity({
                request,
                action: 'customers.bulk_leads_create',
                resource_type: 'customer',
                resource_id: created.map((row) => String(row.id)).join(',').slice(0, 200),
                summary: `Created ${created.length} lead customer(s)${failed.length ? ` (${failed.length} failed)` : ''}`,
                metadata: {
                    created_count: created.length,
                    failed_count: failed.length,
                    created_ids: created.map((row) => row.id),
                },
            });
        }

        return NextResponse.json({
            created,
            failed,
            ok: failed.length === 0,
        });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create leads' },
            { status: 500 }
        );
    }
}
