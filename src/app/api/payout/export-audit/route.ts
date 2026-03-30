import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

function toCsvField(value: unknown): string {
    const text = String(value ?? '');
    const escaped = text.replace(/"/g, '""');
    return `"${escaped}"`;
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const segment = normalizeText(url.searchParams.get('segment')).toLowerCase();

        const { data, error } = await supabaseAdmin
            .from('withdrawal_history')
            .select('id, providerId, amount, paymentStatus, note, adminNote, createdDate, paymentDate')
            .order('createdDate', { ascending: false });
        if (error)
            return NextResponse.json({ error: error.message || 'Failed to load payout audit' }, { status: 500 });

        const rows = (data || []) as WithdrawalRow[];
        const filteredRows = rows.filter((row) => {
            const status = normalizeText(row.paymentStatus).toLowerCase();
            const note = normalizeText(row.adminNote).toLowerCase();
            if (segment === 'waiting_confirmation')
                return status === 'approved' && note.includes('reference=');
            if (segment === 'failed_rejected')
                return status === 'rejected';
            if (segment === 'missing_payment_method')
                return ['pending', 'approved'].includes(status) && !note.includes('reference=');
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

