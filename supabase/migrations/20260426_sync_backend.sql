create table if not exists public.app_exercises (
  user_id uuid not null,
  id text not null,
  client_id text not null,
  block_id text not null,
  name text not null,
  short_code text null,
  tags jsonb not null default '[]'::jsonb,
  is_custom boolean not null default false,
  aliases jsonb not null default '[]'::jsonb,
  canonical_name text null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  version integer not null check (version >= 1),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.app_sets (
  user_id uuid not null,
  id text not null,
  client_id text not null,
  exercise_id text not null,
  weight double precision not null,
  reps integer not null check (reps >= 0),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  version integer not null check (version >= 1),
  is_bodyweight boolean not null default false,
  distance_km double precision null,
  duration_min double precision null,
  pause_sec double precision null,
  set_type text null check (set_type in ('weighted', 'bodyweight', 'cardio')),
  primary key (user_id, id),
  constraint app_sets_exercise_fk foreign key (user_id, exercise_id) references public.app_exercises (user_id, id) on delete cascade
);

create table if not exists public.app_cardio_entries (
  user_id uuid not null,
  id text not null,
  client_id text not null,
  exercise_id text not null,
  distance_km double precision null,
  duration_min double precision null,
  avg_heart_rate integer null,
  intensity text null check (intensity in ('easy', 'moderate', 'hard')),
  note text null,
  silent_mode boolean null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  version integer not null check (version >= 1),
  primary key (user_id, id),
  constraint app_cardio_entries_exercise_fk foreign key (user_id, exercise_id) references public.app_exercises (user_id, id) on delete cascade
);

create table if not exists public.app_logs (
  user_id uuid not null,
  id text not null,
  client_id text not null,
  text text not null,
  pinned boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  version integer not null check (version >= 1),
  primary key (user_id, id)
);

create table if not exists public.app_notes (
  user_id uuid not null,
  id text not null,
  client_id text not null,
  text text not null,
  source text not null check (source in ('home_notes', 'quicklog', 'other')),
  created_at timestamptz not null,
  updated_at timestamptz not null,
  deleted_at timestamptz null,
  version integer not null check (version >= 1),
  primary key (user_id, id)
);

create table if not exists public.app_sync_tombstones (
  user_id uuid not null,
  entity_type text not null check (entity_type in ('exercise', 'set', 'cardio', 'log', 'note')),
  entity_id text not null,
  client_id text not null,
  version integer not null check (version >= 1),
  deleted_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, entity_type, entity_id)
);

create index if not exists app_exercises_user_updated_idx on public.app_exercises (user_id, updated_at desc);
create index if not exists app_sets_user_exercise_created_idx on public.app_sets (user_id, exercise_id, created_at desc);
create index if not exists app_cardio_entries_user_exercise_created_idx on public.app_cardio_entries (user_id, exercise_id, created_at desc);
create index if not exists app_logs_user_created_idx on public.app_logs (user_id, created_at desc);
create index if not exists app_notes_user_created_idx on public.app_notes (user_id, created_at desc);
create index if not exists app_sync_tombstones_user_updated_idx on public.app_sync_tombstones (user_id, updated_at desc);

alter table public.app_exercises enable row level security;
alter table public.app_sets enable row level security;
alter table public.app_cardio_entries enable row level security;
alter table public.app_logs enable row level security;
alter table public.app_notes enable row level security;
alter table public.app_sync_tombstones enable row level security;

drop policy if exists "app_exercises_select_own" on public.app_exercises;
create policy "app_exercises_select_own" on public.app_exercises
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_sets_select_own" on public.app_sets;
create policy "app_sets_select_own" on public.app_sets
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_cardio_entries_select_own" on public.app_cardio_entries;
create policy "app_cardio_entries_select_own" on public.app_cardio_entries
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_logs_select_own" on public.app_logs;
create policy "app_logs_select_own" on public.app_logs
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_notes_select_own" on public.app_notes;
create policy "app_notes_select_own" on public.app_notes
for select to authenticated
using (auth.uid() = user_id);

