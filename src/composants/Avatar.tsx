// Photo du joueur dans son cadre (or par défaut, ou un cadre gagné / acheté). Sans photo : le pirate par défaut.
export function Avatar({ photo, taille = 96, alt = '', cadre }: { photo: string | null; taille?: number; alt?: string; cadre?: string | null }) {
  return (
    <span className={`avatar cadre-${cadre || 'or'}`} style={{ width: taille, height: taille }}>
      <img className="avatar-photo" src={photo || '/decor/avatar-defaut.webp'} alt={alt} draggable={false} />
      <img className="avatar-cadre" src="/decor/cadre-avatar.webp" alt="" draggable={false} />
    </span>
  );
}
