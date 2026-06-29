-- Add FKs on service, booked_service, customers_service, verify_documents.
-- Does not delete rows. Uses NOT VALID when orphan references exist.

CREATE INDEX IF NOT EXISTS service_category_id_idx
    ON public.service ("categoryId");

CREATE INDEX IF NOT EXISTS service_sub_category_id_idx
    ON public.service ("subCategoryId");

CREATE INDEX IF NOT EXISTS booked_service_payment_id_idx
    ON public.booked_service (payment_id);

CREATE INDEX IF NOT EXISTS customers_service_customer_id_idx
    ON public.customers_service (customer_id);

CREATE INDEX IF NOT EXISTS verify_documents_document_id_idx
    ON public.verify_documents ("documentId");

DO $$
DECLARE
    category_orphan_count integer;
    sub_category_orphan_count integer;
    payment_orphan_count integer;
    customers_service_orphan_count integer;
    document_orphan_count integer;
    invalid_document_id_count integer;
    document_id_type text;
BEGIN
    SELECT COUNT(*) INTO category_orphan_count
    FROM public.service s
    LEFT JOIN public.category c ON c.id = s."categoryId"
    WHERE s."categoryId" IS NOT NULL AND c.id IS NULL;

    SELECT COUNT(*) INTO sub_category_orphan_count
    FROM public.service s
    LEFT JOIN public.sub_category sc ON sc.id = s."subCategoryId"
    WHERE s."subCategoryId" IS NOT NULL AND sc.id IS NULL;

    SELECT COUNT(*) INTO payment_orphan_count
    FROM public.booked_service bs
    LEFT JOIN public.payments p ON p.id = bs.payment_id
    WHERE bs.payment_id IS NOT NULL AND p.id IS NULL;

    SELECT COUNT(*) INTO customers_service_orphan_count
    FROM public.customers_service cs
    LEFT JOIN public.customer c ON c.id = cs.customer_id
    WHERE cs.customer_id IS NOT NULL AND c.id IS NULL;

    SELECT COUNT(*) INTO document_orphan_count
    FROM public.verify_documents vd
    LEFT JOIN public.documents d ON d.id::text = vd."documentId"
    WHERE coalesce(vd."documentId", '') <> '' AND d.id IS NULL;

    SELECT COUNT(*) INTO invalid_document_id_count
    FROM public.verify_documents
    WHERE coalesce("documentId", '') <> ''
      AND "documentId" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname IN ('service_categoryId_fkey', 'service_categoryid_fkey')
    ) THEN
        IF category_orphan_count > 0 THEN
            RAISE NOTICE 'service_categoryId_fkey NOT VALID (% orphan row(s))', category_orphan_count;
            ALTER TABLE public.service
                ADD CONSTRAINT service_categoryId_fkey
                FOREIGN KEY ("categoryId") REFERENCES public.category (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.service
                ADD CONSTRAINT service_categoryId_fkey
                FOREIGN KEY ("categoryId") REFERENCES public.category (id);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname IN ('service_subCategoryId_fkey', 'service_subcategoryid_fkey')
    ) THEN
        IF sub_category_orphan_count > 0 THEN
            RAISE NOTICE 'service_subCategoryId_fkey NOT VALID (% orphan row(s))', sub_category_orphan_count;
            ALTER TABLE public.service
                ADD CONSTRAINT service_subCategoryId_fkey
                FOREIGN KEY ("subCategoryId") REFERENCES public.sub_category (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.service
                ADD CONSTRAINT service_subCategoryId_fkey
                FOREIGN KEY ("subCategoryId") REFERENCES public.sub_category (id);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname IN ('booked_service_payment_id_fkey', 'booked_service_payment_id_fkey1')
    ) THEN
        IF payment_orphan_count > 0 THEN
            RAISE NOTICE 'booked_service_payment_id_fkey NOT VALID (% orphan row(s))', payment_orphan_count;
            ALTER TABLE public.booked_service
                ADD CONSTRAINT booked_service_payment_id_fkey
                FOREIGN KEY (payment_id) REFERENCES public.payments (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.booked_service
                ADD CONSTRAINT booked_service_payment_id_fkey
                FOREIGN KEY (payment_id) REFERENCES public.payments (id);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname IN ('customers_service_customer_id_fkey', 'customers_service_customerid_fkey')
    ) THEN
        IF customers_service_orphan_count > 0 THEN
            RAISE NOTICE 'customers_service_customer_id_fkey NOT VALID (% orphan row(s))', customers_service_orphan_count;
            ALTER TABLE public.customers_service
                ADD CONSTRAINT customers_service_customer_id_fkey
                FOREIGN KEY (customer_id) REFERENCES public.customer (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.customers_service
                ADD CONSTRAINT customers_service_customer_id_fkey
                FOREIGN KEY (customer_id) REFERENCES public.customer (id);
        END IF;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname IN ('verify_documents_documentId_fkey', 'verify_documents_documentid_fkey')
    ) THEN
        IF invalid_document_id_count > 0 THEN
            RAISE EXCEPTION
                'verify_documents.documentId has % non-uuid value(s); fix before adding FK',
                invalid_document_id_count;
        END IF;

        SELECT atttypid::regtype::text
        INTO document_id_type
        FROM pg_attribute
        WHERE attrelid = 'public.verify_documents'::regclass
          AND attname = 'documentId'
          AND NOT attisdropped;

        IF document_id_type IS DISTINCT FROM 'uuid' THEN
            RAISE NOTICE 'Casting verify_documents.documentId from % to uuid (no row deletion)', document_id_type;
            ALTER TABLE public.verify_documents
                ALTER COLUMN "documentId" TYPE uuid USING "documentId"::uuid;
        END IF;

        IF document_orphan_count > 0 THEN
            RAISE NOTICE 'verify_documents_documentId_fkey NOT VALID (% orphan row(s))', document_orphan_count;
            ALTER TABLE public.verify_documents
                ADD CONSTRAINT verify_documents_documentId_fkey
                FOREIGN KEY ("documentId") REFERENCES public.documents (id)
                NOT VALID;
        ELSE
            ALTER TABLE public.verify_documents
                ADD CONSTRAINT verify_documents_documentId_fkey
                FOREIGN KEY ("documentId") REFERENCES public.documents (id);
        END IF;
    END IF;
END $$;

-- Optional later, after orphans resolved:
-- ALTER TABLE public.customers_service VALIDATE CONSTRAINT customers_service_customer_id_fkey;
-- ALTER TABLE public.verify_documents VALIDATE CONSTRAINT verify_documents_documentId_fkey;
