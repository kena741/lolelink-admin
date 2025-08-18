"use client";
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
	// Provide a clear error in development if envs are missing
	// Avoid throwing in production build where env replacement may occur
		if (process.env.NODE_ENV !== 'production') {
			console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
		}
}

export const supabase = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
