import { describe, expect, it } from 'vitest';
import {
    companyVerificationTone,
    formatCompanyVerificationStatus,
    formatProviderType,
    normalizeCompanyRow,
    normalizeProviderCompanyVerification,
} from '../company-display';

describe('company display', () => {
    it('normalizes company row', () => {
        const company = normalizeCompanyRow({
            id: '9fed8b2c-1a06-4958-bcfa-00fb9e7b3432',
            provider_id: '1a075e03-21b3-4cc9-9ce6-41e78b06c93b',
            name: 'Zrmen Service',
            company_name: 'Zemen Service',
            industry: 'Software dev',
            company_size: '10',
            headquarters: 'Bole',
            founded: '2024',
            profile_bio: 'Description',
            banner_image: 'https://example.com/banner.jpg',
            created_at: '2026-05-28T08:25:17.665223+00:00',
            updated_at: '2026-05-28T08:25:17.665223+00:00',
        });

        expect(company.companyName).toBe('Zemen Service');
        expect(company.industry).toBe('Software dev');
        expect(company.headquarters).toBe('Bole');
    });

    it('formats provider and verification labels', () => {
        expect(formatProviderType('company')).toBe('Company');
        expect(formatCompanyVerificationStatus('not_submitted')).toBe('Not Submitted');
        expect(companyVerificationTone('approved')).toBe('success');
        expect(companyVerificationTone('rejected')).toBe('danger');
    });

    it('normalizes provider verification fields', () => {
        const verification = normalizeProviderCompanyVerification({
            provider_type: 'company',
            company_verification_status: 'pending',
            company_license_url: 'https://example.com/license.pdf',
            company_rejection_reason: null,
        });

        expect(verification.providerType).toBe('company');
        expect(verification.companyLicenseUrl).toBe('https://example.com/license.pdf');
    });
});
