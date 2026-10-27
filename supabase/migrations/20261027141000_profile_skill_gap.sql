alter table public.profiles
  add column if not exists skills_to_practice text[] not null default '{}',
  add column if not exists project_experience text[] not null default '{}';
