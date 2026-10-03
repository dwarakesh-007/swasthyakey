-- SwasthyaKey: patient-held, consent-driven health record
-- Run once on a fresh Supabase project (SQL editor, or `supabase db push`).

create extension if not exists pgcrypto with schema extensions;

-------------------------------------------------------------------------------
-- Health locker tables. Every row belongs to one patient (auth.users).
-------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 120),
  date_of_birth date check (date_of_birth <= current_date),
  sex text check (sex in ('female', 'male', 'other')),
  blood_group text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  phone text check (char_length(phone) <= 20),
  abha_number text check (abha_number ~ '^[0-9]{2}-[0-9]{4}-[0-9]{4}-[0-9]{4}$'),
  emergency_contact_name text check (char_length(emergency_contact_name) <= 120),
  emergency_contact_phone text check (char_length(emergency_contact_phone) <= 20),
  emergency_contact_relation text check (char_length(emergency_contact_relation) <= 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.allergies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  substance text not null check (char_length(substance) between 1 and 120),
  reaction text check (char_length(reaction) <= 300),
  severity text not null default 'moderate' check (severity in ('mild', 'moderate', 'severe')),
  created_at timestamptz not null default now()
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  dose text check (char_length(dose) <= 60),
  frequency text check (char_length(frequency) <= 80),
  start_date date,
  prescribed_by text check (char_length(prescribed_by) <= 120),
  notes text check (char_length(notes) <= 500),
  active boolean not null default true,
  critical boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.conditions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  diagnosed_on date,
  status text not null default 'active' check (status in ('active', 'managed', 'resolved')),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  kind text not null default 'lab' check (kind in ('lab', 'imaging', 'prescription', 'discharge', 'other')),
  report_date date,
  notes text check (char_length(notes) <= 1000),
  file_path text unique,
  file_name text,
  mime_type text,
  size_bytes integer,
  created_at timestamptz not null default now(),
  -- uploaded files must live in the owner's own folder: <user_id>/<file>
  constraint reports_file_in_owner_folder check (file_path is null or file_path like user_id::text || '/%')
);

create index on public.allergies (user_id);
create index on public.medications (user_id);
create index on public.conditions (user_id);
create index on public.reports (user_id);

-------------------------------------------------------------------------------
-- Consent: shares (what a QR unlocks, until when) and the access log.
-------------------------------------------------------------------------------

create table public.shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  kind text not null default 'standard' check (kind in ('standard', 'emergency')),
  label text check (char_length(label) <= 80),
  sections text[] not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  view_count integer not null default 0,
  last_viewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint shares_sections_valid check (
    cardinality(sections) > 0
    and sections <@ array['allergies', 'medications', 'conditions', 'reports', 'emergency_contact']
  ),
  constraint shares_expiry_rules check (
    (kind = 'standard' and expires_at is not null) or (kind = 'emergency' and expires_at is null)
  )
);

create index on public.shares (user_id, created_at desc);
-- only one live emergency card per patient
create unique index shares_one_emergency_per_user on public.shares (user_id)
  where kind = 'emergency' and revoked_at is null;

create table public.access_logs (
  id bigint generated always as identity primary key,
  share_id uuid not null references public.shares (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  sections text[] not null,
  device text check (char_length(device) <= 300)
);

create index on public.access_logs (user_id, viewed_at desc);
create index on public.access_logs (share_id);

-------------------------------------------------------------------------------
-- Row level security: a patient can only ever touch their own rows.
-------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.allergies enable row level security;
alter table public.medications enable row level security;
alter table public.conditions enable row level security;
alter table public.reports enable row level security;
alter table public.shares enable row level security;
alter table public.access_logs enable row level security;

create policy "own profile" on public.profiles
  for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "own allergies" on public.allergies
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own medications" on public.medications
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own conditions" on public.conditions
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own reports" on public.reports
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Shares and logs are read-only from the client. They change only through the functions below,
-- so tokens are always generated server-side and a log entry can never be forged or deleted.
create policy "read own shares" on public.shares
  for select to authenticated using (user_id = (select auth.uid()));
create policy "read own access log" on public.access_logs
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.shares, public.access_logs from anon;
revoke insert, update, delete on public.shares, public.access_logs from authenticated;
revoke all on public.profiles, public.allergies, public.medications, public.conditions, public.reports from anon;

-------------------------------------------------------------------------------
-- Profile is created automatically when someone signs up.
-------------------------------------------------------------------------------

create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, left(coalesce(new.raw_user_meta_data ->> 'full_name', ''), 120));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-------------------------------------------------------------------------------
-- Patient-side functions (need a logged-in patient).
-------------------------------------------------------------------------------

