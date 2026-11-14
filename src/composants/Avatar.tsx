// Photo du joueur dans son cadre (or par défaut, ou un cadre gagné / acheté). Sans photo : le pirate par défaut.
// Un compagnon (perroquet, singe…) peut se percher sur le cadre.
import { article } from '../lib/perso.ts';
import { CADRE_PEINT, CADRE_TROU, IMAGE_ARTICLE } from '../lib/images.ts';
import type { CSSProperties } from 'react';

/** Part du cadre occupée par la photo quand le cadre est peint. */
const PHOTO = 0.66;

/** Place le cadre peint pour que son trou tombe pile sur la photo (centrée, 66 % de l'avatar). */
function placement(cadre: string, taille: number): CSSProperties {
  const [x, y, r] = CADRE_TROU[cadre] ?? [0.5, 0.5, 0.23];
  const f = Math.min(1.85, (PHOTO / 2) * 1.05 / r); // largeur du cadre, en tailles d'avatar
  const gauche = 0.5 - x * f, haut = 0.5 - y * f;
  const debord = Math.max(-gauche, -haut, gauche + f - 1, haut + f - 1, 0);
  return {
    ['--fw' as string]: `${f * 100}%`, ['--fx' as string]: `${gauche * 100}%`, ['--fy' as string]: `${haut * 100}%`,
    ['--deb' as string]: `${Math.ceil(debord * taille) + 6}px`,
  } as CSSProperties;
}

export function Avatar({ photo, taille = 96, alt = '', cadre, compagnon }: {
  photo: string | null; taille?: number; alt?: string; cadre?: string | null; compagnon?: string | null;
}) {
  const c = article(compagnon)?.emojis?.[0];
  const ci = compagnon ? IMAGE_ARTICLE[compagnon] : undefined;
  const peint = cadre ? CADRE_PEINT[cadre] : undefined;
  return (
    <span className={`avatar cadre-${cadre || 'or'} ${peint ? 'cadre-peint' : ''}`} style={{ width: taille, height: taille, ...(peint && cadre ? placement(cadre, taille) : {}) }}>
      <img className="avatar-photo" src={photo || '/decor/avatar-defaut.webp'} alt={alt} draggable={false} />
      <img className="avatar-cadre" src={peint ?? '/decor/cadre-avatar.webp'} alt="" draggable={false} />
      {ci ? <img className="avatar-compagnon avatar-compagnon-img" src={ci} alt="" draggable={false} style={{ width: Math.max(22, Math.round(taille * 0.46)), height: Math.max(22, Math.round(taille * 0.46)) }} />
        : c && <span className="avatar-compagnon" style={{ fontSize: Math.max(13, Math.round(taille * 0.34)) }} aria-hidden="true">{c}</span>}
    </span>
  );
}
