// Photo du joueur dans le cadre or. Sans photo : le pirate par défaut.
export function Avatar({ photo, taille = 96, alt = '' }: { photo: string | null; taille?: number; alt?: string }) {
  return (
    <span className="avatar" style={{ width: taille, height: taille }}>
      <img className="avatar-photo" src={photo || '/decor/avatar-defaut.webp'} alt={alt} draggable={false} />
      <img className="avatar-cadre" src="/decor/cadre-avatar.webp" alt="" draggable={false} />
    </span>
  );
}
