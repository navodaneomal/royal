-- v2: guest → account import and "keep this device" (progress-import).
-- One transaction: the primary timeline is created if missing; if it
-- already has progress, that snapshot (or the incoming one) is ARCHIVED as
-- its own timeline before the new canonical snapshot is written. Nothing is
-- ever overwritten without a copy. Service role only.
create or replace function public.sf_import_progress(
  p_user uuid, p_story uuid,
  p_snapshot jsonb, p_archive jsonb, p_archive_name text,
  p_checkpoint text, p_checkpoint_order integer, p_schema_version integer,
  p_items text[], p_achievements text[], p_completed boolean
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_timeline uuid;
  v_archived uuid;
  v_revision bigint;
begin
  select id into v_timeline from reader_timelines
    where user_id = p_user and story_id = p_story and is_primary and archived_at is null
    for update;
  if v_timeline is null then
    insert into reader_timelines (user_id, story_id, name) values (p_user, p_story, 'Main timeline')
      returning id into v_timeline;
  end if;

  select revision into v_revision from reader_progress where timeline_id = v_timeline for update;

  if p_archive is not null then
    insert into reader_timelines (user_id, story_id, name, is_primary, parent_timeline_id, forked_at_revision, archived_at)
      values (p_user, p_story, p_archive_name, false, v_timeline, coalesce(v_revision, 0), now())
      returning id into v_archived;
    insert into reader_progress (timeline_id, user_id, story_id, revision, checkpoint_id, checkpoint_order, state_schema_version, snapshot)
      values (v_archived, p_user, p_story, 1, p_archive->>'checkpointId', coalesce((p_archive->>'checkpointOrder')::int, 0),
              coalesce((p_archive->>'stateSchemaVersion')::int, p_schema_version), p_archive);
  end if;

  v_revision := coalesce(v_revision, 0) + 1;
  insert into reader_progress (timeline_id, user_id, story_id, revision, checkpoint_id, checkpoint_order,
                               state_schema_version, snapshot, completion_state, completed_at, updated_at)
    values (v_timeline, p_user, p_story, v_revision, p_checkpoint, p_checkpoint_order, p_schema_version, p_snapshot,
            case when p_completed then 'completed' else 'in_progress' end,
            case when p_completed then now() else null end, now())
    on conflict (timeline_id) do update set
      revision = v_revision, checkpoint_id = p_checkpoint, checkpoint_order = p_checkpoint_order,
      state_schema_version = p_schema_version, snapshot = p_snapshot,
      completion_state = case when p_completed then 'completed' else reader_progress.completion_state end,
      completed_at = coalesce(reader_progress.completed_at, case when p_completed then now() else null end),
      updated_at = now();

  insert into progress_backups (timeline_id, revision, snapshot) values (v_timeline, v_revision, p_snapshot)
    on conflict (timeline_id, revision) do nothing;
  insert into archive_entries (user_id, story_id, timeline_id, item_id, checkpoint_id)
    select p_user, p_story, v_timeline, unnest(p_items), p_checkpoint on conflict do nothing;
  insert into user_achievements (user_id, story_id, achievement_id)
    select p_user, p_story, unnest(p_achievements) on conflict do nothing;

  return jsonb_build_object('timeline_id', v_timeline, 'revision', v_revision, 'archived_timeline_id', v_archived);
end $$;

revoke all on function public.sf_import_progress from public, anon, authenticated;

-- readers may read their own archived timelines' progress (already covered
-- by "reader selects own progress"); nothing else changes in RLS.
