// Personnalisations : dos de cartes, tapis, effets en partie, titres, bannières, compagnons, thème, phrases et emotes.
// Le prix fait foi côté serveur (table boutique) ; ce fichier décrit l'apparence de chaque article.
import { supabase } from './supabase.ts';
import { niveau, type Profil } from './profil.ts';

export type Categorie = 'dos' | 'tapis' | 'pli' | 'entree' | 'victoire' | 'titre' | 'banniere' | 'compagnon' | 'theme' | 'phrase' | 'emote';
/** Catégories qu'on « équipe » (une à la fois). Les phrases et emotes, elles, s'ajoutent toutes. */
export type CategorieEquipable = Exclude<Categorie, 'phrase' | 'emote'>;
export type Perso = Partial<Record<CategorieEquipable, string>>;
export type ModeEclats = 'gerbe' | 'pluie' | 'tourbillon' | 'explosion';

export interface InfoCategorie { nom: string; icone: string; description: string; onglet: 'table' | 'pirate' | 'chat'; equipable: boolean }
export const CATEGORIES: Record<Categorie, InfoCategorie> = {
  dos: { nom: 'Dos de cartes', icone: '🂠', description: 'Le dos de tes cartes, vu par tous les pirates autour de la table.', onglet: 'table', equipable: true },
  tapis: { nom: 'Tapis de table', icone: '🟫', description: 'Le fond de la table pendant tes parties (toi seul le vois).', onglet: 'table', equipable: true },
  pli: { nom: 'Effets de pli', icone: '✨', description: 'Une animation sur ton avatar quand tu remportes un pli. Vue par tous.', onglet: 'table', equipable: true },
  entree: { nom: 'Entrées', icone: '🚪', description: 'Ton entrée en scène au début de chaque partie. Vue par tous.', onglet: 'table', equipable: true },
  victoire: { nom: 'Célébrations', icone: '🏆', description: 'La pluie qui tombe sur toute la table quand tu gagnes la partie.', onglet: 'table', equipable: true },
  titre: { nom: 'Titres', icone: '📜', description: 'Affiché sous ton pseudo : profil, fiche, salon et podium.', onglet: 'pirate', equipable: true },
  banniere: { nom: 'Bannières', icone: '🏴', description: 'Le fond de ta carte de pirate, sur ton profil et ta fiche.', onglet: 'pirate', equipable: true },
  compagnon: { nom: 'Compagnons', icone: '🦜', description: 'Un petit animal perché sur ton avatar, partout et en partie.', onglet: 'pirate', equipable: true },
  theme: { nom: 'Thème du site', icone: '🎨', description: 'La couleur d’accent de tous les menus du site (toi seul la vois).', onglet: 'pirate', equipable: true },
  phrase: { nom: 'Phrases rapides', icone: '💬', description: 'Des phrases en plus dans le chat de la table. Tous tes packs s’ajoutent.', onglet: 'chat', equipable: false },
  emote: { nom: 'Emotes', icone: '😎', description: 'Des réactions en plus au-dessus de ton avatar. Tous tes packs s’ajoutent.', onglet: 'chat', equipable: false },
};

export interface ArticlePerso {
  id: string;
  categorie: Categorie;
  nom: string;
  /** Prix indicatif (le vrai prix vient de la boutique). Absent pour un article à gagner. */
  prix?: number;
  /** Article à gagner (jamais vendu). */
  gagne?: { condition: string; obtenu: (p: Profil) => boolean };
  /** Emblème (dos), emoji (compagnon), éclats (effets). */
  emojis?: string[];
  mode?: ModeEclats;
  couleur?: string;
  textes?: string[];
  anime?: boolean;
}

const g = (condition: string, obtenu: (p: Profil) => boolean) => ({ condition, obtenu });
const aBadge = (b: string) => (p: Profil) => (p.badges ?? []).includes(b);

