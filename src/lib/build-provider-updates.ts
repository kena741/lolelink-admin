import { buildProviderLocationPayload } from '@/lib/provider-location';

export interface ProviderEditFormValues {
    name: string;
    phone: string;
    address: string;
    latitude: number | null;
    longitude: number | null;
    banner: string;
    avatar: string;
}

export function splitProviderDisplayName(full: string): { firstName: string; lastName: string } {
    const trimmed = full.trim();
    const spaceIdx = trimmed.indexOf(' ');
    if (spaceIdx <= 0) {
        return { firstName: trimmed, lastName: '' };
    }
    return {
        firstName: trimmed.slice(0, spaceIdx),
        lastName: trimmed.slice(spaceIdx + 1).trim(),
    };
}

export function buildProviderUpdatesFromEditForm(
    form: ProviderEditFormValues
): Record<string, unknown> {
    const updates: Record<string, unknown> = {};

    const nameVal = form.name.trim();
    if (nameVal) {
        const { firstName, lastName } = splitProviderDisplayName(nameVal);
        updates.firstName = firstName;
        updates.lastName = lastName;
    }

    updates.phoneNumber = form.phone.trim();
    updates.address = form.address.trim();

    const location = buildProviderLocationPayload(form.latitude, form.longitude);
    if (location) {
        updates.location = location;
    }

    const banner = form.banner.trim();
    if (banner) {
        updates.banner = banner;
    }

    const avatar = form.avatar.trim();
    if (avatar) {
        updates.profileImage = avatar;
    }

    return updates;
}
