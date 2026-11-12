-- Blackjack du Capitaine : tables, secrets (sabot), journal des mouvements de Louidors.
-- (Appliqué en production via le connecteur ; voir le contenu complet dans l'historique Supabase « blackjack ».)
create table if not exists public.bj_tables (id uuid primary key default gen_random_uuid(), type text not null check (type in ('public', 'solo', 'privee')), code text unique, hote uuid, etat jsonb not null, version int not null default 0, cree_le timestamptz not null default now(), maj_le timestamptz not null default now());
create unique index if not exists bj_une_seule_publique on public.bj_tables ((type)) where type = 'public';
create table if not exists public.bj_secrets (table_id uuid primary key references public.bj_tables(id) on delete cascade, secret jsonb not null);
create table if not exists public.bj_journal (id bigserial primary key, joueur uuid not null, table_id uuid, delta int not null, raison text not null, le timestamptz not null default now());
