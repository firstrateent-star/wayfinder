begin;

create index if not exists body_measurement_versions_measurement_owner_fk_idx
  on wf_body.measurement_versions(measurement_id, owner_id);
create index if not exists body_measurement_versions_superseded_record_owner_fk_idx
  on wf_body.measurement_versions(superseded_by_version_id, measurement_id, owner_id);
create index if not exists body_measurements_current_record_owner_fk_idx
  on wf_body.measurements(current_version_id, id, owner_id);

create index if not exists person_versions_person_owner_fk_idx
  on wf_person.person_versions(person_id, owner_id);
create index if not exists person_versions_superseded_record_owner_fk_idx
  on wf_person.person_versions(superseded_by_version_id, person_id, owner_id);
create index if not exists persons_current_record_owner_fk_idx
  on wf_person.persons(current_version_id, id, owner_id);

create index if not exists schedule_versions_actor_owner_fk_idx
  on wf_schedule.allocation_versions(actor_owner_id);
create index if not exists schedule_versions_allocation_owner_fk_idx
  on wf_schedule.allocation_versions(allocation_id, owner_id);
create index if not exists schedule_versions_superseded_record_owner_fk_idx
  on wf_schedule.allocation_versions(superseded_by_version_id, allocation_id, owner_id);
create index if not exists schedule_allocations_current_record_owner_fk_idx
  on wf_schedule.allocations(current_version_id, id, owner_id);

commit;
