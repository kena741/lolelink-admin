-- Add FK: verify_documents."providerId" -> provider.id
-- Safe to run when diagnose-verify-documents-provider-orphans.sql returns no rows.

CREATE INDEX IF NOT EXISTS verify_documents_provider_id_idx
    ON public.verify_documents ("providerId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname IN (
            'verify_documents_providerId_fkey',
            'verify_documents_providerid_fkey'
        )
    ) THEN
        ALTER TABLE public.verify_documents
            ADD CONSTRAINT verify_documents_providerId_fkey
            FOREIGN KEY ("providerId") REFERENCES public.provider (id);
    END IF;
END $$;

COMMENT ON CONSTRAINT verify_documents_providerid_fkey ON public.verify_documents IS
    'Ensures each verification document belongs to an existing provider.';
