create table if not exists public.admin_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'other'
    check (category in ('agreement', 'policy', 'other')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_deliveries (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.admin_documents (id) on delete restrict,
  recipient_type text not null default 'provider'
    check (recipient_type in ('provider')),
  recipient_id uuid not null references public.provider (id) on delete cascade,
  sent_by uuid references auth.users (id) on delete set null,
  sent_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists admin_documents_created_idx
  on public.admin_documents (created_at desc);

create index if not exists document_deliveries_recipient_idx
  on public.document_deliveries (recipient_type, recipient_id, sent_at desc);

create index if not exists document_deliveries_document_idx
  on public.document_deliveries (document_id, sent_at desc);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'admin-documents',
  'admin-documents',
  false,
  10485760,
  array['application/pdf']
)
on conflict (id) do update
set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.admin_documents enable row level security;
alter table public.document_deliveries enable row level security;

create or replace function public.current_provider_profile_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from public.provider p
  where p.user_id::text = auth.uid()::text
     or p.id::text = auth.uid()::text
  limit 1;
$$;

revoke all on function public.current_provider_profile_id() from public;
grant execute on function public.current_provider_profile_id() to authenticated;

drop policy if exists document_deliveries_provider_select_own on public.document_deliveries;
create policy document_deliveries_provider_select_own
  on public.document_deliveries
  for select
  to authenticated
  using (
    recipient_type = 'provider'
    and recipient_id = public.current_provider_profile_id()
  );

drop policy if exists document_deliveries_provider_acknowledge_own on public.document_deliveries;
create policy document_deliveries_provider_acknowledge_own
  on public.document_deliveries
  for update
  to authenticated
  using (
    recipient_type = 'provider'
    and recipient_id = public.current_provider_profile_id()
  )
  with check (
    recipient_type = 'provider'
    and recipient_id = public.current_provider_profile_id()
  );

drop policy if exists admin_documents_provider_read_delivered on public.admin_documents;
create policy admin_documents_provider_read_delivered
  on public.admin_documents
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.document_deliveries delivery
      where delivery.document_id = admin_documents.id
        and delivery.recipient_type = 'provider'
        and delivery.recipient_id = public.current_provider_profile_id()
    )
  );

create or replace function public.list_my_document_deliveries()
returns table (
  id uuid,
  document_id uuid,
  title text,
  category text,
  file_name text,
  sent_at timestamptz,
  acknowledged_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    delivery.id,
    doc.id,
    doc.title,
    doc.category,
    doc.file_name,
    delivery.sent_at,
    delivery.acknowledged_at
  from public.document_deliveries delivery
  join public.admin_documents doc on doc.id = delivery.document_id
  where delivery.recipient_type = 'provider'
    and delivery.recipient_id = public.current_provider_profile_id()
  order by delivery.sent_at desc;
$$;

create or replace function public.get_my_document_delivery_path(p_delivery_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  storage_path text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select doc.storage_path
  into storage_path
  from public.document_deliveries delivery
  join public.admin_documents doc on doc.id = delivery.document_id
  where delivery.id = p_delivery_id
    and delivery.recipient_type = 'provider'
    and delivery.recipient_id = public.current_provider_profile_id();

  if storage_path is null then
    raise exception 'Document not found';
  end if;

  return storage_path;
end;
$$;

create or replace function public.acknowledge_document_delivery(p_delivery_id uuid)
returns public.document_deliveries
language plpgsql
security definer
set search_path = public
as $$
declare
  delivery_row public.document_deliveries;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.document_deliveries
  set acknowledged_at = coalesce(acknowledged_at, now())
  where id = p_delivery_id
    and recipient_type = 'provider'
    and recipient_id = public.current_provider_profile_id()
  returning * into delivery_row;

  if delivery_row.id is null then
    raise exception 'Document delivery not found';
  end if;

  return delivery_row;
end;
$$;

revoke all on function public.list_my_document_deliveries() from public;
grant execute on function public.list_my_document_deliveries() to authenticated;

revoke all on function public.get_my_document_delivery_path(uuid) from public;
grant execute on function public.get_my_document_delivery_path(uuid) to authenticated;

revoke all on function public.acknowledge_document_delivery(uuid) from public;
grant execute on function public.acknowledge_document_delivery(uuid) to authenticated;

drop policy if exists admin_documents_storage_provider_read on storage.objects;
create policy admin_documents_storage_provider_read on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'admin-documents'
    and exists (
      select 1
      from public.admin_documents doc
      join public.document_deliveries delivery on delivery.document_id = doc.id
      where doc.storage_path = objects.name
        and delivery.recipient_type = 'provider'
        and delivery.recipient_id = public.current_provider_profile_id()
    )
  );
