// Écrans d'attente et de transition : décor, logo, Louidor qui tourne. Même allure partout.
import { DECOR } from '../lib/images.ts';

type Decor = keyof typeof DECOR;

/** Plein écran : chargement de l'appli, montée à bord, distribution… */
export function EcranAttente({ texte = 'Chargement', decor = 'pont', sous }: { texte?: string; decor?: Decor; sous?: string }) {
  return (
    <main className="attente-plein" style={{ ['--decor' as string]: `url('${DECOR[decor]}')` }} role="status" aria-live="polite">
      <img className="attente-logo" src="/decor/logo.webp" alt="Skull Arena" />
      <span className="attente-piece" aria-hidden="true"><img src="/img/louidor.webp" alt="" /></span>
      <p className="attente-texte">{texte}<span className="attente-points" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span></p>
      {sous && <p className="attente-sous">{sous}</p>}
    </main>
  );
}

/** Petite attente dans une page (liste qui se charge). */
export function Patience({ texte = 'Chargement' }: { texte?: string }) {
  return (
    <p className="patience" role="status">
      <span className="attente-piece petite" aria-hidden="true"><img src="/img/louidor.webp" alt="" /></span>
      {texte}<span className="attente-points" aria-hidden="true"><i>.</i><i>.</i><i>.</i></span>
    </p>
  );
}
