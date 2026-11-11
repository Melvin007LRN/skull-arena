// La boutique du port : objets à lancer en partie et cadres d'avatar, payés en Louidors.
import { useCallback, useEffect, useState } from 'react';
import { messageErreur } from '../lib/supabase.ts';
import type { Profil } from '../lib/profil.ts';
import {
  acheter, CADRES_GAGNES, chargerBoutique, chargerCadresPossedes, chargerInventaire, equiperCadre, equiperNeon, GAINS_LOUIDORS, OBJETS, type Article,
} from '../lib/boutique.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { NEONS, styleNeon } from '../lib/neons.ts';
import { offrir } from '../lib/perso.ts';
import { FenetreOffrir, RayonPerso } from './BoutiquePerso.tsx';

type Onglet = 'objets' | 'neons' | 'cadres' | 'table' | 'pirate' | 'chat' | 'coffre';
const ONGLETS: Array<[Onglet, string]> = [
  ['objets', 'Objets'], ['table', 'Table'], ['pirate', 'Pirate'], ['neons', 'Néons'], ['cadres', 'Cadres'], ['chat', 'Chat'], ['coffre', 'Mon coffre'],
];

export function Louidors({ montant, grand = false }: { montant: number; grand?: boolean }) {
  return <span className={`louidors ${grand ? 'grand' : ''}`}><span className="piece-or" aria-hidden="true" />{montant}<small> Louidors</small></span>;
}

