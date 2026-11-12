// Bandeau du nom façon logo : chapeau, ruban rouge, nom en lettres d'or, titre en néon bleu, ancre.
// Les pièces peintes viennent de l'illustration du capitaine ; le nom et le titre sont écrits par-dessus,
// donc le bandeau s'adapte à chaque pirate (longueur du pseudo comprise).
import { article, type Perso } from '../lib/perso.ts';

export function BandeauNom({ pseudo, perso, repli, className = '' }: { pseudo: string; perso?: Perso | null; repli?: string; className?: string }) {
  const titre = article(perso?.titre)?.nom ?? repli ?? '';
  // Taille du nom selon sa longueur (en % de la largeur du bandeau)
  const taille = Math.min(15, 72 / Math.max(1, pseudo.length * 0.66));
  const tailleTitre = Math.min(7, 62 / Math.max(1, titre.length * 0.42));
  return (
    <span className={`bn ${className}`} aria-label={titre ? `${pseudo}, ${titre}` : pseudo}>
      <img className="bn-ruban g" src="/img/bn_ruban_g.webp" alt="" draggable={false} />
      <img className="bn-ruban d" src="/img/bn_ruban_d.webp" alt="" draggable={false} />
      <span className="bn-tissu" aria-hidden="true" />
      <img className="bn-chapeau" src="/img/bn_chapeau.webp" alt="" draggable={false} />
      <span className="bn-nom" style={{ fontSize: `${taille}cqw` }} aria-hidden="true">{pseudo}</span>
      {titre && <span className="bn-plaque" aria-hidden="true"><span style={{ fontSize: `${tailleTitre}cqw` }}>{titre}</span></span>}
      <img className="bn-ancre" src="/img/bn_ancre.webp" alt="" draggable={false} />
    </span>
  );
}
