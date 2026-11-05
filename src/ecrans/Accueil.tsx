// Accueil : une page d'ambiance à faire défiler. Chaque entrée du menu est une "affiche" illustrée
// avec une phrase d'accroche. Les sections apparaissent en douceur au défilement.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Profil } from '../lib/profil.ts';
import { chargerClassement, chargerClassementSaison, chargerDefisDuJour, DEFIS, grade, niveau, nomSaison } from '../lib/profil.ts';
import { Louidors } from './Boutique.tsx';
import { Avatar } from '../composants/Avatar.tsx';
import { InstallerAppli } from '../composants/InstallerAppli.tsx';
import { ActiverNotifications } from '../composants/ActiverNotifications.tsx';
import { FenetreNotifications } from '../composants/FenetreNotifications.tsx';
import { Icone, Medaillon } from '../composants/Icone.tsx';
import { useAmis, useEnLigne } from '../lib/amis.ts';
import { totalNonLus, useNonLus, useSocial } from '../lib/social.ts';

interface Entree {
  id: string;
  titre: string;
  phrase: string;
  image: string;
  cadrage?: string; // object-position de l'illustration
  vedette?: boolean;
  action?: () => void;
  icone?: string;
}

/** Icône de chaque défi du jour. */
const ICONES_DEFIS: Record<string, string> = {
  mise_zero: 'ancre', mise_haute: 'cible', six_mises: 'boussole', victoire: 'trophee', podium: 'couronne',
  quatorze_noir: 'pavillon', regicide: 'couronne', chasseur: 'tete', bonus_50: 'coffre', deux_cents: 'feu',
};

const ACCROCHES = [
  'Mise juste. Pille tout. Règne sur l’Arena.',
  'Chaque pli est un abordage.',
  'Le Skull King n’attend que toi.',
];

