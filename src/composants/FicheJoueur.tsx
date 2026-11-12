// Fiche d'un joueur (visible par tous) : stats, badges, dernières parties, et actions (ami, message, inviter, signaler, bloquer).
import { IMAGE_GRADE } from '../lib/images.ts';
import { Visuel } from './Visuel.tsx';
import { Patience } from './Attente.tsx';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase, messageErreur } from '../lib/supabase.ts';
import {
  BADGES, chargerHistorique, chargerProfil, grade, niveau, pointsMoyens, precisionMises, progressionBadge,
  type LigneHistorique, type Profil,
} from '../lib/profil.ts';
import { demanderAmi, inviterAmi, useEnLigne } from '../lib/amis.ts';
import { bloquer, MOTIFS_SIGNALEMENT, rechargerBlocages, signaler, useBloques, useConversation, useSocial } from '../lib/social.ts';
import { Avatar } from './Avatar.tsx';
import { Titre } from './Perso.tsx';

type Lien = 'aucun' | 'attente_envoyee' | 'attente_recue' | 'ami';

export function FicheJoueur({ joueur, moi, fermer, salonInvitation }: { joueur: string; moi: string; fermer: () => void; salonInvitation?: string | null }) {
  const [p, setP] = useState<Profil | null | undefined>(undefined);
  const [historique, setHistorique] = useState<LigneHistorique[]>([]);
  const [lien, setLien] = useState<Lien>('aucun');
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [signalement, setSignalement] = useState(false);
  const enLigne = useEnLigne();
  const bloques = useBloques();
  const { ouvrirMessages } = useSocial();

  const chargerLien = async () => {
    const { data } = await supabase.from('amities').select('demandeur, destinataire, statut')
      .or(`and(demandeur.eq.${moi},destinataire.eq.${joueur}),and(demandeur.eq.${joueur},destinataire.eq.${moi})`).maybeSingle();
    const l = data as { demandeur: string; statut: string } | null;
    setLien(!l || l.statut === 'retiree' ? 'aucun' : l.statut === 'acceptee' ? 'ami' : l.demandeur === moi ? 'attente_envoyee' : 'attente_recue');
  };

  useEffect(() => {
    chargerProfil(joueur).then(setP).catch(() => setP(null));
    chargerHistorique(joueur, 5).then(setHistorique).catch(() => {});
    if (joueur !== moi) chargerLien();
  }, [joueur]); // eslint-disable-line react-hooks/exhaustive-deps

  async function faire(fn: () => Promise<unknown>, succes: string) {
    setMessage(null);
    try { await fn(); setMessage({ ok: true, texte: succes }); await chargerLien(); } catch (e) { setMessage({ ok: false, texte: messageErreur(e) }); }
  }

  const estMoi = joueur === moi;
  const bloque = bloques.has(joueur);

  return (
    <div className="voile fiche-voile" onClick={fermer}>
      <section className="parchemin fenetre fiche-joueur" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="fiche-fermer" onClick={fermer} aria-label="Fermer">✕</button>
        {p === undefined && <Patience />}
        {p === null && <p className="message erreur">Ce pirate est introuvable.</p>}
        {p && (() => {
          const n = niveau(p.xp);
          const pm = pointsMoyens(p);
          const prec = precisionMises(p);
          return (
            <>
              <div className={`fiche-entete ${p.perso?.banniere ? `banniere-perso ${p.perso.banniere}` : ''}`}>
                <span className="ami-avatar">
                  <Avatar photo={p.photo_url} taille={96} cadre={p.cadre} alt={p.pseudo} compagnon={p.perso?.compagnon} />
                  {!estMoi && <span className={`pastille-co ${enLigne.has(joueur) ? 'en-ligne' : 'hors-ligne'}`} />}
                </span>
                <div>
                  <h2 className="titre-pirate">{p.pseudo}</h2>
                  <Titre perso={p.perso} />
                  <p className="grade">{IMAGE_GRADE[grade(n)] && <img className="ico-texte" src={IMAGE_GRADE[grade(n)]} alt="" />}Niveau {n} · {grade(n)}</p>
                  <small>{enLigne.has(joueur) ? '🟢 En ligne' : 'Hors ligne'}{p.est_admin ? ' · ⚓ Capitaine du navire' : ''}</small>
                </div>
              </div>
              <div className="stats fiche-stats">
                <div className="stat"><span className="stat-valeur">{p.parties_jouees}</span><span className="stat-libelle">Parties</span></div>
                <div className="stat"><span className="stat-valeur">{p.victoires}</span><span className="stat-libelle">Victoires</span></div>
                <div className="stat"><span className="stat-valeur">{pm ?? '—'}</span><span className="stat-libelle">PM</span></div>
                <div className="stat"><span className="stat-valeur">{p.meilleur_score ?? '—'}</span><span className="stat-libelle">Record</span></div>
                <div className="stat"><span className="stat-valeur">{prec === null ? '—' : `${prec}%`}</span><span className="stat-libelle">Mises</span></div>
              </div>
              <div className="fiche-badges">
                {BADGES.map((b) => {
                  const ok = progressionBadge(p, b.id).obtenu;
                  return <span key={b.id} className={ok ? 'obtenu' : ''} title={`${b.nom} · ${b.condition}`}><Visuel v={b.icone} /></span>;
                })}
              </div>
              {historique.length > 0 && (
                <ul className="fiche-historique">
                  {historique.map((h) => (
                    <li key={h.partie_id}>
                      <span>{h.victoire ? '👑' : h.abandon ? '🏳' : `${h.rang}e`}</span>
                      <span>{h.victoire ? 'Victoire' : h.abandon ? 'Abandon' : `${h.rang}e sur ${h.nb_joueurs}`}</span>
                      <strong>{h.score} pts</strong>
                    </li>
                  ))}
                </ul>
              )}

              {message && <p className={`message ${message.ok ? 'info' : 'erreur'}`}>{message.texte}</p>}

              {!estMoi && !bloque && (
                <div className="fiche-actions">
                  {lien === 'ami' && <button type="button" className="bouton-or petit" onClick={() => { fermer(); ouvrirMessages(joueur); }}><img className="ico-texte" src="/img/jeu_chat.webp" alt="" /> Message</button>}
                  {lien === 'ami' && salonInvitation && enLigne.has(joueur) && (
                    <button type="button" className="bouton-or petit" onClick={() => faire(() => inviterAmi(joueur, salonInvitation), 'Invitation envoyée !')}>🏴‍☠️ Inviter</button>
                  )}
                  {lien === 'aucun' && <button type="button" className="bouton-or petit" onClick={() => faire(() => demanderAmi(p.pseudo), 'Demande d’ami envoyée !')}>➕ Ajouter en ami</button>}
                  {lien === 'attente_recue' && <button type="button" className="bouton-or petit" onClick={() => faire(() => demanderAmi(p.pseudo), 'Vous êtes maintenant amis !')}>✅ Accepter sa demande</button>}
                  {lien === 'attente_envoyee' && <span className="petit-texte">Demande d’ami envoyée · en attente</span>}
                </div>
              )}
              {!estMoi && (
                <div className="fiche-moderation">
                  <button type="button" className="lien" onClick={() => setSignalement((s) => !s)}>⚠ Signaler</button>
                  <button type="button" className="lien danger" onClick={() => {
                    if (!bloque && !confirm(`Bloquer ${p.pseudo} ? Vous ne serez plus amis, il ne pourra plus t’écrire et tu ne verras plus ses messages.`)) return;
                    faire(async () => { await bloquer(joueur, !bloque); await rechargerBlocages(); }, bloque ? `${p.pseudo} est débloqué.` : `${p.pseudo} est bloqué.`);
                  }}>{bloque ? 'Débloquer' : '⛔ Bloquer'}</button>
                </div>
              )}
              {signalement && (
                <div className="fiche-signaler">
                  <small>Pourquoi signales-tu {p.pseudo} ?</small>
                  {MOTIFS_SIGNALEMENT.map((m) => (
                    <button key={m} type="button" className="bouton-sombre petit" onClick={() => { setSignalement(false); faire(() => signaler(joueur, m), 'Merci, le signalement a été envoyé au capitaine du navire.'); }}>{m}</button>
                  ))}
                </div>
              )}
            </>
          );
        })()}
      </section>
    </div>
  );
}

