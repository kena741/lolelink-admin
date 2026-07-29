"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getSupabase } from "@/lib/supabaseClient";
import { DEFAULT_ADMIN_ROLES, hasPermission } from "@/lib/admin-permissions";
import { canAccessAdminRoute } from "@/hooks/use-admin-permissions";

async function getAuthenticatedUser() {
    const { data: sess } = await getSupabase().auth.getSession();
    if (sess.session?.user) return sess.session.user;
    await new Promise((r) => setTimeout(r, 150));
    const { data: retry } = await getSupabase().auth.getSession();
    return retry.session?.user ?? null;
}

export default function AuthGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [checking, setChecking] = useState(true);
    const didNavigate = useRef(false);

    useEffect(() => {
        let mounted = true;
        const check = async () => {
            try {
                const user = await getAuthenticatedUser();
                if (!user) {
                    await getSupabase().auth.signOut();
                    if (mounted && !didNavigate.current) {
                        didNavigate.current = true;
                        router.replace("/login?error=auth&next=" + encodeURIComponent(pathname || "/admin/dashboard"));
                    }
                    return;
                }
                const { data: adminRow } = await getSupabase()
                    .from("admin")
                    .select("id, role, is_active")
                    .eq("user_id", user.id)
                    .maybeSingle();
                if (!adminRow || !adminRow.is_active) {
                    if (mounted && !didNavigate.current) {
                        didNavigate.current = true;
                        router.replace("/login?error=forbidden");
                    }
                    return;
                }
                const { data: roleRow } = await getSupabase()
                    .from("admin_role")
                    .select("permissions")
                    .eq("slug", adminRow.role as string)
                    .maybeSingle();
                const permissions =
                    Array.isArray((roleRow as { permissions?: string[] } | null)?.permissions)
                        ? [...((roleRow as { permissions?: string[] }).permissions ?? [])]
                        : [...(DEFAULT_ADMIN_ROLES.find((role) => role.slug === adminRow.role)?.permissions ?? [])];
                const can = (permission: string) => hasPermission(permissions, permission);
                const routePath = pathname || "/admin/dashboard";
                if (!canAccessAdminRoute(routePath, can)) {
                    if (mounted && !didNavigate.current) {
                        didNavigate.current = true;
                        router.replace("/admin/dashboard?error=forbidden");
                    }
                    return;
                }
                if (mounted) setChecking(false);
            } catch {
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

        const { data: sub } = getSupabase().auth.onAuthStateChange(() => {
            check();
        });
        return () => {
            mounted = false;
            sub?.subscription?.unsubscribe();
        };
    }, [router, pathname]);

    useEffect(() => {
        if (!checking || didNavigate.current) return;
        const t = setTimeout(async () => {
            if (didNavigate.current) return;
            const { data: sessionData } = await getSupabase().auth.getSession();
            if (sessionData.session?.user) return;
            didNavigate.current = true;
            router.replace(
                "/login?error=timeout&next=" + encodeURIComponent(pathname || "/admin/dashboard")
            );
        }, 20000);
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
