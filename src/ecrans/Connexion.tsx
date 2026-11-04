import { useState, type FormEvent } from 'react';
import { supabase, messageErreur } from '../lib/supabase.ts';
import { PSEUDO_REGEX, pseudoDisponible } from '../lib/profil.ts';

type Onglet = 'connexion' | 'inscription' | 'oubli';

export function Connexion({ ouvrirLegal }: { ouvrirLegal: (p: 'mentions' | 'confidentialite' | 'cgu') => void }) {
  const [onglet, setOnglet] = useState<Onglet>('connexion');
  const [email, setEmail] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [pseudo, setPseudo] = useState('');
  const [age, setAge] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  function changer(o: Onglet) {
    setOnglet(o);
    setErreur(null);
    setInfo(null);
  }

  async function valider(ev: FormEvent) {
    ev.preventDefault();
    setErreur(null);
    setInfo(null);
    setEnCours(true);
    try {
      if (onglet === 'connexion') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: motDePasse });
        if (error) throw error;
      } else if (onglet === 'inscription') {
        const p = pseudo.trim();
        if (!PSEUDO_REGEX.test(p)) throw new Error('Pseudo : 3 à 16 caractères (lettres, chiffres, - ou _).');
        if (!age) throw new Error('Il faut avoir 15 ans ou plus pour créer un compte.');
        if (motDePasse.length < 6) throw new Error('Le mot de passe doit faire au moins 6 caractères.');
        if (!(await pseudoDisponible(p))) throw new Error('Ce pseudo est déjà pris, choisis-en un autre.');
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password: motDePasse,
          options: { data: { pseudo: p, age_15_ou_plus: true }, emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) setInfo('Compte créé ! Vérifie tes emails pour le confirmer, puis connecte-toi.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (error) throw error;
        setInfo('Si un compte existe avec cet email, tu vas recevoir un lien pour choisir un nouveau mot de passe.');
      }
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <main className="ecran ecran-connexion">
      <img className="logo-grand" src="/decor/logo.webp" alt="Skull Arena" />
      <section className="parchemin">
        {onglet !== 'oubli' && (
          <div className="onglets">
            <button type="button" className={onglet === 'connexion' ? 'actif' : ''} onClick={() => changer('connexion')}>Connexion</button>
            <button type="button" className={onglet === 'inscription' ? 'actif' : ''} onClick={() => changer('inscription')}>Inscription</button>
          </div>
        )}
        {onglet === 'oubli' && <h2 className="titre-pirate">Mot de passe oublié</h2>}

        <form onSubmit={valider} className="formulaire">
          {onglet === 'inscription' && (
            <label>
              Pseudo
              <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={16} autoComplete="nickname" required placeholder="Ton nom de pirate" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required inputMode="email" />
          </label>
          {onglet !== 'oubli' && (
            <label>
              Mot de passe
              <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)}
                autoComplete={onglet === 'inscription' ? 'new-password' : 'current-password'} required minLength={6} />
            </label>
          )}
          {onglet === 'inscription' && (
            <label className="case">
              <input type="checkbox" checked={age} onChange={(e) => setAge(e.target.checked)} />
              <span>J'ai 15 ans ou plus</span>
            </label>
          )}

          {erreur && <p className="message erreur">{erreur}</p>}
          {info && <p className="message info">{info}</p>}

          <button className="bouton-or" type="submit" disabled={enCours}>
            {enCours ? '…' : onglet === 'connexion' ? "À l'abordage !" : onglet === 'inscription' ? 'Créer mon compte' : 'Envoyer le lien'}
          </button>
        </form>

        {onglet === 'connexion' && <button type="button" className="lien" onClick={() => changer('oubli')}>Mot de passe oublié ?</button>}
        {onglet === 'oubli' && <button type="button" className="lien" onClick={() => changer('connexion')}>Retour à la connexion</button>}
      </section>
      <nav className="pied-liens">
        {onglet === 'inscription' && <small>En créant un compte, tu acceptes les conditions d’utilisation et la politique de confidentialité.</small>}
        <button type="button" onClick={() => ouvrirLegal('mentions')}>Mentions légales</button>
        <button type="button" onClick={() => ouvrirLegal('confidentialite')}>Confidentialité</button>
        <button type="button" onClick={() => ouvrirLegal('cgu')}>Conditions</button>
      </nav>
    </main>
  );
}
