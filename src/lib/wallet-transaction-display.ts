import { isActivationCredit } from '@/lib/wallet-transaction-metrics';
import type { AdminStatusTone } from '@/lib/admin-status-badge';

export type WalletTransactionEventId =
    | 'booking_payout'
    | 'booking_cancel_refund'
    | 'booking_cancel'
    | 'decline_fee'
    | 'decline_refund'
    | 'withdrawal'
    | 'activation'
    | 'other';

const EVENT_LABELS: Record<WalletTransactionEventId, string> = {
    booking_payout: 'Booking payout',
    booking_cancel_refund: 'Cancel refund',
    booking_cancel: 'Booking cancel',
    decline_fee: 'Decline fee',
    decline_refund: 'Decline refund',
    withdrawal: 'Withdrawal',
    activation: 'Activation',
    other: 'Other',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
    return UUID_RE.test(value.trim());
}

function normalizedNote(note: string): string {
    return note.trim().toLowerCase();
}

function isJobPayoutCredit(note: string, isCredit: boolean): boolean {
    if (!isCredit) return false;
    const normalized = normalizedNote(note);
    return normalized.includes('completed (payout') || normalized.includes('payout after admin commission');
}

function isCancelRefund(note: string, isCredit: boolean): boolean {
    if (!isCredit) return false;
    const normalized = normalizedNote(note);
    return normalized.includes('cancel refund') || (normalized.includes('refund') && normalized.includes('cancel'));
}

function isBookingCancelDebit(note: string, isCredit: boolean): boolean {
    if (isCredit) return false;
    const normalized = normalizedNote(note);
    return normalized.includes('cancel') && !normalized.includes('refund');
}

function isDeclineRefund(note: string, isCredit: boolean): boolean {
    if (!isCredit) return false;
    const normalized = normalizedNote(note);
    return normalized.includes('decline') && normalized.includes('refund');
}

function isDeclineFee(note: string, isCredit: boolean): boolean {
    if (isCredit) return false;
    const normalized = normalizedNote(note);
    return normalized.includes('decline') || normalized.includes('gateway fee');
}

function isWithdrawal(note: string, isCredit: boolean): boolean {
    if (isCredit) return false;
    return normalizedNote(note).includes('withdrawal');
}

export function parseWalletTransactionEvent(input: {
    note?: string | null;
    isCredit?: boolean | null;
    type?: string | null;
    paymentType?: string | null;
    transactionId?: string | null;
}): WalletTransactionEventId {
    const note = typeof input.note === 'string' ? input.note : '';
    const isCredit = input.isCredit === true;
    const type = typeof input.type === 'string' ? input.type.toLowerCase() : '';
    const transactionId = typeof input.transactionId === 'string' ? input.transactionId : '';

    if (
        isCredit &&
        isActivationCredit({
            note,
            transactionId,
            isCredit: true,
            type: type || '',
            amount: '',
            userId: '',
            createdDate: '',
        })
    ) {
        return 'activation';
    }
    if (isWithdrawal(note, isCredit)) return 'withdrawal';
    if (isJobPayoutCredit(note, isCredit)) return 'booking_payout';
    if (isDeclineRefund(note, isCredit)) return 'decline_refund';
    if (isCancelRefund(note, isCredit)) return 'booking_cancel_refund';
    if (isDeclineFee(note, isCredit)) return 'decline_fee';
    if (isBookingCancelDebit(note, isCredit)) return 'booking_cancel';
    return 'other';
}

export function formatWalletTransactionEventLabel(eventId: WalletTransactionEventId): string {
    return EVENT_LABELS[eventId];
}

export function getWalletTransactionEventTone(eventId: WalletTransactionEventId): AdminStatusTone {
    switch (eventId) {
        case 'booking_payout':
            return 'success';
        case 'booking_cancel_refund':
        case 'decline_refund':
            return 'info';
        case 'booking_cancel':
        case 'decline_fee':
            return 'warning';
        case 'withdrawal':
            return 'slate';
        case 'activation':
            return 'violet';
        default:
            return 'neutral';
    }
}

export function isProviderWalletPayoutCredit(input: {
    note?: string | null;
    isCredit?: boolean | null;
    type?: string | null;
}): boolean {
    const type = typeof input.type === 'string' ? input.type.toLowerCase() : '';
    if (type !== 'provider' && type !== 'provider_payout') return false;
    return isJobPayoutCredit(typeof input.note === 'string' ? input.note : '', input.isCredit === true);
}

export function resolveWalletPaymentDisplayLabel(input: {
    paymentType?: string | null;
    note?: string | null;
    isCredit?: boolean | null;
    type?: string | null;
}): string {
    if (isProviderWalletPayoutCredit(input)) {
        return 'Wallet credit';
    }

    const paymentType = typeof input.paymentType === 'string' ? input.paymentType.trim() : '';
    if (!paymentType) return '—';
    if (paymentType.toLowerCase() === 'chapa') return 'Chapa';
    if (paymentType.toLowerCase() === 'wallet') return 'Wallet';
    return paymentType;
}

export function getWalletPaymentDisplayTone(input: {
    paymentType?: string | null;
    note?: string | null;
    isCredit?: boolean | null;
    type?: string | null;
}): AdminStatusTone {
    if (isProviderWalletPayoutCredit(input)) {
        return 'wallet';
    }
    const paymentType = (input.paymentType ?? '').toLowerCase();
    if (paymentType === 'chapa') return 'violet';
    if (paymentType === 'wallet') return 'wallet';
    return 'neutral';
}

export function formatBookingAmountLabel(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    return `ETB ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
