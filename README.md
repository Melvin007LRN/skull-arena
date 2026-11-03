# Skull Arena

Jeu de cartes pirate multijoueur en ligne (2 à 8 joueurs), fidèle aux règles de Skull King avec Kraken, Baleine blanche et Butin.

Refonte complète (version 2). L'ancienne version est conservée dans la branche `ancienne-version`.

## Organisation

- `src/engine/` : moteur de règles pur (aucun affichage). Il sert au serveur pour valider chaque coup et aux robots.
  - `cards.ts` : les 74 cartes, leurs identifiants (= noms des images), cartes par joueur selon la manche.
  - `pli.ts` : couleur demandée, cartes jouables, gagnant d'un pli, bonus, alliances, pouvoirs.
  - `partie.ts` : déroulé complet (couronne, mises, plis, pouvoirs, Harry, score, fin de partie).
- `tests/` : tests automatiques, dont une simulation de milliers de parties.
- `public/cartes/` : les 74 cartes du jeu de base ; `public/cartes/extension/` : cartes mises de côté.
- `public/decor/` : logo, décor de fond, fond de table, dos des cartes, cadre d'avatar.

## Commandes

- `npm test` : lance tous les tests du moteur.
- `npm run dev` : site en local.
- `npm run build` : version de production.
