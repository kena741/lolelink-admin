-- Schema relation audit for public tables.
-- Run in Supabase SQL editor. Review in order:
--   1) existing foreign keys
--   2) expected relations with no FK defined
--   3) orphan row counts (data violates logical relation even if FK missing)
--   4) duplicate/redundant FK constraints

-- =============================================================================
-- 1) Existing foreign keys (public schema)
-- =============================================================================
SELECT
    tc.table_name AS child_table,
    kcu.column_name AS child_column,
    ccu.table_name AS parent_table,
    ccu.column_name AS parent_column,
    tc.constraint_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_schema = kcu.constraint_schema
    AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_schema = tc.constraint_schema
    AND ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name, tc.constraint_name;

-- =============================================================================
-- 2) Expected logical relations with NO matching FK in the database
-- =============================================================================
WITH expected (
    child_table,
    child_column,
    parent_table,
    parent_column,
    note
) AS (
    VALUES
        ('handyman', 'provider_id', 'provider', 'id', 'handyman belongs to provider'),
        ('handyman', 'categoryId', 'category', 'id', 'camelCase column'),
        ('handyman', 'subCategoryId', 'sub_category', 'id', 'camelCase column'),
        ('page_views', 'provider_id', 'provider', 'id', 'analytics page views'),
        ('opportunities', 'customer_id', 'customer', 'id', 'CRM opportunity customer'),
        ('opportunities', 'provider_id', 'provider', 'id', 'CRM opportunity owner'),
        ('verify_documents', 'documentId', 'documents', 'id', 'documentId is text; documents.id is uuid'),
        ('withdrawal_history', 'providerId', 'provider', 'id', 'payout / withdrawal requests'),
        ('notification', 'customer_id', 'customer', 'id', 'admin notification feed'),
        ('notification', 'provider_id', 'provider', 'id', 'admin notification feed'),
        ('notification', 'handyman_id', 'handyman', 'id', 'admin notification feed'),
        ('notification', 'sender_id', 'auth.users', 'id', 'sender auth user'),
        ('booked_service', 'payment_id', 'payments', 'id', 'booking payment link'),
        ('customers_service', 'customer_id', 'customer', 'id', 'legacy customer services'),
        ('service', 'categoryId', 'category', 'id', 'service category'),
        ('service', 'subCategoryId', 'sub_category', 'id', 'service subcategory'),
        ('provider_availability_weekly', 'paw_id', 'provider', 'id', 'unclear legacy link'),
        ('service_tier_payment', 'provider_id', 'provider', 'id', 'provider_id column is text, not uuid')
),
existing AS (
    SELECT
        cl.relname AS child_table,
        a.attname AS child_column,
        pcl.relname AS parent_table,
        af.attname AS parent_column
    FROM pg_constraint c
    JOIN pg_class cl ON cl.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = cl.relnamespace
    JOIN pg_class pcl ON pcl.oid = c.confrelid
    JOIN pg_namespace pn ON pn.oid = pcl.relnamespace
    JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord) ON true
    JOIN LATERAL unnest(c.confkey) WITH ORDINALITY AS fk(attnum, ord) ON ck.ord = fk.ord
    JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ck.attnum
    JOIN pg_attribute af ON af.attrelid = pcl.oid AND af.attnum = fk.attnum
    WHERE c.contype = 'f'
        AND n.nspname = 'public'
)
SELECT
    e.child_table,
    e.child_column,
    e.parent_table,
    e.parent_column,
    e.note
FROM expected e
LEFT JOIN existing x
    ON x.child_table = e.child_table
    AND lower(x.child_column) = lower(e.child_column)
    AND x.parent_table = e.parent_table
    AND lower(x.parent_column) = lower(e.parent_column)
WHERE x.child_table IS NULL
ORDER BY e.child_table, e.child_column;

