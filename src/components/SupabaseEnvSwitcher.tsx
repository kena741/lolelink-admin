"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabaseClient";
import {
    getClientSupabaseTarget,
    isEnvSwitcherEnabled,
    isStagingConfigured,
    setClientSupabaseTarget,
    type SupabaseTarget,
} from "@/lib/supabase-env";

function targetLabel(target: SupabaseTarget): string {
    return target === "staging" ? "Staging" : "Prod";
}

export function SupabaseEnvSwitcher({ compact = false }: { compact?: boolean }) {
    const [active] = useState<SupabaseTarget>(() => getClientSupabaseTarget());
    const [isSwitching, setIsSwitching] = useState(false);

    if (!isEnvSwitcherEnabled()) return null;

    async function switchTo(next: SupabaseTarget) {
        if (next === active || isSwitching) return;
        const confirmed = window.confirm(
            "Switch Supabase environment? You will be signed out and the page will reload."
        );
        if (!confirmed) return;

        setIsSwitching(true);
        try {
            await getSupabase().auth.signOut();
        } catch {
        }
        setClientSupabaseTarget(next);
        window.location.reload();
    }

    const targets: SupabaseTarget[] = ["prod", "staging"];

    return (
        <div className={compact ? "mb-2 space-y-1" : "space-y-2 px-3 py-2"}>
            {!compact ? (
                <p className="text-[12px] font-medium text-muted-foreground">Supabase</p>
            ) : null}
            <div
                className="flex rounded-md border border-gray-200 bg-gray-50 p-0.5"
                role="group"
                aria-label="Supabase environment"
            >
                {targets.map((target) => {
                    const isActive = active === target;
                    const isDisabled = target === "staging" && !isStagingConfigured();
                    return (
                        <button
                            key={target}
                            type="button"
                            disabled={isSwitching || isDisabled}
                            onClick={() => switchTo(target)}
                            className={`flex-1 rounded-[6px] px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                                isActive
                                    ? "bg-white text-gray-900 shadow-sm"
                                    : "text-gray-500 hover:text-gray-900"
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                        >
                            {targetLabel(target)}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function SupabaseStagingBanner() {
    if (getClientSupabaseTarget() !== "staging") return null;

    return (
        <div
            className="mx-3 mb-2 rounded-md border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-center text-[12px] font-bold tracking-wide text-amber-200"
            role="status"
        >
            STAGING
        </div>
    );
}
