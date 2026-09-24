-- RLS baseline (§16.4). Progress writes go ONLY through the progress-commit
-- function; clients never insert/update authoritative tables directly.
alter table public.profiles enable row level security;
alter table public.reader_timelines enable row level security;
alter table public.reader_progress enable row level security;
alter table public.progress_operations enable row level security;
alter table public.progress_backups enable row level security;
alter table public.user_achievements enable row level security;
alter table public.archive_entries enable row level security;
alter table public.stories enable row level security;
alter table public.story_versions enable row level security;
alter table public.story_releases enable row level security;
alter table public.choice_aggregates enable row level security;
alter table public.audit_log enable row level security;

create policy "reader selects own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "reader updates own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "reader inserts own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);

create policy "reader selects own timelines" on public.reader_timelines
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reader selects own progress" on public.reader_progress
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reader selects own operations" on public.progress_operations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reader selects own achievements" on public.user_achievements
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "reader selects own archive" on public.archive_entries
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "anyone reads public stories" on public.stories
  for select using (visibility in ('public','unlisted'));
create policy "anyone reads approved versions" on public.story_versions
  for select using (status = 'approved');
create policy "anyone reads releases" on public.story_releases
  for select using (true);
-- choice_aggregates & audit_log: no client policies — service role only.
