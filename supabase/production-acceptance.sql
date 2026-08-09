\set ON_ERROR_STOP on

-- 真实生产项目只读/事务内验收。测试写入全部在事务末尾回滚。
do $$
declare
  v_missing text[];
  v_rls_missing text[];
begin
  select array_agg(name) into v_missing from unnest(array[
    'profiles','history','reward_history','economy_ledger','analytics_events',
    'ai_learning_models','ai_learning_experiences','friend_requests','friendships','blocks','reports',
    'direct_messages','direct_message_reads','cluster_instances','cluster_leases','platform_events',
    'cluster_event_cursors','metrics_snapshots'
  ]) name where to_regclass('public.' || name) is null;
  if v_missing is not null then raise exception 'missing_tables:%',v_missing; end if;

  select array_agg(name) into v_rls_missing from unnest(array[
    'profiles','history','reward_history','economy_ledger','analytics_events',
    'ai_learning_models','ai_learning_experiences','friend_requests','friendships','blocks','reports',
    'direct_messages','direct_message_reads','cluster_instances','cluster_leases','platform_events',
    'cluster_event_cursors','metrics_snapshots'
  ]) name where not coalesce((select relrowsecurity from pg_class where oid=to_regclass('public.' || name)),false);
  if v_rls_missing is not null then raise exception 'rls_disabled:%',v_rls_missing; end if;
end $$;

do $$
declare v_missing text[];
begin
  select array_agg(signature) into v_missing from unnest(array[
    'apply_reward_v1(jsonb,text,jsonb,jsonb)',
    'apply_purchase_v1(text,text,integer,integer,text)',
    'apply_ai_learning_v1(jsonb,text,jsonb)',
    'send_direct_message_v1(text,text,text,text,text,text,text,text)',
    'apply_direct_message_read_v1(text,text,text,bigint)',
    'claim_cluster_lease_v1(text,text,integer,text,jsonb)',
    'renew_cluster_lease_v1(text,text,bigint,integer)',
    'append_platform_event_v1(text,text,jsonb,text,text,bigint)',
    'list_platform_events_v1(text,text,integer)',
    'commit_cluster_cursor_v1(text,text,bigint)',
    'append_metrics_snapshot_v1(text,timestamp with time zone,jsonb)',
    'get_direct_message_by_id_v1(text)',
    'cleanup_cluster_data_v1(text,bigint)'
  ]) signature where to_regprocedure('public.' || signature) is null;
  if v_missing is not null then raise exception 'missing_rpcs:%',v_missing; end if;
end $$;

do $$
declare v_name text;
begin
  foreach v_name in array array[
    'profiles','history','reward_history','economy_ledger','analytics_events',
    'ai_learning_models','ai_learning_experiences','friend_requests','friendships','blocks','reports',
    'direct_messages','direct_message_reads','cluster_instances','cluster_leases','platform_events',
    'cluster_event_cursors','metrics_snapshots'
  ] loop
    if has_table_privilege('anon','public.'||v_name,'select,insert,update,delete')
       or has_table_privilege('authenticated','public.'||v_name,'select,insert,update,delete') then
      raise exception 'browser_role_table_privilege:%',v_name;
    end if;
  end loop;
end $$;

begin;
select claim_cluster_lease_v1('acceptance:lease','acceptance-instance-a',15,'acceptance','{"purpose":"production-acceptance"}'::jsonb);
do $$
declare
  v_claim jsonb;
  v_other jsonb;
  v_takeover jsonb;
  v_token bigint;
  v_next_token bigint;
  v_event jsonb;
begin
  v_claim := claim_cluster_lease_v1('acceptance:lease','acceptance-instance-a',15,'acceptance','{}'::jsonb);
  if not coalesce((v_claim->>'claimed')::boolean,false) then raise exception 'lease_claim_failed'; end if;
  v_token := (v_claim->>'fencingToken')::bigint;
  if not coalesce((renew_cluster_lease_v1('acceptance:lease','acceptance-instance-a',v_token,15)->>'renewed')::boolean,false) then
    raise exception 'lease_renew_failed';
  end if;
  v_other := claim_cluster_lease_v1('acceptance:lease','acceptance-instance-b',15,'acceptance','{}'::jsonb);
  if coalesce((v_other->>'claimed')::boolean,false) or (v_other->>'holderInstanceId')<>'acceptance-instance-a' then
    raise exception 'active_lease_was_stolen';
  end if;
  update cluster_leases set lease_until=clock_timestamp()-interval '1 second' where lease_key='acceptance:lease';
  v_takeover := claim_cluster_lease_v1('acceptance:lease','acceptance-instance-b',15,'acceptance','{}'::jsonb);
  v_next_token := (v_takeover->>'fencingToken')::bigint;
  if not coalesce((v_takeover->>'claimed')::boolean,false) or v_next_token<=v_token then raise exception 'expired_lease_takeover_failed'; end if;
  begin
    perform append_platform_event_v1('metrics_snapshot','acceptance:stale-token',
      '{"snapshotId":"stale-token","generatedAt":"2026-08-09T00:00:00Z"}'::jsonb,
      'acceptance-instance-a','acceptance:lease',v_token);
    raise exception 'stale_fencing_token_was_accepted';
  exception when raise_exception then
    if sqlerrm='stale_fencing_token_was_accepted' then raise; end if;
  end;
  update cluster_leases set holder_instance_id='acceptance-instance-a',fencing_token=v_token,lease_until=clock_timestamp()+interval '15 seconds'
    where lease_key='acceptance:lease';
  v_event := append_platform_event_v1('metrics_snapshot','acceptance:event',
    '{"snapshotId":"acceptance-snapshot","generatedAt":"2026-08-09T00:00:00Z"}'::jsonb,
    'acceptance-instance-a','acceptance:lease',v_token);
  if coalesce(v_event->>'id','') !~ '^[0-9]+$' then raise exception 'platform_event_failed'; end if;
  if jsonb_array_length(list_platform_events_v1('acceptance-consumer','metrics_snapshot',10)) <> 1 then
    raise exception 'platform_event_list_failed';
  end if;
  perform commit_cluster_cursor_v1('acceptance-consumer','metrics_snapshot',(v_event->>'id')::bigint);
  if jsonb_array_length(list_platform_events_v1('acceptance-consumer','metrics_snapshot',10)) <> 0 then
    raise exception 'platform_cursor_failed';
  end if;
  perform append_metrics_snapshot_v1('acceptance-instance-a',clock_timestamp(),
    '{"version":"metrics-v2","generatedAt":"2026-08-09T00:00:00Z"}'::jsonb);
  begin
    perform append_platform_event_v1('direct_message','acceptance:reject-body',
      '{"messageId":"acceptance-message","body":"must-never-pass"}'::jsonb,
      'acceptance-instance-a',null,null);
    raise exception 'payload_secret_filter_failed';
  exception when raise_exception then
    if sqlerrm='payload_secret_filter_failed' then raise; end if;
  end;
end $$;
rollback;

select 'PRODUCTION_ACCEPTANCE_PASS' as result;