export function Accueil({ profil, ouvrirProfil, ouvrirLobby, ouvrirClassement, ouvrirRegles, ouvrirReglages, ouvrirLegal, ouvrirAmis, ouvrirBoutique }: {
  profil: Profil; ouvrirProfil: () => void; ouvrirLobby: (mode: 'jouer' | 'code' | 'entrainement') => void; ouvrirClassement: () => void;
  ouvrirRegles: () => void; ouvrirReglages: () => void; ouvrirAmis: () => void; ouvrirBoutique: () => void; ouvrirLegal: (p: 'mentions' | 'confidentialite' | 'cgu') => void;
}) {
  // Avis de recherche : le numéro 1 de la saison (sinon celui du classement permanent).
  const [numeroUn, setNumeroUn] = useState<{ id: string; pseudo: string; photo_url: string | null; cadre: string | null; pm: number; victoires: number; saison: boolean } | null>(null);
  const [defis, setDefis] = useState<Array<{ id: string; reussi: boolean }>>([]);
  const { amis } = useAmis(profil.id);
  const enLigne = useEnLigne();
  const nonLus = useNonLus();
  const { ouvrirProfil: voirJoueur, ouvrirMessages } = useSocial();
  const compagnons = (amis ?? []).filter((a) => a.statut === 'acceptee')
    .sort((a, b) => Number(enLigne.has(b.id)) - Number(enLigne.has(a.id)) || (nonLus[b.id] ?? 0) - (nonLus[a.id] ?? 0));
  const demandesRecues = (amis ?? []).filter((a) => a.statut === 'attente' && a.recue).length;
  const nbEnLigne = compagnons.filter((a) => enLigne.has(a.id)).length;
  useEffect(() => {
    chargerClassementSaison().then(async (s) => {
      if (s[0]) return setNumeroUn({ ...s[0], saison: true });
      const l = await chargerClassement();
      setNumeroUn(l[0] ? { ...l[0], saison: false } : null);
    }).catch(() => {});
    chargerDefisDuJour().then(setDefis).catch(() => {});
  }, []);
  const [accroche, setAccroche] = useState(0);


  useEffect(() => {
    const t = setInterval(() => setAccroche((a) => (a + 1) % ACCROCHES.length), 4200);
    return () => clearInterval(t);
  }, []);


  const n = niveau(profil.xp);
  const jouer: Entree = {
    id: 'jouer', titre: 'Jouer', vedette: true, image: '/cartes/skull_king.webp', cadrage: '50% 22%', action: () => ouvrirLobby('jouer'),
    phrase: 'Lève l’ancre et défie jusqu’à 8 pirates en ligne. Que le meilleur menteur gagne.',
  };
  // Deux tuiles par ligne, dans cet ordre précis.
  const tuiles: Entree[] = [
    { id: 'code', titre: 'Rejoindre', image: '/cartes/pirate_rosie.webp', cadrage: '50% 18%', action: () => ouvrirLobby('code'), phrase: 'Entre le code d’un ami', icone: 'longue-vue' },
    { id: 'profil', titre: 'Mon pirate', image: '/cartes/pirate_harry.webp', cadrage: '50% 20%', action: ouvrirProfil, phrase: 'Ta légende, tes trophées', icone: 'tete' },
    { id: 'amis', titre: 'Compagnons', image: '/cartes/pirate_bendt.webp', cadrage: '50% 20%', action: ouvrirAmis, phrase: 'Amis et messages', icone: 'pavillon' },
    { id: 'classement', titre: 'Classement', image: '/cartes/jaune_14.webp', cadrage: '50% 45%', action: ouvrirClassement, phrase: 'Saison et légendes', icone: 'couronne' },
    { id: 'entrainement', titre: 'Entraînement', image: '/cartes/noir_7.webp', cadrage: '50% 30%', action: () => ouvrirLobby('entrainement'), phrase: 'Contre les robots', icone: 'cible' },
    { id: 'regles', titre: 'Le grimoire', image: '/cartes/sirene_1.webp', cadrage: '50% 25%', action: ouvrirRegles, phrase: 'Toutes les règles', icone: 'grimoire' },
  ];


  return (
    <main className="ecran ecran-accueil">
      <div className="ambiance" aria-hidden="true">
        <div className="ambiance-decor" />
        <div className="ambiance-voile" />
        <div className="ambiance-lanterne" />
        <div className="ambiance-brume b1" />
        <div className="ambiance-brume b2" />
        <Braises />
      </div>

      {/* Le logo reste en place et passe derrière le contenu quand on fait défiler (aucun calcul au défilement) */}
      <header className="entete-logo">
        <img src="/decor/logo.webp" alt="Skull Arena" />
      </header>
      <button type="button" className="puce-boutique" onClick={ouvrirBoutique} aria-label="La boutique du port">
        <span className="piece-or" aria-hidden="true" />
        <strong>{profil.louidors ?? 0}</strong>
        <small>Boutique</small>
      </button>

      <p className="accroche" key={accroche}>{ACCROCHES[accroche]}</p>

      <Apparition>
        <button type="button" className="carte-joueur neon" onClick={ouvrirProfil}>
          <Avatar photo={profil.photo_url} taille={68} cadre={profil.cadre} />
          <span className="carte-joueur-texte">
            <small>Bienvenue à bord,</small>
            <strong>{profil.pseudo}</strong>
            <span>Niveau {n} · {grade(n)}</span>
            <Louidors montant={profil.louidors ?? 0} />
          </span>
          <span className="fleche">›</span>
        </button>
      </Apparition>

      <InstallerAppli compact />
      <ActiverNotifications compact />
      <FenetreNotifications />

      <Apparition>
        <button type="button" className="affiche affiche-vedette neon" onClick={jouer.action}>
          <img className="affiche-image" src={jouer.image} alt="" style={{ objectPosition: jouer.cadrage }} />
          <span className="affiche-degrade" />
          {enLigne.size > 0 && <span className="affiche-en-ligne"><i />{enLigne.size} pirate{enLigne.size > 1 ? 's' : ''} en ligne</span>}
          <span className="affiche-texte">
            <span className="affiche-titre">{jouer.titre}</span>
            <span className="affiche-phrase">{jouer.phrase}</span>
            <span className="bouton-or affiche-bouton"><Icone nom="epees" taille={20} />À l’abordage</span>
          </span>
        </button>
      </Apparition>

      <div className="grille-tuiles">
        {tuiles.map((e, i) => (
          <Apparition key={e.id} delai={(i % 2) * 70}>
            <button type="button" className="tuile neon" onClick={e.action}>
              <img src={e.image} alt="" loading="lazy" style={{ objectPosition: e.cadrage }} />
              <span className="tuile-degrade" />
              {e.icone && <Medaillon nom={e.icone} taille={36} className="tuile-medaillon" />}
              <span className="tuile-texte">
                <strong>{e.titre}</strong>
                <small>{e.phrase}</small>
              </span>
              {e.id === 'amis' && demandesRecues + totalNonLus(nonLus) > 0 && <b className="pastille-nombre tuile-pastille">{demandesRecues + totalNonLus(nonLus)}</b>}
            </button>
          </Apparition>
        ))}
      </div>

      <Apparition>
        <section className="amis-accueil neon">
          <div className="amis-accueil-titre">
            <span className="titre-bloc"><Medaillon nom="equipage" taille={34} /> Mon équipage <small>{nbEnLigne > 0 ? `· ${nbEnLigne} en ligne` : ''}</small></span>
            <button type="button" className="lien" onClick={ouvrirAmis}>
              Tout voir{demandesRecues + totalNonLus(nonLus) > 0 && <b className="pastille-nombre">{demandesRecues + totalNonLus(nonLus)}</b>}
            </button>
          </div>
          {compagnons.length === 0 ? (
            <button type="button" className="amis-vide" onClick={ouvrirAmis}>Ajoute tes amis pirates pour les voir ici, leur écrire et les inviter →</button>
          ) : (
            <div className="amis-rangee">
              {compagnons.map((a) => (
                <button key={a.id} type="button" className={`ami-bulle ${enLigne.has(a.id) ? 'en-ligne' : ''}`}
                  onClick={() => ((nonLus[a.id] ?? 0) > 0 ? ouvrirMessages(a.id) : voirJoueur(a.id))}>
                  <span className="ami-avatar">
                    <Avatar photo={a.photo_url} taille={54} cadre={a.cadre} />
                    <span className={`pastille-co ${enLigne.has(a.id) ? 'en-ligne' : 'hors-ligne'}`} />
                    {(nonLus[a.id] ?? 0) > 0 && <b className="pastille-nombre">{nonLus[a.id]}</b>}
                  </span>
                  <small>{a.pseudo}</small>
                </button>
              ))}
            </div>
          )}
        </section>
      </Apparition>

      {defis.length > 0 && (
        <Apparition>
          <section className="defis-jour neon">
            <p className="defis-titre"><Medaillon nom="boussole" taille={34} /> Défis du jour</p>
            <ul>
              {defis.map((d) => (
                <li key={d.id} className={d.reussi ? 'reussi' : ''}>
                  <Medaillon nom={d.reussi ? 'trophee' : ICONES_DEFIS[d.id] ?? 'ancre'} taille={34} className={`defi-medaillon ${d.reussi ? 'fait' : ''}`} />
                  <span className="defi-texte">{DEFIS[d.id]?.texte ?? d.id}</span>
                  <span className="defi-gain">{d.reussi ? '✓ Réussi' : '+20 XP · +15'}</span>
                </li>
              ))}
            </ul>
            <small>En partie en ligne uniquement · nouveaux défis chaque jour à minuit</small>
          </section>
        </Apparition>
      )}


      <Apparition>
        <section className="avis-recherche">
          <p className="avis-titre">AVIS DE RECHERCHE</p>
          <p className="avis-sous-titre">Mort ou vif</p>
          <div className="avis-portrait"><Avatar photo={numeroUn?.photo_url ?? null} taille={130} cadre={numeroUn?.cadre} /></div>
          <p className="avis-nom">{numeroUn ? numeroUn.pseudo : 'Le pirate à abattre'}</p>
          <p className="avis-detail">
            {numeroUn
              ? <>Numéro 1 {numeroUn.saison ? `de la saison de ${nomSaison()}` : 'du classement'} · {numeroUn.pm} PM · {numeroUn.victoires} victoire{numeroUn.victoires > 1 ? 's' : ''}.<br />{numeroUn.id === profil.id ? 'C’est toi ! Tout l’équipage veut ta tête.' : 'Détrône-le et prends sa place.'}</>
              : 'Le numéro 1 du classement sera affiché ici. Détrône-le et prends sa place.'}
          </p>
        </section>
      </Apparition>

      <Apparition>
        <button type="button" className="lien-reglages neon" onClick={ouvrirReglages}>
          <Icone nom="gouvernail" taille={20} /> Réglages du navire
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
