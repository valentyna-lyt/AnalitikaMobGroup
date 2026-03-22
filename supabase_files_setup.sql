-- ============================================================
-- UNIT FILES — Supabase Storage + metadata table
-- Run in Supabase SQL Editor AFTER creating the storage bucket
-- ============================================================

-- STEP 1: Create bucket manually in Supabase Dashboard:
--   Storage → New bucket → Name: "unit-files" → PRIVATE (uncheck Public)

-- STEP 2: Run this SQL

-- Metadata table
create table if not exists unit_files (
  id uuid default gen_random_uuid() primary key,
  unit_id text not null,
  unit_name text,
  section_num smallint not null check (section_num between 1 and 8),
  section_name text not null,
  filename text not null,
  storage_path text not null,
  mime_type text default '',
  file_size bigint default 0,
  uploaded_by uuid references auth.users(id) on delete set null,
  uploaded_at timestamptz default now() not null,
  constraint unit_files_path_unique unique (storage_path)
);

alter table unit_files enable row level security;

create policy "files_select" on unit_files
  for select to authenticated using (true);

create policy "files_insert" on unit_files
  for insert to authenticated
  with check ((select role from profiles where id = auth.uid()) = 'admin');

create policy "files_delete" on unit_files
  for delete to authenticated
  using ((select role from profiles where id = auth.uid()) = 'admin');

-- STEP 3: Storage RLS policies (run after bucket exists)
insert into storage.buckets (id, name, public) values ('unit-files', 'unit-files', false)
  on conflict (id) do nothing;

create policy "storage_files_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'unit-files');

create policy "storage_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'unit-files'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );

create policy "storage_files_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'unit-files'
    and (select role from public.profiles where id = auth.uid()) = 'admin'
  );
