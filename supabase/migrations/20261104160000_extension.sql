-- Extension du jeu : l'hôte choisit de jouer avec les 19 cartes supplémentaires.
alter table public.salons add column if not exists extension boolean not null default false;
