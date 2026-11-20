import type { SearchSelectOption } from '@/components/SearchSelect';
import type { Handyman } from '@/features/handyman/handymanSlice';
import type { Provider } from '@/features/provider/providerSlice';

export const PROVIDER_AS_WORKER_PREFIX = 'provider:';

export function isProviderAsWorkerValue(value: string): boolean {
    return value.startsWith(PROVIDER_AS_WORKER_PREFIX);
}

export function providerIdFromWorkerValue(value: string): string {
    return value.slice(PROVIDER_AS_WORKER_PREFIX.length);
}

export function providerDisplayName(provider: Provider): string {
    return (
        [provider.firstName ?? provider.first_name, provider.lastName ?? provider.last_name]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        provider.name?.trim() ||
        provider.companyName?.trim() ||
        'Provider'
    );
}

function handymanLabel(handyman: Handyman): string {
    return (
        [handyman.firstName, handyman.lastName].filter(Boolean).join(' ').trim() ||
        handyman.phoneNumber?.trim() ||
        'Handyman'
    );
}

function providerPhone(provider: Provider): string {
    return (provider.phoneNumber ?? provider.phone ?? '').trim();
}

/** Myself + team handymen (empty open). Type to also search all providers. */
export function buildBookingWorkerOptions(
    handymen: Handyman[],
    providers: Provider[],
    forProviderId?: string
): SearchSelectOption[] {
    const self: SearchSelectOption = {
        value: '',
        label: 'Myself',
        description: 'Provider does the job',
        searchText: 'myself provider self none',
        showWhenEmpty: true,
    };

    const workers = handymen
        .filter((h): h is Handyman & { id: string } => Boolean(h.id))
        .slice()
        .sort((a, b) => {
            const aOn = forProviderId && a.providerId === forProviderId ? 1 : 0;
            const bOn = forProviderId && b.providerId === forProviderId ? 1 : 0;
            if (bOn !== aOn) return bOn - aOn;
            return handymanLabel(a).localeCompare(handymanLabel(b));
        })
        .map((h) => {
            const label = handymanLabel(h);
            const onTeam = Boolean(forProviderId && h.providerId === forProviderId);
            return {
                value: h.id,
                label,
                description: [h.phoneNumber, onTeam ? 'Worker · this job' : 'Worker']
                    .filter(Boolean)
                    .join(' · '),
                searchText: [label, h.phoneNumber, h.id].filter(Boolean).join(' '),
                showWhenEmpty: !forProviderId || onTeam,
            };
        });

    const providerOptions = providers
        .filter((p) => Boolean(p.id) && !p.archived_at && p.id !== forProviderId)
        .map((p) => {
            const label = providerDisplayName(p);
            const phone = providerPhone(p);
            return {
                value: `${PROVIDER_AS_WORKER_PREFIX}${p.id}`,
                label,
                description: [phone, 'Provider'].filter(Boolean).join(' · ') || 'Provider',
                searchText: [label, phone, p.email, p.companyName, p.id].filter(Boolean).join(' '),
                showWhenEmpty: false,
            };
        })
        .sort((a, b) => a.label.localeCompare(b.label));

    return [self, ...workers, ...providerOptions];
}
