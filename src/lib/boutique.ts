// Louidors, boutique, inventaire et cadres d'avatar.
import { supabase } from './supabase.ts';
import { niveau, type Profil } from './profil.ts';
import { IMAGE_OBJET } from './images.ts';

export interface Article { id: string; type: 'objet' | 'cadre' | 'couleur' | 'perso'; nom: string; icone: string; prix: number; ordre: number }

/** Objets lançables en partie (icône affichée pendant le vol). */
export const OBJETS: Record<string, { icone: string; nom: string; phrase: string; grand?: boolean }> = {
  mouchoirs: { icone: IMAGE_OBJET.mouchoirs, nom: 'Boîte de mouchoirs', phrase: 'tend des mouchoirs à' },
  drapeau_blanc: { icone: IMAGE_OBJET.drapeau_blanc, nom: 'Drapeau blanc', phrase: 'agite le drapeau blanc devant' },
  tomate: { icone: IMAGE_OBJET.tomate, nom: 'Tomate pourrie', phrase: 'lance une tomate sur' },
  poisson: { icone: IMAGE_OBJET.poisson, nom: 'Poisson pourri', phrase: 'gifle avec un poisson' },
  rhum: { icone: IMAGE_OBJET.rhum, nom: 'Chope de rhum', phrase: 'offre une chope à' },
  rose: { icone: IMAGE_OBJET.rose, nom: 'Rose', phrase: 'offre une rose à' },
  perroquet: { icone: IMAGE_OBJET.perroquet, nom: 'Perroquet moqueur', phrase: 'envoie son perroquet narguer' },
  doigt: { icone: IMAGE_OBJET.doigt, nom: 'Doigt d’honneur', phrase: 'fait un doigt d’honneur à' },
  boulet: { icone: IMAGE_OBJET.boulet, nom: 'Boulet de canon', phrase: 'tire un boulet sur' },
  couronne: { icone: IMAGE_OBJET.couronne, nom: 'Couronne en carton', phrase: 'couronne' },
  // Cadeaux spectaculaires : animation sur tout l'écran de la table
  feu_artifice: { icone: IMAGE_OBJET.feu_artifice, nom: 'Feu d’artifice', phrase: 'tire un feu d’artifice pour', grand: true },
  bordee: { icone: IMAGE_OBJET.bordee, nom: 'Bordée de canons', phrase: 'ouvre le feu sur', grand: true },
  pluie_tresor: { icone: IMAGE_OBJET.pluie_tresor, nom: 'Pluie de trésor', phrase: 'fait pleuvoir l’or sur', grand: true },
  navire_fantome: { icone: IMAGE_OBJET.navire_fantome, nom: 'Navire fantôme', phrase: 'envoie le navire fantôme hanter', grand: true },
  kraken_poche: { icone: IMAGE_OBJET.kraken_poche, nom: 'Kraken de poche', phrase: 'lâche le Kraken sur', grand: true },
  // L'ultime : 8 secondes de tempête et une pluie d'insultes
  tempete_insultes: { icone: IMAGE_OBJET.tempete_insultes, nom: 'Tempête d’insultes', phrase: 'déchaîne la Tempête d’insultes sur', grand: true },
};

/** Cadres gagnés (jamais vendus) avec leur condition. */
export const CADRES_GAGNES: Array<{ id: string; nom: string; condition: string; obtenu: (p: Profil) => boolean }> = [
  { id: 'or', nom: 'Cadre d’Or', condition: 'Offert à tous les pirates', obtenu: () => true },
  { id: 'bronze', nom: 'Cadre de Bronze', condition: 'Grade Matelot (niveau 10)', obtenu: (p) => niveau(p.xp) >= 10 },
  { id: 'argent', nom: 'Cadre d’Argent', condition: 'Grade Quartier-maître (niveau 25)', obtenu: (p) => niveau(p.xp) >= 25 },
  { id: 'capitaine', nom: 'Cadre du Capitaine', condition: 'Grade Capitaine (niveau 50)', obtenu: (p) => niveau(p.xp) >= 50 },
  { id: 'amiral', nom: 'Cadre de l’Amiral', condition: 'Grade Amiral (niveau 100)', obtenu: (p) => niveau(p.xp) >= 100 },
  { id: 'legende', nom: 'Cadre Légendaire', condition: 'Grade Légende (niveau 200)', obtenu: (p) => niveau(p.xp) >= 200 },
  { id: 'centurion', nom: 'Cadre du Centurion', condition: 'Badge Centurion (100 victoires)', obtenu: (p) => p.victoires >= 100 },
  { id: 'devin', nom: 'Cadre du Devin', condition: 'Badge Devin', obtenu: (p) => (p.badges ?? []).includes('devin') },
  { id: 'regicide', nom: 'Cadre du Régicide', condition: 'Badge Régicide', obtenu: (p) => (p.regicides ?? 0) >= 25 },
  { id: 'fantome', nom: 'Cadre du Fantôme', condition: 'Badge Fantôme', obtenu: (p) => (p.fantomes ?? 0) >= 10 },
  { id: 'legende_mers', nom: 'Cadre Légende des mers', condition: 'Badge Légende des mers', obtenu: (p) => (p.badges ?? []).includes('legende') },
];

/** Gains de Louidors par place (la moitié de l'XP). */
export const GAINS_LOUIDORS = '1er : 50 · 2e : 35 · 3e : 25 · 4e : 15 · autres : 10 · + 15 par défi du jour';

async function rpc<T = unknown>(nom: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nom, params);
  if (error) throw error;
  return data as T;
}

export async function chargerBoutique(): Promise<Article[]> {
  const { data, error } = await supabase.from('boutique').select('id, type, nom, icone, prix, ordre').eq('actif', true).order('ordre');
  if (error) throw error;
  return (data ?? []) as Article[];
}

export async function chargerInventaire(): Promise<Record<string, number>> {
  const { data } = await supabase.from('inventaire').select('objet, quantite');
  return Object.fromEntries(((data ?? []) as Array<{ objet: string; quantite: number }>).map((l) => [l.objet, l.quantite]));
}

export async function chargerCadresPossedes(): Promise<string[]> {
  const { data } = await supabase.from('cadres_possedes').select('cadre');
  return ((data ?? []) as Array<{ cadre: string }>).map((l) => l.cadre);
}

export const acheter = (article: string, nombre = 1) => rpc<number>('acheter', { article, nombre });
export const equiperCadre = (choix: string | null) => rpc('equiper_cadre', { choix });
export const equiperNeon = (choix: string | null) => rpc('equiper_couleur', { choix });
export const utiliserObjet = (article: string, partie: string, cible: string) => rpc<number>('utiliser_objet', { article, partie, cible });
