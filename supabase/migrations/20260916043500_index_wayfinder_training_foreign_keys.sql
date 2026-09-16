begin;

create index if not exists training_sets_session_version_fk_idx
  on wf_training.exercise_sets(session_version_id, session_id, owner_id);

create index if not exists training_versions_session_owner_fk_idx
  on wf_training.session_versions(session_id, owner_id);

create index if not exists training_versions_superseded_record_owner_fk_idx
  on wf_training.session_versions(superseded_by_version_id, session_id, owner_id)
  where superseded_by_version_id is not null;

create index if not exists training_sessions_current_record_owner_fk_idx
  on wf_training.sessions(current_version_id, id, owner_id)
  where current_version_id is not null;

commit;
