-- Étape 3 : salons et parties en ligne.
-- Toutes les écritures passent par la fonction serveur "partie" (clé de service) : les joueurs ne font que lire.

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  public boolean not null default false,
  hote uuid not null,
  statut text not null default 'attente' check (statut in ('attente', 'en_jeu', 'terminee')),
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);

create table public.salon_joueurs (
  salon_id uuid not null references public.salons (id) on delete cascade,
  joueur_id uuid not null,
  pseudo text not null,
  photo_url text,
  est_robot boolean not null default false,
  pret boolean not null default false,
  place int not null,
  rejoint_le timestamptz not null default now(),
  primary key (salon_id, joueur_id)
);
create index salon_joueurs_par_joueur on public.salon_joueurs (joueur_id);

-- Joueurs exclus par l'hôte : ils ne peuvent plus revenir dans ce salon.
create table public.salon_exclus (
  salon_id uuid not null references public.salons (id) on delete cascade,
  joueur_id uuid not null,
  primary key (salon_id, joueur_id)
);

-- Ce que tout le monde voit de la partie (sans les mains ni le paquet).
create table public.parties (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  version int not null default 0,
  vue jsonb not null,
  termine boolean not null default false,
  cree_le timestamptz not null default now(),
  maj_le timestamptz not null default now()
);
create index parties_par_salon on public.parties (salon_id);

-- État complet et secret de la partie (mains de tous, paquet) : jamais lisible par un joueur.
create table public.parties_etat (
  partie_id uuid primary key references public.parties (id) on delete cascade,
  etat jsonb not null,
  extra jsonb not null default '{}'
);

-- La main de chaque joueur, visible par lui seul.
create table public.mains (
  partie_id uuid not null references public.parties (id) on delete cascade,
  joueur_id uuid not null,
  vue jsonb not null,
  version int not null default 0,
  primary key (partie_id, joueur_id)
);

alter table public.salons enable row level security;
alter table public.salon_joueurs enable row level security;
alter table public.salon_exclus enable row level security;
alter table public.parties enable row level security;
alter table public.parties_etat enable row level security;
alter table public.mains enable row level security;

create policy "Salons visibles" on public.salons for select to authenticated using (true);
create policy "Joueurs des salons visibles" on public.salon_joueurs for select to authenticated using (true);
create policy "Partie visible par ses joueurs" on public.parties for select to authenticated
  using (exists (select 1 from public.salon_joueurs sj where sj.salon_id = parties.salon_id and sj.joueur_id = auth.uid()));
create policy "Sa propre main" on public.mains for select to authenticated using (joueur_id = auth.uid());
-- salon_exclus et parties_etat : aucune politique, donc aucun accès joueur.

revoke all on public.salons, public.salon_joueurs, public.salon_exclus, public.parties, public.parties_etat, public.mains from anon;
revoke insert, update, delete, truncate, references, trigger on public.salons, public.salon_joueurs, public.salon_exclus, public.parties, public.parties_etat, public.mains from authenticated;
grant select on public.salons, public.salon_joueurs, public.parties, public.mains to authenticated;
revoke all on public.salon_exclus, public.parties_etat from authenticated;

-- Diffusion en temps réel des changements.
alter publication supabase_realtime add table public.salons, public.salon_joueurs, public.parties, public.mains;
alter table public.mains replica identity full;
alter table public.salon_joueurs replica identity full;

-- Écriture atomique de l'état d'une partie (vérification de version contre les coups simultanés).
create or replace function public.ecrire_partie(p_partie uuid, p_version int, p_etat jsonb, p_extra jsonb, p_vue jsonb, p_mains jsonb, p_termine boolean)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  -- Réservé au serveur (clé de service) : un joueur ne peut jamais écrire l'état d'une partie.
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Accès refusé.';
  end if;
  update public.parties set version = version + 1, vue = p_vue, termine = p_termine, maj_le = now()
    where id = p_partie and version = p_version;
  if not found then return false; end if;
  update public.parties_etat set etat = p_etat, extra = p_extra where partie_id = p_partie;
  insert into public.mains (partie_id, joueur_id, vue, version)
    select p_partie, t.k::uuid, t.v, p_version + 1 from jsonb_each(p_mains) as t(k, v)
    on conflict (partie_id, joueur_id) do update set vue = excluded.vue, version = excluded.version;
  return true;
end $$;
