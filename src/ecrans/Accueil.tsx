// Accueil façon jeu mobile : un seul écran, sans défilement.
// En haut le joueur et sa bourse, au centre son pirate, en bas le choix du jeu et le gros bouton JOUER,
// et une barre de navigation. Les compléments (défis, avis de recherche, alertes) s'ouvrent en fenêtre.
import { useEffect, useState, type ReactNode } from 'react';
import type { Profil } from '../lib/profil.ts';
import { chargerDefisDuJour, DEFIS, grade, niveau, progressionNiveau } from '../lib/profil.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { InstallerAppli } from '../composants/InstallerAppli.tsx';
import { ActiverNotifications } from '../composants/ActiverNotifications.tsx';
import { FenetreNotifications } from '../composants/FenetreNotifications.tsx';
import { Icone, Medaillon } from '../composants/Icone.tsx';
import { Titre } from '../composants/Perso.tsx';
import { useAmis, useEnLigne } from '../lib/amis.ts';
import { totalNonLus, useNonLus } from '../lib/social.ts';
import { actualitesVues, ouvrirActualites } from '../composants/Actualites.tsx';
import { avisVuAujourdhui, ouvrirAvis } from '../composants/AvisRecherche.tsx';

/** Icône de chaque défi du jour. */
const ICONES_DEFIS: Record<string, string> = {
  mise_zero: 'ancre', mise_haute: 'cible', six_mises: 'boussole', victoire: 'trophee', podium: 'couronne',
  quatorze_noir: 'pavillon', regicide: 'couronne', chasseur: 'tete', bonus_50: 'coffre', deux_cents: 'feu',
};

type Jeu = 'skull' | 'blackjack';
type Fenetre = 'defis' | 'alertes' | null;

