// Actualités : la fenêtre qui présente une grosse mise à jour, une seule fois par version (et rouvrable depuis l'accueil).
import { useEffect, useState } from 'react';

const VERSION = '2026-11-roue';
const EVENEMENT = 'skull-actualites';

/** La présentation de cette version a-t-elle déjà été vue ? */
export function actualitesVues(): boolean { try { return localStorage.getItem('skull-actu-vue') === VERSION; } catch { return true; } }

/** Rouvre la fenêtre des actualités (bouton « Actus » de l'accueil). */
export function ouvrirActualites() { window.dispatchEvent(new Event(EVENEMENT)); }

const PAGES: Array<{ icone: string; titre: string; texte: string; points: string[] }> = [
  { icone: '/img/objet_kraken_poche.webp', titre: 'La Roue du Kraken', texte: 'Un nouveau jeu sur l’accueil : une grande roue partagée par tous les pirates. Pose tes Louidors et regarde-la tourner.',
    points: ['Mise sur 1, 2, 5 ou 10, ou sur un mini-jeu', 'La Boussole multiplie une case avant chaque tour', '4 mini-jeux : Pièce maudite, Abysses, Chasse au trésor, Tempête du Kraken', 'Jusqu’à ×2500 ta mise'] },
  { icone: '/decor/logo.webp', titre: 'Le navire fait peau neuve', texte: 'Fini les emojis : toute l’appli est maintenant peinte à la main, dans le style des cartes.',
    points: ['Un nouvel accueil, décor du port au coucher du soleil', 'Des icônes peintes partout', 'Un décor différent pour chaque écran', 'Des écrans d’attente soignés'] },
  { icone: '/img/objet_bordee.webp', titre: 'Cadeaux et personnalisations', texte: 'Tous les cadeaux de la boutique ont leur vraie illustration, en vitrine comme en plein vol.',
    points: ['16 cadeaux peints, du poisson pourri à la Tempête d’insultes', '7 tapis de table et 6 bannières illustrés', '9 compagnons qui se perchent sur ton avatar', 'Effets de pli et célébrations en images'] },
  { icone: '/img/nav_blackjack.webp', titre: 'Blackjack : plus clair', texte: 'La table est centrée comme une partie classique, le croupier face à toi.',
    points: ['Tapis plus sombre, tu es toujours au centre', 'Une seule barre de commandes en bas', '« Rejouer » remet ta dernière mise en un geste', 'Le chat reste en paysage quand tu écris'] },
  { icone: '/img/badge_centurion.webp', titre: 'Badges et coffres', texte: 'Tes badges, ta pièce de Louidor et tes coffres de niveau ont aussi leur illustration.',
    points: ['Badges Centurion, Devin, Régicide, Fantôme et Légende', 'Coffres de niveau à ouvrir tous les 5 niveaux', 'Encore plus d’images à venir'] },
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
          {p.icone.startsWith('/') ? <img className={`actu-image ${page === 0 ? 'logo' : ''}`} src={p.icone} alt="" /> : <span className="actu-icone">{p.icone}</span>}
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
