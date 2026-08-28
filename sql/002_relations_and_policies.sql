-- =====================================================================
--  Mトリープ  マイグレーション（photos 作成済みの環境に追加するぶん）
--
--  前提として合わせたこと：
--    ・photos は作成済み。CREATE TABLE はせず、FK の追加だけを行う
--    ・photos のポリシーには一切触れない（SELECT/INSERT 設定済み、UPDATE/DELETE 不可のまま）
--    ・Storage の photos バケットは Private のまま。Public には変更しない
--    ・trips / scenes / panels は、フロントが実際に使う操作だけを許可
--
--  上から順に実行してください。
-- =====================================================================


-- ---------------------------------------------------------------------
--  0. 事前チェック（FK を張る前に必ず実行）
--
--  photos に、trips に存在しない trip_id が入っていると 1 の FK 追加が失敗します。
--  下の 2 つが両方 0 件であることを確認してください。
-- ---------------------------------------------------------------------

-- trip_id が NULL の行
-- select count(*) from photos where trip_id is null;

-- trips に存在しない trip_id を持つ行
-- select count(*) from photos p
--   where p.trip_id is not null
--     and not exists (select 1 from trips t where t.id = p.trip_id);


-- ---------------------------------------------------------------------
--  1. trips（無ければ作る）
-- ---------------------------------------------------------------------
create table if not exists trips (
  id          uuid primary key default gen_random_uuid(),
  owner_token text not null,                 -- ログイン代わりの匿名ID
  title       text,
  created_at  timestamptz not null default now()
);

create index if not exists trips_owner_idx on trips (owner_token, created_at desc);


-- ---------------------------------------------------------------------
--  2. photos.trip_id に外部キーを追加
--     ※ 既存テーブルには触らず、制約とインデックスだけを足します
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'photos_trip_id_fkey'
  ) then
    alter table photos
      add constraint photos_trip_id_fkey
      foreign key (trip_id) references trips(id) on delete cascade;
  end if;
end $$;

-- シーン分割で「その旅行の写真を撮影時刻順に」引くため
create index if not exists photos_trip_captured_idx on photos (trip_id, captured_at);


-- ---------------------------------------------------------------------
--  3. scenes / panels
-- ---------------------------------------------------------------------
create table if not exists scenes (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  seq        int  not null,                  -- 日記のコマ順
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  photo_ids  uuid[] not null default '{}',   -- 中間テーブルの代わり
  is_gap     boolean not null default false, -- true = 写真が無い時間帯
  summary    text,                           -- 文章。生成側が後から書く
  created_at timestamptz not null default now()
);

create index if not exists scenes_trip_seq_idx on scenes (trip_id, seq);

create table if not exists panels (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  scene_id   uuid not null references scenes(id) on delete cascade,
  seq        int  not null,
  mode       text not null,                  -- 'i2i' | 'gen'
  status     text not null default 'pending',-- pending | running | done | failed
  image_path text,
  prompt     text,
  attempts   int  not null default 0,
  error      text,
  created_at timestamptz not null default now()
);

-- trip_id を重複して持たせているのは Realtime のフィルタのためです。
-- scenes 経由でも辿れますが、Realtime のフィルタはテーブルを跨げません。
create index if not exists panels_trip_seq_idx on panels (trip_id, seq);


-- ---------------------------------------------------------------------
--  4. RLS
--
--  フロント（anon）が実際に行う操作だけを許可しています。
--  生成側の Python は secret key（service_role）で接続するため RLS を
--  バイパスします。よって panels の UPDATE ポリシーは不要です。
--
--   trips  … SELECT / INSERT
--   scenes … SELECT / INSERT / DELETE
--   panels … SELECT / INSERT
--
--  scenes の DELETE は「シーン分割のやり直し」に必要です。
--  閾値を変えて作り直す操作がデモ前に必ず発生するため、ここだけ DELETE を許可しています。
--  panels は scene_id の ON DELETE CASCADE で一緒に消えるので、
--  panels 側の DELETE ポリシーは不要です（カスケードは RLS を経由しません）。
-- ---------------------------------------------------------------------
alter table trips  enable row level security;
alter table scenes enable row level security;
alter table panels enable row level security;

-- trips
create policy "trips_select_anon" on trips for select to anon using (true);
create policy "trips_insert_anon" on trips for insert to anon with check (true);

-- scenes
create policy "scenes_select_anon" on scenes for select to anon using (true);
create policy "scenes_insert_anon" on scenes for insert to anon with check (true);
create policy "scenes_delete_anon" on scenes for delete to anon using (true);

-- panels
create policy "panels_select_anon" on panels for select to anon using (true);
create policy "panels_insert_anon" on panels for insert to anon with check (true);


-- ---------------------------------------------------------------------
--  5. Realtime（できたコマから順に画面へ出すために必須）
--     すでに追加済みでもエラーにならないようにしています
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'panels'
  ) then
    execute 'alter publication supabase_realtime add table panels';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scenes'
  ) then
    execute 'alter publication supabase_realtime add table scenes';
  end if;
end $$;


-- ---------------------------------------------------------------------
--  Storage について
--
--  photos バケットは Private のままで問題ありません。
--  フロント側は getPublicUrl ではなく createSignedUrl で表示するように直しました。
--  必要な権限は、すでに設定済みの anon の INSERT / SELECT だけです。
--
--  1点だけ確認したいこと：
--  アップロード後に DB への登録が失敗したとき、こちらのコードは
--  上げた画像を消して整合を保とうとします。anon に DELETE が無い場合、
--  その削除は失敗し、使われない画像がバケットに残ります。
--  害はないので DELETE は付けなくて構いませんが、
--  「たまに孤児ファイルが残る」ことだけ認識を合わせておければ十分です。
-- ---------------------------------------------------------------------
