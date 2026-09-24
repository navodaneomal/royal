-- sf_commit_progress: the §35 write path as ONE transaction.
-- Called only by the progress-commit edge function (service role).
create or replace function public.sf_commit_progress(
  p_user uuid, p_timeline uuid, p_story uuid,
  p_operation uuid, p_base_revision bigint,
  p_operation_type text, p_payload jsonb,
  p_snapshot jsonb, p_checkpoint text, p_checkpoint_order integer,
  p_schema_version integer,
  p_items text[], p_achievements text[], p_ending text,
  p_retention integer default 10
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_current bigint;
  v_revision bigint;
begin
  -- lock the progress row (or take the insert path)
  select revision into v_current from reader_progress
    where timeline_id = p_timeline for update;

  if v_current is null then
    v_current := 0;
  end if;

  if p_base_revision <> v_current then
    insert into progress_operations
      (operation_id, user_id, timeline_id, base_revision, resulting_revision, operation_type, payload, status)
      values (p_operation, p_user, p_timeline, p_base_revision, v_current, p_operation_type, p_payload, 'conflict');
    return jsonb_build_object('status', 'conflict', 'revision', v_current);
  end if;

  v_revision := v_current + 1;

  insert into reader_progress
    (timeline_id, user_id, story_id, revision, checkpoint_id, checkpoint_order,
     state_schema_version, snapshot, completion_state, completed_at, updated_at)
  values
    (p_timeline, p_user, p_story, v_revision, p_checkpoint, p_checkpoint_order,
     p_schema_version, p_snapshot,
     case when p_ending is not null then 'completed' else 'in_progress' end,
     case when p_ending is not null then now() else null end, now())
  on conflict (timeline_id) do update set
    revision = v_revision, checkpoint_id = p_checkpoint, checkpoint_order = p_checkpoint_order,
    state_schema_version = p_schema_version, snapshot = p_snapshot,
    completion_state = case when p_ending is not null then 'completed' else reader_progress.completion_state end,
    completed_at = coalesce(reader_progress.completed_at, case when p_ending is not null then now() else null end),
    updated_at = now();

  insert into progress_operations
    (operation_id, user_id, timeline_id, base_revision, resulting_revision, operation_type, payload, status)
    values (p_operation, p_user, p_timeline, p_base_revision, v_revision, p_operation_type, p_payload, 'accepted');

  insert into progress_backups (timeline_id, revision, snapshot)
    values (p_timeline, v_revision, p_snapshot)
    on conflict (timeline_id, revision) do nothing;
  delete from progress_backups
    where timeline_id = p_timeline
      and revision <= v_revision - p_retention;

  insert into archive_entries (user_id, story_id, timeline_id, item_id, checkpoint_id)
    select p_user, p_story, p_timeline, unnest(p_items), p_checkpoint
    on conflict do nothing;

  insert into user_achievements (user_id, story_id, achievement_id)
    select p_user, p_story, unnest(p_achievements)
    on conflict do nothing;

  return jsonb_build_object(
    'status', 'accepted', 'revision', v_revision,
    'snapshot_hash', encode(digest(p_snapshot::text, 'sha256'), 'hex')
  );
end $$;

revoke all on function public.sf_commit_progress from public, anon, authenticated;
