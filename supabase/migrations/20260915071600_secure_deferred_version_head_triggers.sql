begin;

-- Deferred constraint triggers fire at transaction end, after the public RPC's
-- SECURITY DEFINER execution context has returned to the authenticated caller.
-- Because Wayfinder's canonical schemas intentionally deny authenticated users
-- direct schema access, the deferred integrity trigger functions themselves
-- must execute with their postgres owner privileges.

alter function wf_direction.assert_node_head_integrity() security definer;
alter function wf_practice.assert_session_head_integrity() security definer;

comment on function wf_direction.assert_node_head_integrity() is
  'Deferred integrity trigger; SECURITY DEFINER is required because it fires at transaction end after public RPC definer context has returned, while private wf_direction remains inaccessible to authenticated clients.';

comment on function wf_practice.assert_session_head_integrity() is
  'Deferred integrity trigger; SECURITY DEFINER is required because it fires at transaction end after public RPC definer context has returned, while private wf_practice remains inaccessible to authenticated clients.';

commit;
