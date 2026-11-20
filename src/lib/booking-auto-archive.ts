/**
 * Test / QA accounts whose bookings should be soft-archived by default
 * (hidden from admin bookings unless "show archived").
 *
 * Keep IDs/emails in sync with:
 *   supabase/migrations/*_booked_service_auto_archive_test_accounts.sql
 *   scripts/sql/booked-service-auto-archive-test-accounts.sql
 */

export const BOOKING_AUTO_ARCHIVE_NOTE = 'Auto-archived test account';

/** Known customer profile IDs (Fozia + Melese). */
export const BOOKING_AUTO_ARCHIVE_CUSTOMER_IDS = [
    // Fozia Kassa
    '8a8f7b79-d371-4a7e-b140-162da35cc5cc', // foziakassa07@gmail.com
    'b6653709-a566-4c4b-b1ba-a31945376bef', // foziakassa@gmail.com
    '9d1f8482-8e33-42e6-bfc3-e1c34233ed06', // fozp19@gmail.com
    '0e21bd39-6a91-4cc3-9185-0101c5082728', // yvbbccy@gmail.com
    '1a8510bc-ae50-44c8-b171-888b0463446f', // 251927429720@phone.zemen.app
    '5b50054b-561b-4327-80c2-beac321ead3e', // pogede4371@noproposal.com
    // Melese
    'e626b0bc-d085-4038-aa41-7ebf4de63019', // meleseayen2016@gmail.com
] as const;

/** Known provider profile IDs. */
export const BOOKING_AUTO_ARCHIVE_PROVIDER_IDS = [
    '2e59797a-db9b-4485-afa8-69a54c9bd42f', // Fozia Kassa / foziakassa@gmail.com
    '1a075e03-21b3-4cc9-9ce6-41e78b06c93b', // Melese Provider / miyemon960@lovadio.com
] as const;

const EMAIL_NEEDLES = [
    'foziakassa',
    'meleseayen',
    'miyemon960@lovadio.com',
] as const;

const NAME_PAIRS: ReadonlyArray<{ first: string; last: string }> = [
    { first: 'fozia', last: 'kassa' },
    { first: 'melese', last: 'customer' },
    { first: 'melese', last: 'ayen' },
    { first: 'melese', last: 'provider' },
];

function norm(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function emailMatches(email: string | null | undefined): boolean {
    const e = norm(email);
    if (!e) return false;
    return EMAIL_NEEDLES.some((needle) => e.includes(needle));
}

function nameMatches(first: string | null | undefined, last: string | null | undefined): boolean {
    const f = norm(first);
    const l = norm(last);
    if (!f || !l) return false;
    return NAME_PAIRS.some((pair) => pair.first === f && pair.last === l);
}

export function shouldAutoArchiveBooking(input: {
    customer_id?: string | null;
    provider_id?: string | null;
    email?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    first_name?: string | null;
    last_name?: string | null;
}): boolean {
    const customerId = (input.customer_id ?? '').trim();
    if (customerId && (BOOKING_AUTO_ARCHIVE_CUSTOMER_IDS as readonly string[]).includes(customerId)) {
        return true;
    }
    const providerId = (input.provider_id ?? '').trim();
    if (providerId && (BOOKING_AUTO_ARCHIVE_PROVIDER_IDS as readonly string[]).includes(providerId)) {
        return true;
    }
    if (emailMatches(input.email)) return true;
    if (nameMatches(input.firstName ?? input.first_name, input.lastName ?? input.last_name)) {
        return true;
    }
    return false;
}

/** Fields to merge onto a booked_service insert/update when auto-archive matches. */
export function bookingAutoArchiveFields(input: Parameters<typeof shouldAutoArchiveBooking>[0]): {
    is_archived: true;
    archive_note: string;
} | null {
    if (!shouldAutoArchiveBooking(input)) return null;
    return { is_archived: true, archive_note: BOOKING_AUTO_ARCHIVE_NOTE };
}
