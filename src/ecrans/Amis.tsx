// Mes compagnons : ajouter un pirate par son pseudo, répondre aux demandes, voir qui est en ligne.
import { IMAGE_GRADE } from '../lib/images.ts';
import { Patience } from '../composants/Attente.tsx';
import { useState, type FormEvent, type ReactNode } from 'react';
import { messageErreur } from '../lib/supabase.ts';
import { demanderAmi, repondreAmi, retirerAmi, useAmis, useEnLigne, type Ami } from '../lib/amis.ts';
import { grade, niveau } from '../lib/profil.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { useNonLus, useSocial } from '../lib/social.ts';

const REPONSES = {
  demande: 'Demande envoyée ! Elle apparaîtra chez lui.',
  acceptee: 'Vous êtes maintenant compagnons de bord !',
  deja: 'Vous êtes déjà amis.',
  deja_demande: 'Tu lui as déjà envoyé une demande.',
} as const;

export function EcranAmis({ moi, retour }: { moi: string; retour: () => void }) {
  const { amis, recharger } = useAmis(moi);
  const enLigne = useEnLigne();
  const [pseudo, setPseudo] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function faire(fn: () => Promise<unknown>, succes?: string) {
    setEnCours(true);
    setMessage(null);
    try {
      const r = await fn();
      setMessage({ ok: true, texte: succes ?? REPONSES[r as keyof typeof REPONSES] ?? 'C’est fait.' });
      await recharger();
    } catch (e) {
      setMessage({ ok: false, texte: messageErreur(e) });
    } finally {
      setEnCours(false);
    }
  }

  const ajouter = (e: FormEvent) => {
    e.preventDefault();
    if (pseudo.trim()) faire(() => demanderAmi(pseudo.trim())).then(() => setPseudo(''));
  };

  const recues = (amis ?? []).filter((a) => a.statut === 'attente' && a.recue);
  const envoyees = (amis ?? []).filter((a) => a.statut === 'attente' && !a.recue);
  const compagnons = (amis ?? []).filter((a) => a.statut === 'acceptee')
    .sort((a, b) => Number(enLigne.has(b.id)) - Number(enLigne.has(a.id)) || a.pseudo.localeCompare(b.pseudo));

  return (
    <main className="ecran ecran-amis">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <h1 className="titre-pirate grand">Mes compagnons</h1>

      <section className="parchemin">
        <form className="ligne-pseudo" onSubmit={ajouter}>
          <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={16} placeholder="Pseudo du pirate…" autoCapitalize="off" autoComplete="off" />
          <button type="submit" className="bouton-or petit" disabled={enCours || !pseudo.trim()}>Ajouter</button>
        </form>
        {message && <p className={`message ${message.ok ? 'info' : 'erreur'}`} style={{ marginTop: 10 }}>{message.texte}</p>}
      </section>

      {recues.length > 0 && (
        <section className="parchemin">
          <h2 className="titre-pirate">Demandes reçues</h2>
          <ul className="liste-amis">
            {recues.map((a) => (
              <LigneAmi key={a.id} ami={a} enLigne={enLigne.has(a.id)}>
                <button type="button" className="bouton-or petit" disabled={enCours} onClick={() => faire(() => repondreAmi(a.id, true), `${a.pseudo} rejoint ton équipage !`)}>Accepter</button>
                <button type="button" className="lien danger" disabled={enCours} onClick={() => faire(() => repondreAmi(a.id, false), 'Demande refusée.')}>Refuser</button>
              </LigneAmi>
            ))}
          </ul>
        </section>
      )}

      <section className="parchemin">
        <h2 className="titre-pirate">Équipage{compagnons.length > 0 ? ` (${compagnons.length})` : ''}</h2>
        {amis === null ? <Patience />
          : compagnons.length === 0 ? <p className="petit-texte centre">Pas encore de compagnons. Ajoute tes amis avec leur pseudo, puis invite-les dans ton salon depuis la salle d’attente.</p>
          : (
            <ul className="liste-amis">
              {compagnons.map((a) => (
                <LigneAmi key={a.id} ami={a} enLigne={enLigne.has(a.id)}>
                  <button type="button" className="lien danger" disabled={enCours}
                    onClick={() => confirm(`Retirer ${a.pseudo} de tes amis ?`) && faire(() => retirerAmi(a.id), `${a.pseudo} a été retiré.`)}>Retirer</button>
                </LigneAmi>
              ))}
            </ul>
          )}
      </section>

      {envoyees.length > 0 && (
        <section className="parchemin">
          <h2 className="titre-pirate">En attente de réponse</h2>
          <ul className="liste-amis">
            {envoyees.map((a) => (
              <LigneAmi key={a.id} ami={a} enLigne={enLigne.has(a.id)}>
                <button type="button" className="lien" disabled={enCours} onClick={() => faire(() => retirerAmi(a.id), 'Demande annulée.')}>Annuler</button>
              </LigneAmi>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

function LigneAmi({ ami, enLigne, children }: { ami: Ami; enLigne: boolean; children?: ReactNode }) {
  const n = niveau(ami.xp);
  const { ouvrirProfil, ouvrirMessages } = useSocial();
  const nonLus = useNonLus()[ami.id] ?? 0;
  return (
    <li>
      <button type="button" className="ami-ouvrir" onClick={() => ouvrirProfil(ami.id)} aria-label={`Voir le profil de ${ami.pseudo}`} />
      <span className="ami-avatar">
        <Avatar photo={ami.photo_url} taille={46} cadre={ami.cadre} />
        <span className={`pastille-co ${enLigne ? 'en-ligne' : 'hors-ligne'}`} />
      </span>
      <span className="cl-nom">
        <strong>{ami.pseudo}</strong>
        <small>{enLigne ? 'En ligne' : 'Hors ligne'} · {IMAGE_GRADE[grade(n)] && <img className="ico-texte" src={IMAGE_GRADE[grade(n)]} alt="" />}Niv. {n} · {grade(n)}</small>
      </span>
      <span className="ami-actions">
        {ami.statut === 'acceptee' && (
          <button type="button" className="bouton-or petit ami-msg" onClick={() => ouvrirMessages(ami.id)} aria-label={`Écrire à ${ami.pseudo}`}>
            <img className="ico-texte" src="/img/jeu_chat.webp" alt="" />{nonLus > 0 && <b className="pastille-nombre">{nonLus}</b>}
          </button>
        )}
        {children}
      </span>
    </li>
  );
}
