begin;

create schema if not exists wf_system;
create schema if not exists wf_direction;
create schema if not exists wf_practice;
create schema if not exists wf_evidence;

comment on schema wf_system is 'Wayfinder system kernel: owner identity, commands, outbox, and shared infrastructure.';
comment on schema wf_direction is 'Wayfinder Direction core module: values, directions, outcomes, commitments, quests, plans, actions, and graph structure.';
comment on schema wf_practice is 'Wayfinder Practice life-domain module: practices and lived practice sessions.';
comment on schema wf_evidence is 'Wayfinder Evidence core module: explicit evidence relationships across version-addressed records.';

revoke all on schema wf_system from public, anon, authenticated;
revoke all on schema wf_direction from public, anon, authenticated;
revoke all on schema wf_practice from public, anon, authenticated;
revoke all on schema wf_evidence from public, anon, authenticated;

commit;
