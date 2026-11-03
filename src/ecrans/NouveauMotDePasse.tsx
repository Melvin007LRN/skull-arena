import { useState, type FormEvent } from 'react';
import { supabase, messageErreur } from '../lib/supabase.ts';

export function NouveauMotDePasse({ fini }: { fini: () => void }) {
  const [mdp, setMdp] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function valider(ev: FormEvent) {
    ev.preventDefault();
    setEnCours(true);
    setErreur(null);
    const { error } = await supabase.auth.updateUser({ password: mdp });
    setEnCours(false);
    if (error) setErreur(messageErreur(error));
    else fini();
  }

  return (
    <main className="ecran ecran-connexion">
      <img className="logo-grand" src="/decor/logo.webp" alt="Skull Arena" />
      <section className="parchemin">
        <h2 className="titre-pirate">Nouveau mot de passe</h2>
        <form onSubmit={valider} className="formulaire">
          <label>
            Nouveau mot de passe
            <input type="password" value={mdp} onChange={(e) => setMdp(e.target.value)} minLength={6} required autoComplete="new-password" />
          </label>
          {erreur && <p className="message erreur">{erreur}</p>}
          <button className="bouton-or" type="submit" disabled={enCours}>{enCours ? '…' : 'Enregistrer'}</button>
        </form>
      </section>
    </main>
  );
}
