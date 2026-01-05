-- Drop the function first to ensure a clean slate
drop function if exists get_partners;

-- Re-create the function with explicit security and permissions
create or replace function get_partners()
returns table (
  id uuid,
  email varchar,
  username text,
  role text,
  created_at timestamptz
)
security definer -- Runs with the privileges of the creator (postgres)
as $$
begin
  -- Check if the user is an owner or admin (or service role)
  if auth.role() = 'service_role' or exists (
    select 1 from auth.users 
    where id = auth.uid() 
    and (raw_user_meta_data->>'role')::text in ('owner', 'admin')
  ) then
    return query
    select 
      au.id, 
      au.email::varchar, 
      (au.raw_user_meta_data->>'username')::text as username,
      (au.raw_user_meta_data->>'role')::text as role,
      au.created_at
    from auth.users au
    where (au.raw_user_meta_data->>'role')::text = 'partner'
    order by au.created_at desc;
  else
    -- Explicitly raise an error if permission is denied
    raise exception 'Access denied: User is not an owner or admin';
  end if;
end;
$$ language plpgsql;

-- Grant execution permissions
grant execute on function get_partners to authenticated;
grant execute on function get_partners to service_role;
