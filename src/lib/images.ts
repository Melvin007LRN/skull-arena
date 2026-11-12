// Toutes les images peintes de l'appli (dossier public/img), rangées par nom.
// Une image absente garde l'emoji ou l'icône dessinée en attendant.
const I = (nom: string) => `/img/${nom}.webp`;

/** Icônes dessinées (composant Icone) remplacées par une image peinte. */
export const IMAGE_ICONE: Record<string, string> = {
  epees: I('nav_jouer'), jouer: I('nav_jouer'),
  coffre: I('louidor_coffre'), boutique: I('nav_boutique'), 'mon-coffre': I('nav_coffre'),
  trophee: I('nav_classement'),
  grimoire: I('nav_regles'), regles: I('nav_regles'),
  parchemin: I('nav_actualites'),
  cloche: I('etat_alerte'),
  cible: I('nav_defis'),
  'longue-vue': I('nav_rejoindre'),
  gouvernail: I('nav_reglages'),
  ancre: I('nav_salon'),
  equipage: I('nav_amis'),
  piece: I('louidor'),
  couronne: I('pli_couronne'),
  feu: I('pli_flammes'),
  bulle: I('jeu_chat'),
  stats: I('jeu_scores'),
  mannequin: I('nav_entrainement'),
  cartes: I('nav_blackjack'),
  cadeau: I('jeu_cadeau'),
  cadenas: I('etat_verrou'),
  ok: I('etat_ok'),
  non: I('etat_non'),
  chapeau: I('nav_profil'),
  boulet: I('nav_partie_rapide'),
  xp: I('xp'),
  sac: I('louidor_sac'),
  tas: I('louidor_tas'),
  defi: I('defi_jour'),
  'son-on': I('jeu_son_on'), 'son-off': I('jeu_son_off'),
  avis: I('nav_avis'), tete: I('nav_profil'), cadre: I('cadre_gouvernail'), bouclier: I('rang_capitaine'), sablier: I('defi_jour'),
  record: I('stat_record'), regicide: I('stat_regicide'), podium: I('podium_or'), fantome: I('badge_fantome'), points: I('louidor_tas'),
};

/** Objets lançables en partie. */
export const IMAGE_OBJET: Record<string, string> = Object.fromEntries(
  ['mouchoirs', 'drapeau_blanc', 'tomate', 'poisson', 'rhum', 'rose', 'perroquet', 'doigt', 'boulet', 'couronne',
    'feu_artifice', 'bordee', 'pluie_tresor', 'navire_fantome', 'kraken_poche'].map((o) => [o, I(`objet_${o}`)]),
);
IMAGE_OBJET.tempete_insultes = I('objet_tempete');

/** Particules des animations. */
export const FX = {
  piece: I('fx_piece'), gemme: I('fx_gemme'), fumee: I('fx_fumee'), eclaboussure: I('fx_eclaboussure'),
  rose: I('objet_rose'), eclair: I('pli_eclair'), flamme: I('pli_flammes'), crane: I('pli_cranes'), etoiles: I('pli_etoiles'),
  tentacule: I('pli_kraken'), couronne: I('pli_couronne'), fantome: I('badge_fantome'), fusee: I('objet_feu_artifice'),
  louidor: I('louidor'), tas: I('louidor_tas'), coffre: I('louidor_coffre'), canon: I('entree_canon'), orage: I('objet_tempete'),
};

