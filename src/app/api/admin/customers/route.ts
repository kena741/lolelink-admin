import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { sendSmsUpstream } from '@/lib/broadcast-notify';
import { buildRecipient } from '@/lib/sms';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { generateTempPassword } from '@/lib/temp-password';

export const runtime = 'nodejs';

interface CreateCustomerBody {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    country_code?: string;
    password?: string;
}

export async function POST(request: Request) {
    const auth = await requireAdminPermission(request, 'customers:write');
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const admin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as CreateCustomerBody;
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

        const { data: existingCustomer } = await admin
            .from('customer')
            .select('id')
            .ilike('email', email)
            .maybeSingle();
        if (existingCustomer) {
            return NextResponse.json({ error: 'A customer with this email already exists' }, { status: 409 });
        }

        const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: [firstName, lastName].filter(Boolean).join(' '),
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
        const { data: customerRow, error: customerError } = await admin
            .from('customer')
            .insert({
                id: userId,
                user_id: userId,
                first_name: firstName,
                last_name: lastName || null,
                email,
                mobile_number: phone || null,
                phoneNumber: phone || null,
                country_code: countryCode,
                wallet_amount: 0,
                signup_source: 'admin',
            })
            .select('id, user_id, first_name, last_name, email, mobile_number, phoneNumber, country_code, created_at')
            .single();

        if (customerError || !customerRow) {
            await admin.auth.admin.deleteUser(userId);
            return NextResponse.json(
                { error: customerError?.message || 'Failed to create customer profile' },
                { status: 500 }
            );
        }

        const recipient = buildRecipient(phone, countryCode);
        const smsMessage = `ሰላም ${firstName}! የ Zemen Service አገልግሎት ፈላጊ አካውንትዎ ተከፍቷል። በስልክ ቁጥርዎ እና በዚህ ጊዜያዊ የይለፍ ቃል ይግቡ፡ ${password}`;
        const smsResult = recipient
            ? await sendSmsUpstream(recipient, smsMessage)
            : { ok: false as const, error: 'Invalid phone number' };

        await logAdminActivity({
            request,
            action: 'create',
            resource_type: 'customer',
            resource_id: customerRow.id,
            summary: `Created customer ${firstName} ${lastName} (${email}) from admin`,
            metadata: {
                signup_source: 'admin',
                sms_sent: smsResult.ok,
                sms_error: smsResult.ok ? null : smsResult.error,
            },
        });

        return NextResponse.json({
            data: customerRow,
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
