// Actualités : la fenêtre qui présente une grosse mise à jour, une seule fois par version (et rouvrable depuis l'accueil).
import { useEffect, useState } from 'react';

const VERSION = '2026-11-blackjack-2';
const EVENEMENT = 'skull-actualites';

/** La présentation de cette version a-t-elle déjà été vue ? */
export function actualitesVues(): boolean { try { return localStorage.getItem('skull-actu-vue') === VERSION; } catch { return true; } }

/** Rouvre la fenêtre des actualités (bouton « Actus » de l'accueil). */
export function ouvrirActualites() { window.dispatchEvent(new Event(EVENEMENT)); }

const PAGES: Array<{ icone: string; titre: string; texte: string; points: string[] }> = [
  { icone: '🏴‍☠️', titre: 'La grande mise à jour', texte: 'Le navire a été radoubé de la quille au grand mât. Voici ce qui change.',
    points: ['Nouvel accueil, tout sur un seul écran', 'Le Blackjack du Capitaine', 'Boutique et menus redessinés', 'Des parties plus vivantes'] },
  { icone: '🃏', titre: 'Le Blackjack du Capitaine', texte: 'Un nouveau jeu face au croupier pirate : bats-le sans dépasser 21.',
    points: ['Une vraie table en paysage, 5 places', 'Séparer, doubler, assurance', 'Paris annexes : Paires parfaites et 21+3', 'Chat entre joueurs, plus ton niveau monte plus tu mises gros'] },
  { icone: '⚓', titre: 'Un accueil plus clair', texte: 'Ton pirate au centre, le gros bouton Jouer en bas, et tout le reste à un doigt.',
    points: ['Choisis ton jeu : Skull King ou Blackjack', 'Défis du jour et avis de recherche en un geste', 'Barre de navigation en bas'] },
  { icone: '🛍️', titre: 'Boutique et menus', texte: 'Un style plus sobre et plus élégant, sans néon dans les menus.',
    points: ['Une vitrine et des rayons faciles à parcourir', '« Voir l’animation » avant d’acheter', 'Des cadeaux animés bien plus spectaculaires'] },
  { icone: '✨', titre: 'Des parties plus vivantes', texte: 'Chaque pli, chaque bonus et chaque fin de manche se ressentent.',
    points: ['Le pli gagné vole vers son vainqueur', 'Des scores qui défilent et une harpe qui monte', 'Un podium animé à chaque fin de manche', 'Option de salon : bonus toujours comptés'] },
];

export function Actualites() {
  const [ouvert, setOuvert] = useState(() => { try { return localStorage.getItem('skull-actu-vue') !== VERSION; } catch { return false; } });
  const [page, setPage] = useState(0);
  useEffect(() => {
    const ouvrir = () => { setPage(0); setOuvert(true); };
    window.addEventListener(EVENEMENT, ouvrir);
    return () => window.removeEventListener(EVENEMENT, ouvrir);
  }, []);
  if (!ouvert) return null;
  const fermer = () => { try { localStorage.setItem('skull-actu-vue', VERSION); } catch { /* sans stockage */ } setOuvert(false); window.dispatchEvent(new Event('skull-actu-fermee')); };
  const p = PAGES[page];
  const derniere = page === PAGES.length - 1;
  return (
    <div className="voile actu-voile" onClick={fermer}>
      <section className="actu" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Actualités">
        <button type="button" className="b-fermer" onClick={fermer} aria-label="Fermer">×</button>
        <small className="actu-etiquette">Actualités</small>
        <div className="actu-page" key={page}>
          <span className="actu-icone">{p.icone}</span>
          <h2>{p.titre}</h2>
          <p>{p.texte}</p>
          <ul>{p.points.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
        <div className="actu-points">{PAGES.map((_, i) => <button key={i} type="button" className={i === page ? 'actif' : ''} onClick={() => setPage(i)} aria-label={`Page ${i + 1}`} />)}</div>
        <div className="actu-boutons">
          {page > 0 && <button type="button" className="bouton-sombre" onClick={() => setPage(page - 1)}>Précédent</button>}
          <button type="button" className="bouton-or" onClick={() => (derniere ? fermer() : setPage(page + 1))}>{derniere ? 'À l’abordage !' : 'Suivant'}</button>
        </div>
      </section>
    </div>
  );
}
