-- Run this in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
-- Read each section first. I couldn't see your actual tables/policies, so the
-- "CHECK FIRST" queries tell you what you have before you change anything.
-- Safe to run more than once.

-- =====================================================================
-- 1. INVITE LIST: enforce it in the database (not just in the login page)
-- =====================================================================
-- Without this, anyone can call Supabase auth directly with your public anon key
-- and create an account, skipping the check in /api/auth/check.
-- This blocks any new auth user whose email isn't in allowed_emails.
-- Emails in allowed_emails must be stored lowercase.

create or replace function public.enforce_invite_list()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_emails
    where email = lower(trim(new.email))
  ) then
    raise exception 'This email is not on the invite list.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_invite_list on auth.users;

create trigger enforce_invite_list
  before insert on auth.users
  for each row execute function public.enforce_invite_list();

-- Existing users are NOT affected (the trigger only runs on new signups).
-- Also recommended: Dashboard -> Authentication -> Sign In / Providers ->
-- turn off "Allow new users to sign up" if you'd rather invite users manually.

-- And make sure allowed_emails can't be read or edited from the browser:
alter table public.allowed_emails enable row level security;
-- (no policies = no access for anon/authenticated; your server uses the secret key,
--  which bypasses RLS, so /api/auth/check keeps working)


-- =====================================================================
-- 2. PROFILES: stop users from making themselves admin
-- =====================================================================
-- CHECK FIRST: see which update policies exist on profiles.
--   select policyname, cmd, qual, with_check
--   from pg_policies where tablename = 'profiles';
--
-- Row policies can't restrict columns, so we restrict at the privilege level:
-- browsers (the "authenticated" role) may only update these columns.

revoke update on public.profiles from authenticated;
grant update (display_name, bio, avatar_url) on public.profiles to authenticated;

-- is_admin and marker_color can no longer be changed from the browser.
-- marker_color is now changed by admins through /api/admin/profiles/[id]/color,
-- which uses the server-side secret key.
-- Make sure the policy only lets a user update their own row:
--   create policy "update own profile" on public.profiles
--     for update using (auth.uid() = id) with check (auth.uid() = id);
-- (skip if you already have an equivalent policy)


-- =====================================================================
-- 3. WHITEBOARD: users can only insert/delete their own strokes
-- =====================================================================
-- CHECK FIRST:
--   select policyname, cmd, qual, with_check
--   from pg_policies where tablename = 'whiteboard_strokes';
--
-- You want: SELECT for everyone, INSERT with user_id = auth.uid(),
-- DELETE only own rows (that's what "undo" uses). Admin deletes go through the
-- server, so no admin policy is needed. If any of these are missing:

alter table public.whiteboard_strokes enable row level security;

drop policy if exists "strokes are public" on public.whiteboard_strokes;
create policy "strokes are public" on public.whiteboard_strokes
  for select using (true);

drop policy if exists "insert own strokes" on public.whiteboard_strokes;
create policy "insert own strokes" on public.whiteboard_strokes
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "delete own strokes" on public.whiteboard_strokes;
create policy "delete own strokes" on public.whiteboard_strokes
  for delete to authenticated using (auth.uid() = user_id);

-- If you already have differently-named policies doing the same thing, you may end
-- up with duplicates. That's harmless, but you can drop the old ones in
-- Dashboard -> Authentication -> Policies.


-- =====================================================================
-- 4. STORAGE: limit what can be uploaded to the assets-public bucket
-- =====================================================================
-- Enforces 10MB and images only on the bucket itself, so it can't be bypassed
-- by calling the storage API directly.

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/png','image/jpeg','image/gif','image/webp','image/avif','image/svg+xml']
where id = 'assets-public';

-- NOTE: SVG files can contain scripts. If you don't need SVG uploads, remove
-- 'image/svg+xml' from the list above.

-- Uploads should only be allowed into the user's own folder (<user id>/...) or
-- avatars/<user id>.<ext>. CHECK FIRST:
--   select policyname, cmd, qual, with_check
--   from pg_policies where schemaname = 'storage' and tablename = 'objects';
-- A policy like this keeps users inside their own folder:

drop policy if exists "upload to own folder" on storage.objects;
create policy "upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'assets-public'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or name like 'avatars/' || auth.uid()::text || '.%'
    )
  );

-- Avatars are overwritten with upsert, which also needs an UPDATE policy:
drop policy if exists "update own avatar" on storage.objects;
create policy "update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'assets-public' and name like 'avatars/' || auth.uid()::text || '.%')
  with check (bucket_id = 'assets-public' and name like 'avatars/' || auth.uid()::text || '.%');

-- If you have an older, broader INSERT policy on storage.objects (for example one
-- that only checks bucket_id), drop it, otherwise it still allows uploads anywhere.