/** Articles de personnalisation qui ont leur image (icône de boutique ou image pleine). */
export const IMAGE_ARTICLE: Record<string, string> = {
  dos_parchemin: I('dos_parchemin'), dos_matelot: I('dos_matelot'), dos_kraken: I('dos_kraken'), dos_abysses: I('dos_abysses'),
  dos_bois: I('dos_bois'), dos_rubis: I('dos_rubis'), dos_or: I('dos_or'), dos_spectral: I('dos_spectral'),
  ...Object.fromEntries(['velours', 'lagon', 'pont', 'carte', 'abysses', 'tresor', 'capitaine'].map((t) => [`tapis_${t}`, I(`tapis_${t}`)])),
  ...Object.fromEntries(['coucher', 'tempete', 'abysses', 'aurore', 'tresor', 'legende'].map((t) => [`banniere_${t}`, I(`banniere_${t}`)])),
  ...Object.fromEntries(['crabe', 'rat', 'perroquet', 'singe', 'chat', 'pieuvre', 'requin', 'dragon', 'corbeau'].map((t) => [`compagnon_${t}`, I(`compagnon_${t}`)])),
  ...Object.fromEntries(['pieces', 'eclair', 'flammes', 'fumee', 'cranes', 'etoiles', 'kraken', 'couronne'].map((t) => [`pli_${t}`, I(`pli_${t}`)])),
  entree_canon: I('entree_canon'),
  // En attendant leurs propres images : on reprend les plus proches
  entree_brouillard: I('fx_fumee'), entree_orage: I('pli_eclair'), entree_tresor: I('objet_pluie_tresor'), entree_kraken: I('pli_kraken'), entree_roi: I('stat_regicide'),
  victoire_roses: I('objet_rose'), victoire_artifice: I('victoire_artifice'), victoire_couronnes: I('victoire_couronnes'), victoire_fantome: I('badge_fantome'), victoire_kraken: I('objet_kraken_poche'),
};

/** Badges. */
export const IMAGE_BADGE: Record<string, string> = {
  centurion: I('badge_centurion'), devin: I('badge_devin'), regicide: I('badge_regicide'), fantome: I('badge_fantome'), legende: I('badge_legende'),
};

/** Décors des écrans. */
export const DECOR = {
  accueil: I('decor_accueil'), pont: I('decor_pont'), port: I('decor_port'), taverne: I('decor_taverne'), carte: I('decor_carte'),
  cabine: I('decor_cabine'), bibliotheque: I('decor_bibliotheque'), ile: I('decor_ile'),
};

export const IMG = {
  louidor: I('louidor'), coffreNiveau: I('coffre_niveau'), coffreNiveauOuvert: I('coffre_niveau_ouvert'),
  podiumOr: I('podium_or'), podiumArgent: I('podium_argent'), tableBlackjack: I('table_blackjack'), tableSkull: I('table_skull'),
};

/** Une valeur « visuelle » est soit un emoji, soit le chemin d'une image. */
export const estImage = (v: string | undefined | null): v is string => !!v && v.startsWith('/');

/** Écusson de chaque grade. */
export const IMAGE_GRADE: Record<string, string> = {
  Mousse: I('rang_mousse'), Matelot: I('rang_matelot'), 'Quartier-maître': I('rang_quartier_maitre'), Second: I('rang_second'),
  Capitaine: I('rang_capitaine'), Amiral: I('rang_amiral'), Légende: I('rang_legende'),
};

/** Blackjack. */
export const BJ = {
  jeton: I('bj_jeton'), sabot: I('bj_sabot'), siegeVide: I('bj_siege_vide'), blackjack: I('bj_blackjack'), saute: I('bj_bust'), vip: I('bj_vip'),
  banniere: I('banniere_mode_bj'), roue: I('cadre_gouvernail'),
};

/** Cadres d'avatar peints (achetés ou gagnés). */
export const CADRE_PEINT: Record<string, string> = Object.fromEntries(
  ['c_chope', 'c_canard', 'c_dauphin', 'c_cocotier', 'c_pavillon', 'c_tonneau', 'c_goeland', 'c_singe', 'c_requin', 'c_tentacules', 'c_gouvernail', 'c_brasier',
    'g_crane', 'g_canons', 'g_tresor', 'g_fantome', 'g_vaudou', 'g_tempete', 'g_kraken', 'g_vaisseau', 'g_lauriers', 'g_poseidon', 'g_ombres', 'g_ailes'].map((id) => [id, I(`cadre_${id}`)]),
);
