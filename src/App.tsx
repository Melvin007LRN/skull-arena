import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, messageErreur } from './lib/supabase.ts';
import { chargerProfil, type Profil } from './lib/profil.ts';
import { Connexion } from './ecrans/Connexion.tsx';
import { NouveauMotDePasse } from './ecrans/NouveauMotDePasse.tsx';
import { Accueil } from './ecrans/Accueil.tsx';
import { EcranProfil } from './ecrans/Profil.tsx';
import { Lobby } from './ecrans/Lobby.tsx';
import { EcranSalon } from './ecrans/EcranSalon.tsx';
import { EcranClassement } from './ecrans/Classement.tsx';
import { EcranRegles } from './ecrans/Regles.tsx';
import { EcranReglages } from './ecrans/Reglages.tsx';
import { EcranAdmin } from './ecrans/Admin.tsx';
import { EcranLegal, type PageLegale } from './ecrans/Legal.tsx';
import { EcranAmis } from './ecrans/Amis.tsx';
import { EcranBoutique } from './ecrans/Boutique.tsx';
import { demarrerPresence, useInvitations } from './lib/amis.ts';
import { appel, salonEnCours } from './lib/jeu.ts';

type Ecran =
  | { nom: 'accueil' }
  | { nom: 'profil' }
  | { nom: 'classement' }
  | { nom: 'regles' }
  | { nom: 'reglages' }
  | { nom: 'admin' }
  | { nom: 'amis' }
  | { nom: 'boutique' }
  | { nom: 'legal'; page: PageLegale; retour: Ecran }
  | { nom: 'lobby'; mode: 'jouer' | 'code' | 'entrainement' }
  | { nom: 'salon'; id: string };

