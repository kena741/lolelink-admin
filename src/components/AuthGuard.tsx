"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ALLOWED_EMAIL } from "@/lib/authConfig";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const didNavigate = useRef(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        // Use local session first (fast, avoids network on cold start)
        const { data: sess } = await supabase.auth.getSession();
        const email = sess.session?.user?.email;
        if (!email) {
          // Transient race after login: wait briefly and re-check once
          await new Promise((r) => setTimeout(r, 150));
          const { data: retry } = await supabase.auth.getSession();
          const again = retry.session?.user?.email;
          if (!again) {
            await supabase.auth.signOut();
            if (mounted && !didNavigate.current) {
              didNavigate.current = true;
              router.replace("/login?error=auth&next=" + encodeURIComponent(pathname || "/admin/dashboard"));
            }
            return;
          }
        }
        // If there is a session, validate email
        const ok = !!email && email.toLowerCase() === ALLOWED_EMAIL.toLowerCase();
        if (!ok) {
          // If not allowed, ensure signed out and go to login
          await supabase.auth.signOut();
          if (mounted && !didNavigate.current) {
            didNavigate.current = true;
            router.replace(
              "/login?error=unauthorized&next=" + encodeURIComponent(pathname || "/admin/dashboard")
            );
          }
        } else {
          // Authorized: stop checking immediately and render children
          if (mounted) setChecking(false);
          return;
        }
      } catch {
        // If anything fails (e.g., env or client), push to login
        if (mounted && !didNavigate.current) {
          didNavigate.current = true;
          router.replace(
            "/login?error=auth&next=" + encodeURIComponent(pathname || "/admin/dashboard")
          );
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };
    check();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      // Re-run check on auth changes
      check();
    });
    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [router, pathname]);

  // Fallback: if for any reason checking lingers, force redirect after 6s
  useEffect(() => {
    if (!checking || didNavigate.current) return;
    const t = setTimeout(() => {
      if (!didNavigate.current) {
        didNavigate.current = true;
        router.replace(
          "/login?error=timeout&next=" + encodeURIComponent(pathname || "/admin/dashboard")
        );
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [checking, router, pathname]);

  if (checking) {
    return (
      <div className="ml-64 grid min-h-screen w-full place-items-center bg-gray-50">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
          Checking access…
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
