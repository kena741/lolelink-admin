export interface RecordAdminActivityInput {
    action: string;
    resource_type: string;
    resource_id?: string;
    summary: string;
    metadata?: Record<string, unknown>;
}

export async function recordAdminActivity(input: RecordAdminActivityInput): Promise<boolean> {
    try {
        const response = await fetch('/api/admin/activity-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
            credentials: 'same-origin',
        });

        if (!response.ok) {
            if (process.env.NODE_ENV === 'development') {
                const payload = (await response.json().catch(() => null)) as { error?: string } | null;
                console.warn('[activity-log] failed to record:', payload?.error || response.status);
            }
            return false;
        }

        return true;
    } catch (error: unknown) {
        if (process.env.NODE_ENV === 'development') {
            const message = error instanceof Error ? error.message : 'unknown error';
            console.warn('[activity-log] failed to record:', message);
        }
        return false;
    }
}

export function logClientAdminActivity(input: RecordAdminActivityInput): void {
    void recordAdminActivity(input);
}
