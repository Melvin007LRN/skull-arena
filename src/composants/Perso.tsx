// Briques visuelles des personnalisations : dos de cartes, tapis, bannières, titres, éclats d'effets et pluies.
import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { article, type ModeEclats, type Perso } from '../lib/perso.ts';

/** Dos de carte : l'image par défaut, ou un dos dessiné. */
export function DosCarte({ modele, style, className = '' }: { modele?: string | null; style?: CSSProperties; className?: string }) {
  const a = article(modele);
  if (!a) return <img className={className} src="/decor/dos-carte.webp" alt="" style={style} draggable={false} />;
  return (
    <span className={`dos-perso ${a.id} ${className}`} style={style} aria-hidden="true">
      <i>{a.emojis?.[0]}</i>
    </span>
  );
}

/** Aperçu d'un tapis de table (rectangle arrondi). */
export function ApercuTapis({ modele }: { modele?: string | null }) {
  return <span className={`apercu-tapis tapis-fond ${modele ?? 'tapis_defaut'}`} aria-hidden="true" />;
}

/** Fond de carte de pirate (profil, fiche). */
export function Banniere({ modele, className = '', children }: { modele?: string | null; className?: string; children?: ReactNode }) {
  return <div className={`banniere-perso ${modele ?? ''} ${className}`}>{children}</div>;
}

/** Titre équipé (rien si aucun). */
export function Titre({ perso, className = '' }: { perso?: Perso | null; className?: string }) {
  const a = article(perso?.titre);
  return a ? <span className={`titre-perso ${className}`}>« {a.nom} »</span> : null;
}

/** Éclats d'emojis autour d'un point (effets de pli, entrées, aperçus). */
export function Eclats({ x, y, emojis, mode = 'gerbe', couleur, retard = 0, nombre }: {
  x: number | string; y: number | string; emojis: string[]; mode?: ModeEclats; couleur?: string; retard?: number; nombre?: number;
}) {
  const parts = useMemo(() => Array.from({ length: nombre ?? (mode === 'explosion' ? 16 : 12) }, (_, k) => {
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 70;
    return { k, e: emojis[k % emojis.length], tx: Math.cos(a) * d, ty: Math.sin(a) * d - (mode === 'gerbe' ? 30 : 0),
      dl: Math.random() * 0.25, s: 0.55 + Math.random() * 0.7, r: Math.random() * 720 - 360, px: (Math.random() - 0.5) * 170 };
  }), [emojis, mode, nombre]);
  return (
    <span className="eclats-perso" aria-hidden="true">
      {couleur && <span className="flash-perso" style={{ left: x, top: y, ['--flash' as string]: couleur, animationDelay: `${retard}s` }} />}
      {parts.map((p) => (
        <span key={p.k} className={`eclat eclat-${mode}`} style={{ left: x, top: y, animationDelay: `${retard + p.dl}s`,
          ['--tx' as string]: `${p.tx}px`, ['--ty' as string]: `${p.ty}px`, ['--s' as string]: p.s, ['--r' as string]: `${p.r}deg`, ['--px' as string]: `${p.px}px`, ['--k' as string]: p.k }}>{p.e}</span>
      ))}
    </span>
  );
}

/** Pluie d'emojis sur tout l'écran (célébration de victoire). */
export function PluieEmojis({ emojis, nombre = 46 }: { emojis: string[]; nombre?: number }) {
  const gouttes = useMemo(() => Array.from({ length: nombre }, (_, k) => ({
    k, e: emojis[k % emojis.length], gauche: Math.random() * 100, retard: Math.random() * 2.6, duree: 2.2 + Math.random() * 1.8,
    taille: 18 + Math.random() * 20, tour: Math.random() * 720 - 360,
  })), [emojis, nombre]);
  return (
    <div className="pluie-emojis" aria-hidden="true">
      {gouttes.map((g) => (
        <span key={g.k} style={{ left: `${g.gauche}%`, fontSize: g.taille, animationDelay: `${g.retard}s`, animationDuration: `${g.duree}s`, ['--tour' as string]: `${g.tour}deg` }}>{g.e}</span>
      ))}
    </div>
  );
}
