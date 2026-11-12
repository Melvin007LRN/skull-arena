// Affiche un « visuel » : l'image peinte si c'est un chemin, sinon l'emoji.
import type { CSSProperties } from 'react';
import { estImage } from '../lib/images.ts';

export function Visuel({ v, className = '', style, alt = '' }: { v: string | undefined | null; className?: string; style?: CSSProperties; alt?: string }) {
  if (!v) return null;
  if (estImage(v)) return <img className={`visuel ${className}`} src={v} alt={alt} style={style} draggable={false} loading="lazy" decoding="async" />;
  return <span className={className} style={style}>{v}</span>;
}