export const ARTICLES: ArticlePerso[] = [
  // ---- Dos de cartes ----
  { id: 'dos_bois', categorie: 'dos', nom: 'Bois flotté', prix: 300, emojis: ['⚓'] },
  { id: 'dos_rubis', categorie: 'dos', nom: 'Rubis sanglant', prix: 500, emojis: ['☠'] },
  { id: 'dos_parchemin', categorie: 'dos', nom: 'Carte au trésor', prix: 700, emojis: ['✖'] },
  { id: 'dos_abysses', categorie: 'dos', nom: 'Abysses', prix: 900, emojis: ['🐚'] },
  { id: 'dos_kraken', categorie: 'dos', nom: 'Tentacules', prix: 1500, emojis: ['🐙'] },
  { id: 'dos_or', categorie: 'dos', nom: 'Or massif', prix: 2500, emojis: ['👑'] },
  { id: 'dos_spectral', categorie: 'dos', nom: 'Spectral', prix: 4000, emojis: ['💀'], anime: true },
  { id: 'dos_matelot', categorie: 'dos', nom: 'Dos du Matelot', emojis: ['🪢'], gagne: g('Niveau 10', (p) => niveau(p.xp) >= 10) },
  // ---- Tapis ----
  { id: 'tapis_velours', categorie: 'tapis', nom: 'Velours royal', prix: 400 },
  { id: 'tapis_lagon', categorie: 'tapis', nom: 'Lagon', prix: 400 },
  { id: 'tapis_pont', categorie: 'tapis', nom: 'Pont du navire', prix: 800 },
  { id: 'tapis_carte', categorie: 'tapis', nom: 'Carte au trésor', prix: 900 },
  { id: 'tapis_abysses', categorie: 'tapis', nom: 'Abysses lumineux', prix: 1500, anime: true },
  { id: 'tapis_tresor', categorie: 'tapis', nom: 'Salle du trésor', prix: 2500, anime: true },
  { id: 'tapis_capitaine', categorie: 'tapis', nom: 'Table du Capitaine', gagne: g('Niveau 25', (p) => niveau(p.xp) >= 25) },
  // ---- Effets de pli ----
  { id: 'pli_pieces', categorie: 'pli', nom: 'Pluie de pièces', prix: 300, emojis: ['🪙', '💰', '✨'], mode: 'pluie', couleur: '#ffcc33' },
  { id: 'pli_eclair', categorie: 'pli', nom: 'Éclair', prix: 500, emojis: ['⚡', '✨'], mode: 'explosion', couleur: '#2ee6ff' },
  { id: 'pli_flammes', categorie: 'pli', nom: 'Flammes', prix: 600, emojis: ['🔥', '💥'], mode: 'gerbe', couleur: '#ff7a1a' },
  { id: 'pli_fumee', categorie: 'pli', nom: 'Fumée spectrale', prix: 800, emojis: ['👻', '💨'], mode: 'tourbillon', couleur: '#b866ff' },
  { id: 'pli_cranes', categorie: 'pli', nom: 'Crânes', prix: 1200, emojis: ['💀', '☠️'], mode: 'explosion', couleur: '#ffffff' },
  { id: 'pli_etoiles', categorie: 'pli', nom: 'Pluie d’étoiles', prix: 1500, emojis: ['⭐', '🌟', '✨'], mode: 'pluie', couleur: '#ffcc33' },
  { id: 'pli_kraken', categorie: 'pli', nom: 'Tentacules', prix: 2500, emojis: ['🐙', '🌊', '🫧'], mode: 'tourbillon', couleur: '#b866ff' },
  { id: 'pli_couronne', categorie: 'pli', nom: 'Couronnes', emojis: ['👑', '✨'], mode: 'tourbillon', couleur: '#ffcc33', gagne: g('25 victoires', (p) => p.victoires >= 25) },
  // ---- Entrées ----
  { id: 'entree_canon', categorie: 'entree', nom: 'Coup de canon', prix: 300, emojis: ['💥', '💨', '🔥'], mode: 'explosion', couleur: '#ff7a1a' },
  { id: 'entree_brouillard', categorie: 'entree', nom: 'Brouillard', prix: 500, emojis: ['🌫️', '💨'], mode: 'tourbillon', couleur: '#cfefff' },
  { id: 'entree_orage', categorie: 'entree', nom: 'Orage', prix: 800, emojis: ['⚡', '🌩️'], mode: 'explosion', couleur: '#2ee6ff' },
  { id: 'entree_tresor', categorie: 'entree', nom: 'Coffre au trésor', prix: 1200, emojis: ['💰', '💎', '🪙'], mode: 'gerbe', couleur: '#ffcc33' },
  { id: 'entree_kraken', categorie: 'entree', nom: 'Kraken', prix: 2000, emojis: ['🐙', '🌊'], mode: 'tourbillon', couleur: '#b866ff' },
  { id: 'entree_roi', categorie: 'entree', nom: 'Entrée royale', emojis: ['👑', '✨', '🎺'], mode: 'gerbe', couleur: '#ffcc33', gagne: g('50 victoires', (p) => p.victoires >= 50) },
  // ---- Célébrations de victoire ----
  { id: 'victoire_roses', categorie: 'victoire', nom: 'Pluie de roses', prix: 600, emojis: ['🌹', '🌸'] },
  { id: 'victoire_artifice', categorie: 'victoire', nom: 'Feu d’artifice', prix: 800, emojis: ['🎆', '🎇', '✨'] },
  { id: 'victoire_couronnes', categorie: 'victoire', nom: 'Pluie de couronnes', prix: 1200, emojis: ['👑', '💎'] },
  { id: 'victoire_fantome', categorie: 'victoire', nom: 'Armée fantôme', prix: 1500, emojis: ['👻', '💀'] },
  { id: 'victoire_kraken', categorie: 'victoire', nom: 'Kraken triomphant', prix: 2000, emojis: ['🐙', '🌊', '🦑'] },
  // ---- Titres ----
  { id: 'titre_loup', categorie: 'titre', nom: 'Loup de mer', prix: 200 },
  { id: 'titre_flibustier', categorie: 'titre', nom: 'Flibustier', prix: 300 },
  { id: 'titre_corsaire', categorie: 'titre', nom: 'Corsaire du roi', prix: 500 },
  { id: 'titre_canonnier', categorie: 'titre', nom: 'Canonnier fou', prix: 500 },
  { id: 'titre_chasseur', categorie: 'titre', nom: 'Chasseur de primes', prix: 800 },
  { id: 'titre_sirene', categorie: 'titre', nom: 'Charmeur de sirènes', prix: 1000 },
  { id: 'titre_terreur', categorie: 'titre', nom: 'Terreur des Sept Mers', prix: 1500 },
  { id: 'titre_roi', categorie: 'titre', nom: 'Roi des pirates', prix: 5000 },
  { id: 'titre_premier_sang', categorie: 'titre', nom: 'Premier sang', gagne: g('Gagner une partie', (p) => p.victoires >= 1) },
  { id: 'titre_briscard', categorie: 'titre', nom: 'Vieux briscard', gagne: g('Niveau 15', (p) => niveau(p.xp) >= 15) },
  { id: 'titre_veteran', categorie: 'titre', nom: 'Vétéran', gagne: g('50 parties jouées', (p) => p.parties_jouees >= 50) },
  { id: 'titre_devin', categorie: 'titre', nom: 'Le Devin', gagne: g('Badge Devin', aBadge('devin')) },
  { id: 'titre_tueur_rois', categorie: 'titre', nom: 'Tueur de rois', gagne: g('Badge Régicide', (p) => (p.regicides ?? 0) >= 25) },
  { id: 'titre_fantome', categorie: 'titre', nom: 'Le Fantôme', gagne: g('Badge Fantôme', (p) => (p.fantomes ?? 0) >= 10) },
  { id: 'titre_centurion', categorie: 'titre', nom: 'Centurion', gagne: g('100 victoires', (p) => p.victoires >= 100) },
  { id: 'titre_legende', categorie: 'titre', nom: 'Légende des mers', gagne: g('Badge Légende des mers', aBadge('legende')) },
  // ---- Bannières ----
  { id: 'banniere_coucher', categorie: 'banniere', nom: 'Coucher de soleil', prix: 300 },
  { id: 'banniere_tempete', categorie: 'banniere', nom: 'Tempête', prix: 600 },
  { id: 'banniere_abysses', categorie: 'banniere', nom: 'Abysses', prix: 800 },
  { id: 'banniere_aurore', categorie: 'banniere', nom: 'Aurore boréale', prix: 1500, anime: true },
  { id: 'banniere_tresor', categorie: 'banniere', nom: 'Trésor maudit', prix: 2500, anime: true },
  { id: 'banniere_legende', categorie: 'banniere', nom: 'Bannière légendaire', anime: true, gagne: g('Badge Légende des mers', aBadge('legende')) },
  // ---- Compagnons ----
  { id: 'compagnon_crabe', categorie: 'compagnon', nom: 'Crabe', prix: 300, emojis: ['🦀'] },
  { id: 'compagnon_rat', categorie: 'compagnon', nom: 'Rat de cale', prix: 300, emojis: ['🐀'] },
  { id: 'compagnon_perroquet', categorie: 'compagnon', nom: 'Perroquet', prix: 500, emojis: ['🦜'] },
  { id: 'compagnon_singe', categorie: 'compagnon', nom: 'Singe', prix: 500, emojis: ['🐒'] },
  { id: 'compagnon_chat', categorie: 'compagnon', nom: 'Chat noir', prix: 700, emojis: ['🐈‍⬛'] },
  { id: 'compagnon_pieuvre', categorie: 'compagnon', nom: 'Pieuvre', prix: 1200, emojis: ['🐙'] },
  { id: 'compagnon_requin', categorie: 'compagnon', nom: 'Requin', prix: 1800, emojis: ['🦈'] },
  { id: 'compagnon_dragon', categorie: 'compagnon', nom: 'Dragon des mers', prix: 3500, emojis: ['🐉'] },
  { id: 'compagnon_corbeau', categorie: 'compagnon', nom: 'Corbeau', emojis: ['🐦‍⬛'], gagne: g('100 parties jouées', (p) => p.parties_jouees >= 100) },
  // ---- Thèmes du site ----
  { id: 'theme_rubis', categorie: 'theme', nom: 'Rubis', prix: 400, couleur: '#ff2a4a' },
  { id: 'theme_lagon', categorie: 'theme', nom: 'Lagon', prix: 400, couleur: '#2ee6ff' },
  { id: 'theme_emeraude', categorie: 'theme', nom: 'Émeraude', prix: 400, couleur: '#2dff7a' },
  { id: 'theme_amethyste', categorie: 'theme', nom: 'Améthyste', prix: 400, couleur: '#b866ff' },
  { id: 'theme_or', categorie: 'theme', nom: 'Doublon', prix: 400, couleur: '#ffcc33' },
  { id: 'theme_braise', categorie: 'theme', nom: 'Braise', prix: 400, couleur: '#ff7a1a' },
  { id: 'theme_corail', categorie: 'theme', nom: 'Corail', prix: 400, couleur: '#ff4fd8' },
  // ---- Packs de phrases ----
  { id: 'phrase_fairplay', categorie: 'phrase', nom: 'Pack Fair-play', prix: 200, textes: ['Bien joué', 'Belle mise', 'Respect', 'Bonne partie à tous'] },
  { id: 'phrase_pirate', categorie: 'phrase', nom: 'Pack Pirate', prix: 300, textes: ['À l’abordage !', 'Mille sabords !', 'Par la barbe de Neptune', 'Yo-ho-ho !'] },
  { id: 'phrase_moqueur', categorie: 'phrase', nom: 'Pack Moqueur', prix: 300, textes: ['Trop facile', 'Même pas mal', 'Retourne à la plage', 'Joli plouf'] },
  { id: 'phrase_drame', categorie: 'phrase', nom: 'Pack Dramatique', prix: 400, textes: ['Trahison !', 'Je suis maudit', 'Pourquoi moi…', 'C’était écrit'] },
  // ---- Packs d'emotes ----
  { id: 'emote_pirate', categorie: 'emote', nom: 'Pack Pirate', prix: 300, emojis: ['🏴‍☠️', '⚓', '🦜', '💀'] },
  { id: 'emote_fete', categorie: 'emote', nom: 'Pack Fête', prix: 300, emojis: ['🎉', '🍾', '🥳', '💃'] },
  { id: 'emote_mer', categorie: 'emote', nom: 'Pack Océan', prix: 300, emojis: ['🐙', '🦈', '🌊', '🐋'] },
  { id: 'emote_troll', categorie: 'emote', nom: 'Pack Troll', prix: 400, emojis: ['🤡', '🐔', '💩', '🥱'] },
];