const ACCUEIL: Ecran = { nom: 'accueil' };

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recuperation, setRecuperation] = useState(false);
  const [ecran, setEcran] = useState<Ecran>(ACCUEIL);
  const [repriseFaite, setRepriseFaite] = useState(false);
  // Pages légales consultables même sans être connecté.
  const [legalHorsConnexion, setLegalHorsConnexion] = useState<PageLegale | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((evenement, s) => {
      if (evenement === 'PASSWORD_RECOVERY') setRecuperation(true);
      setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const recharger = useCallback(async () => {
    if (!session) return;
    try {
      setProfil(await chargerProfil(session.user.id));
      setErreur(null);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }, [session]);

  useEffect(() => {
    if (session) recharger();
    else {
      setProfil(null);
      setEcran(ACCUEIL);
      setRepriseFaite(false);
    }
  }, [session, recharger]);

  useEffect(() => window.scrollTo(0, 0), [ecran.nom]);

  // À l'ouverture : lien d'invitation (?salon=CODE), sinon retour automatique dans la partie en cours.
  useEffect(() => {
    if (!profil || repriseFaite) return;
    setRepriseFaite(true);
    const code = new URLSearchParams(window.location.search).get('salon');
    if (code) {
      window.history.replaceState(null, '', window.location.pathname);
      appel<{ salon_id: string }>('rejoindre', { code })
        .then((r) => setEcran({ nom: 'salon', id: r.salon_id }))
        .catch((e) => alert((e as Error).message));
      return;
    }
    salonEnCours(profil.id).then((id) => id && setEcran({ nom: 'salon', id }));
  }, [profil, repriseFaite]);

  const versAccueil = useCallback(() => setEcran(ACCUEIL), []);

  // Présence en ligne (pour les amis) dès qu'on est connecté.
  const moiId = profil && !profil.banni ? profil.id : null;
  useEffect(() => (moiId ? demarrerPresence(moiId) : undefined), [moiId]);
  // En revenant d'une partie, on recharge le profil (XP, statistiques, badges).
  const sortirDuSalon = useCallback(() => { setEcran(ACCUEIL); recharger(); }, [recharger]);

  if (session === undefined) return <Chargement />;
  if (recuperation && session) return <NouveauMotDePasse fini={() => setRecuperation(false)} />;
  if (!session && legalHorsConnexion) {
    return <EcranLegal page={legalHorsConnexion} retour={() => setLegalHorsConnexion(null)} changer={setLegalHorsConnexion} />;
  }
  if (!session) return <Connexion ouvrirLegal={setLegalHorsConnexion} />;
  if (erreur) return <Message texte={erreur} action="Réessayer" surAction={recharger} />;
  if (!profil) return <Chargement />;
  if (profil.banni) {
    return <Message texte="Ton compte a été banni de Skull Arena." action="Se déconnecter" surAction={() => supabase.auth.signOut()} />;
  }
  const contenu = rendreEcran();
  return <>{contenu}{ecran.nom !== 'salon' && <ToastInvitation moi={profil.id} entrer={(id) => setEcran({ nom: 'salon', id })} />}</>;

  function rendreEcran() {
  if (!profil) return null;
  if (ecran.nom === 'profil') return <EcranProfil profil={profil} retour={versAccueil} recharger={recharger} />;
  if (ecran.nom === 'lobby') {
    return <Lobby mode={ecran.mode} retour={versAccueil} entrer={(id) => setEcran({ nom: 'salon', id })} />;
  }
  if (ecran.nom === 'salon') return <EcranSalon key={ecran.id} salonId={ecran.id} moi={profil.id} sortir={sortirDuSalon} />;
  if (ecran.nom === 'classement') return <EcranClassement profil={profil} retour={versAccueil} />;
  if (ecran.nom === 'regles') return <EcranRegles retour={versAccueil} />;
  if (ecran.nom === 'boutique') return <EcranBoutique profil={profil} retour={versAccueil} recharger={recharger} />;
  if (ecran.nom === 'amis') return <EcranAmis moi={profil.id} retour={versAccueil} />;
  if (ecran.nom === 'admin') return <EcranAdmin profil={profil} retour={() => setEcran({ nom: 'reglages' })} />;
  if (ecran.nom === 'legal') {
    const e = ecran;
    return <EcranLegal page={e.page} retour={() => setEcran(e.retour)} changer={(page) => setEcran({ ...e, page })} />;
  }
  if (ecran.nom === 'reglages') {
    return (
      <EcranReglages profil={profil} retour={versAccueil} ouvrirProfil={() => setEcran({ nom: 'profil' })}
        ouvrirAdmin={() => setEcran({ nom: 'admin' })} ouvrirLegal={(page) => setEcran({ nom: 'legal', page, retour: { nom: 'reglages' } })} />
    );
  }
  return (
    <Accueil profil={profil} ouvrirProfil={() => setEcran({ nom: 'profil' })}
      ouvrirLobby={(mode) => setEcran({ nom: 'lobby', mode })} ouvrirClassement={() => setEcran({ nom: 'classement' })}
      ouvrirRegles={() => setEcran({ nom: 'regles' })} ouvrirReglages={() => setEcran({ nom: 'reglages' })}
      ouvrirLegal={(page) => setEcran({ nom: 'legal', page, retour: ACCUEIL })} ouvrirAmis={() => setEcran({ nom: 'amis' })}
      ouvrirBoutique={() => setEcran({ nom: 'boutique' })} />
  );
  }
}

/** Invitation d'un ami : bandeau avec « Rejoindre ». */
function ToastInvitation({ moi, entrer }: { moi: string; entrer: (salonId: string) => void }) {
  const { invitation, fermer } = useInvitations(moi);
  const [erreur, setErreur] = useState<string | null>(null);
  if (!invitation) return null;
  const rejoindre = async () => {
    try {
      const r = await appel<{ salon_id: string }>('rejoindre', { code: invitation.code });
      fermer();
      entrer(r.salon_id);
    } catch (e) {
      setErreur((e as Error).message);
      setTimeout(() => { setErreur(null); fermer(); }, 3000);
    }
  };
  return (
    <div className="toast-invitation" role="alert">
      <span>🏴‍☠️ <strong>{invitation.pseudo}</strong> t’invite à bord !</span>
      {erreur ? <small>{erreur}</small> : (
        <span className="toast-boutons">
          <button type="button" className="bouton-or petit" onClick={rejoindre}>Rejoindre</button>
          <button type="button" className="lien" onClick={fermer}>Plus tard</button>
        </span>
      )}
    </div>
  );
}

function Chargement() {
  return (
    <main className="ecran ecran-centre">
      <img className="logo-grand pulse" src="/decor/logo.webp" alt="Skull Arena" />
    </main>
  );
}

function Message({ texte, action, surAction }: { texte: string; action: string; surAction: () => void }) {
  return (
    <main className="ecran ecran-centre">
      <section className="parchemin">
        <p className="message erreur">{texte}</p>
        <button type="button" className="bouton-or" onClick={surAction}>{action}</button>
      </section>
    </main>
  );
}
