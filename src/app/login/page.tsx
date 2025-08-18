"use client";
import React, { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ALLOWED_EMAIL } from "@/lib/authConfig";

export const dynamic = "force-dynamic";

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in and allowed, go to next (local session check)
    supabase.auth.getSession().then(({ data }) => {
      const e = data.session?.user?.email?.toLowerCase();
      if (e && e === ALLOWED_EMAIL.toLowerCase()) {
        const next = params.get("next") || "/admin/dashboard";
        router.replace(next);
      }
    });
    // Surface error reasons from redirects (unauthorized/auth/timeout)
    const err = params.get("error");
    if (err && !error) {
      const map: Record<string, string> = {
        unauthorized: "You are not authorized to access that page.",
        auth: "Authentication is required. Please sign in.",
        timeout: "Session check timed out. Please sign in again.",
      };
      setError(map[err] ?? "Please sign in to continue.");
    }
  }, [router, params, error]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmed = email.trim().toLowerCase();
    if (trimmed !== ALLOWED_EMAIL.toLowerCase()) {
      setError("This account is not authorized.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
      if (error) throw error;
      if (!data.session) throw new Error("Login failed. No session returned.");
      // Ensure the session is persisted before navigating, to avoid guard races
      let attempts = 0;
      while (attempts < 20) { // up to ~2s
        const { data: s } = await supabase.auth.getSession();
        if (s.session) break;
        await new Promise((r) => setTimeout(r, 100));
        attempts++;
      }
      const next = params.get("next") || "/admin/dashboard";
      router.replace(next);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to sign in.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gray-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-600 via-purple-600 to-fuchsia-600" />
          <h1 className="text-lg font-semibold text-gray-900">Admin Login</h1>
          <p className="mt-1 text-sm text-gray-600">Sign in with the authorized email and password.</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              required
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Your password"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
