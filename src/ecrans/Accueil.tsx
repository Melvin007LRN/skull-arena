// Accueil : une page d'ambiance à faire défiler. Chaque entrée du menu est une "affiche" illustrée
// avec une phrase d'accroche. Les sections apparaissent en douceur au défilement.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Profil } from '../lib/profil.ts';
import { grade, niveau } from '../lib/profil.ts';
import { Avatar } from '../composants/Avatar.tsx';

interface Entree {
  id: string;
  titre: string;
  phrase: string;
  image: string;
  cadrage?: string; // object-position de l'illustration
  vedette?: boolean;
  action?: () => void;
}

const ACCROCHES = [
  'Mise juste. Pille tout. Règne sur l’Arena.',
  'Chaque pli est un abordage.',
  'Le Skull King n’attend que toi.',
];

export function Accueil({ profil, ouvrirProfil }: { profil: Profil; ouvrirProfil: () => void }) {
  const [reduit, setReduit] = useState(false);
  const [bientot, setBientot] = useState<string | null>(null);
  const [accroche, setAccroche] = useState(0);

  useEffect(() => {
    const surDefilement = () => setReduit(window.scrollY > 80);
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setAccroche((a) => (a + 1) % ACCROCHES.length), 4200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!bientot) return;
    const t = setTimeout(() => setBientot(null), 2000);
    return () => clearTimeout(t);
  }, [bientot]);

  const n = niveau(profil.xp);
  const entrees: Entree[] = [
    {
      id: 'jouer', titre: 'Jouer', vedette: true, image: '/cartes/skull_king.webp', cadrage: '50% 22%',
      phrase: 'Lève l’ancre et défie jusqu’à 7 pirates en ligne. Que le meilleur menteur gagne.',
    },
    {
      id: 'code', titre: 'Rejoindre un équipage', image: '/cartes/pirate_rosie.webp', cadrage: '50% 18%',
      phrase: 'Un ami t’attend à bord ? Entre son code et monte sur le pont.',
    },
    {
      id: 'entrainement', titre: 'Entraînement', image: '/cartes/noir_7.webp', cadrage: '50% 30%',
      phrase: 'Affûte ton sabre contre l’équipage fantôme, sans rien risquer.',
    },
    {
      id: 'classement', titre: 'Classement', image: '/cartes/jaune_14.webp', cadrage: '50% 45%',
      phrase: 'Les capitaines les plus redoutés des sept mers. Ta place t’attend.',
    },
    {
      id: 'profil', titre: 'Mon pirate', image: '/cartes/pirate_harry.webp', cadrage: '50% 20%', action: ouvrirProfil,
      phrase: 'Ton visage, ton nom, tes trophées : forge ta légende.',
    },
    {
      id: 'regles', titre: 'Le grimoire', image: '/cartes/sirene_1.webp', cadrage: '50% 25%',
      phrase: 'Sirènes, Kraken, Baleine blanche… tous les secrets du jeu, page après page.',
    },
  ];

  return (
    <main className="ecran ecran-accueil">
      <div className="ambiance" aria-hidden="true">
        <div className="ambiance-decor" />
        <div className="ambiance-voile" />
        <Braises />
      </div>

      <header className={`entete-logo ${reduit ? 'reduit' : ''}`}>
        <img src="/decor/logo.webp" alt="Skull Arena" />
      </header>

      <p className="accroche" key={accroche}>{ACCROCHES[accroche]}</p>

      <Apparition>
        <button type="button" className="carte-joueur" onClick={ouvrirProfil}>
          <Avatar photo={profil.photo_url} taille={68} />
          <span className="carte-joueur-texte">
            <small>Bienvenue à bord,</small>
            <strong>{profil.pseudo}</strong>
            <span>Niveau {n} · {grade(n)}</span>
          </span>
          <span className="fleche">›</span>
        </button>
      </Apparition>

      {entrees.map((e, i) => (
        <Apparition key={e.id} delai={i === 0 ? 0 : 60}>
          <button type="button" className={`affiche ${e.vedette ? 'affiche-vedette' : ''}`}
            onClick={e.action ?? (() => setBientot(e.titre))}>
            <img className="affiche-image" src={e.image} alt="" loading="lazy" style={{ objectPosition: e.cadrage }} />
            <span className="affiche-degrade" />
            <span className="affiche-texte">
              <span className="affiche-titre">{e.titre}</span>
              <span className="affiche-phrase">{e.phrase}</span>
            </span>
            <span className="affiche-fleche">›</span>
          </button>
        </Apparition>
      ))}

      <Apparition>
        <section className="avis-recherche">
          <p className="avis-titre">AVIS DE RECHERCHE</p>
          <p className="avis-sous-titre">Mort ou vif</p>
          <div className="avis-portrait"><Avatar photo={null} taille={130} /></div>
          <p className="avis-nom">Le pirate à abattre</p>
          <p className="avis-detail">Le numéro 1 du classement sera affiché ici. Détrône-le et prends sa place.</p>
        </section>
      </Apparition>

      <Apparition>
        <button type="button" className="lien-reglages" onClick={() => setBientot('Réglages')}>
          ⚙ Réglages du navire
        </button>
      </Apparition>

      <footer className="pied">
        <p>« Un bon pirate ne promet que ce qu’il peut prendre. »</p>
      </footer>

      {bientot && <div className="toast">{bientot} : bientôt disponible</div>}
    </main>
  );
}

/** Fait apparaître son contenu en fondu quand il entre à l'écran. */
function Apparition({ children, delai = 0 }: { children: ReactNode; delai?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) return setVisible(true);
    const obs = new IntersectionObserver(([entree]) => {
      if (entree.isIntersecting) {
        setVisible(true);
        obs.disconnect();
      }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <div ref={ref} className={`apparition ${visible ? 'visible' : ''}`} style={{ transitionDelay: `${delai}ms` }}>
      {children}
    </div>
  );
}

/** Quelques braises dorées qui montent doucement. */
function Braises() {
  return (
    <div className="braises">
      {Array.from({ length: 18 }, (_, i) => (
        <span key={i} style={{
          left: `${(i * 53) % 100}%`,
          animationDelay: `${(i * 0.73) % 9}s`,
          animationDuration: `${9 + (i % 5) * 2}s`,
          width: `${2 + (i % 3)}px`,
          height: `${2 + (i % 3)}px`,
        }} />
      ))}
    </div>
  );
}
