begin;

-- Wayfinder Slice 1A executable persistence.
-- Canon source: docs/10-physical-schema.md v0.5.
-- This migration intentionally creates only the first-slice system, Direction,
-- Practice, and Evidence persistence plus integrity machinery.

create extension if not exists pgcrypto;

create schema if not exists wf_system;
create schema if not exists wf_direction;
create schema if not exists wf_practice;
create schema if not exists wf_evidence;

-- ---------------------------------------------------------------------------
-- SYSTEM KERNEL
-- ---------------------------------------------------------------------------

create table wf_system.owners (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  constraint owners_auth_user_fk
    foreign key (auth_user_id)
    references auth.users(id)
    on delete restrict
);

create table wf_system.command_receipts (
  command_id uuid primary key,
  owner_id uuid not null,
  module_id text not null,
  command_type text not null,
  request_hash text not null,
  requested_at timestamptz not null,
  status text not null,
  affected_refs jsonb,
  error_code text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint command_receipts_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint command_receipts_status_ck
    check (status in ('PROCESSING','APPLIED','REJECTED','NOOP')),
  constraint command_receipts_terminal_time_ck
    check (
      (status = 'PROCESSING' and processed_at is null)
      or
      (status in ('APPLIED','REJECTED','NOOP') and processed_at is not null)
    )
);

create table wf_system.module_change_outbox (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  module_id text not null,
  change_type text not null,
  command_id uuid,
  affected jsonb not null,
  correlation_id uuid,
  committed_at timestamptz not null default now(),
  published_at timestamptz,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  constraint module_change_outbox_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint module_change_outbox_command_fk
    foreign key (command_id)
    references wf_system.command_receipts(command_id)
    on delete restrict,
  constraint module_change_outbox_attempt_count_ck
    check (attempt_count >= 0)
);

create index command_receipts_owner_created_idx
  on wf_system.command_receipts (owner_id, created_at desc);

create index module_change_outbox_owner_committed_idx
  on wf_system.module_change_outbox (owner_id, committed_at desc);

create index module_change_outbox_due_idx
  on wf_system.module_change_outbox (coalesce(next_attempt_at, committed_at))
  where published_at is null;

-- ---------------------------------------------------------------------------
-- DIRECTION CORE MODULE
-- ---------------------------------------------------------------------------

create table wf_direction.nodes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  kind text not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint nodes_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint nodes_kind_ck
    check (kind in ('value','direction','outcome','commitment','quest','plan','action')),
  constraint nodes_id_owner_uq unique (id, owner_id)
);

