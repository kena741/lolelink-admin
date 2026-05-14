import type { SupabaseClient } from '@supabase/supabase-js';

export async function fetchServiceCountsByProvider(
    supabase: SupabaseClient
): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    const bump = (rows: { provider_id?: string | null }[] | null) => {
        for (const r of rows ?? []) {
            const id = r.provider_id;
            if (!id) continue;
            map.set(id, (map.get(id) ?? 0) + 1);
        }
    };
    const { data: a, error: e1 } = await supabase.from('service').select('provider_id');
    if (!e1 && a) {
        bump(a as { provider_id?: string | null }[]);
        return map;
    }
    const { data: b } = await supabase.from('services').select('provider_id');
    bump(b as { provider_id?: string | null }[]);
    return map;
}
