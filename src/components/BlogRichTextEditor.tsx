'use client';
import React, { useEffect, useRef, useState } from 'react';
import {
    Bold,
    Italic,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Link as LinkIcon,
    Image as ImageIcon,
    Undo2,
    Redo2,
} from 'lucide-react';
import { uploadFilesToSupabase } from '@/lib/upload';

type Props = {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
};

function exec(command: string, value?: string) {
    document.execCommand(command, false, value);
}

export default function BlogRichTextEditor({ value, onChange, placeholder }: Props) {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const syncing = useRef(false);

    useEffect(() => {
        const el = editorRef.current;
        if (!el || syncing.current) return;
        if (el.innerHTML !== (value || '')) {
            el.innerHTML = value || '';
        }
    }, [value]);

    const emit = () => {
        const el = editorRef.current;
        if (!el) return;
        syncing.current = true;
        onChange(el.innerHTML);
        queueMicrotask(() => {
            syncing.current = false;
        });
    };

    const wrapLink = () => {
        const url = window.prompt('Link URL');
        if (!url) return;
        exec('createLink', url);
        emit();
    };

    const insertImage = async (file: File) => {
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }
        setUploading(true);
        try {
            const urls = await uploadFilesToSupabase([file], 'blog');
            const url = urls[0];
            if (!url) throw new Error('Upload failed');
            editorRef.current?.focus();
            exec('insertHTML', `<img src="${url}" alt="" />`);
            emit();
        } catch (err) {
            console.error(err);
            alert('Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const btn =
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground';

    return (
        <div className="overflow-hidden rounded-lg border border-input bg-card">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-2 py-1.5">
                <button type="button" className={btn} title="Bold" onMouseDown={(e) => { e.preventDefault(); exec('bold'); emit(); }}>
                    <Bold className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Italic" onMouseDown={(e) => { e.preventDefault(); exec('italic'); emit(); }}>
                    <Italic className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Heading" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'h2'); emit(); }}>
                    <Heading2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Subheading" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'h3'); emit(); }}>
                    <Heading3 className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Bullet list" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); emit(); }}>
                    <List className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Numbered list" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); emit(); }}>
                    <ListOrdered className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Link" onMouseDown={(e) => { e.preventDefault(); wrapLink(); }}>
                    <LinkIcon className="h-3.5 w-3.5" />
                </button>
                <button
                    type="button"
                    className={btn}
                    title="Insert image"
                    disabled={uploading}
                    onMouseDown={(e) => {
                        e.preventDefault();
                        fileInputRef.current?.click();
                    }}
                >
                    <ImageIcon className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Undo" onMouseDown={(e) => { e.preventDefault(); exec('undo'); emit(); }}>
                    <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Redo" onMouseDown={(e) => { e.preventDefault(); exec('redo'); emit(); }}>
                    <Redo2 className="h-3.5 w-3.5" />
                </button>
                {uploading ? (
                    <span className="ml-2 text-xs text-muted-foreground">Uploading…</span>
                ) : null}
            </div>
            <div
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-multiline
                suppressContentEditableWarning
                data-placeholder={placeholder || 'Write your post…'}
                className="blog-admin-editor min-h-[280px] px-4 py-3 text-sm leading-relaxed text-foreground outline-none empty:before:pointer-events-none empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
                onInput={emit}
                onBlur={emit}
            />
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void insertImage(file);
                }}
            />
            <style jsx global>{`
                .blog-admin-editor h2 { font-size: 1.35rem; font-weight: 600; margin: 0.9em 0 0.4em; }
                .blog-admin-editor h3 { font-size: 1.15rem; font-weight: 600; margin: 0.8em 0 0.35em; }
                .blog-admin-editor p { margin: 0.55em 0; }
                .blog-admin-editor ul { list-style: disc; padding-left: 1.4em; margin: 0.55em 0; }
                .blog-admin-editor ol { list-style: decimal; padding-left: 1.4em; margin: 0.55em 0; }
                .blog-admin-editor img { max-width: 100%; height: auto; margin: 0.75em 0; border-radius: 0.5rem; }
                .blog-admin-editor a { color: hsl(var(--primary)); text-decoration: underline; }
            `}</style>
        </div>
    );
}
