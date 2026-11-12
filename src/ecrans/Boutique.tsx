// La boutique du port : une vitrine (l'article à la une + les rayons), puis chaque rayon en détail.
// Objets à lancer en partie, personnalisations, couleurs de pseudo et cadres d'avatar, payés en Louidors.
import { Visuel } from '../composants/Visuel.tsx';
import { useCallback, useEffect, useState } from 'react';
import { messageErreur } from '../lib/supabase.ts';
import type { Profil } from '../lib/profil.ts';
import {
  acheter, CADRES_GAGNES, chargerBoutique, chargerCadresPossedes, chargerInventaire, equiperCadre, equiperNeon, GAINS_LOUIDORS, OBJETS, type Article,
} from '../lib/boutique.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { NEONS, styleNeon } from '../lib/neons.ts';
import { offrir, type Categorie } from '../lib/perso.ts';
import { FenetreOffrir, RayonPerso } from './BoutiquePerso.tsx';
import { ApercuCadeau } from '../jeu/TableJeu.tsx';
import '../jeu/jeu.css';

type Rayon = 'cadeaux' | 'cadres' | 'pseudo' | Categorie;
type Vue = 'vitrine' | Rayon | 'coffre';

/** Toutes les catégories de la boutique, dans l'ordre, chacune avec sa couleur. */
const RAYONS: Array<{ id: Rayon; icone: string; nom: string; sous: string; couleur: string }> = [
  { id: 'cadeaux', icone: '/img/jeu_cadeau.webp', nom: 'Cadeaux', sous: 'à lancer en partie', couleur: '#e5484d' },
  { id: 'cadres', icone: '/img/nav_profil.webp', nom: 'Cadres', sous: 'autour de ton avatar', couleur: '#e3b04b' },
  { id: 'pseudo', icone: '/img/pli_etoiles.webp', nom: 'Pseudo', sous: 'couleur de ton nom', couleur: '#ff4fd8' },
  { id: 'dos', icone: '/img/dos_parchemin.webp', nom: 'Dos de cartes', sous: 'vus par la table', couleur: '#3f7be0' },
  { id: 'tapis', icone: '/img/tapis_capitaine.webp', nom: 'Tapis', sous: 'le fond de ta table', couleur: '#2f9e55' },
  { id: 'pli', icone: '/img/pli_eclair.webp', nom: 'Effets de pli', sous: 'quand tu gagnes un pli', couleur: '#1f9fb8' },
  { id: 'entree', icone: '/img/entree_canon.webp', nom: 'Entrées', sous: 'ton arrivée en partie', couleur: '#d9772b' },
  { id: 'victoire', icone: '/img/nav_classement.webp', nom: 'Célébrations', sous: 'quand tu gagnes', couleur: '#e3b04b' },
  { id: 'titre', icone: '/img/nav_actualites.webp', nom: 'Titres', sous: 'sous ton pseudo', couleur: '#c9a36b' },
  { id: 'banniere', icone: '/img/nav_jouer.webp', nom: 'Bannières', sous: 'fond de ta fiche', couleur: '#8a4fd6' },
  { id: 'compagnon', icone: '/img/compagnon_perroquet.webp', nom: 'Compagnons', sous: 'sur ton avatar', couleur: '#4cc477' },
  { id: 'theme', icone: '/img/fx_gemme.webp', nom: 'Thèmes', sous: 'couleur des menus', couleur: '#ff7a1a' },
  { id: 'phrase', icone: '/img/jeu_chat.webp', nom: 'Phrases', sous: 'pour le chat', couleur: '#8fb4ff' },
  { id: 'emote', icone: '/img/objet_perroquet.webp', nom: 'Emotes', sous: 'réactions', couleur: '#f0c419' },
];

