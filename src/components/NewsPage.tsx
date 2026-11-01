import { Anchor, CalendarDays, Sparkles, Swords } from "lucide-react";
export default function NewsPage() {
 return <article className="news-page">
  <div className="news-kicker"><Sparkles size={15}/> JOURNAL DE BORD · ÉDITION 001</div>
  <div className="news-hero"><div className="news-emblem"><Anchor size={42}/></div><span className="news-tag">ANNONCE OFFICIELLE</span><h1>SKULL ARENA<br/><span>EST ENFIN LÀ.</span></h1><p>Levez l'ancre. L'arène ouvre ses portes.</p></div>
  <div className="news-meta"><CalendarDays size={15}/> 1 NOVEMBRE 2026 <span>•</span> 3 MIN DE LECTURE</div>
  <div className="news-copy"><p className="news-lead">Après des semaines de préparation, de stratégie et de nuits passées à peaufiner chaque détail, le moment est arrivé : <strong>Skull Arena est officiellement ouvert.</strong></p>
  <p>Réunis ton équipage, crée une salle privée pour défier tes amis ou rejoins une partie publique. Chaque manche est une nouvelle bataille : annonce tes plis, lis le jeu de tes adversaires et tente de repartir avec le trésor.</p>
  <h2>Un nouvel océan à conquérir</h2><p>Personnalise ton profil, fais grimper ton classement, débloque des succès et découvre les extensions qui viennent enrichir tes parties. Et surtout, garde un œil sur ton équipage : une bonne stratégie peut tout changer.</p>
  <div className="news-callout"><Swords size={22}/><span><strong>Ton équipage t'attend.</strong><small>La mer est vaste. La gloire se mérite.</small></span></div>
  <p>Merci à tous ceux qui ont participé à cette aventure. Ceci n'est que le début de l'histoire.</p><strong className="news-signature">À bientôt dans l'arène, Capitaine. ☠</strong></div>
 </article>;
}