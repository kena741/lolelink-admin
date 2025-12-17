'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Eye, Check, X, Code } from 'lucide-react';

interface HTMLEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
}

// Simple HTML syntax highlighter
const highlightHTML = (code: string): string => {
    return code
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/&lt;(\/?)([a-zA-Z][a-zA-Z0-9]*)([^&]*?)&gt;/g, (match, closing, tag, attrs) => {
            const tagClass = closing ? 'text-purple-600' : 'text-blue-600';
            const attrMatch = attrs.replace(/(\w+)=(["'])(.*?)\2/g, '<span class="text-orange-600">$1</span>=$2<span class="text-green-600">$3</span>$2');
            return `<span class="${tagClass}">&lt;${closing}<span class="font-semibold">${tag}</span>${attrMatch}&gt;</span>`;
        })
        .replace(/&lt;!--(.*?)--&gt;/g, '<span class="text-gray-500 italic">&lt;!--$1--&gt;</span>');
};

const HTMLEditor: React.FC<HTMLEditorProps> = ({ value, onChange, placeholder, label }) => {
    const [isPreview, setIsPreview] = useState(false);
    const [isReviewing, setIsReviewing] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [htmlCode, setHtmlCode] = useState(value || '');
    const [lineNumbers, setLineNumbers] = useState<string[]>([]);
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const fullscreenTextareaRef = useRef<HTMLTextAreaElement>(null);
    const fullscreenHighlightRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setHtmlCode(value || '');
    }, [value]);

    useEffect(() => {
        const lines = htmlCode.split('\n');
        setLineNumbers(lines.map((_, i) => String(i + 1)));
    }, [htmlCode]);

    const handleHtmlChange = (newHtml: string) => {
        setHtmlCode(newHtml);
        onChange(newHtml);
    };

    const handleFullscreenScroll = () => {
        if (fullscreenTextareaRef.current && fullscreenHighlightRef.current) {
            fullscreenHighlightRef.current.scrollTop = fullscreenTextareaRef.current.scrollTop;
            fullscreenHighlightRef.current.scrollLeft = fullscreenTextareaRef.current.scrollLeft;
        }
    };



    return (
        <div className="space-y-2">
            {label && (
                <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-gray-700">{label}</label>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setIsReviewing(!isReviewing)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isReviewing
                                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {isReviewing ? <Check className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {isReviewing ? 'Reviewing' : 'Review'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsPreview(!isPreview)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                isPreview
                                    ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {isPreview ? <Code className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                            {isPreview ? 'Edit HTML' : 'Preview'}
                        </button>
                    </div>
                </div>
            )}

            {isPreview ? (
                <div className="min-h-[400px] w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 overflow-y-auto">
                    <div 
                        className="prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: htmlCode || '<p class="text-gray-400">No content</p>' }}
                    />
                </div>
            ) : (
                <div 
                    ref={editorContainerRef}
                    className="border border-gray-300 rounded-lg bg-[#1e1e1e] overflow-hidden flex flex-col cursor-pointer hover:border-gray-400 transition-colors"
                    style={{ height: '120px', minHeight: '120px' }}
                    onClick={() => setIsFullscreen(true)}
                >
                    {/* VS Code-like header */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-[#252526] border-b border-[#3e3e42] flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsFullscreen(true);
                                }}
                                className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff6f66] transition-colors"
                            />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsFullscreen(true);
                                }}
                                className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffcd3e] transition-colors"
                            />
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsFullscreen(true);
                                }}
                                className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#37d94f] transition-colors"
                            />
                        </div>
                        <div className="flex-1 flex items-center justify-center">
                            <Code className="h-3 w-3 text-gray-400 mr-2" />
                            <span className="text-xs font-medium text-gray-400">HTML</span>
                        </div>
                    </div>
                    
                    {/* Minimal preview */}
                    <div className="flex-1 overflow-hidden p-3">
                        <div className="text-xs text-gray-500 font-mono line-clamp-3">
                            {htmlCode || placeholder || 'Click to edit HTML...'}
                        </div>
                    </div>
                </div>
            )}

            {/* Fullscreen VS Code Editor Modal */}
            {isFullscreen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div 
                        className="relative bg-[#1e1e1e] rounded-lg shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* VS Code-like header */}
                        <div className="flex items-center gap-2 px-4 py-3 bg-[#252526] border-b border-[#3e3e42] flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsFullscreen(false)}
                                    className="w-3 h-3 rounded-full bg-[#ff5f56] hover:bg-[#ff6f66] transition-colors"
                                />
                                <button
                                    onClick={() => setIsFullscreen(false)}
                                    className="w-3 h-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffcd3e] transition-colors"
                                />
                                <button
                                    onClick={() => setIsFullscreen(false)}
                                    className="w-3 h-3 rounded-full bg-[#27c93f] hover:bg-[#37d94f] transition-colors"
                                />
                            </div>
                            <div className="flex-1 flex items-center justify-center">
                                <Code className="h-4 w-4 text-gray-400 mr-2" />
                                <span className="text-sm font-medium text-gray-400">HTML Editor</span>
                            </div>
                            <button
                                onClick={() => setIsFullscreen(false)}
                                className="p-2 hover:bg-[#2d2d30] rounded transition-colors"
                            >
                                <X className="h-4 w-4 text-gray-400" />
                            </button>
                        </div>
                        
                        {/* Editor with line numbers */}
                        <div className="relative flex flex-1 overflow-hidden">
                            {/* Line numbers */}
                            <div className="bg-[#1e1e1e] text-gray-500 text-xs font-mono py-3 px-4 text-right select-none border-r border-[#3e3e42] overflow-y-auto flex-shrink-0" style={{ minWidth: '60px' }}>
                                {lineNumbers.map((num, idx) => (
                                    <div key={idx} className="leading-6">{num}</div>
                                ))}
                            </div>
                            
                            {/* Code editor */}
                            <div className="flex-1 relative overflow-hidden">
                                {/* Syntax highlighted background */}
                                <div
                                    ref={fullscreenHighlightRef}
                                    className="absolute inset-0 overflow-auto font-mono text-sm leading-6 py-3 px-4 pointer-events-none"
                                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                    dangerouslySetInnerHTML={{ __html: highlightHTML(htmlCode) || '<span class="text-gray-500">' + (placeholder || 'Enter HTML code...') + '</span>' }}
                                />
                                
                                {/* Textarea overlay */}
                                <textarea
                                    ref={fullscreenTextareaRef}
                                    value={htmlCode}
                                    onChange={(e) => handleHtmlChange(e.target.value)}
                                    onScroll={handleFullscreenScroll}
                                    className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-white font-mono text-sm leading-6 py-3 px-4 resize-none focus:outline-none overflow-auto"
                                    placeholder={placeholder || 'Enter HTML code...'}
                                    spellCheck={false}
                                    style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                    autoFocus
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Review Modal */}
            {isReviewing && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                            <h3 className="text-xl font-bold text-gray-900">Review Content</h3>
                            <button
                                onClick={() => setIsReviewing(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="h-5 w-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div 
                                className="prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: htmlCode || '<p class="text-gray-400">No content</p>' }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <style jsx global>{`
                .prose {
                    color: #374151;
                }
                .prose p {
                    margin-top: 1em;
                    margin-bottom: 1em;
                }
                .prose ul, .prose ol {
                    margin-top: 1em;
                    margin-bottom: 1em;
                    padding-left: 1.625em;
                }
                .prose ul {
                    list-style-type: disc;
                }
                .prose ol {
                    list-style-type: decimal;
                }
                .prose strong {
                    font-weight: 600;
                }
                .prose em {
                    font-style: italic;
                }
                .prose u {
                    text-decoration: underline;
                }
                .prose h1, .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
                    font-weight: 600;
                    margin-top: 1.5em;
                    margin-bottom: 0.5em;
                }
                .prose h1 { font-size: 2em; }
                .prose h2 { font-size: 1.5em; }
                .prose h3 { font-size: 1.25em; }
            `}</style>
        </div>
    );
};

export default HTMLEditor;