-- Create a time-limited share. Returns the new share row (including its secret token).
create function public.create_share(p_sections text[], p_minutes integer, p_label text default null)
returns public.shares
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  result public.shares;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_minutes is null or p_minutes < 5 or p_minutes > 10080 then
    raise exception 'share duration must be between 5 minutes and 7 days' using errcode = '22023';
  end if;
  insert into public.shares (user_id, token, kind, label, sections, expires_at)
  values (uid,
          translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
          'standard',
          nullif(trim(p_label), ''),
          (select array_agg(distinct s order by s) from unnest(p_sections) s),
          now() + make_interval(mins => p_minutes))
  returning * into result;
  return result;
end $$;

-- Create (or replace) the patient's permanent emergency card.
create function public.create_emergency_card()
returns public.shares
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  result public.shares;
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  update public.shares set revoked_at = now()
    where user_id = uid and kind = 'emergency' and revoked_at is null;
  insert into public.shares (user_id, token, kind, label, sections, expires_at)
  values (uid,
          translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_'),
          'emergency', 'Emergency card',
          array['allergies', 'conditions', 'emergency_contact', 'medications'],
          null)
  returning * into result;
  return result;
end $$;

-- Revoke a share immediately. The doctor's page locks on its next check.
create function public.revoke_share(p_share_id uuid)
returns public.shares
language plpgsql security definer set search_path = '' as $$
declare
  result public.shares;
begin
  update public.shares
     set revoked_at = coalesce(revoked_at, now())
   where id = p_share_id and user_id = auth.uid()
  returning * into result;
  if result.id is null then raise exception 'share not found' using errcode = 'P0002'; end if;
  return result;
end $$;

-------------------------------------------------------------------------------
-- Doctor-side functions (no login; the share token is the only key).
-------------------------------------------------------------------------------

create function public.share_state(s public.shares) returns text
language sql stable set search_path = '' as $$
  select case
    when s.id is null then 'not_found'
    when s.revoked_at is not null then 'revoked'
    when s.expires_at is not null and s.expires_at <= now() then 'expired'
    else 'active' end
$$;

