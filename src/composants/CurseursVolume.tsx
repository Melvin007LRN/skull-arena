// Deux curseurs pour régler son ambiance : la musique (harpe et ressac) et les bruitages du jeu.
import { useRef, useState } from 'react';
import { debloquerSon, musique, son, volumes } from '../lib/sons.ts';

export function CurseursVolume({ apercuMusique = false }: { apercuMusique?: boolean }) {
  const [vMusique, setVMusique] = useState(() => Math.round(volumes.lire('musique') * 100));
  const [vEffets, setVEffets] = useState(() => Math.round(volumes.lire('effets') * 100));
  const dernierSon = useRef(0);
  const arretApercu = useRef(0);

  function reglerMusique(v: number) {
    setVMusique(v);
    debloquerSon();
    volumes.regler('musique', v / 100);
    // Hors partie : on fait entendre la musique le temps de régler
    if (apercuMusique && v > 0) {
      musique.demarrer();
      clearTimeout(arretApercu.current);
      arretApercu.current = window.setTimeout(() => musique.arreter(), 5000);
    }
  }
  function reglerEffets(v: number) {
    setVEffets(v);
    debloquerSon();
    volumes.regler('effets', v / 100);
    if (Date.now() - dernierSon.current > 250) { dernierSon.current = Date.now(); son.carte(); }
  }

  return (
    <div className="curseurs-volume">
      <label className="curseur-volume">
        <span className="curseur-libelle"><span aria-hidden="true">{vMusique === 0 ? '🔇' : '🎵'}</span> Musique <small>{vMusique} %</small></span>
        <input type="range" min={0} max={100} step={1} value={vMusique} style={{ ['--p' as string]: `${vMusique}%` }}
          onChange={(e) => reglerMusique(Number(e.target.value))} aria-label="Volume de la musique" />
      </label>
      <label className="curseur-volume">
        <span className="curseur-libelle"><span aria-hidden="true">{vEffets === 0 ? '🔇' : '🔊'}</span> Bruitages <small>{vEffets} %</small></span>
        <input type="range" min={0} max={100} step={1} value={vEffets} style={{ ['--p' as string]: `${vEffets}%` }}
          onChange={(e) => reglerEffets(Number(e.target.value))} aria-label="Volume des bruitages" />
      </label>
    </div>
  );
}
