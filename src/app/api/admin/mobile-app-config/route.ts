import { NextResponse } from 'next/server';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getSupabaseAdminFromRequest } from '@/lib/supabaseAdmin';
import { logAdminActivity } from '@/lib/admin-activity-log';
import { buildChangeMetadata } from '@/lib/activity-log-changes';

export const runtime = 'nodejs';

interface MobileVersionRule {
    version: string;
    build: number;
}

interface MobileAppConfigRow {
    app_key?: string | null;
    maintenance_mode?: boolean | null;
    maintenance_message?: string | null;
    maintenance_affected_versions?: unknown;
    update_needed?: boolean | null;
    update_message?: string | null;
    update_affected_versions?: unknown;
    created_at?: string | null;
    updated_at?: string | null;
}

interface UpdateMobileAppConfigBody {
    appKey?: string;
    maintenanceMode?: boolean;
    maintenanceMessage?: string;
    maintenanceAffectedVersions?: MobileVersionRule[];
    updateNeeded?: boolean;
    updateMessage?: string;
    updateAffectedVersions?: MobileVersionRule[];
}

function parseVersionRules(value: unknown): MobileVersionRule[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
            const entry = item as Record<string, unknown>;
            const version = typeof entry.version === 'string' ? entry.version.trim() : '';
            const buildRaw = Number(entry.build ?? 0);
            const build = Number.isFinite(buildRaw) ? Math.trunc(buildRaw) : 0;
            if (!version) return null;
            return { version, build };
        })
        .filter((item): item is MobileVersionRule => item !== null);
}

function normalizeRow(row: MobileAppConfigRow): Record<string, unknown> {
    return {
        app_key: typeof row.app_key === 'string' ? row.app_key : '',
        maintenance_mode: Boolean(row.maintenance_mode),
        maintenance_message: typeof row.maintenance_message === 'string' ? row.maintenance_message : '',
        maintenance_affected_versions: parseVersionRules(row.maintenance_affected_versions),
        update_needed: Boolean(row.update_needed),
        update_message: typeof row.update_message === 'string' ? row.update_message : '',
        update_affected_versions: parseVersionRules(row.update_affected_versions),
        created_at: row.created_at ?? null,
        updated_at: row.updated_at ?? null,
    };
}

async function canReadMobileConfig(request: Request): Promise<boolean> {
    const settings = await requireAdminPermission(request, 'settings:read');
    if (settings.ok) return true;
    const support = await requireAdminPermission(request, 'contact:read');
    return support.ok;
}

async function canWriteMobileConfig(request: Request): Promise<boolean> {
    const settings = await requireAdminPermission(request, 'settings:write');
    if (settings.ok) return true;
    const support = await requireAdminPermission(request, 'contact:write');
    return support.ok;
}

export async function GET(request: Request) {
    const allowed = await canReadMobileConfig(request);
    if (!allowed) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data, error } = await supabaseAdmin
        .from('mobile_app_config')
        .select('*')
        .order('app_key', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = ((data ?? []) as MobileAppConfigRow[]).map((row) => normalizeRow(row));
    return NextResponse.json({ data: rows });
}

export async function PATCH(request: Request) {
    const allowed = await canWriteMobileConfig(request);
    if (!allowed) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = (await request.json()) as UpdateMobileAppConfigBody;
    const appKey = (body.appKey ?? '').trim();
    if (!appKey) {
        return NextResponse.json({ error: 'appKey is required' }, { status: 400 });
    }

    const updatePayload = {
        maintenance_mode: Boolean(body.maintenanceMode),
        maintenance_message: (body.maintenanceMessage ?? '').trim(),
        maintenance_affected_versions: parseVersionRules(body.maintenanceAffectedVersions),
        update_needed: Boolean(body.updateNeeded),
        update_message: (body.updateMessage ?? '').trim(),
        update_affected_versions: parseVersionRules(body.updateAffectedVersions),
        updated_at: new Date().toISOString(),
    };

    const supabaseAdmin = getSupabaseAdminFromRequest(request);
    const { data: existing, error: existingError } = await supabaseAdmin
        .from('mobile_app_config')
        .select('*')
        .eq('app_key', appKey)
        .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: 'App config not found' }, { status: 404 });

    const { data: updated, error: updateError } = await supabaseAdmin
        .from('mobile_app_config')
        .update(updatePayload)
        .eq('app_key', appKey)
        .select('*')
        .single();
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await logAdminActivity({
        request,
        action: 'update',
        resource_type: 'settings',
        resource_id: appKey,
        summary: `Updated mobile app config for ${appKey}`,
        metadata: {
            section: 'mobile_app_config',
            changes: buildChangeMetadata(
                existing as Record<string, unknown>,
                updated as Record<string, unknown>,
                [
                    'maintenance_mode',
                    'maintenance_message',
                    'maintenance_affected_versions',
                    'update_needed',
                    'update_message',
                    'update_affected_versions',
                ]
            ),
        },
    });

    return NextResponse.json({ data: normalizeRow(updated as MobileAppConfigRow) });
}
