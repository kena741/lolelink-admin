import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { requireAdminSession } from '@/lib/admin-auth';
import { hasPermission } from '@/lib/admin-permissions';
import {
    loadChapaSecretKey,
    resolveChapaPaymentByReceiptRef,
    resolveChapaSettlementAmount,
} from '@/lib/chapa-config';
import {
    parseServicePostingTiers,
    resolveServicePostingTierByPrice,
} from '@/lib/service-posting-tiers';
import { readAuthUserId } from '@/lib/wallet-transaction-user';
import { walletTransactionProfileColumns } from '@/lib/wallet-transaction-profile';

export const runtime = 'nodejs';

const MIN_ACTIVATION_SETTLEMENT_ETB = 50;

interface ReconcileBody {
    providerId: string;
    receiptRef: string;
    confirm?: boolean;
}

function parseObjectValue(value: unknown): Record<string, unknown> {
    if (!value) return {};
    if (typeof value === 'string') {
        try {
            return (JSON.parse(value) as Record<string, unknown>) ?? {};
        } catch {
            return {};
        }
    }
    if (typeof value === 'object') return value as Record<string, unknown>;
    return {};
}

export async function POST(request: Request) {
    const auth = await requireAdminSession(request);
    if (!auth.ok) {
        return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const perms = auth.context.permissions;
    if (!(hasPermission(perms, 'providers:write') || hasPermission(perms, 'finance:write'))) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const admin = getSupabaseAdminFromRequest(request);

    try {
        const body = (await request.json()) as ReconcileBody;
        const providerId = String(body.providerId || '').trim();
        const receiptRef = String(body.receiptRef || '').trim();
        const confirm = body.confirm === true;

        if (!providerId) {
            return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
        }
        if (!receiptRef) {
            return NextResponse.json({ error: 'receiptRef is required' }, { status: 400 });
        }

        const { data: providerRaw, error: providerError } = await admin
            .from('provider')
            .select(
                'id, user_id, email, firstName, lastName, walletAmount, active, activation_paid, activation_paid_at, activation_tx_ref, service_tier_max'
            )
            .eq('id', providerId)
            .maybeSingle();

        if (providerError || !providerRaw) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const provider = providerRaw as {
            id: string;
            user_id?: string | null;
            email?: string | null;
            firstName?: string | null;
            lastName?: string | null;
            walletAmount?: string | number | null;
            active?: boolean | null;
            activation_paid?: boolean | null;
            activation_paid_at?: string | null;
            activation_tx_ref?: string | null;
            service_tier_max?: number | null;
        };

        const authUserId = readAuthUserId(provider.user_id);
        if (!authUserId) {
            return NextResponse.json({ error: 'Provider is not linked to an auth account' }, { status: 400 });
        }

        if (provider.activation_paid === true) {
            return NextResponse.json(
                {
                    error: 'Activation fee already paid',
                    activation_paid_at: provider.activation_paid_at,
                },
                { status: 409 }
            );
        }

        const secretKey = await loadChapaSecretKey(admin);
        if (!secretKey) {
            return NextResponse.json({ error: 'Missing Chapa secret key' }, { status: 500 });
        }

        const payment = await resolveChapaPaymentByReceiptRef(secretKey, receiptRef);
        if (!payment || !payment.tx_ref) {
            return NextResponse.json(
                { error: 'No successful Chapa payment found for that receipt / reference' },
                { status: 404 }
            );
        }

        const providerEmail = String(provider.email || '').trim().toLowerCase();
        const paymentEmail = String(payment.email || '').trim().toLowerCase();
        const emailMatches = Boolean(providerEmail && paymentEmail && providerEmail === paymentEmail);

        const { data: constantRow } = await admin
            .from('app_settings')
            .select('data')
            .eq('id', 'constant')
            .maybeSingle();
        const constants = parseObjectValue((constantRow as { data?: unknown } | null)?.data);
        const tiers = parseServicePostingTiers(constants.service_posting_tiers);
        const tier = resolveServicePostingTierByPrice(tiers, payment.amount);

        if (!tier) {
            return NextResponse.json(
                {
                    error: `Paid amount ETB ${payment.amount} does not match a configured activation tier`,
                    payment,
                },
                { status: 400 }
            );
        }

        const settlement = resolveChapaSettlementAmount({
            amount: payment.amount,
            charge: payment.charge,
        });
        const walletCredit =
            settlement != null && settlement >= MIN_ACTIVATION_SETTLEMENT_ETB
                ? settlement.toFixed(2)
                : Math.abs(payment.amount - 99) < 0.01
                  ? '96.52'
                  : payment.amount.toFixed(2);

        const preview = {
            provider_id: provider.id,
            provider_email: provider.email ?? null,
            email_matches: emailMatches,
            tier_amount: tier.total_price,
            service_tier_max: tier.max_services,
            wallet_credit: walletCredit,
            payment: {
                tx_ref: payment.tx_ref,
                reference: payment.reference,
                trans_id: payment.trans_id,
                amount: payment.amount,
                charge: payment.charge,
                email: payment.email,
                status: payment.status,
                created_at: payment.created_at,
                source: payment.source,
            },
        };

        if (!confirm) {
            return NextResponse.json({ status: 'preview', ...preview });
        }

        if (!emailMatches) {
            return NextResponse.json(
                {
                    error: 'Chapa payer email does not match this provider. Double-check the receipt before confirming.',
                    ...preview,
                },
                { status: 400 }
            );
        }

        const { data: existingWallet } = await admin
            .from('wallet_transaction')
            .select('id')
            .eq('transactionId', payment.tx_ref)
            .maybeSingle();

        if (existingWallet) {
            return NextResponse.json(
                { error: `Wallet transaction already exists for ${payment.tx_ref}`, wallet_id: existingWallet.id },
                { status: 409 }
            );
        }

        const paidAt = payment.created_at || new Date().toISOString();
        const nextWallet =
            Math.round((Number(provider.walletAmount ?? 0) + Number(walletCredit)) * 100) / 100;

        const { error: updateError } = await admin
            .from('provider')
            .update({
                activation_paid: true,
                activation_paid_at: paidAt,
                activation_tx_ref: payment.tx_ref,
                active: true,
                service_tier_max: tier.max_services,
                service_tier_tx_ref: payment.tx_ref,
                service_tier_paid_at: paidAt,
                walletAmount: nextWallet.toFixed(2),
            })
            .eq('id', provider.id);

        if (updateError) {
            return NextResponse.json({ error: `Failed to update provider: ${updateError.message}` }, { status: 500 });
        }

        const { error: walletError } = await admin.from('wallet_transaction').insert({
            amount: walletCredit,
            createdDate: paidAt,
            isCredit: true,
            note: `Activation payment top up (Chapa, net after fee) - admin reconcile ref ${payment.reference ?? payment.trans_id ?? receiptRef}`,
            paymentType: 'chapa',
            transactionId: payment.tx_ref,
            type: 'provider',
            ...walletTransactionProfileColumns({
                type: 'provider',
                authUserId,
                providerId: provider.id,
            }),
        });

        if (walletError) {
            return NextResponse.json({
                status: 'partial',
                message: `Provider activated but wallet transaction failed: ${walletError.message}`,
                provider_id: provider.id,
                wallet_error: walletError.message,
                ...preview,
            });
        }

        const { error: tierError } = await admin.from('service_tier_payment').insert({
            provider_id: provider.id,
            user_id: authUserId,
            from_tier_max: 0,
            to_tier_max: tier.max_services,
            amount: tier.total_price,
            tx_ref: payment.tx_ref,
            chapa_status: 'success',
            created_at: paidAt,
        });

        if (
            tierError &&
            !tierError.message.toLowerCase().includes('duplicate') &&
            tierError.code !== '23505'
        ) {
            console.error('service_tier_payment insert failed:', tierError.message);
        }

        const { data: existingNotif } = await admin
            .from('notification')
            .select('id')
            .eq('type', 'activation_payment_confirmed')
            .eq('provider_id', provider.id)
            .limit(1)
            .maybeSingle();

        if (!existingNotif) {
            await admin.from('notification').insert({
                title: 'Account Activated',
                description: `Your activation fee of ETB ${tier.total_price.toFixed(2)} has been confirmed. Your account is now active.`,
                type: 'activation_payment_confirmed',
                provider_id: provider.id,
                is_read: false,
            });
        }

        await logAdminActivity({
            request,
            action: 'activate',
            resource_type: 'provider_activation',
            resource_id: provider.id,
            summary: `Reconciled activation from receipt ${receiptRef}`,
            metadata: {
                receipt_ref: receiptRef,
                tx_ref: payment.tx_ref,
                chapa_reference: payment.reference,
                trans_id: payment.trans_id,
                fee_amount: walletCredit,
                tier_amount: tier.total_price,
                service_tier_max: tier.max_services,
                source: 'admin_reconcile',
            },
        });

        return NextResponse.json({
            status: 'success',
            walletAmount: nextWallet.toFixed(2),
            activation_paid_at: paidAt,
            ...preview,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected reconcile error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
