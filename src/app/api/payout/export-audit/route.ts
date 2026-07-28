import { NextResponse } from 'next/server';
import {
    isDateInDashboardRange,
    parseDashboardRange,
} from '@/lib/dashboard-range';
import { isMissingPaymentMethodPayout } from '@/lib/payout-missing-payment-method';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

interface WithdrawalRow {
    id: string;
    providerId?: string | null;
    amount?: string | null;
    paymentStatus?: string | null;
    note?: string | null;
    adminNote?: string | null;
    createdDate?: string | null;
    paymentDate?: string | null;
}

interface ProviderPaymentMethodRow {
    providerID?: string | null;
    method_type?: string | null;
    method_code?: string | null;
    method_name?: string | null;
    holderName?: string | null;
    accountNumber?: string | null;
    bankName?: string | null;
    is_active?: boolean | null;
    is_default?: boolean | null;
    updated_at?: string | null;
}

function normalizeText(value: string | null | undefined): string {
    return (value || '').trim();
}

function isToday(value?: string | null): boolean {
    if (!value) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getFullYear() === now.getFullYear()
        && date.getMonth() === now.getMonth()
        && date.getDate() === now.getDate();
}

function toCsvField(value: string | number | null | undefined): string {
    const text = value == null ? '' : String(value);
    if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
}

function pickPreferred(methods: ProviderPaymentMethodRow[]): ProviderPaymentMethodRow | null {
    const active = methods.filter((m) => m.is_active === true);
    const sorted = [...active].sort((a, b) => {
        const aDefault = a.is_default === true ? 1 : 0;
        const bDefault = b.is_default === true ? 1 : 0;
        if (aDefault !== bDefault) return bDefault - aDefault;
        const aUpdated = a.updated_at ? Date.parse(a.updated_at) : 0;
        const bUpdated = b.updated_at ? Date.parse(b.updated_at) : 0;
        return bUpdated - aUpdated;
    });
    return sorted[0] || null;
}

export async function GET(request: Request) {
    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    try {
        const url = new URL(request.url);
        const segment = normalizeText(url.searchParams.get('segment')).toLowerCase();
        const range = parseDashboardRange(url.searchParams.get('range'));

        const { data, error } = await supabaseAdmin
            .from('withdrawal_history')
            .select('id, providerId, amount, paymentStatus, note, adminNote, createdDate, paymentDate')
            .order('createdDate', { ascending: false });
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to load payout audit' }, { status: 500 });

        const rows = (data || []) as WithdrawalRow[];
        const providerIds = [
            ...new Set(rows.map((row) => normalizeText(row.providerId)).filter(Boolean)),
        ];

        const methodsByProviderId: Record<
            string,
            { accountNumber?: string; holderName?: string; bankName?: string; bankCode?: string } | null
        > = {};

        if (segment === 'missing_payment_method' && providerIds.length > 0) {
            const { data: methodRows, error: methodError } = await supabaseAdmin
                .from('provider_payment_methods')
                .select(
                    'providerID, method_code, method_name, holderName, accountNumber, bankName, is_active, is_default, updated_at'
                )
                .in('providerID', providerIds);
            if (methodError)
                return NextResponse.json({ error: methodError.message || 'Failed to load payment methods' }, { status: 500 });

            const grouped: Record<string, ProviderPaymentMethodRow[]> = {};
            ((methodRows || []) as ProviderPaymentMethodRow[]).forEach((row) => {
                const key = normalizeText(row.providerID);
                if (!key) return;
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(row);
            });

            providerIds.forEach((providerId) => {
                const picked = pickPreferred(grouped[providerId] || []);
                methodsByProviderId[providerId] = picked
                    ? {
                          accountNumber: normalizeText(picked.accountNumber) || undefined,
                          holderName: normalizeText(picked.holderName) || undefined,
                          bankName: normalizeText(picked.bankName || picked.method_name) || undefined,
                          bankCode: normalizeText(picked.method_code) || undefined,
                      }
                    : null;
            });
        }

        const filteredRows = rows.filter((row) => {
            const status = normalizeText(row.paymentStatus).toLowerCase();
            const note = normalizeText(row.adminNote).toLowerCase();
            const dateRef = row.paymentDate || row.createdDate;
            const inRange = !range || isDateInDashboardRange(dateRef, range);

            if (segment === 'waiting_confirmation')
                return status === 'approved' && note.includes('reference=') && inRange;
            if (segment === 'failed_rejected')
                return status === 'rejected' && inRange;
            if (segment === 'missing_payment_method') {
                const providerId = normalizeText(row.providerId);
                return (
                    isMissingPaymentMethodPayout(
                        row.paymentStatus,
                        providerId ? methodsByProviderId[providerId] ?? null : null
                    ) && inRange
                );
            }
            if (segment === 'completed_today')
                return status === 'completed' && isToday(row.paymentDate);
            return true;
        });

        const header = [
            'withdrawal_id',
            'provider_id',
            'amount',
            'payment_status',
            'created_date',
            'payment_date',
            'note',
            'admin_note',
        ];
        const lines = [
            header.map(toCsvField).join(','),
            ...filteredRows.map((row) =>
                [
                    row.id,
                    row.providerId,
                    row.amount,
                    row.paymentStatus,
                    row.createdDate,
                    row.paymentDate,
                    row.note,
                    row.adminNote,
                ].map(toCsvField).join(',')
            ),
        ];
        const csv = lines.join('\n');
        const filename = `payout-audit-${segment || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;

        return new NextResponse(csv, {
            headers: {
                'Content-Type': 'text/csv; charset=utf-8',
                'Content-Disposition': `attachment; filename="${filename}"`,
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unexpected export error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
