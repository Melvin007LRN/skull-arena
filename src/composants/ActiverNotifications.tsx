// Encart « Activer les notifications » : invitations, messages et demandes d'ami, même appli fermée.
import { useState } from 'react';
import { useNotifications } from '../lib/notifications.ts';

export function ActiverNotifications({ compact = false }: { compact?: boolean }) {
  const { etat, activer } = useNotifications();
  const [erreur, setErreur] = useState<string | null>(null);
  const [masque, setMasque] = useState(() => { try { return compact && localStorage.getItem('skull-notif-masque') === '1'; } catch { return false; } });
  if (masque || etat === 'chargement' || etat === 'actives' || etat === 'non-supportees') return null;
  if (compact && etat === 'refusees') return null;
  const masquer = () => { try { localStorage.setItem('skull-notif-masque', '1'); } catch { /* rien */ } setMasque(true); };

  return (
    <div className="installer-appli neon">
      <span className="notif-cloche" aria-hidden="true">🔔</span>
      <div className="installer-texte">
        <strong>Active les notifications</strong>
        <small>
          {etat === 'iphone-installer'
            ? 'Sur iPhone, installe d’abord l’appli sur ton écran d’accueil (Partager ⬆️ puis « Sur l’écran d’accueil »), puis ouvre-la depuis son icône.'
            : etat === 'refusees'
              ? 'Les notifications sont bloquées : autorise-les pour SKULL ARENA dans les réglages de ton téléphone.'
              : 'Sois prévenu quand un ami t’invite à sa table, t’écrit ou te demande en ami, même appli fermée.'}
        </small>
        {erreur && <small className="erreur-notif">{erreur}</small>}
      </div>
      <div className="installer-boutons">
        {etat === 'inactives' && (
          <button type="button" className="bouton-or petit" onClick={() => activer().catch((e) => setErreur((e as Error).message || 'Activation impossible.'))}>Activer</button>
        )}
        {compact && <button type="button" className="lien" onClick={masquer}>Plus tard</button>}
      </div>
    </div>
  );
}
