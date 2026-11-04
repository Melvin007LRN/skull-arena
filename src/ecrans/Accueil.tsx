// Accueil : une page d'ambiance à faire défiler. Chaque entrée du menu est une "affiche" illustrée
// avec une phrase d'accroche. Les sections apparaissent en douceur au défilement.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Profil } from '../lib/profil.ts';
import { chargerClassement, grade, niveau, type LigneClassement } from '../lib/profil.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { InstallerAppli } from '../composants/InstallerAppli.tsx';

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

export function Accueil({ profil, ouvrirProfil, ouvrirLobby, ouvrirClassement, ouvrirRegles, ouvrirReglages, ouvrirLegal, ouvrirAmis }: {
  profil: Profil; ouvrirProfil: () => void; ouvrirLobby: (mode: 'jouer' | 'code' | 'entrainement') => void; ouvrirClassement: () => void;
  ouvrirRegles: () => void; ouvrirReglages: () => void; ouvrirAmis: () => void; ouvrirLegal: (p: 'mentions' | 'confidentialite' | 'cgu') => void;
}) {
  const [numeroUn, setNumeroUn] = useState<LigneClassement | null>(null);
  useEffect(() => { chargerClassement().then((l) => setNumeroUn(l[0] ?? null)).catch(() => {}); }, []);
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
      id: 'jouer', titre: 'Jouer', vedette: true, image: '/cartes/skull_king.webp', cadrage: '50% 22%', action: () => ouvrirLobby('jouer'),
      phrase: 'Lève l’ancre et défie jusqu’à 7 pirates en ligne. Que le meilleur menteur gagne.',
    },
    {
      id: 'code', titre: 'Rejoindre un équipage', image: '/cartes/pirate_rosie.webp', cadrage: '50% 18%', action: () => ouvrirLobby('code'),
      phrase: 'Un ami t’attend à bord ? Entre son code et monte sur le pont.',
    },
    {
      id: 'entrainement', titre: 'Entraînement', image: '/cartes/noir_7.webp', cadrage: '50% 30%', action: () => ouvrirLobby('entrainement'),
      phrase: 'Affûte ton sabre contre l’équipage fantôme, sans rien risquer.',
    },
    {
      id: 'classement', titre: 'Classement', image: '/cartes/jaune_14.webp', cadrage: '50% 45%', action: ouvrirClassement,
      phrase: 'Les capitaines les plus redoutés des sept mers. Ta place t’attend.',
    },
    {
      id: 'amis', titre: 'Mes compagnons', image: '/cartes/pirate_bendt.webp', cadrage: '50% 20%', action: ouvrirAmis,
      phrase: 'Ajoute tes amis, vois qui est à bord et invite-les dans ton salon d’un seul geste.',
    },
    {
      id: 'profil', titre: 'Mon pirate', image: '/cartes/pirate_harry.webp', cadrage: '50% 20%', action: ouvrirProfil,
      phrase: 'Ton visage, ton nom, tes trophées : forge ta légende.',
    },
    {
      id: 'regles', titre: 'Le grimoire', image: '/cartes/sirene_1.webp', cadrage: '50% 25%', action: ouvrirRegles,
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

      <InstallerAppli compact />

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
          <div className="avis-portrait"><Avatar photo={numeroUn?.photo_url ?? null} taille={130} /></div>
          <p className="avis-nom">{numeroUn ? numeroUn.pseudo : 'Le pirate à abattre'}</p>
          <p className="avis-detail">
            {numeroUn
              ? <>Numéro 1 du classement · {numeroUn.pm} PM · {numeroUn.victoires} victoire{numeroUn.victoires > 1 ? 's' : ''}.<br />{numeroUn.id === profil.id ? 'C’est toi ! Tout l’équipage veut ta tête.' : 'Détrône-le et prends sa place.'}</>
              : 'Le numéro 1 du classement sera affiché ici. Détrône-le et prends sa place.'}
          </p>
        </section>
      </Apparition>

      <Apparition>
        <button type="button" className="lien-reglages" onClick={ouvrirReglages}>
          ⚙ Réglages du navire
        </button>
      </Apparition>

      <footer className="pied">
        <p>« Un bon pirate ne promet que ce qu’il peut prendre. »</p>
        <nav className="pied-liens">
          <button type="button" onClick={() => ouvrirLegal('mentions')}>Mentions légales</button>
          <button type="button" onClick={() => ouvrirLegal('confidentialite')}>Confidentialité</button>
          <button type="button" onClick={() => ouvrirLegal('cgu')}>Conditions</button>
        </nav>
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