create table wf_direction.node_versions (
  id uuid primary key default gen_random_uuid(),
  node_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  schema_version smallint not null default 1,
  title text not null,
  description text,
  intent_state text not null,
  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint node_versions_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint node_versions_actor_owner_fk
    foreign key (actor_owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint node_versions_node_owner_fk
    foreign key (node_id, owner_id)
    references wf_direction.nodes(id, owner_id)
    on delete restrict,
  constraint node_versions_node_version_uq unique (node_id, version_no),
  constraint node_versions_id_node_owner_uq unique (id, node_id, owner_id),
  constraint node_versions_version_no_ck check (version_no > 0),
  constraint node_versions_schema_version_ck check (schema_version > 0),
  constraint node_versions_intent_state_ck
    check (intent_state in ('ACTIVE','PAUSED','WITHDRAWN')),
  constraint node_versions_lifecycle_ck
    check (lifecycle_status in ('ACTIVE','SUPERSEDED','RETRACTED')),
  constraint node_versions_supersession_shape_ck
    check (
      (lifecycle_status = 'SUPERSEDED' and superseded_by_version_id is not null)
      or
      (lifecycle_status in ('ACTIVE','RETRACTED') and superseded_by_version_id is null)
    )
);

alter table wf_direction.node_versions
  add constraint node_versions_superseded_same_record_fk
  foreign key (superseded_by_version_id, node_id, owner_id)
  references wf_direction.node_versions(id, node_id, owner_id)
  on delete restrict
  deferrable initially deferred;

alter table wf_direction.nodes
  add constraint nodes_current_version_same_record_fk
  foreign key (current_version_id, id, owner_id)
  references wf_direction.node_versions(id, node_id, owner_id)
  on delete restrict
  deferrable initially deferred;

create unique index node_versions_one_active_idx
  on wf_direction.node_versions (node_id)
  where lifecycle_status = 'ACTIVE';

create table wf_direction.edges (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null unique default gen_random_uuid(),
  schema_version smallint not null default 1,
  owner_id uuid not null,
  from_node_id uuid not null,
  to_node_id uuid not null,
  relation text not null,
  lifecycle_status text not null default 'ACTIVE',
  retracted_at timestamptz,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint direction_edges_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint direction_edges_actor_owner_fk
    foreign key (actor_owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint direction_edges_from_owner_fk
    foreign key (from_node_id, owner_id)
    references wf_direction.nodes(id, owner_id)
    on delete restrict,
  constraint direction_edges_to_owner_fk
    foreign key (to_node_id, owner_id)
    references wf_direction.nodes(id, owner_id)
    on delete restrict,
  constraint direction_edges_id_owner_uq unique (id, owner_id),
  constraint direction_edges_schema_version_ck check (schema_version > 0),
  constraint direction_edges_relation_ck
    check (relation in ('SUPPORTS','PART_OF','DEPENDS_ON','BLOCKS','CONTRADICTS','SUPERSEDES','RELATES_TO')),
  constraint direction_edges_lifecycle_ck
    check (lifecycle_status in ('ACTIVE','RETRACTED')),
  constraint direction_edges_retraction_time_ck
    check (
      (lifecycle_status = 'ACTIVE' and retracted_at is null)
      or
      (lifecycle_status = 'RETRACTED' and retracted_at is not null)
    ),
  constraint direction_edges_not_self_part_dependency_ck
    check (
      relation not in ('PART_OF','DEPENDS_ON')
      or from_node_id <> to_node_id
    )
);

create index direction_edges_lookup_idx
  on wf_direction.edges (owner_id, from_node_id, to_node_id, relation)
  where lifecycle_status = 'ACTIVE';

create index direction_edges_to_lookup_idx
  on wf_direction.edges (owner_id, to_node_id, relation)
  where lifecycle_status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- PRACTICE LIFE-DOMAIN MODULE
-- ---------------------------------------------------------------------------

create table wf_practice.practices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  description text,
  lifecycle_status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint practices_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint practices_id_owner_uq unique (id, owner_id),
  constraint practices_lifecycle_ck
    check (lifecycle_status in ('ACTIVE','RETRACTED'))
);

create table wf_practice.sessions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  current_version_id uuid,
  created_at timestamptz not null default now(),
  constraint sessions_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint sessions_id_owner_uq unique (id, owner_id)
);

