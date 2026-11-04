// Le grimoire : les règles du jeu, en livre à feuilleter (glisser vers la gauche ou la droite).
import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Page { titre: string; cartes?: string[]; contenu: ReactNode }

const PAGES: Page[] = [
  {
    titre: 'Le but du jeu',
    cartes: ['skull_king'],
    contenu: (
      <>
        <p>De 2 à 8 pirates (9 avec l’extension) s’affrontent en <strong>10 manches</strong>. À chaque manche, tu annonces combien de plis tu vas remporter : c’est ta <strong>mise</strong>.</p>
        <p>Vise juste ! Une mise exacte rapporte gros, une mise ratée fait perdre des points. Le pirate qui a le plus de points après la 10e manche gagne la partie.</p>
      </>
    ),
  },
  {
    titre: 'Une manche',
    cartes: ['dos'],
    contenu: (
      <>
        <p>À la manche 1, chacun reçoit 1 carte ; à la manche 2, 2 cartes… jusqu’à 10 cartes à la manche 10. (À 8 joueurs, la dernière manche se joue avec 9 cartes.)</p>
        <p>Après avoir regardé ta main, tu mises en secret de <strong>0</strong> au nombre de cartes en main. Toutes les mises sont révélées en même temps.</p>
        <p>La couronne 👑 tourne à chaque manche : le joueur à sa gauche ouvre le premier pli.</p>
      </>
    ),
  },
  {
    titre: 'Jouer un pli',
    cartes: ['vert_9', 'vert_12', 'jaune_13'],
    contenu: (
      <>
        <p>Chacun joue une carte à son tour. La <strong>première carte numérotée</strong> fixe la couleur demandée.</p>
        <p>Tu dois <strong>suivre la couleur</strong> si tu en as. Sinon, tu joues ce que tu veux. Les cartes spéciales (Fuite, Pirate, Sirène, Skull King…) peuvent toujours être jouées, même si tu as la couleur.</p>
        <p>Le gagnant du pli ouvre le pli suivant.</p>
      </>
    ),
  },
  {
    titre: 'Couleurs et atout',
    cartes: ['jaune_14', 'violet_14', 'vert_14', 'noir_14'],
    contenu: (
      <>
        <p>Il y a 4 couleurs numérotées de 1 à 14 : <strong>Coffre</strong> (jaune), <strong>Carte au trésor</strong> (violet), <strong>Perroquet</strong> (vert) et le <strong>Pavillon noir</strong>.</p>
        <p>Le Pavillon noir est l’<strong>atout</strong> : il bat les trois autres couleurs. Sans atout, la plus haute carte de la couleur demandée l’emporte.</p>
      </>
    ),
  },
  {
    titre: 'Fuite et Butin',
    cartes: ['fuite_1', 'butin_1'],
    contenu: (
      <>
        <p>La <strong>Fuite</strong> perd toujours. Si tout le monde fuit, la première Fuite jouée gagne le pli.</p>
        <p>Le <strong>Butin</strong> se joue comme une Fuite. Si un autre joueur gagne le pli, vous formez une <strong>alliance</strong> 🤝 : +20 chacun en fin de manche si vos deux mises sont exactes.</p>
      </>
    ),
  },
  {
    titre: 'Les personnages',
    cartes: ['pirate_rosie', 'sirene_1', 'skull_king'],
    contenu: (
      <>
        <p><strong>Pirates</strong> : battent toutes les cartes numérotées et les Sirènes.</p>
        <p><strong>Skull King</strong> : bat les Pirates… mais tombe face à une Sirène.</p>
        <p><strong>Sirènes</strong> : battent les cartes numérotées, perdent contre les Pirates, mais capturent le Skull King.</p>
        <p>Si plusieurs personnages identiques sont joués, le premier posé l’emporte.</p>
      </>
    ),
  },
  {
    titre: 'La Tigresse',
    cartes: ['tigresse'],
    contenu: (
      <>
        <p>Quand tu la joues, tu choisis : <strong>en Pirate</strong> (elle se bat comme un Pirate, mais sans pouvoir) ou <strong>en Fuite</strong> (elle perd).</p>
      </>
    ),
  },
  {
    titre: 'Kraken et Baleine',
    cartes: ['kraken', 'baleine'],
    contenu: (
      <>
        <p><strong>Kraken</strong> 🐙 : le pli est détruit, personne ne le gagne. Le joueur qui l’aurait gagné ouvre le pli suivant.</p>
        <p><strong>Baleine blanche</strong> 🐋 : les cartes spéciales ne valent plus rien. La plus haute carte numérotée gagne, toutes couleurs confondues. Sans carte numérotée, personne ne gagne.</p>
        <p>Si les deux sont jouées, c’est la <strong>dernière posée</strong> qui s’applique. Si l’une d’elles ouvre le pli, la carte numérotée suivante fixe la couleur.</p>
      </>
    ),
  },
  {
    titre: 'Pouvoirs des pirates',
    cartes: ['pirate_bendt', 'pirate_juanita', 'pirate_harry'],
    contenu: (
      <>
        <p>Un pirate n’utilise son pouvoir que s’il <strong>gagne le pli</strong>.</p>
        <ul>
          <li><strong>Rosie de Laney</strong> : choisit qui ouvre le prochain pli.</li>
          <li><strong>Bendt le Bandit</strong> : pioche 2 cartes, puis en défausse 2.</li>
          <li><strong>Rascal de Roatan</strong> : parie 0, 10 ou 20 points, gagnés si sa mise est exacte, perdus sinon.</li>
          <li><strong>Juanita Jade</strong> : regarde en secret les cartes non distribuées.</li>
          <li><strong>Harry le Géant</strong> : en fin de manche, change sa mise de −1, 0 ou +1.</li>
        </ul>
        <p>Rosie, Bendt, Rascal et Juanita n’ont pas d’effet au dernier pli de la manche.</p>
      </>
    ),
  },
  {
    titre: 'Compter les points',
    contenu: (
      <>
        <p><strong>Mise de 1 ou plus</strong> : exacte = <strong>+20 par pli</strong> misé. Ratée = <strong>−10 par pli d’écart</strong>.</p>
        <p><strong>Mise de 0</strong> : réussie = <strong>+10 × le numéro de la manche</strong>. Ratée = <strong>−10 × le numéro de la manche</strong>.</p>
        <p className="exemple">Exemple : à la manche 7, tu mises 0 et ne gagnes aucun pli : +70. Si tu en gagnes un : −70.</p>
      </>
    ),
  },
  {
    titre: 'Les bonus',
    cartes: ['noir_14', 'sirene_2'],
    contenu: (
      <>
        <p>Les bonus ne comptent <strong>que si ta mise est exacte</strong>.</p>
        <ul>
          <li>Capturer un 14 de couleur : <strong>+10</strong> · le 14 noir : <strong>+20</strong></li>
          <li>Une Sirène prise par un Pirate : <strong>+20</strong></li>
          <li>Un Pirate pris par le Skull King : <strong>+30</strong></li>
          <li>Le Skull King pris par une Sirène : <strong>+40</strong></li>
          <li>Alliance de Butin : <strong>+20</strong> chacun</li>
        </ul>
      </>
    ),
  },
  {
    titre: 'L’extension · les couleurs',
    cartes: ['jaune_7x', 'vert_8x', 'violet_0_14', 'joker_15'],
    contenu: (
      <>
        <p>L’hôte peut choisir de jouer <strong>avec l’extension</strong> : 19 cartes en plus, et la table passe à <strong>9 pirates</strong> (10 cartes chacun à la dernière manche).</p>
        <p><strong>7 et 8</strong> (un de chaque couleur) : cartes normales. Celui qui remporte le pli qui contient le 7 perd <strong>5 points</strong>, celui qui remporte le 8 en gagne <strong>5</strong> (si sa mise est exacte). À valeur égale, la première posée gagne.</p>
        <p><strong>0 / 14</strong> : en la posant, tu choisis si elle vaut 0 ou 14. Elle ne rapporte aucun bonus.</p>
        <p><strong>Joker 15</strong> : un 15 jaune, violet ou vert, qui se pose toujours. Si la couleur n’est pas lancée, tu la choisis ; sinon il prend la couleur demandée. Sur un pli noir, il perd contre le noir.</p>
      </>
    ),
  },
  {
    titre: 'L’extension · l’équipage',
    cartes: ['pirate_mary', 'second'],
    contenu: (
      <>
        <p><strong>Mary Thorne</strong> : un Pirate. Si elle gagne le pli, tu prends au hasard une carte dans la main d’un adversaire : il devra <strong>la poser au pli suivant</strong>, même sans suivre la couleur.</p>
        <p><strong>Le Second</strong> : bat toutes les cartes sauf le Skull King et les Sirènes. S’il gagne, il prend les <strong>pouvoirs des Pirates</strong> capturés (pas leurs bonus). Le Skull King ou une Sirène qui le capture gagne <strong>+30</strong>.</p>
        <p>Sirène, Pirate et Second dans le même pli : la Sirène gagne.</p>
      </>
    ),
  },
  {
    titre: 'L’extension · les abysses',
    cartes: ['raie', 'davy_jones'],
    contenu: (
      <>
        <p><strong>Raie tachetée</strong> 🐟 : un léviathan, l’inverse de la Baleine. La <strong>plus petite carte numérotée</strong> gagne, toutes couleurs confondues (égalité : la première posée). Sans carte numérotée, personne ne gagne.</p>
        <p>Avec plusieurs léviathans (Kraken, Baleine, Raie), c’est le <strong>dernier posé</strong> qui décide.</p>
        <p><strong>Casier de Davy Jones</strong> : ne gagne jamais. Il détruit tous les léviathans du pli, puis le pli se joue normalement. Le gagnant touche <strong>+20 par léviathan détruit</strong>.</p>
      </>
    ),
  },
  {
    titre: 'L’extension · la poudre',
    cartes: ['planche', 'salve'],
    contenu: (
      <>
        <p><strong>Supplice de la planche</strong> : ne gagne jamais. À la fin du pli, tu jettes un Pirate à la mer (tu choisis s’il y en a plusieurs). Le pli se joue <strong>comme s’il n’avait pas été posé</strong> : il ne gagne rien et ne rapporte rien.</p>
        <p><strong>Dernière salve</strong> : ne gagne jamais (ce n’est pas une Fuite). Quand tout le monde a joué, tu poses <strong>une deuxième carte</strong>, en suivant la couleur. Tu auras donc une carte de moins et tu ne joueras pas le dernier pli.</p>
        <p>Si la Raie, le Casier, la Planche ou la Salve ouvre le pli, c’est la carte suivante qui fixe la couleur.</p>
      </>
    ),
  },
  {
    titre: 'À bord de Skull Arena',
    cartes: ['pirate_rascal'],
    contenu: (
      <>
        <p>Une partie compte pour le classement s’il y a au moins 2 humains au départ. Les parties d’entraînement ne comptent pas.</p>
        <p>Quitter une partie = défaite. Si tu es déconnecté ou absent plus de 2 minutes, un robot joue à ta place et tu reprends la main à la manche suivante.</p>
        <p>Gagne de l’XP à chaque partie, monte de grade (Mousse → Matelot → Quartier-maître → Capitaine → Amiral → Légende) et décroche les 5 badges.</p>
      </>
    ),
  },
];