/** Conversation privée avec un ami (les 20 derniers messages). */
export function Conversation({ ami, moi, fermer }: { ami: string; moi: string; fermer: () => void }) {
  const { messages, envoyer } = useConversation(moi, ami);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [nom, setNom] = useState('…');
  const [photo, setPhoto] = useState<{ url: string | null; cadre: string | null }>({ url: null, cadre: null });
  const bas = useRef<HTMLDivElement>(null);
  const { ouvrirProfil } = useSocial();
  const enLigne = useEnLigne();

  useEffect(() => {
    chargerProfil(ami).then((p) => { if (p) { setNom(p.pseudo); setPhoto({ url: p.photo_url, cadre: p.cadre }); } }).catch(() => {});
  }, [ami]);
  useEffect(() => { bas.current?.scrollIntoView({ block: 'end' }); }, [messages?.length]);

  async function valider(e: FormEvent) {
    e.preventDefault();
    const t = texte.trim();
    if (!t) return;
    setErreur(null);
    setTexte('');
    try { await envoyer(t); } catch (err) { setErreur(messageErreur(err)); setTexte(t); }
  }

  return (
    <div className="voile fiche-voile" onClick={fermer}>
      <section className="parchemin fenetre conversation" onClick={(e) => e.stopPropagation()}>
        <header className="conv-entete">
          <button type="button" className="conv-ami" onClick={() => { fermer(); ouvrirProfil(ami); }}>
            <Avatar photo={photo.url} taille={40} cadre={photo.cadre} />
            <span><strong>{nom}</strong><small>{enLigne.has(ami) ? 'En ligne' : 'Hors ligne'}</small></span>
          </button>
          <button type="button" className="fiche-fermer" onClick={fermer} aria-label="Fermer">✕</button>
        </header>
        <div className="conv-messages">
          {messages === null && <Patience />}
          {messages?.length === 0 && <p className="petit-texte centre">Aucun message. Lance la conversation !</p>}
          {messages?.map((m) => (
            <p key={m.id} className={`bulle-msg ${m.de === moi ? 'moi' : ''}`}>
              {m.texte}
              <small>{new Date(m.cree_le).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</small>
            </p>
          ))}
          <div ref={bas} />
        </div>
        {erreur && <p className="message erreur">{erreur}</p>}
        <form className="ligne-pseudo" onSubmit={valider}>
          <input value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={200} placeholder="Ton message…" autoComplete="off" enterKeyHint="send" />
          <button type="submit" className="bouton-or petit" disabled={!texte.trim()}>Envoyer</button>
        </form>
        <small className="petit-texte centre">Les 20 derniers messages sont gardés · les gros mots sont masqués</small>
      </section>
    </div>
  );
}
