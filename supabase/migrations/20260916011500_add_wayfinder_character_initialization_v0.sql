begin;

-- Wayfinder Character Initialization orchestration v0.1
--
-- Character is still a projection, not a canonical module. This RPC exists only
-- to preserve one indivisible player intent across the canonical modules that
-- own the initial facts. It calls module-owned command boundaries inside one
-- outer database transaction; it does not create a Character truth table.

create or replace function public.wf_character_initialize_v0(
  p_command_id uuid,
  p_display_name text,
  p_birth_date date default null,
  p_birth_time_local time without time zone default null,
  p_birth_time_accuracy text default null,
  p_birth_place_label text default null,
  p_height_value numeric default null,
  p_height_unit text default null,
  p_weight_value numeric default null,
  p_weight_unit text default null,
  p_body_observed_at timestamptz default null,
  p_body_zone_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_owner uuid;
  v_name text;
  v_birth_accuracy text;
  v_birth_place text;
  v_height_unit text;
  v_weight_unit text;
  v_body_zone_request text;
  v_body_zone_effective text;
  v_body_observed_at timestamptz;
  v_hash text;
  v_claim record;
  v_current_person jsonb;

  v_person_command uuid;
  v_height_command uuid;
  v_weight_command uuid;
  v_person_response jsonb;
  v_height_response jsonb;
  v_weight_response jsonb;
  v_refs jsonb := '[]'::jsonb;
  v_failure_code text;
begin
  v_owner := wf_system.require_authenticated_owner();

  -- Normalize material for command identity while preserving null defaults as
  -- null when the runtime-resolved value could change between retries.
  v_name := btrim(p_display_name);
  v_birth_place := nullif(btrim(p_birth_place_label),'');
  v_birth_accuracy := case
    when p_birth_time_local is null then null
    when p_birth_time_accuracy is null or btrim(p_birth_time_accuracy) = '' then 'EXACT'
    else upper(btrim(p_birth_time_accuracy))
  end;
  v_body_zone_request := nullif(btrim(p_body_zone_id),'');

  v_height_unit := case lower(btrim(p_height_unit))
    when 'cm' then 'cm'
    when 'centimeter' then 'cm'
    when 'centimeters' then 'cm'
    when 'm' then 'm'
    when 'meter' then 'm'
    when 'meters' then 'm'
    when 'in' then 'in'
    when 'inch' then 'in'
    when 'inches' then 'in'
    else null
  end;

  v_weight_unit := case lower(btrim(p_weight_unit))
    when 'kg' then 'kg'
    when 'kgs' then 'kg'
    when 'kilogram' then 'kg'
    when 'kilograms' then 'kg'
    when 'lb' then 'lb'
    when 'lbs' then 'lb'
    when 'pound' then 'lb'
    when 'pounds' then 'lb'
    else null
  end;

  v_hash := wf_system.command_hash(pg_catalog.jsonb_build_object(
    'contract','character.initialize.v0.1',
    'display_name',v_name,
    'birth_date',p_birth_date,
    'birth_time_local',p_birth_time_local,
    'birth_time_accuracy',v_birth_accuracy,
    'birth_place_label',v_birth_place,
    'height_value',p_height_value,
    'height_unit',v_height_unit,
    'weight_value',p_weight_value,
    'weight_unit',v_weight_unit,
    'body_observed_at',p_body_observed_at,
    'body_zone_id',v_body_zone_request
  ));

  select * into v_claim
    from wf_system.claim_command(
      v_owner,p_command_id,'system','character.initialize_v0',v_hash
    );

  if not v_claim.is_new then
    return wf_system.command_response(v_owner,p_command_id,true);
  end if;

  -- Validate cross-field orchestration shape before any child mutation.
  if (p_height_value is null) <> (p_height_unit is null) then
    perform wf_system.complete_command(
      v_owner,p_command_id,'REJECTED',null,'INCOMPLETE_HEIGHT_MEASUREMENT'
    );
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if (p_weight_value is null) <> (p_weight_unit is null) then
    perform wf_system.complete_command(
      v_owner,p_command_id,'REJECTED',null,'INCOMPLETE_WEIGHT_MEASUREMENT'
    );
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if p_height_value is not null and v_height_unit is null then
    perform wf_system.complete_command(
      v_owner,p_command_id,'REJECTED',null,'INVALID_BODY_MEASUREMENT_UNIT'
    );
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  if p_weight_value is not null and v_weight_unit is null then
    perform wf_system.complete_command(
      v_owner,p_command_id,'REJECTED',null,'INVALID_BODY_MEASUREMENT_UNIT'
    );
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  -- Initialization is intentionally first-run only. A successful prior
  -- initialization is replayed via the same command id; a new command id after
  -- Person exists must not silently append another set of "initial" Body facts.
  v_current_person := public.wf_person_current_v0();
  if (v_current_person->'person') is distinct from 'null'::jsonb then
    perform wf_system.complete_command(
      v_owner,p_command_id,'REJECTED',null,'CHARACTER_ALREADY_INITIALIZED'
    );
    return wf_system.command_response(v_owner,p_command_id,false);
  end if;

  select o.timezone into v_body_zone_effective
    from wf_system.owners o
   where o.id = v_owner;
  v_body_zone_effective := coalesce(v_body_zone_request,v_body_zone_effective);
  v_body_observed_at := coalesce(p_body_observed_at,pg_catalog.clock_timestamp());

  v_person_command := gen_random_uuid();
  if p_height_value is not null then v_height_command := gen_random_uuid(); end if;
  if p_weight_value is not null then v_weight_command := gen_random_uuid(); end if;

  -- This inner exception block is a PostgreSQL subtransaction. If any required
  -- module command fails/rejects, every child canonical write/receipt/outbox row
  -- is rolled back together while the outer orchestration receipt remains able
  -- to record a clean REJECTED result.
  begin
    v_person_response := public.wf_person_create(
      v_person_command,
      v_name,
      p_birth_date,
      p_birth_time_local,
      v_birth_accuracy,
      v_birth_place
    );

    if v_person_response->>'status' <> 'APPLIED' then
      v_failure_code := case
        when v_person_response->>'status' = 'NOOP' then 'CHARACTER_ALREADY_INITIALIZED'
        else coalesce(v_person_response->>'error_code','PERSON_INITIALIZATION_FAILED')
      end;
      raise exception using errcode = 'P0001', message = 'CHARACTER_CHILD_COMMAND_REJECTED';
    end if;

    v_refs := v_refs || coalesce(v_person_response->'affected_refs','[]'::jsonb);

    if p_height_value is not null then
      v_height_response := public.wf_body_record_measurement(
        v_height_command,
        'height',
        p_height_value,
        v_height_unit,
        v_body_observed_at,
        v_body_zone_effective
      );

      if v_height_response->>'status' <> 'APPLIED' then
        v_failure_code := coalesce(
          v_height_response->>'error_code','HEIGHT_INITIALIZATION_FAILED'
        );
        raise exception using errcode = 'P0001', message = 'CHARACTER_CHILD_COMMAND_REJECTED';
      end if;

      v_refs := v_refs || coalesce(v_height_response->'affected_refs','[]'::jsonb);
    end if;

    if p_weight_value is not null then
      v_weight_response := public.wf_body_record_measurement(
        v_weight_command,
        'weight',
        p_weight_value,
        v_weight_unit,
        v_body_observed_at,
        v_body_zone_effective
      );

      if v_weight_response->>'status' <> 'APPLIED' then
        v_failure_code := coalesce(
          v_weight_response->>'error_code','WEIGHT_INITIALIZATION_FAILED'
        );
        raise exception using errcode = 'P0001', message = 'CHARACTER_CHILD_COMMAND_REJECTED';
      end if;

      v_refs := v_refs || coalesce(v_weight_response->'affected_refs','[]'::jsonb);
    end if;

    -- Correlate the module-owned change rows back to the one player intent.
    update wf_system.module_change_outbox
       set correlation_id = p_command_id
     where owner_id = v_owner
       and command_id in (v_person_command,v_height_command,v_weight_command);

  exception when others then
    v_failure_code := coalesce(v_failure_code,'CHARACTER_INITIALIZATION_FAILED');
    perform wf_system.complete_command(
      v_owner,p_command_id,'REJECTED',null,v_failure_code
    );
    return wf_system.command_response(v_owner,p_command_id,false);
  end;

  perform wf_system.complete_command(
    v_owner,p_command_id,'APPLIED',v_refs,null
  );

  -- No additional ModuleChange is emitted for Character itself because
  -- Character remains a projection. Person and Body already published their
  -- canonical changes, correlated by this outer command id.
  return wf_system.command_response(v_owner,p_command_id,false);
end;
$$;

comment on function public.wf_character_initialize_v0(
  uuid,text,date,time without time zone,text,text,numeric,text,numeric,text,timestamptz,text
) is
  'Atomic first-run Character Creation orchestration. Character is not persisted; Person and optional initial Body measurements remain owned by their modules and commit or roll back together for this user intent.';

revoke all on function public.wf_character_initialize_v0(
  uuid,text,date,time without time zone,text,text,numeric,text,numeric,text,timestamptz,text
) from public, anon;

grant execute on function public.wf_character_initialize_v0(
  uuid,text,date,time without time zone,text,text,numeric,text,numeric,text,timestamptz,text
) to authenticated;

commit;