export const ARTICLE: Record<string, ArticlePerso> = Object.fromEntries(ARTICLES.map((a) => [a.id, a]));
export const article = (id: string | null | undefined): ArticlePerso | undefined => (id ? ARTICLE[id] : undefined);

/** Toutes les phrases des packs (pour accepter celles des autres joueurs). */
export const TOUTES_PHRASES_PREMIUM = ARTICLES.filter((a) => a.categorie === 'phrase').flatMap((a) => a.textes ?? []);

/** Articles débloqués sans achat (conditions remplies). */
export const gagnes = (p: Profil) => ARTICLES.filter((a) => a.gagne && (p.est_admin || a.gagne.obtenu(p))).map((a) => a.id);

/** Phrases et emotes en plus que je possède. */
export function extrasChat(possedes: string[], admin = false) {
  const a = ARTICLES.filter((x) => admin || possedes.includes(x.id));
  return {
    phrases: a.filter((x) => x.categorie === 'phrase').flatMap((x) => x.textes ?? []),
    emotes: a.filter((x) => x.categorie === 'emote').flatMap((x) => x.emojis ?? []),
  };
}

// ---------- Serveur ----------
async function rpc<T = unknown>(nom: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nom, params);
  if (error) throw error;
  return data as T;
}
export const equiperPerso = (categorie: CategorieEquipable, choix: string | null) => rpc('equiper_perso', { categorie, choix });
export const offrir = (article: string, ami: string) => rpc<number>('offrir', { article, ami });
export const reclamerPalier = (palier: number) => rpc<number>('reclamer_palier', { palier });
export async function chargerPaliers(): Promise<number[]> {
  const { data } = await supabase.from('paliers_reclames').select('palier');
  return ((data ?? []) as Array<{ palier: number }>).map((l) => l.palier);
}
/** Coffre de niveau : tous les 5 niveaux. */
export const PALIER = 5;
export const gainPalier = (palier: number) => 100 + palier * 10;

// ---------- Thème du site ----------
export function appliquerTheme(id: string | null | undefined) {
  const c = article(id)?.couleur;
  if (c) { document.body.dataset.theme = id!; document.body.style.setProperty('--theme', c); }
  else { delete document.body.dataset.theme; document.body.style.removeProperty('--theme'); }
}
