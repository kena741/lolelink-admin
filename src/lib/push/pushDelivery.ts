export type PushDeliveryInput = {
    title: string;
    body: string;
    route?: string;
    type?: 'booking' | 'account' | 'payout' | 'general' | 'document';
    delivery_id?: string;
    document_id?: string;
};

export function buildFcmData(input: PushDeliveryInput): Record<string, string> {
    const data: Record<string, string> = {
        type: input.type ?? 'general',
        route: input.route?.trim() || '/',
    };
    if (input.delivery_id?.trim()) data.delivery_id = input.delivery_id.trim();
    if (input.document_id?.trim()) data.document_id = input.document_id.trim();
    return data;
}
