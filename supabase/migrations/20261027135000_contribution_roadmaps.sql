create table if not exists public.contribution_roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  issue_id bigint not null references public.github_issues (id) on delete cascade,
  owner text not null,
  repository text not null,
  issue_number integer not null check (issue_number > 0),
  issue_title text not null,
  issue_url text not null,
  roadmap jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, issue_id)
);

create index if not exists contribution_roadmaps_user_updated_idx
  on public.contribution_roadmaps (user_id, updated_at desc);

alter table public.contribution_roadmaps enable row level security;

drop policy if exists "Users can read their own contribution roadmaps" on public.contribution_roadmaps;
create policy "Users can read their own contribution roadmaps"
  on public.contribution_roadmaps for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own contribution roadmaps" on public.contribution_roadmaps;
create policy "Users can create their own contribution roadmaps"
  on public.contribution_roadmaps for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own contribution roadmaps" on public.contribution_roadmaps;
create policy "Users can update their own contribution roadmaps"
  on public.contribution_roadmaps for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own contribution roadmaps" on public.contribution_roadmaps;
create policy "Users can delete their own contribution roadmaps"
  on public.contribution_roadmaps for delete to authenticated
  using (auth.uid() = user_id);

revoke all on public.contribution_roadmaps from anon, public;
grant select, insert, update, delete on public.contribution_roadmaps to authenticated;
