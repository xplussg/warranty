create table if not exists public.usernames (
  id bigserial primary key,
  username text unique not null,
  email text not null,
  created_at timestamptz default now()
);

alter table public.usernames enable row level security;

create policy "Allow read to anon" on public.usernames
  for select using (true);

create policy "Allow insert to service" on public.usernames
  for insert with check (true);
