# Fonction serveur « partie »

Arbitre de Skull Arena : crée et gère les salons, et vérifie chaque coup avec le moteur de règles.

- `engine/` est une copie de `src/engine/` (le même moteur que les tests). Après une modification du moteur :
  `cp src/engine/*.ts supabase/functions/partie/engine/` puis redéployer la fonction.
- Déploiement : la fonction est envoyée sous forme d'un seul fichier groupé avec esbuild
  (`esbuild supabase/functions/partie/index.ts --bundle --format=esm --platform=neutral --external:'jsr:*' --minify`).
