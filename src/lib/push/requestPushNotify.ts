/** Client-side helper: fire-and-forget provider/customer FCM via admin API. */
export async function requestPushNotify(payload: Record<string, unknown>): Promise<void> {
    try {
        await fetch('/api/admin/push/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    } catch (error) {
        console.error('Push notify failed:', error);
    }
}
