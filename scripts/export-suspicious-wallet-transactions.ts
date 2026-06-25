import { createClient } from '@supabase/supabase-js';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { loadEnvLocal } from './lib/load-env-local';
import { isChapaWalletTransaction, walletTransactionMagnitude } from '../src/lib/wallet-transaction-metrics';

interface Flag {
    severity: 'high' | 'medium' | 'low';
    reason: string;
    action: string;
}

interface WalletRow {
    id: string;
    userId: string;
    amountNum: number;
    rawAmount: number;
    isCredit: boolean;
    note: string;
    transactionId: string;
    type: string;
    paymentType: string;
    createdDate: string;
    kind: string;
    isChapa: boolean;
}

function escapeCsv(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
}

function classifyKind(note: string, isCredit: boolean): string {
    const normalized = note.toLowerCase();
    if (isCredit && normalized.includes('refund')) return 'refund_credit';
    if (!isCredit && (normalized.includes('service fee debited') || normalized.includes('service booking fee'))) {
        return 'fee_debit';
    }
    if (!isCredit && normalized.includes('cancel') && !normalized.includes('refund')) return 'cancel_debit';
    if (isCredit && normalized.includes('completed (payout')) return 'payout_credit';
    if (normalized.includes('admin commission refund')) return 'zero_commission';
    if (normalized.includes('admin reversal')) return 'admin_reversal';
    if (normalized.includes('withdrawal payout')) return 'withdrawal';
    if (normalized.includes('activation') && isCredit) return 'activation_credit';
    return 'other';
}

function writeCsv(path: string, rows: Record<string, string>[]): void {
    mkdirSync(dirname(path), { recursive: true });
    const headers = [
        'severity',
        'reasons',
        'recommended_action',
        'id',
        'date',
        'email',
        'role',
        'user_id',
        'direction',
        'amount',
        'signed_impact',
        'payment_type',
        'chapa_tagged',
        'transaction_id',
        'note',
    ];
    const lines = [
        headers.join(','),
        ...rows.map((row) => headers.map((header) => escapeCsv(row[header] ?? '')).join(',')),
    ];
    writeFileSync(path, `${lines.join('\n')}\n`);
}

