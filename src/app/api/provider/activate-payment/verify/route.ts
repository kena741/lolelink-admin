import { NextResponse } from 'next/server';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { findPriorCustomerWalletTopUp } from '@/lib/wallet-transaction-activation';
import { resolveChapaSettlementAmount } from '@/lib/chapa-config';
import { readAuthUserId } from '@/lib/wallet-transaction-user';
import { walletTransactionProfileColumns } from '@/lib/wallet-transaction-profile';

const MIN_ACTIVATION_SETTLEMENT_ETB = 50;

export const runtime = 'nodejs';

interface VerifyBody {
    providerId: string;
}

interface ChapaConfig {
    enable?: boolean;
    isActive?: boolean | number;
    secretKey?: string;
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

function resolveChapaConfig(settingsData: unknown): ChapaConfig {
    const root = parseObjectValue(settingsData);
    const maybeChapa = root.chapa;
    if (!maybeChapa || typeof maybeChapa !== 'object') return {};
    return maybeChapa as ChapaConfig;
}

export async function POST(request: Request) {
        const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const body = (await request.json()) as VerifyBody;

        if (!body.providerId) {
            return NextResponse.json({ error: 'providerId is required' }, { status: 400 });
        }

        const { data: providerRaw } = await supabaseAdmin
            .from('provider')
            .select('*')
            .eq('id', body.providerId)
            .single();

        if (!providerRaw) {
            return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
        }

        const provider = providerRaw as Record<string, unknown>;
        const txRef = (provider.activation_tx_ref as string) || '';

        if (!txRef) {
            return NextResponse.json({ error: 'No activation payment has been initiated for this provider' }, { status: 400 });
        }

        const { data: existingWalletTx } = await supabaseAdmin
            .from('wallet_transaction')
            .select('id')
            .eq('transactionId', txRef)
            .maybeSingle();

        if (provider.activation_paid && existingWalletTx) {
            return NextResponse.json({
                status: 'success',
                already_paid: true,
                provider_id: body.providerId,
                activation_paid_at: provider.activation_paid_at,
            });
        }

        const { data: paymentRow } = await supabaseAdmin
            .from('app_settings')
            .select('id, data')
            .eq('id', 'payment')
            .maybeSingle();

        const chapaConfig = resolveChapaConfig((paymentRow as { data: unknown } | null)?.data);
        const chapaSecretKey = (chapaConfig.secretKey || process.env.CHAPA_SECRET_KEY || '').trim();

        if (!chapaSecretKey) {
            return NextResponse.json({ error: 'Missing Chapa secret key' }, { status: 500 });
        }

        const verifyResponse = await fetch(`https://api.chapa.co/v1/transaction/verify/${txRef}`, {
            method: 'GET',
            headers: { Authorization: `Bearer ${chapaSecretKey}` },
        });

        const verifyData = (await verifyResponse.json()) as {
            status?: string;
            message?: string;
            data?: {
                status?: string;
                amount?: number;
                charge?: number;
                currency?: string;
                tx_ref?: string;
                reference?: string;
                first_name?: string;
                last_name?: string;
            };
        };

        if (!verifyResponse.ok) {
            return NextResponse.json({
                error: verifyData.message || 'Failed to verify with Chapa',
                details: verifyData,
            }, { status: 400 });
        }

        const txStatus = (verifyData.data?.status || '').toLowerCase();
        const isSuccess = ['success', 'successful', 'completed', 'paid'].includes(txStatus);

        if (!isSuccess) {
            return NextResponse.json({
                status: 'pending',
                chapa_status: txStatus || 'unknown',
                message: `Payment not yet confirmed. Chapa status: ${txStatus || 'unknown'}`,
                provider_id: body.providerId,
            });
        }

        const now = new Date().toISOString();

        if (!provider.activation_paid) {
            const { error: updateError } = await supabaseAdmin
                .from('provider')
                .update({
                    activation_paid: true,
                    activation_paid_at: now,
                })
                .eq('id', body.providerId);

            if (updateError) {
                return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 });
            }
        }

        const { data: constantRow } = await supabaseAdmin
            .from('app_settings')
            .select('id, data')
            .eq('id', 'constant')
            .maybeSingle();

        const constants = parseObjectValue((constantRow as { data: unknown } | null)?.data);
        const configuredFeeRaw = typeof constants.provider_activation_account_activation_fee_amount === 'string'
            ? constants.provider_activation_account_activation_fee_amount
            : verifyData.data?.amount?.toString() || '0';
        const settlementAmount = resolveChapaSettlementAmount(verifyData.data ?? {});
        const feeAmount = settlementAmount != null && settlementAmount >= MIN_ACTIVATION_SETTLEMENT_ETB
            ? settlementAmount.toFixed(2)
            : configuredFeeRaw;

        const providerAuthUserId = readAuthUserId(provider.user_id);
        if (!providerAuthUserId) {
            return NextResponse.json({ error: 'Provider is not linked to an auth account' }, { status: 400 });
        }

        let walletSkipped = Boolean(existingWalletTx);
        let walletSkippedReason: string | null = existingWalletTx ? 'existing_wallet_transaction' : null;

        if (!existingWalletTx) {
            const priorTopUp = await findPriorCustomerWalletTopUp(supabaseAdmin, providerAuthUserId);

            if (priorTopUp) {
                walletSkipped = true;
                walletSkippedReason = 'prior_customer_top_up';
                await supabaseAdmin
                    .from('provider')
                    .update({ activation_tx_ref: priorTopUp.transactionId })
                    .eq('id', body.providerId);
            } else {
                const { error: walletError } = await supabaseAdmin.from('wallet_transaction').insert({
                    amount: feeAmount,
                    createdDate: now,
                    isCredit: true,
                    note: 'Activation payment top up (Chapa, net after fee)',
                    paymentType: 'chapa',
                    transactionId: txRef,
                    type: 'provider',
                    ...walletTransactionProfileColumns({
                        type: 'provider',
                        authUserId: providerAuthUserId,
                        providerId: body.providerId,
                    }),
                });

                if (walletError) {
                    return NextResponse.json({
                        status: 'partial',
                        message: `Provider activated but wallet transaction failed: ${walletError.message}`,
                        provider_id: body.providerId,
                        activation_paid_at: now,
                        wallet_error: walletError.message,
                    });
                }
            }
        }

        const { data: existingNotif } = await supabaseAdmin
            .from('notification')
            .select('id')
            .eq('type', 'activation_payment_confirmed')
            .eq('provider_id', body.providerId)
            .limit(1)
            .maybeSingle();

        if (!existingNotif) {
            await supabaseAdmin.from('notification').insert({
                title: 'Account Activated',
                description: `Your activation fee of ETB ${feeAmount} has been confirmed. Your account is now active.`,
                type: 'activation_payment_confirmed',
                provider_id: body.providerId,
                is_read: false,
            });
            try {
                const { sendProviderPush } = await import('@/lib/push/sendProviderPush');
                await sendProviderPush({
                    serviceClient: supabaseAdmin,
                    providerId: body.providerId,
                    input: {
                        title: 'Account Activated',
                        body: `Your activation fee of ETB ${feeAmount} has been confirmed. Your account is now active.`,
                        route: '/profile',
                        type: 'account',
                    },
                });
            } catch (pushError) {
                console.error('Activation verify push failed:', pushError);
            }
        }

        await logAdminActivity({
            request,
            action: 'activate',
            resource_type: 'provider_activation',
            resource_id: body.providerId,
            summary: `Verified activation payment for provider ${body.providerId}`,
            metadata: {
                tx_ref: txRef,
                fee_amount: feeAmount,
                chapa_reference: verifyData.data?.reference ?? null,
                wallet_skipped: walletSkipped,
                wallet_skipped_reason: walletSkippedReason,
                source: 'admin_verify',
            },
        });

        return NextResponse.json({
            status: 'success',
            provider_id: body.providerId,
            activation_paid_at: now,
            tx_ref: txRef,
            fee_amount: feeAmount,
            chapa_reference: verifyData.data?.reference,
            wallet_skipped: walletSkipped,
            wallet_skipped_reason: walletSkippedReason,
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected verify error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
