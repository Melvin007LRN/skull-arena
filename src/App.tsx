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
import { appel, salonEnCours } from './lib/jeu.ts';

type Ecran =
  | { nom: 'accueil' }
  | { nom: 'profil' }
  | { nom: 'lobby'; mode: 'jouer' | 'code' }
  | { nom: 'salon'; id: string };

const ACCUEIL: Ecran = { nom: 'accueil' };

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profil, setProfil] = useState<Profil | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [recuperation, setRecuperation] = useState(false);
  const [ecran, setEcran] = useState<Ecran>(ACCUEIL);
  const [repriseFaite, setRepriseFaite] = useState(false);

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

  if (session === undefined) return <Chargement />;
  if (recuperation && session) return <NouveauMotDePasse fini={() => setRecuperation(false)} />;
  if (!session) return <Connexion />;
  if (erreur) return <Message texte={erreur} action="Réessayer" surAction={recharger} />;
  if (!profil) return <Chargement />;
  if (profil.banni) {
    return <Message texte="Ton compte a été banni de Skull Arena." action="Se déconnecter" surAction={() => supabase.auth.signOut()} />;
  }
  if (ecran.nom === 'profil') return <EcranProfil profil={profil} retour={versAccueil} recharger={recharger} />;
  if (ecran.nom === 'lobby') {
    return <Lobby mode={ecran.mode} retour={versAccueil} entrer={(id) => setEcran({ nom: 'salon', id })} />;
  }
  if (ecran.nom === 'salon') return <EcranSalon key={ecran.id} salonId={ecran.id} moi={profil.id} sortir={versAccueil} />;
  return (
    <Accueil profil={profil} ouvrirProfil={() => setEcran({ nom: 'profil' })}
      ouvrirLobby={(mode) => setEcran({ nom: 'lobby', mode })} />
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
