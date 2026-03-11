"use client";
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const missing: string[] = [];
if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (missing.length > 0) {
    throw new Error(
        `Supabase client requires: ${missing.join(", ")}. Add them to .env.local (see .env.example). ` +
        "Values: https://supabase.com/dashboard/project/_/settings/api"
    );
}

const url = supabaseUrl as string;
const key = supabaseAnonKey as string;
export const supabase = createBrowserClient(url, key);
