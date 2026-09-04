create extension if not exists pgcrypto;
create type public.project_status as enum ('draft','submitted','approved','rejected','archived');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  avatar_url text,
  bio text not null default '' check (char_length(bio) <= 500),
  locale text not null default 'en' check (locale in ('ja','en')),
  created_at timestamptz not null default now()
);
create table public.app_roles (user_id uuid primary key references auth.users(id) on delete cascade, role text not null check (role in ('admin','reviewer')));
create table public.projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id) on delete cascade,
  slug text unique not null check (slug ~ '^[a-z0-9-]{3,80}$'), title text not null check (char_length(title) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000), category text not null,
  schema_version int not null default 1, generator_version text not null default '0.1.0', status public.project_status not null default 'draft',
  parent_project_id uuid references public.projects(id) on delete set null, current_revision_id uuid,
  code_license text not null default 'MIT' check (code_license='MIT'), media_license text not null default 'CC-BY-4.0' check (media_license='CC-BY-4.0'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), published_at timestamptz
);
create table public.project_revisions (
  id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade,
  revision int not null check (revision > 0), document jsonb not null, thumbnail_path text, bundle_path text, bundle_sha256 text,
  validation_report jsonb not null default '{}', release_notes text not null default '', created_at timestamptz not null default now(),
  unique(project_id, revision)
);
alter table public.projects add constraint projects_current_revision_fk foreign key (current_revision_id) references public.project_revisions(id) on delete set null;
create table public.favorites (user_id uuid references public.profiles(id) on delete cascade, project_id uuid references public.projects(id) on delete cascade, created_at timestamptz not null default now(), primary key(user_id,project_id));
create table public.moderation_reviews (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, reviewer_id uuid not null references public.profiles(id), decision text not null check (decision in ('approved','rejected')), note text not null default '', created_at timestamptz not null default now());
create table public.reports (id uuid primary key default gen_random_uuid(), project_id uuid not null references public.projects(id) on delete cascade, reporter_id uuid references public.profiles(id) on delete set null, reason text not null, details text not null default '', status text not null default 'open', created_at timestamptz not null default now());

alter table public.profiles enable row level security; alter table public.app_roles enable row level security; alter table public.projects enable row level security; alter table public.project_revisions enable row level security; alter table public.favorites enable row level security; alter table public.moderation_reviews enable row level security; alter table public.reports enable row level security;
create policy "profiles public read" on public.profiles for select using (true);
create policy "profiles self update" on public.profiles for update using (auth.uid()=id) with check (auth.uid()=id);
create policy "approved projects public read" on public.projects for select using (status='approved' or owner_id=auth.uid() or exists(select 1 from public.app_roles where user_id=auth.uid()));
create policy "project owners insert" on public.projects for insert with check (owner_id=auth.uid() and status in ('draft','submitted'));
create policy "project owners update draft" on public.projects for update using (owner_id=auth.uid() and status in ('draft','rejected')) with check (owner_id=auth.uid() and status in ('draft','submitted'));
create policy "approved revisions public read" on public.project_revisions for select using (exists(select 1 from public.projects p where p.id=project_id and (p.status='approved' or p.owner_id=auth.uid())) or exists(select 1 from public.app_roles where user_id=auth.uid()));
create policy "revision owners insert" on public.project_revisions for insert with check (exists(select 1 from public.projects p where p.id=project_id and p.owner_id=auth.uid() and p.status in ('draft','rejected')));
create policy "favorites public read" on public.favorites for select using (true);
create policy "favorites self insert" on public.favorites for insert with check (user_id=auth.uid());
create policy "favorites self delete" on public.favorites for delete using (user_id=auth.uid());
create policy "reports auth insert" on public.reports for insert with check (reporter_id=auth.uid());
create policy "moderators read reviews" on public.moderation_reviews for select using (exists(select 1 from public.app_roles where user_id=auth.uid()));

insert into storage.buckets (id,name,public) values ('private-submissions','private-submissions',false),('public-thumbnails','public-thumbnails',true),('public-bundles','public-bundles',true) on conflict do nothing;
create policy "submission owners upload" on storage.objects for insert to authenticated with check (bucket_id='private-submissions' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "submission owners read" on storage.objects for select to authenticated using (bucket_id='private-submissions' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.app_roles where user_id=auth.uid())));
create policy "approved storage public read" on storage.objects for select using (bucket_id in ('public-thumbnails','public-bundles'));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into public.profiles(id,display_name,avatar_url) values(new.id,coalesce(new.raw_user_meta_data->>'user_name',split_part(new.email,'@',1),'Creator'),new.raw_user_meta_data->>'avatar_url'); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