export function EcranBoutique({ profil, retour, recharger }: { profil: Profil; retour: () => void; recharger: () => Promise<void> }) {
  const [onglet, setOnglet] = useState<Onglet>('objets');
  const [aOffrir, setAOffrir] = useState<Article | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [inventaire, setInventaire] = useState<Record<string, number>>({});
  const [possedes, setPossedes] = useState<string[]>([]);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);

  const charger = useCallback(async () => {
    const [a, i, c] = await Promise.all([chargerBoutique(), chargerInventaire(), chargerCadresPossedes()]);
    setArticles(a); setInventaire(i); setPossedes(c);
  }, []);
  useEffect(() => { charger().catch(() => setMessage({ ok: false, texte: 'La boutique n’a pas pu être chargée.' })); }, [charger]);

  async function faire(fn: () => Promise<unknown>, succes: string) {
    setEnCours(true);
    setMessage(null);
    try {
      await fn();
      await Promise.all([charger(), recharger()]);
      setMessage({ ok: true, texte: succes });
    } catch (e) {
      setMessage({ ok: false, texte: messageErreur(e) });
    } finally {
      setEnCours(false);
    }
  }

  const objets = articles.filter((a) => a.type === 'objet');
  const petits = objets.filter((o) => !OBJETS[o.id]?.grand);
  const grands = objets.filter((o) => OBJETS[o.id]?.grand);
  const neons = articles.filter((a) => a.id.startsWith('neon_'));
  const neonActuel = profil.couleur_nom ?? null;
  const cadres = articles.filter((a) => a.type === 'cadre' && !a.id.startsWith('neon_'));
  const actuel = profil.cadre || 'or';
  const peutPayer = (prix: number) => profil.louidors >= prix;

  return (
    <main className="ecran ecran-boutique">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <h1 className="titre-pirate grand">La boutique du port</h1>
      <div className="solde"><Louidors montant={profil.louidors} grand /></div>
      <p className="petit-texte centre">Gagne des Louidors à chaque partie comptée — {GAINS_LOUIDORS}.</p>

      <div className="onglets onglets-defilants">
        {ONGLETS.map(([id, nom]) => (
          <button key={id} type="button" className={onglet === id ? 'actif' : ''} onClick={() => { setOnglet(id); setMessage(null); }}>{nom}</button>
        ))}
      </div>
      {message && <p className={`message ${message.ok ? 'info' : 'erreur'}`}>{message.texte}</p>}

      {onglet === 'objets' && (
        <section className="parchemin">
          <p className="petit-texte">À lancer sur un adversaire pendant la partie (bouton 🎁). Chaque lancer utilise un objet.</p>
          <ul className="grille-objets">
            {petits.map((o) => (
              <li key={o.id}>
                <span className="objet-icone">{o.icone}</span>
                <strong>{o.nom}</strong>
                <small>Dans ton coffre : {inventaire[o.id] ?? 0}</small>
                <div className="objet-achats">
                  <button type="button" className="bouton-or petit" disabled={enCours || !peutPayer(o.prix)}
                    onClick={() => faire(() => acheter(o.id, 1), `${o.nom} ajouté à ton coffre.`)}>×1 · {o.prix}</button>
                  <button type="button" className="bouton-sombre petit" disabled={enCours || !peutPayer(o.prix * 4)}
                    onClick={() => faire(() => acheter(o.id, 5), `5 × ${o.nom} ajoutés à ton coffre.`)}>×5 · {o.prix * 4}</button>
                </div>
                <button type="button" className="lien offrir" disabled={enCours} onClick={() => setAOffrir(o)}>🎁 Offrir</button>
              </li>
            ))}
          </ul>
          <p className="petit-texte centre">Le lot de 5 : une offerte !</p>
          <h2 className="titre-pirate">Cadeaux spectaculaires</h2>
          <p className="petit-texte">Une grosse animation sur toute la table, vue par tous les pirates.</p>
          <ul className="grille-objets grands">
            {grands.map((o) => (
              <li key={o.id} className={`objet-grand ${o.id === 'tempete_insultes' ? 'objet-ultime' : ''}`}>
                <span className="objet-icone">{o.icone}</span>
                <strong>{o.nom}</strong>
                <small>Dans ton coffre : {inventaire[o.id] ?? 0}</small>
                <div className="objet-achats">
                  <button type="button" className="bouton-or petit" disabled={enCours || !peutPayer(o.prix)}
                    onClick={() => faire(() => acheter(o.id, 1), `${o.nom} ajouté à ton coffre.`)}>×1 · {o.prix}</button>
                  <button type="button" className="bouton-sombre petit" disabled={enCours || !peutPayer(o.prix * 4)}
                    onClick={() => faire(() => acheter(o.id, 5), `5 × ${o.nom} ajoutés à ton coffre.`)}>×5 · {o.prix * 4}</button>
                </div>
                <button type="button" className="lien offrir" disabled={enCours} onClick={() => setAOffrir(o)}>🎁 Offrir</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {onglet === 'neons' && (
        <section className="parchemin">
          <p className="petit-texte">La couleur de ton pseudo, vue par tous les pirates autour de la table.</p>
          <ul className="grille-neons">
            <li className={!neonActuel ? 'equipe' : ''}>
              <span className="apercu-neon"><span className={styleNeon(null).className}>{profil.pseudo}</span></span>
              <strong>Classique</strong>
              <button type="button" className={!neonActuel ? 'bouton-sombre petit' : 'bouton-or petit'} disabled={enCours || !neonActuel}
                onClick={() => faire(() => equiperNeon(null), 'Pseudo classique équipé.')}>{!neonActuel ? 'Équipé' : 'Équiper'}</button>
            </li>
            {neons.map((c) => {
              const a = possedes.includes(c.id) || profil.est_admin;
              const n = styleNeon(c.id);
              return (
                <li key={c.id} className={neonActuel === c.id ? 'equipe' : ''} style={{ ['--n' as string]: NEONS[c.id]?.couleurs[0] }}>
                  <span className="apercu-neon"><span className={n.className} style={n.style}>{profil.pseudo}</span></span>
                  <strong>{c.nom}</strong>
                  {a
                    ? <button type="button" className={neonActuel === c.id ? 'bouton-sombre petit' : 'bouton-or petit'} disabled={enCours || neonActuel === c.id}
                        onClick={() => faire(() => equiperNeon(c.id), `${c.nom} équipé !`)}>{neonActuel === c.id ? 'Équipé' : 'Équiper'}</button>
                    : <button type="button" className="bouton-or petit" disabled={enCours || !peutPayer(c.prix)}
                        onClick={() => confirm(`Acheter le ${c.nom} pour ${c.prix} Louidors ?`) && faire(() => acheter(c.id), `${c.nom} acheté ! Équipe-le pour l’afficher.`)}>{c.prix} Louidors</button>}
                  <button type="button" className="lien offrir" disabled={enCours} onClick={() => setAOffrir(c)}>🎁 Offrir</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {onglet === 'cadres' && (
        <section className="parchemin">
          <ul className="grille-cadres">
            {cadres.map((c) => {
              const a = possedes.includes(c.id);
              return (
                <li key={c.id} className={actuel === c.id ? 'equipe' : ''}>
                  <Avatar photo={profil.photo_url} taille={84} cadre={c.id} />
                  <strong>{c.nom}</strong>
                  {a
                    ? <button type="button" className={actuel === c.id ? 'bouton-sombre petit' : 'bouton-or petit'} disabled={enCours || actuel === c.id}
                        onClick={() => faire(() => equiperCadre(c.id), `${c.nom} équipé !`)}>{actuel === c.id ? 'Équipé' : 'Équiper'}</button>
                    : <button type="button" className="bouton-or petit" disabled={enCours || !peutPayer(c.prix)}
                        onClick={() => confirm(`Acheter le ${c.nom} pour ${c.prix} Louidors ?`) && faire(() => acheter(c.id), `${c.nom} acheté !`)}>{c.prix} Louidors</button>}
                  <button type="button" className="lien offrir" disabled={enCours} onClick={() => setAOffrir(c)}>🎁 Offrir</button>
                </li>
              );
            })}
          </ul>
          <h2 className="titre-pirate">Cadres à gagner</h2>
          <ul className="grille-cadres">
            {CADRES_GAGNES.map((c) => {
              const ok = profil.est_admin || c.obtenu(profil); // l'admin a accès à tous les cadres
              return (
                <li key={c.id} className={`${actuel === c.id ? 'equipe' : ''} ${ok ? '' : 'verrouille'}`}>
                  <Avatar photo={profil.photo_url} taille={84} cadre={c.id} />
                  <strong>{c.nom}</strong>
                  {ok
                    ? <button type="button" className={actuel === c.id ? 'bouton-sombre petit' : 'bouton-or petit'} disabled={enCours || actuel === c.id}
                        onClick={() => faire(() => equiperCadre(c.id), `${c.nom} équipé !`)}>{actuel === c.id ? 'Équipé' : 'Équiper'}</button>
                    : <small>🔒 {c.condition}</small>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {(onglet === 'table' || onglet === 'pirate' || onglet === 'chat') && (
        <RayonPerso onglet={onglet} profil={profil} articles={articles} possedes={possedes} enCours={enCours} faire={faire}
          acheter={(a) => confirm(`Acheter « ${a.nom} » pour ${a.prix} Louidors ?`) && faire(() => acheter(a.id), `${a.nom} acheté !`)}
          offrirArticle={setAOffrir} />
      )}

      {aOffrir && (
        <FenetreOffrir article={aOffrir} moi={profil.id} enCours={enCours} fermer={() => setAOffrir(null)}
          offrir={(ami, pseudo) => {
            if (!confirm(`Offrir « ${aOffrir.nom} » à ${pseudo} pour ${aOffrir.prix} Louidors ?`)) return;
            const a = aOffrir;
            setAOffrir(null);
            faire(() => offrir(a.id, ami), `${a.nom} offert à ${pseudo} ! 🎁`);
          }} />
      )}

      {onglet === 'coffre' && (
        <section className="parchemin">
          <h2 className="titre-pirate">Mes objets</h2>
          {objets.every((o) => !inventaire[o.id])
            ? <p className="petit-texte centre">Ton coffre est vide. Passe par l’onglet Objets !</p>
            : (
              <ul className="coffre">
                {objets.filter((o) => inventaire[o.id]).map((o) => (
                  <li key={o.id}><span className="objet-icone">{o.icone}</span> {o.nom}<strong>× {inventaire[o.id]}</strong></li>
                ))}
              </ul>
            )}
          <h2 className="titre-pirate">Mon cadre</h2>
          <div className="cadre-actuel">
            <Avatar photo={profil.photo_url} taille={110} cadre={actuel} />
            <span>{[...cadres, ...CADRES_GAGNES].find((c) => c.id === actuel)?.nom ?? 'Cadre d’Or'}</span>
          </div>
        </section>
      )}
    </main>
  );
}
