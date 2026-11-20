-- Run in Supabase SQL editor (same as migration).
-- Auto soft-archive bookings for Fozia Kassa + Melese QA accounts on INSERT.

CREATE OR REPLACE FUNCTION public.booked_service_auto_archive_test_accounts()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  archive_note_default text := 'Auto-archived test account';
  cust_email text;
  cust_first text;
  cust_last text;
  prov_email text;
  prov_first text;
  prov_last text;
  match boolean := false;
BEGIN
  IF NEW.is_archived IS TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_id IN (
    '8a8f7b79-d371-4a7e-b140-162da35cc5cc',
    'b6653709-a566-4c4b-b1ba-a31945376bef',
    '9d1f8482-8e33-42e6-bfc3-e1c34233ed06',
    '0e21bd39-6a91-4cc3-9185-0101c5082728',
    '1a8510bc-ae50-44c8-b171-888b0463446f',
    '5b50054b-561b-4327-80c2-beac321ead3e',
    'e626b0bc-d085-4038-aa41-7ebf4de63019'
  ) OR NEW.provider_id IN (
    '2e59797a-db9b-4485-afa8-69a54c9bd42f',
    '1a075e03-21b3-4cc9-9ce6-41e78b06c93b'
  ) THEN
    match := true;
  END IF;

  IF NOT match AND NEW.email IS NOT NULL THEN
    IF lower(NEW.email) LIKE '%foziakassa%'
       OR lower(NEW.email) LIKE '%meleseayen%'
       OR lower(NEW.email) = 'miyemon960@lovadio.com' THEN
      match := true;
    END IF;
  END IF;

  IF NOT match
     AND lower(coalesce(NEW."firstName", '')) = 'fozia'
     AND lower(coalesce(NEW."lastName", '')) = 'kassa' THEN
    match := true;
  END IF;

  IF NOT match
     AND lower(coalesce(NEW."firstName", '')) = 'melese'
     AND lower(coalesce(NEW."lastName", '')) IN ('customer', 'ayen', 'provider') THEN
    match := true;
  END IF;

  IF NOT match AND NEW.customer_id IS NOT NULL THEN
    SELECT lower(coalesce(email, '')), lower(coalesce(first_name, '')), lower(coalesce(last_name, ''))
      INTO cust_email, cust_first, cust_last
      FROM public.customer
     WHERE id = NEW.customer_id;

    IF cust_email LIKE '%foziakassa%'
       OR cust_email LIKE '%meleseayen%'
       OR cust_email = 'miyemon960@lovadio.com'
       OR (cust_first = 'fozia' AND cust_last = 'kassa')
       OR (cust_first = 'melese' AND cust_last IN ('customer', 'ayen', 'provider')) THEN
      match := true;
    END IF;
  END IF;

  IF NOT match AND NEW.provider_id IS NOT NULL THEN
    SELECT lower(coalesce(email, '')), lower(coalesce("firstName", '')), lower(coalesce("lastName", ''))
      INTO prov_email, prov_first, prov_last
      FROM public.provider
     WHERE id = NEW.provider_id;

    IF prov_email LIKE '%foziakassa%'
       OR prov_email LIKE '%meleseayen%'
       OR prov_email = 'miyemon960@lovadio.com'
       OR (prov_first = 'fozia' AND prov_last = 'kassa')
       OR (prov_first = 'melese' AND prov_last IN ('customer', 'ayen', 'provider')) THEN
      match := true;
    END IF;
  END IF;

  IF match THEN
    NEW.is_archived := true;
    IF NEW.archive_note IS NULL OR btrim(NEW.archive_note) = '' THEN
      NEW.archive_note := archive_note_default;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booked_service_auto_archive_test_accounts_trg ON public.booked_service;

CREATE TRIGGER booked_service_auto_archive_test_accounts_trg
BEFORE INSERT ON public.booked_service
FOR EACH ROW
EXECUTE FUNCTION public.booked_service_auto_archive_test_accounts();
