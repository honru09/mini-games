\set ON_ERROR_STOP on

-- 仅停用本轮多实例/遥测入口，不删除表、列、序列、消息、奖励或用户数据。
begin;
revoke execute on function claim_cluster_lease_v1(text,text,integer,text,jsonb) from service_role;
revoke execute on function renew_cluster_lease_v1(text,text,bigint,integer) from service_role;
revoke execute on function append_platform_event_v1(text,text,jsonb,text,text,bigint) from service_role;
revoke execute on function list_platform_events_v1(text,text,integer) from service_role;
revoke execute on function commit_cluster_cursor_v1(text,text,bigint) from service_role;
revoke execute on function append_metrics_snapshot_v1(text,timestamptz,jsonb) from service_role;
revoke execute on function get_direct_message_by_id_v1(text) from service_role;
update cluster_leases set lease_until=to_timestamp(0),updated_at=clock_timestamp();
commit;

select 'NON_DESTRUCTIVE_ROLLBACK_PASS' as result;
