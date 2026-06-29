-- Orphan checks before adding FKs on service, booked_service, customers_service, verify_documents.
-- Does not modify data.

SELECT 'service.categoryId -> category.id' AS relation, COUNT(*) AS orphan_count
FROM public.service s
LEFT JOIN public.category c ON c.id = s."categoryId"
WHERE s."categoryId" IS NOT NULL AND c.id IS NULL

UNION ALL

SELECT 'service.subCategoryId -> sub_category.id', COUNT(*)
FROM public.service s
LEFT JOIN public.sub_category sc ON sc.id = s."subCategoryId"
WHERE s."subCategoryId" IS NOT NULL AND sc.id IS NULL

UNION ALL

SELECT 'booked_service.payment_id -> payments.id', COUNT(*)
FROM public.booked_service bs
LEFT JOIN public.payments p ON p.id = bs.payment_id
WHERE bs.payment_id IS NOT NULL AND p.id IS NULL

UNION ALL

SELECT 'customers_service.customer_id -> customer.id', COUNT(*)
FROM public.customers_service cs
LEFT JOIN public.customer c ON c.id = cs.customer_id
WHERE cs.customer_id IS NOT NULL AND c.id IS NULL

UNION ALL

SELECT 'verify_documents.documentId -> documents.id', COUNT(*)
FROM public.verify_documents vd
LEFT JOIN public.documents d ON d.id::text = vd."documentId"
WHERE coalesce(vd."documentId", '') <> '' AND d.id IS NULL

ORDER BY orphan_count DESC, relation;

-- verify_documents: values that are not valid uuid text (block type migration)
SELECT id, "documentId"
FROM public.verify_documents
WHERE coalesce("documentId", '') <> ''
  AND "documentId" !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

-- Sample customers_service orphans
SELECT cs.id, cs.customer_id, cs.created_at
FROM public.customers_service cs
LEFT JOIN public.customer c ON c.id = cs.customer_id
WHERE cs.customer_id IS NOT NULL AND c.id IS NULL
ORDER BY cs.created_at DESC NULLS LAST;
