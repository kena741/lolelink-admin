create or replace function public.get_deletable_storage_paths()
returns table(name text)
language sql
security definer
set search_path = storage, public
as $$
  with referenced_paths as (
    select distinct
      replace(
        regexp_replace(media_url, '^https?://[^/]+/storage/v1/object/public/betegnabucket/', ''),
        '%20', ' '
      ) as storage_path
    from (
      select "profileImage" as media_url from provider where coalesce("profileImage", '') <> ''
      union all select banner from provider where coalesce(banner, '') <> ''
      union all select "profileImage" from handyman where coalesce("profileImage", '') <> ''
      union all select image from category where coalesce(image, '') <> ''
      union all select image from banner where coalesce(image, '') <> ''
      union all select "documentImage" from verify_documents where coalesce("documentImage", '') <> ''
      union all select "serviceImage" from booked_service where coalesce("serviceImage", '') <> ''
      union all select url from service s, lateral unnest(s."serviceImage") as url where url <> ''
      union all select video from service where coalesce(video, '') <> ''
    ) t
    where media_url like '%/storage/v1/object/public/betegnabucket/%'
  )
  select o.name
  from storage.objects o
  left join referenced_paths r on r.storage_path = o.name
  where o.bucket_id = 'betegnabucket'
    and (
      o.name like 'bannerImages/%'
      or o.name like 'profileImages/%'
      or o.name like 'providers/%'
      or o.name like 'companyBannerImage/%'
      or (
        o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
        and o.name not like 'public/%'
        and o.name not like 'provider/%'
        and o.name not like 'profileImage/%'
      )
      or r.storage_path is null
    )
  order by o.name;
$$;

grant execute on function public.get_deletable_storage_paths() to service_role;
grant execute on function public.get_deletable_storage_paths() to authenticated;
