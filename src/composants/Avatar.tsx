// Photo du joueur dans son cadre (or par défaut, ou un cadre gagné / acheté). Sans photo : le pirate par défaut.
// Un compagnon (perroquet, singe…) peut se percher sur le cadre.
import { article } from '../lib/perso.ts';
import { IMAGE_ARTICLE } from '../lib/images.ts';

export function Avatar({ photo, taille = 96, alt = '', cadre, compagnon }: {
  photo: string | null; taille?: number; alt?: string; cadre?: string | null; compagnon?: string | null;
}) {
  const c = article(compagnon)?.emojis?.[0];
  const ci = compagnon ? IMAGE_ARTICLE[compagnon] : undefined;
  return (
    <span className={`avatar cadre-${cadre || 'or'}`} style={{ width: taille, height: taille }}>
      <img className="avatar-photo" src={photo || '/decor/avatar-defaut.webp'} alt={alt} draggable={false} />
      <img className="avatar-cadre" src="/decor/cadre-avatar.webp" alt="" draggable={false} />
      {ci ? <img className="avatar-compagnon avatar-compagnon-img" src={ci} alt="" draggable={false} style={{ width: Math.max(22, Math.round(taille * 0.46)), height: Math.max(22, Math.round(taille * 0.46)) }} />
        : c && <span className="avatar-compagnon" style={{ fontSize: Math.max(13, Math.round(taille * 0.34)) }} aria-hidden="true">{c}</span>}
    </span>
  );
}
