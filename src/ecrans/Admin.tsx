// Espace Admin : joueurs (bannir, pseudo, photo) et phrases rapides.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase, messageErreur } from '../lib/supabase.ts';
import { grade, niveau, PSEUDO_REGEX, type Profil } from '../lib/profil.ts';
import { chargerPhrases, type Phrase } from '../lib/phrases.ts';
import { Avatar } from '../composants/Avatar.tsx';

export function EcranAdmin({ profil, retour }: { profil: Profil; retour: () => void }) {
  const [onglet, setOnglet] = useState<'joueurs' | 'phrases'>('joueurs');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);

  const action = useCallback(async (fn: () => Promise<unknown>, succes: string) => {
    setMessage(null);
    try {
      await fn();
      setMessage({ ok: true, texte: succes });
      return true;
    } catch (e) {
      setMessage({ ok: false, texte: messageErreur(e) });
      return false;
    }
  }, []);

  if (!profil.est_admin) {
    return (
      <main className="ecran ecran-centre">
        <section className="parchemin"><p className="message erreur">Réservé au capitaine du navire.</p>
          <button type="button" className="bouton-sombre" onClick={retour}>Retour</button></section>
      </main>
    );
  }

  return (
    <main className="ecran ecran-admin">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <h1 className="titre-pirate grand">Espace Admin</h1>
      <div className="onglets">
        <button type="button" className={onglet === 'joueurs' ? 'actif' : ''} onClick={() => setOnglet('joueurs')}>Joueurs</button>
        <button type="button" className={onglet === 'phrases' ? 'actif' : ''} onClick={() => setOnglet('phrases')}>Phrases rapides</button>
      </div>
      {message && <p className={`message ${message.ok ? 'info' : 'erreur'}`}>{message.texte}</p>}
      {onglet === 'joueurs' ? <Joueurs moi={profil.id} action={action} /> : <Phrases action={action} />}
    </main>
  );
}

type Action = (fn: () => Promise<unknown>, succes: string) => Promise<boolean>;

async function rpc(nom: string, params: Record<string, unknown>) {
  const { data, error } = await supabase.rpc(nom, params);
  if (error) throw error;
  return data;
}

