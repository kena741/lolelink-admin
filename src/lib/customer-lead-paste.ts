/**
 * Parse bulk-paste lead blocks for admin "Add leads".
 *
 * Template (repeat with a blank line between blocks):
 *   Full name:
 *   Phone:
 *   Source/inquiry channel:
 *   Location:
 *   Description:
 */

export const CUSTOMER_LEAD_PASTE_TEMPLATE = `Full name:
Phone:
Source/inquiry channel:
Location:
Description:
`;

export type ParsedCustomerLead = {
    first_name: string;
    last_name: string | null;
    phone: string;
    signup_source: string | null;
    address: string | null;
    admin_note: string | null;
};

export type CustomerLeadParseError = {
    index: number;
    message: string;
    raw: string;
};

export type CustomerLeadParseResult = {
    leads: ParsedCustomerLead[];
    errors: CustomerLeadParseError[];
};

const LABELS = [
    'full name',
    'phone',
    'source/inquiry channel',
    'source',
    'inquiry channel',
    'location',
    'description',
] as const;

function normalizeLabel(line: string): string | null {
    const trimmed = line.trim();
    const match = /^([^:]+):\s*(.*)$/i.exec(trimmed);
    if (!match) return null;
    const label = match[1].trim().toLowerCase().replace(/\s+/g, ' ');
    if ((LABELS as readonly string[]).includes(label)) return label;
    return null;
}

/** First token → first_name; remaining tokens → last_name. */
export function splitFullName(fullName: string): { first_name: string; last_name: string | null } {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { first_name: '', last_name: null };
    if (parts.length === 1) return { first_name: parts[0], last_name: null };
    return {
        first_name: parts[0],
        last_name: parts.slice(1).join(' '),
    };
}

function splitBlocks(text: string): string[] {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const byBlank = normalized
        .split(/\n\s*\n+/)
        .map((block) => block.trim())
        .filter(Boolean);
    if (byBlank.length > 1) return byBlank;

    const lines = normalized.split('\n');
    const blocks: string[] = [];
    let current: string[] = [];
    for (const line of lines) {
        const label = normalizeLabel(line);
        if (label === 'full name' && current.length > 0) {
            blocks.push(current.join('\n').trim());
            current = [line];
            continue;
        }
        current.push(line);
    }
    if (current.length) blocks.push(current.join('\n').trim());
    return blocks.filter(Boolean);
}

function parseBlock(raw: string, index: number): ParsedCustomerLead | CustomerLeadParseError {
    const lines = raw.replace(/\r\n/g, '\n').split('\n');
    const fields: Record<string, string> = {};
    let active: string | null = null;

    for (const line of lines) {
        const label = normalizeLabel(line);
        if (label) {
            active = label === 'source' || label === 'inquiry channel' ? 'source/inquiry channel' : label;
            fields[active] = line.includes(':') ? line.slice(line.indexOf(':') + 1).trim() : '';
            continue;
        }
        if (active) {
            fields[active] = [fields[active], line.trim()].filter(Boolean).join('\n');
        }
    }

    const fullName = (fields['full name'] ?? '').trim();
    const phone = (fields.phone ?? '').trim();
    const channel = (fields['source/inquiry channel'] ?? '').trim();
    const location = (fields.location ?? '').trim();
    const description = (fields.description ?? '').trim();

    if (!fullName && !phone && !channel && !location && !description) {
        return { index, message: 'Empty block', raw };
    }
    if (!fullName) return { index, message: 'Full name is required', raw };
    if (!phone) return { index, message: 'Phone is required', raw };

    const { first_name, last_name } = splitFullName(fullName);
    if (!first_name) return { index, message: 'Full name is required', raw };

    return {
        first_name,
        last_name,
        phone,
        signup_source: channel || null,
        address: location || null,
        admin_note: description || null,
    };
}

export function parseCustomerLeadPaste(text: string): CustomerLeadParseResult {
    const blocks = splitBlocks(text);
    const leads: ParsedCustomerLead[] = [];
    const errors: CustomerLeadParseError[] = [];

    blocks.forEach((block, index) => {
        const parsed = parseBlock(block, index);
        if ('message' in parsed) errors.push(parsed);
        else leads.push(parsed);
    });

    return { leads, errors };
}
