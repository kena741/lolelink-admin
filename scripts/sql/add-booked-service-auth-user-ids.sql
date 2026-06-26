ALTER TABLE public.booked_service
    ADD COLUMN IF NOT EXISTS provider_user_id uuid,
    ADD COLUMN IF NOT EXISTS customer_user_id uuid;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'booked_service_provider_user_id_fkey'
    ) THEN
        ALTER TABLE public.booked_service
            ADD CONSTRAINT booked_service_provider_user_id_fkey
            FOREIGN KEY (provider_user_id) REFERENCES auth.users(id);
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'booked_service_customer_user_id_fkey'
    ) THEN
        ALTER TABLE public.booked_service
            ADD CONSTRAINT booked_service_customer_user_id_fkey
            FOREIGN KEY (customer_user_id) REFERENCES auth.users(id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS booked_service_provider_user_id_idx
    ON public.booked_service (provider_user_id);

CREATE INDEX IF NOT EXISTS booked_service_customer_user_id_idx
    ON public.booked_service (customer_user_id);

COMMENT ON COLUMN public.booked_service.provider_user_id IS
    'Denormalized auth.users.id from provider.user_id at booking time.';

COMMENT ON COLUMN public.booked_service.customer_user_id IS
    'Denormalized auth.users.id from customer.user_id at booking time.';

UPDATE public.booked_service bs
SET provider_user_id = p.user_id
FROM public.provider p
WHERE p.id = bs.provider_id
  AND bs.provider_user_id IS DISTINCT FROM p.user_id;

UPDATE public.booked_service bs
SET customer_user_id = c.user_id
FROM public.customer c
WHERE c.id = bs.customer_id
  AND c.user_id IS NOT NULL
  AND bs.customer_user_id IS DISTINCT FROM c.user_id;
