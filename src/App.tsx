// Page provisoire de la refonte : vérifier sur téléphone que les 74 cartes et les visuels s'affichent bien.
// Elle sera remplacée par l'accueil du jeu à l'étape des écrans.
import { creerPaquet } from './engine/index.ts';

export function App() {
  const paquet = creerPaquet();
  return (
    <main className="provisoire">
      <img className="logo" src="/decor/logo.webp" alt="Skull Arena" />
      <p className="statut">Refonte en cours · étape 1 : moteur de règles prêt</p>
      <h2>Les {paquet.length} cartes du jeu de base</h2>
      <div className="grille">
        {paquet.map((c) => (
          <figure key={c.id}>
            <img src={`/cartes/${c.id}.webp`} alt={c.id} loading="lazy" />
            <figcaption>{c.id.replace('_', ' ')}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
