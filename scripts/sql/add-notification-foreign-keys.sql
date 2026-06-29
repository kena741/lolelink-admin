-- Add missing FKs on public.notification (singular).
-- Does not delete rows. Uses NOT VALID for columns that still have orphan references.

CREATE INDEX IF NOT EXISTS notification_customer_id_idx
    ON public.notification (customer_id);

CREATE INDEX IF NOT EXISTS notification_provider_id_idx
    ON public.notification (provider_id);

CREATE INDEX IF NOT EXISTS notification_handyman_id_idx
    ON public.notification (handyman_id);

CREATE INDEX IF NOT EXISTS notification_sender_id_idx
    ON public.notification (sender_id);

DO $$
DECLARE
    customer_orphan_count integer;
    provider_orphan_count integer;
    handyman_orphan_count integer;
    sender_orphan_count integer;
BEGIN
    SELECT COUNT(*) INTO customer_orphan_count
    FROM public.notification n
    LEFT JOIN public.customer c ON c.id = n.customer_id
    WHERE n.customer_id IS NOT NULL AND c.id IS NULL;

    SELECT COUNT(*) INTO provider_orphan_count
    FROM public.notification n
    LEFT JOIN public.provider p ON p.id = n.provider_id
    WHERE n.provider_id IS NOT NULL AND p.id IS NULL;

    SELECT COUNT(*) INTO handyman_orphan_count
    FROM public.notification n
    LEFT JOIN public.handyman h ON h.id = n.handyman_id
    WHERE n.handyman_id IS NOT NULL AND h.id IS NULL;

    SELECT COUNT(*) INTO sender_orphan_count
    FROM public.notification n
    LEFT JOIN auth.users u ON u.id = n.sender_id
    WHERE n.sender_id IS NOT NULL AND u.id IS NULL;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notification_customer_id_fkey'
    ) THEN
        IF customer_orphan_count > 0 THEN
            RAISE NOTICE 'notification_customer_id_fkey NOT VALID (% orphan row(s))', customer_orphan_count;
            ALTER TABLE public.notification
                ADD CONSTRAINT notification_customer_id_fkey
                FOREIGN KEY (customer_id) REFERENCES public.customer (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.notification
                ADD CONSTRAINT notification_customer_id_fkey
                FOREIGN KEY (customer_id) REFERENCES public.customer (id);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname IN (
            'notification_provider_id_fkey',
            'notification_providerid_fkey'
        )
    ) THEN
        IF provider_orphan_count > 0 THEN
            RAISE NOTICE 'notification_provider_id_fkey NOT VALID (% orphan row(s))', provider_orphan_count;
            ALTER TABLE public.notification
                ADD CONSTRAINT notification_provider_id_fkey
                FOREIGN KEY (provider_id) REFERENCES public.provider (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.notification
                ADD CONSTRAINT notification_provider_id_fkey
                FOREIGN KEY (provider_id) REFERENCES public.provider (id);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notification_handyman_id_fkey'
    ) THEN
        IF handyman_orphan_count > 0 THEN
            RAISE NOTICE 'notification_handyman_id_fkey NOT VALID (% orphan row(s))', handyman_orphan_count;
            ALTER TABLE public.notification
                ADD CONSTRAINT notification_handyman_id_fkey
                FOREIGN KEY (handyman_id) REFERENCES public.handyman (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.notification
                ADD CONSTRAINT notification_handyman_id_fkey
                FOREIGN KEY (handyman_id) REFERENCES public.handyman (id);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'notification_sender_id_fkey'
    ) THEN
        IF sender_orphan_count > 0 THEN
            RAISE NOTICE 'notification_sender_id_fkey NOT VALID (% orphan row(s))', sender_orphan_count;
            ALTER TABLE public.notification
                ADD CONSTRAINT notification_sender_id_fkey
                FOREIGN KEY (sender_id) REFERENCES auth.users (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.notification
                ADD CONSTRAINT notification_sender_id_fkey
                FOREIGN KEY (sender_id) REFERENCES auth.users (id);
        END IF;
    END IF;
END $$;

-- After orphans are resolved, fully enforce each constraint:
-- Option A: keep historical provider_id on orphan rows — leave NOT VALID as-is.
-- Option B: run fix-notification-provider-orphans-null.sql, then:
-- ALTER TABLE public.notification VALIDATE CONSTRAINT notification_provider_id_fkey;