function Joueurs({ moi, action }: { moi: string; action: Action }) {
  const [liste, setListe] = useState<Profil[] | null>(null);
  const [recherche, setRecherche] = useState('');
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [nouveauPseudo, setNouveauPseudo] = useState('');

  const charger = useCallback(async () => {
    const { data } = await supabase.from('profils').select('*').order('cree_le', { ascending: false }).limit(1000);
    setListe((data ?? []) as Profil[]);
  }, []);
  useEffect(() => { charger(); }, [charger]);

  const filtres = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    return (liste ?? []).filter((p) => !q || p.pseudo.toLowerCase().includes(q));
  }, [liste, recherche]);

  const faire = async (fn: () => Promise<unknown>, succes: string) => {
    if (await action(fn, succes)) await charger();
  };

  return (
    <section className="parchemin">
      <input className="champ-recherche" placeholder="Chercher un pseudo…" value={recherche} onChange={(e) => setRecherche(e.target.value)} />
      <p className="petit-texte">{liste ? `${liste.length} pirate${liste.length > 1 ? 's' : ''} inscrit${liste.length > 1 ? 's' : ''} · ${liste.filter((p) => p.banni).length} banni(s)` : 'Chargement…'}</p>
      <ul className="admin-joueurs">
        {filtres.map((p) => {
          const n = niveau(p.xp);
          return (
            <li key={p.id} className={p.banni ? 'banni' : ''}>
              <button type="button" className="admin-ligne" onClick={() => { setOuvert(ouvert === p.id ? null : p.id); setNouveauPseudo(p.pseudo); }}>
                <Avatar photo={p.photo_url} taille={44} cadre={p.cadre} />
                <span className="cl-nom">
                  <strong>{p.pseudo}{p.est_admin ? ' ⚓' : ''}{p.banni ? ' · banni' : ''}</strong>
                  <small>Niv. {n} · {grade(n)} · {p.parties_jouees} parties · {p.victoires} victoires</small>
                </span>
                <span className="fleche">{ouvert === p.id ? '˄' : '˅'}</span>
              </button>
              {ouvert === p.id && (
                <div className="admin-actions">
                  <div className="ligne-pseudo">
                    <input value={nouveauPseudo} onChange={(e) => setNouveauPseudo(e.target.value)} maxLength={16} />
                    <button type="button" className="bouton-or petit" disabled={!PSEUDO_REGEX.test(nouveauPseudo.trim()) || nouveauPseudo.trim() === p.pseudo}
                      onClick={() => faire(() => rpc('admin_renommer', { joueur: p.id, nouveau: nouveauPseudo.trim() }), 'Pseudo modifié.')}>Renommer</button>
                  </div>
                  <button type="button" className="bouton-sombre" onClick={() => confirm(`Effacer le pseudo « ${p.pseudo} » ? Il sera remplacé par un nom neutre.`)
                    && faire(() => rpc('admin_effacer_pseudo', { joueur: p.id }), 'Pseudo effacé.')}>Effacer le pseudo</button>
                  {p.photo_url && (
                    <button type="button" className="bouton-sombre" onClick={() => confirm('Supprimer cette photo ?')
                      && faire(() => rpc('admin_effacer_photo', { joueur: p.id }), 'Photo supprimée.')}>Supprimer la photo</button>
                  )}
                  {p.id !== moi && (
                    p.banni
                      ? <button type="button" className="bouton-or" onClick={() => faire(() => rpc('admin_bannir', { joueur: p.id, valeur: false }), `${p.pseudo} n’est plus banni.`)}>Lever le bannissement</button>
                      : <button type="button" className="bouton-danger" onClick={() => confirm(`Bannir ${p.pseudo} ? Il ne pourra plus jouer.`)
                        && faire(() => rpc('admin_bannir', { joueur: p.id, valeur: true }), `${p.pseudo} est banni.`)}>Bannir</button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Phrases({ action }: { action: Action }) {
  const [liste, setListe] = useState<Phrase[] | null>(null);
  const [nouvelle, setNouvelle] = useState('');
  const [edition, setEdition] = useState<{ id: number; texte: string } | null>(null);

  const charger = useCallback(async () => setListe(await chargerPhrases()), []);
  useEffect(() => { charger().catch(() => setListe([])); }, [charger]);

  const faire = async (fn: () => Promise<unknown>, succes: string) => {
    if (await action(fn, succes)) await charger();
  };

  return (
    <section className="parchemin">
      <p className="petit-texte">Ces phrases apparaissent dans la bulle 💬 pendant les parties. Les changements comptent dès la partie suivante.</p>
      <ul className="admin-phrases">
        {(liste ?? []).map((ph) => (
          <li key={ph.id}>
            {edition?.id === ph.id ? (
              <div className="ligne-pseudo">
                <input value={edition.texte} onChange={(e) => setEdition({ id: ph.id, texte: e.target.value })} maxLength={40} autoFocus />
                <button type="button" className="bouton-or petit" disabled={!edition.texte.trim()}
                  onClick={() => faire(() => rpc('admin_modifier_phrase', { phrase: ph.id, texte: edition.texte }), 'Phrase modifiée.').then(() => setEdition(null))}>OK</button>
              </div>
            ) : (
              <>
                <span>« {ph.texte} »</span>
                <button type="button" className="lien" onClick={() => setEdition({ id: ph.id, texte: ph.texte })}>Modifier</button>
                <button type="button" className="lien danger" onClick={() => confirm(`Retirer « ${ph.texte} » ?`)
                  && faire(() => rpc('admin_retirer_phrase', { phrase: ph.id }), 'Phrase retirée.')}>Retirer</button>
              </>
            )}
          </li>
        ))}
      </ul>
      <form className="ligne-pseudo" onSubmit={(e) => { e.preventDefault(); if (nouvelle.trim()) faire(() => rpc('admin_ajouter_phrase', { texte: nouvelle }), 'Phrase ajoutée.').then(() => setNouvelle('')); }}>
        <input value={nouvelle} onChange={(e) => setNouvelle(e.target.value)} maxLength={40} placeholder="Nouvelle phrase…" />
        <button type="submit" className="bouton-or petit" disabled={!nouvelle.trim()}>Ajouter</button>
      </form>
    </section>
  );
}
