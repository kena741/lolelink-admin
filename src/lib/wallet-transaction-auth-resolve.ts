import { readAuthUserId } from '@/lib/wallet-transaction-user';

export interface WalletProfileAuthRef {
    profileId: string;
    authUserId: string;
}

export interface ResolvedWalletAuthUser {
    authUserId: string;
    userIdStoredAsProfile: boolean;
}

export function resolveWalletAuthUserId(params: {
    rawUserId: string | null | undefined;
    customerProfile?: WalletProfileAuthRef | null;
    providerProfile?: WalletProfileAuthRef | null;
    knownAuthUserIds: ReadonlySet<string>;
}): ResolvedWalletAuthUser {
    const raw = readAuthUserId(params.rawUserId) ?? '';
    const fromCustomer = readAuthUserId(params.customerProfile?.authUserId);
    const fromProvider = readAuthUserId(params.providerProfile?.authUserId);

    const authUserId = fromCustomer ?? fromProvider ?? (raw && params.knownAuthUserIds.has(raw) ? raw : '');

    const profileId = params.customerProfile?.profileId ?? params.providerProfile?.profileId ?? '';
    const userIdStoredAsProfile = Boolean(
        raw && profileId && raw.toLowerCase() === profileId.toLowerCase() && authUserId && authUserId.toLowerCase() !== raw.toLowerCase()
    );

    return {
        authUserId: authUserId || raw,
        userIdStoredAsProfile,
    };
}

export function walletProfileAndAuthShareId(profileId: string, authUserId: string): boolean {
    const profile = profileId.trim().toLowerCase();
    const auth = authUserId.trim().toLowerCase();
    return Boolean(profile && auth && profile === auth);
}
