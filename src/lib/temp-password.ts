import { randomBytes } from 'crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/** Readable temp password for admin-created accounts (no ambiguous 0/O/1/l). */
export function generateTempPassword(length = 10): string {
    const bytes = randomBytes(length);
    let out = '';
    for (let i = 0; i < length; i += 1) {
        out += ALPHABET[bytes[i]! % ALPHABET.length];
    }
    return out;
}
