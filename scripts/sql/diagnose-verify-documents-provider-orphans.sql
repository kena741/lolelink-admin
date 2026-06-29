-- Rows in verify_documents whose providerId does not match provider.id.
-- Should return no rows before running add-verify-documents-provider-fkey.sql.
SELECT
    vd.id,
    vd."providerId",
    vd."providerName",
    vd."providerEmail",
    vd."documentId",
    vd."isVerify",
    vd."createdAt"
FROM public.verify_documents vd
LEFT JOIN public.provider p ON p.id = vd."providerId"
WHERE p.id IS NULL
ORDER BY vd."createdAt" DESC NULLS LAST;
