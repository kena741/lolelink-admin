'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';

interface AdminNavContextValue {
    open: boolean;
    setOpen: (open: boolean) => void;
    toggle: () => void;
}

const AdminNavContext = createContext<AdminNavContextValue | null>(null);

export function AdminNavProvider({ children }: { children: ReactNode }) {
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    useEffect(() => {
        setOpen(false);
    }, [pathname]);

    useEffect(() => {
        if (!open) return;
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') setOpen(false);
        };
        window.addEventListener('keydown', onKeyDown);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const toggle = useCallback(() => {
        setOpen((value) => !value);
    }, []);

    const value = useMemo(
        () => ({ open, setOpen, toggle }),
        [open, toggle]
    );

    return <AdminNavContext.Provider value={value}>{children}</AdminNavContext.Provider>;
}

export function useAdminNav(): AdminNavContextValue {
    const ctx = useContext(AdminNavContext);
    if (!ctx) {
        return {
            open: false,
            setOpen: () => undefined,
            toggle: () => undefined,
        };
    }
    return ctx;
}
