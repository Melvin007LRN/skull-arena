-- Étape 10 : amis (demandes, acceptation) et invitations dans un salon.

create table if not exists public.amities (
  demandeur uuid not null references public.profils (id) on delete cascade,
  destinataire uuid not null references public.profils (id) on delete cascade,
  statut text not null default 'attente' check (statut in ('attente', 'acceptee', 'retiree')),
  maj_le timestamptz not null default now(),
  primary key (demandeur, destinataire),
  check (demandeur <> destinataire)
);
alter table public.amities enable row level security;
create policy "Mes amitiés" on public.amities for select to authenticated
  using (auth.uid() in (demandeur, destinataire));
grant select on public.amities to authenticated;

create table if not exists public.invitations (
  id bigint generated always as identity primary key,
  de uuid not null references public.profils (id) on delete cascade,
  a uuid not null references public.profils (id) on delete cascade,
  salon_id uuid not null references public.salons (id) on delete cascade,
  code text not null,
  cree_le timestamptz not null default now()
);
create index if not exists invitations_a on public.invitations (a, cree_le desc);
alter table public.invitations enable row level security;
create policy "Mes invitations" on public.invitations for select to authenticated using (auth.uid() in (de, a));
grant select on public.invitations to authenticated;

alter publication supabase_realtime add table public.amities;
alter publication supabase_realtime add table public.invitations;

-- Le lien d'amitié entre deux joueurs, quel que soit le sens de la demande.
create or replace function public.lien_amitie(x uuid, y uuid) returns public.amities
  language sql stable security definer set search_path = public as $$
  select * from amities where (demandeur = x and destinataire = y) or (demandeur = y and destinataire = x) limit 1
$$;

-- Demander quelqu'un en ami (par son pseudo). Si lui m'avait déjà demandé, on devient amis directement.
create or replace function public.demander_ami(pseudo_ami text) returns text
  language plpgsql security definer set search_path = public as $$
declare
  cible uuid;
  l amities;
begin
  if auth.uid() is null then raise exception 'Non connecté.'; end if;
  select id into cible from profils where lower(pseudo) = lower(trim(pseudo_ami)) and not banni;
  if cible is null then raise exception 'Aucun pirate ne porte ce pseudo.'; end if;
  if cible = auth.uid() then raise exception 'Tu ne peux pas t’ajouter toi-même.'; end if;
  l := lien_amitie(auth.uid(), cible);
  if l.demandeur is null then
    insert into amities (demandeur, destinataire) values (auth.uid(), cible);
    return 'demande';
  elsif l.statut = 'acceptee' then
    return 'deja';
  elsif l.statut = 'attente' and l.destinataire = auth.uid() then
    update amities set statut = 'acceptee', maj_le = now() where demandeur = l.demandeur and destinataire = l.destinataire;
    return 'acceptee';
  elsif l.statut = 'attente' then
    return 'deja_demande';
  else -- une ancienne amitié retirée : on repart d'une nouvelle demande, dans mon sens
    update amities set demandeur = auth.uid(), destinataire = cible, statut = 'attente', maj_le = now()
      where demandeur = l.demandeur and destinataire = l.destinataire;
    return 'demande';
  end if;
end $$;

create or replace function public.repondre_ami(autre uuid, accepter boolean) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update amities set statut = case when accepter then 'acceptee' else 'retiree' end, maj_le = now()
    where demandeur = autre and destinataire = auth.uid() and statut = 'attente';
end $$;

create or replace function public.retirer_ami(autre uuid) returns void
  language plpgsql security definer set search_path = public as $$
begin
  update amities set statut = 'retiree', maj_le = now()
    where (demandeur = auth.uid() and destinataire = autre) or (demandeur = autre and destinataire = auth.uid());
end $$;

-- Inviter un ami dans le salon où je me trouve (salle d'attente).
create or replace function public.inviter_ami(ami uuid, salon uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare s salons;
begin
  if (lien_amitie(auth.uid(), ami)).statut is distinct from 'acceptee' then raise exception 'Ce pirate n’est pas dans tes amis.'; end if;
  select * into s from salons where id = salon;
  if s.id is null or s.statut <> 'attente' then raise exception 'Ce salon n’attend plus de joueurs.'; end if;
  if not exists (select 1 from salon_joueurs where salon_id = salon and joueur_id = auth.uid()) then raise exception 'Tu n’es pas dans ce salon.'; end if;
  if exists (select 1 from invitations where de = auth.uid() and a = ami and salon_id = salon and cree_le > now() - interval '20 seconds') then
    raise exception 'Invitation déjà envoyée, patiente un peu.';
  end if;
  insert into invitations (de, a, salon_id, code) values (auth.uid(), ami, salon, s.code);
end $$;
