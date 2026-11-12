// Rayons de personnalisation de la boutique : Table (dos, tapis, effets), Pirate (titres, bannières, compagnons, thème), Chat (phrases, emotes).
// Et la fenêtre « Offrir à un compagnon ».
import { Patience } from '../composants/Attente.tsx';
import { Visuel } from '../composants/Visuel.tsx';
import { FX, IMAGE_ARTICLE } from '../lib/images.ts';
import { useEffect, useState } from 'react';
import type { Profil } from '../lib/profil.ts';
import type { Article } from '../lib/boutique.ts';
import { ARTICLES, CATEGORIES, equiperPerso, type ArticlePerso, type Categorie, type CategorieEquipable } from '../lib/perso.ts';
import { useAmis } from '../lib/amis.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { ApercuTapis, Banniere, DosCarte, Eclats, PluieEmojis } from '../composants/Perso.tsx';

type Faire = (fn: () => Promise<unknown>, succes: string) => Promise<void>;

export function RayonPerso({ onglet, seule, profil, articles, possedes, enCours, faire, acheter, offrirArticle }: {
  onglet?: 'table' | 'pirate' | 'chat';
  /** N'afficher qu'une seule catégorie. */
  seule?: Categorie;
  profil: Profil;
  articles: Article[];
  possedes: string[];
  enCours: boolean;
  faire: Faire;
  acheter: (a: Article) => void;
  offrirArticle: (a: Article) => void;
}) {
  const [pluie, setPluie] = useState<{ cle: number; emojis: string[] } | null>(null);
  const prix = new Map(articles.map((a) => [a.id, a]));
  const cats = (Object.keys(CATEGORIES) as Categorie[]).filter((c) => (seule ? c === seule : CATEGORIES[c].onglet === onglet));
  return (
    <>
      {cats.map((c) => {
        const info = CATEGORIES[c];
        const liste = ARTICLES.filter((a) => a.categorie === c && (a.gagne || prix.has(a.id)));
        const actuel = info.equipable ? profil.perso?.[c as CategorieEquipable] ?? null : null;
        return (
          <section key={c} className="parchemin rayon-perso">
            <h2 className="titre-pirate">{info.nom}</h2>
            <p className="petit-texte">{info.description}</p>
            <ul className={`grille-perso grille-${c}`}>
              {info.equipable && c !== 'titre' && (
                <li className={!actuel ? 'equipe' : ''}>
                  <Apercu a={{ id: '', categorie: c, nom: 'Classique' }} profil={profil} />
                  <strong>Classique</strong>
                  <button type="button" className={!actuel ? 'bouton-sombre petit' : 'bouton-or petit'} disabled={enCours || !actuel}
                    onClick={() => faire(() => equiperPerso(c as CategorieEquipable, null), 'Style classique remis.')}>{!actuel ? 'Équipé' : 'Équiper'}</button>
                </li>
              )}
              {liste.map((a) => {
                const art = prix.get(a.id);
                const gagne = a.gagne ? profil.est_admin || a.gagne.obtenu(profil) : false;
                const possede = gagne || possedes.includes(a.id) || (!a.gagne && profil.est_admin);
                const equipe = actuel === a.id;
                return (
                  <li key={a.id} className={`${equipe ? 'equipe' : ''} ${a.gagne && !gagne ? 'verrouille' : ''} ${a.anime ? 'anime' : ''}`}>
                    <Apercu a={a} profil={profil} jouerPluie={(e) => setPluie({ cle: Date.now(), emojis: e })} />
                    <strong>{a.nom}</strong>
                    {a.gagne && !gagne ? <small><img className="ico-texte" src="/img/etat_verrou.webp" alt="" /> {a.gagne.condition}</small>
                      : possede ? (
                        info.equipable
                          ? <button type="button" className={equipe ? 'bouton-sombre petit' : 'bouton-or petit'} disabled={enCours}
                              onClick={() => faire(() => equiperPerso(c as CategorieEquipable, equipe ? null : a.id), equipe ? `${a.nom} retiré.` : `${a.nom} équipé !`)}>
                              {equipe ? 'Retirer' : 'Équiper'}</button>
                          : <small className="possede">✓ Dans ton chat</small>
                      ) : art && (
                        <button type="button" className="bouton-or petit" disabled={enCours || profil.louidors < art.prix} onClick={() => acheter(art)}>{art.prix} Louidors</button>
                      )}
                    {a.gagne ? <small className="gagne">🏅 À gagner</small>
                      : art && <button type="button" className="lien offrir" disabled={enCours} onClick={() => offrirArticle(art)}><img className="ico-texte" src="/img/jeu_cadeau.webp" alt="" /> Offrir</button>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {pluie && <PluieTemporaire key={pluie.cle} emojis={pluie.emojis} fin={() => setPluie(null)} />}
    </>
  );
}

function PluieTemporaire({ emojis, fin }: { emojis: string[]; fin: () => void }) {
  useEffect(() => { const t = setTimeout(fin, 4800); return () => clearTimeout(t); }, [fin]);
  return <PluieEmojis emojis={emojis} />;
}

/** Aperçu d'un article selon sa catégorie. */
export function Apercu({ a, profil, jouerPluie }: { a: ArticlePerso; profil: Profil; jouerPluie?: (e: string[]) => void }) {
  const [cle, setCle] = useState(0);
  switch (a.categorie) {
    case 'dos':
      return <span className="apercu-dos"><DosCarte modele={a.id || null} /><DosCarte modele={a.id || null} /></span>;
    case 'tapis':
      return <ApercuTapis modele={a.id || null} />;
    case 'banniere':
      return <Banniere modele={a.id || null} className="apercu-banniere"><span>{profil.pseudo}</span></Banniere>;
    case 'compagnon':
      return <Avatar photo={profil.photo_url} taille={70} cadre={profil.cadre} compagnon={a.id || null} />;
    case 'theme':
      return <span className="apercu-theme" style={{ ['--t' as string]: a.couleur ?? '#ffcc33' }}><i /></span>;
    case 'titre':
      return <span className="apercu-titre"><b>{profil.pseudo}</b><em>« {a.nom} »</em></span>;
    case 'phrase':
      return <ul className="apercu-phrases">{a.textes?.map((t) => <li key={t}>{t}</li>)}</ul>;
    case 'emote':
      return <span className="apercu-emotes">{a.emojis?.join(' ')}</span>;
    case 'victoire':
      return a.emojis
        ? <button type="button" className="apercu-effet" onClick={() => jouerPluie?.(a.emojis!)}><span>{IMAGE_ARTICLE[a.id] ? <Visuel v={IMAGE_ARTICLE[a.id]} className="apercu-img" /> : a.emojis.slice(0, 3).join('')}</span><small>▶ Voir</small></button>
        : <span className="apercu-effet"><span><Visuel v={FX.piece} className="apercu-img" /></span><small>Pièces d’or</small></span>;
    case 'pli':
    case 'entree':
      return a.emojis ? (
        <button type="button" className="apercu-effet" onClick={() => setCle(Date.now())}>
          <span><Visuel v={IMAGE_ARTICLE[a.id] ?? a.emojis[0]} className="apercu-img" /></span><small>▶ Voir</small>
          {cle > 0 && <Eclats key={cle} x="50%" y="45%" emojis={a.emojis} mode={a.mode} couleur={a.couleur} />}
        </button>
      ) : <span className="apercu-effet"><span>—</span><small>Aucun effet</small></span>;
  }
}

/** Choisir à quel compagnon offrir un article. */
export function FenetreOffrir({ article, moi, enCours, fermer, offrir }: {
  article: Article; moi: string; enCours: boolean; fermer: () => void; offrir: (ami: string, pseudo: string) => void;
}) {
  const { amis } = useAmis(moi);
  const liste = (amis ?? []).filter((a) => a.statut === 'acceptee');
  return (
    <div className="voile" onClick={fermer}>
      <section className="parchemin fenetre fenetre-offrir" onClick={(e) => e.stopPropagation()}>
        <h2 className="titre-pirate"><img className="ico-texte" src="/img/jeu_cadeau.webp" alt="" /> Offrir</h2>
        <p className="centre"><strong>{article.nom}</strong> · {article.prix} Louidors</p>
        <p className="petit-texte centre">Payé avec tes Louidors. Ton compagnon reçoit un message.</p>
        {amis === null ? <Patience />
          : liste.length === 0 ? <p className="petit-texte centre">Ajoute d’abord des compagnons depuis l’accueil (« Mes compagnons »).</p>
          : (
            <ul className="liste-amis">
              {liste.map((a) => (
                <li key={a.id}>
                  <Avatar photo={a.photo_url} taille={40} cadre={a.cadre} />
                  <span className="cl-nom"><strong>{a.pseudo}</strong></span>
                  <button type="button" className="bouton-or petit" disabled={enCours} onClick={() => offrir(a.id, a.pseudo)}>Offrir</button>
                </li>
              ))}
            </ul>
          )}
        <button type="button" className="bouton-sombre" onClick={fermer}>Fermer</button>
      </section>
    </div>
  );
}
