begin;

-- Performance hardening discovered by the first live Supabase advisor pass.
-- These indexes cover FK lookup paths used by delete/update integrity checks.

-- Replace narrow current-version indexes with the exact composite FK shape.
drop index if exists wf_direction.nodes_current_version_idx;
drop index if exists wf_practice.sessions_current_version_idx;

create index nodes_owner_idx
  on wf_direction.nodes (owner_id);

create index nodes_current_version_fk_idx
  on wf_direction.nodes (current_version_id, id, owner_id);

create index node_versions_node_owner_fk_idx
  on wf_direction.node_versions (node_id, owner_id);

create index node_versions_superseded_fk_idx
  on wf_direction.node_versions (superseded_by_version_id, node_id, owner_id);

create index sessions_owner_idx
  on wf_practice.sessions (owner_id);

create index sessions_current_version_fk_idx
  on wf_practice.sessions (current_version_id, id, owner_id);

create index session_versions_session_owner_fk_idx
  on wf_practice.session_versions (session_id, owner_id);

create index session_versions_superseded_fk_idx
  on wf_practice.session_versions (superseded_by_version_id, session_id, owner_id);

commit;
