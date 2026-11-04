// Pages légales : mentions légales, confidentialité (RGPD) et conditions d'utilisation.
export type PageLegale = 'mentions' | 'confidentialite' | 'cgu';

const CONTACT = '123melvin007@gmail.com';
const MISE_A_JOUR = '4 novembre 2026';

export function EcranLegal({ page, retour, changer }: { page: PageLegale; retour: () => void; changer: (p: PageLegale) => void }) {
  return (
    <main className="ecran ecran-legal">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <div className="onglets">
        <button type="button" className={page === 'mentions' ? 'actif' : ''} onClick={() => changer('mentions')}>Mentions</button>
        <button type="button" className={page === 'confidentialite' ? 'actif' : ''} onClick={() => changer('confidentialite')}>Confidentialité</button>
        <button type="button" className={page === 'cgu' ? 'actif' : ''} onClick={() => changer('cgu')}>Conditions</button>
      </div>
      <section className="parchemin texte-legal">
        {page === 'mentions' && <Mentions />}
        {page === 'confidentialite' && <Confidentialite />}
        {page === 'cgu' && <Conditions />}
        <p className="petit-texte">Dernière mise à jour : {MISE_A_JOUR}</p>
      </section>
    </main>
  );
}

function Mentions() {
  return (
    <>
      <h1 className="titre-pirate">Mentions légales</h1>
      <h2>Éditeur</h2>
      <p>Skull Arena est un jeu gratuit édité à titre personnel et non commercial par <strong>Lorion Melvin</strong>.<br />Contact : <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
      <p>Directeur de la publication : Lorion Melvin.</p>
      <h2>Hébergement</h2>
      <p>Site : <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com</p>
      <p>Comptes et données de jeu : <strong>Supabase Pte. Ltd.</strong> (Singapour) — supabase.com</p>
      <h2>Propriété intellectuelle</h2>
      <p>Skull Arena est un projet de fans, non officiel. Il s’inspire du jeu de cartes Skull King ; ce nom et les règles d’origine appartiennent à leurs ayants droit. Skull Arena n’est ni affilié à eux, ni approuvé par eux.</p>
    </>
  );
}

function Confidentialite() {
  return (
    <>
      <h1 className="titre-pirate">Confidentialité</h1>
      <p>Tes données servent uniquement à faire fonctionner le jeu. Elles ne sont ni vendues, ni utilisées pour de la publicité.</p>
      <h2>Responsable du traitement</h2>
      <p>Lorion Melvin — <a href={`mailto:${CONTACT}`}>{CONTACT}</a></p>
      <h2>Données collectées</h2>
      <ul>
        <li><strong>Compte</strong> : adresse email, mot de passe (stocké chiffré, jamais lisible), confirmation d’avoir 15 ans ou plus.</li>
        <li><strong>Profil public</strong> : pseudo, photo (si tu en ajoutes une), niveau, statistiques, badges et historique des parties. Ils sont visibles par les autres joueurs connectés.</li>
        <li><strong>Parties</strong> : cartes jouées, mises et scores, pour arbitrer les parties et calculer les classements.</li>
        <li><strong>Phrases rapides</strong> : elles sont diffusées en direct aux joueurs de la table et ne sont pas conservées.</li>
      </ul>
      <h2>Pourquoi ?</h2>
      <p>Pour te permettre de jouer en ligne, de garder ta progression et d’assurer un jeu équitable (base légale : l’exécution du service que tu demandes en créant un compte).</p>
      <h2>Combien de temps ?</h2>
      <p>Tant que ton compte existe. Quand tu le supprimes, ton compte, ta photo, tes statistiques et ton historique sont effacés définitivement.</p>
      <h2>Sur ton appareil</h2>
      <p>Le jeu garde ta session de connexion et tes réglages (musique, vibrations) dans le stockage de ton navigateur. Aucun cookie publicitaire ni outil de suivi n’est utilisé.</p>
      <h2>Tes droits</h2>
      <p>Tu peux consulter et corriger ton profil à tout moment, et supprimer ton compte depuis « Mon pirate ». Pour toute autre demande (accès, rectification, effacement, opposition), écris à <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. Tu peux aussi saisir la CNIL (cnil.fr).</p>
      <h2>Âge minimum</h2>
      <p>Il faut avoir 15 ans ou plus pour créer un compte.</p>
    </>
  );
}

function Conditions() {
  return (
    <>
      <h1 className="titre-pirate">Conditions d’utilisation</h1>
      <ul>
        <li>Skull Arena est gratuit. Il n’y a aucun achat, aucune mise d’argent réel et aucun gain réel.</li>
        <li>Choisis un pseudo et une photo corrects : rien d’insultant, de choquant ou qui imite quelqu’un d’autre.</li>
        <li>Joue fair-play : pas de triche, pas de comptes multiples pour truquer le classement.</li>
        <li>Le capitaine du navire (l’administrateur) peut modifier un pseudo ou une photo, ou bannir un compte qui ne respecte pas ces règles.</li>
        <li>Le jeu est fourni tel quel : il peut évoluer, être interrompu ou remis à zéro, notamment pendant sa phase de test.</li>
      </ul>
    </>
  );
}