-- =============================================================================
-- 3) Orphan counts — non-null child keys with no matching parent row
-- =============================================================================
SELECT *
FROM (
    SELECT 'handyman.provider_id -> provider.id' AS relation, COUNT(*) AS orphan_count
    FROM public.handyman h
    LEFT JOIN public.provider p ON p.id = h.provider_id
    WHERE h.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'page_views.provider_id -> provider.id', COUNT(*)
    FROM public.page_views pv
    LEFT JOIN public.provider p ON p.id = pv.provider_id
    WHERE pv.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'opportunities.customer_id -> customer.id', COUNT(*)
    FROM public.opportunities o
    LEFT JOIN public.customer c ON c.id = o.customer_id
    WHERE o.customer_id IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'opportunities.provider_id -> provider.id', COUNT(*)
    FROM public.opportunities o
    LEFT JOIN public.provider p ON p.id = o.provider_id
    WHERE o.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'opportunities.company_id -> companies.id', COUNT(*)
    FROM public.opportunities o
    LEFT JOIN public.companies co ON co.id = o.company_id
    WHERE o.company_id IS NOT NULL AND co.id IS NULL

    UNION ALL
    SELECT 'verify_documents.providerId -> provider.id', COUNT(*)
    FROM public.verify_documents vd
    LEFT JOIN public.provider p ON p.id = vd."providerId"
    WHERE vd."providerId" IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'verify_documents.documentId -> documents.id', COUNT(*)
    FROM public.verify_documents vd
    LEFT JOIN public.documents d ON d.id::text = vd."documentId"
    WHERE coalesce(vd."documentId", '') <> '' AND d.id IS NULL

    UNION ALL
    SELECT 'withdrawal_history.providerId -> provider.id', COUNT(*)
    FROM public.withdrawal_history w
    LEFT JOIN public.provider p ON p.id = w."providerId"
    WHERE w."providerId" IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'notification.booking_id -> booked_service.id', COUNT(*)
    FROM public.notification n
    LEFT JOIN public.booked_service bs ON bs.id = n.booking_id
    WHERE n.booking_id IS NOT NULL AND bs.id IS NULL

    UNION ALL
    SELECT 'notification.customer_id -> customer.id', COUNT(*)
    FROM public.notification n
    LEFT JOIN public.customer c ON c.id = n.customer_id
    WHERE n.customer_id IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'notification.provider_id -> provider.id', COUNT(*)
    FROM public.notification n
    LEFT JOIN public.provider p ON p.id = n.provider_id
    WHERE n.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'notification.handyman_id -> handyman.id', COUNT(*)
    FROM public.notification n
    LEFT JOIN public.handyman h ON h.id = n.handyman_id
    WHERE n.handyman_id IS NOT NULL AND h.id IS NULL

    UNION ALL
    SELECT 'booked_service.provider_id -> provider.id', COUNT(*)
    FROM public.booked_service bs
    LEFT JOIN public.provider p ON p.id = bs.provider_id
    WHERE bs.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'booked_service.customer_id -> customer.id', COUNT(*)
    FROM public.booked_service bs
    LEFT JOIN public.customer c ON c.id = bs.customer_id
    WHERE bs.customer_id IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'booked_service.service_id -> service.id', COUNT(*)
    FROM public.booked_service bs
    LEFT JOIN public.service s ON s.id = bs.service_id
    WHERE bs.service_id IS NOT NULL AND s.id IS NULL

    UNION ALL
    SELECT 'booked_service.handyman_id -> handyman.id', COUNT(*)
    FROM public.booked_service bs
    LEFT JOIN public.handyman h ON h.id = bs.handyman_id
    WHERE bs.handyman_id IS NOT NULL AND h.id IS NULL

    UNION ALL
    SELECT 'booked_service.payment_id -> payments.id', COUNT(*)
    FROM public.booked_service bs
    LEFT JOIN public.payments pay ON pay.id = bs.payment_id
    WHERE bs.payment_id IS NOT NULL AND pay.id IS NULL

    UNION ALL
    SELECT 'booked_service.provider_user_id -> auth.users.id', COUNT(*)
    FROM public.booked_service bs
    LEFT JOIN auth.users u ON u.id = bs.provider_user_id
    WHERE bs.provider_user_id IS NOT NULL AND u.id IS NULL

    UNION ALL
    SELECT 'booked_service.customer_user_id -> auth.users.id', COUNT(*)
    FROM public.booked_service bs
    LEFT JOIN auth.users u ON u.id = bs.customer_user_id
    WHERE bs.customer_user_id IS NOT NULL AND u.id IS NULL

    UNION ALL
    SELECT 'service.provider_id -> provider.id', COUNT(*)
    FROM public.service s
    LEFT JOIN public.provider p ON p.id = s.provider_id
    WHERE s.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'service.categoryId -> category.id', COUNT(*)
    FROM public.service s
    LEFT JOIN public.category c ON c.id = s."categoryId"
    WHERE s."categoryId" IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'service.subCategoryId -> sub_category.id', COUNT(*)
    FROM public.service s
    LEFT JOIN public.sub_category sc ON sc.id = s."subCategoryId"
    WHERE s."subCategoryId" IS NOT NULL AND sc.id IS NULL

    UNION ALL
    SELECT 'sub_category.categoryId -> category.id', COUNT(*)
    FROM public.sub_category sc
    LEFT JOIN public.category c ON c.id = sc."categoryId"
    WHERE sc."categoryId" IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'sub_category_documents.subCategoryId -> sub_category.id', COUNT(*)
    FROM public.sub_category_documents scd
    LEFT JOIN public.sub_category sc ON sc.id = scd."subCategoryId"
    WHERE scd."subCategoryId" IS NOT NULL AND sc.id IS NULL

    UNION ALL
    SELECT 'sub_category_documents.documentId -> documents.id', COUNT(*)
    FROM public.sub_category_documents scd
    LEFT JOIN public.documents d ON d.id = scd."documentId"
    WHERE scd."documentId" IS NOT NULL AND d.id IS NULL

    UNION ALL
    SELECT 'job_request.providerId -> provider.id', COUNT(*)
    FROM public.job_request jr
    LEFT JOIN public.provider p ON p.id = jr."providerId"
    WHERE jr."providerId" IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'job_request.customerId -> customer.id', COUNT(*)
    FROM public.job_request jr
    LEFT JOIN public.customer c ON c.id = jr."customerId"
    WHERE jr."customerId" IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'job_request.serviceId -> service.id', COUNT(*)
    FROM public.job_request jr
    LEFT JOIN public.service s ON s.id = jr."serviceId"
    WHERE jr."serviceId" IS NOT NULL AND s.id IS NULL

    UNION ALL
    SELECT 'wallet_transaction.provider_id -> provider.id', COUNT(*)
    FROM public.wallet_transaction wt
    LEFT JOIN public.provider p ON p.id = wt.provider_id
    WHERE wt.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'wallet_transaction.customer_id -> customer.id', COUNT(*)
    FROM public.wallet_transaction wt
    LEFT JOIN public.customer c ON c.id = wt.customer_id
    WHERE wt.customer_id IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'wallet_transaction.userId -> auth.users.id', COUNT(*)
    FROM public.wallet_transaction wt
    LEFT JOIN auth.users u ON u.id = wt."userId"
    WHERE wt."userId" IS NOT NULL AND u.id IS NULL

    UNION ALL
    SELECT 'provider.user_id -> auth.users.id', COUNT(*)
    FROM public.provider p
    LEFT JOIN auth.users u ON u.id = p.user_id
    WHERE p.user_id IS NOT NULL AND u.id IS NULL

    UNION ALL
    SELECT 'customer.user_id -> auth.users.id', COUNT(*)
    FROM public.customer c
    LEFT JOIN auth.users u ON u.id = c.user_id
    WHERE c.user_id IS NOT NULL AND u.id IS NULL

    UNION ALL
    SELECT 'handyman.user_id -> auth.users.id', COUNT(*)
    FROM public.handyman h
    LEFT JOIN auth.users u ON u.id = h.user_id
    WHERE h.user_id IS NOT NULL AND u.id IS NULL

    UNION ALL
    SELECT 'payments.booking_id -> booked_service.id', COUNT(*)
    FROM public.payments pay
    LEFT JOIN public.booked_service bs ON bs.id = pay.booking_id
    WHERE pay.booking_id IS NOT NULL AND bs.id IS NULL

    UNION ALL
    SELECT 'payments.customer_id -> customer.id', COUNT(*)
    FROM public.payments pay
    LEFT JOIN public.customer c ON c.id = pay.customer_id
    WHERE pay.customer_id IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'provider_customer.provider_id -> provider.id', COUNT(*)
    FROM public.provider_customer pc
    LEFT JOIN public.provider p ON p.id = pc.provider_id
    WHERE pc.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'provider_customer.customer_id -> customer.id', COUNT(*)
    FROM public.provider_customer pc
    LEFT JOIN public.customer c ON c.id = pc.customer_id
    WHERE pc.customer_id IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'review_customer.customerId -> customer.id', COUNT(*)
    FROM public.review_customer rc
    LEFT JOIN public.customer c ON c.id = rc."customerId"
    WHERE rc."customerId" IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'review_customer.serviceId -> service.id', COUNT(*)
    FROM public.review_customer rc
    LEFT JOIN public.service s ON s.id = rc."serviceId"
    WHERE rc."serviceId" IS NOT NULL AND s.id IS NULL

    UNION ALL
    SELECT 'review_customer.bookingId -> booked_service.id', COUNT(*)
    FROM public.review_customer rc
    LEFT JOIN public.booked_service bs ON bs.id = rc."bookingId"
    WHERE rc."bookingId" IS NOT NULL AND bs.id IS NULL

    UNION ALL
    SELECT 'companies.provider_id -> provider.id', COUNT(*)
    FROM public.companies co
    LEFT JOIN public.provider p ON p.id = co.provider_id
    WHERE co.provider_id IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'bank_details.providerID -> provider.id', COUNT(*)
    FROM public.bank_details bd
    LEFT JOIN public.provider p ON p.id = bd."providerID"
    WHERE bd."providerID" IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'provider_payment_methods.providerID -> provider.id', COUNT(*)
    FROM public.provider_payment_methods ppm
    LEFT JOIN public.provider p ON p.id = ppm."providerID"
    WHERE ppm."providerID" IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'customers_service.customer_id -> customer.id', COUNT(*)
    FROM public.customers_service cs
    LEFT JOIN public.customer c ON c.id = cs.customer_id
    WHERE cs.customer_id IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'notifications.providerId -> provider.id', COUNT(*)
    FROM public.notifications n
    LEFT JOIN public.provider p ON p.id = n."providerId"
    WHERE n."providerId" IS NOT NULL AND p.id IS NULL

    UNION ALL
    SELECT 'notifications.customerId -> customer.id', COUNT(*)
    FROM public.notifications n
    LEFT JOIN public.customer c ON c.id = n."customerId"
    WHERE n."customerId" IS NOT NULL AND c.id IS NULL

    UNION ALL
    SELECT 'notifications.handymanId -> handyman.id', COUNT(*)
    FROM public.notifications n
    LEFT JOIN public.handyman h ON h.id = n."handymanId"
    WHERE n."handymanId" IS NOT NULL AND h.id IS NULL

    UNION ALL
    SELECT 'notifications.senderId -> auth.users.id', COUNT(*)
    FROM public.notifications n
    LEFT JOIN auth.users u ON u.id = n."senderId"
    WHERE n."senderId" IS NOT NULL AND u.id IS NULL

    UNION ALL
    SELECT 'admin.user_id -> auth.users.id', COUNT(*)
    FROM public.admin a
    LEFT JOIN auth.users u ON u.id = a.user_id
    WHERE a.user_id IS NOT NULL AND u.id IS NULL

    UNION ALL
    SELECT 'admin_activity_log.admin_id -> admin.id', COUNT(*)
    FROM public.admin_activity_log al
    LEFT JOIN public.admin a ON a.id = al.admin_id
    WHERE al.admin_id IS NOT NULL AND a.id IS NULL
) orphans
WHERE orphan_count > 0
ORDER BY orphan_count DESC, relation;

-- =============================================================================
-- 4) Duplicate FK constraints on the same child column
-- =============================================================================
SELECT
    cl.relname AS child_table,
    a.attname AS child_column,
    pcl.relname AS parent_table,
    COUNT(*) AS fk_constraint_count,
    array_agg(c.conname ORDER BY c.conname) AS constraint_names
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_namespace n ON n.oid = cl.relnamespace
JOIN pg_class pcl ON pcl.oid = c.confrelid
JOIN LATERAL unnest(c.conkey) AS ck(attnum) ON true
JOIN pg_attribute a ON a.attrelid = cl.oid AND a.attnum = ck.attnum
WHERE c.contype = 'f'
    AND n.nspname = 'public'
GROUP BY cl.relname, a.attname, pcl.relname
HAVING COUNT(*) > 1
ORDER BY child_table, child_column;
