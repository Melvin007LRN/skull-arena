// Réglages du navire : musique, vibrations, mot de passe, compte et pages légales.
import { useState, type FormEvent } from 'react';
import { supabase, messageErreur } from '../lib/supabase.ts';
import { musique, vibrations, vibrer } from '../lib/sons.ts';
import { CurseursVolume } from '../composants/CurseursVolume.tsx';
import type { Profil } from '../lib/profil.ts';
import type { PageLegale } from './Legal.tsx';
import { InstallerAppli } from '../composants/InstallerAppli.tsx';
import { useNotifications } from '../lib/notifications.ts';
import { ActiverNotifications } from '../composants/ActiverNotifications.tsx';

export function EcranReglages({ profil, retour, ouvrirProfil, ouvrirAdmin, ouvrirLegal }: {
  profil: Profil; retour: () => void; ouvrirProfil: () => void; ouvrirAdmin: () => void; ouvrirLegal: (p: PageLegale) => void;
}) {
  const [musiqueOn, setMusiqueOn] = useState(() => musique.active());
  const [vibrationsOn, setVibrationsOn] = useState(() => vibrations.actives());
  const notif = useNotifications();
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const basculerMusique = () => {
    const v = musique.basculer();
    setMusiqueOn(v);
    // Dans les menus, on fait juste écouter un instant ; la musique joue pendant les parties.
    if (v) setTimeout(() => musique.arreter(), 6000);
  };

  const basculerVibrations = () => {
    const v = !vibrationsOn;
    vibrations.regler(v);
    setVibrationsOn(v);
    if (v) vibrer(80);
  };

  async function changerMotDePasse(e: FormEvent) {
    e.preventDefault();
    setMessage(null);
    if (mdp.length < 6) return setMessage({ ok: false, texte: 'Le mot de passe doit faire au moins 6 caractères.' });
    if (mdp !== mdp2) return setMessage({ ok: false, texte: 'Les deux mots de passe ne sont pas identiques.' });
    setEnCours(true);
    const { error } = await supabase.auth.updateUser({ password: mdp });
    setEnCours(false);
    if (error) return setMessage({ ok: false, texte: messageErreur(error) });
    setMdp(''); setMdp2('');
    setMessage({ ok: true, texte: 'Mot de passe changé.' });
  }

  return (
    <main className="ecran ecran-reglages">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <h1 className="titre-pirate grand">Réglages du navire</h1>

      <InstallerAppli />

      <section className="parchemin">
        <h2 className="titre-pirate">Son et sensations</h2>
        <Interrupteur libelle="Musique d’ambiance" aide="Un chant de marins à la harpe et le ressac, pendant les parties" actif={musiqueOn} basculer={basculerMusique} />
        <CurseursVolume apercuMusique />
        <Interrupteur libelle="Vibrations" aide="Quand c’est ton tour et à la victoire (Android)" actif={vibrationsOn} basculer={basculerVibrations} />
        {notif.etat === 'actives' || notif.etat === 'inactives'
          ? <Interrupteur libelle="Notifications" aide="Invitations, messages et demandes d’ami, même appli fermée" actif={notif.etat === 'actives'}
              basculer={() => { (notif.etat === 'actives' ? notif.desactiver() : notif.activer()).catch(() => {}); }} />
          : <ActiverNotifications />}
        <p className="petit-texte">Les bruitages suivent le mode silencieux de ton téléphone.</p>
      </section>

      <section className="parchemin">
        <h2 className="titre-pirate">Mon compte</h2>
        <button type="button" className="bouton-sombre" onClick={ouvrirProfil}>Modifier mon pirate (pseudo, photo)</button>
        <form className="formulaire" onSubmit={changerMotDePasse}>
          <label>
            Nouveau mot de passe
            <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} autoComplete="new-password" minLength={6} required />
          </label>
          <label>
            Confirme-le
            <input type="password" value={mdp2} onChange={(e) => setMdp2(e.target.value)} autoComplete="new-password" minLength={6} required />
          </label>
          {message && <p className={`message ${message.ok ? 'info' : 'erreur'}`}>{message.texte}</p>}
          <button type="submit" className="bouton-or" disabled={enCours}>Changer le mot de passe</button>
        </form>
        <button type="button" className="bouton-sombre" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </section>

      {profil.est_admin && (
        <section className="parchemin">
          <h2 className="titre-pirate">Capitaine du navire</h2>
          <button type="button" className="bouton-or" onClick={ouvrirAdmin}>Ouvrir l’espace Admin</button>
        </section>
      )}

      <section className="parchemin liens-legaux">
        <h2 className="titre-pirate">Informations</h2>
        <button type="button" className="lien" onClick={() => ouvrirLegal('mentions')}>Mentions légales</button>
        <button type="button" className="lien" onClick={() => ouvrirLegal('confidentialite')}>Confidentialité et données personnelles</button>
        <button type="button" className="lien" onClick={() => ouvrirLegal('cgu')}>Conditions d’utilisation</button>
      </section>
    </main>
  );
}

function Interrupteur({ libelle, aide, actif, basculer }: { libelle: string; aide: string; actif: boolean; basculer: () => void }) {
  return (
    <button type="button" className={`interrupteur ${actif ? 'actif' : ''}`} role="switch" aria-checked={actif} onClick={basculer}>
      <span className="interrupteur-texte"><strong>{libelle}</strong><small>{aide}</small></span>
      <span className="interrupteur-curseur" aria-hidden="true"><span /></span>
    </button>
  );
}
