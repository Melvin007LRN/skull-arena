-- Notifications sur le téléphone (Web Push) : clé VAPID côté serveur, abonnements des joueurs.
-- (La clé privée VAPID est enregistrée dans prive.config, jamais exposée aux joueurs.)
create schema if not exists prive;
create table if not exists prive.config (nom text primary key, valeur jsonb not null);

create or replace function public.config_notifications() returns jsonb
  language plpgsql stable security definer set search_path = prive, public as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Interdit.'; end if;
  return (select valeur from prive.config where nom = 'vapid');
end $$;

create table if not exists public.push_abonnements (
  endpoint text primary key,
  joueur uuid not null references public.profils (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  actif boolean not null default true,
  maj_le timestamptz not null default now()
);
create index if not exists push_joueur on public.push_abonnements (joueur) where actif;
alter table public.push_abonnements enable row level security;
create policy "Mes abonnements" on public.push_abonnements for select to authenticated using (joueur = auth.uid());
grant select on public.push_abonnements to authenticated;

create or replace function public.enregistrer_abo(adresse text, cle_publique text, cle_auth text) returns void
  language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Non connecté.'; end if;
  if adresse !~ '^https://' then raise exception 'Abonnement invalide.'; end if;
  insert into push_abonnements as a (endpoint, joueur, p256dh, auth, actif, maj_le)
  values (adresse, auth.uid(), cle_publique, cle_auth, true, now())
  on conflict on constraint push_abonnements_pkey do update set joueur = auth.uid(), p256dh = excluded.p256dh, auth = excluded.auth, actif = true, maj_le = now();
end $$;

create or replace function public.desactiver_abonnement(endpoint text) returns void
  language sql security definer set search_path = public as $$
  update push_abonnements set actif = false, maj_le = now() where push_abonnements.endpoint = desactiver_abonnement.endpoint and joueur = auth.uid()
$$;
