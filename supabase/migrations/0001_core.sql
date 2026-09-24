-- Storyframe core schema (§16). Apply with `supabase db push` or the SQL editor.
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 60),
  locale text not null default 'en',
  accessibility jsonb not null default '{}'::jsonb,
  analytics_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null,
  tagline text,
  synopsis text,
  cover_url text not null default '',
  visibility text not null default 'draft'
    check (visibility in ('draft','unlisted','public','disabled')),
  content_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.story_versions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  version text not null,
  protocol_version text not null,
  state_schema_version integer not null check (state_schema_version > 0),
  entrypoint_url text not null,
  package_sha256 text not null unique,
  manifest jsonb not null,
  validation_report jsonb not null default '{}'::jsonb,
  status text not null default 'candidate'
    check (status in ('candidate','approved','rejected','retired')),
  created_at timestamptz not null default now(),
  unique (story_id, version)
);

create table public.story_releases (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  story_version_id uuid not null references public.story_versions(id),
  channel text not null check (channel in ('preview','beta','production','disabled')),
  promoted_by uuid references auth.users(id),
  promoted_at timestamptz not null default now()
);
create unique index one_active_release_per_channel
  on public.story_releases (story_id, channel);

create table public.reader_timelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  name text not null default 'Main timeline',
  is_primary boolean not null default true,
  parent_timeline_id uuid references public.reader_timelines(id),
  forked_at_revision bigint,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index reader_one_primary_timeline
  on public.reader_timelines (user_id, story_id)
  where is_primary and archived_at is null;

create table public.reader_progress (
  timeline_id uuid primary key references public.reader_timelines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  story_version_id uuid references public.story_versions(id),
  revision bigint not null default 0 check (revision >= 0),
  checkpoint_id text not null,
  checkpoint_order integer not null default 0,
  state_schema_version integer not null,
  snapshot jsonb not null,
  completion_state text not null default 'in_progress'
    check (completion_state in ('not_started','in_progress','completed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  check (octet_length(snapshot::text) <= 262144)
);

create table public.progress_operations (
  id bigint generated always as identity primary key,
  operation_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  timeline_id uuid not null references public.reader_timelines(id) on delete cascade,
  base_revision bigint not null,
  resulting_revision bigint,
  operation_type text not null,
  payload jsonb not null,
  status text not null check (status in ('accepted','conflict','rejected')),
  created_at timestamptz not null default now(),
  unique (user_id, operation_id)
);

create table public.progress_backups (
  id bigint generated always as identity primary key,
  timeline_id uuid not null references public.reader_timelines(id) on delete cascade,
  revision bigint not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (timeline_id, revision)
);

create table public.user_achievements (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, story_id, achievement_id)
);

create table public.archive_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  story_id uuid not null references public.stories(id) on delete cascade,
  timeline_id uuid not null references public.reader_timelines(id) on delete cascade,
  item_id text not null,
  checkpoint_id text not null,
  discovered_at timestamptz not null default now(),
  primary key (user_id, story_id, item_id)
);

create table public.choice_aggregates (
  story_id uuid not null references public.stories(id) on delete cascade,
  choice_id text not null,
  option_id text not null,
  reader_count bigint not null default 0,
  primary key (story_id, choice_id, option_id)
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor uuid references auth.users(id),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index reader_progress_user_recent on public.reader_progress (user_id, updated_at desc);
create index progress_operations_timeline_recent on public.progress_operations (timeline_id, created_at desc);