/** Ce que fait chaque objet, en une phrase. */
const DESCRIPTIONS: Record<string, string> = {
  mouchoirs: 'Pour consoler un pirate qui vient de rater sa mise. Pluie de larmes garantie.',
  drapeau_blanc: 'Tu capitules avec panache : colombes et drapeau blanc.',
  tomate: 'Le grand classique. SPLATCH ! La tomate s’écrase et dégouline.',
  poisson: 'Une gifle au poisson pourri, éclaboussures comprises.',
  rhum: 'Une chope offerte à un ami (ou pour noyer son chagrin).',
  rose: 'Une rose et une pluie de pétales. Pour séduire… ou se faire pardonner.',
  perroquet: 'Ton perroquet tourne autour de sa tête en se moquant de lui.',
  doigt: 'Le message est clair.',
  boulet: 'Un boulet de canon en pleine tête. BOUM, fumée et secousse.',
  couronne: 'Couronne le meilleur pirate de la table (en carton, quand même).',
  feu_artifice: 'Un feu d’artifice sur toute la table pour fêter un exploit.',
  bordee: 'Une bordée de canons qui fait trembler tout l’écran.',
  pluie_tresor: 'Une pluie de pièces d’or et un coffre qui déborde.',
  navire_fantome: 'Le navire fantôme traverse la table dans la brume.',
  kraken_poche: 'Le Kraken surgit sous ta cible et l’enserre de ses tentacules.',
  tempete_insultes: '8 secondes d’orage : éclairs, pluie d’insultes en néon et tampon « COULÉ ! ».',
};

export function Louidors({ montant, grand = false }: { montant: number; grand?: boolean }) {
  return <span className={`louidors ${grand ? 'grand' : ''}`}><span className="piece-or" aria-hidden="true" />{montant}<small> Louidors</small></span>;
}

function Prix({ montant }: { montant: number }) {
  return <span className="b-prix"><span className="piece-or" aria-hidden="true" />{montant}</span>;
}

