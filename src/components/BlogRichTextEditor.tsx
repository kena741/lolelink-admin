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
    Table as TableIcon,
    Plus,
    Trash2,
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

function getClosestElement(node: Node | null, tagName: string): HTMLElement | null {
    let current: Node | null = node;
    while (current) {
        if (current.nodeType === Node.ELEMENT_NODE) {
            const el = current as HTMLElement;
            if (el.tagName.toLowerCase() === tagName.toLowerCase()) return el;
        }
        current = current.parentNode;
    }
    return null;
}

function getSelectionTableContext(editor: HTMLElement | null) {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editor) return null;
    const node = selection.anchorNode;
    if (!node || !editor.contains(node)) return null;
    const cell = getClosestElement(node, 'td') || getClosestElement(node, 'th');
    if (!cell) return null;
    const row = getClosestElement(cell, 'tr');
    const table = getClosestElement(cell, 'table');
    if (!row || !table || !editor.contains(table)) return null;
    return { cell, row, table };
}

function removeTable(table: HTMLElement) {
    const wrap = table.closest('.blog-table-wrap');
    if (wrap) wrap.remove();
    else table.remove();
}

function buildTableHtml(rows: number, cols: number): string {
    const safeRows = Math.max(2, Math.min(rows, 8));
    const safeCols = Math.max(1, Math.min(cols, 8));
    const headerCells = Array.from({ length: safeCols }, () => `<th><br></th>`).join('');
    const bodyRowCount = Math.max(safeRows - 1, 1);
    const bodyRows = Array.from({ length: bodyRowCount }, () => {
        const cells = Array.from({ length: safeCols }, () => `<td><br></td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    return (
        `<div class="blog-table-wrap">` +
        `<table class="blog-table">` +
        `<thead><tr>${headerCells}</tr></thead>` +
        `<tbody>${bodyRows}</tbody>` +
        `</table>` +
        `</div>` +
        `<p><br></p>`
    );
}

export default function BlogRichTextEditor({ value, onChange, placeholder }: Props) {
    const editorRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const tableMenuRef = useRef<HTMLDivElement>(null);
    const [uploading, setUploading] = useState(false);
    const [tableMenuOpen, setTableMenuOpen] = useState(false);
    const [hoverSize, setHoverSize] = useState({ rows: 3, cols: 3 });
    const [inTable, setInTable] = useState(false);
    const syncing = useRef(false);

    useEffect(() => {
        const el = editorRef.current;
        if (!el || syncing.current) return;
        if (el.innerHTML !== (value || '')) {
            el.innerHTML = value || '';
        }
    }, [value]);

    useEffect(() => {
        if (!tableMenuOpen) return;
        const onPointerDown = (event: MouseEvent) => {
            if (!tableMenuRef.current?.contains(event.target as Node)) {
                setTableMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [tableMenuOpen]);

    const emit = () => {
        const el = editorRef.current;
        if (!el) return;
        syncing.current = true;
        onChange(el.innerHTML);
        queueMicrotask(() => {
            syncing.current = false;
        });
        setInTable(Boolean(getSelectionTableContext(el)));
    };

    const refreshTableState = () => {
        setInTable(Boolean(getSelectionTableContext(editorRef.current)));
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

    const insertTable = (rows: number, cols: number) => {
        editorRef.current?.focus();
        exec('insertHTML', buildTableHtml(rows, cols));
        setTableMenuOpen(false);
        emit();
    };

    const addRow = (position: 'above' | 'below') => {
        const ctx = getSelectionTableContext(editorRef.current);
        if (!ctx) return;
        const colCount = ctx.row.children.length || 1;
        const newRow = document.createElement('tr');
        for (let i = 0; i < colCount; i += 1) {
            const td = document.createElement('td');
            td.innerHTML = '<br>';
            newRow.appendChild(td);
        }
        if (position === 'above') {
            ctx.row.parentElement?.insertBefore(newRow, ctx.row);
        } else {
            ctx.row.parentElement?.insertBefore(newRow, ctx.row.nextSibling);
        }
        emit();
    };

    const addColumn = (position: 'left' | 'right') => {
        const ctx = getSelectionTableContext(editorRef.current);
        if (!ctx) return;
        const cellIndex = Array.from(ctx.row.children).indexOf(ctx.cell);
        if (cellIndex < 0) return;
        const rows = Array.from(ctx.table.querySelectorAll('tr'));
        rows.forEach((row) => {
            const refCell = row.children[cellIndex] as HTMLElement | undefined;
            const isHeaderRow = Boolean(row.closest('thead'));
            const cell = document.createElement(isHeaderRow ? 'th' : 'td');
            cell.innerHTML = '<br>';
            if (!refCell) {
                row.appendChild(cell);
                return;
            }
            if (position === 'left') {
                row.insertBefore(cell, refCell);
            } else {
                row.insertBefore(cell, refCell.nextSibling);
            }
        });
        emit();
    };

    const deleteRow = () => {
        const ctx = getSelectionTableContext(editorRef.current);
        if (!ctx) return;
        const allRows = ctx.table.querySelectorAll('tr');
        if (allRows.length <= 1) {
            removeTable(ctx.table);
        } else {
            ctx.row.remove();
        }
        emit();
        refreshTableState();
    };

    const deleteColumn = () => {
        const ctx = getSelectionTableContext(editorRef.current);
        if (!ctx) return;
        const cellIndex = Array.from(ctx.row.children).indexOf(ctx.cell);
        if (cellIndex < 0) return;
        const rows = Array.from(ctx.table.querySelectorAll('tr'));
        if ((rows[0]?.children.length || 0) <= 1) {
            removeTable(ctx.table);
            emit();
            refreshTableState();
            return;
        }
        rows.forEach((row) => {
            row.children[cellIndex]?.remove();
        });
        emit();
        refreshTableState();
    };

    const deleteTable = () => {
        const ctx = getSelectionTableContext(editorRef.current);
        if (!ctx) return;
        removeTable(ctx.table);
        emit();
        refreshTableState();
    };

    const btn =
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40';
    const menuBtn =
        'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100';

    return (
        <div className="rounded-lg border border-gray-300 bg-white">
            <div className="sticky top-[4.75rem] z-20 flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50/95 px-2 py-1.5 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:bg-gray-50/90">
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

                <div className="relative" ref={tableMenuRef}>
                    <button
                        type="button"
                        className={btn}
                        title="Insert table"
                        onMouseDown={(e) => {
                            e.preventDefault();
                            setHoverSize({ rows: 3, cols: 3 });
                            setTableMenuOpen((open) => !open);
                        }}
                    >
                        <TableIcon className="h-3.5 w-3.5" />
                    </button>
                    {tableMenuOpen ? (
                        <div className="absolute left-0 top-full z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
                            <p className="mb-2 text-xs font-medium text-gray-600">
                                {hoverSize.rows} × {hoverSize.cols} table
                            </p>
                            <div
                                className="grid gap-1"
                                style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}
                                onMouseLeave={() => setHoverSize({ rows: 3, cols: 3 })}
                            >
                                {Array.from({ length: 8 * 8 }, (_, index) => {
                                    const row = Math.floor(index / 8) + 1;
                                    const col = (index % 8) + 1;
                                    const active = row <= hoverSize.rows && col <= hoverSize.cols;
                                    return (
                                        <button
                                            key={`${row}-${col}`}
                                            type="button"
                                            className={`h-4 w-4 rounded-[2px] border ${
                                                active
                                                    ? 'border-primary bg-primary/20'
                                                    : 'border-gray-200 bg-white'
                                            }`}
                                            onMouseEnter={() => setHoverSize({ rows: row, cols: col })}
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                insertTable(row, col);
                                            }}
                                            aria-label={`Insert ${row} by ${col} table`}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ) : null}
                </div>

                <button type="button" className={btn} title="Undo" onMouseDown={(e) => { e.preventDefault(); exec('undo'); emit(); }}>
                    <Undo2 className="h-3.5 w-3.5" />
                </button>
                <button type="button" className={btn} title="Redo" onMouseDown={(e) => { e.preventDefault(); exec('redo'); emit(); }}>
                    <Redo2 className="h-3.5 w-3.5" />
                </button>
                {uploading ? (
                    <span className="ml-2 text-xs text-gray-500">Uploading…</span>
                ) : null}
            </div>

            {inTable ? (
                <div className="flex flex-wrap items-center gap-1 border-b border-gray-200 bg-white px-2 py-1.5">
                    <span className="mr-1 text-xs font-medium text-gray-500">Table</span>
                    <button type="button" className={menuBtn} onMouseDown={(e) => { e.preventDefault(); addRow('above'); }}>
                        <Plus className="h-3 w-3" /> Row above
                    </button>
                    <button type="button" className={menuBtn} onMouseDown={(e) => { e.preventDefault(); addRow('below'); }}>
                        <Plus className="h-3 w-3" /> Row below
                    </button>
                    <button type="button" className={menuBtn} onMouseDown={(e) => { e.preventDefault(); addColumn('left'); }}>
                        <Plus className="h-3 w-3" /> Col left
                    </button>
                    <button type="button" className={menuBtn} onMouseDown={(e) => { e.preventDefault(); addColumn('right'); }}>
                        <Plus className="h-3 w-3" /> Col right
                    </button>
                    <button type="button" className={menuBtn} onMouseDown={(e) => { e.preventDefault(); deleteRow(); }}>
                        <Trash2 className="h-3 w-3" /> Delete row
                    </button>
                    <button type="button" className={menuBtn} onMouseDown={(e) => { e.preventDefault(); deleteColumn(); }}>
                        <Trash2 className="h-3 w-3" /> Delete col
                    </button>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        onMouseDown={(e) => { e.preventDefault(); deleteTable(); }}
                    >
                        <Trash2 className="h-3 w-3" /> Delete table
                    </button>
                </div>
            ) : null}

            <div
                ref={editorRef}
                contentEditable
                role="textbox"
                aria-multiline
                suppressContentEditableWarning
                data-placeholder={placeholder || 'Write your post…'}
                className="blog-admin-editor min-h-[280px] px-4 py-3 text-sm leading-relaxed text-gray-900 outline-none empty:before:pointer-events-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
                onInput={emit}
                onBlur={emit}
                onClick={refreshTableState}
                onKeyUp={refreshTableState}
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
                .blog-admin-editor .blog-table-wrap { margin: 1rem 0; overflow-x: auto; }
                .blog-admin-editor table.blog-table,
                .blog-admin-editor table {
                    width: 100%;
                    border-collapse: collapse;
                    table-layout: fixed;
                    font-size: 0.875rem;
                    margin: 0;
                }
                .blog-admin-editor table.blog-table th,
                .blog-admin-editor table.blog-table td,
                .blog-admin-editor table th,
                .blog-admin-editor table td {
                    border: 1px solid #d1d5db;
                    padding: 0.55rem 0.7rem;
                    vertical-align: top;
                    word-break: break-word;
                    min-width: 3rem;
                }
                .blog-admin-editor table.blog-table th,
                .blog-admin-editor table th {
                    background: #f9fafb;
                    font-weight: 600;
                    text-align: left;
                    color: #111827;
                }
                .blog-admin-editor table.blog-table td:focus,
                .blog-admin-editor table.blog-table th:focus,
                .blog-admin-editor table td:focus,
                .blog-admin-editor table th:focus {
                    outline: 2px solid hsl(var(--primary));
                    outline-offset: -2px;
                }
            `}</style>
        </div>
    );
}
