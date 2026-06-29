import type { WalletTransaction } from '@/features/walletTransaction/walletTransactionSlice';

function toCsvField(value: unknown): string {
    const text = String(value ?? '');
    return `"${text.replace(/"/g, '""')}"`;
}

function formatExportDate(createdDate: string): string {
    if (!createdDate.trim()) return '';
    const date = new Date(createdDate);
    if (Number.isNaN(date.getTime())) return createdDate;
    return date.toISOString();
}

function rowToCsv(item: WalletTransaction): string {
    const fields = [
        formatExportDate(item.createdDate),
        item.isCredit ? 'credit' : 'debit',
        item.amount,
        item.walletEventLabel,
        item.type,
        item.paymentDisplayLabel || item.paymentType,
        item.customerName,
        item.customerEmail,
        item.customerPhone,
        item.customerProfileId || item.customer_id,
        item.providerName,
        item.providerEmail,
        item.providerPhone,
        item.providerProfileId || item.provider_id,
        item.bookingServiceName,
        item.bookingTotalAmount ?? '',
        item.bookingAdminCommission ?? '',
        item.authUserName,
        item.authUserEmail,
        item.authUserPhone,
        item.authUserId || item.userId,
        item.userId,
        item.transactionId,
        item.id,
        item.note,
    ];
    return fields.map(toCsvField).join(',');
}

const CSV_HEADER = [
    'created_date',
    'direction',
    'amount',
    'event',
    'type',
    'payment_type',
    'customer_name',
    'customer_email',
    'customer_phone',
    'customer_profile_id',
    'provider_name',
    'provider_email',
    'provider_phone',
    'provider_profile_id',
    'booking_service',
    'booking_total',
    'booking_commission',
    'auth_user_name',
    'auth_user_email',
    'auth_user_phone',
    'auth_user_id',
    'ledger_user_id',
    'transaction_id',
    'wallet_row_id',
    'note',
].join(',');

export function buildWalletTransactionsCsv(items: WalletTransaction[]): string {
    const lines = [CSV_HEADER, ...items.map(rowToCsv)];
    return lines.join('\n');
}

export function downloadWalletTransactionsCsv(items: WalletTransaction[], filenamePrefix = 'wallet-transactions'): void {
    const csv = buildWalletTransactionsCsv(items);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
}