export function EcranRegles({ retour }: { retour: () => void }) {
  const livre = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const el = livre.current;
    if (!el) return;
    const surDefilement = () => setPage(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener('scroll', surDefilement, { passive: true });
    return () => el.removeEventListener('scroll', surDefilement);
  }, []);

  const aller = (i: number) => {
    const el = livre.current;
    if (!el) return;
    const cible = Math.max(0, Math.min(PAGES.length - 1, i));
    el.scrollTo({ left: cible * el.clientWidth, behavior: 'smooth' });
  };

  return (
    <main className="ecran ecran-regles">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <h1 className="titre-pirate grand">Le grimoire</h1>

      <div className="livre" ref={livre}>
        {PAGES.map((p, i) => (
          <article key={p.titre} className="page-livre" aria-label={`Page ${i + 1} : ${p.titre}`}>
            <div className="page-contenu">
              <p className="page-numero">Chapitre {i + 1}</p>
              <h2 className="titre-pirate">{p.titre}</h2>
              {p.cartes && (
                <div className="page-cartes">
                  {p.cartes.map((c) => (
                    <img key={c} src={c === 'dos' ? '/decor/dos-carte.webp' : `/cartes/${c}.webp`} alt="" loading="lazy" />
                  ))}
                </div>
              )}
              <div className="page-texte">{p.contenu}</div>
            </div>
          </article>
        ))}
      </div>

      <nav className="livre-nav" aria-label="Pages">
        <button type="button" className="bouton-sombre petit-rond" onClick={() => aller(page - 1)} disabled={page === 0} aria-label="Page précédente">‹</button>
        <div className="livre-points">
          {PAGES.map((p, i) => (
            <button key={p.titre} type="button" className={i === page ? 'actif' : ''} onClick={() => aller(i)} aria-label={`Aller à : ${p.titre}`} />
          ))}
        </div>
        <button type="button" className="bouton-sombre petit-rond" onClick={() => aller(page + 1)} disabled={page === PAGES.length - 1} aria-label="Page suivante">›</button>
      </nav>
      <p className="petit-texte centre">Glisse pour tourner les pages · {page + 1} / {PAGES.length}</p>
    </main>
  );
}
