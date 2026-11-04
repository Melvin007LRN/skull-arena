// Choisir sa partie : créer un salon (public ou privé), rejoindre un salon public, ou entrer un code.
import { useState, type FormEvent } from 'react';
import { appel, useSalonsPublics } from '../lib/jeu.ts';

export function Lobby({ mode, retour, entrer }: { mode: 'jouer' | 'code' | 'entrainement'; retour: () => void; entrer: (salonId: string) => void }) {
  const salons = useSalonsPublics();
  const [code, setCode] = useState('');
  const [nbRobots, setNbRobots] = useState(3);
  const [rapide, setRapide] = useState(false);
  const [extension, setExtension] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function faire(fn: () => Promise<{ salon_id: string }>) {
    setEnCours(true);
    setErreur(null);
    try {
      const r = await fn();
      entrer(r.salon_id);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const creer = (estPublic: boolean) => faire(() => appel('creer_salon', { public: estPublic }));
  const rejoindreCode = (ev: FormEvent) => {
    ev.preventDefault();
    faire(() => appel('rejoindre', { code }));
  };
  const rejoindre = (c: string) => faire(() => appel('rejoindre', { code: c }));

  return (
    <main className="ecran ecran-lobby">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <h1 className="titre-pirate grand">{mode === 'code' ? 'Rejoindre un équipage' : mode === 'entrainement' ? 'Entraînement' : 'Prendre la mer'}</h1>

      {erreur && <p className="message erreur">{erreur}</p>}

      {mode === 'entrainement' && (
        <section className="parchemin choix-salon">
          <p className="petit-texte centre">Affronte l’équipage fantôme pour t’entraîner. Ces parties ne comptent ni pour le classement, ni pour les badges.</p>
          <p className="sous-titre">Nombre de robots adverses</p>
          <div className="boutons-mise">
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" className={n === nbRobots ? 'bouton-or petit' : 'bouton-sombre petit-rond'} onClick={() => setNbRobots(n)}>{n}</button>
            ))}
          </div>
          <p className="sous-titre">Vitesse des robots</p>
          <div className="boutons-mise">
            <button type="button" className={!rapide ? 'bouton-or petit' : 'bouton-sombre petit'} onClick={() => setRapide(false)}>Normale</button>
            <button type="button" className={rapide ? 'bouton-or petit' : 'bouton-sombre petit'} onClick={() => setRapide(true)}>Rapide ⚡</button>
          </div>
          <p className="sous-titre">Cartes</p>
          <div className="boutons-mise">
            <button type="button" className={!extension ? 'bouton-or petit' : 'bouton-sombre petit'} onClick={() => setExtension(false)}>Jeu de base</button>
            <button type="button" className={extension ? 'bouton-or petit' : 'bouton-sombre petit'} onClick={() => setExtension(true)}>Avec l’extension 🃏</button>
          </div>
          <button type="button" className="bouton-or bouton-jouer" disabled={enCours}
            onClick={() => faire(() => appel('entrainement', { robots: nbRobots, vitesse: rapide ? 'rapide' : 'normale', extension }))}>
            {enCours ? 'Préparation…' : 'Lever l’ancre !'}
          </button>
        </section>
      )}

      {mode === 'code' && (
        <section className="parchemin">
          <form onSubmit={rejoindreCode} className="formulaire">
            <label>
              Code du salon
              <input className="champ-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
                placeholder="K7P2XM" autoCapitalize="characters" autoComplete="off" inputMode="text" required />
            </label>
            <button className="bouton-or" type="submit" disabled={enCours || code.length !== 6}>Monter à bord</button>
          </form>
        </section>
      )}

      {mode === 'jouer' && (
        <>
          <section className="parchemin choix-salon">
            <p className="sous-titre">Crée ton salon et deviens capitaine</p>
            <button type="button" className="bouton-or" onClick={() => creer(false)} disabled={enCours}>Salon privé entre amis</button>
            <button type="button" className="bouton-sombre" onClick={() => creer(true)} disabled={enCours}>Salon public, ouvert à tous</button>
          </section>

          <section className="parchemin">
            <h2 className="titre-pirate">Salons publics</h2>
            {salons.length === 0 ? (
              <p className="petit-texte centre">Aucun salon ouvert pour l'instant. Crée le tien, les pirates viendront !</p>
            ) : (
              <ul className="liste-salons">
                {salons.map((s) => (
                  <li key={s.id}>
                    <span>
                      <strong>Salon de {s.hotePseudo}</strong>
                      <small>{s.nb} / 8 pirates</small>
                    </span>
                    <button type="button" className="bouton-or petit" onClick={() => rejoindre(s.code)} disabled={enCours}>Rejoindre</button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </main>
  );
}
