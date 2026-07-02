export interface ChapaBank {
    id: number | string;
    slug?: string;
    swift?: string;
    name?: string;
    acct_length?: number;
    currency?: string;
    active?: number;
    is_active?: number;
    is_mobilemoney?: number | null;
}

export interface ResolveChapaBankInput {
    storedBankCode: string;
    swiftCode: string;
    bankName: string;
    accountNumber: string;
}

export interface ResolvedChapaBank {
    bankCode: string;
    bank: ChapaBank;
    bankName: string;
    correctedFrom: string | null;
}

function normalizeBankLabel(value: string): string {
    return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeAccountNumber(value: string): string {
    return value.replace(/\s+/g, '');
}

function bankIdMatches(bank: ChapaBank, code: string): boolean {
    return String(bank.id).trim() === code.trim();
}

function isActiveEtbBank(bank: ChapaBank): boolean {
    const isActive = bank.active === 1 || bank.is_active === 1;
    return (bank.currency || '').toUpperCase() === 'ETB' && isActive;
}

export function filterActiveEtbBanks(banks: ChapaBank[]): ChapaBank[] {
    return banks.filter(isActiveEtbBank);
}

function pickPreferredBank(candidates: ChapaBank[]): ChapaBank | null {
    if (candidates.length === 0) return null;
    const sorted = [...candidates].sort((a, b) => {
        const aMobile = (a.is_mobilemoney ?? 0) ? 1 : 0;
        const bMobile = (b.is_mobilemoney ?? 0) ? 1 : 0;
        return aMobile - bMobile;
    });
    return sorted[0];
}

function matchesAccountLength(bank: ChapaBank, accountLength: number): boolean {
    return typeof bank.acct_length === 'number' && bank.acct_length > 0 && bank.acct_length === accountLength;
}

function isCbeBank(bank: ChapaBank): boolean {
    const swift = normalizeBankLabel(bank.swift || '');
    const slug = normalizeBankLabel(bank.slug || '');
    const name = normalizeBankLabel(bank.name || '');
    if (swift === 'cbetetaa' || slug === 'cbe') return true;
    if (name.includes('commercialbank')) return true;
    return name.includes('cbe') && !name.includes('cbebirr');
}

function isTelebirrBank(bank: ChapaBank): boolean {
    const swift = normalizeBankLabel(bank.swift || '');
    const name = normalizeBankLabel(bank.name || '');
    return swift === 'telebirr' || name.includes('telebirr');
}

function isMobileMoneyBank(bank: ChapaBank): boolean {
    return Boolean(bank.is_mobilemoney) || isTelebirrBank(bank);
}

function resolveBankFromHints(
    etbBanks: ChapaBank[],
    params: { storedBankCode: string; swiftCode: string; bankName: string }
): ChapaBank | null {
    const { storedBankCode, swiftCode, bankName } = params;
    const normalizedStoredCode = normalizeBankLabel(storedBankCode);
    const normalizedSwift = normalizeBankLabel(swiftCode);
    const normalizedBankName = normalizeBankLabel(bankName);

    if (storedBankCode.trim()) {
        const byId = etbBanks.find((bank) => bankIdMatches(bank, storedBankCode));
        if (byId) return byId;
    }

    if (normalizedStoredCode) {
        const bySlug = etbBanks.filter((bank) => normalizeBankLabel(bank.slug || '') === normalizedStoredCode);
        const preferredBySlug = pickPreferredBank(bySlug);
        if (preferredBySlug) return preferredBySlug;
    }

    if (normalizedSwift) {
        const bySwift = etbBanks.filter((bank) => normalizeBankLabel(bank.swift || '') === normalizedSwift);
        const preferredBySwift = pickPreferredBank(bySwift);
        if (preferredBySwift) return preferredBySwift;
    }

    if (normalizedBankName) {
        const byName = etbBanks.filter((bank) => {
            const bankLabel = normalizeBankLabel(bank.name || '');
            return (
                bankLabel === normalizedBankName ||
                bankLabel.includes(normalizedBankName) ||
                normalizedBankName.includes(bankLabel)
            );
        });
        const preferredByName = pickPreferredBank(byName);
        if (preferredByName) return preferredByName;
    }

    return null;
}

export function pickBankForAccountLength(
    etbBanks: ChapaBank[],
    accountLength: number,
    storedBankName: string,
    hintedBank: ChapaBank | null
): ChapaBank | null {
    const candidates = etbBanks.filter((bank) => matchesAccountLength(bank, accountLength));
    if (candidates.length === 0) return null;
    if (candidates.length === 1) return candidates[0];

    const normalizedStored = normalizeBankLabel(storedBankName);
    const hintedIsMobile = hintedBank ? isMobileMoneyBank(hintedBank) : normalizedStored.includes('telebirr');

    if (accountLength === 13 && hintedIsMobile) {
        const cbe = candidates.find(isCbeBank);
        if (cbe) return cbe;
    }

    const byStoredName = candidates.filter((bank) => {
        const label = normalizeBankLabel(bank.name || '');
        return (
            label === normalizedStored ||
            label.includes(normalizedStored) ||
            normalizedStored.includes(label)
        );
    });
    const preferredByStoredName = pickPreferredBank(byStoredName);
    if (preferredByStoredName) return preferredByStoredName;

    if (accountLength === 13) {
        const cbe = candidates.find(isCbeBank);
        if (cbe) return cbe;
    }

    if (accountLength === 10) {
        const telebirr = candidates.find(isTelebirrBank);
        if (telebirr) return telebirr;
    }

    return pickPreferredBank(candidates);
}

function buildAccountLengthError(
    accountLength: number,
    bankName: string,
    expectedLength: number | undefined
): string {
    if (accountLength === 13 && (normalizeBankLabel(bankName).includes('telebirr') || expectedLength === 10)) {
        return 'Account number has 13 digits (CBE format) but the payment method is set to Telebirr (10 digits). Update the provider bank to Commercial Bank of Ethiopia (CBE), or use a 10-digit Telebirr number.';
    }
    if (typeof expectedLength === 'number' && expectedLength > 0) {
        return `Invalid account number length for ${bankName}. Expected ${expectedLength} digits, got ${accountLength}.`;
    }
    return `No supported Chapa bank accepts ${accountLength}-digit account numbers.`;
}

export function resolveChapaBankForPayout(
    etbBanks: ChapaBank[],
    params: ResolveChapaBankInput
): ResolvedChapaBank {
    const normalizedAccountNumber = normalizeAccountNumber(params.accountNumber);
    const accountLength = normalizedAccountNumber.length;
    if (!/^\d+$/.test(normalizedAccountNumber)) {
        throw new Error('Account number must contain only digits for bank transfer.');
    }

    const hintedBank = resolveBankFromHints(etbBanks, {
        storedBankCode: params.storedBankCode,
        swiftCode: params.swiftCode,
        bankName: params.bankName,
    });

    if (hintedBank && matchesAccountLength(hintedBank, accountLength)) {
        return {
            bankCode: String(hintedBank.id),
            bank: hintedBank,
            bankName: hintedBank.name || params.bankName,
            correctedFrom: null,
        };
    }

    const correctedBank = pickBankForAccountLength(
        etbBanks,
        accountLength,
        params.bankName,
        hintedBank
    );

    if (!correctedBank) {
        throw new Error(
            buildAccountLengthError(
                accountLength,
                hintedBank?.name || params.bankName,
                hintedBank?.acct_length
            )
        );
    }

    const correctedFrom =
        hintedBank && hintedBank.id !== correctedBank.id
            ? hintedBank.name || params.bankName
            : hintedBank && !matchesAccountLength(hintedBank, accountLength)
              ? hintedBank.name || params.bankName
              : params.bankName && normalizeBankLabel(params.bankName) !== normalizeBankLabel(correctedBank.name || '')
                ? params.bankName
                : null;

    return {
        bankCode: String(correctedBank.id),
        bank: correctedBank,
        bankName: correctedBank.name || params.bankName,
        correctedFrom,
    };
}

export async function fetchChapaBanks(chapaSecretKey: string): Promise<ChapaBank[]> {
    const response = await fetch('https://api.chapa.co/v1/banks', {
        method: 'GET',
        headers: {
            Authorization: `Bearer ${chapaSecretKey}`,
        },
        cache: 'no-store',
    });
    const payload = (await response.json()) as {
        data?: ChapaBank[];
        message?: unknown;
    };
    if (!response.ok) {
        const message =
            typeof payload.message === 'string' && payload.message.trim()
                ? payload.message
                : 'Failed to fetch Chapa banks';
        throw new Error(message);
    }
    return payload.data || [];
}

export async function resolveChapaBankForPayoutFromApi(
    chapaSecretKey: string,
    params: ResolveChapaBankInput
): Promise<ResolvedChapaBank> {
    const banks = await fetchChapaBanks(chapaSecretKey);
    return resolveChapaBankForPayout(filterActiveEtbBanks(banks), params);
}

export function isDigitsOnlyAccountNumber(value: string): boolean {
    return /^\d+$/.test(normalizeAccountNumber(value));
}

export function validateResolvedBankAccountLength(
    bank: ChapaBank,
    accountNumber: string,
    displayBankName: string
): void {
    const normalizedAccountNumber = normalizeAccountNumber(accountNumber);
    if (
        typeof bank.acct_length === 'number' &&
        bank.acct_length > 0 &&
        normalizedAccountNumber.length !== bank.acct_length
    ) {
        throw new Error(
            buildAccountLengthError(normalizedAccountNumber.length, displayBankName, bank.acct_length)
        );
    }
}
