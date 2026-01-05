-- Drop the function first to ensure a clean slate
drop function if exists get_partners;

-- Re-create the function with explicit security and permissions
-- We rename 'id' to 'partner_id' to avoid "ambiguous column" errors in PL/pgSQL
create or replace function get_partners()
returns table (
  partner_id uuid, 
  email varchar,
  username text,
  role text,
  created_at timestamptz
)
security definer
as $$
begin
  -- Check if the user is an owner or admin (or service role)
  -- We use alias 'u' for auth.users to avoid ambiguity
  if auth.role() = 'service_role' or exists (
    select 1 from auth.users as u
    where u.id = auth.uid() 
    and (u.raw_user_meta_data->>'role')::text in ('owner', 'admin')
  ) then
    return query
    select 
      au.id as partner_id, 
      au.email::varchar, 
      (au.raw_user_meta_data->>'username')::text as username,
      (au.raw_user_meta_data->>'role')::text as role,
      au.created_at
    from auth.users au
    where (au.raw_user_meta_data->>'role')::text = 'partner'
    order by au.created_at desc;
  else
    raise exception 'Access denied: User is not an owner or admin';
  end if;
end;
$$ language plpgsql;

-- Grant execution permissions
grant execute on function get_partners to authenticated;
grant execute on function get_partners to service_role;