-- Cheap status check the doctor's page polls. Reveals nothing about the patient.
create function public.share_status(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  s public.shares;
begin
  select * into s from public.shares where token = p_token;
  return jsonb_build_object('status', public.share_state(s), 'expires_at', s.expires_at, 'server_time', now());
end $$;

-- Opens a share: returns only the sections the patient allowed, and writes the access log.
create function public.open_share(p_token text, p_device text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  s public.shares;
  p public.profiles;
  state text;
  emergency boolean;
  res jsonb;
begin
  select * into s from public.shares where token = p_token for update;
  state := public.share_state(s);
  if state <> 'active' then
    return jsonb_build_object('status', state);
  end if;
  emergency := s.kind = 'emergency';

  select * into p from public.profiles where id = s.user_id;

  res := jsonb_build_object(
    'status', 'active',
    'kind', s.kind,
    'label', s.label,
    'sections', to_jsonb(s.sections),
    'expires_at', s.expires_at,
    'server_time', now(),
    'patient', jsonb_build_object(
      'full_name', p.full_name,
      'age', case when p.date_of_birth is null then null
                  else extract(year from age(current_date, p.date_of_birth))::int end,
      'sex', p.sex,
      'blood_group', p.blood_group,
      'abha_number', case when emergency then null else p.abha_number end
    )
  );

  if 'allergies' = any (s.sections) then
    res := res || jsonb_build_object('allergies', coalesce((
      select jsonb_agg(jsonb_build_object('substance', a.substance, 'reaction', a.reaction, 'severity', a.severity)
             order by case a.severity when 'severe' then 0 when 'moderate' then 1 else 2 end, a.substance)
        from public.allergies a where a.user_id = s.user_id), '[]'::jsonb));
  end if;

  if 'medications' = any (s.sections) then
    res := res || jsonb_build_object('medications', coalesce((
      select jsonb_agg(jsonb_build_object('name', m.name, 'dose', m.dose, 'frequency', m.frequency,
               'start_date', m.start_date, 'prescribed_by', m.prescribed_by, 'notes', m.notes, 'critical', m.critical)
             order by m.critical desc, m.name)
        from public.medications m
       where m.user_id = s.user_id and m.active and (not emergency or m.critical)), '[]'::jsonb));
  end if;

  if 'conditions' = any (s.sections) then
    res := res || jsonb_build_object('conditions', coalesce((
      select jsonb_agg(jsonb_build_object('name', c.name, 'diagnosed_on', c.diagnosed_on, 'status', c.status,
               'notes', case when emergency then null else c.notes end)
             order by case c.status when 'active' then 0 when 'managed' then 1 else 2 end, c.name)
        from public.conditions c
       where c.user_id = s.user_id and (not emergency or c.status <> 'resolved')), '[]'::jsonb));
  end if;

  if 'reports' = any (s.sections) then
    res := res || jsonb_build_object('reports', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'title', r.title, 'kind', r.kind, 'report_date', r.report_date,
               'notes', r.notes, 'file_path', r.file_path, 'file_name', r.file_name, 'mime_type', r.mime_type)
             order by r.report_date desc nulls last, r.created_at desc)
        from public.reports r where r.user_id = s.user_id), '[]'::jsonb));
  end if;

  if 'emergency_contact' = any (s.sections) then
    res := res || jsonb_build_object('emergency_contact', jsonb_build_object(
      'name', p.emergency_contact_name, 'phone', p.emergency_contact_phone,
      'relation', p.emergency_contact_relation));
  end if;

  insert into public.access_logs (share_id, user_id, sections, device)
  values (s.id, s.user_id, s.sections, left(p_device, 300));
  update public.shares set view_count = view_count + 1, last_viewed_at = now() where id = s.id;

  return res;
end $$;

-- Used by the storage rule below: may this share token read this file right now?
create function public.share_allows_file(p_token text, p_object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
      from public.shares s
      join public.reports r on r.user_id = s.user_id and r.file_path = p_object_name
     where s.token = p_token
       and s.kind = 'standard'
       and 'reports' = any (s.sections)
       and public.share_state(s) = 'active')
$$;

-- Function permissions: patient functions need a login, doctor functions work without one.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.create_share(text[], integer, text) to authenticated;
grant execute on function public.create_emergency_card() to authenticated;
grant execute on function public.revoke_share(uuid) to authenticated;
grant execute on function public.share_status(text) to anon, authenticated;
grant execute on function public.open_share(text, text) to anon, authenticated;
grant execute on function public.share_allows_file(text, text) to anon, authenticated;
grant execute on function public.share_state(public.shares) to anon, authenticated;

-------------------------------------------------------------------------------
-- File storage for reports: private bucket, one folder per patient.
-------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reports', 'reports', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy "patients manage own report files" on storage.objects
  for all to authenticated
  using (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'reports' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- A doctor holding an active share that includes reports can read those files.
-- The token travels in the x-share-token request header.
create policy "doctors read shared report files" on storage.objects
  for select to anon, authenticated
  using (
    bucket_id = 'reports'
    and public.share_allows_file(
      (nullif(current_setting('request.headers', true), '')::json ->> 'x-share-token'), name)
  );

-------------------------------------------------------------------------------
-- Live updates: patient's screen hears about new views instantly.
-------------------------------------------------------------------------------

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.access_logs, public.shares;
  end if;
end $$;
