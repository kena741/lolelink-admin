-- Optional: keep notification rows, clear provider_id only where provider no longer exists.
-- Does not delete any notification rows.

UPDATE public.notification n
SET provider_id = NULL
WHERE n.provider_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM public.provider p WHERE p.id = n.provider_id
  );

-- Re-check (should return 0 orphan_count)
SELECT COUNT(*) AS orphan_count
FROM public.notification n
LEFT JOIN public.provider p ON p.id = n.provider_id
WHERE n.provider_id IS NOT NULL AND p.id IS NULL;

-- After orphan_count is 0, fully enforce provider FK if it was added NOT VALID:
-- ALTER TABLE public.notification VALIDATE CONSTRAINT notification_provider_id_fkey;
