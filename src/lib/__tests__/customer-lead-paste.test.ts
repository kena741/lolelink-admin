import { describe, expect, it } from 'vitest';
import {
    parseCustomerLeadPaste,
    splitFullName,
} from '../customer-lead-paste';

describe('splitFullName', () => {
    it('maps first + last', () => {
        expect(splitFullName('Mariyamawit Abera')).toEqual({
            first_name: 'Mariyamawit',
            last_name: 'Abera',
        });
    });

    it('keeps multi-word last name', () => {
        expect(splitFullName('Yilma Tafa Bekele')).toEqual({
            first_name: 'Yilma',
            last_name: 'Tafa Bekele',
        });
    });

    it('handles single token', () => {
        expect(splitFullName('Nahom')).toEqual({
            first_name: 'Nahom',
            last_name: null,
        });
    });
});

describe('parseCustomerLeadPaste', () => {
    it('parses multiple blocks separated by blank lines', () => {
        const text = `Full name: Nebiyat Kassa
Phone: 960437349
Source/inquiry channel: Shortcode
Location: Tikur Anbessa
Description: Traditional foods
2 kids

Full name: Aziza
Phone: +251 91 120 6319
Source/inquiry channel: Phone
Location: Bole Atlas
Description: Nanny only
`;
        const result = parseCustomerLeadPaste(text);
        expect(result.errors).toEqual([]);
        expect(result.leads).toHaveLength(2);
        expect(result.leads[0]).toMatchObject({
            first_name: 'Nebiyat',
            last_name: 'Kassa',
            phone: '960437349',
            signup_source: 'Shortcode',
            address: 'Tikur Anbessa',
            admin_note: 'Traditional foods\n2 kids',
        });
        expect(result.leads[1]).toMatchObject({
            first_name: 'Aziza',
            last_name: null,
            phone: '+251 91 120 6319',
            signup_source: 'Phone',
            address: 'Bole Atlas',
        });
    });

    it('reports missing phone', () => {
        const result = parseCustomerLeadPaste(`Full name: Alone\nPhone:\n`);
        expect(result.leads).toHaveLength(0);
        expect(result.errors[0]?.message).toMatch(/Phone/i);
    });
});