create table wf_practice.session_versions (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null,
  owner_id uuid not null,
  version_no bigint not null,
  schema_version smallint not null default 1,
  practice_id uuid not null,
  occurred_from timestamptz not null,
  occurred_to timestamptz,
  occurred_from_precision text not null default 'INSTANT',
  occurred_to_precision text,
  occurred_zone_id text,
  duration_seconds integer,
  focus text,
  lifecycle_status text not null,
  superseded_by_version_id uuid,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint session_versions_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint session_versions_actor_owner_fk
    foreign key (actor_owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint session_versions_session_owner_fk
    foreign key (session_id, owner_id)
    references wf_practice.sessions(id, owner_id)
    on delete restrict,
  constraint session_versions_practice_owner_fk
    foreign key (practice_id, owner_id)
    references wf_practice.practices(id, owner_id)
    on delete restrict,
  constraint session_versions_session_version_uq unique (session_id, version_no),
  constraint session_versions_id_session_owner_uq unique (id, session_id, owner_id),
  constraint session_versions_version_no_ck check (version_no > 0),
  constraint session_versions_schema_version_ck check (schema_version > 0),
  constraint session_versions_lifecycle_ck
    check (lifecycle_status in ('ACTIVE','SUPERSEDED','RETRACTED')),
  constraint session_versions_supersession_shape_ck
    check (
      (lifecycle_status = 'SUPERSEDED' and superseded_by_version_id is not null)
      or
      (lifecycle_status in ('ACTIVE','RETRACTED') and superseded_by_version_id is null)
    ),
  constraint session_versions_occurrence_range_ck
    check (occurred_to is null or occurred_to > occurred_from),
  constraint session_versions_duration_ck
    check (duration_seconds is null or duration_seconds > 0),
  constraint session_versions_from_precision_ck
    check (occurred_from_precision in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR')),
  constraint session_versions_to_precision_ck
    check (occurred_to_precision is null or occurred_to_precision in ('INSTANT','MINUTE','HOUR','DAY','MONTH','YEAR')),
  constraint session_versions_end_precision_shape_ck
    check (
      (occurred_to is null and occurred_to_precision is null)
      or
      (occurred_to is not null and occurred_to_precision is not null)
    )
);

alter table wf_practice.session_versions
  add constraint session_versions_superseded_same_record_fk
  foreign key (superseded_by_version_id, session_id, owner_id)
  references wf_practice.session_versions(id, session_id, owner_id)
  on delete restrict
  deferrable initially deferred;

alter table wf_practice.sessions
  add constraint sessions_current_version_same_record_fk
  foreign key (current_version_id, id, owner_id)
  references wf_practice.session_versions(id, session_id, owner_id)
  on delete restrict
  deferrable initially deferred;

create unique index session_versions_one_active_idx
  on wf_practice.session_versions (session_id)
  where lifecycle_status = 'ACTIVE';

create index practices_owner_name_idx
  on wf_practice.practices (owner_id, name);

create index session_versions_recent_active_idx
  on wf_practice.session_versions (owner_id, occurred_from desc)
  where lifecycle_status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- EVIDENCE CORE MODULE
-- ---------------------------------------------------------------------------

create table wf_evidence.links (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null unique default gen_random_uuid(),
  schema_version smallint not null default 1,
  owner_id uuid not null,
  source_namespace text not null,
  source_type text not null,
  source_record_id uuid not null,
  source_version_id uuid not null,
  target_namespace text not null,
  target_type text not null,
  target_record_id uuid not null,
  target_version_id uuid not null,
  target_aspect text,
  relation text not null,
  reason text,
  lifecycle_status text not null default 'ACTIVE',
  retracted_at timestamptz,
  provenance_source_type text not null,
  provenance_source_id text,
  actor_owner_id uuid,
  recorded_at timestamptz not null default now(),
  constraint evidence_links_owner_fk
    foreign key (owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint evidence_links_actor_owner_fk
    foreign key (actor_owner_id)
    references wf_system.owners(id)
    on delete restrict,
  constraint evidence_links_id_owner_uq unique (id, owner_id),
  constraint evidence_links_schema_version_ck check (schema_version > 0),
  constraint evidence_links_relation_ck
    check (relation in ('SUPPORTS','WEAKENS','CONTRADICTS','QUALIFIES')),
  constraint evidence_links_lifecycle_ck
    check (lifecycle_status in ('ACTIVE','RETRACTED')),
  constraint evidence_links_retraction_time_ck
    check (
      (lifecycle_status = 'ACTIVE' and retracted_at is null)
      or
      (lifecycle_status = 'RETRACTED' and retracted_at is not null)
    ),
  constraint evidence_links_no_direct_self_evidence_ck
    check (not (
      source_namespace = target_namespace
      and source_type = target_type
      and source_record_id = target_record_id
      and source_version_id = target_version_id
    ))
);

create index evidence_links_source_idx
  on wf_evidence.links (
    owner_id,
    source_namespace,
    source_type,
    source_record_id,
    source_version_id
  )
  where lifecycle_status = 'ACTIVE';

create index evidence_links_target_idx
  on wf_evidence.links (
    owner_id,
    target_namespace,
    target_type,
    target_record_id,
    target_version_id,
    target_aspect
  )
  where lifecycle_status = 'ACTIVE';

-- ---------------------------------------------------------------------------
-- LIFECYCLE / IMMUTABILITY PROTECTION
-- ---------------------------------------------------------------------------

create or replace function wf_direction.protect_node_version_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.node_id is distinct from old.node_id
     or new.owner_id is distinct from old.owner_id
     or new.version_no is distinct from old.version_no
     or new.schema_version is distinct from old.schema_version
     or new.title is distinct from old.title
     or new.description is distinct from old.description
     or new.intent_state is distinct from old.intent_state
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'node version semantic payload is immutable';
  end if;

  if old.lifecycle_status in ('SUPERSEDED','RETRACTED') then
    if new.lifecycle_status is distinct from old.lifecycle_status
       or new.superseded_by_version_id is distinct from old.superseded_by_version_id then
      raise exception 'terminal node version lifecycle cannot be changed';
    end if;
  elsif old.lifecycle_status = 'ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED','RETRACTED') then
      raise exception 'invalid node version lifecycle transition';
    end if;
  end if;

  return new;
end;
$$;

create trigger node_versions_protect_update_trg
before update on wf_direction.node_versions
for each row execute function wf_direction.protect_node_version_update();

create or replace function wf_direction.protect_node_identity_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.kind is distinct from old.kind
     or new.created_at is distinct from old.created_at then
    raise exception 'direction node identity fields are immutable';
  end if;
  return new;
end;
$$;

create trigger nodes_protect_identity_update_trg
before update on wf_direction.nodes
for each row execute function wf_direction.protect_node_identity_update();

create or replace function wf_direction.assert_node_head_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_node_id uuid;
  v_owner_id uuid;
  v_current uuid;
  v_status text;
  v_active_count integer;
begin
  if tg_table_name = 'nodes' then
    v_node_id := coalesce(new.id, old.id);
    v_owner_id := coalesce(new.owner_id, old.owner_id);
  else
    v_node_id := coalesce(new.node_id, old.node_id);
    v_owner_id := coalesce(new.owner_id, old.owner_id);
  end if;

  select n.current_version_id
    into v_current
    from wf_direction.nodes n
   where n.id = v_node_id and n.owner_id = v_owner_id;

  if not found then
    return null;
  end if;

  select count(*)
    into v_active_count
    from wf_direction.node_versions v
   where v.node_id = v_node_id
     and v.owner_id = v_owner_id
     and v.lifecycle_status = 'ACTIVE';

  if v_current is null then
    if exists (
      select 1 from wf_direction.node_versions v
       where v.node_id = v_node_id and v.owner_id = v_owner_id
    ) then
      raise exception 'direction node with versions must have current_version_id';
    end if;
    return null;
  end if;

  select v.lifecycle_status
    into v_status
    from wf_direction.node_versions v
   where v.id = v_current
     and v.node_id = v_node_id
     and v.owner_id = v_owner_id;

  if not found then
    raise exception 'direction node current_version_id does not resolve';
  end if;

  if v_status = 'SUPERSEDED' then
    raise exception 'direction node current_version_id cannot reference SUPERSEDED version';
  elsif v_status = 'ACTIVE' and v_active_count <> 1 then
    raise exception 'active direction node must have exactly one ACTIVE version';
  elsif v_status = 'RETRACTED' and v_active_count <> 0 then
    raise exception 'retracted direction node cannot retain an ACTIVE version';
  end if;

  return null;
end;
$$;

create constraint trigger nodes_head_integrity_trg
after insert or update on wf_direction.nodes
deferrable initially deferred
for each row execute function wf_direction.assert_node_head_integrity();

create constraint trigger node_versions_head_integrity_trg
after insert or update or delete on wf_direction.node_versions
deferrable initially deferred
for each row execute function wf_direction.assert_node_head_integrity();

create or replace function wf_direction.protect_edge_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.version_id is distinct from old.version_id
     or new.schema_version is distinct from old.schema_version
     or new.owner_id is distinct from old.owner_id
     or new.from_node_id is distinct from old.from_node_id
     or new.to_node_id is distinct from old.to_node_id
     or new.relation is distinct from old.relation
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'direction edge semantic payload is immutable';
  end if;

  if old.lifecycle_status = 'RETRACTED' then
    if new.lifecycle_status is distinct from old.lifecycle_status
       or new.retracted_at is distinct from old.retracted_at then
      raise exception 'retracted direction edge cannot reactivate';
    end if;
  elsif old.lifecycle_status = 'ACTIVE' and new.lifecycle_status not in ('ACTIVE','RETRACTED') then
    raise exception 'invalid direction edge lifecycle transition';
  end if;

  return new;
end;
$$;

create trigger direction_edges_protect_update_trg
before update on wf_direction.edges
for each row execute function wf_direction.protect_edge_update();

create or replace function wf_practice.protect_practice_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at then
    raise exception 'practice identity fields are immutable';
  end if;

  if old.lifecycle_status = 'RETRACTED' and new.lifecycle_status is distinct from old.lifecycle_status then
    raise exception 'retracted practice cannot reactivate';
  elsif old.lifecycle_status = 'ACTIVE' and new.lifecycle_status not in ('ACTIVE','RETRACTED') then
    raise exception 'invalid practice lifecycle transition';
  end if;

  return new;
end;
$$;

create trigger practices_protect_update_trg
before update on wf_practice.practices
for each row execute function wf_practice.protect_practice_update();

create or replace function wf_practice.protect_session_version_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.session_id is distinct from old.session_id
     or new.owner_id is distinct from old.owner_id
     or new.version_no is distinct from old.version_no
     or new.schema_version is distinct from old.schema_version
     or new.practice_id is distinct from old.practice_id
     or new.occurred_from is distinct from old.occurred_from
     or new.occurred_to is distinct from old.occurred_to
     or new.occurred_from_precision is distinct from old.occurred_from_precision
     or new.occurred_to_precision is distinct from old.occurred_to_precision
     or new.occurred_zone_id is distinct from old.occurred_zone_id
     or new.duration_seconds is distinct from old.duration_seconds
     or new.focus is distinct from old.focus
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'practice session version semantic payload is immutable';
  end if;

  if old.lifecycle_status in ('SUPERSEDED','RETRACTED') then
    if new.lifecycle_status is distinct from old.lifecycle_status
       or new.superseded_by_version_id is distinct from old.superseded_by_version_id then
      raise exception 'terminal practice session version lifecycle cannot be changed';
    end if;
  elsif old.lifecycle_status = 'ACTIVE' then
    if new.lifecycle_status not in ('ACTIVE','SUPERSEDED','RETRACTED') then
      raise exception 'invalid practice session version lifecycle transition';
    end if;
  end if;

  return new;
end;
$$;

create trigger session_versions_protect_update_trg
before update on wf_practice.session_versions
for each row execute function wf_practice.protect_session_version_update();

create or replace function wf_practice.protect_session_identity_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.owner_id is distinct from old.owner_id
     or new.created_at is distinct from old.created_at then
    raise exception 'practice session identity fields are immutable';
  end if;
  return new;
end;
$$;

create trigger sessions_protect_identity_update_trg
before update on wf_practice.sessions
for each row execute function wf_practice.protect_session_identity_update();

create or replace function wf_practice.assert_session_head_integrity()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
declare
  v_session_id uuid;
  v_owner_id uuid;
  v_current uuid;
  v_status text;
  v_active_count integer;
begin
  if tg_table_name = 'sessions' then
    v_session_id := coalesce(new.id, old.id);
    v_owner_id := coalesce(new.owner_id, old.owner_id);
  else
    v_session_id := coalesce(new.session_id, old.session_id);
    v_owner_id := coalesce(new.owner_id, old.owner_id);
  end if;

  select s.current_version_id
    into v_current
    from wf_practice.sessions s
   where s.id = v_session_id and s.owner_id = v_owner_id;

  if not found then
    return null;
  end if;

  select count(*)
    into v_active_count
    from wf_practice.session_versions v
   where v.session_id = v_session_id
     and v.owner_id = v_owner_id
     and v.lifecycle_status = 'ACTIVE';

  if v_current is null then
    if exists (
      select 1 from wf_practice.session_versions v
       where v.session_id = v_session_id and v.owner_id = v_owner_id
    ) then
      raise exception 'practice session with versions must have current_version_id';
    end if;
    return null;
  end if;

  select v.lifecycle_status
    into v_status
    from wf_practice.session_versions v
   where v.id = v_current
     and v.session_id = v_session_id
     and v.owner_id = v_owner_id;

  if not found then
    raise exception 'practice session current_version_id does not resolve';
  end if;

  if v_status = 'SUPERSEDED' then
    raise exception 'practice session current_version_id cannot reference SUPERSEDED version';
  elsif v_status = 'ACTIVE' and v_active_count <> 1 then
    raise exception 'active practice session must have exactly one ACTIVE version';
  elsif v_status = 'RETRACTED' and v_active_count <> 0 then
    raise exception 'retracted practice session cannot retain an ACTIVE version';
  end if;

  return null;
end;
$$;

create constraint trigger sessions_head_integrity_trg
after insert or update on wf_practice.sessions
deferrable initially deferred
for each row execute function wf_practice.assert_session_head_integrity();

create constraint trigger session_versions_head_integrity_trg
after insert or update or delete on wf_practice.session_versions
deferrable initially deferred
for each row execute function wf_practice.assert_session_head_integrity();

create or replace function wf_evidence.protect_link_update()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id
     or new.version_id is distinct from old.version_id
     or new.schema_version is distinct from old.schema_version
     or new.owner_id is distinct from old.owner_id
     or new.source_namespace is distinct from old.source_namespace
     or new.source_type is distinct from old.source_type
     or new.source_record_id is distinct from old.source_record_id
     or new.source_version_id is distinct from old.source_version_id
     or new.target_namespace is distinct from old.target_namespace
     or new.target_type is distinct from old.target_type
     or new.target_record_id is distinct from old.target_record_id
     or new.target_version_id is distinct from old.target_version_id
     or new.target_aspect is distinct from old.target_aspect
     or new.relation is distinct from old.relation
     or new.reason is distinct from old.reason
     or new.provenance_source_type is distinct from old.provenance_source_type
     or new.provenance_source_id is distinct from old.provenance_source_id
     or new.actor_owner_id is distinct from old.actor_owner_id
     or new.recorded_at is distinct from old.recorded_at then
    raise exception 'evidence link semantic payload is immutable';
  end if;

  if old.lifecycle_status = 'RETRACTED' then
    if new.lifecycle_status is distinct from old.lifecycle_status
       or new.retracted_at is distinct from old.retracted_at then
      raise exception 'retracted evidence link cannot reactivate';
    end if;
  elsif old.lifecycle_status = 'ACTIVE' and new.lifecycle_status not in ('ACTIVE','RETRACTED') then
    raise exception 'invalid evidence link lifecycle transition';
  end if;

  return new;
end;
$$;

create trigger evidence_links_protect_update_trg
before update on wf_evidence.links
for each row execute function wf_evidence.protect_link_update();

-- ---------------------------------------------------------------------------
-- PRIVILEGE BOUNDARY
-- ---------------------------------------------------------------------------

revoke all on schema wf_system from public, anon, authenticated;
revoke all on schema wf_direction from public, anon, authenticated;
revoke all on schema wf_practice from public, anon, authenticated;
revoke all on schema wf_evidence from public, anon, authenticated;

revoke all on all tables in schema wf_system from public, anon, authenticated;
revoke all on all tables in schema wf_direction from public, anon, authenticated;
revoke all on all tables in schema wf_practice from public, anon, authenticated;
revoke all on all tables in schema wf_evidence from public, anon, authenticated;

revoke all on all functions in schema wf_system from public, anon, authenticated;
revoke all on all functions in schema wf_direction from public, anon, authenticated;
revoke all on all functions in schema wf_practice from public, anon, authenticated;
revoke all on all functions in schema wf_evidence from public, anon, authenticated;

alter default privileges in schema wf_system revoke all on tables from public, anon, authenticated;
alter default privileges in schema wf_direction revoke all on tables from public, anon, authenticated;
alter default privileges in schema wf_practice revoke all on tables from public, anon, authenticated;
alter default privileges in schema wf_evidence revoke all on tables from public, anon, authenticated;

alter default privileges in schema wf_system revoke execute on functions from public, anon, authenticated;
alter default privileges in schema wf_direction revoke execute on functions from public, anon, authenticated;
alter default privileges in schema wf_practice revoke execute on functions from public, anon, authenticated;
alter default privileges in schema wf_evidence revoke execute on functions from public, anon, authenticated;

comment on table wf_system.owners is 'Wayfinder owner authority scope and Supabase Auth mapping.';
comment on table wf_system.command_receipts is 'Durable command retry/idempotency identity and terminal result.';
comment on table wf_system.module_change_outbox is 'Transactional durable module-change publication outbox; not lived-life history.';
comment on table wf_direction.nodes is 'Stable logical Direction node identities.';
comment on table wf_direction.node_versions is 'Immutable semantic versions of Direction nodes with correction lifecycle.';
comment on table wf_direction.edges is 'Immutable Direction graph relations; lifecycle may retract a relation.';
comment on table wf_practice.practices is 'Practice entities; Slice 1A display metadata is intentionally unversioned.';
comment on table wf_practice.sessions is 'Stable logical PracticeSession identities.';
comment on table wf_practice.session_versions is 'Immutable semantic PracticeSession versions with correction lifecycle.';
comment on table wf_evidence.links is 'Version-addressed evidence bearing; generic refs are resolver-validated by owning modules.';

commit;
