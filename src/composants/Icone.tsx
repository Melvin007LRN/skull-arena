// Icônes maison : traits dorés façon gravure (remplacent les émojis, qui changent d'aspect selon le téléphone).
import type { CSSProperties } from 'react';
import { IMAGE_ICONE } from '../lib/images.ts';

const TRACES: Record<string, string> = {
  epees: 'M4 4l10 10M4 4h3.5M4 4v3.5M20 4L10 14M20 4h-3.5M20 4v3.5M12.5 15.5l-2-2M11.5 12.5l-2 2M7 17l-3 3M17 17l3 3M13.5 15.5l2 2-1 1-2-2M10.5 15.5l-2 2 1 1 2-2',
  'longue-vue': 'M3 15l12-7 2 3.5-12 7zM15 8l4-2.3 1.6 2.8-4 2.3M7 16.5L8 21M9.5 15.5L12 20',
  boussole: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM15.5 8.5l-2 5-5 2 2-5zM12 3v2M12 19v2M3 12h2M19 12h2',
  pavillon: 'M5 21V3M5 4h13l-2.5 4L18 12H5M11 6a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2zM9.2 10.3l3.6-.8',
  couronne: 'M3 8l4 4 5-7 5 7 4-4-2 11H5zM5 19h14',
  gouvernail: 'M12 6.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM12 10.4a1.6 1.6 0 1 0 0 3.2a1.6 1.6 0 1 0 0-3.2zM12 2v4.5M12 17.5V22M2 12h4.5M17.5 12H22M4.9 4.9l3.2 3.2M15.9 15.9l3.2 3.2M4.9 19.1l3.2-3.2M15.9 8.1l3.2-3.2',
  grimoire: 'M4 5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2zM4 20a2 2 0 0 0 2 2h13v-4M11.5 7.5a2.5 2.5 0 1 1 0 3.3M10 13.5l3-1.5 3 1.5',
  ancre: 'M12 2.5a2 2 0 1 0 0 4a2 2 0 1 0 0-4zM12 6.5V21M8 10h8M4 13c0 5 4 8 8 8s8-3 8-8M4 13l-1.5 2M4 13l2.2 1M20 13l1.5 2M20 13l-2.2 1',
  cible: 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 1 0 0-17zM12 7.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 1 0 0-9zM12 11a1 1 0 1 0 0 2a1 1 0 1 0 0-2zM15 9l5-5M17 4h3v3',
  tete: 'M5 11a7 7 0 0 1 14 0c0 2.5-1.2 4-2.5 5v3h-9v-3C6.2 15 5 13.5 5 11zM9.3 9.8a1.7 1.7 0 1 0 0 3.4a1.7 1.7 0 1 0 0-3.4zM14.7 9.8a1.7 1.7 0 1 0 0 3.4a1.7 1.7 0 1 0 0-3.4zM12 14l-.8 1.5h1.6zM10 19v-2M14 19v-2',
  coffre: 'M3 10a5 5 0 0 1 5-5h8a5 5 0 0 1 5 5v9H3zM3 11h18M10.5 11v3h3v-3M7 5.5V19M17 5.5V19',
  trophee: 'M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8.5 21h7M9.5 18h5v3',
  cloche: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0M12 3v2',
  bulle: 'M4 5h16v11H10l-4 4v-4H4zM8 9.5h8M8 12.5h5',
  equipage: 'M8 5a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM16 5a3 3 0 1 0 0 6a3 3 0 1 0 0-6zM2.5 20c.5-3.5 2.8-5.5 5.5-5.5s5 2 5.5 5.5M11.5 16.2c1-1.1 2.6-1.7 4.5-1.7 2.7 0 5 2 5.5 5.5',
  cadre: 'M4 4h16v16H4zM7 7h10v10H7zM4 4l3 3M20 4l-3 3M4 20l3-3M20 20l-3-3',
  bouclier: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM12 8v8M8.5 11.5h7',
  stats: 'M4 20h16M6 20V12M10.5 20V7M15 20v-5M19.5 20V4',
  sablier: 'M6 3h12M6 21h12M7 3c0 5 5 6 5 9s-5 4-5 9M17 3c0 5-5 6-5 9s5 4 5 9M9.5 18h5',
  feu: 'M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 0 2 1 3 2 3 0-3-1-5.5.5-8z',
  piece: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 6.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM10.5 9.5v5h3',
};

export type NomIcone = keyof typeof TRACES;

export function Icone({ nom, taille = 22, className = '', style, trait }: { nom: NomIcone | string; taille?: number; className?: string; style?: CSSProperties; trait?: boolean }) {
  // Image peinte quand elle existe (un peu plus grande : l'objet est détouré, sans marge)
  const img = !trait ? IMAGE_ICONE[nom] : undefined;
  if (img) {
    const t = Math.round(taille * 1.3);
    return <img className={`icone icone-img ${className}`} src={img} width={t} height={t} alt="" aria-hidden="true" style={style} draggable={false} decoding="async" />;
  }
  return (
    <svg className={`icone ${className}`} width={taille} height={taille} viewBox="0 0 24 24" aria-hidden="true" style={style}
      fill="none" stroke="url(#degrade-or)" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
      <path d={TRACES[nom] ?? TRACES.ancre} />
    </svg>
  );
}

/** Icône dans un médaillon doré. */
export function Medaillon({ nom, taille = 40, className = '' }: { nom: NomIcone | string; taille?: number; className?: string }) {
  return (
    <span className={`medaillon ${className}`} style={{ width: taille, height: taille }}>
      <Icone nom={nom} taille={Math.round(taille * 0.6)} />
    </span>
  );
}

/** Dégradé or partagé par toutes les icônes (à placer une fois dans la page). */
export function DefsIcones() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        <linearGradient id="degrade-or" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff1c2" /><stop offset=".5" stopColor="#ffd979" /><stop offset="1" stopColor="#c8902e" />
        </linearGradient>
      </defs>
    </svg>
  );
}
