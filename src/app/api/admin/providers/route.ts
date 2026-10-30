import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { sendSmsUpstream } from '@/lib/broadcast-notify';
import { buildRecipient } from '@/lib/sms';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { generateTempPassword } from '@/lib/temp-password';

export const runtime = 'nodejs';

interface CreateProviderBody {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    country_code?: string;
    password?: string;
}

function buildSlug(firstName: string, lastName: string, userId: string): string {
    const raw = [firstName, lastName]
        .filter(Boolean)
        .join('-')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');
    return raw || `provider-${userId.slice(0, 8)}`;
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'providers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const admin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as CreateProviderBody;
        const firstName = (body.first_name ?? '').trim();
        const lastName = (body.last_name ?? '').trim();
        const email = (body.email ?? '').trim().toLowerCase();
        const phone = (body.phone ?? '').trim();
        const countryCode = (body.country_code ?? '+251').trim() || '+251';
        const password = (body.password ?? '').trim() || generateTempPassword();

        if (!firstName) return NextResponse.json({ error: 'first_name is required' }, { status: 400 });
        if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 });
        if (!phone) return NextResponse.json({ error: 'phone is required to send login SMS' }, { status: 400 });
        if (password.length < 6) {
            return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
        }

        const { data: existingProvider } = await admin
            .from('provider')
            .select('id')
            .ilike('email', email)
            .maybeSingle();
        if (existingProvider) {
            return NextResponse.json({ error: 'A provider with this email already exists' }, { status: 409 });
        }

        const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: [firstName, lastName].filter(Boolean).join(' '),
                role: 'provider',
            },
        });

        if (createUserError || !createdUser.user) {
            return NextResponse.json(
                { error: createUserError?.message || 'Failed to create auth user' },
                { status: 500 }
            );
        }

        const userId = createdUser.user.id;
        const baseSlug = buildSlug(firstName, lastName, userId);
        let providerRow: Record<string, unknown> | null = null;
        let lastError: string | null = null;

        for (let attempt = 0; attempt < 25; attempt += 1) {
            const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`;
            const { data, error } = await admin
                .from('provider')
                .insert({
                    id: userId,
                    user_id: userId,
                    firstName,
                    lastName: lastName || '',
                    email,
                    phoneNumber: phone || '',
                    countryCode,
                    slug,
                    userType: 'Provider',
                    active: true,
                    activation_paid: false,
                    service_tier_max: 0,
                    walletAmount: '0',
                    verified_subcategory_ids: [],
                    signupSource: 'admin',
                })
                .select(
                    'id, user_id, firstName, lastName, email, phoneNumber, countryCode, slug, active, activation_paid, service_tier_max, createdAt'
                )
                .single();

            if (!error && data) {
                providerRow = data as Record<string, unknown>;
                break;
            }

            const isSlugConflict =
                error?.code === '23505' &&
                (error.message.toLowerCase().includes('slug') ||
                    error.message.toLowerCase().includes('provider_slug'));
            if (!isSlugConflict) {
                lastError = error?.message || 'Failed to create provider profile';
                break;
            }
            lastError = error?.message || null;
        }

        if (!providerRow) {
            await admin.auth.admin.deleteUser(userId);
            return NextResponse.json(
                { error: lastError || 'Failed to create provider profile' },
                { status: 500 }
            );
        }

        const recipient = buildRecipient(phone, countryCode);
        const smsMessage = `ሰላም ${firstName}! የዘመን ፕሮቫይደር አካውንትዎ ተከፍቷል። በስልክ ቁጥርዎ እና በዚህ ጊዜያዊ የይለፍ ቃል ይግቡ፡ ${password}`;
        const smsResult = recipient
            ? await sendSmsUpstream(recipient, smsMessage)
            : { ok: false as const, error: 'Invalid phone number' };

        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'provider',
            resource_id: String(providerRow.id),
            summary: `Created provider ${firstName} ${lastName} (${email}) from admin`,
            metadata: {
                signup_source: 'admin',
                sms_sent: smsResult.ok,
                sms_error: smsResult.ok ? null : smsResult.error,
            },
        });

        return NextResponse.json({
            data: providerRow,
            temporaryPassword: password,
            sms: smsResult.ok
                ? { sent: true, recipient }
                : { sent: false, error: smsResult.error, recipient: recipient || null },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