async function main(): Promise<void> {
    loadEnvLocal();

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        console.error('Missing Supabase env');
        process.exit(1);
    }

    const admin = createClient(url, key);
    const [{ data: rows }, { data: customers }, { data: providers }, { data: payments }] = await Promise.all([
        admin.from('wallet_transaction').select('*').order('createdDate', { ascending: true }),
        admin.from('customer').select('id, email, wallet_amount'),
        admin.from('provider').select('id, email, walletAmount'),
        admin.from('payments').select('booking_id, provider_ref, total_amount, payment_status, payment_method, provider'),
    ]);

    const emailByUser = new Map<string, { email: string; role: string; storedWallet: number }>();
    for (const customer of customers ?? []) {
        emailByUser.set(customer.id, {
            email: customer.email ?? '',
            role: 'customer',
            storedWallet: Number(customer.wallet_amount ?? 0),
        });
    }
    for (const provider of providers ?? []) {
        emailByUser.set(provider.id, {
            email: provider.email ?? '',
            role: 'provider',
            storedWallet: Number(provider.walletAmount ?? 0),
        });
    }

    const walletTxIds = new Set(
        (rows ?? [])
            .map((row) => String(row.transactionId ?? row.transaction_id ?? '').trim().toLowerCase())
            .filter(Boolean)
    );

    const missingPaymentRefs = new Map<string, number>();
    for (const payment of payments ?? []) {
        const method = String(payment.payment_method ?? payment.provider ?? '').toLowerCase();
        const status = String(payment.payment_status ?? '').toLowerCase();
        const completed =
            status.includes('completed') || status.includes('success') || status === 'payment_completed';
        if (!method.includes('chapa') || !completed) continue;

        const ref = String(payment.provider_ref ?? '').trim().toLowerCase();
        const bookingId = String(payment.booking_id ?? '').trim();
        const amount = walletTransactionMagnitude(payment.total_amount as string | number);
        if (amount <= 0 || !bookingId) continue;

        const hasWallet =
            (ref && walletTxIds.has(ref)) ||
            (rows ?? []).some((walletRow) => {
                const note = String(walletRow.note ?? '');
                const tx = String(walletRow.transactionId ?? walletRow.transaction_id ?? '');
                return note.includes(bookingId) || tx === bookingId;
            });

        if (!hasWallet) missingPaymentRefs.set(bookingId, amount);
    }

    const all: WalletRow[] = (rows ?? []).map((row) => {
        const isCredit = row.isCredit === true || row.is_credit === true;
        const note = String(row.note ?? '');
        return {
            id: String(row.id),
            userId: String(row.userId ?? row.user_id ?? ''),
            amountNum: walletTransactionMagnitude(row.amount),
            rawAmount: Number(row.amount),
            isCredit,
            note,
            transactionId: String(row.transactionId ?? row.transaction_id ?? ''),
            type: String(row.type ?? ''),
            paymentType: String(row.paymentType ?? row.payment_type ?? ''),
            createdDate: String(row.createdDate ?? row.created_date ?? ''),
            kind: classifyKind(note, isCredit),
            isChapa: isChapaWalletTransaction({
                amount: row.amount,
                isCredit,
                note,
                transactionId: row.transactionId ?? row.transaction_id,
                paymentType: row.paymentType ?? row.payment_type,
            }),
        };
    });

    const flagsById = new Map<string, Flag[]>();
    const addFlag = (id: string, flag: Flag): void => {
        const existing = flagsById.get(id) ?? [];
        existing.push(flag);
        flagsById.set(id, existing);
    };

    for (const row of all) {
        if (row.rawAmount < 0) {
            addFlag(row.id, {
                severity: 'medium',
                reason: 'Amount stored as negative number',
                action: 'Normalize amount to positive',
            });
        }
    }

    for (const row of all) {
        if (row.amountNum < 0.005) {
            addFlag(row.id, {
                severity: 'low',
                reason: 'Zero-amount row',
                action: 'Delete if duplicate noise',
            });
        }
    }

    for (const row of all) {
        if (row.paymentType.toLowerCase() === 'manual' && row.isCredit) {
            addFlag(row.id, {
                severity: 'medium',
                reason: 'Manual activation without Chapa',
                action: 'Verify intentional offline credit',
            });
        }
    }

    for (const row of all) {
        if (row.transactionId.includes('40d11a98') || row.note.includes('40d11a98')) {
            addFlag(row.id, {
                severity: 'high',
                reason: 'Invalid self-booking 40d11a98',
                action: 'Review fee and payout reversal',
            });
        }
    }

    const buckets = new Map<string, WalletRow[]>();
    for (const row of all) {
        if (!row.transactionId) continue;
        const key = [row.transactionId, row.userId, row.isCredit, row.kind].join('|');
        const group = buckets.get(key) ?? [];
        group.push(row);
        buckets.set(key, group);
    }

    for (const group of buckets.values()) {
        if (group.length < 2) continue;
        const sorted = [...group].sort((left, right) => left.createdDate.localeCompare(right.createdDate));
        for (const row of sorted.slice(1)) {
            addFlag(row.id, {
                severity: row.kind === 'refund_credit' ? 'high' : 'medium',
                reason: 'Duplicate row (same user + booking + operation)',
                action: 'Delete duplicate; keep earliest',
            });
        }
    }

    const byTx = new Map<string, WalletRow[]>();
    for (const row of all) {
        if (!row.transactionId) continue;
        const group = byTx.get(row.transactionId) ?? [];
        group.push(row);
        byTx.set(row.transactionId, group);
    }

    for (const group of byTx.values()) {
        if (group.length < 2 || new Set(group.map((row) => row.userId)).size < 2) continue;
        for (const row of group) {
            addFlag(row.id, {
                severity: 'low',
                reason: 'Booking tx reused across users (paired legs)',
                action: 'Do not bulk-delete by transactionId',
            });
        }
    }

    for (const row of all) {
        if (missingPaymentRefs.has(row.transactionId)) {
            addFlag(row.id, {
                severity: 'high',
                reason: 'Related booking missing Chapa wallet credit',
                action: 'Backfill missing Chapa credit',
            });
        }
    }

    for (const row of all) {
        if (row.kind === 'fee_debit' && row.amountNum >= 50) {
            addFlag(row.id, {
                severity: 'high',
                reason: 'Unusually large service fee debit',
                action: 'Verify fee calculation',
            });
        }
    }

    for (const row of all) {
        if (row.kind === 'payout_credit' && row.isCredit && row.amountNum >= 20 && !row.note.includes('40d11a')) {
            addFlag(row.id, {
                severity: 'low',
                reason: 'Large provider payout credit',
                action: 'Verify booking completion',
            });
        }
    }

    const ledgerByUser = new Map<string, number>();
    for (const row of all) {
        const delta = row.isCredit ? row.amountNum : -row.amountNum;
        ledgerByUser.set(row.userId, (ledgerByUser.get(row.userId) ?? 0) + delta);
    }

    const mismatchUsers = new Set<string>();
    for (const [userId, meta] of emailByUser) {
        const ledger = Math.round((ledgerByUser.get(userId) ?? 0) * 100) / 100;
        if (Math.abs(meta.storedWallet - ledger) > 0.01) mismatchUsers.add(userId);
    }

    for (const row of all) {
        if (mismatchUsers.has(row.userId)) {
            addFlag(row.id, {
                severity: 'medium',
                reason: 'User wallet_amount out of sync with ledger',
                action: 'Sync wallet after corrections',
            });
        }
    }

    const severityOrder = { high: 0, medium: 1, low: 2 };
    const suspicious = all
        .filter((row) => flagsById.has(row.id))
        .map((row) => {
            const flags = flagsById.get(row.id) ?? [];
            const top = [...flags].sort(
                (left, right) => severityOrder[left.severity] - severityOrder[right.severity]
            )[0];
            const user = emailByUser.get(row.userId);
            const signed = row.isCredit ? row.amountNum : -row.amountNum;
            return {
                severity: top.severity,
                reasons: [...new Set(flags.map((flag) => flag.reason))].join(' | '),
                recommended_action: [...new Set(flags.map((flag) => flag.action))].join(' | '),
                id: row.id,
                date: row.createdDate,
                email: user?.email ?? '',
                role: user?.role ?? row.type,
                user_id: row.userId,
                direction: row.isCredit ? 'credit' : 'debit',
                amount: row.amountNum.toFixed(2),
                signed_impact: signed.toFixed(2),
                payment_type: row.paymentType,
                chapa_tagged: row.isChapa ? 'yes' : 'no',
                transaction_id: row.transactionId,
                note: row.note,
            };
        })
        .sort((left, right) => {
            const severityDelta =
                severityOrder[left.severity as keyof typeof severityOrder] -
                severityOrder[right.severity as keyof typeof severityOrder];
            if (severityDelta !== 0) return severityDelta;
            return right.date.localeCompare(left.date);
        });

    const outputDir = join(process.cwd(), 'scripts', 'output');
    const allPath = join(outputDir, 'suspicious-wallet-transactions.csv');
    const highPath = join(outputDir, 'suspicious-wallet-transactions-high.csv');

    writeCsv(allPath, suspicious);
    writeCsv(
        highPath,
        suspicious.filter((row) => row.severity === 'high')
    );

    const counts = { high: 0, medium: 0, low: 0 };
    for (const row of suspicious) counts[row.severity as keyof typeof counts] += 1;

    console.log(`Wrote ${allPath}`);
    console.log(`Wrote ${highPath}`);
    console.log(`Flagged ${suspicious.length} of ${all.length} rows`, counts);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
