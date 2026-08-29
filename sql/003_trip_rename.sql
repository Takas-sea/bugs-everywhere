-- 003_trip_rename.sql
--
-- 日記の名前をアプリから変えられるようにします。
-- Supabase の SQL Editor に貼って実行してください。1回だけでOKです。
--
-- RLS のポリシーと GRANT の両方が要ります。片方だけだと弾かれます。

-- 1. ポリシー（既にあれば作り直す）
drop policy if exists "trips_update_anon" on public.trips;

create policy "trips_update_anon"
  on public.trips
  for update
  to anon
  using (true)
  with check (true);

-- 2. GRANT
grant update on table public.trips to anon;

-- 3. 確認
select polname, polcmd
from pg_policy
where polrelid = 'public.trips'::regclass
order by polname;
