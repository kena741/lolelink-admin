export type PushDeliveryInput = {
    title: string;
    body: string;
    route?: string;
    type?: 'booking' | 'account' | 'payout' | 'general';
};

export function buildFcmData(input: PushDeliveryInput): Record<string, string> {
    return {
        type: input.type ?? 'general',
        route: input.route?.trim() || '/',
    };
}