export function EcranBoutique({ profil, retour, recharger }: { profil: Profil; retour: () => void; recharger: () => Promise<void> }) {
  const [vue, setVue] = useState<Vue>('vitrine');
  const [aOffrir, setAOffrir] = useState<Article | null>(null);
  const [fiche, setFiche] = useState<Article | null>(null);
  const [apercu, setApercu] = useState<{ cle: number; objet: string } | null>(null);
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
  useEffect(() => { if (!message) return; const t = setTimeout(() => setMessage(null), 3200); return () => clearTimeout(t); }, [message]);

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

  const aller = (v: Vue) => { setVue(v); setMessage(null); window.scrollTo({ top: 0 }); };
  const objets = articles.filter((a) => a.type === 'objet');
  const petits = objets.filter((o) => !OBJETS[o.id]?.grand);
  const grands = objets.filter((o) => OBJETS[o.id]?.grand);
  const vedette = objets.find((o) => o.id === 'tempete_insultes') ?? grands[grands.length - 1];
  const neons = articles.filter((a) => a.id.startsWith('neon_'));
  const neonActuel = profil.couleur_nom ?? null;
  const cadres = articles.filter((a) => a.type === 'cadre' && !a.id.startsWith('neon_'));
  const actuel = profil.cadre || 'or';
  const peutPayer = (prix: number) => profil.louidors >= prix;
  const nbCoffre = objets.reduce((n, o) => n + (inventaire[o.id] ?? 0), 0);
  const rayon = RAYONS.find((r) => r.id === vue);

  const carteObjet = (o: Article) => (
    <li key={o.id}>
      <button type="button" className={`b-article ${OBJETS[o.id]?.grand ? 'grand' : ''} ${o.id === 'tempete_insultes' ? 'ultime' : ''}`} onClick={() => setFiche(o)}>
        {(inventaire[o.id] ?? 0) > 0 && <span className="b-qte">×{inventaire[o.id]}</span>}
        <span className="b-medaillon"><Visuel v={OBJETS[o.id]?.icone ?? o.icone} /></span>
        <strong>{o.nom}</strong>
        <Prix montant={o.prix} />
      </button>
    </li>
  );

  return (
    <main className="ecran ecran-boutique boutique-nuit">
      <div className="b-haut">
        <button type="button" className="retour" onClick={vue === 'vitrine' ? retour : () => aller('vitrine')}>‹ {vue === 'vitrine' ? 'Retour' : 'Boutique'}</button>
        <span className="b-solde"><span className="piece-or" aria-hidden="true" />{profil.louidors.toLocaleString('fr-FR')}</span>
      </div>
      <h1 className="titre-pirate grand">{vue === 'vitrine' ? 'Boutique' : vue === 'coffre' ? 'Mon coffre' : rayon?.nom}</h1>
      {rayon && <p className="petit-texte centre b-sous">{rayon.sous}</p>}

      {vue !== 'vitrine' && vue !== 'coffre' && (
        <nav className="b-puces" aria-label="Catégories">
          {RAYONS.map((r) => (
            <button key={r.id} type="button" className={vue === r.id ? 'actif' : ''} style={{ ['--rc' as string]: r.couleur }} onClick={() => aller(r.id)}
              ref={(el) => { if (el && vue === r.id && el.parentElement) { const b = el.parentElement; b.scrollLeft = el.offsetLeft - b.clientWidth / 2 + el.clientWidth / 2; } }}>
              <Visuel v={r.icone} />{r.nom}
            </button>
          ))}
        </nav>
      )}

      {vue === 'vitrine' && (
        <>
          {vedette && (
            <button type="button" className="b-une" onClick={() => setFiche(vedette)}>
              <img src="/cartes/kraken.webp" alt="" />
              <span className="b-une-voile" />
              <span className="b-une-texte">
                <small>À la une · Ultime</small>
                <strong>{vedette.nom}</strong>
                <em>{DESCRIPTIONS[vedette.id]?.split(':')[0] ?? 'Le cadeau le plus spectaculaire du port'}</em>
                <Prix montant={vedette.prix} />
              </span>
            </button>
          )}
          <ul className="b-rayons">
            {RAYONS.map((r) => (
              <li key={r.id}>
                <button type="button" style={{ ['--rc' as string]: r.couleur }} onClick={() => aller(r.id)}>
                  <span className="b-rayon-icone"><Visuel v={r.icone} /></span>
                  <strong>{r.nom}</strong>
                  <small>{r.sous}</small>
                </button>
              </li>
            ))}
          </ul>
          <div className="b-section"><h2>Cadeaux à lancer</h2><button type="button" className="lien" onClick={() => aller('cadeaux')}>Tout voir ›</button></div>
          <ul className="b-grille">{petits.slice(0, 3).map(carteObjet)}</ul>
          <div className="b-section"><h2>Spectaculaires</h2><button type="button" className="lien" onClick={() => aller('cadeaux')}>Tout voir ›</button></div>
          <ul className="b-grille">{grands.filter((g) => g.id !== vedette?.id).slice(0, 3).map(carteObjet)}</ul>
          <p className="petit-texte centre b-gains">Gagne des Louidors à chaque partie — {GAINS_LOUIDORS}.</p>
        </>
      )}

      {vue === 'cadeaux' && (
        <>
          <p className="petit-texte centre">Touche un objet pour voir son animation. En partie, lance-le avec le bouton <img className="ico-texte" src="/img/jeu_cadeau.webp" alt="" />.</p>
          <div className="b-section"><h2>Petits objets</h2><span className="b-astuce">Lot de 5 : 1 offert</span></div>
          <ul className="b-grille">{petits.map(carteObjet)}</ul>
          <div className="b-section"><h2>Spectaculaires</h2><span className="b-astuce">Vus par toute la table</span></div>
          <ul className="b-grille">{grands.map(carteObjet)}</ul>
        </>
      )}

      {vue === 'pseudo' && (
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
                        onClick={() => confirm(`Acheter le ${c.nom} pour ${c.prix} Louidors ?`) && faire(() => acheter(c.id), `${c.nom} acheté ! Équipe-le pour l’afficher.`)}><Prix montant={c.prix} /></button>}
                  <button type="button" className="lien offrir" disabled={enCours} onClick={() => setAOffrir(c)}><img className="ico-texte" src="/img/jeu_cadeau.webp" alt="" /> Offrir</button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {vue === 'cadres' && (
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
                        onClick={() => confirm(`Acheter le ${c.nom} pour ${c.prix} Louidors ?`) && faire(() => acheter(c.id), `${c.nom} acheté !`)}><Prix montant={c.prix} /></button>}
                  <button type="button" className="lien offrir" disabled={enCours} onClick={() => setAOffrir(c)}><img className="ico-texte" src="/img/jeu_cadeau.webp" alt="" /> Offrir</button>
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
                    : <small><img className="ico-texte" src="/img/etat_verrou.webp" alt="" /> {c.condition}</small>}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {vue !== 'vitrine' && vue !== 'coffre' && vue !== 'cadeaux' && vue !== 'cadres' && vue !== 'pseudo' && (
        <RayonPerso seule={vue} profil={profil} articles={articles} possedes={possedes} enCours={enCours} faire={faire}
          acheter={(a) => confirm(`Acheter « ${a.nom} » pour ${a.prix} Louidors ?`) && faire(() => acheter(a.id), `${a.nom} acheté !`)}
          offrirArticle={setAOffrir} />
      )}

      {vue === 'coffre' && (
        <>
          <section className="parchemin">
            <h2 className="titre-pirate">Mes objets</h2>
            {nbCoffre === 0
              ? <p className="petit-texte centre">Ton coffre est vide. Passe par les Cadeaux !</p>
              : <ul className="b-grille">{objets.filter((o) => inventaire[o.id]).map(carteObjet)}</ul>}
          </section>
          <section className="parchemin">
            <h2 className="titre-pirate">Mon cadre</h2>
            <div className="cadre-actuel">
              <Avatar photo={profil.photo_url} taille={110} cadre={actuel} />
              <span>{[...cadres, ...CADRES_GAGNES].find((c) => c.id === actuel)?.nom ?? 'Cadre d’Or'}</span>
            </div>
          </section>
        </>
      )}

      <nav className="b-nav">
        <button type="button" className={vue !== 'coffre' ? 'actif' : ''} onClick={() => aller('vitrine')}><i><img src="/img/nav_boutique.webp" alt="" /></i>Boutique</button>
        <button type="button" className={vue === 'coffre' ? 'actif' : ''} onClick={() => aller('coffre')}><i><img src="/img/nav_coffre.webp" alt="" /></i>Mon coffre{nbCoffre > 0 && <b>{nbCoffre}</b>}</button>
      </nav>

      {message && <p className={`b-toast ${message.ok ? 'ok' : 'ko'}`} role="status">{message.texte}</p>}

      {fiche && (
        <div className="voile b-voile" onClick={() => setFiche(null)}>
          <section className="b-fiche" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="b-fermer" onClick={() => setFiche(null)} aria-label="Fermer">×</button>
            <span className={`b-medaillon xl ${fiche.id === 'tempete_insultes' ? 'ultime' : ''}`}><Visuel v={OBJETS[fiche.id]?.icone ?? fiche.icone} /></span>
            {OBJETS[fiche.id]?.grand && <small className="b-etiquette">{fiche.id === 'tempete_insultes' ? 'Ultime' : 'Spectaculaire'}</small>}
            <h2>{fiche.nom}</h2>
            <p>{DESCRIPTIONS[fiche.id] ?? ''}</p>
            <p className="b-possede">Dans ton coffre : <strong>{inventaire[fiche.id] ?? 0}</strong></p>
            <button type="button" className="bouton-sombre" onClick={() => setApercu({ cle: Date.now(), objet: fiche.id })}>▶ Voir l’animation</button>
            <div className="b-achats">
              <button type="button" className="bouton-or" disabled={enCours || !peutPayer(fiche.prix)}
                onClick={() => faire(() => acheter(fiche.id, 1), `${fiche.nom} ajouté à ton coffre.`)}>
                <span>Acheter ×1</span><Prix montant={fiche.prix} />
              </button>
              <button type="button" className="bouton-or b-lot" disabled={enCours || !peutPayer(fiche.prix * 4)}
                onClick={() => faire(() => acheter(fiche.id, 5), `5 × ${fiche.nom} ajoutés à ton coffre.`)}>
                <span>Lot ×5 <em>1 offert</em></span><Prix montant={fiche.prix * 4} />
              </button>
            </div>
            <button type="button" className="lien" disabled={enCours} onClick={() => { const f = fiche; setFiche(null); setAOffrir(f); }}><img className="ico-texte" src="/img/jeu_cadeau.webp" alt="" /> Offrir à un compagnon</button>
          </section>
        </div>
      )}

      {apercu && <ApercuCadeau key={apercu.cle} objet={apercu.objet} pseudo={profil.pseudo} photo={profil.photo_url} cadre={profil.cadre} fin={() => setApercu(null)} />}

      {aOffrir && (
        <FenetreOffrir article={aOffrir} moi={profil.id} enCours={enCours} fermer={() => setAOffrir(null)}
          offrir={(ami, pseudo) => {
            if (!confirm(`Offrir « ${aOffrir.nom} » à ${pseudo} pour ${aOffrir.prix} Louidors ?`)) return;
            const a = aOffrir;
            setAOffrir(null);
            faire(() => offrir(a.id, ami), `${a.nom} offert à ${pseudo} !`);
          }} />
      )}
    </main>
  );
}
