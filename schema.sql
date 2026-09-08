-- ============================================================================
-- Jette là — schéma Supabase (Postgres)
-- À exécuter une fois, dans l'éditeur SQL du projet Supabase (SQL Editor > New query).
-- Réutilise les mêmes concepts que le prototype Artifact : bins (import OSM),
-- community_bins (propositions), votes, reports (signalements), feedback (avis).
-- ============================================================================

create extension if not exists postgis;
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- 0. Admins — créée en premier car d'autres tables la référencent dans leurs
-- règles de sécurité (RLS) ci-dessous. Vraie authentification (remplace le
-- code en dur de l'Artifact) : un compte devient admin en étant ajouté ici
-- manuellement après sa création (voir README, étape 6).
-- ----------------------------------------------------------------------------
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table admins enable row level security;
create policy "an admin can see their own admin row"
  on admins for select
  using (auth.uid() = user_id);
-- Pas de policy insert/update/delete : un admin s'ajoute manuellement depuis
-- l'éditeur SQL Supabase après avoir créé son compte (voir README, étape 6).

-- ----------------------------------------------------------------------------
-- 1. Poubelles importées (référentiel OpenStreetMap, en lecture seule côté client)
-- ----------------------------------------------------------------------------
create table if not exists bins (
  id text primary key,               -- ex. "osm-160251451"
  lat double precision not null,
  lon double precision not null,
  geog geography(Point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) stored,
  category text not null check (category in ('corbeille','tri','collecte')),
  subtypes text[] not null default '{}',   -- sous-ensemble de {verre,papier,emballages,textile}
  commune text not null,
  department text,                          -- ex. "76-seine-maritime" (utile à l'échelle nationale)
  source text not null default 'osm',
  created_at timestamptz not null default now()
);
create extension if not exists pg_trgm;
create index if not exists bins_geog_idx on bins using gist (geog);
create index if not exists bins_commune_idx on bins using gin (commune gin_trgm_ops);

alter table bins enable row level security;
create policy "bins are publicly readable"
  on bins for select
  using (true);
-- Pas d'insert/update/delete côté client : le référentiel est chargé par
-- scripts/import_data.py avec la clé service_role (voir README).

-- ----------------------------------------------------------------------------
-- 2. Propositions communautaires (poubelles manquantes ajoutées par les usagers)
-- ----------------------------------------------------------------------------
create table if not exists community_bins (
  id uuid primary key default gen_random_uuid(),
  lat double precision not null,
  lon double precision not null,
  geog geography(Point, 4326) generated always as (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography
  ) stored,
  category text not null check (category in ('corbeille','tri','collecte')),
  subtypes text[] not null default '{}',
  commune text not null,
  note text,
  added_by text not null,             -- identifiant anonyme d'appareil (localStorage), pas un vrai compte
  created_at timestamptz not null default now()
);
create index if not exists community_bins_geog_idx on community_bins using gist (geog);

alter table community_bins enable row level security;
create policy "community bins are publicly readable"
  on community_bins for select
  using (true);
create policy "anyone can propose a community bin"
  on community_bins for insert
  with check (true);
create policy "only admins can delete a community bin"
  on community_bins for delete
  using (exists (select 1 from admins where admins.user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. Votes sur les propositions communautaires (façon Waze, seuil net à 3)
-- ----------------------------------------------------------------------------
create table if not exists votes (
  id uuid primary key default gen_random_uuid(),
  community_bin_id uuid not null references community_bins(id) on delete cascade,
  voter_id text not null,
  value smallint not null check (value in (1, -1)),
  voted_at timestamptz not null default now(),
  unique (community_bin_id, voter_id)
);

alter table votes enable row level security;
create policy "votes are publicly readable"
  on votes for select
  using (true);
create policy "anyone can cast a vote"
  on votes for insert
  with check (true);
create policy "anyone can change their own vote"
  on votes for update
  using (true)
  with check (true);

-- Vue : propositions validées par la communauté (net >= 3), à fusionner avec `bins`
create or replace view validated_community_bins as
select cb.id, cb.lat, cb.lon, cb.geog, cb.category, cb.subtypes, cb.commune,
       'communaute'::text as source, cb.created_at
from community_bins cb
where (
  select coalesce(sum(v.value), 0)
  from votes v
  where v.community_bin_id = cb.id
) >= 3;

-- Vue : tous les points affichables sur la carte (référentiel + communauté validée)
create or replace view all_bins as
select id, lat, lon, geog, category, subtypes, commune, source, created_at from bins
union all
select id::text, lat, lon, geog, category, subtypes, commune, source, created_at from validated_community_bins;

-- ----------------------------------------------------------------------------
-- 4. Signalements (pleine / cassée / sale / manquante), avec photo optionnelle
-- ----------------------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  bin_id text not null,               -- id d'un bins.id OU d'un community_bins.id (pas de FK, les deux tables coexistent)
  kind text not null check (kind in ('plein','casse','sale','manquante')),
  note text,
  photo_url text,                     -- URL publique dans le bucket de stockage "report-photos"
  created_by text not null,           -- identifiant anonyme d'appareil
  created_at timestamptz not null default now()
);
create index if not exists reports_bin_id_idx on reports (bin_id);

alter table reports enable row level security;
create policy "reports are publicly readable"
  on reports for select
  using (true);
create policy "anyone can submit a report"
  on reports for insert
  with check (true);
create policy "only admins can delete a report"
  on reports for delete
  using (exists (select 1 from admins where admins.user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 5. Avis ("Donner un avis") — lecture réservée aux admins, écriture publique
-- ----------------------------------------------------------------------------
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  rating smallint check (rating between 1 and 5),
  comment text,
  created_by text not null,
  created_at timestamptz not null default now()
);

alter table feedback enable row level security;
create policy "anyone can submit feedback"
  on feedback for insert
  with check (true);
create policy "only admins can read feedback"
  on feedback for select
  using (exists (select 1 from admins where admins.user_id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 6. (admins déjà créée en tout début de script, section 0)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 7. Realtime — pour que les signalements/propositions/votes se propagent en direct
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table reports;
alter publication supabase_realtime add table community_bins;
alter publication supabase_realtime add table votes;

-- ----------------------------------------------------------------------------
-- 8. Stockage des photos de signalement
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict (id) do nothing;

create policy "anyone can upload a report photo"
  on storage.objects for insert
  with check (bucket_id = 'report-photos');
create policy "report photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'report-photos');
