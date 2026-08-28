-- =====================================================================
--  Mトリープ  テーブル定義  （A担当に実行してもらうもの）
--
--  Supabase の SQL Editor に貼って実行してください。
--  photos は確定したスキーマそのままです。
--  scenes / panels はパイプ側で先回りして用意したものなので、
--  列名の相談があればそちらに合わせて直します。
-- =====================================================================

create table if not exists trips (
  id          uuid primary key default gen_random_uuid(),
  owner_token text not null,                 -- ログイン代わりの匿名ID
  title       text,
  created_at  timestamptz not null default now()
);

create table if not exists photos (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references trips(id) on delete cascade,
  uploaded_by   uuid,
  storage_path  text not null,
  captured_at   timestamptz,                 -- ★ 重要だが NOT NULL にはしないこと
  location_name text,
  latitude      double precision,
  longitude     double precision,
  caption       text,
  created_at    timestamptz not null default now()
);

-- シーン分割で「その旅行の写真を時刻順に」引くので
create index if not exists photos_trip_captured_idx
  on photos (trip_id, captured_at);

create table if not exists scenes (
  id         uuid primary key default gen_random_uuid(),
  trip_id    uuid not null references trips(id) on delete cascade,
  seq        int  not null,                  -- 日記のコマ順
  started_at timestamptz not null,
  ended_at   timestamptz not null,
  photo_ids  uuid[] not null default '{}',   -- 中間テーブルの代わり
  is_gap     boolean not null default false, -- true = 写真がない時間帯
  summary    text,                           -- LLMが書く文章
  created_at timestamptz not null default now()
);

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

-- panels に trip_id を重ねて持たせているのは Realtime のフィルタのためです。
-- scenes 経由でも辿れますが、Realtime のフィルタはテーブルを跨げません。
create index if not exists panels_trip_seq_idx on panels (trip_id, seq);

-- ---------------------------------------------------------------------
--  RLS  （これを貼らないと、データを入れても読めません）
--  ※ ハッカソン用の全開放。発表後に公開し続ける場合は必ず絞ること
-- ---------------------------------------------------------------------
alter table trips  enable row level security;
alter table photos enable row level security;
alter table scenes enable row level security;
alter table panels enable row level security;

create policy "open" on trips  for all using (true) with check (true);
create policy "open" on photos for all using (true) with check (true);
create policy "open" on scenes for all using (true) with check (true);
create policy "open" on panels for all using (true) with check (true);

-- ---------------------------------------------------------------------
--  Realtime  （できたコマから順に画面へ出すために必須）
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table panels;
alter publication supabase_realtime add table scenes;

-- ---------------------------------------------------------------------
--  このあと、ダッシュボードで手作業が1つあります
--    Storage → New bucket → 名前 photos → Public bucket を ON
-- ---------------------------------------------------------------------
