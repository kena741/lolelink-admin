'use client';

import { useEffect, useState } from 'react';
import { Loader2, StickyNote } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface AdminNoteFieldProps {
    value?: string | null;
    onSave: (note: string) => Promise<void>;
    disabled?: boolean;
    className?: string;
    /** icon = button (detail); text = truncated cell (tables) */
    display?: 'icon' | 'text';
}

export function AdminNoteField({
    value,
    onSave,
    disabled,
    className,
    display = 'icon',
}: AdminNoteFieldProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState(value ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const note = (value ?? '').trim();
    const hasNote = Boolean(note);

    useEffect(() => {
        if (open) {
            setDraft(value ?? '');
            setError(null);
        }
    }, [open, value]);

    const dirty = draft !== (value ?? '');

    function handleClose() {
        if (saving) return;
        setOpen(false);
    }

    async function handleSave() {
        if (disabled || saving || !dirty) return;
        setSaving(true);
        setError(null);
        try {
            await onSave(draft.trim());
            setOpen(false);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to save note');
        } finally {
            setSaving(false);
        }
    }

    const trigger =
        display === 'text' ? (
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled && !hasNote}
                title={hasNote ? note : disabled ? 'No admin note' : 'Add admin note'}
                aria-label={hasNote ? (disabled ? 'View admin note' : 'Edit admin note') : 'Add admin note'}
                className={cn(
                    'max-w-48 truncate text-left text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    hasNote
                        ? 'text-foreground hover:text-primary hover:underline'
                        : 'text-muted-foreground hover:text-foreground',
                    className
                )}
            >
                {hasNote ? note : '—'}
            </button>
        ) : (
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled && !hasNote}
                title={hasNote ? (disabled ? 'View admin note' : 'View admin note') : 'Add admin note'}
                aria-label={hasNote ? (disabled ? 'View admin note' : 'View admin note') : 'Add admin note'}
                className={cn(
                    'inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-40',
                    hasNote
                        ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                        : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground',
                    className
                )}
            >
                <StickyNote className="h-4 w-4" />
            </button>
        );

    return (
        <>
            {trigger}

            <Dialog open={open} onClose={handleClose}>
                <DialogHeader>
                    <DialogTitle>Admin note</DialogTitle>
                </DialogHeader>
                <DialogDescription>Internal only — not shown to the user.</DialogDescription>
                <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={disabled || saving}
                    rows={5}
                    autoFocus
                    placeholder="Add a note…"
                    className="mt-3 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
                />
                {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
                <DialogFooter>
                    <button
                        type="button"
                        onClick={handleClose}
                        disabled={saving}
                        className="inline-flex h-9 items-center rounded-md border border-border bg-card px-3 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => void handleSave()}
                        disabled={disabled || saving || !dirty}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Save
                    </button>
                </DialogFooter>
            </Dialog>
        </>
    );
}
