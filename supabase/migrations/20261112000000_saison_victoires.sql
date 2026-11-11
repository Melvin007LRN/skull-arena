-- Saison : classement au nombre de victoires (dès 1 partie dans le mois).
create or replace function public.classement_saison()
 returns table(id uuid, pseudo text, photo_url text, cadre text, xp integer, parties integer, victoires integer, pm integer)
 language sql stable security definer set search_path to 'public'
as $function$
  select p.id, p.pseudo, p.photo_url, p.cadre, p.xp, count(*)::int, count(*) filter (where h.victoire)::int, round(avg(h.score))::int
  from historique_parties h join profils p on p.id = h.joueur_id
  where not p.banni and (h.joue_le at time zone 'Europe/Paris') >= date_trunc('month', now() at time zone 'Europe/Paris')
  group by p.id
  order by 7 desc, 6 asc, 8 desc, p.xp desc
  limit 200
$function$;
