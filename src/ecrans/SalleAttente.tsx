// Salle d'attente : les joueurs s'installent autour de la table, se déclarent prêts, l'hôte lance.
import { Patience } from '../composants/Attente.tsx';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { appel, partagerInvitation, type MembreSalon, type Salon } from '../lib/jeu.ts';
import { Titre } from '../composants/Perso.tsx';
import { Avatar } from '../composants/Avatar.tsx';
import { inviterAmi, useAmis, useEnLigne } from '../lib/amis.ts';
import { messageErreur } from '../lib/supabase.ts';
import { useBloques, useChatSalon, useSocial } from '../lib/social.ts';

export function SalleAttente({ salon, membres, moi, quitter }: {
  salon: Salon; membres: MembreSalon[]; moi: string; quitter: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const suisHote = salon.hote === moi;
  const places = salon.extension ? 9 : 8; // 9 places avec l'extension
  const moiMembre = membres.find((m) => m.joueur_id === moi);
  const [panneauAmis, setPanneauAmis] = useState(false);
  const { ouvrirProfil } = useSocial();
  const bloques = useBloques();
  const chat = useChatSalon(salon.id);
  const [texte, setTexte] = useState('');
  const finChat = useRef<HTMLDivElement>(null);
  useEffect(() => { finChat.current?.scrollIntoView({ block: 'nearest' }); }, [chat.messages.length]);
  const envoyerChat = async (e: FormEvent) => {
    e.preventDefault();
    const t = texte.trim();
    if (!t) return;
    setTexte('');
    try { await chat.envoyer(t); } catch (err) { setErreur(messageErreur(err)); setTexte(t); }
  };
  const [invites, setInvites] = useState<string[]>([]);
  const { amis } = useAmis(moi);
  const enLigne = useEnLigne();
  const amisDispo = (amis ?? []).filter((a) => a.statut === 'acceptee' && !membres.some((m) => m.joueur_id === a.id))
    .sort((a, b) => Number(enLigne.has(b.id)) - Number(enLigne.has(a.id)));
  const inviter = async (id: string) => {
    try {
      await inviterAmi(id, salon.id);
      setInvites((l) => [...l, id]);
      setTimeout(() => setInvites((l) => l.filter((x) => x !== id)), 20000);
    } catch (e) { setErreur(messageErreur(e)); }
  };
  const tousPrets = membres.length >= 2 && membres.every((m) => m.joueur_id === salon.hote || m.pret);

  async function faire(fn: () => Promise<unknown>) {
    setEnCours(true);
    setErreur(null);
    try {
      await fn();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const partager = async () => {
    const r = await partagerInvitation(salon.code);
    if (r === 'copie') {
      setInfo('Lien copié, colle-le à tes amis !');
      setTimeout(() => setInfo(null), 2500);
    }
  };

  return (
    <main className="ecran ecran-attente">
      <button type="button" className="retour" onClick={() => faire(async () => { await appel('quitter', { salon_id: salon.id }); quitter(); })}>
        ‹ Quitter le salon
      </button>

      <section className="parchemin code-salon">
        <p className="sous-titre">{salon.public ? 'Salon public' : 'Salon privé'} · code</p>
        <p className="code">{salon.code}</p>
        <div className="boutons-fin">
          <button type="button" className="bouton-sombre" onClick={partager}>Partager le lien</button>
          <button type="button" className="bouton-sombre" onClick={() => setPanneauAmis((o) => !o)}>👥 Inviter un ami</button>
        </div>
        {info && <p className="message info">{info}</p>}
        {panneauAmis && (
          <div className="panneau-inviter">
            {amis === null ? <Patience />
              : amisDispo.length === 0 ? <p className="petit-texte centre">Aucun ami à inviter. Ajoute des compagnons depuis l’accueil (« Mes compagnons »).</p>
              : (
                <ul className="liste-amis">
                  {amisDispo.map((a) => (
                    <li key={a.id}>
                      <span className="ami-avatar">
                        <Avatar photo={a.photo_url} taille={40} cadre={a.cadre} />
                        <span className={`pastille-co ${enLigne.has(a.id) ? 'en-ligne' : 'hors-ligne'}`} />
                      </span>
                      <span className="cl-nom"><strong>{a.pseudo}</strong><small>{enLigne.has(a.id) ? 'En ligne' : 'Hors ligne'}</small></span>
                      <button type="button" className="bouton-or petit" disabled={!enLigne.has(a.id) || invites.includes(a.id)} onClick={() => inviter(a.id)}>
                        {invites.includes(a.id) ? 'Invité ✓' : 'Inviter'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        )}
      </section>

      <section className="table-attente" aria-label="Joueurs autour de la table">
        <div className="table-ronde" />
        {Array.from({ length: Math.max(places, membres.length) }, (_, i) => {
          const m = membres[i];
          const angle = (i / Math.max(places, membres.length)) * 2 * Math.PI - Math.PI / 2;
          const style = { left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 41 * Math.sin(angle)}%` };
          if (!m) {
            return suisHote ? (
              <button key={i} type="button" className="siege vide" style={style} disabled={enCours}
                onClick={() => faire(() => appel('ajouter_robot', { salon_id: salon.id }))} aria-label="Ajouter un robot">
                <span>+<img className="ico-texte" src="/img/nav_entrainement.webp" alt="" /></span>
              </button>
            ) : <div key={i} className="siege vide" style={style}><span>+</span></div>;
          }
          return (
            <div key={m.joueur_id} className={`siege ${m.pret || m.joueur_id === salon.hote ? 'pret' : ''}`} style={style}>
              <button type="button" className="siege-ouvrir" disabled={m.est_robot || m.joueur_id === moi} onClick={() => ouvrirProfil(m.joueur_id)} aria-label={`Profil de ${m.pseudo}`}>
                <Avatar photo={m.photo_url} taille={58} alt={m.pseudo} cadre={m.cadre} compagnon={m.perso?.compagnon} />
              </button>
              <span className="siege-nom">{m.joueur_id === salon.hote && '👑 '}{m.pseudo}<Titre perso={m.perso} className="siege-titre" /></span>
              {suisHote && m.joueur_id !== moi && (
                <button type="button" className="exclure"
                  onClick={() => faire(() => appel(m.est_robot ? 'retirer_robot' : 'exclure', { salon_id: salon.id, joueur_id: m.joueur_id }))}
                  aria-label={m.est_robot ? `Retirer ${m.pseudo}` : `Exclure ${m.pseudo}`}>✕</button>
              )}
            </div>
          );
        })}
        <div className="table-centre">
          <strong>{membres.length} / {places}</strong>
          <small>pirates à bord</small>
        </div>
      </section>

      <section className="parchemin chat-salon">
        <p className="sous-titre"><img className="ico-texte" src="/img/jeu_chat.webp" alt="" /> Le pont · discute avant le départ</p>
        <div className="chat-messages">
          {chat.messages.filter((m) => !bloques.has(m.de)).length === 0 && <p className="petit-texte centre">Aucun message pour l’instant.</p>}
          {chat.messages.filter((m) => !bloques.has(m.de)).map((m) => (
            <p key={m.id} className={`chat-ligne ${m.de === moi ? 'moi' : ''}`}>
              <button type="button" className="chat-auteur" onClick={() => m.de !== moi && ouvrirProfil(m.de)}>{m.pseudo}</button> {m.texte}
            </p>
          ))}
          <div ref={finChat} />
        </div>
        <form className="ligne-pseudo" onSubmit={envoyerChat}>
          <input value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={150} placeholder="Écris à l’équipage…" autoComplete="off" enterKeyHint="send" />
          <button type="submit" className="bouton-or petit" disabled={!texte.trim()}>Envoyer</button>
        </form>
      </section>

      <section className="parchemin regle-extension">
        {suisHote ? (
          <button type="button" className={`interrupteur ${salon.extension ? 'actif' : ''}`} role="switch" aria-checked={Boolean(salon.extension)} disabled={enCours}
            onClick={() => faire(() => appel('regler_salon', { salon_id: salon.id, extension: !salon.extension }))}>
            <span className="interrupteur-texte"><strong>Avec l’extension</strong><small>19 cartes en plus : Mary Thorne, le Second, la Raie, Davy Jones…</small></span>
            <span className="interrupteur-curseur" aria-hidden="true"><span /></span>
          </button>
        ) : (
          <p className="petit-texte centre">{salon.extension ? '🃏 Partie avec l’extension (19 cartes en plus)' : 'Partie avec le jeu de base'}</p>
        )}
        {suisHote ? (
          <button type="button" className={`interrupteur ${salon.bonus_toujours ? 'actif' : ''}`} role="switch" aria-checked={Boolean(salon.bonus_toujours)} disabled={enCours}
            onClick={() => faire(() => appel('regler_salon', { salon_id: salon.id, bonus_toujours: !salon.bonus_toujours }))}>
            <span className="interrupteur-texte"><strong>Bonus toujours comptés</strong><small>Les bonus (14, captures de Pirates, Skull King…) rapportent même si la mise est ratée</small></span>
            <span className="interrupteur-curseur" aria-hidden="true"><span /></span>
          </button>
        ) : (
          salon.bonus_toujours && <p className="petit-texte centre">⭐ Variante : les bonus comptent même si la mise est ratée</p>
        )}
      </section>

      {erreur && <p className="message erreur">{erreur}</p>}
      {suisHote && membres.length < places && (
        <button type="button" className="bouton-sombre" disabled={enCours} onClick={() => faire(() => appel('ajouter_robot', { salon_id: salon.id }))}>
          + Ajouter un robot pirate
        </button>
      )}

      {suisHote ? (
        <button type="button" className="bouton-or bouton-jouer" disabled={enCours || !tousPrets}
          onClick={() => faire(() => appel('lancer', { salon_id: salon.id }))}>
          {membres.length < 2 ? 'En attente de pirates…' : tousPrets ? 'Lever l’ancre !' : 'En attente des retardataires…'}
        </button>
      ) : (
        <button type="button" className={moiMembre?.pret ? 'bouton-sombre' : 'bouton-or bouton-jouer'} disabled={enCours}
          onClick={() => faire(() => appel('pret', { salon_id: salon.id, pret: !moiMembre?.pret }))}>
          {moiMembre?.pret ? 'Prêt ✓ (toucher pour annuler)' : 'Je suis prêt !'}
        </button>
      )}
      <p className="petit-texte centre">
        {suisHote ? 'Tu es le capitaine : lance la partie quand tout l’équipage est prêt.' : 'Le capitaine lancera la partie quand tout le monde sera prêt.'}
      </p>
    </main>
  );
}