export function Accueil({ profil, ouvrirProfil, ouvrirLobby, ouvrirClassement, ouvrirRegles, ouvrirReglages, ouvrirAmis, ouvrirBoutique, ouvrirBlackjack }: {
  profil: Profil; ouvrirProfil: () => void; ouvrirLobby: (mode: 'jouer' | 'code' | 'entrainement') => void; ouvrirClassement: () => void;
  ouvrirRegles: () => void; ouvrirReglages: () => void; ouvrirAmis: () => void; ouvrirBoutique: () => void;
  ouvrirLegal?: (p: 'mentions' | 'confidentialite' | 'cgu') => void; ouvrirBlackjack: (mode: 'public' | 'solo' | 'amis') => void;
}) {
  const [defis, setDefis] = useState<Array<{ id: string; reussi: boolean }>>([]);
  const [jeu, setJeu] = useState<Jeu>(() => { try { return localStorage.getItem('skull-jeu') === 'blackjack' ? 'blackjack' : 'skull'; } catch { return 'skull'; } });
  const [fenetre, setFenetre] = useState<Fenetre>(null);
  const { amis } = useAmis(profil.id);
  const enLigne = useEnLigne();
  const nonLus = useNonLus();
  const demandes = (amis ?? []).filter((a) => a.statut === 'attente' && a.recue).length + totalNonLus(nonLus);
  const amisEnLigne = (amis ?? []).filter((a) => a.statut === 'acceptee' && enLigne.has(a.id)).length;
  useEffect(() => {
    chargerDefisDuJour().then(setDefis).catch(() => {});
  }, []);
  const choisir = (j: Jeu) => { setJeu(j); try { localStorage.setItem('skull-jeu', j); } catch { /* sans stockage */ } };

  const n = niveau(profil.xp);
  const prog = progressionNiveau(profil.xp);
  const defisFaits = defis.filter((d) => d.reussi).length;

  return (
    <main className="ecran ecran-accueil cr">
      <div className="cr-fond" aria-hidden="true"><div className="cr-halo" /><Braises /></div>

      <header className="cr-haut">
        <button type="button" className="cr-joueur" onClick={ouvrirProfil}>
          <span className="cr-niveau">{n}</span>
          <span className="cr-joueur-texte">
            <strong>{profil.pseudo}</strong>
            <span className="cr-xp"><i style={{ width: `${Math.round(prog * 100)}%` }} /></span>
          </span>
        </button>
        <button type="button" className="cr-or" onClick={ouvrirBoutique} aria-label="Louidors, ouvrir la boutique">
          <span className="piece-or" aria-hidden="true" />
          <strong>{(profil.louidors ?? 0).toLocaleString('fr-FR')}</strong>
          <span className="cr-plus">+</span>
        </button>
        <button type="button" className="cr-rond" onClick={ouvrirReglages} aria-label="Réglages"><Icone nom="gouvernail" taille={20} /></button>
      </header>

      <section className="cr-scene">
        <div className="cr-rail gauche">
          <BoutonRail classe="r-defis" icone="cible" nom="Défis" badge={defis.length ? `${defisFaits}/${defis.length}` : undefined} fait={defis.length > 0 && defisFaits === defis.length} onClick={() => setFenetre('defis')} />
          <BoutonRail classe="r-avis" icone="tete" nom="Avis" onClick={ouvrirAvis} />
        </div>
        <button type="button" className="cr-pirate" onClick={ouvrirProfil}>
          <span className="cr-socle" aria-hidden="true" />
          <Avatar photo={profil.photo_url} taille={150} cadre={profil.cadre} compagnon={profil.perso?.compagnon ?? null} />
          <span className="cr-nom">{profil.pseudo}</span>
          <Titre perso={profil.perso} className="cr-titre" />
          <span className="cr-grade">{grade(n)} · niveau {n}</span>
        </button>
        <div className="cr-rail droite">
          <BoutonRail classe="r-actus" icone="grimoire" nom="Actus" onClick={ouvrirActualites} />
          <BoutonRail classe="r-alertes" icone="cloche" nom="Alertes" onClick={() => setFenetre('alertes')} />
        </div>
      </section>

      <section className="cr-jeu">
        <div className="cr-modes" role="tablist">
          <button type="button" role="tab" aria-selected={jeu === 'skull'} className={jeu === 'skull' ? 'actif' : ''} onClick={() => choisir('skull')}>Skull King</button>
          <button type="button" role="tab" aria-selected={jeu === 'blackjack'} className={`m-blackjack ${jeu === 'blackjack' ? 'actif' : ''}`} onClick={() => choisir('blackjack')}>Blackjack</button>
        </div>
        <div className={`cr-affiche ${jeu}`}>
          <img src={jeu === 'skull' ? '/decor/art/skull_king.webp' : '/decor/art/jaune_14.webp'} alt="" />
          <span className="cr-affiche-texte">
            <strong>{jeu === 'skull' ? 'Skull King' : 'Blackjack du Capitaine'}</strong>
            <small>{jeu === 'skull'
              ? (enLigne.size > 0 ? `${enLigne.size} pirate${enLigne.size > 1 ? 's' : ''} en ligne · 2 à 8 joueurs` : '2 à 8 joueurs · mise juste, pille tout')
              : 'Table publique de 5 places · mise tes Louidors'}</small>
          </span>
        </div>
        <button type="button" className={`bouton-or cr-jouer ${jeu === 'blackjack' ? 'bj' : ''}`} onClick={() => (jeu === 'skull' ? ouvrirLobby('jouer') : ouvrirBlackjack('public'))}>
          <Icone nom="epees" taille={28} /> {jeu === 'skull' ? 'Jouer' : 'S’asseoir'}
        </button>
        <div className="cr-secondaires">
          {jeu === 'skull' ? (
            <>
              <button type="button" className="bouton-sombre c-bleu" onClick={() => ouvrirLobby('code')}><Icone nom="longue-vue" taille={18} /> Rejoindre</button>
              <button type="button" className="bouton-sombre c-vert" onClick={() => ouvrirLobby('entrainement')}><Icone nom="cible" taille={18} /> Entraînement</button>
            </>
          ) : (
            <>
              <button type="button" className="bouton-sombre c-turquoise" onClick={() => ouvrirBlackjack('solo')}><Icone nom="piece" taille={18} /> En solo</button>
              <button type="button" className="bouton-sombre c-violet" onClick={() => ouvrirBlackjack('amis')}><Icone nom="equipage" taille={18} /> Avec compagnons</button>
            </>
          )}
        </div>
      </section>

      <nav className="cr-nav">
        <BoutonNav classe="n-boutique" icone="coffre" nom="Boutique" onClick={ouvrirBoutique} />
        <BoutonNav classe="n-equipage" icone="equipage" nom="Équipage" onClick={ouvrirAmis} badge={demandes || undefined} point={amisEnLigne > 0} />
        <BoutonNav classe="n-jouer" icone="epees" nom="Jouer" actif onClick={() => {}} />
        <BoutonNav classe="n-classement" icone="trophee" nom="Classement" onClick={ouvrirClassement} />
        <BoutonNav classe="n-regles" icone="grimoire" nom="Règles" onClick={ouvrirRegles} />
      </nav>

      {actualitesVues() && avisVuAujourdhui() && <FenetreNotifications />}

      {fenetre === 'defis' && (
        <Fenetre titre="Défis du jour" fermer={() => setFenetre(null)}>
          {defis.length === 0 ? <p className="petit-texte centre">Les défis arrivent à minuit.</p> : (
            <ul className="cr-defis">
              {defis.map((d) => (
                <li key={d.id} className={d.reussi ? 'reussi' : ''}>
                  <Medaillon nom={d.reussi ? 'trophee' : ICONES_DEFIS[d.id] ?? 'ancre'} taille={34} className={`defi-medaillon ${d.reussi ? 'fait' : ''}`} />
                  <span>{DEFIS[d.id]?.texte ?? d.id}</span>
                  <b>{d.reussi ? '✓' : '+20 XP · +15'}</b>
                </li>
              ))}
            </ul>
          )}
          <p className="petit-texte centre">En partie en ligne uniquement · nouveaux défis chaque jour à minuit.</p>
        </Fenetre>
      )}

      {fenetre === 'alertes' && (
        <Fenetre titre="Alertes" fermer={() => setFenetre(null)}>
          <ActiverNotifications />
          <InstallerAppli />
        </Fenetre>
      )}
    </main>
  );
}

