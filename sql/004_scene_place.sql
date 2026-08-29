-- 004_scene_place.sql
--
-- コマごとの場所名を、あとから手で直せるようにします。
-- Supabase の SQL Editor に貼って実行してください。1回だけでOKです。
--
-- 場所名は写真の EXIF から自動で入れていますが、屋内や地下では
-- GPS が数十m〜数百mずれるので、どうしても外すことがあります。
-- 直した名前は photos ではなく scenes に持たせます
-- （photos は UPDATE を許可しない方針のため）。

-- 1. 手で直した場所名を入れる列
alter table public.scenes
  add column if not exists place text;

-- 2. ポリシー
drop policy if exists "scenes_update_anon" on public.scenes;

create policy "scenes_update_anon"
  on public.scenes
  for update
  to anon
  using (true)
  with check (true);

-- 3. GRANT
grant update on table public.scenes to anon;

-- 4. 確認
select polname, polcmd
from pg_policy
where polrelid = 'public.scenes'::regclass
order by polname;
