// Photo du joueur dans son cadre (or par défaut, ou un cadre gagné / acheté). Sans photo : le pirate par défaut.
// Un compagnon (perroquet, singe…) peut se percher sur le cadre.
import { article } from '../lib/perso.ts';

export function Avatar({ photo, taille = 96, alt = '', cadre, compagnon }: {
  photo: string | null; taille?: number; alt?: string; cadre?: string | null; compagnon?: string | null;
}) {
  const c = article(compagnon)?.emojis?.[0];
  return (
    <span className={`avatar cadre-${cadre || 'or'}`} style={{ width: taille, height: taille }}>
      <img className="avatar-photo" src={photo || '/decor/avatar-defaut.webp'} alt={alt} draggable={false} />
      <img className="avatar-cadre" src="/decor/cadre-avatar.webp" alt="" draggable={false} />
      {c && <span className="avatar-compagnon" style={{ fontSize: Math.max(13, Math.round(taille * 0.34)) }} aria-hidden="true">{c}</span>}
    </span>
  );
}