function BoutonRail({ classe, icone, nom, badge, fait, onClick }: { classe: string; icone: string; nom: string; badge?: string; fait?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`cr-bouton-rail ${classe} ${fait ? 'fait' : ''}`} onClick={onClick}>
      <span className="cr-bouton-rail-icone"><Icone nom={icone} taille={22} /></span>
      <small>{nom}</small>
      {badge && <b>{badge}</b>}
    </button>
  );
}

function BoutonNav({ classe, icone, nom, actif, badge, point, onClick }: { classe: string; icone: string; nom: string; actif?: boolean; badge?: number; point?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`${classe} ${actif ? 'actif' : ''}`} onClick={onClick} aria-current={actif ? 'page' : undefined}>
      <span className="cr-nav-icone"><Icone nom={icone} taille={actif ? 26 : 22} />{badge ? <b className="pastille-nombre">{badge}</b> : point ? <i className="cr-point" /> : null}</span>
      <small>{nom}</small>
    </button>
  );
}

function Fenetre({ titre, fermer, children }: { titre: string; fermer: () => void; children: ReactNode }) {
  return (
    <div className="voile b-voile" onClick={fermer}>
      <section className="b-fiche cr-fenetre" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="b-fermer" onClick={fermer} aria-label="Fermer">×</button>
        <h2>{titre}</h2>
        {children}
      </section>
    </div>
  );
}

/** Quelques braises dorées qui montent doucement. */
function Braises() {
  return (
    <div className="braises">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} style={{
          left: `${(i * 53) % 100}%`, animationDelay: `${(i * 0.73) % 9}s`, animationDuration: `${9 + (i % 5) * 2}s`,
          width: `${2 + (i % 3)}px`, height: `${2 + (i % 3)}px`,
        }} />
      ))}
    </div>
  );
}
