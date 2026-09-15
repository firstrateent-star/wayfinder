begin;

-- Companion hardening for Slice 1A version-head semantics discovered during
-- executable SQL stress testing. Replaces deferred head validators from the
-- core migration; no new tables or ontology concepts are introduced.

create or replace function wf_direction.assert_node_head_integrity()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare
  v_node_id uuid;
  v_owner_id uuid;
  v_current uuid;
  v_status text;
  v_current_no bigint;
  v_max_no bigint;
  v_active_count integer;
begin
  if tg_table_name = 'nodes' then
    if tg_op = 'DELETE' then
      v_node_id := old.id;
      v_owner_id := old.owner_id;
    else
      v_node_id := new.id;
      v_owner_id := new.owner_id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_node_id := old.node_id;
      v_owner_id := old.owner_id;
    else
      v_node_id := new.node_id;
      v_owner_id := new.owner_id;
    end if;
  end if;

  select n.current_version_id into v_current
    from wf_direction.nodes n
   where n.id = v_node_id and n.owner_id = v_owner_id;
  if not found then return null; end if;

  if v_current is null then
    raise exception 'direction node must have a current/latest version at transaction end';
  end if;

  select v.lifecycle_status, v.version_no
    into v_status, v_current_no
    from wf_direction.node_versions v
   where v.id = v_current and v.node_id = v_node_id and v.owner_id = v_owner_id;
  if not found then
    raise exception 'direction node current_version_id does not resolve';
  end if;

  select count(*), max(v.version_no)
    into v_active_count, v_max_no
    from wf_direction.node_versions v
   where v.node_id = v_node_id
     and v.owner_id = v_owner_id
     and v.lifecycle_status = 'ACTIVE';

  -- max(version_no) above is scoped to ACTIVE rows, so calculate the true max separately.
  select max(v.version_no) into v_max_no
    from wf_direction.node_versions v
   where v.node_id = v_node_id and v.owner_id = v_owner_id;

  if v_current_no is distinct from v_max_no then
    raise exception 'direction node current_version_id must point to highest version_no';
  end if;

  if v_status = 'SUPERSEDED' then
    raise exception 'direction node current_version_id cannot reference SUPERSEDED version';
  elsif v_status = 'ACTIVE' and v_active_count <> 1 then
    raise exception 'active direction node must have exactly one ACTIVE version';
  elsif v_status = 'RETRACTED' and v_active_count <> 0 then
    raise exception 'retracted direction node cannot retain an ACTIVE version';
  end if;

  if exists (
    select 1
      from wf_direction.node_versions s
      join wf_direction.node_versions t
        on t.id = s.superseded_by_version_id
       and t.node_id = s.node_id
       and t.owner_id = s.owner_id
     where s.node_id = v_node_id
       and s.owner_id = v_owner_id
       and s.lifecycle_status = 'SUPERSEDED'
       and t.version_no <= s.version_no
  ) then
    raise exception 'direction node supersession must point forward to a higher version_no';
  end if;

  return null;
end;
$$;

create or replace function wf_practice.assert_session_head_integrity()
returns trigger language plpgsql set search_path = pg_catalog as $$
declare
  v_session_id uuid;
  v_owner_id uuid;
  v_current uuid;
  v_status text;
  v_current_no bigint;
  v_max_no bigint;
  v_active_count integer;
begin
  if tg_table_name = 'sessions' then
    if tg_op = 'DELETE' then
      v_session_id := old.id;
      v_owner_id := old.owner_id;
    else
      v_session_id := new.id;
      v_owner_id := new.owner_id;
    end if;
  else
    if tg_op = 'DELETE' then
      v_session_id := old.session_id;
      v_owner_id := old.owner_id;
    else
      v_session_id := new.session_id;
      v_owner_id := new.owner_id;
    end if;
  end if;

  select s.current_version_id into v_current
    from wf_practice.sessions s
   where s.id = v_session_id and s.owner_id = v_owner_id;
  if not found then return null; end if;

  if v_current is null then
    raise exception 'practice session must have a current/latest version at transaction end';
  end if;

  select v.lifecycle_status, v.version_no
    into v_status, v_current_no
    from wf_practice.session_versions v
   where v.id = v_current and v.session_id = v_session_id and v.owner_id = v_owner_id;
  if not found then
    raise exception 'practice session current_version_id does not resolve';
  end if;

  select count(*) into v_active_count
    from wf_practice.session_versions v
   where v.session_id = v_session_id
     and v.owner_id = v_owner_id
     and v.lifecycle_status = 'ACTIVE';

  select max(v.version_no) into v_max_no
    from wf_practice.session_versions v
   where v.session_id = v_session_id and v.owner_id = v_owner_id;

  if v_current_no is distinct from v_max_no then
    raise exception 'practice session current_version_id must point to highest version_no';
  end if;

  if v_status = 'SUPERSEDED' then
    raise exception 'practice session current_version_id cannot reference SUPERSEDED version';
  elsif v_status = 'ACTIVE' and v_active_count <> 1 then
    raise exception 'active practice session must have exactly one ACTIVE version';
  elsif v_status = 'RETRACTED' and v_active_count <> 0 then
    raise exception 'retracted practice session cannot retain an ACTIVE version';
  end if;

  if exists (
    select 1
      from wf_practice.session_versions s
      join wf_practice.session_versions t
        on t.id = s.superseded_by_version_id
       and t.session_id = s.session_id
       and t.owner_id = s.owner_id
     where s.session_id = v_session_id
       and s.owner_id = v_owner_id
       and s.lifecycle_status = 'SUPERSEDED'
       and t.version_no <= s.version_no
  ) then
    raise exception 'practice session supersession must point forward to a higher version_no';
  end if;

  return null;
end;
$$;

commit;
