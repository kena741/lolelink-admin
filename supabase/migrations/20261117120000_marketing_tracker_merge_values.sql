-- Atomic jsonb merge for marketing tracker cell saves (avoids lost updates on concurrent PATCHes).
CREATE OR REPLACE FUNCTION public.merge_marketing_tracker_row_values(
    p_id uuid,
    p_patch jsonb
)
RETURNS public.marketing_tracker_row
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result public.marketing_tracker_row;
BEGIN
    IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
        RAISE EXCEPTION 'patch must be a jsonb object';
    END IF;

    UPDATE public.marketing_tracker_row
    SET
        values = coalesce(values, '{}'::jsonb) || p_patch,
        updated_at = now()
    WHERE id = p_id
    RETURNING * INTO result;

    IF result.id IS NULL THEN
        RAISE EXCEPTION 'Row not found';
    END IF;

    RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_marketing_tracker_row_values(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_marketing_tracker_row_values(uuid, jsonb) TO service_role;
