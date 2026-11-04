// Encart « Installer l'appli » : bouton sur Android, instructions sur iPhone, rien si déjà installée.
import { useState } from 'react';
import { useInstallation } from '../lib/installation.ts';

export function InstallerAppli({ compact = false }: { compact?: boolean }) {
  const { etat, installer } = useInstallation();
  const [aide, setAide] = useState(false);
  const [masque, setMasque] = useState(() => { try { return compact && localStorage.getItem('skull-install-masque') === '1'; } catch { return false; } });

  if (etat === 'installee' || etat === 'indisponible' || masque) return null;
  const masquer = () => { try { localStorage.setItem('skull-install-masque', '1'); } catch { /* rien */ } setMasque(true); };

  return (
    <div className="installer-appli">
      <img src="/icones/icone-192.png" alt="" />
      <div className="installer-texte">
        <strong>Installe Skull Arena</strong>
        <small>Une icône sur ton écran d’accueil, le jeu en plein écran.</small>
        {aide && (
          <ol>
            <li>Touche le bouton <strong>Partager</strong> <span aria-hidden="true">⬆️</span> en bas de Safari</li>
            <li>Choisis <strong>« Sur l’écran d’accueil »</strong></li>
            <li>Touche <strong>Ajouter</strong></li>
          </ol>
        )}
      </div>
      <div className="installer-boutons">
        {etat === 'pret'
          ? <button type="button" className="bouton-or petit" onClick={installer}>Installer</button>
          : <button type="button" className="bouton-or petit" onClick={() => setAide((a) => !a)}>{aide ? 'OK' : 'Comment ?'}</button>}
        {compact && <button type="button" className="lien" onClick={masquer}>Plus tard</button>}
      </div>
    </div>
  );
}
