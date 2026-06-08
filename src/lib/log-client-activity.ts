interface ClientActivityInput {
    action: string;
    resource_type: string;
    resource_id?: string;
    summary: string;
    metadata?: Record<string, unknown>;
}

export async function logClientAdminActivity(input: ClientActivityInput): Promise<void> {
    try {
        await fetch('/api/admin/activity-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        });
    } catch {
    }
}
