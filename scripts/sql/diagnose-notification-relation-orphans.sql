-- Orphan rows in public.notification (singular admin notification table).
-- Orphans are kept; use NOT VALID when adding FK if any exist.

SELECT 'notification.customer_id -> customer.id' AS relation, COUNT(*) AS orphan_count
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

SELECT 'notification.sender_id -> auth.users.id', COUNT(*)
FROM public.notification n
LEFT JOIN auth.users u ON u.id = n.sender_id
WHERE n.sender_id IS NOT NULL AND u.id IS NULL

UNION ALL

SELECT 'notification.booking_id -> booked_service.id', COUNT(*)
FROM public.notification n
LEFT JOIN public.booked_service bs ON bs.id = n.booking_id
WHERE n.booking_id IS NOT NULL AND bs.id IS NULL

ORDER BY orphan_count DESC, relation;

-- Sample orphan rows (if any)
SELECT
    n.id,
    n.created_at,
    n.title,
    n.type,
    n.booking_id,
    n.customer_id,
    n.provider_id,
    n.handyman_id,
    n.sender_id
FROM public.notification n
LEFT JOIN public.provider p ON p.id = n.provider_id
WHERE n.provider_id IS NOT NULL AND p.id IS NULL

UNION ALL

SELECT
    n.id,
    n.created_at,
    n.title,
    n.type,
    n.booking_id,
    n.customer_id,
    n.provider_id,
    n.handyman_id,
    n.sender_id
FROM public.notification n
LEFT JOIN public.customer c ON c.id = n.customer_id
WHERE n.customer_id IS NOT NULL AND c.id IS NULL

UNION ALL

SELECT
    n.id,
    n.created_at,
    n.title,
    n.type,
    n.booking_id,
    n.customer_id,
    n.provider_id,
    n.handyman_id,
    n.sender_id
FROM public.notification n
LEFT JOIN public.handyman h ON h.id = n.handyman_id
WHERE n.handyman_id IS NOT NULL AND h.id IS NULL

UNION ALL

SELECT
    n.id,
    n.created_at,
    n.title,
    n.type,
    n.booking_id,
    n.customer_id,
    n.provider_id,
    n.handyman_id,
    n.sender_id
FROM public.notification n
LEFT JOIN auth.users u ON u.id = n.sender_id
WHERE n.sender_id IS NOT NULL AND u.id IS NULL

ORDER BY created_at DESC NULLS LAST;
