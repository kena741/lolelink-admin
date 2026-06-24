import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
    CLIENT_ACTIVITY_LOG_SLICES,
    SERVER_ACTIVITY_LOG_ROUTES,
    type HttpMethod,
} from '@/lib/activity-log-coverage.manifest';

const ROOT = path.resolve(__dirname, '../../..');

function readSource(relativePath: string): string {
    return readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function extractNamedFunctionBlock(source: string, name: string): string {
    const pattern = new RegExp(`(?:async\\s+)?function ${name}\\([\\s\\S]*?\\)\\s*\\{`);
    const match = pattern.exec(source);
    if (!match || match.index === undefined) return '';

    const startBrace = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = startBrace; i < source.length; i += 1) {
        const char = source[i];
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(match.index, i + 1);
            }
        }
    }
    return '';
}

function extractHandlerBlock(source: string, method: HttpMethod): string {
    const pattern = new RegExp(`export async function ${method}\\([\\s\\S]*?\\)\\s*\\{`);
    const match = pattern.exec(source);
    if (!match || match.index === undefined) return '';

    const startBrace = match.index + match[0].length - 1;
    let depth = 0;
    for (let i = startBrace; i < source.length; i += 1) {
        const char = source[i];
        if (char === '{') depth += 1;
        else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return source.slice(match.index, i + 1);
            }
        }
    }
    return '';
}

function handlerLogsActivity(source: string, handler: string, helpers: string[] = []): boolean {
    if (/logAdminActivity\s*\(/.test(handler)) return true;
    return helpers.some((helper) => /logAdminActivity\s*\(/.test(extractNamedFunctionBlock(source, helper)));
}

describe('activity log coverage manifest', () => {
    it('server routes import and call logAdminActivity in mutation handlers', () => {
        for (const entry of SERVER_ACTIVITY_LOG_ROUTES) {
            const source = readSource(entry.file);
            expect(source, `${entry.file} should import logAdminActivity`).toMatch(
                /logAdminActivity/
            );

            for (const method of entry.methods) {
                const handler = extractHandlerBlock(source, method);
                expect(handler.length, `${entry.file} ${method} handler exists`).toBeGreaterThan(0);
                expect(
                    handlerLogsActivity(source, handler, entry.loggingHelpers),
                    `${entry.file} ${method} should call logAdminActivity`
                ).toBe(true);
            }
        }
    });

    it('client slices import and call logClientAdminActivity in mutation thunks', () => {
        for (const entry of CLIENT_ACTIVITY_LOG_SLICES) {
            const source = readSource(entry.file);
            expect(source, `${entry.file} should import logClientAdminActivity`).toMatch(
                /logClientAdminActivity/
            );

            for (const thunkName of entry.thunkNames) {
                const thunkPattern = new RegExp(
                    `['"][^'"]*\\/${thunkName}['"][\\s\\S]*?logClientAdminActivity\\s*\\(`,
                    'm'
                );
                expect(
                    source,
                    `${entry.file} ${thunkName} should call logClientAdminActivity`
                ).toMatch(thunkPattern);
            }
        }
    });
});
