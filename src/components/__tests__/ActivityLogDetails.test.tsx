import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ActivityLogDetails } from '@/components/ActivityLogDetails';

describe('ActivityLogDetails', () => {
    it('renders before/after table when changes include before values', () => {
        render(
            <ActivityLogDetails
                metadata={{
                    changes: [{ field: 'name', before: 'Old', after: 'New' }],
                }}
                resourceId="cat-1"
            />
        );

        expect(screen.getByText('Changed fields')).toBeInTheDocument();
        expect(screen.getByText('Before')).toBeInTheDocument();
        expect(screen.getByText('After')).toBeInTheDocument();
        expect(screen.getByText('Old')).toBeInTheDocument();
        expect(screen.getByText('New')).toBeInTheDocument();
        expect(screen.getByText('cat-1')).toBeInTheDocument();
    });

    it('renders legacy flat metadata as additional details', () => {
        render(
            <ActivityLogDetails
                metadata={{
                    role: 'editor',
                    full_name: 'Jane Doe',
                }}
            />
        );

        expect(screen.getByText('Additional details')).toBeInTheDocument();
        expect(screen.getByText('editor')).toBeInTheDocument();
        expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    });

    it('shows legacy warning for change rows without before values', () => {
        render(
            <ActivityLogDetails
                metadata={{
                    changes: [{ field: 'role', after: 'editor' }],
                }}
            />
        );

        expect(screen.getByText('Fields in update request')).toBeInTheDocument();
        expect(
            screen.getByText(/older log did not store the previous values/i)
        ).toBeInTheDocument();
    });

    it('renders additional info rows for reserved metadata', () => {
        render(
            <ActivityLogDetails
                metadata={{
                    changes: [{ field: 'name', before: 'A', after: 'B' }],
                    provider_id: 'prov-99',
                }}
            />
        );

        expect(screen.getByText('Additional details')).toBeInTheDocument();
        expect(screen.getByText('prov-99')).toBeInTheDocument();
    });

    it('shows empty state when no details recorded', () => {
        render(<ActivityLogDetails metadata={{}} />);
        expect(screen.getByText(/No extra details were recorded/i)).toBeInTheDocument();
    });
});
