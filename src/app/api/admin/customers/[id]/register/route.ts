import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { bearerFromAdminRequest, sendSmsUpstream } from '@/lib/broadcast-notify';
import { resolveCustomerLoginEmail } from '@/lib/customer-phone-login';
import { buildRecipient } from '@/lib/sms';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { generateTempPassword } from '@/lib/temp-password';

export const runtime = 'nodejs';

type RouteParams = { id: string };

async function getIdFromParams(params: Promise<RouteParams> | RouteParams): Promise<string | null> {
    const resolved = await Promise.resolve(params);
    const id = resolved?.id?.trim();
    return id && id.length > 0 ? id : null;
}

interface RegisterBody {
    password?: string;
}

/**
 * Promote a lead customer (user_id null) to a registered Auth account and SMS the temp password.
 * Keeps customer.id stable so bookings/notes stay attached.
 */
export async function POST(request: Request, context: { params: Promise<RouteParams> }) {
    const auth = await requireAdminPermission(request, 'customers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const admin = getSupabaseAdminFromRequest(request);
    try {
        const id = await getIdFromParams(context.params);
        if (!id) return NextResponse.json({ error: 'Invalid customer id' }, { status: 400 });

        const body = (await request.json().catch(() => ({}))) as RegisterBody;
        const password = (body.password ?? '').trim() || generateTempPassword();
        if (password.length < 6) {
            return NextResponse.json({ error: 'password must be at least 6 characters' }, { status: 400 });
        }

        const { data: customer, error: loadError } = await admin
            .from('customer')
            .select('id, user_id, first_name, last_name, email, phone, country_code')
            .eq('id', id)
            .maybeSingle();

        if (loadError) return NextResponse.json({ error: loadError.message }, { status: 500 });
        if (!customer) return NextResponse.json({ error: 'Customer not found' }, { status: 404 });

        const existingUserId =
            typeof customer.user_id === 'string' ? customer.user_id.trim() : '';
        if (existingUserId) {
            return NextResponse.json({ error: 'Customer is already registered' }, { status: 409 });
        }

        const firstName = (customer.first_name ?? '').trim();
        if (!firstName) {
            return NextResponse.json({ error: 'Customer first_name is required to register' }, { status: 400 });
        }

        const phoneRaw = (customer.phone ?? '').trim();
        if (!phoneRaw) {
            return NextResponse.json({ error: 'Customer phone is required to send login SMS' }, { status: 400 });
        }

        const countryCode = (customer.country_code ?? '+251').trim() || '+251';
        const providedEmail = (customer.email ?? '').trim().toLowerCase();
        const resolved = resolveCustomerLoginEmail(providedEmail, phoneRaw);
        if (!resolved) {
            return NextResponse.json({ error: 'Invalid Ethiopian phone number' }, { status: 400 });
        }
        const { localPhone, email } = resolved;

        const recipient = buildRecipient(localPhone, countryCode);
        if (!recipient) {
            return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
        }

        const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            phone: recipient.replace(/^\+/, ''),
            phone_confirm: true,
            user_metadata: {
                full_name: [firstName, customer.last_name].filter(Boolean).join(' '),
                role: 'customer',
            },
        });

        if (createUserError || !createdUser.user) {
            return NextResponse.json(
                { error: createUserError?.message || 'Failed to create auth user' },
                { status: 500 }
            );
        }

        const userId = createdUser.user.id;
        const { data: updated, error: updateError } = await admin
            .from('customer')
            .update({
                user_id: userId,
                email,
                phone: localPhone,
                country_code: countryCode,
                login_type: 'email',
            })
            .eq('id', id)
            .select(
                'id, user_id, first_name, last_name, email, phone, country_code, signup_source, address, admin_note, created_at'
            )
            .single();

        if (updateError || !updated) {
            await admin.auth.admin.deleteUser(userId);
            return NextResponse.json(
                { error: updateError?.message || 'Failed to attach auth user to customer' },
                { status: 500 }
            );
        }

        const smsMessage = `ሰላም ${firstName}! የ Zemen Service አገልግሎት ፈላጊ አካውንትዎ ተከፍቷል። በስልክ ቁጥርዎ እና በዚህ ጊዜያዊ የይለፍ ቃል ይግቡ፡ ${password}`;
        const bearer = await bearerFromAdminRequest(request);
        const smsResult = await sendSmsUpstream(recipient, smsMessage, bearer);

        await logAdminActivity({
            request,
            action: 'customers.register',
            resource_type: 'customer',
            resource_id: id,
            summary: `Registered lead customer ${firstName} (${localPhone}) and sent login SMS`,
            metadata: {
                user_id: userId,
                sms_sent: smsResult.ok,
                sms_error: smsResult.ok ? null : smsResult.error,
            },
        });

        return NextResponse.json({
            data: updated,
            temporaryPassword: password,
            sms: smsResult.ok
                ? { sent: true, recipient }
                : { sent: false, error: smsResult.error, recipient },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
