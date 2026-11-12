// Fenêtre à l'ouverture de l'appli : tant que les notifications ne sont pas activées, on explique pas à pas comment faire.
// « Plus tard » la cache jusqu'à la prochaine ouverture de l'appli.
import { useEffect, useState } from 'react';
import { useNotifications } from '../lib/notifications.ts';
import { estIPhone, useInstallation } from '../lib/installation.ts';

const CLE = 'skull-notif-fenetre-vue';

export function FenetreNotifications() {
  const { etat, activer } = useNotifications();
  const installation = useInstallation();
  const [ouverte, setOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [reussi, setReussi] = useState(false);

  useEffect(() => {
    if (!['inactives', 'iphone-installer', 'refusees'].includes(etat)) return;
    let dejaVue = false;
    try { dejaVue = sessionStorage.getItem(CLE) === '1'; } catch { /* rien */ }
    if (dejaVue) return;
    const t = setTimeout(() => setOuverte(true), 1200); // on laisse l'accueil s'afficher d'abord
    return () => clearTimeout(t);
  }, [etat]);

  const fermer = () => {
    try { sessionStorage.setItem(CLE, '1'); } catch { /* rien */ }
    setOuverte(false);
  };

  if (!ouverte) return null;
  const iphone = estIPhone();

  return (
    <div className="voile fenetre-notif-voile" onClick={fermer}>
      <section className="parchemin fenetre fenetre-notif neon" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="titre-notif">
        <span className="notif-grosse-cloche" aria-hidden="true"><img src="/img/etat_alerte.webp" alt="" /></span>
        <h2 id="titre-notif" className="titre-pirate">Ne rate plus rien !</h2>
        <p className="notif-intro">Active les notifications pour être prévenu sur ton téléphone, <strong>même appli fermée</strong>, quand un ami :</p>
        <ul className="notif-raisons">
          <li><span><img className="ico-texte" src="/img/jeu_chat.webp" alt="" /></span>t’envoie un message</li>
          <li><span>🏴‍☠️</span>t’invite à sa table</li>
          <li><span><img className="ico-texte" src="/img/nav_amis.webp" alt="" /></span>te demande en ami</li>
        </ul>

        {reussi ? (
          <p className="message info">C’est activé ! Tu seras prévenu à chaque message 🎉</p>
        ) : etat === 'iphone-installer' ? (
          <>
            <p className="notif-sous-titre">Sur iPhone, 4 petites étapes :</p>
            <ol className="notif-etapes">
              <li><b>1</b><span>Touche <strong>Partager</strong> <em className="icone-partager" aria-hidden="true">⬆️</em> en bas de Safari</span></li>
              <li><b>2</b><span>Choisis <strong>« Sur l’écran d’accueil »</strong> <em aria-hidden="true">➕</em></span></li>
              <li><b>3</b><span>Touche <strong>Ajouter</strong>, en haut à droite</span></li>
              <li><b>4</b><span>Ouvre <strong>SKULL ARENA</strong> depuis la nouvelle icône, puis touche <strong>Activer</strong> dans cette fenêtre</span></li>
            </ol>
            <p className="petit-texte">Si tu as ouvert le lien depuis Instagram, Snapchat ou WhatsApp, ouvre-le d’abord dans Safari.</p>
          </>
        ) : etat === 'refusees' ? (
          <>
            <p className="notif-sous-titre">Les notifications sont bloquées. Pour les autoriser :</p>
            <ol className="notif-etapes">
              {iphone ? (
                <>
                  <li><b>1</b><span>Ouvre les <strong>Réglages</strong> de l’iPhone</span></li>
                  <li><b>2</b><span>Touche <strong>Notifications</strong>, puis <strong>SKULL ARENA</strong></span></li>
                  <li><b>3</b><span>Active <strong>Autoriser les notifications</strong></span></li>
                </>
              ) : (
                <>
                  <li><b>1</b><span>Touche le <strong>cadenas</strong> 🔒 à gauche de l’adresse (ou les ⋮ puis <strong>Paramètres du site</strong>)</span></li>
                  <li><b>2</b><span>Choisis <strong>Notifications</strong> → <strong>Autoriser</strong></span></li>
                  <li><b>3</b><span>Reviens ici et recharge la page</span></li>
                </>
              )}
            </ol>
          </>
        ) : (
          <>
            {installation.etat === 'pret' && (
              <button type="button" className="bouton-sombre" onClick={() => installation.installer()}>📲 Installer l’appli sur mon écran d’accueil</button>
            )}
            <button type="button" className="bouton-or bouton-jouer" onClick={async () => {
              setErreur(null);
              try {
                const ok = await activer();
                if (ok) { setReussi(true); setTimeout(fermer, 1800); }
                else setErreur('Tu as refusé : tu pourras les activer plus tard dans les Réglages du navire.');
              } catch (e) { setErreur((e as Error).message || 'Activation impossible, réessaie.'); }
            }}><img className="ico-texte" src="/img/etat_alerte.webp" alt="" /> Activer les notifications</button>
            <p className="petit-texte centre">Ton téléphone va te demander l’autorisation : touche <strong>Autoriser</strong>.</p>
          </>
        )}
        {erreur && <p className="message erreur">{erreur}</p>}
        <button type="button" className="lien" onClick={fermer}>{reussi ? 'Fermer' : 'Plus tard'}</button>
      </section>
    </div>
  );
}
