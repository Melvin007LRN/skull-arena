// Choisir sa partie : créer un salon (public ou privé), rejoindre un salon public, ou entrer un code.
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { appel, useSalonsPublics } from '../lib/jeu.ts';
import { useEnLigne } from '../lib/amis.ts';
import { son, vibrer } from '../lib/sons.ts';

type ReponseRecherche = { statut: 'attente'; nb: number; depuis: string } | { statut: 'trouve'; salon_id: string } | { statut: 'annule' };

export function Lobby({ mode, retour, entrer }: { mode: 'jouer' | 'code' | 'entrainement'; retour: () => void; entrer: (salonId: string) => void }) {
  const salons = useSalonsPublics();
  const [code, setCode] = useState('');
  const [nbRobots, setNbRobots] = useState(3);
  const [rapide, setRapide] = useState(false);
  const [extension, setExtension] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const enLigne = useEnLigne();
  // Partie rapide (matchmaking) : on rappelle le serveur toutes les 3 s tant qu'on cherche.
  const [recherche, setRecherche] = useState<{ depuis: number; nb: number } | null>(null);
  const [maintenant, setMaintenant] = useState(Date.now());
  const enRecherche = useRef(false);
  useEffect(() => {
    enRecherche.current = recherche !== null;
  }, [recherche]);
  useEffect(() => {
    if (!recherche) return;
    let actif = true;
    const horloge = setInterval(() => setMaintenant(Date.now()), 500);
    const sonde = setInterval(async () => {
      try {
        const r = await appel<ReponseRecherche>('chercher');
        if (!actif) return;
        if (r.statut === 'trouve') {
          enRecherche.current = false;
          setRecherche(null);
          son.tour();
          vibrer(150);
          entrer(r.salon_id);
        } else if (r.statut === 'annule') setRecherche(null);
        else setRecherche((x) => (x ? { ...x, nb: r.nb } : x));
      } catch { /* on réessaie au prochain tour */ }
    }, 3000);
    return () => { actif = false; clearInterval(horloge); clearInterval(sonde); };
  }, [recherche !== null]); // eslint-disable-line react-hooks/exhaustive-deps
  // En quittant la page pendant la recherche, on sort de la file.
  useEffect(() => () => { if (enRecherche.current) appel('annuler_recherche').catch(() => {}); }, []);

  async function lancerRecherche() {
    setErreur(null);
    setEnCours(true);
    try {
      const r = await appel<ReponseRecherche>('chercher', { nouvelle: true });
      if (r.statut === 'trouve') return entrer(r.salon_id);
      if (r.statut === 'attente') {
        setMaintenant(Date.now());
        setRecherche({ depuis: Date.now(), nb: r.nb });
      }
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }
  function annulerRecherche() {
    setRecherche(null);
    appel('annuler_recherche').catch(() => {});
  }

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
          <p className="en-ligne-bandeau"><span className="pastille-co en-ligne" /> <strong>{Math.max(1, enLigne.size)}</strong> pirate{enLigne.size > 1 ? 's' : ''} en ligne</p>

          {recherche ? (
            <RechercheEnCours depuis={recherche.depuis} nb={recherche.nb} maintenant={maintenant} annuler={annulerRecherche} />
          ) : (
            <button type="button" className="tuile neon tuile-rapide" onClick={lancerRecherche} disabled={enCours}>
              <img src="/cartes/skull_king.webp" alt="" style={{ objectPosition: '50% 22%' }} />
              <span className="tuile-degrade" />
              <span className="tuile-texte">
                <span className="etiquette-mode">⚡ Partie rapide</span>
                <strong>Trouver un équipage</strong>
                <small>On t’assemble une table avec d’autres pirates en quelques secondes : dès 4 joueurs, ou à 2 et plus après 30 s d’attente.</small>
                <span className="puces-mode"><em>🃏 Avec l’extension</em><em>🏆 Compte au classement</em></span>
              </span>
            </button>
          )}

          <div className="grille-tuiles">
            <button type="button" className="tuile neon tuile-mode" onClick={() => creer(false)} disabled={enCours || recherche !== null}>
              <img src="/cartes/butin_1.webp" alt="" style={{ objectPosition: '50% 30%' }} />
              <span className="tuile-degrade" />
              <span className="tuile-texte">
                <span className="etiquette-mode">🔒 Privé</span>
                <strong>Entre amis</strong>
                <small>Partage un code ou un lien. Tu es le capitaine : robots, extension et départ.</small>
              </span>
            </button>
            <button type="button" className="tuile neon tuile-mode" onClick={() => creer(true)} disabled={enCours || recherche !== null}>
              <img src="/cartes/pirate_juanita.webp" alt="" style={{ objectPosition: '50% 25%' }} />
              <span className="tuile-degrade" />
              <span className="tuile-texte">
                <span className="etiquette-mode">🌍 Public</span>
                <strong>Port ouvert</strong>
                <small>Ton salon apparaît ci-dessous : les pirates de passage montent à bord.</small>
              </span>
            </button>
          </div>

          <section className="parchemin neon salons-ouverts">
            <h2 className="titre-pirate">Salons publics ouverts</h2>
            {salons.length === 0 ? (
              <p className="petit-texte centre">Aucun salon ouvert pour l’instant. Lance une partie rapide ou crée le tien, les pirates viendront !</p>
            ) : (
              <ul className="liste-salons">
                {salons.map((s) => (
                  <li key={s.id}>
                    <span>
                      <strong>Salon de {s.hotePseudo}</strong>
                      <small>
                        <span className="places">{Array.from({ length: 8 }, (_, i) => <i key={i} className={i < s.nb ? 'pris' : ''} />)}</span>
                        {s.nb} / 8 pirates{s.extension ? ' · 🃏 extension' : ''}
                      </small>
                    </span>
                    <button type="button" className="bouton-or petit" onClick={() => rejoindre(s.code)} disabled={enCours || recherche !== null}>Rejoindre</button>
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

/** Écran d'attente de la partie rapide : boussole qui tourne, chrono et pirates trouvés. */
function RechercheEnCours({ depuis, nb, maintenant, annuler }: { depuis: number; nb: number; maintenant: number; annuler: () => void }) {
  const ecoule = Math.max(0, Math.floor((maintenant - depuis) / 1000));
  const mm = String(Math.floor(ecoule / 60)).padStart(1, '0');
  const ss = String(ecoule % 60).padStart(2, '0');
  const reste = Math.max(0, 30 - ecoule);
  const message = nb >= 4 ? 'Équipage complet, on lève l’ancre…'
    : nb >= 2 ? (reste > 0 ? `Départ dans ${reste} s, ou dès 4 pirates` : 'On lève l’ancre…')
    : 'On cherche d’autres pirates…';
  return (
    <section className="recherche neon" aria-live="polite">
      <div className="recherche-boussole" aria-hidden="true"><span className="aiguille" /></div>
      <strong className="recherche-titre">Recherche d’un équipage</strong>
      <span className="recherche-chrono">{mm}:{ss}</span>
      <div className="recherche-sieges" aria-label={`${nb} pirate(s) trouvé(s) sur 4`}>
        {Array.from({ length: 4 }, (_, i) => <span key={i} className={i < nb ? 'trouve' : ''}>{i < nb ? '☠' : ''}</span>)}
      </div>
      <small>{message}</small>
      <button type="button" className="bouton-sombre" onClick={annuler}>Annuler</button>
    </section>
  );
}