drop policy if exists "app_sync_tombstones_select_own" on public.app_sync_tombstones;
create policy "app_sync_tombstones_select_own" on public.app_sync_tombstones
for select to authenticated
using (auth.uid() = user_id);

create or replace function public.sync_tombstone_blocks_upsert(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_version integer
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.app_sync_tombstones
    where user_id = p_user_id
      and entity_type = p_entity_type
      and entity_id = p_entity_id
      and version >= p_version
  );
$$;

create or replace function public.sync_apply_delete(
  p_user_id uuid,
  p_entity_type text,
  p_entity_id text,
  p_client_id text,
  p_version integer,
  p_deleted_at timestamptz
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer := 0;
begin
  insert into public.app_sync_tombstones (
    user_id,
    entity_type,
    entity_id,
    client_id,
    version,
    deleted_at,
    updated_at
  )
  values (
    p_user_id,
    p_entity_type,
    p_entity_id,
    p_client_id,
    p_version,
    p_deleted_at,
    p_deleted_at
  )
  on conflict (user_id, entity_type, entity_id) do update
  set
    client_id = excluded.client_id,
    version = excluded.version,
    deleted_at = excluded.deleted_at,
    updated_at = excluded.updated_at
  where public.app_sync_tombstones.version <= excluded.version;

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    return 'stale';
  end if;

  if p_entity_type = 'exercise' then
    update public.app_exercises
    set
      client_id = p_client_id,
      version = p_version,
      deleted_at = p_deleted_at,
      updated_at = p_deleted_at
    where user_id = p_user_id
      and id = p_entity_id
      and version <= p_version;
  elsif p_entity_type = 'set' then
    update public.app_sets
    set
      client_id = p_client_id,
      version = p_version,
      deleted_at = p_deleted_at,
      updated_at = p_deleted_at
    where user_id = p_user_id
      and id = p_entity_id
      and version <= p_version;
  elsif p_entity_type = 'cardio' then
    update public.app_cardio_entries
    set
      client_id = p_client_id,
      version = p_version,
      deleted_at = p_deleted_at,
      updated_at = p_deleted_at
    where user_id = p_user_id
      and id = p_entity_id
      and version <= p_version;
  elsif p_entity_type = 'log' then
    update public.app_logs
    set
      client_id = p_client_id,
      version = p_version,
      deleted_at = p_deleted_at,
      updated_at = p_deleted_at
    where user_id = p_user_id
      and id = p_entity_id
      and version <= p_version;
  elsif p_entity_type = 'note' then
    update public.app_notes
    set
      client_id = p_client_id,
      version = p_version,
      deleted_at = p_deleted_at,
      updated_at = p_deleted_at
    where user_id = p_user_id
      and id = p_entity_id
      and version <= p_version;
  else
    raise exception 'Unsupported sync entity type: %', p_entity_type;
  end if;

  return 'deleted';
end;
$$;

create or replace function public.sync_apply_exercise_upsert(
  p_user_id uuid,
  p_event jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity jsonb := p_event -> 'entity';
  v_rows integer := 0;
  v_id text := btrim(p_event ->> 'entityId');
  v_client_id text := btrim(p_event ->> 'clientId');
  v_version integer := (p_event ->> 'version')::integer;
  v_changed_at timestamptz := coalesce((v_entity ->> 'updatedAt')::timestamptz, (p_event ->> 'changedAt')::timestamptz);
begin
  if public.sync_tombstone_blocks_upsert(p_user_id, 'exercise', v_id, v_version) then
    return 'stale_tombstone';
  end if;

  insert into public.app_exercises (
    user_id,
    id,
    client_id,
    block_id,
    name,
    short_code,
    tags,
    is_custom,
    aliases,
    canonical_name,
    updated_at,
    deleted_at,
    version,
    created_at
  )
  values (
    p_user_id,
    v_id,
    v_client_id,
    v_entity ->> 'blockId',
    v_entity ->> 'name',
    nullif(v_entity ->> 'shortCode', ''),
    coalesce(v_entity -> 'tags', '[]'::jsonb),
    coalesce((v_entity ->> 'isCustom')::boolean, false),
    coalesce(v_entity -> 'aliases', '[]'::jsonb),
    nullif(v_entity ->> 'canonicalName', ''),
    v_changed_at,
    nullif(v_entity ->> 'deletedAt', '')::timestamptz,
    v_version,
    coalesce((v_entity ->> 'updatedAt')::timestamptz, v_changed_at)
  )
  on conflict (user_id, id) do update
  set
    client_id = excluded.client_id,
    block_id = excluded.block_id,
    name = excluded.name,
    short_code = excluded.short_code,
    tags = excluded.tags,
    is_custom = excluded.is_custom,
    aliases = excluded.aliases,
    canonical_name = excluded.canonical_name,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    version = excluded.version
  where public.app_exercises.version <= excluded.version;

  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then 'applied' else 'stale' end;
end;
$$;

create or replace function public.sync_apply_set_upsert(
  p_user_id uuid,
  p_event jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity jsonb := p_event -> 'entity';
  v_rows integer := 0;
  v_id text := btrim(p_event ->> 'entityId');
  v_client_id text := btrim(p_event ->> 'clientId');
  v_version integer := (p_event ->> 'version')::integer;
  v_changed_at timestamptz := coalesce((v_entity ->> 'updatedAt')::timestamptz, (p_event ->> 'changedAt')::timestamptz);
begin
  if public.sync_tombstone_blocks_upsert(p_user_id, 'set', v_id, v_version) then
    return 'stale_tombstone';
  end if;

  insert into public.app_sets (
    user_id,
    id,
    client_id,
    exercise_id,
    weight,
    reps,
    created_at,
    updated_at,
    deleted_at,
    version,
    is_bodyweight,
    distance_km,
    duration_min,
    pause_sec,
    set_type
  )
  values (
    p_user_id,
    v_id,
    v_client_id,
    v_entity ->> 'exerciseId',
    (v_entity ->> 'weight')::double precision,
    (v_entity ->> 'reps')::integer,
    (v_entity ->> 'createdAt')::timestamptz,
    v_changed_at,
    nullif(v_entity ->> 'deletedAt', '')::timestamptz,
    v_version,
    coalesce((v_entity ->> 'isBodyweight')::boolean, false),
    nullif(v_entity ->> 'distanceKm', '')::double precision,
    nullif(v_entity ->> 'durationMin', '')::double precision,
    nullif(v_entity ->> 'pauseSec', '')::double precision,
    nullif(v_entity ->> 'setType', '')
  )
  on conflict (user_id, id) do update
  set
    client_id = excluded.client_id,
    exercise_id = excluded.exercise_id,
    weight = excluded.weight,
    reps = excluded.reps,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    version = excluded.version,
    is_bodyweight = excluded.is_bodyweight,
    distance_km = excluded.distance_km,
    duration_min = excluded.duration_min,
    pause_sec = excluded.pause_sec,
    set_type = excluded.set_type
  where public.app_sets.version <= excluded.version;

  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then 'applied' else 'stale' end;
end;
$$;

create or replace function public.sync_apply_cardio_upsert(
  p_user_id uuid,
  p_event jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity jsonb := p_event -> 'entity';
  v_rows integer := 0;
  v_id text := btrim(p_event ->> 'entityId');
  v_client_id text := btrim(p_event ->> 'clientId');
  v_version integer := (p_event ->> 'version')::integer;
  v_changed_at timestamptz := coalesce((v_entity ->> 'updatedAt')::timestamptz, (p_event ->> 'changedAt')::timestamptz);
begin
  if public.sync_tombstone_blocks_upsert(p_user_id, 'cardio', v_id, v_version) then
    return 'stale_tombstone';
  end if;

  insert into public.app_cardio_entries (
    user_id,
    id,
    client_id,
    exercise_id,
    distance_km,
    duration_min,
    avg_heart_rate,
    intensity,
    note,
    silent_mode,
    created_at,
    updated_at,
    deleted_at,
    version
  )
  values (
    p_user_id,
    v_id,
    v_client_id,
    v_entity ->> 'exerciseId',
    nullif(v_entity ->> 'distanceKm', '')::double precision,
    nullif(v_entity ->> 'durationMin', '')::double precision,
    nullif(v_entity ->> 'avgHeartRate', '')::integer,
    nullif(v_entity ->> 'intensity', ''),
    nullif(v_entity ->> 'note', ''),
    case
      when v_entity ? 'silentMode' then (v_entity ->> 'silentMode')::boolean
      else null
    end,
    (v_entity ->> 'createdAt')::timestamptz,
    v_changed_at,
    nullif(v_entity ->> 'deletedAt', '')::timestamptz,
    v_version
  )
  on conflict (user_id, id) do update
  set
    client_id = excluded.client_id,
    exercise_id = excluded.exercise_id,
    distance_km = excluded.distance_km,
    duration_min = excluded.duration_min,
    avg_heart_rate = excluded.avg_heart_rate,
    intensity = excluded.intensity,
    note = excluded.note,
    silent_mode = excluded.silent_mode,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    version = excluded.version
  where public.app_cardio_entries.version <= excluded.version;

  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then 'applied' else 'stale' end;
end;
$$;

create or replace function public.sync_apply_log_upsert(
  p_user_id uuid,
  p_event jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity jsonb := p_event -> 'entity';
  v_rows integer := 0;
  v_id text := btrim(p_event ->> 'entityId');
  v_client_id text := btrim(p_event ->> 'clientId');
  v_version integer := (p_event ->> 'version')::integer;
  v_changed_at timestamptz := coalesce((v_entity ->> 'updatedAt')::timestamptz, (p_event ->> 'changedAt')::timestamptz);
begin
  if public.sync_tombstone_blocks_upsert(p_user_id, 'log', v_id, v_version) then
    return 'stale_tombstone';
  end if;

  insert into public.app_logs (
    user_id,
    id,
    client_id,
    text,
    pinned,
    created_at,
    updated_at,
    deleted_at,
    version
  )
  values (
    p_user_id,
    v_id,
    v_client_id,
    v_entity ->> 'text',
    coalesce((v_entity ->> 'pinned')::boolean, false),
    (v_entity ->> 'createdAt')::timestamptz,
    v_changed_at,
    nullif(v_entity ->> 'deletedAt', '')::timestamptz,
    v_version
  )
  on conflict (user_id, id) do update
  set
    client_id = excluded.client_id,
    text = excluded.text,
    pinned = excluded.pinned,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    version = excluded.version
  where public.app_logs.version <= excluded.version;

  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then 'applied' else 'stale' end;
end;
$$;

create or replace function public.sync_apply_note_upsert(
  p_user_id uuid,
  p_event jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity jsonb := p_event -> 'entity';
  v_rows integer := 0;
  v_id text := btrim(p_event ->> 'entityId');
  v_client_id text := btrim(p_event ->> 'clientId');
  v_version integer := (p_event ->> 'version')::integer;
  v_changed_at timestamptz := coalesce((v_entity ->> 'updatedAt')::timestamptz, (p_event ->> 'changedAt')::timestamptz);
begin
  if public.sync_tombstone_blocks_upsert(p_user_id, 'note', v_id, v_version) then
    return 'stale_tombstone';
  end if;

  insert into public.app_notes (
    user_id,
    id,
    client_id,
    text,
    source,
    created_at,
    updated_at,
    deleted_at,
    version
  )
  values (
    p_user_id,
    v_id,
    v_client_id,
    v_entity ->> 'text',
    v_entity ->> 'source',
    (v_entity ->> 'createdAt')::timestamptz,
    v_changed_at,
    nullif(v_entity ->> 'deletedAt', '')::timestamptz,
    v_version
  )
  on conflict (user_id, id) do update
  set
    client_id = excluded.client_id,
    text = excluded.text,
    source = excluded.source,
    created_at = excluded.created_at,
    updated_at = excluded.updated_at,
    deleted_at = excluded.deleted_at,
    version = excluded.version
  where public.app_notes.version <= excluded.version;

  get diagnostics v_rows = row_count;
  return case when v_rows > 0 then 'applied' else 'stale' end;
end;
$$;

create or replace function public.apply_sync_batch(
  p_user_id uuid,
  p_events jsonb
)
returns table (
  event_id text,
  acknowledged boolean,
  outcome text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event jsonb;
  v_event_id text;
  v_entity_type text;
  v_operation text;
  v_entity_id text;
  v_client_id text;
  v_version integer;
  v_changed_at timestamptz;
  v_deleted_at timestamptz;
  v_outcome text;
begin
  if p_user_id is null then
    raise exception 'p_user_id is required';
  end if;

  if jsonb_typeof(coalesce(p_events, '[]'::jsonb)) <> 'array' then
    raise exception 'p_events must be a json array';
  end if;

  for v_event in
    select value
    from jsonb_array_elements(coalesce(p_events, '[]'::jsonb))
  loop
    v_event_id := nullif(btrim(v_event ->> 'id'), '');
    v_entity_type := nullif(btrim(v_event ->> 'entityType'), '');
    v_operation := nullif(btrim(v_event ->> 'operation'), '');
    v_entity_id := nullif(btrim(v_event ->> 'entityId'), '');
    v_client_id := nullif(btrim(v_event ->> 'clientId'), '');
    v_version := nullif(v_event ->> 'version', '')::integer;
    v_changed_at := nullif(v_event ->> 'changedAt', '')::timestamptz;
    v_deleted_at := nullif(v_event ->> 'deletedAt', '')::timestamptz;

    if v_event_id is null or v_entity_type is null or v_operation is null or v_entity_id is null or v_client_id is null or v_version is null or v_version < 1 or v_changed_at is null then
      raise exception 'Invalid sync event payload: %', v_event::text;
    end if;

    if v_operation = 'upsert' then
      if jsonb_typeof(v_event -> 'entity') <> 'object' then
        raise exception 'Upsert event % is missing entity payload', v_event_id;
      end if;

      if v_entity_type = 'exercise' then
        v_outcome := public.sync_apply_exercise_upsert(p_user_id, v_event);
      elsif v_entity_type = 'set' then
        v_outcome := public.sync_apply_set_upsert(p_user_id, v_event);
      elsif v_entity_type = 'cardio' then
        v_outcome := public.sync_apply_cardio_upsert(p_user_id, v_event);
      elsif v_entity_type = 'log' then
        v_outcome := public.sync_apply_log_upsert(p_user_id, v_event);
      elsif v_entity_type = 'note' then
        v_outcome := public.sync_apply_note_upsert(p_user_id, v_event);
      else
        raise exception 'Unsupported sync entity type: %', v_entity_type;
      end if;
    elsif v_operation = 'delete' then
      if v_deleted_at is null then
        raise exception 'Delete event % is missing deletedAt', v_event_id;
      end if;
      v_outcome := public.sync_apply_delete(
        p_user_id,
        v_entity_type,
        v_entity_id,
        v_client_id,
        v_version,
        v_deleted_at
      );
    else
      raise exception 'Unsupported sync operation: %', v_operation;
    end if;

    event_id := v_event_id;
    acknowledged := true;
    outcome := v_outcome;
    return next;
  end loop;
end;
$$;

revoke all on function public.sync_apply_delete(uuid, text, text, text, integer, timestamptz) from public;
revoke all on function public.sync_apply_exercise_upsert(uuid, jsonb) from public;
revoke all on function public.sync_apply_set_upsert(uuid, jsonb) from public;
revoke all on function public.sync_apply_cardio_upsert(uuid, jsonb) from public;
revoke all on function public.sync_apply_log_upsert(uuid, jsonb) from public;
revoke all on function public.sync_apply_note_upsert(uuid, jsonb) from public;
revoke all on function public.apply_sync_batch(uuid, jsonb) from public;

grant execute on function public.apply_sync_batch(uuid, jsonb) to service_role;
