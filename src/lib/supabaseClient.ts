"use client";

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
    getClientSupabaseTarget,
    getPublicSupabaseConfig,
    type SupabaseTarget,
} from '@/lib/supabase-env';

const browserClients = new Map<SupabaseTarget, SupabaseClient>();

export function getSupabase(): SupabaseClient {
    const target = getClientSupabaseTarget();
    const cached = browserClients.get(target);
    if (cached) return cached;

    const config = getPublicSupabaseConfig(target);
    const client = createBrowserClient(config.url, config.anonKey);
    browserClients.set(target, client);
    return client;
}
