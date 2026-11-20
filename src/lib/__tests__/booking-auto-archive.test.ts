import { describe, expect, it } from 'vitest';
import {
    BOOKING_AUTO_ARCHIVE_NOTE,
    bookingAutoArchiveFields,
    shouldAutoArchiveBooking,
} from '../booking-auto-archive';

describe('booking-auto-archive', () => {
    it('matches Fozia by customer id', () => {
        expect(
            shouldAutoArchiveBooking({
                customer_id: '8a8f7b79-d371-4a7e-b140-162da35cc5cc',
            })
        ).toBe(true);
    });

    it('matches Melese by provider id', () => {
        expect(
            shouldAutoArchiveBooking({
                provider_id: '1a075e03-21b3-4cc9-9ce6-41e78b06c93b',
            })
        ).toBe(true);
    });

    it('matches Fozia by name', () => {
        expect(
            shouldAutoArchiveBooking({
                firstName: 'Fozia',
                lastName: 'Kassa',
            })
        ).toBe(true);
    });

    it('does not match unrelated bookings', () => {
        expect(
            shouldAutoArchiveBooking({
                customer_id: '00000000-0000-0000-0000-000000000000',
                email: 'someone@example.com',
                firstName: 'Ada',
                lastName: 'Lovelace',
            })
        ).toBe(false);
        expect(bookingAutoArchiveFields({ email: 'someone@example.com' })).toBeNull();
    });

    it('returns archive fields for matches', () => {
        expect(
            bookingAutoArchiveFields({
                email: 'foziakassa07@gmail.com',
            })
        ).toEqual({
            is_archived: true,
            archive_note: BOOKING_AUTO_ARCHIVE_NOTE,
        });
    });
});
